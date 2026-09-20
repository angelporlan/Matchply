# Evidencia de implementación

- La restauración completa pasó dentro de un PostgreSQL aislado en el VPS.
- El ensayo detectó un hash histórico truncado y una FK ausente. Después de corregir ambos únicamente en la copia, las migraciones completas pasaron.
- La transición pendiente incluye eliminación de campos legacy con datos. No se ha aplicado al PostgreSQL real ni se ha habilitado el despliegue.
- Pruebas locales con PostgreSQL: 179 pasadas, cero fallos y cero omitidas. TypeScript pasó.
- Pruebas del operador: ocho pasadas, incluyendo backup fallido, migración destructiva, rollback y validación de imágenes/entorno.
- Skill validada con quick_validate.py; .agents ignorada y sin archivos seguidos por Git. Consultas status/env-list probadas por SSH restringido.
- Claves de CI y operaciones separadas. Secretos de production configurados en GitHub. Main protegido con el check checks, sin force push ni borrado.
- No se ha cambiado la contraseña root: el intento de añadir recuperación root sin restricciones fue rechazado por revisión automática. Se conservaron los accesos restringidos.

Los registros y las copias con datos reales permanecen solo en el VPS. El estado final de Actions se añadirá tras completar el ensayo de imágenes.
