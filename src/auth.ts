import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/audit";


export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const emailStr = credentials.email as string;
        const passwordStr = credentials.password as string;

        const [user] = await db.select().from(users).where(eq(users.email, emailStr)).limit(1);
        if (!user || !user.passwordHash) return null;
        
        const isValid = await bcrypt.compare(passwordStr, user.passwordHash);
        if (!isValid) return null;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        try {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (!existingUser) {
            const [newUser] = (await db
              .insert(users)
              .values({
                name: user.name || "Usuario de Google",
                email: user.email,
                image: user.image || null,
                role: "user",
                subscriptionStatus: "none",
              })
              .returning()) as any[];
            user.id = newUser.id;
            (user as any).role = newUser.role;

            // Log de auditoría para registro por Google OAuth
            await createAuditLog("user_register", newUser.id, newUser.email, {
              name: newUser.name,
              method: "google_oauth"
            });
          } else {
            user.id = existingUser.id;
            (user as any).role = existingUser.role;
          }
        } catch (error) {
          console.error("Error linking Google OAuth user:", error);
          return false;
        }
      }

      // Log de auditoría para todo inicio de sesión exitoso (Credentials y OAuth)
      if (user && user.id && user.email) {
        await createAuditLog("user_login", user.id, user.email, {
          provider: account?.provider || "credentials"
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    }
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    signOut: "/logout",
  }
});
