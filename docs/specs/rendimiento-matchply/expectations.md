# Criterios de aceptación

| Criterio | Verificación |
| --- | --- |
| AC-01 / REQ-01 | ≥3 miniaturas: la tercera espera; duplicados comparten render, abortar un suscriptor conserva los demás; fallo permite reintento. Chromium debe mostrar al menos tres previews reales en cuentas con varios CVs. |
| AC-02 / REQ-02 | 10 peticiones PDF iguales producen un render; distintas claves son independientes; error limpia pendientes. Cola, timeout, crash y recuperación probados. |
| AC-03 / REQ-03 | Como máximo una consulta de uso/polling pendiente por pantalla; invalidación durante lectura obtiene resultado fresco; desmontaje no publica datos. |
| AC-04 / REQ-04 | Escribir y pegar en documento/fuente no calcula LCS oculto; comparación conserva orden y líneas; debug desactivado no consulta endpoint. |
| AC-05 / REQ-05 | Optimización con pool=1 concluye; variantes, preview, lease obsoleto, claim invitado y cuota única pasan. Snapshot de uso equivale a lectores separados. |
| AC-06 / REQ-06 | Perfiles DB, migración y HTTP fallan sin configuración o ante skips. Typecheck, lint, tests, operador y build pasan. |
| AC-07 / INV | Navegación autenticada, edición/guardado, aislamiento y payloads ligeros pasan en navegador y PostgreSQL. |

Benchmark: misma imagen Node20/Postgres15 y datos sintéticos 10/500/5.000 ofertas, 1/20/100 CVs. Registrar máquina/build/navegador, frío/repetido, p50/p95 y bytes. No confundir desarrollo, laboratorio y producción. Los benchmarks no son assertions temporales frágiles de CI.

Comparar rutas adyacentes y memoria. Toda mejora declarada debe tener medición o reducción reproducida de trabajo; no extrapolar microbenchmarks a usuarios reales.
