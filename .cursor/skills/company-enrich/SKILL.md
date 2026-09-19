---
name: company-enrich
description: Completa fichas compartidas de empresa en Matchply (web, ubicación, sector e icono pequeño). Úsala cuando el usuario llame company-enrich, pida enriquecer empresas, rellenar datos de company o buscar iconos de empresas incompletas.
disable-model-invocation: true
---

# Company enrich

Rellena el **catálogo compartido** de `company` en Matchply. Nombre, web, ubicación, sector e icono son comunes a todos los usuarios. Notas y postulaciones no se tocan.

No ejecutes este flujo salvo que el usuario haya llamado esta skill.

## Qué completar

Por cada empresa incompleta, rellena solo campos vacíos:

| Campo | Destino | Forma |
|---|---|---|
| Sitio web | `company.website` | `https://dominio.tld` sin barra final |
| Ubicación | `company.location` | Ciudad, país. Corto. Ej. `Madrid, España` |
| Sector | `company.sector` | Etiqueta corta. Ej. `Fintech`, `SaaS`, `Consultoría` |
| Icono | `company_icon` + `company.iconHash` | PNG/WebP/ICO ≤ 8 KB, 32–64 px |

No cambies el nombre salvo que el usuario lo pida. No pises datos ya rellenos salvo `--overwrite` explícito.

## Arranque

1. Lee `src/lib/company-service.ts`, `src/lib/company-icon.ts` y `src/db/schema.ts` si hace falta.
2. Lista incompletas. En Docker de desarrollo, desde el host:

```bash
DATABASE_URL=postgresql://postgres:nextprof_secure_pwd@localhost:5433/nextprof_db \
  npx tsx scripts/company-enrich.ts list --limit 40
```

3. Si no hay filas, dilo y para. Si hay, procesa como máximo 20 por invocación y reporta cuántas quedan.

Una empresa está incompleta si falta `website`, `location`, `sector` o `iconHash`.

## Investigación

Para cada empresa, busca en internet. Empieza por el nombre; si ya hay web, úsala como fuente principal.

Fuentes, en este orden:

1. Sitio oficial (about, contact, footer)
2. Wikipedia / Wikidata
3. LinkedIn company, si el resto no basta
4. Registro mercantil o prensa solo para HQ/sector si no hay otra fuente

Reglas:

- Distingue homónimos (`Google` ≠ `Google Spain`; una startup local ≠ la multinacional).
- Si no estás seguro al 80 %, deja el campo vacío y anótalo.
- Sector en el idioma de la ficha (español si el nombre/ubicación es ES/LATAM; si no, inglés).
- No inventes web. No uses buscadores genéricos como website.

Icono: sigue [reference.md](reference.md). Optimiza a ≤ 8 KB **antes** de guardar.

## Escritura

Aplica con el script. En Docker de desarrollo, antepón el mismo `DATABASE_URL` de localhost:5433. Nunca `db:push` ni SQL suelto sobre producción:

```bash
DATABASE_URL=postgresql://postgres:nextprof_secure_pwd@localhost:5433/nextprof_db \
  npx tsx scripts/company-enrich.ts apply --id <uuid> \
  --website https://example.com \
  --location "Madrid, España" \
  --sector Fintech \
  --icon /tmp/company-icon.png
```

Omite flags de campos que no hayas resuelto. El script no pisa valores existentes. `--overwrite` solo si el usuario lo pide.

Tras cada `apply`, comprueba que el JSON ya no incluye ese campo en `missing` (vuelve a `list` al final).

## Informe

Al terminar, resume:

- Completadas (id, nombre, campos escritos)
- Omitidas y por qué (homónimo, sin web fiable, icono demasiado grande)
- Cuántas incompletas quedan

No lances otro lote salvo que el usuario lo pida.
