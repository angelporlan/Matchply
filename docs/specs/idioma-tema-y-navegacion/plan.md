# Plan para una navegación fluida

Fecha: 20/09/2026. Alcance: diagnóstico y plan, sin cambios de aplicación ni despliegue.

[Contrato propuesto](spec.md) · [Criterios de aceptación](expectations.md) · [Evidencia](evidence.md)

## Diagnóstico resumido

El efecto de «no responde» combina espera real y falta de confirmación inmediata del clic. La caché del router evita parte del trabajo al repetir una visita; en frío reaparecen consultas, transferencia de datos y descarga/ejecución de JavaScript.

En **local** hay una causa medida adicional: el contenedor ejecuta `next dev`. Se observaron 9,7 s de compilación en `/dashboard` y una petición de 11.038 ms. Al visitar Postulaciones se registraron 5 s de compilación y, separadamente, un GET de 174 ms. No se deben sumar ni comparar esas métricas como si ambas midieran clic→pantalla.

En **producción**, el usuario confirma que está desplegada la última build. Se retira la atribución a una versión antigua: los metadatos `legacy` del gateway no acreditaban el código ejecutado. La infraestructura respondía sin carga elevada en la muestra; falta una traza autenticada para cuantificar los costes del código actual. Los tiempos de compilación de desarrollo no explican la lentitud de producción.

El código **actual revisado** ya tiene skeletons y consultas resumidas/paralelas, pero conserva estas oportunidades. Sus costes estructurales están comprobados en código; su peso en los tiempos de producción sigue pendiente de medición:

| Problema | Consecuencia | Prioridad |
| --- | --- | --- |
| Sidebar sin estado pendiente al pulsar | El usuario no sabe si se recibió el clic antes de que llegue el fallback | P0 |
| Ajustes carga perfil, todos los CV completos y datos de integraciones para cualquier pestaña | Trabajo y payload ajenos a la pantalla elegida | P1 |
| `router.replace` en cambios de UI que ya ocurren localmente | Nueva solicitud RSC y repetición de lecturas | P1 |
| Postulaciones retorna skeleton global hasta `hasMounted` | Contenido oculto hasta montaje del cliente incluso cuando los datos están disponibles | P1 |
| Listados sin límite SQL y archivo incluido en Postulaciones | Coste creciente con todo el historial aunque se vean 25 filas | P2 |
| Miniaturas mediante PDF completo + PDF.js/canvas, sin cancelación real al salir | Trabajo que puede competir con la siguiente navegación | P2, medir impacto |
| Empresas une ofertas y notas antes de contarlas | Posible multiplicación de filas intermedias | P2, medir plan SQL |

## 0. Medir la navegación de la build actual

**REQ-NAV-06 / AC-NAV-01.** Partir de la última build, confirmada por el usuario, y medir su navegación autenticada. Registrar el identificador de build junto a los resultados para reproducibilidad, sin convertir la etiqueta `legacy` en diagnóstico ni plantear actualizar producción como solución.

Reproducir las rutas prioritarias con una build de producción en un entorno local separado (`npm run build` y `npm run start -- -p 3100`, con base de pruebas y configuración propia). No reutilizar ni sobrescribir la `.next` del contenedor de desarrollo en uso. Registrar versión, dataset, red y CPU.

Medir clic→feedback, clic→contenido útil, RSC TTFB/fin/bytes y descarga/ejecución JS. Correlacionar con el `requestId` existente y tiempos de contexto, espera del pool, consultas y render. Registrar duraciones y conteos, nunca contenido de CVs, cookies o credenciales. Usar logs estructurados; `Server-Timing` solo donde la API/framework permita emitirlo sin alterar el streaming.

Comparar visita no precargada, repetición, recarga completa y navegación tras guardar. Medir proceso frío por separado en pruebas; no reiniciar producción para obtenerlo. Una comprobación HTTP sin sesión solo mide red/login.

**Salida:** tabla de tiempos por ruta y versión que indique qué parte consume la espera.

## 1. Confirmar el clic y mantener la navegación utilizable

**REQ-NAV-01, REQ-NAV-03 / AC-NAV-02, AC-NAV-03, AC-NAV-09.** Añadir estado pendiente compartido a Sidebar y enlaces de UserMenu, compatible con Next 14. Mantener `Link`, Ctrl/Cmd+clic, teclado, abrir en pestaña nueva y navegación normal sin JS. No usar APIs exclusivas de versiones posteriores de Next.

Señalar el destino pendiente en el siguiente render, con texto/estado accesible. Mantener `aria-current` en la ruta confirmada y el sidebar operativo. Limpiar pendiente en éxito, error, redirección y al elegir otro destino. Reutilizar los `loading.tsx` existentes y ajustar sus límites; un progreso visual no debe fingir porcentajes. Si tarda más de 3 s, anunciar la espera sin bloquear; ante error, mantener navegación y ofrecer reintento. Si supera 15 s sin concluir, ofrecer salir o reintentar sin afirmar que el servidor ha cancelado su trabajo.

Revisar el gate de sesión en carga completa (`SessionChrome`/layout) sin mostrar datos protegidos antes de validar identidad. No atribuir ese gate a cada navegación entre layouts compartidos.

Archivos: `src/app/dashboard/Sidebar.tsx`, `src/components/account/UserMenu.tsx`, `src/components/skeletons/`, layouts y fronteras de error relevantes. Respetar `design.md`.

**Salida:** incluso con una respuesta deliberadamente lenta, el clic tiene respuesta y puede elegirse otra sección.

