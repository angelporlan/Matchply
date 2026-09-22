# Expectativas de fluidez

Estado: propuesta del 20/09/2026; pruebas de la futura implementación, todavía no ejecutadas.

## Entorno de medición

Build de producción identificada, base de pruebas con 10/500/5.000 ofertas y 1/20/100 CVs, datos sintéticos. Probar escritorio con 20 ms de latencia y 50 Mbps; móvil emulado con 150 ms, 10 Mbps y CPU ×4. Registrar máquina/navegador y limitar concurrencia inicial a un usuario; medir carga multiusuario por separado según uso real.

Usar al menos 30 muestras por ruta/condición para una primera comparación de mediana/p95 (muestra orientativa, no SLO de producción). Separar Router Cache vacía con assets disponibles, navegador sin assets, navegación repetida y proceso frío. Desactivar caché HTTP en DevTools por sí solo no vacía Router Cache; verificar las solicitudes reales y usar un contexto/página nueva controlando la precarga.

Contenido útil significa primera página de tabla/CVs legible con controles operativos, o campos del panel elegido disponibles. Las miniaturas no forman parte del hito, pero deben terminar o fallar de forma visible sin bloquearlo.

| ID | Requisito | Comprobación y resultado esperado |
| --- | --- | --- |
| AC-NAV-01 | REQ-NAV-06 | Informe antes/después con versión, condiciones, clic→feedback/contenido, RSC bytes/tiempos, JS y SQL. No confundir login público, desarrollo y producción autenticada. |
| AC-NAV-02 | REQ-NAV-01, NFR-NAV-01 | Con respuesta retrasada 2 s en pruebas, primer feedback p95 ≤100 ms. Sidebar sigue aceptando otro destino; al pulsar A→B rápidamente termina en B, sin indicador pendiente atascado. |
| AC-NAV-03 | REQ-NAV-03, NFR-NAV-01 | Objetivo clic→contenido útil p95 ≤1 s escritorio y ≤2 s móvil; informar incumplimiento por ruta sin promediarlo con rutas rápidas. Medir activos/archivo y cada pestaña. |
| AC-NAV-04 | REQ-NAV-02, INV-NAV-02 | Alternar tabla/tablero con los mismos datos o revisitar pestaña cargada actualiza UI p95 ≤100 ms y no solicita de nuevo toda la página RSC. Un cambio de filtro que necesita datos sí puede pedirlos de forma acotada. |
| AC-NAV-05 | REQ-NAV-02, REQ-NAV-03, REQ-NAV-04, INV-NAV-02 | Entrada directa en Cuenta no carga CVs/cuota. Perfil carga como máximo el CV necesario; importar otro recupera solo el seleccionado. Editar un borrador, cambiar de pestaña y volver conserva cambios. URL directa/recarga/atrás/adelante conservan selección. |
| AC-NAV-06 | REQ-NAV-03 | HTML inicial de Postulaciones contiene cabecera y primeras filas, sin gate global por `hasMounted`; hidrata sin discrepancias. El tablero DnD sigue funcionando. |
| AC-NAV-07 | REQ-NAV-04, INV-NAV-02, DEC-NAV-02 | Con 5.000 ofertas, respuesta de tabla limitada a tamaño de página (máximo 100) más metadatos/conteos; no entrega todo el archivo. Búsqueda, orden estable, conteos y filtros coinciden con fixtures. La casilla de cabecera y «Seleccionar las N» cubren el conjunto filtrado; exportación, cambio de estado e IA usan esa selección, no solo la página, e informan el tope de 1.000 IDs de exportación si se supera. RSC de listados sin `rawReport`, cartas ni Markdown de todos los CVs. |
| AC-NAV-08 | REQ-NAV-05 | Modales cerrados no descargan sus módulos pesados. Miniatura repetida comparte tarea; salir cancela tareas obsoletas y libera recursos; al volver muestra la versión vigente. Comparar bytes y trabajo CPU con línea base. |
| AC-NAV-09 | REQ-NAV-01, INV-NAV-01, INV-NAV-03 | Fallo/offline/redirección retira pendiente o muestra recuperación; espera >3 s se anuncia, >15 s ofrece salida/reintento. Conserva foco, teclado, abrir nueva pestaña y reduced-motion. Probar logout, suspensión, Gratis/Pro y soporte sin datos cruzados. |
| AC-NAV-10 | INV-NAV-01, INV-NAV-02, INV-NAV-03 | Dos usuarios y cambios de actor no comparten resultados. Tras crear/editar/archivar/eliminar, volver muestra estado confirmado, incluyendo con prefetch/caché activos. Cada nuevo lector bajo demanda valida propietario/permisos. |

Verificadores: pruebas navegador para AC-02/03/04/05/06/08/09; integración de lecturas/mutaciones con Postgres aislado para AC-05/07/10; revisión de payloads y trazas para AC-01/07/08. No introducir tests que solo reflejen nombres de componentes. Añadir harness navegador únicamente al implementar, ya que el proyecto no tiene uno específico para esta navegación.
