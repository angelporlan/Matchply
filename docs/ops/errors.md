# Registro operativo de errores

`/admin/errors` permite buscar por `requestId`, `traceId` o digest de Next.js. Solo un administrador activo puede acceder, sin impersonación. Las consultas se filtran en el servidor, usan índices y páginas de 50 filas; la ventana consultable es de 30 días.

El índice `operational_error` guarda únicamente el evento, código público, ruta normalizada, origen, referencias y fecha. No guarda CVs, ofertas, cuentas, IPs, cookies, respuestas de proveedores ni excepciones. Los detalles técnicos y la pila de servidor permanecen en los logs JSON de los contenedores, con el mismo `requestId`. Un fallo de una operación de IA puede tener un `requestId` estable y un `traceId` HTTP diferente: se puede buscar cualquiera de ellos. Las excepciones de renderizado de Next.js se enlazan también por su digest.

El middleware valida el ID HTTP y lo devuelve en `x-request-id`; los IDs inválidos se sustituyen por un UUID. Nunca se usa este ID como autorización. El observador de navegador añade un ID a las peticiones de la API del producto, registra fallos de HTTP/red y excepciones no capturadas. Solo comunica códigos, paso, ruta normalizada y referencias; no envía mensajes ni pilas de navegador. Las respuestas originales siguen disponibles para sus consumidores. Las fronteras de error muestran una referencia para soporte.

Los eventos de navegador llegan a `/api/diagnostics/errors` (solo POST JSON del mismo origen, hasta 2 KiB y 5 segundos, 30 peticiones por IP en 10 minutos y 300 globales por minuto). El IP solo se usa para una clave hash del limitador en memoria. El servidor registra la recepción con el ID comunicado y el ID HTTP de la recepción. Los informes son diagnósticos aportados por un cliente: no prueban que haya ocurrido una operación ni sustituyen la autorización o la auditoría.

La escritura del índice no bloquea la acción. El buffer permite cuatro escrituras simultáneas, descarta el exceso y espera un minuto tras un fallo de almacenamiento. Los logs JSON se escriben siempre, aunque el índice esté desactivado o no disponible. El cliente deduplica referencias en memoria (128 marcas) y nunca vuelve a informar de un fallo del propio colector. Es un registro de diagnóstico con entrega de mejor esfuerzo, no un conteo de conversiones ni un sistema de alertas.

El índice está activo en producción. `ERROR_EVENTS_ENABLED=false` desactiva su persistencia; `true` permite ensayarlo en desarrollo. Durante el build permanece desactivado. El worker de IA borra por lotes de hasta 10.000 las filas con más de 30 días, una vez por hora. Los logs Docker siguen su propia rotación operativa; no se reconstruyen errores históricos ni se envían datos a un servicio externo.

Para investigar, busca la referencia en el panel y consulta los logs del contenedor correspondiente mediante `matchply-vps`. Los registros de origen `browser` pueden compartir la referencia del fallo original; el `traceId` corresponde al POST del informe. Para colas, comprueba también el job y sus intentos. El registro no ejecuta automáticamente trabajos, reintentos ni acciones sobre las cuentas.

Validación: pruebas de saneado y fallos de almacenamiento, integración PostgreSQL de correlación y retención, contrato HTTP de permisos y límites, y navegador con una respuesta fallida y un colector caído. Todas las pruebas usan datos sintéticos y bases aisladas.
