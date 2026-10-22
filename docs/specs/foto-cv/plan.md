# Plan

1. Añadir `cv.showPhoto` falso y tabla de sustituciones por CV; generar migración y aplicarla a local y BD de pruebas aislada (REQ-01/04).
2. Resolver foto propia o de cuenta, implementar lectura/subida/activación/restauración privadas con validación y controles de edición (REQ-02, INV-01).
3. Añadir control en barra y sustitución sobre foto, guardar estado y refrescar cortes PDF (REQ-01/02/04).
4. Compartir medidas de retrato y cabecera; generar PDF y hoja con la misma distribución; incluir hash de imagen en caché (REQ-03/04).
5. Verificar integración, caché, PDF, tipos y lint; renderizar PNGs y comprobar editor. Reversión: desactivar el control o revertir código conservando datos; no eliminar las fotos para revertir una presentación.
