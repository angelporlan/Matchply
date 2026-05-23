# NextProf AI 🚀

NextProf AI es una plataforma web inteligente diseñada para ayudar a candidatos a optimizar sus currículums de forma personalizada utilizando Inteligencia Artificial (motores como DeepSeek, Gemini y OpenRouter) y a realizar un seguimiento visual e interactivo de sus procesos de selección mediante un tablero Kanban.

---

## 🛠️ Stack Tecnológico

- **Core:** [Next.js 14](https://nextjs.org/) (App Router), React 18, TypeScript.
- **Estilos:** Tailwind CSS, Lucide React (iconos).
- **Base de Datos & ORM:** PostgreSQL (pg), [Drizzle ORM](https://orm.drizzle.team/).
- **Autenticación:** NextAuth.js (v5 beta).
- **IA:** Integración con APIs de LLMs para optimización contextual del CV frente a descripciones de ofertas de empleo.
- **Generación de PDFs:** PDFKit (compilación de plantillas directamente a PDF en el servidor).
- **Pasarela de Pago:** Stripe (suscripción mensual para desbloquear funciones Premium).

---

## 📁 Estructura del Proyecto

A continuación se detalla la arquitectura de directorios del proyecto bajo la carpeta `src/`:

```text
src/
├── app/                  # Enrutamiento de Next.js (App Router) y APIs
│   ├── (auth)/           # Rutas del flujo de autenticación (Login, Registro)
│   ├── api/              # Endpoints del Servidor (API Routes)
│   │   ├── ai/optimize/  # Endpoint para procesar la optimización del CV por IA
│   │   ├── auth/         # Configuración y handlers de NextAuth
│   │   ├── stripe/       # Webhooks e integración de Stripe Checkout
│   │   └── cv/pdf/       # Generación de PDF interactivo
│   ├── dashboard/        # Panel principal del usuario y tablero Kanban
│   │   ├── kanban/       # Vista de seguimiento de postulaciones
│   │   └── actions.ts    # Acciones de servidor (Server Actions) del dashboard
│   ├── editor/           # Editor interactivo de currículums por ID
│   ├── layout.tsx        # Layout global (metadatos, fuentes, estilos base)
│   └── page.tsx          # Landing page promocional del producto
├── components/           # Componentes de UI modulares y reutilizables
│   ├── editor/           # Editor de Markdown, barra de estilos y visor de PDF
│   ├── kanban/           # Columnas y tarjetas individuales del tablero de seguimiento
│   └── ui/               # Componentes básicos de interfaz
├── db/                   # Configuración y esquemas de Base de Datos relacional
│   ├── index.ts          # Inicialización del cliente Postgres de Drizzle
│   └── schema.ts         # Definición de tablas (users, cvs, jobOffers) y relaciones
├── lib/                  # Utilidades compartidas y funciones auxiliares
│   └── utils.ts          # Helpers generales de formateo de fechas y Tailwind Merge
└── types/                # Declaraciones de tipos TypeScript adicionales
```

---

## ⚙️ Configuración y Arranque

### 1. Variables de Entorno
Copia el archivo de plantilla `.env.example` a un nuevo archivo `.env` en la raíz del proyecto y completa las credenciales necesarias:

```bash
cp .env.example .env
```

Las variables críticas incluyen:
- Credenciales de la base de datos PostgreSQL (`DATABASE_URL`).
- Configuración de NextAuth (`AUTH_SECRET`, `NEXTAUTH_URL`).
- API Keys para proveedores de IA (`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
- Configuración de Stripe (`STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`).

### 2. Comandos Disponibles

El proyecto gestiona la ejecución y base de datos con los siguientes comandos configurados en `package.json`:

#### Entorno de Desarrollo
```bash
npm run dev
```
Inicia el servidor de desarrollo local de Next.js en `http://localhost:3000`.

#### Construcción para Producción
```bash
npm run build
```
Compila la aplicación para producción generando código de servidor y páginas optimizadas.

```bash
npm run start
```
Arranca el servidor web con la compilación de producción generada.

#### Control y Migración de Base de Datos (Drizzle ORM)
```bash
# Genera las migraciones SQL a partir de los cambios en `schema.ts`
npm run db:generate

# Aplica las migraciones pendientes sobre la base de datos PostgreSQL
npm run db:migrate

# Sincroniza directamente el esquema en bases de datos de desarrollo (sin generar archivos SQL)
npm run db:push

# Abre Drizzle Studio en tu navegador (GUI web local para examinar y editar las tablas)
npm run db:studio
```

#### Calidad de Código
```bash
npm run lint
```
Ejecuta el linter (ESLint) para verificar estilos y buenas prácticas.

---

## 🐳 Contenedores (Docker)

El proyecto incluye soporte para despliegues contenerizados mediante:
- `Dockerfile`: Configuración de compilación multietapa optimizada para Next.js.
- `docker-compose.yml`: Permite levantar el entorno de manera rápida incluyendo servicios dependientes.

Para levantar el contenedor:
```bash
docker-compose up --build
```
