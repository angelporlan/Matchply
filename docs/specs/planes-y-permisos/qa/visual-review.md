# Revisión visual de planes

4 de octubre de 2026. Servidor local 3010 contra `matchply_plans_core_test_20261004`, con una cuenta y CVs sintéticos. No se modificaron cuentas reales ni facturación durante esta revisión.

- Español claro: dashboard con 8/10 acciones IA, aviso al 80 %, matching 10/10 agotado, 5 documentos conservados y selección de 1 base + 2 versiones editables.
- Admin: pestañas Límites, Paywall y Resultados; controles con unidades, referencias de IA, vista previa dinámica y historial. `Right` mueve el foco y activa Paywall; `End` activa Resultados.
- Español oscuro e inglés oscuro: formularios y resultados legibles; la navegación y cabecera administrativas están traducidas.
- Móvil 390 × 844: los controles de planes y cuotas se reorganizan, tablas con desplazamiento horizontal contenido y diálogos accesibles. Inglés claro y oscuro comprobados.
- Selector de CVs activos: foco inicial dentro del diálogo, exceso de selección deshabilitado; `Escape` cierra y devuelve el foco al botón que lo abrió.
- CV excedente: descarga PDF accesible y controles de edición ausentes. El upsell no cubre el resultado y se puede cerrar; su cierre se conserva al recargar.
- Demo invitada en inglés móvil: PDF con rol botón y soporte de teclado, pegar texto, avanzar al paso opcional de oferta y continuar sin oferta. No se ejecutaron llamadas IA.
- Las modalidades sin un Price válido quedan deshabilitadas. La prueba no se anuncia cuando el catálogo no la ofrece.

La programación real mensual/anual se verificó en Stripe sandbox por los tests de facturación; esos fixtures se eliminaron al acabar. La revisión visual no creó ni modificó suscripciones.

Capturas: `dashboard-es-light.jpg`, `admin-limits-es-light.jpg`, `admin-paywall-es-dark.jpg`, `admin-results-en-dark.jpg`, `admin-limits-en-dark-mobile.jpg`, `subscription-en-light-mobile.jpg`, `active-cvs-en-light-mobile.jpg` `readonly-upsell-en-light-mobile.jpg`, `try-en-light-mobile.jpg` y `try-step2-en-light-mobile.jpg`.

El servidor QA quedó detenido y se eliminaron la cuenta administrativa y el invitado sintético al terminar.

## Recuperación de operaciones liberadas

Los clientes mantienen el identificador tras una pérdida de respuesta, un stream incompleto o una operación todavía en curso, porque el resultado puede haberse guardado. Si una respuesta JSON confirma `OPERATION_RELEASED`, borran únicamente ese identificador; el siguiente clic del usuario inicia otra operación. La petición no se reejecuta automáticamente. Esto cubre CVs, FormData, perfil, Personas, cartas, investigación, importación de ofertas y lotes. El lote conserva su recuperación al mostrar avisos de rate limit o de trabajo en curso.

`node --import tsx --test scripts/ai-operation-retry.test.ts`: 2 pruebas pasan. `npm run typecheck`: pasa tras integrar los manejadores.
