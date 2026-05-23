import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Error: Por favor, proporciona un correo electrónico.');
    console.log('Uso: npx tsx scripts/make-admin.ts <correo_del_usuario>');
    process.exit(1);
  }

  console.log(`⏳ Buscando y actualizando el usuario con correo: "${email}"...`);

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      console.error(`❌ Error: No se encontró ningún usuario con el correo: "${email}"`);
      process.exit(1);
    }

    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email));

    console.log(`✅ ¡Éxito! El usuario "${user.name || 'Sin nombre'}" (${email}) ahora es ADMINISTRADOR.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar el usuario en la base de datos:', error);
    process.exit(1);
  }
}

makeAdmin();
