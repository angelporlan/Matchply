# Evidencia de planes, cuotas y conversión

Verificación final: **4 de octubre de 2026**, en el checkout local de Matchply. Producción no modificada.

## Resultado

| Comprobación | Resultado |
| --- | --- |
| `npm test` con todas las URLs de integración habilitadas | **419 correctas, 0 fallos, 0 omisiones** |
| `npm run typecheck` | Correcto |
| `npm run lint` | Sin errores; 8 advertencias existentes de hooks e imágenes |
| `npm run build`, `NODE_ENV=production` | Correcto; 37 páginas estáticas y rutas privadas dinámicas |
| `git diff --check` | Correcto |
| `npm run db:generate` tras finalizar el esquema | Sin cambios pendientes |
| Migraciones 0033–0036 | Aplicadas a local y dos bases aisladas |
| Salud local después de actualizar web y workers | `GET /api/health` → 200, `{"ok":true}` |
| Checkout antiguo por GET | 307 a planes; no crea una sesión |

La suite ejecutó las integraciones en `matchply_plans_test_20261004` y `matchply_plans_core_test_20261004`, ambas en PostgreSQL local. La configuración mutable se prueba separada de las colas. Las URLs y credenciales no se guardan en este documento. Las fixtures se eliminan al terminar.

## Expectativas comprobadas

- Última unidad de IA y último espacio de CV: admisión concurrente con un único ganador.
- Idempotencia, cuerpos incompatibles, pérdida de respuesta, publicación recuperable y liberación tras fallo definitivo. Los clientes mantienen el ID ante una respuesta ambigua y lo descartan solo al recibir `OPERATION_RELEASED`.
- Lotes de 50/51, saldo insuficiente, resultados parciales y publicación del intento vigente; trabajos antiguos autorizados sin doble cargo.
- Cambio de mes, plan y configuración con reservas activas: la autorización y el periodo originales se conservan.
- Downgrade, elección de CVs activos, conservación de excedentes, rechazo de escrituras y sustitución confirmada. Borrar el base permite recuperar ese espacio sin borrar versiones adaptadas.
- Demo: creación atómica del base con texto, una descarga PDF concurrente, liberación al fallar y registro conservando consumo, resultados, reservas y asignación A/B.
- Registro mientras se publica o libera una operación, incluido intercalado real de locks y un segundo registro con una cookie capturada previamente.
- Capacidad de claves API, hash y secreto mostrado una vez; rate limit agregado por cuenta y persistente.
- Permisos admin, impersonación rechazada, publicación optimista, historial/restauración y consumo conservado al cambiar límites.
- Primera adaptación, habilitación del upsell y evento de valor guardados en la misma transacción; un rollback no habilita el upsell.
- Prueba, pago, cancelación, renovación anual, segunda prueba rechazada, sesión ajena, webhooks firmados duplicados/desordenados y primer pago positivo único. [Evidencia Stripe](../facturacion-stripe/evidence.md).

## Interfaz y operación local

[Revisión visual](qa/visual-review.md): español e inglés, temas claro/oscuro, móvil, pestañas por teclado, foco/Escape, avisos al 80 % y al agotarse, selector de CVs, excedentes descargables y upsell descartable. Diez capturas acompañan la revisión.

Web, worker de IA y worker de investigación se recrearon conservando los volúmenes. Usan **Node 22.23.2 y Stripe 23.0.0**; ambos workers registraron su arranque. PostgreSQL no se recreó. Para la imagen local se utilizó Node 22 Alpine ya disponible; los Dockerfiles del repositorio conservan Node 20, compatible con el SDK, y sus builds instalan el lockfile actualizado.

## Activación pendiente

La oferta anual se verificó y activó únicamente en Stripe test local. La prueba está implementada y permanece desactivada por `STRIPE_TRIAL_REMINDERS_VERIFIED=false` hasta verificar los recordatorios de fin de prueba en el Dashboard del entorno. Stripe no envía esos correos en sandbox y esa preferencia no se confirma mediante su API pública. [Procedimiento y condiciones de activación](../../monetization-billing.md).

Las migraciones y el código están preparados para despliegue; no se desplegó ni se modificó la facturación de producción.
