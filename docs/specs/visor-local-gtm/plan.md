# Plan de implementación — visor local GTM

1. Crear tipos compartidos y el lector seguro del workspace, incluyendo la
   separación de documentos canónicos, runs, manifiestos inválidos y estados
   obsoletos.
2. Crear el runner CLI `scripts/gtm-run.ts` y el script npm `gtm:run` para
   iniciar/finalizar ejecuciones con escritura atómica del manifiesto.
3. Crear la protección localhost/admin, la página `/gtm` y las rutas internas
   de contenido y búsqueda sin caché.
4. Crear el panel cliente con filtros, agrupación temporal y preview seguro de
   Markdown, JSON y texto.
5. Añadir el enlace condicional a la navegación admin, documentar el contrato
   local de bots y habilitar el flag solo en el `.env` de desarrollo.
6. Ejecutar tests unitarios, typecheck, suite existente, build y comprobación
   de que los outputs siguen ignorados por Git.
