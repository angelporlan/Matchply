# Matchply — Sistema de diseño

Versión 2 · 12 de septiembre de 2026

**Fuente única de verdad para el diseño de Matchply.** Consolida la guía anterior, `notes.md`, `desing_notes.md`, el plan visual de `IMPLEMENTATION_PLAN.md` y las pautas visuales de `AGENTS.md`. El nombre canónico es `design.md`; no crear otro `desing.md`.

Este documento define el diseño objetivo. Esta revisión es documental: los cambios de interfaz descritos requieren implementación posterior. Los hallazgos del código y el inventario heredado se distinguen de las reglas nuevas.

## 1. Dirección del producto

Matchply ayuda a adaptar un CV a una oferta concreta, revisar los cambios, descargar un documento profesional y seguir la candidatura. La interfaz debe transmitir **claridad, control y confianza**, con personalidad en sus acciones principales.

El público inicial incluye jóvenes buscando empleo, pero la legibilidad y el lenguaje deben servir también a personas con experiencia, en transición profesional o con necesidades de accesibilidad. La creatividad debe ayudar a expresarse sin restar credibilidad al CV.

- Una acción dominante por contexto. Mostrar las opciones avanzadas cuando sean relevantes.
- Priorizar el CV, la oferta y los cambios sugeridos frente a estadísticas o decoración.
- Explicar qué hace la IA y permitir revisar el resultado antes de aplicarlo. Conservar el original.
- Usar lenguaje directo: «Adaptar a esta oferta», «Revisar cambios», «Descargar PDF».
- No prometer entrevistas, contratación ni superar cualquier ATS. Un indicador de ajuste necesita explicar qué mide y sus límites; no presentarlo como probabilidad de contratación.
- Separar visualmente la interfaz de trabajo del documento que se exporta.

## 2. Diagnóstico y decisiones

| Hallazgo en las guías o el código | Evaluación | Decisión |
|---|---|---|
| Blanco roto, medianoche, verde y púrpura | Permiten una base sobria y acciones reconocibles. El significado del color es una convención del producto, no una garantía psicológica. | Conservar la identidad y asignar roles precisos. |
| Regla 60 + 30 + 10 + 10 | Suma 110 % y favorece la competencia entre acentos. | Los acentos comparten un presupuesto visual orientativo de 10 %. |
| Blanco sobre verde `#2ECC71` | Contraste insuficiente, incluso para texto grande. Aparece en el CTA de la landing. | Texto medianoche sobre verde. |
| Blanco sobre púrpura `#8B5CF6` | No alcanza 4,5:1 para texto normal. | Fondo `#7C3AED` para el botón IA claro. |
| «Púrpura exclusivo IA», pero usado también en logo, navegación, Pro y selección | El color pierde significado funcional. | Excepción explícita para el logo; navegación y Pro neutros. |
| Satoshi/Plus Jakarta en guías; Outfit/Inter en código | Tres alternativas para el mismo rol. | Outfit para títulos e Inter para controles y lectura. |
| Escala web definida en puntos A4 | Mezcla documento impreso y aplicación. | Rem en UI y reglas independientes para PDF. |
| `:root` oscuro y fondo `#030712` en el body | Los tokens base no representan el tema claro descrito. | Claro en `:root`, oscuro en `.dark`, misma semántica. |
| `rounded-lg` descrito como 8 px | Actualmente resuelve a `--radius`, que vale 12 px. | Nombrar radios por función; no asumir equivalencias Tailwind. |
| Glow, partículas, giro 3D y shimmer repetido | Compiten con la lectura y la tarea. | Reducir decoración y reservar movimiento para feedback. |

### Referencia: Clonify

