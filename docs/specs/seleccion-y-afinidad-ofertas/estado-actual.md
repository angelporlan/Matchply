# Selección y afinidad — estado implementado

Fecha: 15 de septiembre de 2026. Implementación local; [evidencias y limitaciones](evidence.md).

- ACT-F14-01: el tablero pide porcentajes al endpoint de curación; este encola un trabajo persistente y transmite progreso NDJSON. El worker comparte el evaluador con el análisis individual.
- ACT-F14-02: umbral 65; micro-lotes de dos y concurrencia máxima cuatro por trabajo. La cola limita trabajos activos por usuario.
- ACT-F14-03: éxito `{id,score}` después de persistir; progreso, errores y cierre separados. Recuperación por trabajo autenticado y reintentos parciales.
- ACT-F14-04: idiomas sin penalización por defecto; únicamente reglas explícitas. Brechas acreditadas de experiencia, responsabilidad o competencia principal activan los límites definidos en la especificación.
- ACT-F14-05: el detalle explica el mismo cálculo con requisitos, evidencia y ajustes. No se generan narrativas en lote.
- ACT-F14-06: caché basada en fuentes completas y versiones; huella de cálculo independiente del modo. Triggers invalidan cambios de fuentes; generaciones y leases protegen la escritura.
- ACT-F14-07: errores no generan notas de respaldo; cero es válido. Scores antiguos o desactualizados se conservan internamente y aparecen pendientes de cálculo.
- ACT-F14-08: calcular no archiva ni mueve ofertas. La investigación mantiene sus resultados separados.

[Contrato](spec.md) · [Aceptación](expectations.md) · [Implementación](plan.md).
