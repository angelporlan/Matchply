// Script de pruebas para verificar el Endpoint de Sincronización Externa de Matchply
// Se ejecuta localmente desde el container: npx tsx scripts/test-external-api.ts

async function runTest() {
  console.log('🧪 Iniciando prueba de integración para la API de Matchply...');

  const API_URL = 'http://localhost:3000/api/external/applications';
  const API_KEY = 'matchply_ext_key_8e72fae504c51486bd9d7c0411a76f2d'; // token configurado en .env
  const TEST_EMAIL = 'angelporlandev@gmail.com'; // usuario registrado real en local

  const payload = {
    userEmail: TEST_EMAIL,
    title: 'Forward Deployed AI Engineer',
    company: 'ElevenLabs',
    url: 'https://jobs.ashbyhq.com/elevenlabs/fde-ai-test-1',
    platform: 'linkedin',
    description: 'ElevenLabs is looking for a Forward Deployed Engineer to help customize AI voice agents for enterprise clients. Strong TypeScript, Next.js, and LLM orchestration skills are required.',
    status: 'interested',
    source: 'ashby/elevenlabs',
    livenessStatus: 'active',
    scoreOverall: 4.6,
    scoreBreakdown: {
      tech_stack: 4.8,
      salary_fit: 4.2,
      culture_alignment: 5.0,
      work_mode: 4.5
    },
    tldr: 'Excelente encaje técnico y cultural. El perfil cuenta con fuerte experiencia en orquestación de agentes de IA, frameworks modernos de frontend y despliegue robusto, coincidiendo en un 95% con los requisitos.',
    redFlags: [
      'Puesto con disponibilidad de guardia ocasional en fines de semana',
      'Foco intenso en entregas rápidas con clientes corporativos exigentes'
    ],
    legitimacyTier: 'Tier 1 - High Legitimacy',
    rawReport: `# Informe Detallado de Evaluación - ElevenLabs

## Análisis de stack técnico
El candidato demuestra un dominio sobresaliente de **Next.js**, **TypeScript** y orquestación avanzada de modelos de lenguaje (LLMs). Las experiencias previas en arquitectura de microservicios y SaaS con integraciones de pasarelas de pago (Stripe) son un gran valor añadido.

## Cultura y alineación STAR
La alineación del candidato con la velocidad de desarrollo en ElevenLabs se apoya en sus logros STAR documentados de automatización de pipelines y optimización de latencia en renderizado.

## Puntos fuertes detectados
- **95% de coincidencia** en lenguajes básicos.
- Experiencia probada integrando APIs complejas de IA.
- Entorno internacional de colaboración ágil.`,
    cvMarkdownTailored: `# ANGEL PORLAN
**Email:** angelporlandev@gmail.com | **LinkedIn:** linkedin.com/in/angelporlan

## Perfil Profesional
Ingeniero de Software especializado en Inteligencia Artificial y arquitecturas Next.js de alta escala. Apasionado por la voz sintética y la interacción conversacional.

## Experiencia Profesional
### Forward Deployed AI Engineer
**AI Enterprise Lab** | *2024 - Presente*
- Lideré la integración de agentes conversacionales para 4 clientes del sector financiero, disminuyendo latencias de API en un **35%**.
- Diseñé interfaces responsivas en Next.js App Router optimizando el Core Web Vital INP.`,
    targetProofPoints: [
      'Reducción de latencia del 35% en integraciones de IA conversacional',
      'Arquitectura de Next.js App Router de escala para clientes enterprise'
    ],
    coverLetter: `Estimado equipo de ElevenLabs,

Les escribo para expresar mi gran interés en la posición de Forward Deployed AI Engineer. He seguido de cerca el liderazgo de ElevenLabs en tecnología de voz generativa y estoy convencido de que mi perfil en Next.js, TypeScript y orquestación de LLMs encaja a la perfección con sus desafíos.

En mi rol actual, logré reducir un 35% las latencias de procesamiento de voz para clientes corporativos...`,
    outreachMessage: `Hola, vi tu perfil en relación a la búsqueda de FDE en ElevenLabs. Cuento con experiencia en Next.js y orquestación de LLMs, y me encantaría conectar para conversar brevemente sobre cómo puedo aportar valor. ¡Saludos!`,
    interviewStories: [
      {
        title: 'Optimización de Latencia en Voz Conversacional',
        situation: 'Los clientes corporativos experimentaban pausas de hasta 2 segundos en las respuestas de voz sintética.',
        task: 'Identificar el cuello de botella y reducir el tiempo de respuesta total por debajo de 500ms.',
        action: 'Implementé streaming bidireccional mediante WebSockets y optimicé los buffers de audio en TypeScript.',
        result: 'Reduje la latencia de respuesta en un **35%**, logrando una conversación fluida y natural.',
        relevance: 'Demuestra habilidades profundas de optimización en tiempo real y manejo de APIs avanzadas de audio.'
      },
      {
        title: 'Lanzamiento de Plataforma SaaS Multiusuario',
        situation: 'El equipo técnico carecía de una base sólida para gestionar suscripciones de cobro recurrente.',
        task: 'Integrar Stripe con Drizzle ORM de forma segura y escalable en menos de 2 semanas.',
        action: 'Diseñé el esquema relacional en PostgreSQL e implementé webhooks idempotentes robustos.',
        result: 'La plataforma procesó más de 500 transacciones exitosas en las primeras 24 horas sin fallos.',
        relevance: 'Demuestra capacidad de entrega en plazos exigentes y dominio de bases de datos relacionales.'
      }
    ],
    nextFollowupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    rejectionPatternTags: ['tech_fit', 'remote_only']
  };

  try {
    // 1. Probar autenticación denegada (sin token)
    console.log('\n🔐 Prueba 1: Petición sin cabecera de autenticación...');
    const res1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res1.status} (Esperado: 401)`);
    const data1 = await res1.json();
    console.log('Respuesta:', data1);

    // 2. Probar autenticación denegada (token inválido)
    console.log('\n🔐 Prueba 2: Petición con token inválido...');
    const res2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token_incorrecto_123'
      },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res2.status} (Esperado: 401)`);
    const data2 = await res2.json();
    console.log('Respuesta:', data2);

    // 3. Probar sincronización exitosa (Creación de candidatura + CV)
    console.log('\n🚀 Prueba 3: Petición exitosa de creación (Crear candidatura + tailored CV)...');
    const res3 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    console.log(`Resultado: Código HTTP ${res3.status} (Esperado: 200)`);
    const data3 = await res3.json();
    console.log('Respuesta:', data3);

    if (data3.success) {
      console.log('✅ Candidatura creada e ID de CV enlazado:', data3.cvId);
      
      // 4. Probar idempotencia (Actualización sobre la misma candidatura/URL)
      console.log('\n🔄 Prueba 4: Petición exitosa de actualización (Idempotencia sobre misma URL)...');
      const updatedPayload = {
        ...payload,
        title: 'Senior Forward Deployed AI Engineer (UPDATED)',
        scoreOverall: 4.9
      };

      const res4 = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(updatedPayload)
      });
      console.log(`Resultado: Código HTTP ${res4.status} (Esperado: 200)`);
      const data4 = await res4.json();
      console.log('Respuesta:', data4);
      console.log('✅ Candidatura actualizada correctamente e ID preservado:', data4.offerId === data3.offerId ? 'SÍ' : 'NO');
    }

  } catch (error) {
    console.error('❌ Error ejecutando las pruebas de integración:', error);
  }
}

runTest();
