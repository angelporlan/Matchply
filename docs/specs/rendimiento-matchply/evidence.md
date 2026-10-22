# Evidencia de rendimiento

Fecha: 22/10/2026. Rama: `codex-rendimiento-matchply`. Referencia: `d0dfcc2`; código candidato: `c0eef47`. Sin migraciones nuevas ni despliegue.

## Cambios y resultados verificables

| Cambio | Evidencia |
| --- | --- |
| Miniaturas con promesa estable | Regresión con tres tareas, duplicados, aborto parcial/total, reemplazo de tarea y reintento; concurrencia máxima dos. |
| PDF concurrente compartido | Diez peticiones iguales llaman una vez al renderizador; error elimina la tarea compartida; timeout incluye cola y evita iniciar trabajos vencidos. |
| Editor y solicitudes | No se calcula LCS oculto; previews obsoletas abortadas, polling serial, consumo deduplicado con recarga tras invalidación y modal debug diferido. |
| Consumo | Ocho lecturas → cinco por snapshot completo después de autenticar, con igualdad funcional en invitado, Gratis, Pro y administrador. |
| IA | Checkpoints con proyecciones mínimas y lecturas dentro de su transacción. Toda la suite de optimización concluye con una conexión. |
| Observabilidad | Adquisición del pool medida en APIs callback/promesa sin bloquear si falla la telemetría; tiempos de cola PDF y renders compartidos en logs. |

## Verificación automática

| Verificador | Resultado |
| --- | --- |
| Typecheck y build standalone, Node20.20.2 / Next14.2.35 | Pasan en snapshot aislado; hash de fuentes y build IDs en [builds.json](qa/builds.json). |
| Lint | Pasa; cuatro warnings preexistentes en EditorCvMenu, ResumeSheet y useCvGenerationAnimation. Los dos avisos de los componentes corregidos desaparecen. |
| Suite Node20 | 438 pasan, cero fallos; 23 integraciones se omiten en el perfil por defecto y se ejecutan en los perfiles explícitos siguientes. |
| Integraciones PostgreSQL15 | 141 pasan, cero fallos y cero omisiones. Incluye snapshots, planes, cuotas, CRM, jobs, adquisición del pool y privacidad. |
| Optimización con pool=1 | 12 pasan, cero omisiones: preview, reintentos, leases caducados, claim invitado, variantes y cuota única. |
| Migración histórica en base independiente | Una pasa, cero omisiones; no se añadió ninguna migración. |
| Operador de despliegue | Nueve pasan. |
| Contratos HTTP | Tres pasan, cero fallos y omisiones: fotos de cuenta/CV, PDF y blog. |
| Regresión Chromium final | Ocho pasan, incluyendo ≥3 miniaturas reales, datos ligeros, aislamiento, ES/EN, tema oscuro/móvil, guardado y documentos de 1/3/10 páginas. |

Resumen verificable: [checks.json](qa/checks.json). Las fases del workflow se comprobaron localmente; el workflow remoto de GitHub no se ha ejecutado en esta rama sin publicar.

El primer intento de suite en `node:20-bookworm-slim` carecía de `zip`/`unzip`; se añadieron exclusivamente al contenedor de pruebas y la suite completa pasó. No se modificó producción para resolverlo.

Al activar integraciones apareció una suposición anterior de la prueba de auditoría: contaba todos los eventos sin actor como si la base estuviera vacía, aunque las migraciones insertan eventos legítimos. Se restringió al día de su fixture y se conservaron las comprobaciones de filtros, conteos y eventos del sistema. No se cambió la consulta del producto.

## Mediciones SQL

Treinta muestras por escenario y perfil, después de calentamiento, ejecutadas secuencialmente en Node20/PostgreSQL15. Fixtures de 10/500/5.000 candidaturas y 1/20/100 CVs. Datos y planes resumidos en [queries.json](qa/queries.json); procedimiento y alcance en [verification.md](verification.md).

