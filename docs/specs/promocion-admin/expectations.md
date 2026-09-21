# Expectativas verificables

- El paquete enviado a la ruta no supera 16 KiB.
- Sin token válido, la ruta devuelve `404` y no consulta la base.
- Un payload inválido devuelve `400`.
- La promoción devuelve `200`, `changed: true` y `toRole: "admin"` cuando cambia el rol.
- Una segunda llamada devuelve `200`, `changed: false` y mantiene `admin`.
- La auditoría contiene la acción `internal_user_role_promotion` sin secretos.
- Tras la operación, `MATCHPLY_USER_ROLE_PROMOTION_TOKEN` no figura en producción y la aplicación sigue sana.
