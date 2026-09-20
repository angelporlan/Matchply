# Sincronización de datos de usuario local → producción

Estado: **Listo para implementar — solicitud explícita del usuario**  
Fecha: 2026-09-20

## Problema y resultado

Cuando el usuario pida sincronizar su usuario, sus datos de trabajo de la base local deben quedar disponibles en la cuenta equivalente de Matchply en producción. La operación debe ser repetible y no debe requerir copiar contraseñas, tokens ni una base completa.

## Alcance

Se sincronizan por email exacto el perfil no sensible, CV, empresas relacionadas, iconos, membresías, notas, ofertas, vistas y resultados terminados de investigación. El modo por defecto es `merge`: los datos de producción que ya existan se conservan y los registros del paquete se insertan o actualizan de forma idempotente.

Quedan fuera las credenciales, Stripe, roles y suspensión, actividad de login, códigos o instalaciones de extensión, sesiones de soporte, auditoría histórica, configuración global, cuotas y trabajos IA pendientes.

## Contrato de importación

- La petición es `POST /api/internal/user-data-import` con JSON versionado y el encabezado temporal `x-matchply-import-token`.
- El token solo existe durante una importación, se compara en tiempo constante y se elimina al terminar.
- El cuerpo está limitado a 8 MiB. El paquete incluye un hash y recuentos; el servidor valida referencias, propiedad y estados antes de abrir la transacción.
- La cuenta destino se resuelve por email. Si el UUID local colisiona con otra cuenta o una referencia no se puede mapear, la transacción falla completa.
- La importación escribe un único evento de auditoría con email, hash y recuentos, sin contenido personal ni secretos.

## Decisiones e invariantes

- **DEC-001:** merge idempotente es el comportamiento por defecto; no se borran datos de producción.
- **DEC-002:** el gateway de producción sigue siendo el canal operativo; el endpoint se habilita solo con una variable efímera y no queda accesible sin token.
- **INV-001:** ninguna importación puede modificar `passwordHash`, Stripe, rol, estado de cuenta, tokens, sesiones, auditoría histórica, configuración global o trabajos pendientes.
- **INV-002:** una importación devuelve éxito solo después de confirmar la transacción completa.
- **INV-003:** dos importaciones concurrentes de la misma cuenta se serializan.
- **INV-004:** un paquete inválido o una referencia conflictiva deja la producción sin cambios.

