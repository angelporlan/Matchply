# Matchply MCP

Cliente MCP de la API de agente. No abre Postgres: cada herramienta llama a `/api/v1/agent` con el token de la cuenta.

Variables:

- `MATCHPLY_API_TOKEN` (obligatoria). Si falta, el proceso sale con código 1.
- `MATCHPLY_API_BASE` (opcional, por defecto `https://matchply.com`, sin barra final).

Arranque stdio:

```bash
npm run mcp:build
MATCHPLY_API_TOKEN=... node mcp/dist/index.js
```

`MATCHPLY_MCP_TRANSPORT=http` escucha solo en `127.0.0.1` y `MATCHPLY_MCP_PORT` (8787). No lo publiques.

Ejemplo de `matchply_create_view`:

```json
{
  "entity": "applications",
  "name": "Matching Hoy",
  "config": {
    "columns": ["score", "title", "company", "status", "createdAt", "updatedAt"],
    "filters": {
      "status": "interested",
      "cv": "all",
      "date": "custom",
      "startDate": "2026-10-31",
      "endDate": "2026-10-31",
      "followup": "all",
      "excludedStatuses": [],
      "columnFilters": [{ "column": "platform", "operator": "equals", "value": "linkedin" }]
    },
    "sort": { "key": "updatedAt", "direction": "desc" },
    "pageSize": 25,
    "grouping": null,
    "columnWidths": {},
    "actionsIndex": null
  }
}
```
