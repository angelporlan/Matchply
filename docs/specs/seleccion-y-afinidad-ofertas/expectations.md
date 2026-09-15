# Expectativas verificables

| ID | Escenario | Resultado |
| --- | --- | --- |
| AC-01 | Anuncio traducido / idioma sin regla explícita | Sin ajuste lingüístico |
| AC-02 | Regla inglés C1+, inglés B2 y alemán nativo en JD | No atribuir alemán al inglés |
| AC-03 | 7 años obligatorios frente a 3 comparables | Experiencia ≤40 y global ≤59 |
| AC-04 | Go obligatorio no acreditado vs alternativa Go o Node cubierta | Límite solo primero |
| AC-05 | Perfil largo / requisitos en mitad de marketing y beneficios | Preferencias y requisitos conservados |
| AC-06 | Mismas entradas, lote y detalle | Mismo cálculo y huella |
| AC-07 | Cambio fuera del antiguo extracto | Invalida caché |
| AC-08 | JSON incompleto / fuente insuficiente / fallo de escritura | Error, sin nota ficticia |
| AC-09 | Score cero / ejecución antigua / edición concurrente | Cero persiste; obsoletos rechazados |
| AC-10 | Desconexión/reintento del lote | Éxitos parciales conservados |
| AC-11 | Usuario ajeno / listado | Sin acceso ajeno ni cargas extensas |
| AC-12 | Profesión no técnica / título Staff compatible | Reglas genéricas sin veto por título |

Verificar con pruebas de constraints, cards, evidence, cache, servicio, cola y persistencia; migraciones con Postgres aislado; lint, typecheck, build y QA de perfil/lote/detalle.
