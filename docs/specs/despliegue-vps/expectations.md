# Criterios de aceptación

| ID | Comprobación | Evidencia |
|---|---|---|
| AC-001 | Testing no despliega; main requiere checks | Condiciones de los workflows y ensayo manual sobre testing |
| AC-002 | Solo se admiten los dos repositorios de imágenes de Matchply por digest | ops_test.py |
| AC-003 | Fallo de backup o migración destructiva no activa contenedores | ops_test.py |
| AC-004 | Fallo de salud recupera versión anterior y no avanza current | ops_test.py |
| AC-005 | Cambios de entorno conservan otras claves y no interpretan dólares/inyección | ops_test.py y Compose config |
| AC-006 | Skill ignorada por Git/Docker y acceso nominal SSH operativo | quick_validate.py, git check-ignore, status/env-list |
| AC-007 | Backup restaurable y migraciones probadas sobre copia aislada | Ensayo dentro del VPS, sin exportar datos reales |
| AC-008 | Aplicación compila y pruebas con PostgreSQL pasan | CI, npm test, typecheck, imágenes Docker |
| AC-009 | Claves CI no permiten shell ni operaciones del operador | Prueba negativa del gateway |

La salud HTTP prueba web y PostgreSQL. Estado de procesos, reinicios y conteos de cola aportan diagnóstico, pero no demuestran calidad de IA ni éxito de servicios externos.
