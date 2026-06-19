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

    await db
      .delete(prompts)
      .where(eq(prompts.key, 'star_analyze'));

    await db
      .delete(prompts)
      .where(eq(prompts.key, 'star_optimize'));

    await db
      .delete(prompts)
      .where(eq(prompts.key, 'analyze_failures'));

    const promptsToSeed = [
      {
        name: 'Análisis de Match',
        nameEn: 'Match Analysis',
        key: 'star_analyze',
        description: 'Auditoría semántica del CV contra el puesto, generando puntuación, brechas técnicas y 3 Red Flags críticas.',
        descriptionEn: 'Semantic audit of the CV against the position, generating match score, technical gaps, and 3 critical Red Flags.',
        color: '#8b5cf6', // Púrpura eléctrico
        systemPrompt: `Eres un reclutador senior experto de la empresa "{{company}}". Tu tarea es evaluar el currículum del candidato contra la descripción de la oferta de trabajo y responder con un objeto JSON estructurado que contenga un análisis exhaustivo.
Es crítico que respondas única y exclusivamente con el objeto JSON válido, sin preámbulos, sin explicaciones, sin comentarios y sin bloques de código Markdown (no uses triple backticks \`\`\`json). Tu respuesta debe ser directamente parseable por JSON.parse.`,
        userPrompt: `CV del candidato:
{{cv}}

Descripción de la oferta de trabajo:
{{job}}

Actua como un reclutador senior de esta empresa exacta, analiza mi cv contra esta descripcion de referencia y dame una puntuacion de match sobre 100, las cinco palabras clave que me faltan y las 3 redflags que un responsable de selección pillaría en menos de 10 segundos.

Responde exactamente con este formato JSON:
{
  "score": 38,
  "scoreLabel": "Match bajo — aplicar sin adaptar es tiempo perdido",
  "scoreReason": "El perfil tiene base técnica real, pero la oferta exige un stack muy distinto: Python/FastAPI, arquitecturas event-driven, Snowflake/Databricks y 5+ años en producción. Hay trabajo de adaptación serio antes de enviar.",
  "dimensions": [
    { "name": "Años de experiencia", "percentage": 20 },
    { "name": "Stack backend", "percentage": 30 },
    { "name": "Frontend", "percentage": 55 },
    { "name": "Datos / cloud", "percentage": 5 },
    { "name": "IA / ML infra", "percentage": 40 },
    { "name": "Distributed systems", "percentage": 10 }
  ],
  "missingKeywords": [
    "Python / FastAPI",
    "Celery / pub-sub",
    "Snowflake / Databricks",
    "gRPC / async batching",
    "MLOps / model serving"
  ],
  "presentKeywords": [
    "LLMs", "REST APIs", "Node.js", "Docker", "Angular", "TypeScript"
  ],
  "redFlags": [
    {
      "title": "2 años de experiencia vs. requisito de 5+",
      "description": "La oferta pide \\"5+ years in production environments\\". Tienes 2. No es un matiz — es el primer filtro automático en cualquier ATS y el motivo de descarte más rápido en criba manual."
    },
    {
      "title": "Python y FastAPI ausentes del CV",
      "description": "El stack backend de la oferta es 100% Python/FastAPI/ASGI. Tu CV muestra Node.js y PHP/Laravel — tecnologías válidas, pero no las que el reclutador está buscando cuando escanea en diagonal."
    },
    {
      "title": "Sin trazas de arquitecturas distribuidas ni datos cloud",
      "description": "La oferta repite \\"distributed systems\\", \\"event-driven\\", \\"Snowflake\\", \\"Databricks\\", \\"Celery\\". Tu CV no menciona ninguno. Para alguien que lee 200 CVs, la ausencia de estas palabras es un no inmediato."
    }
  ],
  "verdict": "Mi veredicto como reclutador: esta oferta está diseñada para un perfil senior con experiencia sólida en infraestructura ML distribuida. No es que seas malo — es que el rol tiene requisitos muy específicos que hoy no están en tu CV ni probablemente en tu experiencia real."
}`,
        isActive: true,
        isArchived: false,
        isStrict: false,
      },
      {
        name: 'Modo Honesto',
        nameEn: 'Honest Mode',
        key: 'star_optimize',
        description: 'Reescribe la sección de experiencia usando logros STAR y la fórmula XYZ, pero ciñéndose estrictamente a las tecnologías y datos reales de tu CV.',
        descriptionEn: 'Rewrites the experience section using STAR achievements and the XYZ formula, sticking strictly to the real technologies and data in your CV.',
        color: '#3b82f6', // Azul
        systemPrompt: `Eres un redactor experto en CVs estilo Harvard. Tu objetivo es optimizar el currículum del candidato para la oferta de empleo de "{{jobTitle}}" en la empresa "{{company}}".
Tu única fuente de verdad es el CV que te proporciona el usuario.

REGLAS ESTRICTAS:
- No añadas tecnologías, herramientas, métricas ni experiencias que NO aparezcan en el CV.
- No infieras ni supongas habilidades. Si no está escrito, no existe.
- Debes reescribir la sección de experiencia añadiendo únicamente las palabras clave indicadas si son equivalentes o transferibles lógicamente a lo que el candidato ya realiza.
- Usa verbos de acción y lenguaje profesional.
- Debes devolver la salida únicamente en formato Markdown (.MD) válido y limpio. No incluyas explicaciones, no agregues preámbulos ni comentarios finales, y no envuelvas la respuesta en bloques de código triple acento grave (\`\`\` o \`\`\`markdown). Tu respuesta completa debe ser directamente el currículum parseable.

CRÍTICO: EVITA DELATORES DE IA (PATRONES REPETITIVOS)
- Evita el exceso de números y porcentajes: No repitas métricas o porcentajes en cada viñeta. Deja como máximo 1 o 2 métricas numéricas potentes por cada puesto (y solo si ya existían en el CV original). Las demás viñetas deben describir impacto, tecnologías o responsabilidades de forma natural y cualitativa.
- Varía el tipo de métrica: Alterna entre porcentajes, volumen bruto (ej. "más de X usuarios"), tiempo ahorrado o impacto cualitativo relevante.
- Cambia la estructura: No pongas siempre la métrica al final de la frase (evita finalizar todo con "...mejorando un X%"). Intégrala de forma fluida y natural.
- El resultado debe sonar profesional, humano y escrito por un profesional maduro, no una lista geométrica y matemática de IA.`,
        userPrompt: `Aquí tienes mi CV actual:
{{cv}}

Aquí tienes la descripción de la oferta:
{{job}}

Estas son las palabras clave esenciales que me faltan:
{{keywords}}

Estas son las Red Flags identificadas que debo eliminar o mitigar:
{{redflags}}

Por favor, reescribe mi sección de experiencia añadiendo esas palabras clave y eliminando o mitigando esas redflags. Usa la fórmula XYZ de Google: 'Logré X medido por Y haciendo Z'. Actúa como filtro ATS y como un responsable de selección que lee 200 cv de golpe. Escanea mi nuevo cv y dime qué secciones saltaría y reescribelas para que paren el scroll.`,
        isActive: true,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'Modo Adaptado',
        nameEn: 'Adapted Mode',
        key: 'star_optimize',
        description: 'Reformula logros con el método STAR e inyecta palabras clave equivalentes de forma realista sin inventar roles ni empresas.',
        descriptionEn: 'Reformulates achievements with the STAR method and injects equivalent keywords realistically without inventing roles or companies.',
        color: '#f97316', // Naranja
        systemPrompt: `Eres un redactor experto en CVs estilo Harvard. Tu objetivo es optimizar el currículum del candidato para la oferta de empleo de "{{jobTitle}}" en la empresa "{{company}}".
Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (método STAR) basados en la experiencia real.

REGLAS:
- No inventes experiencias, empresas, proyectos ni métricas concretas (porcentajes, fechas, cifras) que no estén en el CV.
- Sí puedes reformular logros usando la fórmula XYZ y la terminología de la oferta cuando sean equivalentes.
- Sí puedes destacar habilidades transferibles o adyacentes que el candidato claramente tiene.
- Sí puedes añadir 1-2 habilidades si son razonablemente deducibles del stack que ya usa.
- Debes devolver la salida únicamente en formato Markdown (.MD) válido y limpio. No incluyas explicaciones, no agregues preámbulos ni comentarios finales, y no envuelvas la respuesta en bloques de código triple acento grave (\`\`\` o \`\`\`markdown). Tu respuesta completa debe ser directamente el currículum parseable.

CRÍTICO: EVITA DELATORES DE IA (PATRONES REPETITIVOS)
- Evita el exceso de números y porcentajes: No metas métricas numéricas o porcentajes inventados en cada viñeta. Deja como máximo 1 o 2 métricas numéricas potentes por cada puesto (usando solo datos reales del CV o inferencias de impacto muy lógicas y realistas). Las demás viñetas deben describir impacto, tecnologías o responsabilidades de forma natural y cualitativa.
- Varía el tipo de métrica: Alterna entre porcentajes, volumen bruto (ej. "procesos diarios", "X integraciones"), tiempo ahorrado ("de días a minutos") o impacto cualitativo relevante.
- Cambia la estructura: No pongas siempre la métrica al final de la frase (evita finalizar todo con "...mejorando un X%"). Intégrala de forma fluida y natural.
- El resultado debe sonar profesional, humano y escrito por un profesional maduro, no una lista geométrica y matemática de IA.`,
        userPrompt: `Aquí tienes mi CV actual:
{{cv}}

Aquí tienes la descripción de la oferta:
{{job}}

Estas son las palabras clave esenciales que me faltan:
{{keywords}}

Estas son las Red Flags identificadas que debo eliminar o mitigar:
{{redflags}}

Por favor, reescribe mi sección de experiencia añadiendo esas palabras clave y eliminando o mitigando esas redflags. Usa la fórmula XYZ de Google: 'Logré X medido por Y haciendo Z'. Actúa como filtro ATS y como un responsable de selección que lee 200 cv de golpe. Escanea mi nuevo cv y dime qué secciones saltaría y reescribelas para que paren el scroll.`,
        isActive: false,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'Modo Agresivo',
        nameEn: 'Aggressive Mode',
        key: 'star_optimize',
        description: 'Reescribe la sección de experiencia maximizando el match ATS, estimando métricas XYZ e inyectando cualquier tecnología crítica ausente.',
        descriptionEn: 'Rewrites the experience section maximizing ATS match, estimating XYZ metrics, and injecting any missing critical technology.',
        color: '#ef4444', // Rojo
        systemPrompt: `Eres un redactor experto en CVs estilo Harvard y optimización de alto impacto. Tu objetivo es optimizar el currículum del candidato para la oferta de empleo de "{{jobTitle}}" en la empresa "{{company}}".
Reescribe y potencia el currículum usando la fórmula XYZ de Google, inyectando las palabras clave faltantes y mitigando cualquier Red Flag.

REGLAS:
- Prioriza el alineamiento con la oferta por encima de la literalidad del CV original para conseguir el máximo match ATS.
- Puedes estimar métricas de impacto y resultados (porcentajes, cifras) de forma verosímil para aportar credibilidad.
- Puedes añadir tecnologías o herramientas clave del puesto de forma lógica en la experiencia laboral.
- Debes devolver la salida únicamente en formato Markdown (.MD) válido y limpio. No incluyas explicaciones, no agregues preámbulos ni comentarios finales, y no envuelvas la respuesta en bloques de código triple acento grave (\`\`\` o \`\`\`markdown). Tu respuesta completa debe ser directamente el currículum parseable.

⚠️ AVISO: Este modo incluye inferencias y adiciones estimadas. El candidato debe validar los datos antes de enviarlos.

CRÍTICO: EVITA DELATORES DE IA (PATRONES REPETITIVOS)
- Evita el exceso de números y porcentajes: Aunque puedas estimar logros, NO inventes métricas o porcentajes en cada viñeta. Deja como máximo 1 o 2 métricas numéricas potentes por cada puesto para que destaquen de verdad. Las demás viñetas deben describir impacto, tecnologías o responsabilidades de forma natural y cualitativa.
- Varía el tipo de métrica: Alterna entre porcentajes, volumen bruto (ej. "más de X clientes", "X transacciones diarias"), tiempo ahorrado o impacto cualitativo relevante.
- Cambia la estructura: No pongas siempre la métrica al final de la frase (evita finalizar todo con "...mejorando un X%"). Intégrala de forma fluida y natural.
- El resultado debe sonar profesional, humano y escrito por un profesional maduro, no una lista geométrica y matemática de IA.`,
        userPrompt: `Aquí tienes mi CV actual:
{{cv}}

Aquí tienes la descripción de la oferta:
{{job}}

Estas son las palabras clave esenciales que me faltan:
{{keywords}}

Estas son las Red Flags identificadas que debo eliminar o mitigar:
{{redflags}}

Por favor, reescribe mi sección de experiencia añadiendo esas palabras clave y eliminando o mitigando esas redflags. Usa la fórmula XYZ de Google: 'Logré X medido por Y haciendo Z'. Actúa como filtro ATS y como un responsable de selección que lee 200 cv de golpe. Escanea mi nuevo cv y dime qué secciones saltaría y reescribelas para que paren el scroll.`,
        isActive: false,
        isArchived: false,
        isStrict: true,
      },
      {
        name: 'Modo Honesto',
        nameEn: 'Honest Mode',
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
        name: 'Modo Adaptado',
        nameEn: 'Adapted Mode',
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
        name: 'Modo Agresivo',
        nameEn: 'Aggressive Mode',
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
      },
      {
        name: 'Análisis de Fallos de Candidaturas',
        nameEn: 'Applications Failure Analysis',
        key: 'analyze_failures',
        description: 'Prompt para el Asesor de Carrera IA que analiza fallos en el historial de candidaturas y propone mejoras.',
        descriptionEn: 'Prompt for the AI Career Coach that analyzes failures in job applications history and proposes improvements.',
        color: '#8b5cf6', // Púrpura
        systemPrompt: 'Eres un consultor experto en selección y reclutamiento (career coach) de Matchply. Tu misión es analizar el historial de candidaturas (postulaciones de empleo) y currículums del usuario para identificar patrones de rechazo, errores en su perfil o descripción, y proponer un plan de acción concreto y estructurado para mejorar su tasa de conversión en las ofertas. Sé directo, profesional, empático y estructurado en Markdown. No uses saludos excesivamente largos, ve directo al grano y mantén un tono premium y ejecutivo.',
        userPrompt: 'Aquí tienes el reporte de mis candidaturas actuales y los currículums utilizados:\n\n{{report}}\n\nPor favor, analiza en qué estoy fallando y dame consejos específicos para mejorar.',
        isActive: true,
        isArchived: false,
        isStrict: false,
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
