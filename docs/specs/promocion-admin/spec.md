# Promoción controlada a administrador

Estado: **Implementado, pendiente de ejecutar en producción**

## Resultado

Promover exactamente `angelporlandev@gmail.com` al rol `admin` en producción sin modificar credenciales, facturación, estado de cuenta ni datos de trabajo.

## Canal

- `POST /api/internal/user-role-promotion` protegido por `MATCHPLY_USER_ROLE_PROMOTION_TOKEN` y comparación en tiempo constante.
- El cuerpo exige email, `role: "admin"` y un motivo de al menos ocho caracteres.
- La operación bloquea la cuenta, exige que exista, no sea invitado y esté activa, y registra una auditoría crítica dentro de la misma transacción.
- El token solo se activa durante la operación y se elimina inmediatamente después.

## Invariantes

- Solo se admite promoción a `admin`; no existe downgrade en este canal.
- No se copian ni cambian contraseña, sesiones, Stripe, tokens, estado de suspensión o permisos distintos del rol.
- Una cuenta inexistente, invitada o suspendida no se modifica.
- Una cuenta que ya es admin responde de forma idempotente.