| Perfil | SELECTs antes → después | p50 consumo antes → después | p95 consumo antes → después |
| --- | --- | --- | --- |
| 10 ofertas / 1 CV | 8 → 5 | 1,027 → 0,781 ms | 1,892 → 1,156 ms |
| 500 ofertas / 20 CVs | 8 → 5 | 0,816 → 0,663 ms | 1,106 → 0,797 ms |
| 5.000 ofertas / 100 CVs | 8 → 5 | 0,803 → 0,720 ms | 1,105 → 0,878 ms |

Son tiempos del trabajo SQL/JS después de autenticar, dentro del laboratorio; **no son la latencia HTTP ni una mejora porcentual en producción**. La media de adquisición de conexión del candidato en consumo fue 0,0096–0,0181 ms con el pool caliente. La prueba dedicada retiene una conexión para demostrar y medir la espera real.

Los planes de consultas de listados y última oferta por CV se conservaron; esta muestra no justifica cambiar sus índices. Se mantienen conteos, filtros y selección antes de paginar. Las fixtures no incluyen historiales extensos de conversación ni reproducen toda la distribución de datos reales.

## Navegador y recursos

Referencia y candidato completaron **90 casos / 270 observaciones cada uno**, con los tres tamaños de cuenta, escritorio/móvil y caché fría/repetida; incluye navegación cliente en escritorio. Condiciones y resultados completos en [browser.json](qa/browser.json). Las mediciones de tres muestras por caso son exploratorias; el p95 con ese tamaño no acredita un SLO. El harness permite repetir con 30 muestras.

La primera muestra mostró dos cargas frías de Mis CVs más lentas: 279,7→387,7 ms y 340,2→419,2 ms. Se conservaron y se repitieron esos casos con diez muestras y el servidor previamente calentado. El seguimiento arrojó p50 **401,8→388,8 ms** para la cuenta pequeña y **418,8→408,9 ms** para la mediana; p95 405→399 ms y 429,8→427,8 ms. No se reprodujo una regresión persistente; esto tampoco demuestra una mejora general de navegación. [Seguimiento](qa/dashboard-followup.json).

En la cuenta de 5.000 candidaturas, el editor móvil frío quedó en 2.548→2.537 ms de p50 y Candidaturas en 1.731→1.632 ms. Los valores repetidos fueron 537→551 ms y 492→508 ms respectivamente. Se muestran ambos sentidos de variación y se evita extrapolarlos a producción.

Los diez previews simultáneos del caso final produjeron nueve respuestas que compartieron el render en curso y una generación inicial, sin hits previos de caché. Los workers estuvieron activos, sin fallback por bundle ausente. Tras los recorridos, los contenedores mostraban 110,5/113 MiB sobre 1 GiB, sin OOM ni reinicios: es una instantánea, no un máximo sostenido. [Runtime](qa/runtime.json).

El análisis de la build conserva First Load JS de Mis CVs en 192 kB, reduce Candidaturas de 188 a 186 kB y editor de 264 a 263 kB. Son las estimaciones de Next; la transferencia real se registra separadamente en Chromium. No se dividieron los diccionarios ni se añadió virtualización o nueva paginación.

## Límites y operación

No se han medido tráfico real, picos multiusuario sostenidos, LCP/INP de campo ni saturación del VPS. No se proclama ausencia universal de regresiones. Los cambios preservan APIs y reglas mediante pruebas funcionales y se comparan en el mismo laboratorio.

No se cambian memoria, concurrencia o topología de producción. El fallback de PDF tras crash mantiene el render en el hilo web; no se ha cambiado esa política ni se garantiza interrumpir CPU síncrona. La configuración y su presupuesto se explican en [verification.md](verification.md).

Rollback: revertir commits/imagen de aplicación mediante el operador existente. No requiere restauración de datos ni reversión de esquema. No se ejecutó ninguna acción sobre producción.

**Completion gate: PASS para la implementación y verificación local del alcance acordado.** AC-01…AC-07 cubiertos por las pruebas y evidencia anterior. La distribución de tiempos en producción y la carga sostenida quedan expresamente sin acreditar.
