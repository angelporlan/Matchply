import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface SeedUser {
  email: string;
  name: string;
  createdAt: Date;
  subscriptionStatus: 'active' | 'none';
}

const proUsers: SeedUser[] = [
  // 6 Usuarios iniciales PRO
  {
    email: 'carlosmillan7@gmail.com',
    name: 'Carlos Millán',
    createdAt: new Date('2026-05-25T13:36:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'mmartinezreverte@gmail.com',
    name: 'M. Martínez Reverte',
    createdAt: new Date('2026-05-23T10:04:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'abetogasol@gmail.com',
    name: 'Abeto Gasol',
    createdAt: new Date('2026-05-22T20:56:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'estebanbuitrago@gmail.com',
    name: 'Esteban Buitrago',
    createdAt: new Date('2026-05-22T17:23:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'alexlopesanchez@gmail.com',
    name: 'Alex Lopesanchez',
    createdAt: new Date('2026-05-21T11:15:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'mperezgarcia@gmail.com',
    name: 'M. Pérez García',
    createdAt: new Date('2026-05-20T15:41:00'),
    subscriptionStatus: 'active',
  },
  // 20 Usuarios adicionales PRO
  {
    email: 'juangomez92@gmail.com',
    name: 'Juan Gómez',
    createdAt: new Date('2026-05-20T10:12:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'laurasanchez.dev@gmail.com',
    name: 'Laura Sánchez',
    createdAt: new Date('2026-05-20T18:30:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'pmartinez88@gmail.com',
    name: 'Pedro Martínez',
    createdAt: new Date('2026-05-21T09:15:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'sofia.ruiz@gmail.com',
    name: 'Sofia Ruiz',
    createdAt: new Date('2026-05-21T14:45:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'dfernandez.eng@gmail.com',
    name: 'David Fernández',
    createdAt: new Date('2026-05-21T22:10:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'marialopezgarcia@gmail.com',
    name: 'Maria López',
    createdAt: new Date('2026-05-22T08:20:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'jtorres.dev@gmail.com',
    name: 'Javier Torres',
    createdAt: new Date('2026-05-22T11:30:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'anabortiz@gmail.com',
    name: 'Ana Belén Ortiz',
    createdAt: new Date('2026-05-22T16:05:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'pablocastro.code@gmail.com',
    name: 'Pablo Castro',
    createdAt: new Date('2026-05-22T19:40:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'elenanavarro95@gmail.com',
    name: 'Elena Navarro',
    createdAt: new Date('2026-05-23T11:10:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'marcosdelgado@gmail.com',
    name: 'Marcos Delgado',
    createdAt: new Date('2026-05-23T15:25:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'carmenrubio.design@gmail.com',
    name: 'Carmen Rubio',
    createdAt: new Date('2026-05-23T21:50:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'jamarindev@gmail.com',
    name: 'Jose Antonio Marín',
    createdAt: new Date('2026-05-24T09:05:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'luciagil90@gmail.com',
    name: 'Lucía Gil',
    createdAt: new Date('2026-05-24T13:40:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'sromerocode@gmail.com',
    name: 'Sergio Romero',
    createdAt: new Date('2026-05-24T17:15:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'irenesanz.dev@gmail.com',
    name: 'Irene Sanz',
    createdAt: new Date('2026-05-24T23:30:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'alvaromolina93@gmail.com',
    name: 'Álvaro Molina',
    createdAt: new Date('2026-05-25T08:50:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'martavidal.design@gmail.com',
    name: 'Marta Vidal',
    createdAt: new Date('2026-05-25T11:20:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'fortegadev@gmail.com',
    name: 'Francisco Ortega',
    createdAt: new Date('2026-05-25T15:10:00'),
    subscriptionStatus: 'active',
  },
  {
    email: 'paulaherrero.art@gmail.com',
    name: 'Paula Herrero',
    createdAt: new Date('2026-05-25T17:45:00'),
    subscriptionStatus: 'active',
  },
  // 20 Nuevos usuarios SIN suscripción (status 'none')
  {
    email: 'robertojimenez@gmail.com',
    name: 'Roberto Jiménez',
    createdAt: new Date('2026-05-20T09:30:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'silvia.marin@gmail.com',
    name: 'Silvia Marín',
    createdAt: new Date('2026-05-20T15:15:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'avegadev@gmail.com',
    name: 'Antonio Vega',
    createdAt: new Date('2026-05-20T21:05:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'claraserrano94@gmail.com',
    name: 'Clara Serrano',
    createdAt: new Date('2026-05-21T08:40:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'carlosalonso.dev@gmail.com',
    name: 'Carlos Alonso',
    createdAt: new Date('2026-05-21T12:15:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'nflores.art@gmail.com',
    name: 'Natalia Flores',
    createdAt: new Date('2026-05-21T17:30:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'danielblanco.eng@gmail.com',
    name: 'Daniel Blanco',
    createdAt: new Date('2026-05-21T20:50:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'cristinamolina@gmail.com',
    name: 'Cristina Molina',
    createdAt: new Date('2026-05-22T10:25:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'mramoscode@gmail.com',
    name: 'Manuel Ramos',
    createdAt: new Date('2026-05-22T14:10:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'bguerrerodesign@gmail.com',
    name: 'Beatriz Guerrero',
    createdAt: new Date('2026-05-22T22:30:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'fsuarezdev@gmail.com',
    name: 'Fernando Suárez',
    createdAt: new Date('2026-05-23T09:20:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'olgaiglesias91@gmail.com',
    name: 'Olga Iglesias',
    createdAt: new Date('2026-05-23T13:15:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'rcastillocode@gmail.com',
    name: 'Rubén Castillo',
    createdAt: new Date('2026-05-23T18:40:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'martapastor@gmail.com',
    name: 'Marta Pastor',
    createdAt: new Date('2026-05-24T10:50:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'raulnavarro92@gmail.com',
    name: 'Raúl Navarro',
    createdAt: new Date('2026-05-24T15:30:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'gloriaherreradev@gmail.com',
    name: 'Gloria Herrera',
    createdAt: new Date('2026-05-24T19:15:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'albertoprieto@gmail.com',
    name: 'Alberto Prieto',
    createdAt: new Date('2026-05-25T09:40:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'smendezdesign@gmail.com',
    name: 'Silvia Méndez',
    createdAt: new Date('2026-05-25T12:05:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'ecabreracode@gmail.com',
    name: 'Enrique Cabrera',
    createdAt: new Date('2026-05-25T14:30:00'),
    subscriptionStatus: 'none',
  },
  {
    email: 'leticiacarrasco@gmail.com',
    name: 'Leticia Carrasco',
    createdAt: new Date('2026-05-25T19:10:00'),
    subscriptionStatus: 'none',
  },
];

async function seedProUsers() {
  console.log('⏳ Creando/Actualizando usuarios PRO y FREE en la base de datos...');
  const defaultPasswordHash = await bcrypt.hash('MatchplyPro2026!', 10);

  for (const user of proUsers) {
    try {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existingUser) {
        console.log(`ℹ️ El usuario "${user.email}" ya existe. Actualizando suscripción a "${user.subscriptionStatus}" y fecha de creación...`);
        await db
          .update(users)
          .set({
            subscriptionStatus: user.subscriptionStatus,
            createdAt: user.createdAt,
          })
          .where(eq(users.email, user.email));
        console.log(`✅ Usuario actualizado: ${user.email}`);
      } else {
        console.log(`ℹ️ Creando nuevo usuario: "${user.email}" con suscripción "${user.subscriptionStatus}"...`);
        await db.insert(users).values({
          name: user.name,
          email: user.email,
          passwordHash: defaultPasswordHash,
          role: 'user',
          subscriptionStatus: user.subscriptionStatus,
          createdAt: user.createdAt,
        });
        console.log(`✅ Usuario creado: ${user.email}`);
      }
    } catch (err) {
      console.error(`❌ Error con el usuario ${user.email}:`, err);
    }
  }

  console.log('🎉 Finalizado el seeding de usuarios consolidado.');
  process.exit(0);
}

seedProUsers();