## 2. Evitar trabajo de navegación innecesario

**REQ-NAV-02 / AC-NAV-04, AC-NAV-05.** Para `layout` y cambios puramente visuales con datos cargados, sincronizar URL mediante History API integrada con el router. Conservar cookies/preferencias existentes y enlaces directos. Cuando filtros/vistas pasen a consultar datos en servidor, deberán solicitar únicamente el conjunto requerido; no aplicar la regla de «cero peticiones» a un cambio que necesita otros datos.

En Ajustes, separar el estado de pestaña de la carga de datos. Cargar cada panel a demanda una vez por sesión de pantalla y conservar su estado/borrador al alternar. Evitar tanto repetir toda la página como precargar incondicionalmente el contenido de todos los paneles.

Archivos: `SettingsTabs.tsx`, `ApplicationsClient.tsx` y sincronización de parámetros/cookies.

**Salida:** cambio local sin RSC redundante; pestaña no visitada con carga propia; atrás/adelante y URLs siguen funcionando.

## 3. Mostrar contenido útil sin esperar lo secundario

**REQ-NAV-03, REQ-NAV-04 / AC-NAV-05, AC-NAV-06.** Refactorizar `dashboard/profile/page.tsx`: frontera de carga antes de ejecutar las consultas de cada panel. Cuenta no necesita CVs ni cuota de investigación; Integraciones no necesita el perfil profesional. Perfil recibe metadatos y, si su inicialización lo requiere, un único CV base con desempate explícito; el importador recupera el CV seleccionado con comprobación de propiedad.

En Postulaciones, eliminar el bloqueo global `hasMounted` con render inicial determinista usando parámetros/cookies del servidor. Cabecera y tabla deben poder renderizarse desde servidor; DnD mantiene su carga solo cliente. No ocultar problemas de hidratación con otro bloqueo equivalente.

Archivos: `dashboard/profile/page.tsx`, `CareerProfileForm.tsx`, `CvImportProfileModal.tsx`, `ApplicationsClient.tsx`.

**Salida:** Cuenta no transmite Markdown de CVs; cabecera/tabla no esperan un efecto de montaje; cargar un panel no bloquea los otros.

## 4. Acotar datos y coste de consultas

**REQ-NAV-04 / AC-NAV-07 / DEC-NAV-02.** Llevar filtros, orden, conteos y paginación de tabla a SQL. Conservar opciones 10/25/50/100 y orden estable con desempate por ID. Cargar archivo cuando se solicite. Para tablero, cargar por estado con límites y continuación explícitos, conservando conteos globales. La casilla de cabecera y «Seleccionar las N» siguen cubriendo el conjunto filtrado; exportación, cambio de estado e IA no pueden quedar silenciosamente limitadas a la página visible.

Mantener `applicationSummaryColumns`/`cvListColumns`; proveedores auxiliares deben usar búsquedas o carga incremental si su tamaño crece. Medir Empresas con datos representativos; sustituir la doble unión por conteos previamente agrupados si el plan confirma coste. En Mis CVs, medir la búsqueda de última oferta por CV y excluir referencias nulas antes de decidir índices.

Archivos: páginas de Postulaciones/Empresas/Mis CVs, `job-offer-queries.ts`, `company-service.ts`, vistas y exportación. Índices solo tras `EXPLAIN (ANALYZE, BUFFERS)` acotado en pruebas. Si cambia esquema: `db:generate` y `db:migrate`, nunca `db:push` en producción.

**Salida:** el trabajo inicial depende de la página mostrada; filtros, conteos y acciones mantienen su semántica con 5.000 ofertas.

## 5. Reducir JavaScript, miniaturas y esperas evitables

**REQ-NAV-05 / AC-NAV-08.** Importar modales pesados al abrirlos, conservando el feedback del botón. Medir miniaturas: ya tienen visibilidad diferida y concurrencia 2. Añadir deduplicación en vuelo y cancelación/limpieza real al desmontar. Dar prioridad a navegación; si sigue siendo relevante, generar miniatura reutilizable por versión/hash en segundo plano con acceso privado y limpieza por usuario/actor.

Con los costes anteriores reducidos, verificar el prefetch automático de `Link` en producción y probar precarga por intención solo de las rutas frecuentes. Limitar concurrencia y respetar ahorro de datos; medir las lecturas DB adicionales. No precargar todas las fichas ni cachear globalmente contexto, roles o datos privados. Cualquier caché nueva debe tener claves por actor efectivo, parámetros y versión, e invalidación comprobada tras guardar/cerrar sesión/cambiar de actor.

**Salida:** menos bytes/trabajo inicial, sin solicitudes duplicadas de miniaturas y sin trasladar la carga a una avalancha de precargas.

## Verificación y entrega

Ejecutar pruebas de regresión de navegación y datos descritas en [expectations.md](expectations.md), `npm run typecheck`, `npm test` y `npm run build`. Ejecutar lint con la configuración existente, sin introducir un asistente/configuración nueva solo por esta tarea. QA con teclado, móvil y movimiento reducido.

Entregar cada fase en un cambio revisable: primero medición/feedback, después tabs/carga parcial, luego listados y recursos secundarios. Publicar evidencia antes/después del mismo dataset y build. Desplegar mediante el procedimiento del proyecto cuando se solicite; observar errores y p95. Revertir el cambio de aplicación si hay regresiones, conservando migraciones aditivas compatibles. La compilación de desarrollo seguirá siendo una métrica separada.
