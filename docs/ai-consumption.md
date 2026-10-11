# Consumo de IA

El panel **Administración → IA → Ver consumo, costes y uso por usuario** (`/admin/ai/usage`) muestra consultas, tokens y costes de los últimos 7, 30 o 90 días, con desglose por función y usuario. Se puede buscar un usuario, abrir su consumo, filtrar la función y paginar el detalle. Solo una cuenta administradora activa puede acceder; las sesiones de soporte no pueden usarlo.

`ai_request_usage` guarda una fila por petición HTTP al proveedor, incluidos reintentos. No contiene prompts, respuestas, CVs, descripciones, enlaces ni credenciales. Los trabajos de IA y las cuotas del producto siguen siendo métricas independientes: un matching puede realizar varias consultas, y un resultado servido desde caché no implica una llamada nueva.

La atribución usa `AsyncLocalStorage`: el worker aporta usuario, trabajo y función; el transporte añade proveedor, modelo y endpoint. La recuperación de descripciones dentro de un lote se identifica como `import_offer`; las variantes de CV como `optimize_cv:<modo>`. También se registran importación de CV, perfil, networking, investigación, cartas y pruebas de modelos. Los catálogos de modelos y las descargas de páginas no son inferencia y no cuentan.

El transporte observa los bytes que consume el llamador, sin duplicar el stream. Lee `usage` o `usageMetadata`, incluido el último evento SSE, y guarda la métrica sin bloquear la generación. Un fallo al guardarla se registra como `ai_request_usage_failed`. Un cierre o cancelación sin consumo reportado queda como dato incompleto. El registro comienza con esta versión: no se inventa el consumo anterior.

## Costes

- `reported`: OpenRouter devuelve `usage.cost` en USD (incluido cero).
- `estimated`: tarifa publicada × tokens, con caché, escrituras de caché, contexto largo y tier de procesamiento cuando corresponde. El precio y su fuente se conservan en cada fila; actualizar una tarifa no cambia los datos anteriores.
- `unknown`: faltan tokens o una tarifa verificable. El panel muestra **No disponible** y advierte que el total es parcial.

Las tarifas incorporadas se verificaron el 11 de octubre de 2026. El matching OpenAI usa [Decisions](https://developers.openai.com/api/docs/guides/decisions), cuya tarifa es solo de entrada; no se añaden cargos de salida o caché. [Responses](https://developers.openai.com/api/docs/pricing) aplica la tarifa del modelo y las llamadas de búsqueda web. Los tokens de razonamiento de OpenAI ya forman parte de la salida; en [Gemini](https://ai.google.dev/gemini-api/docs/pricing) se suman `thoughtsTokenCount` y `candidatesTokenCount` una vez. Los tokens en caché forman parte de la entrada y nunca se suman otra vez al total.

Los importes estimados usan precios estándar de texto, sin impuestos, descuentos o créditos de cuenta. Gemini se estima con la tarifa de pago; una cuenta gratuita puede configurar precios cero. Los modelos sin tarifa incorporada (incluidas tarifas de DeepSeek dependientes de horario/acuerdo) conservan tokens y quedan con coste desconocido hasta configurar una tarifa. No es una conciliación de la factura del proveedor.

Para cambiar tarifas o añadir modelos, configurar `AI_USAGE_PRICING_JSON` en web y workers y reiniciarlos. Las claves son `proveedor:modelo`; valores en USD por millón de tokens:

```json
{
  "gemini:mi-modelo": {
    "input": 0.3,
    "output": 2.5,
    "cachedInput": 0.03,
    "source": "URL o referencia de la tarifa verificada",
    "verifiedAt": "2026-10-11"
  }
}
```

Opcionales: `cacheWrite`, `longContextAbove`, `longInputMultiplier`, `longOutputMultiplier`. OpenRouter siempre prioriza el coste devuelto por la API. Mantener estas tarifas cuando cambie el modelo, el acuerdo o los precios del proveedor.

## Activación y comprobación

Ejecutar `npm run db:migrate` antes de activar web y workers con esta versión. La migración añade una tabla e índices por fecha, usuario y función. Los agregados se calculan en SQL y los listados tienen páginas de 25 filas.

Pruebas unitarias: `node --import tsx --test scripts/ai-request-cost.test.ts`.

Integración: configurar `AI_COST_TEST_DATABASE_URL` con una base **local y aislada cuyo nombre contenga `test`**, aplicar el esquema y ejecutar `node --import tsx --test scripts/ai-request-usage.integration.test.ts`. El proveedor se simula: no requiere claves ni realiza consultas de pago.
