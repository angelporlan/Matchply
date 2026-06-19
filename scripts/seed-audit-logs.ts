import { db } from '../src/db';
import { users, auditLogs } from '../src/db/schema';
import { inArray } from 'drizzle-orm';

const emailsToSeed = [
  'carlosmillan7@gmail.com', 'mmartinezreverte@gmail.com', 'abetogasol@gmail.com',
  'estebanbuitrago@gmail.com', 'alexlopesanchez@gmail.com', 'mperezgarcia@gmail.com',
  'juangomez92@gmail.com', 'laurasanchez.dev@gmail.com', 'pmartinez88@gmail.com',
  'sofia.ruiz@gmail.com', 'dfernandez.eng@gmail.com', 'marialopezgarcia@gmail.com',
  'jtorres.dev@gmail.com', 'anabortiz@gmail.com', 'pablocastro.code@gmail.com',
  'elenanavarro95@gmail.com', 'marcosdelgado@gmail.com', 'carmenrubio.design@gmail.com',
  'jamarindev@gmail.com', 'luciagil90@gmail.com', 'sromerocode@gmail.com',
  'irenesanz.dev@gmail.com', 'alvaromolina93@gmail.com', 'martavidal.design@gmail.com',
  'fortegadev@gmail.com', 'paulaherrero.art@gmail.com',
  'robertojimenez@gmail.com', 'silvia.marin@gmail.com', 'avegadev@gmail.com',
  'claraserrano94@gmail.com', 'carlosalonso.dev@gmail.com', 'nflores.art@gmail.com',
  'danielblanco.eng@gmail.com', 'cristinamolina@gmail.com', 'mramoscode@gmail.com',
  'bguerrerodesign@gmail.com', 'fsuarezdev@gmail.com', 'olgaiglesias91@gmail.com',
  'rcastillocode@gmail.com', 'martapastor@gmail.com', 'raulnavarro92@gmail.com',
  'gloriaherreradev@gmail.com', 'albertoprieto@gmail.com', 'smendezdesign@gmail.com',
  'ecabreracode@gmail.com', 'leticiacarrasco@gmail.com'
];

const actions = [
  {
    action: 'user_login',
    getDetails: () => JSON.stringify({ method: 'credentials', success: true }),
  },
  {
    action: 'cv_create_manual',
    getDetails: () => JSON.stringify({ templateName: 'harvard', language: 'es' }),
  },
  {
    action: 'cv_optimize_ai',
    getDetails: () => JSON.stringify({ provider: 'openrouter', model: 'google/gemma-2-9b-it' }),
  },
  {
    action: 'job_offer_create',
    getDetails: () => JSON.stringify({ title: 'Frontend Developer', company: 'Stripe', platform: 'linkedin' }),
  },
  {
    action: 'job_offer_status_change',
    getDetails: () => JSON.stringify({ oldStatus: 'interested', newStatus: 'applied' }),
  }
];

function getRandomDateInLast3Days() {
  const currentLocalTime = new Date('2026-06-17T12:05:00'); // Fecha de referencia
  const threeDaysAgo = new Date(currentLocalTime.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const randomTime = threeDaysAgo.getTime() + Math.random() * (currentLocalTime.getTime() - threeDaysAgo.getTime());
  return new Date(randomTime);
}

function getRandomIp() {
  return `85.54.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function seedAuditLogs() {
  console.log('⏳ Buscando usuarios en la base de datos...');
  
  const dbUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, emailsToSeed));

  if (dbUsers.length === 0) {
    console.log('❌ No se encontraron usuarios para insertar logs de auditoría.');
    process.exit(1);
  }

  console.log(`⏳ Insertando logs de auditoría para ${dbUsers.length} usuarios...`);
  let logsCount = 0;

  for (const user of dbUsers) {
    const logsToGenerate = Math.floor(Math.random() * 3) + 2; // Entre 2 y 4 logs por usuario

    for (let i = 0; i < logsToGenerate; i++) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const createdAt = getRandomDateInLast3Days();
      const ip = getRandomIp();
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      await db.insert(auditLogs).values({
        userId: user.id,
        userEmail: user.email,
        action: randomAction.action,
        details: randomAction.getDetails(),
        ipAddress: ip,
        userAgent: userAgent,
        createdAt: createdAt
      });
      logsCount++;
    }
  }

  console.log(`🎉 Finalizado. Creados exitosamente ${logsCount} registros de auditoría simulados.`);
  process.exit(0);
}

seedAuditLogs();
