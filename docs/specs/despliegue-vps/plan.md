# Implementación

1. Preservar código modificado, configuración, imagen y PostgreSQL; restaurar el dump en un contenedor aislado sin puertos públicos.
2. Añadir CI reutilizable, imágenes GHCR privadas, producción limitada a main y protección de rama.
3. Instalar el operador root-owned y usuarios SSH sin grupo docker; otorgar únicamente sus gateways nominales mediante sudo.
4. Registrar versión legacy sin recrear servicios. Configurar secretos del entorno production de GitHub, conservando los del workflow antiguo hasta sustituirlo.
5. Crear y verificar la skill privada en .agents, con helpers que no contienen secretos.
6. Ensayar migraciones y build. Resolver primero la transición histórica; no habilitar producción ni hacer merge solo para superar ese bloqueo.
7. Tras la transición inicial autorizada y verificada, habilitar el operador. Los siguientes merges compatibles desplegarán automáticamente.

Operador: scripts/deploy/install.sh con dos claves públicas; /opt/matchply-ops contiene el código revisado. Los cambios del propio operador se reinstalan de forma controlada; los releases de la aplicación no pueden reemplazarlo.

Retención: cinco releases correctas, current/previous siempre protegidas, catorce copias de despliegue. Las copias bootstrap no se purgan. Solo se eliminan imágenes exactas de Matchply sin referencias retenidas; nunca se usa limpieza global.
