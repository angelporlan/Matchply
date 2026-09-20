# Configuración de IA, modelos y prompts — comportamiento deseado

Estado: **Aprobado para implementar**  
Fecha de revisión: 20 de septiembre de 2026  
Prioridad: Imprescindible

Se conserva la [especificación técnica anterior](spec.md) para el historial de prompts integrados. Esta propuesta la sustituye operativamente.

## 1. Lo que quiero

Modelos por plan general y excepciones por función, guardados atómicamente. Prompts únicamente en código, con selector de modos del editor. Catálogo oficial consultado en servidor. Historial de configuración restaurable.

## 2. Decisiones

- Proveedores: Gemini, DeepSeek, OpenRouter.
- Contrato `AiRuntimeConfig` (versión, general Gratis/Pro, excepciones de seis funciones). No cambia qué funciones permite cada plan.
- Resolver una vez por petición o trabajo; TTL ≤ 60 s; el snapshot viaja con los reintentos del job.
- Prompts: modos versionados en código. `promptId` → `modeId` con mapa temporal de UUID antiguos. Tabla `prompt` histórica, sin lecturas operativas ni editor admin.
- Ningún modo autoriza inventar experiencia o métricas; las diferencias de tono quedan subordinadas a las reglas comunes de fidelidad.
- Probar un modelo nuevo antes de activarlo. Credenciales solo en entorno (configurada / no configurada).

## 3. Funciones con modelo

`optimize_cv`, `import_cv`, `career_profile`, `matching`, `outreach`, `research`.

## 4. Criterios

| ID | Esperado |
| --- | --- |
| CA-IA-01 | Guardado atómico; un conflicto de versión no sobrescribe otra edición |
| CA-IA-02 | Proveedor caído: se conservan las selecciones actuales |
| CA-IA-03 | Combinación nueva sin prueba satisfactoria: no se activa |
| CA-IA-04 | Todos los modos se resuelven sin tabla `prompt` |
| CA-IA-05 | Identificador desconocido: mensaje de recarga, sin ejecutar IA |
| CA-IA-06 | Workers usan el snapshot del job en reintentos |