Inspección visual y de estilos calculados de la [home de Clonify](https://www.clonify.com/en), realizada el 12/09/2026. Sus CTA combinan fondo lima `#C5FF3D`, texto y borde oscuros `#12211A`, radios de 3 px y sombra sólida diagonal. El CTA principal usa borde de 2,5 px, sombra de 6 px y tipografía Archivo de peso 800; al pulsar se desplaza hacia la sombra y la elimina, con transición de 90 ms.

**Adaptación para Matchply:** conservar esa sensación física con borde definido, sombra sólida y pulsación breve. Usar nuestros colores, radio de 8 px y sombras de 2–4 px. La landing admite más relieve; el editor necesita controles tranquilos. No trasladar automáticamente la tipografía, el lima ni el tamaño del CTA de marketing a todo el producto.

### Referencia complementaria: Codex Resets

Inspección visual del tema oscuro y del botón de reacción de [Codex Resets](https://codex-resets.com/), realizada el 12/09/2026. Combina fondo oscuro cálido, texto crema, acentos mostaza, rosa y azul, contornos visibles y sombras duras. Los títulos redondeados, controles pill y paneles con esquinas suaves aportan un carácter más lúdico. El botón de reacción inspeccionado usa Baloo 2 de peso 800, radio de 10 px, borde de 2 px y sombra sólida de 2 px. El dato principal destaca por tamaño y una banda de color; la textura de puntos queda en segundo plano.

**Lectura conjunta de las preferencias:** las dos referencias apuntan a superficies con contorno, botones que parecen pulsables y personalidad tipográfica. Para Matchply, adoptar un diseño con relieve moderado y formas amables.

| Aplicación en Matchply | Decisión |
|---|---|
| Landing y onboarding | Más personalidad en un CTA y una demostración; textura de puntos opcional y tenue en el marco exterior, nunca sobre texto o la hoja del CV. |
| Dashboard | Tarjetas claras, títulos reconocibles y dato prioritario por tamaño. Tintes semánticos en estados concretos, evitando colorear cada estadística de forma arbitraria. |
| Botones | Mantener radio 8 px y relieve 2–4 px de esta guía. Reservar pill para filtros; no mezclar varias geometrías de CTA. |
| Editor y revisión | Controles compactos y superficies tranquilas; concentrar el carácter visual en la acción dominante. |
| Tipografía y color | Mantener Outfit/Inter y verde/púrpura. No incorporar una tercera fuente ni acentos mostaza, rosa y azul meramente decorativos. |

Estas referencias orientan el acabado visual; no justifican añadir un calendario de actividad, gamificación o nuevas métricas al producto. La paleta semántica y los criterios de accesibilidad siguientes siguen siendo la norma.

## 3. Paleta semántica

La distribución 60–30–10 orienta la composición, no mide píxeles: predominan lienzos neutros; estructura y tipografía organizan; verde y púrpura comparten el acento. El texto medianoche no implica cubrir un 30 % de la pantalla con paneles oscuros.

Los nombres siguientes son **tokens objetivo todavía no implementados**.

### Superficies y texto

| Token | Claro | Oscuro | Función |
|---|---|---|---|
| `canvas` | `#FAFAFA` | `#0B0F19` | Fondo de la aplicación |
| `surface` | `#FFFFFF` | `#151B28` | Tarjetas, menús y diálogos |
| `surface-muted` | `#F1F3F5` | `#1F2937` | Áreas agrupadas, cabeceras de tabla |
| `text` | `#1E1B4B` | `#F3F4F6` | Texto principal |
| `text-muted` | `#596174` | `#94A3B8` | Ayuda, metadatos y placeholders |
| `border-subtle` | `#E2E5EB` | `#334155` | Separación decorativa |
| `border-control` | `#64748B` | `#94A3B8` | Límites necesarios para reconocer controles |
| `focus` | `#1E1B4B` | `#F3F4F6` | Foco de teclado con offset |

No usar `border-subtle` como única señal para identificar un campo. Evitar texto funcional con opacidades arbitrarias: el contraste depende del fondo real.

### Acciones y estados

| Token o rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `action` | `#2ECC71` | `#2ECC71` | Acción principal general |
| `on-action` | `#1E1B4B` | `#1E1B4B` | Texto e iconos sobre verde |
| `action-hover` | `#27AE60` | `#27AE60` | Hover verde con texto oscuro |
| `ai-accent` | `#8B5CF6` | `#A78BFA` | Identificación y detalles IA |
| `ai-action` | `#7C3AED` | `#A78BFA` | Botón IA dominante |
| `on-ai-action` | `#FFFFFF` | `#0B0F19` | Texto del botón IA |
| `ai-hover` | `#6D28D9` | `#C4B5FD` | Hover del botón IA |
| `ai-text` / `ai-surface` | `#6D28D9` / `#F5F3FF` | `#C4B5FD` / `#241B3D` | Ayuda y badges IA |
| `success-text` / `success-surface` | `#15803D` / `#F0FDF4` | `#86EFAC` / `#142B20` | Guardado o resultado confirmado |
| `warning-text` / `warning-surface` | `#92400E` / `#FFFBEB` | `#FCD34D` / `#302414` | Atención o límite próximo |
| `danger-text` / `danger-surface` | `#B91C1C` / `#FEF2F2` | `#FCA5A5` / `#341D24` | Error, rechazo o pérdida |
| `info-text` / `info-surface` | `#1D4ED8` / `#EFF6FF` | `#93C5FD` / `#18283E` | Información y proceso |
| `danger-action` / texto | `#B91C1C` / `#FFFFFF` | `#FCA5A5` / `#0B0F19` | Confirmación destructiva |

Acción y éxito comparten familia verde, pero el éxito se presenta como estado compacto con icono y texto, no como otro botón. Rojo, ámbar y azul son colores semánticos, no nuevos acentos decorativos. Para hover destructivo usar `#991B1B` con blanco en claro y `#FECACA` con `#0B0F19` en oscuro.

**Logo:** conservar las dos barras y el wordmark. Valores actuales: barras `#4E46E5` y `#8F84F8`, «match» medianoche y «ply» `#8F84F8`; en oscuro, barras y «ply» `#B4A9FB`, «match» blanco. Es la excepción de marca al púrpura funcional. No recolorear todo el menú para imitar el logo.

### Contraste comprobado

Ratios calculados con luminancia relativa sRGB y colores opacos: `(Lclaro + 0,05) / (Loscuro + 0,05)`. Se muestran redondeados a dos decimales; la evaluación usa el valor sin redondear.

| Texto / fondo | Ratio | Resultado para texto normal |
|---|---|---|
| Blanco / `#2ECC71` | 2,10:1 | No usar |
| `#1E1B4B` / `#2ECC71` | 7,61:1 | Válido |
| `#1E1B4B` / `#27AE60` | 5,56:1 | Válido en hover |
| Blanco / `#8B5CF6` | 4,23:1 | No usar en botones normales |
| Blanco / `#7C3AED` | 5,70:1 | Válido |
| `#0B0F19` / `#A78BFA` | 7,04:1 | Válido en oscuro |
| `#1E1B4B` / `#FAFAFA` | 15,32:1 | Válido |
| `#596174` / blanco | 6,20:1 | Válido |
| `#94A3B8` / `#1F2937` | 5,72:1 | Válido |

Objetivo AA: texto normal ≥4,5:1; texto grande ≥3:1. El verde necesita borde oscuro para delimitar claramente el botón sobre blanco. Revisar estados, overlays y gradientes sobre su fondo compuesto real. Estos cálculos no certifican la accesibilidad de toda la app. Referencias: [contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) y [contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## 4. Tipografía

**Outfit** para títulos y marca; **Inter** para cuerpo, formularios, tablas y botones. Ambas ya se cargan mediante `next/font`. Esta decisión sustituye las alternativas Satoshi/Plus Jakarta Sans y evita incorporar otra fuente sin necesidad.

| Elemento | Tamaño objetivo (base 16 px) | Peso | Interlineado |
|---|---|---|---|
| Hero de landing | `clamp(2.25rem, 5vw, 4rem)` | 700 | 1,1 |
| H1 de aplicación | `1.75rem` móvil / `2rem` escritorio | 600–700 | 1,2 |
| H2 de sección | `1.25rem` | 600 | 1,3 |
| H3 de tarjeta | `1rem` | 600 | 1,4 |
| Lectura e inputs | `1rem` | 400 | 1,5 |
| Controles y datos compactos | `0.875rem` | 500–600 | 1,4 |
| Ayuda y badges | `0.75rem` mínimo | 500–600 | 1,4 |

Usar 16 px en inputs móviles; evitar badges de 9–10 px y pesos ultraligeros en información útil. Botones dominantes: Inter 600–700. Reservar mayúsculas para siglas. Limitar lectura continua a unas 65–75 letras por línea. La UI no impone fuentes ni tamaños al PDF: el CV conserva los ajustes y medidas de su plantilla.

## 5. Botones: carácter y jerarquía

### Anatomía y variantes

- Radio 8 px; altura mínima 44 px en la app y 52 px en CTA de landing. Permitir crecer o envolver texto traducido.
- Padding horizontal 16–20 px; 24–32 px en landing. Gap icono/texto 8 px.
- Lucide de 16–20 px, `strokeWidth={1.75}`. `Sparkles` identifica acciones que ejecutan IA.
- Dominante: borde de 2 px y sombra sólida diagonal de 2 px en la app; 4 px en landing.
- Secundario: borde de 1 px y sin sombra sólida. Toolbar plana. Dejar espacio para no recortar sombras.

| Variante | Tratamiento | Ejemplos |
|---|---|---|
| Principal general | Verde + medianoche; borde y sombra medianoche | Crear CV, guardar candidatura, empezar desde landing |
| Principal IA | `ai-action` + `on-ai-action`; borde/sombra `#4C1D95` en claro y `#0B0F19` en oscuro | Adaptar CV a esta oferta |
| Secundario | Superficie neutra, texto principal, `border-control` | Importar, descargar mientras se edita, cancelar |
| IA secundario | `ai-surface`, `ai-text`, borde del mismo color de texto | Abrir opciones IA cuando otra acción domina |
| Neutro fuerte | Medianoche/blanco en claro; fondo claro/texto oscuro en oscuro | Acción administrativa sin semántica de éxito |
| Ghost | Sin borde ni sombra; fondo neutro visible en hover | Volver, editar título, abrir menú |
| Destructivo | Rojo semántico, sin relieve promocional | Eliminar CV en diálogo de confirmación |

**Prioridad:** en el panel de optimización domina IA; guardar/cancelar son secundarios. En revisión, «Aplicar cambios» puede ser verde dominante porque confirma la decisión del usuario. En exportación, «Descargar PDF» puede ser dominante. El color indica función; el relieve indica prioridad.

Un CTA que navega al registro puede ser verde («Empezar con mi CV»). Una acción que ejecuta optimización usa IA. «Ver CV optimizado» es navegación y no necesita púrpura. El borde degradado heredado deja de ser obligatorio: el color y Sparkles ya identifican IA; no acumular gradiente, glow, shimmer y sombra sólida.

### Estados

| Estado | Comportamiento |
|---|---|
| Reposo | Texto legible, borde definido y sombra según jerarquía |
| Hover | Color hover; trasladar 1 px hacia la sombra y reducirla 1 px, solo en dispositivos con hover |
| Pulsado | Trasladar hasta la sombra (2 o 4 px) y eliminarla, sin cambiar el espacio del layout |
| Foco | Outline de 3 px con offset de 3 px, visible sobre la superficie |
| Cargando | Conservar ancho, progreso y etiqueta concreta; `aria-busy`; bloquear envíos duplicados |
| Deshabilitado | Fondo neutro, sin relieve ni movimiento; explicar el motivo cuando sea necesario |
| Error | Mensaje próximo y reintento; conservar datos |

Transiciones específicas de 120–160 ms para color, transform y shadow. No `transition: all`, pulsos perpetuos, shimmer continuo ni escalado que deforme texto. Con movimiento reducido, eliminar desplazamientos y animación manteniendo feedback de color, borde y etiqueta.

### Receta CSS de referencia

Ejemplo del botón general con relieve y su variante IA. **No está aplicado a la app.**

```css
.btn-raised {
  --btn-bg: #2ecc71;
  --btn-hover: #27ae60;
  --btn-fg: #1e1b4b;
  --btn-edge: #1e1b4b;
  --btn-focus: #1e1b4b;
  --depth: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 20px;
  border: 2px solid var(--btn-edge);
  border-radius: 8px;
  background: var(--btn-bg);
  color: var(--btn-fg);
  font-family: var(--font-sans), Inter, system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  box-shadow: var(--depth) var(--depth) 0 var(--btn-edge);
  cursor: pointer;
  transition: background-color 140ms ease, transform 140ms ease,
    box-shadow 140ms ease;
}
.btn-raised--hero { --depth: 4px; min-height: 52px; }
.btn-raised--ai {
  --btn-bg: #7c3aed;
  --btn-hover: #6d28d9;
  --btn-fg: #fff;
  --btn-edge: #4c1d95;
}
.dark .btn-raised { --btn-focus: #f3f4f6; }
.dark .btn-raised--ai {
  --btn-bg: #a78bfa;
  --btn-hover: #c4b5fd;
  --btn-fg: #0b0f19;
  --btn-edge: #0b0f19;
}
@media (hover: hover) {
  .btn-raised:not(:disabled):not([aria-disabled="true"]):hover {
    background: var(--btn-hover);
    transform: translate(1px, 1px);
    box-shadow: calc(var(--depth) - 1px) calc(var(--depth) - 1px)
      0 var(--btn-edge);
  }
}
.btn-raised:not(:disabled):not([aria-disabled="true"]):active {
  transform: translate(var(--depth), var(--depth));
  box-shadow: none;
}
.btn-raised:focus-visible {
  outline: 3px solid var(--btn-focus);
  outline-offset: 3px;
}
.btn-raised:disabled, .btn-raised[aria-disabled="true"] {
  background: #e2e5eb;
  color: #596174;
  border-color: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}
.dark .btn-raised:disabled, .dark .btn-raised[aria-disabled="true"] {
  background: #1f2937;
  color: #94a3b8;
  border-color: #64748b;
}
@media (prefers-reduced-motion: reduce) {
  .btn-raised { transition: none; }
  .btn-raised:not(:disabled):not([aria-disabled="true"]):is(:hover, :active) {
    transform: none;
  }
}
```

Usar `<button>` para acciones y enlaces para navegación. `aria-disabled` solo informa: el componente debe impedir activación por clic y teclado. Durante peticiones conservar el foco y anunciar progreso sin repetir mensajes continuamente. Los botones de solo icono necesitan nombre accesible; no basta un tooltip.

## 6. Geometría, retícula y superficies

Escala: **4, 8, 12, 16, 24, 32, 48, 64, 96 px**. Ritmo principal de 8 px con paso de 4 px para controles compactos.

| Elemento | Regla |
|---|---|
| Contenido general | Máximo 1280 px; márgenes laterales 16/24/32 px según espacio |
| Header / sidebar | Referencias 64 px / 256 px; adaptar a contenido y zoom |
| Tarjetas | Radio 12 px, padding 24 px escritorio / 16 px móvil |
| Diálogos | Radio 16 px, padding 24 px; ocupar pantalla útil en móvil |
| Inputs / botones | Radio 8 px, altura mínima 44 px |
| Badge | Radio 6 px; pill para filtros o etiquetas compactas |
| Formularios | Gap 16 px entre campos, 24–32 px entre grupos |
| Kanban | Gap 24–32 px escritorio, 16 px móvil; 12–16 px entre tarjetas |
| Sombra de tarjeta | `0 2px 8px rgba(30,27,75,0.04)` en claro; borde prioritario en oscuro |
| Sombra de diálogo | `0 16px 48px rgba(11,15,25,0.18)` en claro; overlay oscuro en ambos temas |

Las tarjetas no interactivas no se elevan en hover. Vidrio translúcido solo en cabecera flotante si conserva contraste; editor, formularios, tablas y menús con fondos sólidos. Gradientes y luces decorativas son opcionales y discretos en marketing.

## 7. Patrones de producto

### Landing y autenticación

Promesa concreta, un CTA principal y demostración comprensible de «CV original → oferta → cambios → PDF». Ejemplos legibles y etiquetados como demostración. Priorizar una vista estática clara sobre un carrusel 3D automático. El catálogo muestra las plantillas realmente disponibles, sin fijar el número histórico de cinco.

Login/registro: formulario centrado, etiquetas persistentes, autocompletado y errores junto al campo. Google conserva su identidad en un botón secundario. El fondo acompaña sin competir.

### Dashboard y navegación

Priorizar «Mis CVs», «Candidaturas» y «Ajustes», conservando acceso a integraciones y facturación dentro de la arquitectura existente. No eliminar funciones para forzar tres enlaces. Activo con superficie neutra, peso y `aria-current`; no púrpura por defecto.

Cada CV muestra nombre, actualización y estado relevante. «Principal» utiliza badge neutro e icono; acciones secundarias en menú accesible. Estado vacío con explicación y una acción útil. Estadísticas subordinadas al trabajo.

### Optimización y revisión

1. Elegir CV y pegar/importar oferta. Identificar puesto y empresa cuando estén disponibles.
2. Explicar alcance del modo, conservando hechos y experiencia. Los modos usan radios, descripción y selección visible; no tres colores de alarma.
3. Mostrar consumo de cuota conocido antes de ejecutar y botón IA dominante.
4. Informar del estado real. No simular porcentajes ni etapas que el backend no proporciona; no tapar todo el CV con un velo que impida leerlo.
5. Comparar original y propuesta. Añadidos con verde y «+»; eliminados con rojo y «−», además de descripción textual.
6. Aplicar o descartar y volver al original. Ante error, conservar CV/oferta y ofrecer reintento.

El barrido púrpura heredado pasa a ser opcional y breve dentro del progreso. Un spinner con etiqueta clara es válido. Un resultado IA no equivale a una mejora verificada; no mostrar éxito antes de terminar la operación correspondiente.

### Editor y PDF

Escritorio: editor y vista previa con divisor ajustable y alternativa de teclado. Móvil: pestañas «Editar» / «Vista previa», sin comprimir ambos paneles. Agrupar formato, plantilla, fuente, escala, margen y acento; plegar controles avanzados.

Toolbar neutra, sin relieve en cada icono. Markdown sobrio: no reutilizar púrpura IA para cualquier encabezado. Mostrar «Guardando…», «Guardado» o error real de persistencia.

Hoja PDF blanca también en oscuro, proporciones A4 y estilos propios de plantilla. El tema de UI nunca recolorea el documento exportado. Zoom accesible, carga neutral, recuperación de errores y consistencia entre vista previa y PDF. Renderizar PDF no es por sí mismo una operación IA.

### Candidaturas / Kanban

| Estado visual | Familia | Señal adicional |
|---|---|---|
| Interesado / pendiente | Neutra | Nombre y contador |
| Postulado | Azul información | Etiqueta |
| Entrevista | Ámbar | Fecha cuando exista |
| Oferta conseguida | Verde éxito | Etiqueta e icono |
| Rechazado | Rojo suave | Etiqueta; evitar apariencia de error del sistema |

Son etiquetas de presentación: no cambiar valores persistidos por una decisión visual. Plataforma de origen con badge corporativo compacto (LinkedIn, InfoJobs, Indeed), separado del estado.

Arrastre con elevación moderada y destino delimitado. Rotación opcional hasta 1 grado; sin animación con movimiento reducido. Acción «Mover a…» como alternativa a arrastrar. En móvil, selector de estado/lista o scroll interno del tablero, sin desbordar toda la página.

### Ajustes, suscripción, integraciones y administración

Formularios y tablas con la misma semántica. Facturación y Pro neutros, precio y límites legibles; sin tercer sistema de gradientes dorados. Púrpura en prestaciones IA concretas, no por pagar.

Agrupar ajustes e integraciones por propósito con feedback próximo al control. Administración: filtros etiquetados, tablas legibles, acciones destructivas separadas y prompts monoespaciados. Roles y planes identificados con texto.

### Componentes transversales

- Inputs: label visible, placeholder orientativo, ayuda/error asociado; borde identificable y foco consistente.
- Alertas: icono, mensaje claro y acción contextual; sin un glow o gradiente distinto para cada tipo.
- Modales/drawers: foco contenido, cierre accesible, retorno al activador; proteger datos sin guardar cuando corresponda.
- Tooltips complementarios, nunca único acceso a información esencial. Menús utilizables con teclado.
- Scrollbars: respetar el sistema cuando sea posible; no ocultar scroll ni reducir interacción por estética.
- Skeleton solo si anticipa estructura; no fingir contenido ni éxito. Errores de red no vacían formularios.

## 8. Tema, iconos y movimiento

**Tema:** `:root` claro y `.dark` oscuro. Preferencia guardada primero; después sistema; claro como fallback. Mantener sincronización antes de hidratación. Body, portales y controles consumen los mismos tokens.

**Iconos:** exclusivamente `lucide-react`, trazo 1,75; 16 px en controles, 20 px en navegación y 24 px en encabezados. Decorativos con `aria-hidden`. Excepciones: logo propio y marcas de proveedores. Se retira la alternativa Phosphor.

**Movimiento:** botones 120–160 ms; paneles 180–240 ms con opacidad y pequeño desplazamiento. Cambio de CV con fade breve y foco conservado. Animaciones de folio, Sparkles y columnas son opcionales, no requisitos para lanzar un componente.

Respetar `prefers-reduced-motion` en CSS **y** Framer Motion/canvas. La protección global CSS existente no garantiza detener animaciones JavaScript. Evitar partículas, pulsos y rotaciones infinitas en el espacio de trabajo.

## 9. Accesibilidad y adaptación

- Objetivo del proyecto: controles táctiles ≥44 × 44 px. No confundirlo con el mínimo AA de 24 × 24 px y sus excepciones de [WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Texto, iconos funcionales y límites necesarios de controles con contraste suficiente. Bordes puramente decorativos tienen otra función.
- Acciones completas por teclado, foco visible y orden lógico. No quitar outline sin sustituto.
- Comprobar 320, 375, 768, 1024 y 1440 px; zoom al 200 % y reflujo al equivalente de 320 CSS px. Tablas/documentos bidimensionales pueden tener scroll local.
- Verificar español e inglés con textos largos, sin truncar CTA, errores o precios.
- No comunicar selección, éxito, candidatura o diferencias solo mediante color.
- Anunciar guardado, carga y resultado IA oportunamente sin saturar al lector de pantalla.
- Mantener contenido y acciones con movimiento reducido y ambos temas.

## 10. Inventario consolidado y estado de implementación

### Procedencia documental

| Origen | Contenido incorporado | Destino |
|---|---|---|
| `design.md` anterior | Identidad, paleta, escala, iconos y microinteracciones | Secciones 1–9 revisadas |
| `notes.md` | Tokens, clases, componentes, efectos y dependencias | Diagnóstico, reglas e inventario técnico |
| `desing_notes.md` | Brief y copia del plan visual | Dirección, patrones y migración |
| `IMPLEMENTATION_PLAN.md` | Plan visual por áreas y verificaciones | Sección 11 actualizada |
| `AGENTS.md`, apartado 8 | Resumen de reglas visuales | Referencia a esta guía |

Se revisaron también README, integraciones/Stripe y especificaciones de `docs/`: no constituyen guías visuales adicionales. Sus requisitos funcionales permanecen en origen. La documentación técnica y borradores previos quedaron unificados y consolidados en este documento.

### Código observado el 12/09/2026

| Fuente | Observación y destino |
|---|---|
| `tailwind.config.ts` | Tema por clase, colores HSL variables, Inter/Outfit y radios 12/10/8 px. Conservar mecanismo y completar semántica. |
| `src/app/globals.css` | `:root` oscuro; glass, glow, scrollbars, float, pulse y shimmer. Corregir temas y revisar consumidores antes de retirar utilidades. |
| `src/app/layout.tsx` | Carga fuentes y sincroniza tema, pero fuerza body oscuro. Preservar sincronización y corregir fondo. |
| `src/components/ui/Logo.tsx` | Dos barras; `notes.md` atribuía otro púrpura a «ply». Aquí se recoge el real `#8F84F8`. |
| `src/components/ui/ThemeToggle.tsx` | Clase y localStorage con preferencia del sistema. Alinear con tokens. |
| `src/components/landing/LandingPageClient.tsx` | CTA verde/blanco, botones locales y animaciones. Priorizar contraste y variantes compartidas. |
| `src/components/ui/` | AlertModal, LanguageToggle, Logo y ThemeToggle; no hay Button compartido en esta revisión. Crearlo al implementar. |

### Recursos heredados de las notas

Inventario para localizar y decidir migración, **no reglas vigentes** ni evidencia de que todos sus consumidores sigan activos.

| Familia inventariada | Tratamiento objetivo |
|---|---|
| Variables background/foreground, muted, popover, card, border/input, primary/secondary/accent, destructive y ring | Mapear toda la semántica en ambos temas; separar IA de primary. |
| Clases hex directas, tarjetas blancas/pizarra y texto con opacidad | Migrar a tokens y validar capas compuestas. |
| Gradientes hero verde–púrpura, upgrade ámbar–naranja e idioma púrpura–medianoche | Hero con jerarquía clara; upgrade/idioma neutros. |
| Glass-card, glass-nav, glass-nav-ios y overlays blur | Sólidos por defecto; blur opcional cuando aporta contexto y legibilidad. |
| Glow-primary/accent, hover glow y partículas púrpura/verde | Retirar del workspace; marketing opcional y limitado. |
| Float, pulse-subtle, hover-shimmer-btn y entrada de texto | Feedback breve; unificar las dos definiciones divergentes de pulse. |
| Accordion down/up, springs y stagger Framer Motion | Conservar lo que explique estados y respete movimiento reducido. |
| Perspective, preserve-3d, backface, rotate-y y radios de carrusel 350/260/190/130 px | Inventario del carrusel anterior, no nueva retícula. |
| Editor-scrollbar y scrollbar-custom, 6 px y thumbs translúcidos | Simplificar duplicación y revisar accesibilidad. |
| AlertModal success/warning/danger/info; badges Pro/plataforma/IA | Aplicar estados comunes sin colores ad hoc. |
| Tarjetas estándar/hover/arrastre, inputs con icono y overlays de carga | Aplicar secciones 5–9. |
| Dependencias | Tailwind/PostCSS/Autoprefixer, Framer Motion, Lucide, clsx, tailwind-merge, DnD e Intersection Observer. Versiones en package.json/lockfile, no duplicadas aquí. |

## 11. Plan de aplicación y aceptación

**Pendiente de implementación.** No interpretar esta tabla como tareas completadas.

| Orden | Trabajo | Criterio de aceptación |
|---|---|---|
| 1 | Tokens, Tailwind y body del layout | Temas coherentes en página/portales; fuentes y radios alineados. |
| 2 | Button compartido y controles base | Variantes, teclado, foco, carga, deshabilitado, contraste y movimiento reducido. |
| 3 | Landing y autenticación | CTA con relieve moderado, narrativa CV y formularios legibles. |
| 4 | Dashboard, optimización y editor | CV → oferta → revisión → PDF claro; original conservado y estados reales. |
| 5 | Kanban, ajustes, suscripción, integraciones y admin | Semántica común, alternativa a drag y controles consistentes. |
| 6 | Retirar estilos heredados y QA | Sin referencias a utilidades retiradas; verificación visual y funcional. |

Al implementar: ejecutar lint, typecheck y build según alcance; validar ambos temas y tamaños. Probar crear/importar CV, optimizar con éxito/error, revisar/aplicar/descartar, guardar, cambiar candidatura y exportar. Comparar PDF antes/después para comprobar que el tema UI no lo altera. Un build correcto no demuestra coherencia visual.

Para esta revisión documental: comprobar enlaces locales, tokens y contrastes declarados, eliminación de guías activas duplicadas y ausencia de cambios de código de aplicación.
