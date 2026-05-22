"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function registerUser(prevState: any, formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!name || !email || !password) {
      return { error: "Todos los campos son obligatorios" };
    }

    if (password.length < 6) {
      return { error: "La contraseña debe tener al menos 6 caracteres" };
    }

    // Comprobar si el email ya existe
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return { error: "El correo electrónico ya está registrado" };
    }

    // Hashing de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar usuario
    await db.insert(users).values({
      name,
      email,
      passwordHash,
      subscriptionStatus: "none"
    });

    return { success: true };
  } catch (error: any) {
    console.error("Registration error:", error);
    return { error: error.message || "Error al procesar el registro" };
  }
}
