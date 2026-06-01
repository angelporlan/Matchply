// Script de pruebas para verificar el Endpoint de Sincronización Externa de Matchply
// Se ejecuta localmente desde el container: npx tsx scripts/test-external-api.ts

import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function runTest() {
  console.log('🧪 Iniciando pruebas de integración robustas para la API de Matchply...');

  const API_URL = 'http://localhost:3000/api/external/applications';
  const GLOBAL_API_KEY = 'matchply_ext_key_8e72fae504c51486bd9d7c0411a76f2d'; // Token configurado en .env
  const TEST_EMAIL = 'angelporlandev@gmail.com'; // Usuario registrado real en local
  const MOCK_PERSONAL_KEY = 'matchply_usr_testkey_1234567890abcdef12345678';

  // 1. Obtener y guardar el estado original del usuario para restaurarlo al final
  const [testUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_EMAIL))
    .limit(1);

  if (!testUser) {
    console.error(`❌ Error Crítico: No se encontró el usuario de pruebas "${TEST_EMAIL}" en la base de datos.`);
    console.log('Por favor, regístrate en Matchply con este correo antes de correr las pruebas.');
    process.exit(1);
  }

  const originalSubscriptionStatus = testUser.subscriptionStatus;
  const originalApiKey = testUser.apiKey;

  console.log(`👤 Usuario de prueba encontrado: ${testUser.name} (${TEST_EMAIL})`);
  console.log(`   - Estado de suscripción original: "${originalSubscriptionStatus}"`);
  console.log(`   - API Key original: ${originalApiKey ? 'Configurada' : 'Ninguna'}`);

  const payload = {
    userEmail: TEST_EMAIL,
    title: 'Senior Forward Deployed AI Engineer',
    company: 'ElevenLabs',
    url: 'https://jobs.ashbyhq.com/elevenlabs/fde-ai-test-1',
    platform: 'linkedin',
    description: 'ElevenLabs is looking for a Forward Deployed Engineer to help customize AI voice agents for enterprise clients. Strong TypeScript, Next.js, and LLM orchestration skills are required.',
    status: 'interested',
    source: 'ashby/elevenlabs',
    livenessStatus: 'active',
    scoreOverall: 4.8,
    scoreBreakdown: {
      tech_stack: 4.8,
      salary_fit: 4.2,
      culture_alignment: 5.0,
      work_mode: 4.5
    },
    tldr: 'Excelente encaje técnico y cultural.',
    redFlags: [
      'Puesto con disponibilidad de guardia ocasional'
    ],
    legitimacyTier: 'Tier 1 - High Legitimacy',
    cvMarkdownTailored: `# ANGEL PORLAN\n**Email:** angelporlandev@gmail.com\n\n## Perfil\nEspecialista en IA y Next.js.`,
    targetProofPoints: [
      'Reducción de latencia del 35% en integraciones de IA conversacional'
    ]
  };

  try {
    // ==========================================
    // ESCENARIO 1: USUARIO CON PLAN GRATUITO (FREE)
    // ==========================================
    console.log('\n--- 🆓 ESCENARIO 1: Pruebas con PLAN GRATUITO (subscriptionStatus = "none") ---');
    
    // Configurar usuario como gratuito y con clave personal asignada
    await db
      .update(users)
      .set({ subscriptionStatus: 'none', apiKey: MOCK_PERSONAL_KEY })
      .where(eq(users.id, testUser.id));

    // A. Probar con API Key Personal
    console.log('🔌 Prueba 1.1: Petición con API Key Personal en plan Gratuito...');
    const res1_1 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_PERSONAL_KEY}`
      },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res1_1.status} (Esperado: 403)`);
    const data1_1 = await res1_1.json();
    console.log('Respuesta:', data1_1);

    // B. Probar con API Key Global
    console.log('\n🔌 Prueba 1.2: Petición con API Key Global en plan Gratuito...');
    const res1_2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLOBAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res1_2.status} (Esperado: 403)`);
    const data1_2 = await res1_2.json();
    console.log('Respuesta:', data1_2);


    // ==========================================
    // ESCENARIO 2: USUARIO CON PLAN PREMIUM (PRO)
    // ==========================================
    console.log('\n--- 👑 ESCENARIO 2: Pruebas con PLAN PREMIUM PRO (subscriptionStatus = "active") ---');
    
    // Configurar usuario como PRO
    await db
      .update(users)
      .set({ subscriptionStatus: 'active' })
      .where(eq(users.id, testUser.id));

    // A. Probar con API Key Personal
    console.log('🔌 Prueba 2.1: Sincronización exitosa con API Key Personal (PRO)...');
    const res2_1 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_PERSONAL_KEY}`
      },
      // En la clave personal, no pasamos userEmail o pasamos uno falso para verificar el aislamiento multitenant
      body: JSON.stringify({
        ...payload,
        userEmail: 'hack_email@gmail.com', // Debe ser ignorado por completo
        title: 'Senior Forward Deployed AI Engineer (Personal Key PRO)'
      })
    });
    console.log(`Resultado: Código HTTP ${res2_1.status} (Esperado: 200)`);
    const data2_1 = await res2_1.json();
    console.log('Respuesta:', data2_1);

    // B. Probar con API Key Global (Retrocompatibilidad)
    console.log('\n🔌 Prueba 2.2: Sincronización exitosa con API Key Global (PRO)...');
    const res2_2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLOBAL_API_KEY}`
      },
      body: JSON.stringify({
        ...payload,
        title: 'Senior Forward Deployed AI Engineer (Global Key PRO)'
      })
    });
    console.log(`Resultado: Código HTTP ${res2_2.status} (Esperado: 200)`);
    const data2_2 = await res2_2.json();
    console.log('Respuesta:', data2_2);


    // ==========================================
    // ESCENARIO 3: CLAVES ERRÓNEAS O INEXISTENTES
    // ==========================================
    console.log('\n--- 🔐 ESCENARIO 3: Pruebas de Autorización Denegada ---');

    // A. Probar sin cabecera de autorización
    console.log('🔌 Prueba 3.1: Petición sin cabecera Authorization...');
    const res3_1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res3_1.status} (Esperado: 401)`);
    const data3_1 = await res3_1.json();
    console.log('Respuesta:', data3_1);

    // B. Probar con API Key Personal Inválida
    console.log('\n🔌 Prueba 3.2: Petición con API Key Personal inexistente...');
    const res3_2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer matchply_usr_incorrectkey'
      },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res3_2.status} (Esperado: 401)`);
    const data3_2 = await res3_2.json();
    console.log('Respuesta:', data3_2);

  } catch (error) {
    console.error('❌ Error durante la ejecución de las pruebas:', error);
  } finally {
    // ==========================================
    // RESTAURAR ESTADO DE LA BASE DE DATOS
    // ==========================================
    console.log('\n⏳ Restaurando los valores originales en la base de datos...');
    await db
      .update(users)
      .set({
        subscriptionStatus: originalSubscriptionStatus,
        apiKey: originalApiKey
      })
      .where(eq(users.id, testUser.id));
    console.log('✅ Base de datos restaurada correctamente a su estado original.');
    process.exit(0);
  }
}

runTest();
