import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { headers } from 'next/headers';

/**
 * Registra una acción de auditoría en la base de datos de manera segura y no bloqueante.
 * Captura automáticamente la IP y el User Agent del contexto HTTP si están disponibles.
 *
 * @param action Nombre identificador de la acción (ej: 'user_register', 'user_login', 'cv_create_manual')
 * @param userId ID del usuario asociado (puede ser null)
 * @param userEmail Email del usuario asociado (puede ser null)
 * @param details Objeto con información detallada adicional para contextualizar la acción
 */
export async function createAuditLog(
  action: string,
  userId: string | null,
  userEmail: string | null,
  details: Record<string, any> = {}
) {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    // Intentar capturar cabeceras HTTP de Next.js de manera segura
    try {
      const headerList = headers();
      userAgent = headerList.get('user-agent');
      const forwardedFor = headerList.get('x-forwarded-for');
      if (forwardedFor) {
        ipAddress = forwardedFor.split(',')[0].trim();
      } else {
        ipAddress = headerList.get('x-real-ip');
      }
    } catch {
      // Captura fallida por ejecutarse fuera de una solicitud HTTP activa (ej. scripts o webhooks)
    }

    // Inserción asíncrona sin bloquear el flujo principal
    await db.insert(auditLogs).values({
      userId,
      userEmail,
      action,
      details: JSON.stringify(details),
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
  } catch (error) {
    // Evitar que un error en la auditoría interrumpa la lógica principal de la app
    console.error('Error al guardar log de auditoría:', error);
  }
}
