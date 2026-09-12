# 🤖 Contexto para Agentes e Inteligencias Artificiales (AGENTS.md)

Este archivo proporciona una guía rápida de referencia, arquitectura y contexto de infraestructura para que cualquier **Agente de IA** o desarrollador pueda entender la estructura de **Matchply**, su despliegue mediante Docker, base de datos y flujos clave.

---

## 🚀 1. Concepto del Proyecto
**Matchply** es una plataforma web inteligente diseñada para ayudar a candidatos a:
1. **Optimizar currículums de forma personalizada** utilizando Inteligencia Artificial (motores como *DeepSeek*, *Gemini* y *OpenRouter*) para alinearlos con ofertas de empleo específicas.
2. **Seguimiento interactivo y visual** de los procesos de selección utilizando un tablero de **postulaciones** dinámico.
3. **Generación directa de PDFs** basados en la plantilla A4 Harvard compilada directamente en el servidor.
4. **Modelo de negocio Premium** gestionado con Stripe para desbloquear funciones de personalización e IA avanzada.

---

## 🛠️ 2. Stack Tecnológico Principal
- **Frontend / Backend:** [Next.js 14](https://nextjs.org/) (App Router, React 18, TypeScript)
- **Base de Datos & ORM:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **Estilos / Componentes:** Tailwind CSS, Framer Motion (animaciones premium) e iconos vectoriales de Lucide React
- **Autenticación:** NextAuth.js (v5 Beta)
- **Pasarela de Pagos:** Stripe
- **Generación de Documentos:** PDFKit (Compilación a PDF del lado del servidor)

---

## 📁 3. Arquitectura de Directorios (`src/`)
```text
src/
├── app/                  # Enrutamiento de Next.js (App Router) y APIs
│   ├── (auth)/           # Flujos de autenticación (Login, Registro)
│   ├── api/              # Endpoints del Servidor (API Routes)
│   │   ├── ai/optimize/  # Proceso de optimización de CV por IA
│   │   ├── auth/         # Handlers y config de NextAuth
│   │   ├── stripe/       # Webhooks e integración de Stripe Checkout
│   │   └── cv/pdf/       # Generación de PDF interactivo
│   ├── dashboard/        # Panel principal del usuario y tablero de postulaciones
│   │   ├── applications/       # Tablero visual de postulaciones
│   │   └── actions.ts    # Server Actions del Dashboard
│   ├── editor/           # Editor interactivo de currículums (Markdown)
│   ├── layout.tsx        # Layout global
│   └── page.tsx          # Landing page promocional
├── components/           # Componentes UI modulares
│   ├── editor/           # Editor MD, barra de herramientas y visor PDF
│   ├── applications/           # Columnas y tarjetas de postulaciones
│   └── ui/               # Componentes base (Botones, Inputs, etc.)
├── db/                   # Configuración y esquemas Drizzle Relacionales
│   ├── index.ts          # Inicializador de Drizzle con cliente Postgres
│   └── schema.ts         # Esquemas de Base de Datos relacional
├── lib/                  # Utilidades y helpers compartidos (Tailwind Merge)
└── types/                # Declaraciones de tipos TypeScript
```

---

## 🐳 4. Entorno Containertizado (Docker)
Matchply está configurada para levantarse por completo en entornos aislados y portables mediante **Docker**:

### A. Entorno de Desarrollo (`docker-compose.yml`)
1. **Base de Datos (`nextprof_postgres`):** PostgreSQL 15 (en compose de desarrollo el puerto host suele ser `5433`).
2. **Aplicación Web (`nextprof_web`):** Next.js 14 en puerto `3000` con hot-reload.
3. **Workers:** `research_worker` (investigación de ofertas) y `ai_worker` (cola `ai_job`). Sin puertos públicos.

*Para arrancar en desarrollo:*
```bash
docker-compose up --build
```

### B. Entorno de Producción (`docker-compose.prod.yml` & `Dockerfile.prod`)
1. **Base de Datos (`nextprof_postgres_prod`):** PostgreSQL 15 expuesto únicamente de forma interna en `127.0.0.1:5432` por seguridad.
2. **Aplicación Web (`nextprof_web_prod`):** Next.js compilado en producción (`npm run build` y `npm run start`). Expuesta en `127.0.0.1:3000` lista para conectarse detrás de un proxy reverso como **Nginx** o **Caddy**.

---

## 🛢️ 5. Base de Datos & Migraciones (Drizzle)
La base de datos PostgreSQL se gestiona de forma interactiva con **Drizzle ORM**.

### Esquemas Clave (`src/db/schema.ts`):
- `user`: Perfil, roles (`user`, `admin`), Stripe (`stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`) y `careerProfile` (JSONB).
- `cv`: Markdown del currículum, diseño (`templateName`, `accentColor`, `fontFamily`, `scale`, `pageMargin`) e indicadores (`isBase`, `isPrincipal`).
- `job_offer`: Postulaciones del tablero. Tabla ancha: no seleccionar `description`/`rawReport` en listados.
- `job_research_run` / `ai_job`: colas Postgres (`SKIP LOCKED`) para research y jobs de IA.
- `setting` / `prompt`: proveedor/modelo de IA y prompts dinámicos.
- `audit_log`: auditoría (escritura no bloqueante).

### Comandos de Base de Datos:
```bash
# 1. Generar los archivos SQL de migración después de cambiar schema.ts
npm run db:generate

# 2. Aplicar las migraciones a la Base de Datos
npm run db:migrate

# 3. Pushing directo para sincronización ágil en desarrollo
npm run db:push

# 4. Abrir Drizzle Studio (GUI web interactiva)
npm run db:studio
```

---

## 🖥️ 6. VPS y Despliegue en Producción
La aplicación está alojada en producción en el servidor VPS con el dominio **matchply.com**.

### Credenciales y Acceso al Servidor:
- **SSH Host:** `217.76.133.58`
- **Comando de acceso:** `ssh root@217.76.133.58`
- **Ruta de la app en el servidor:** `/app/Matchply`
- **Variables de Entorno:** Editables directamente con `nano .env` en el servidor. Al guardar con `Ctrl + O`, pulsar `ENTER` y salir con `Ctrl + X`, recuerda reiniciar los contenedores con `docker-compose restart web`.

---

## 🛠️ 7. Scripts Útiles del Proyecto

### A. Túnel Seguro SSH a la Base de Datos (`./scripts/db-tunnel.sh`)
Permite conectar un cliente visual como **TablePlus** a la base de datos de producción mapeando el puerto remoto del VPS al puerto local `5433`:
```bash
./scripts/db-tunnel.sh
```
*Detalles de conexión TablePlus:*
- **Host:** `127.0.0.1`
- **Port:** `5433`
- **User:** `postgres`
- **Password:** `nextprof_secure_pwd`
- **Database:** `nextprof_db`
- *SSH desactivado en TablePlus (ya que el script maneja el túnel).*

### B. Escucha de Eventos Webhooks de Stripe (`./scripts/stripe-listen.sh`)
Lanza un contenedor ligero de `stripe/stripe-cli` para reenviar los webhooks de pasarela de pago locales al endpoint de Next.js:
```bash
./scripts/stripe-listen.sh
```

### C. Crear Usuario Administrador (`scripts/make-admin.ts`)
Para otorgar el rol de administrador a una cuenta de usuario específica mediante su correo electrónico:
```bash
npx tsx scripts/make-admin.ts <correo_del_usuario>
```

---

## 🎨 8. Pautas de Diseño e Identidad Visual (Importante para IA)

La fuente única de verdad para el diseño de Matchply es [design.md](design.md). Leerla antes de proponer o implementar cambios visuales: contiene identidad, paleta semántica, tipografía, botones, componentes, accesibilidad y criterios de aceptación.

No duplicar tokens ni pautas visuales en este archivo o en las notas. Las discrepancias del código y el plan pendiente de aplicación están documentados en la guía; no asumir que el diseño objetivo ya está implementado.

---

## 9. Prácticas de desarrollo (escala y datos)

El producto cabe en un monolito Next.js + Postgres + workers Docker. El fallo habitual no es “falta microservicios”: es **cargar tablas enteras en listados, duplicar caminos de IA y dejar código muerto**.

### Consultas
- **Listados** (`/dashboard`, `/dashboard/applications`, archivadas): usar `applicationSummaryColumns` y `cvListColumns` de `src/lib/job-offer-queries.ts`. Nunca `db.select().from(jobOffers)` ni `from(cvs)` en una página de tablero.
- **`job_offer` es una tabla ancha** (description, rawReport, cover letters, JSONB). El detalle se lee **al abrir** (`getOwnedJobOffer` o la página `/offer/[id]`), no se manda al client del tablero.
- Conteos: `GROUP BY status` o `count(*)`, no `select()` + `.filter` en memoria.
- Usuario en layout/páginas: `sessionUserColumns` o solo `subscriptionStatus`. No arrastrar `careerProfile` (JSONB) si no se usa.
- Un CV base para IA: `baseCvForAiColumns` + `orderBy(isBase, isPrincipal).limit(1)`. No cargar todos los CVs para `.find(isBase)`.
- Ofertas para curar: `curateOfferColumns`, no el row completo.
- Si hace falta una columna nueva en el tablero, **añádela al objeto de columnas**, no pases a `select()`.

### IA
- El **editor** puede streamear en la request (`/api/ai/optimize`) con timeout y rate limit.
- **Lotes, MCP, API externa o jobs largos** van a `ai_job` + `npm run ai:worker` (`enqueueAiJob` / `settleAiJob`). No copiar un Server Action que vuelva a hacer el mismo `select()` gordo “por si acaso”.
- Si quitas un productor (MCP, API), no dejes un action duplicado ni un kind de job sin llamadores. El worker vacío confunde más que ayuda.
- Reutiliza `/api/ai/curate` para curación en lote. No clones esa lógica en `actions.ts`.

### Request path
- Timeouts en `fetch` a LLM (`src/lib/http.ts`). Rate limit en optimize, curate, PDF (`src/lib/rate-limit.ts`).
- PDF: `src/lib/pdf-cache.ts`. No regenerar el mismo hash en cada preview.
- Auditoría: `createAuditLog` no debe bloquear el flujo; no hagas `select()` extra solo para loguear.
- Logs: `log()` de `src/lib/logger.ts` (JSON + `requestId`). Evita `console.error` suelto en código nuevo.
- Secretos: tokens de extensión y API keys se **hashean**. Nunca devolver un secreto guardado al recargar una página; mostrarlo solo al generarlo.

### Infra
- Pool acotado: `DATABASE_POOL_MAX`, `DATABASE_STATEMENT_TIMEOUT_MS` (web ~15s, workers ~180s).
- Índices por `userId` (y `(userId, updatedAt)` / `(userId, status)` en `job_offer`) al añadir tablas de usuario.
- Compose: `web` + `db` + `research_worker` + `ai_worker`. Health: `GET /api/health`.
- Tras cambiar `schema.ts`: `npm run db:generate` y `npm run db:migrate`. No `db:push` en producción.

### Cómo comprobar un cambio de listado
Si tocas el tablero o el dashboard, el HTML/RSC **no** debe contener `rawReport`, cover letters ni bloques `## Experiencia` de todos los CVs. Eso sí puede aparecer en `/dashboard/applications/offer/[id]`.
