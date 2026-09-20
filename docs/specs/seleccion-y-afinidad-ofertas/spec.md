# Matching fiable, personalizado y eficiente

Estado: **Aprobado para implementar** · 15 de septiembre de 2026.

## Contrato aprobado

- REQ-01: tablero solo porcentaje; detalle con requisitos cumplidos, no acreditados y desconocidos, evidencias, dimensiones, ajustes y recomendaciones.
- REQ-02: ningún idioma penaliza sin regla explícita del usuario. Redacción e idioma requerido para trabajar son independientes.
- REQ-03: brecha acreditada de cuatro años obligatorios comparables: experiencia ≤40 y global ≤59. Competencia principal obligatoria no acreditada sin alternativa cubierta: competencias ≤35 y global ≤59. Desajuste grave acreditado de responsabilidad: experiencia ≤40 y global ≤59.
- REQ-04: sin listas de tecnologías prohibidas ni límites por título. Requisitos deseables y alternativas cubiertas no activan límites. Desconocido no equivale a cero o incapacidad.
- REQ-05: conservar requisitos, negaciones, alternativas y condiciones de toda la descripción. CV complementa perfil. Años y preferencias nunca desaparecen detrás de recortes narrativos. Datos insuficientes no producen una nota concluyente.
- REQ-06: cálculo único con pesos competencias 30 %, experiencia 25 %, modalidad 20 %, salario 15 %, alineación 10 %. Explicación vinculada al cálculo, sin nota independiente.
- REQ-07: lotes en ai_job, progreso NDJSON, recuperación, resultados parciales y reintentos. Calcular no archiva ni mueve ofertas.
- REQ-08: huellas de fuentes completas, preferencias y versiones. Excluir outputs anteriores y modo. No guardar errores como 50 ni ignorar cero válido.

## Invariantes

- INV-01: propietario y permisos existentes en consultas/escrituras; listados sin CVs, descripciones ni evidencias extensas.
- INV-02: cada límite cita requisito y evidencia validada; el LLM no inventa vetos.
- INV-03: no sobrescribir resultados con fuentes obsoletas o generaciones anteriores. Éxito después de persistir.
- INV-04: fallos conservan último resultado real; explicación antigua nunca acompaña cálculo nuevo.
- INV-05: no sumar periodos solapados ni equiparar experiencia total con especializada.

## Interfaces y compatibilidad

Lote: éxitos {id, score}; progreso/errores separados y cierre sin duplicar resultados. Detalle: evidencia y explicación versionadas. Trabajos del propietario sobreviven al cierre de pestaña.
Migración aditiva; preferencias versionadas conservan originales y desactivan automatismos. Invalidar notas antiguas, recalcular bajo demanda sin reprocesado masivo. Modelo configurado, umbral 65 y permisos existentes se conservan.

Ver [expectations.md](expectations.md), [plan.md](plan.md) y [evidence.md](evidence.md).
