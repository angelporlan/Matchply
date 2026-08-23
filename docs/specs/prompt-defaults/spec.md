# Prompts operativos integrados

## Problema

Los flujos de IA dependían de que existiera una fila activa `import_cv` en la
tabla `prompts`. Una instalación sin seed podía importar un PDF correctamente
hasta llegar al proveedor, pero fallaba antes con `IMPORT_PROMPT_MISSING`.

## Decisión

Los prompts operativos se versionan en
`src/lib/prompt-defaults.ts`. La base de datos puede aportar una
sobrescritura completa para experimentación administrativa, pero una fila
ausente, incompleta o una consulta fallida siempre usa el prompt integrado.

Se cubren los contratos `optimize_cv`, `import_cv`, `star_analyze`,
`star_optimize` y `analyze_failures`.

## Invariantes

- La importación de CV no lanza `IMPORT_PROMPT_MISSING` por falta de seed.
- Cada prompt operativo tiene `systemPrompt` y `userPrompt` no vacíos.
- El prompt de importación conserva el marcador `{{cv}}` y el modo estricto.
- La configuración de proveedor/modelo sigue siendo independiente de los
  prompts.
