import { db } from '../src/db';
import { users, prompts } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
  const email = 'angelporlandev@gmail.com';
  const name = 'Angel Porlan';
  const password = 'admin123';

  console.log(`⏳ Iniciando seeding de la base de datos...`);

  try {
    // === 1. SEED USER ===
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      console.log(`ℹ️ El usuario "${email}" ya existe. Actualizando a rol ADMIN y PREMIUM...`);
      await db
        .update(users)
        .set({ 
          role: 'admin',
          subscriptionStatus: 'active'
        })
        .where(eq(users.email, email));
      console.log(`✅ El usuario "${existingUser.name || 'Sin nombre'}" (${email}) ha sido actualizado a ADMINISTRADOR y PREMIUM.`);
    } else {
      console.log(`ℹ️ El usuario "${email}" no existe. Creando usuario con contraseña por defecto...`);
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(users).values({
        name,
        email,
        passwordHash,
        role: 'admin',
        subscriptionStatus: 'active',
      });
      console.log(`✅ ¡Éxito! Creado usuario administrador:`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Contraseña temporal: ${password}`);
    }

    // === 2. SEED PROMPTS ===
    console.log(`⏳ Configurando prompts en la base de datos...`);

    // Limpiamos los prompts de la base de datos para evitar duplicados
    await db
      .delete(prompts)
      .where(eq(prompts.key, 'optimize_cv'));

    await db
      .delete(prompts)
      .where(eq(prompts.key, 'import_cv'));

    const promptsToSeed = [
      {
        name: 'MODO 1 — Honesto (cero invención)',
        nameEn: 'MODE 1 — Honest (zero invention)',
        key: 'optimize_cv',
        description: 'Optimización estricta basada únicamente en el contenido de tu CV. No añade habilidades ni experiencias que no estén en el documento.',
        descriptionEn: 'Strict optimization based solely on your CV\'s content. Does not add skills or experiences that are not in the document.',
        color: '#3b82f6', // Azul
        systemPrompt: `Eres un redactor experto en CVs técnicos. Tu única fuente de verdad es el CV que te proporciona el usuario. 

REGLAS ESTRICTAS:
- No añadas tecnologías, herramientas, métricas ni experiencias que NO aparezcan en el CV.
- No inferras ni supongas habilidades. Si no está escrito, no existe.
- Puedes reordenar, reformular y priorizar lo que ya existe para alinearlo con la oferta.
- Usa verbos de acción y lenguaje profesional.
- Extrae las 5 palabras clave / habilidades más importantes de la oferta y úsalas para guiar la reformulación, pero solo donde haya respaldo real en el CV.`,
        userPrompt: `CV Base: {{cv}}
Oferta de Trabajo: {{job}}`,
        isActive: true,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'MODO 2 — Adaptado (con inferencias razonables)',
        nameEn: 'MODE 2 — Adapted (reasonable inference)',
        key: 'optimize_cv',
        description: 'Reformula y destaca habilidades equivalentes y transferibles de forma realista. Permite añadir 1-2 habilidades lógicamente deducibles.',
        descriptionEn: 'Reformulates and highlights equivalent and transferable skills realistically. Allows adding 1-2 logically deducible skills.',
        color: '#f97316', // Naranja
        systemPrompt: `Eres un redactor experto en CVs técnicos. Optimiza el CV para la oferta dada siguiendo estas reglas:

REGLAS:
- No inventes experiencias, empresas, proyectos ni métricas concretas (porcentajes, fechas, cifras) que no estén en el CV.
- Sí puedes reformular habilidades existentes usando la terminología de la oferta cuando sean equivalentes (ej: "integración de APIs" → "diseño de REST APIs escalables").
- Sí puedes destacar habilidades transferibles o adyacentes que el candidato claramente tiene aunque no las haya nombrado con exactitud.
- Sí puedes añadir 1-2 habilidades en la sección de Skills si son razonablemente deducibles del stack que ya usa (ej: si usa Docker, puedes añadir "orquestación de contenedores").
- Extrae las 5 palabras clave más importantes de la oferta y úsalas para priorizar la estructura del CV.`,
        userPrompt: `CV Base: {{cv}}
Oferta de Trabajo: {{job}}`,
        isActive: false,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'MODO 3 — Agresivo (máximo match, mínima ética 😅)',
        nameEn: 'MODE 3 — Aggressive (maximum match, low ethics 😅)',
        key: 'optimize_cv',
        description: 'Reescribe el CV estimando logros e inyectando tecnologías clave exigidas por la oferta para maximizar tu compatibilidad y pasar los filtros ATS.',
        descriptionEn: 'Rewrites the CV estimating achievements and injecting key technologies required by the offer to maximize compatibility and pass ATS filters.',
        color: '#ef4444', // Rojo
        systemPrompt: `Eres un reclutador experto y redactor de CVs de alto impacto. Analiza la oferta, extrae las 5 habilidades clave y reescribe el CV para maximizar el match con el puesto.

REGLAS:
- Prioriza el alineamiento con la oferta por encima de la literalidad del CV original.
- Puedes añadir tecnologías, herramientas o contextos que sean plausibles dado el perfil del candidato, aunque no aparezcan explícitamente.
- Usa métricas y resultados de impacto donde aporten credibilidad (puedes estimarlos si son razonables).
- Reformula el perfil profesional, experiencia y habilidades para que resuenen directamente con el lenguaje de la oferta.
- El resultado debe sonar auténtico, profesional y convincente.

⚠️ AVISO: Este modo puede incluir inferencias y adiciones no verificadas. El candidato es responsable de revisar y validar el contenido antes de enviarlo.`,
        userPrompt: `CV Base: {{cv}}
Oferta de Trabajo: {{job}}`,
        isActive: false,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'Importar y Formatear CV',
        nameEn: 'Import and Format CV',
        key: 'import_cv',
        description: 'Importa y estructura tu currículum adaptándolo al formato y reglas de diseño Markdown de Matchply.',
        descriptionEn: 'Imports and structures your resume adapting it to Matchply\'s Markdown layout and design rules.',
        color: '#10b981', // Verde esmeralda
        systemPrompt: `Eres un transcriptor experto en currículums. Tu tarea es tomar la información del currículum provisto por el usuario y estructurarla/escribirla exactamente respetando fielmente el contenido original.

Debes adaptar la estructura para que cumpla estrictamente con las reglas de renderizado Markdown de la aplicación.`,
        userPrompt: `Texto del Currículum a Importar:
{{cv}}`,
        isActive: true,
        isArchived: false,
        isStrict: true,
      }
    ];

    for (const promptData of promptsToSeed) {
      await db.insert(prompts).values(promptData);
      console.log(`✅ Prompt creado: "${promptData.name}" (${promptData.key})`);
    }

    console.log(`🎉 ¡Base de datos sembrada con éxito!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    process.exit(1);
  }
}

seed();
