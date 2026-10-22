# Planes y permisos — implementación local

Revisión inicial: 4 de octubre de 2026. Cuotas actualizadas el 12 de octubre de 2026. Sustituye el inventario estático del 12 de septiembre. Producción no inspeccionada ni modificada.

## Cuotas actuales

«Candidaturas por IA» sustituye la bolsa de investigaciones: 10 candidaturas nuevas al mes en Gratis y 100 en Pro. Solo se cuentan las que se añaden, con scoring inicial incluido; duplicados, descartes y búsquedas vacías no descuentan. Cada investigación profunda útil consume una acción de IA general y está disponible en cuentas Gratis y Pro. La migración 0040 conserva el historial, el consumo anterior y las reservas ya admitidas.

Desde el 22 de octubre de 2026, las cuentas registradas con rol `admin` pueden superar las tres bolsas. Conservan el plan y los contadores reales (por ejemplo, «495 de 300»), con la indicación «Uso ilimitado por ser administrador». El servidor consulta el rol del propietario efectivo, también al admitir trabajos; quitar el rol restablece las comprobaciones sobre el consumo acumulado. Se conservan reservas, idempotencia y límites técnicos. Cambio local sin migración. [Verificación de la ampliación](evidence.md#uso-ilimitado-del-administrador--22-de-octubre-de-2026).

## Implementación

- `src/lib/plan-config.ts` valida valores, predeterminados y placeholders. `plan-store.ts` lee singleton persistido; no concede permisos por un fallback cuando falla la BD.
- `/admin/plans` requiere admin real. `plan-admin.ts` publica con bloqueo/versionado optimista, historial y auditoría. El formulario conserva borrador tras conflicto y carga versiones históricas sin publicarlas automáticamente.
- `usage.ts` reserva, consume y libera unidades por cuenta, bolsa y periodo. Los productores y workers reutilizan operaciones y comprueban configuración antes de aceptar trabajo.
- `cv-access.ts` conserva documentos excedentes como lectura y permite elegir CVs activos. Nueva adaptación/importación no crea placeholder desde el cliente: la API reserva destino y devuelve CV confirmado en el stream.
- `/api/usage` alimenta `PlanUsageProvider`, `UsagePanel`, `PlanFeedback` y selección de activos. Perfil, cuenta, editor e integraciones muestran límites dinámicos; errores de las acciones costosas abren feedback de cuotas.
- `UpgradePaywall` carga variante después de `firstValueAt`; copy y precios se renderizan con límites Pro/catálogo. El primer resultado y la habilitación del upsell se guardan atómicamente; su cierre se conserva. El panel agrega conversiones sin contenido personal.
- `/dashboard/subscription` consume catálogo mensual/anual y crea Checkout por POST; confirma retorno con estado real de Stripe. API keys muestra secreto solo al crear y contador de claves activas con límite publicado.
- ES/EN, tokens semánticos y botones siguen `design.md`. Diálogos nuevos usan modal nativo con foco contenido, Escape, fondo inerte y restauración de foco.

## Verificación

- `npm run lint`: sin errores. Advertencias previas en componentes de editor y `<img>`; revisión de la dependencia de polling de investigación pendiente de refinamiento.
- `npm test`: 419 pruebas correctas, sin fallos ni omisiones, con todas las integraciones Postgres habilitadas. Typecheck y build de producción correctos.
- QA visual y teclado: ES/EN, ambos temas, móvil, avisos, foco y documentos excedentes comprobados. Diez capturas y recorrido en [revisión visual](qa/visual-review.md).
- Migraciones 0033–0036 aplicadas a local y ambas bases aisladas. Web y workers locales actualizados; salud 200. [Evidencia completa](evidence.md).
- La prueba de siete días permanece desactivada hasta verificar los recordatorios de Stripe en el entorno. Producción no desplegada.

Las cuotas comerciales conviven con límites técnicos de frecuencia, tamaño, timeout y concurrencia. La interfaz distingue fallos de plan de un rate limit temporal o una operación ya en curso; solo los primeros abren paywall.

[Especificación y aceptación](spec.md) · [Facturación](../../monetization-billing.md)
