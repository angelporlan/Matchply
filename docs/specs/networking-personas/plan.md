# Plan y entrega

1. Modelo/índices/FKs y permisos: `schema.ts`, migración 0029 y `subscription.ts`.
2. CRM: servicios privados, Server Actions, navegación/listado/ficha, enlaces desde empresas/ofertas.
3. Conversaciones: original/hash, fragmentos literales, revisión de solapamientos y confirmación serializada.
4. Asistente: modelo por función, Responses JSON, endpoint 202, cola worker y polling, contexto/hash y confirmación de seguimiento.
5. Extensión: extracción visible opcional, payload compatible, endpoint adicional, estado por instalación y firmas, auto/manual.
6. Verificación: unidad/integración aislada, base vacía y dev, navegador; test/typecheck/lint/build. Preservar importación de ofertas existente.

## Migración y despliegue

- `npm run db:generate` generó 0029; se revisó para excluir cambios antiguos sin snapshot y ordenar índices únicos antes de FKs. Snapshot completo conserva baseline para futuras generaciones. 0029 es aditiva, sin DROP/ALTER destructivo.
- Probar cadena completa en base aislada y aplicar con `DATABASE_URL=<base de desarrollo> npm run db:migrate`. Nunca db:push en producción.
- Desplegar servidor y worker con código/migración antes de distribuir extensión 2.1.0. Extensión anterior funciona sin `people`. Captura opcional apagada, habilitación controlada por usuario.
- Despliegue de producción vía workflow de main y gateway restringido de operaciones. No integrar ramas ajenas ni hacer merge sin autorización. No distribuir aún un paquete de extensión: `API_BASE` actual sigue siendo el entorno local del repositorio; el paquete de producción debe apuntar a `https://matchply.com`.
- Recuperación: volver a imagen anterior conserva tablas aditivas. Desactivar Capturar personas o networking en configuración si se necesita contener uso. No borrar tablas/contactos para rollback. Backups en flujo operativo existente.

## Operación

Worker habilitado (`AI_WORKER_ENABLED=true`), credencial `OPENAI_API_KEY` en servidor/worker y modelo OpenAI de networking. Límite web 6/min y timeout proveedor 60s por fragmento; heartbeat 30s y lease 5min. Métricas `networking`, códigos sin texto privado. Registrar evidencias reales en `evidence.md`.
