# Iconos de empresa

El listado puede tener cientos de fichas. El icono tiene que ser **pequeño**: 32×32 o 64×64, PNG o WebP, **máximo 8 KB**. Va en `company_icon.bytes` (base64) y el listado solo lee `company.iconHash`.

## De dónde sacarlo

Con web conocida, origen = `new URL(website).origin`.

1. HTML de la home: `link[rel~=icon]`, `apple-touch-icon`
2. `${origin}/favicon.ico`
3. `${origin}/favicon.png`
4. `https://www.google.com/s2/favicons?domain=${host}&sz=64`
5. `https://icons.duckduckgo.com/ip3/${host}.ico`

Si no hay web, busca el dominio oficial primero. Sin dominio fiable, no guardes icono.

No uses Clearbit ni CDNs de pago. No descargues logos de alta resolución ni SVG complejos.

## Optimizar (macOS)

```bash
sips -z 64 64 -s format png "$SRC" --out /tmp/company-icon.png
```

Si el PNG sigue por encima de 8 KB:

```bash
sips -z 32 32 -s format png "$SRC" --out /tmp/company-icon.png
```

Comprueba el tamaño (`wc -c` o `stat`). Si aún supera 8 KB, omite el icono y explícalo.

En Linux, equivalente con ImageMagick si existe: `convert "$SRC" -resize 64x64 png:/tmp/company-icon.png`.

El script rechaza archivos > 8 KB y mimes que no sean PNG, WebP, ICO o JPEG.

## Guardar

```bash
npx tsx scripts/company-enrich.ts apply --id <uuid> --icon /tmp/company-icon.png
```

No selecciones `company_icon.bytes` en consultas de listado. La UI usa `/api/companies/:id/icon?v=:iconHash`.
