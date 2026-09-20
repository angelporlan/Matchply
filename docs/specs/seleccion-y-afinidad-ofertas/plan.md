# Implementación

1. Contratos y migración aditiva; preferencias versionadas (REQ-02,08).
2. Fuentes completas, presupuestos por sección, requisitos con procedencia (REQ-04,05).
3. Validación, límites deterministas y explicación separada (REQ-01,03,06).
4. Persistencia condicional y protección de generaciones (REQ-08).
5. Productor/worker, progreso compacto y recuperación (REQ-07).
6. Integración UI y regresión. Validar migración en base local aislada.

Operación: registrar versión, límites, fallos, caché, duración y tokens disponibles; nunca CVs ni descripciones. Migrar antes de arrancar web/worker nuevos. No se despliega producción como parte de la implementación local. Rollback conserva columnas aditivas y evidencias; no borrar resultados para revertir código.
