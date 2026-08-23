# Expectativas verificables

| ID | Expectativa | Evidencia |
| --- | --- | --- |
| P-01 | Los cinco prompts operativos existen en código | `scripts/prompt-defaults.test.ts` |
| P-02 | `import_cv` funciona sin una fila en PostgreSQL | `AIService.resolvePrompt()` devuelve el fallback integrado |
| P-03 | Una fila incompleta no desactiva el fallback | `resolvePrompt()` solo acepta sobrescrituras completas |
| P-04 | La interfaz no muestra el antiguo error de prompt faltante | La ruta de importación devuelve el error genérico del proveedor únicamente |
