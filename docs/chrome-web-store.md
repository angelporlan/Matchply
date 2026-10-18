# Publicar Matchply LinkedIn Capture

Estado a 18/10/2026: paquete 2.3.14 preparado localmente; pendiente de cuenta de desarrollador, despliegue de la política de privacidad, materiales de ficha y revisión de Google. No se ha subido ni publicado. El PR hacia `main` queda pendiente de la publicación solicitada.

## Paquete

```bash
npm run extension:package
# build/chrome-extension/matchply-linkedin-2.3.14-store.zip
```

El ZIP lleva el manifest en la raíz, los scripts, el popup y los iconos PNG. Una lista explícita de archivos excluye secretos, documentación y dependencias. Usa únicamente `https://matchply.com` como API y no solicita permisos para localhost. No requiere claves de firma propias para la subida a la tienda.

Para desarrollo, sin cambiar los fuentes ni el paquete de la tienda:

```bash
npm run extension:package -- --dev
# Cargar build/chrome-extension/dev desde chrome://extensions → Cargar descomprimida.
# Esta variante usa http://localhost:3000, con su permiso específico.
```

No vincular cuentas de producción en la variante local. La instalación de la tienda y la de desarrollo mantienen sesiones independientes.

## Pasos de publicación

1. El titular debe [registrar la cuenta de desarrollador](https://developer.chrome.com/docs/webstore/register), aceptar el acuerdo y pagar la cuota que indique Google. Estos pasos quedan a cargo del titular.
2. Desplegar y comprobar la política pública `https://matchply.com/privacy/extension`, añadida en esta rama. Revisarla como responsable del servicio antes de declararla en la ficha. La URL debe funcionar públicamente antes de enviar a revisión; preparar código local no equivale a desplegarlo.
3. En el [panel de desarrollador](https://chrome.google.com/webstore/devconsole), crear un elemento y subir el ZIP `store`. Copiar el ID real asignado al elemento.
4. Completar ficha, privacidad, distribución e instrucciones de prueba con los textos de abajo. Aportar al menos una captura real de la extensión (1280 × 800 o 640 × 400) y una imagen promocional pequeña (440 × 280). No usar capturas con ofertas privadas, contactos reales o códigos de vinculación. Los iconos 16/32/48/128 ya están dentro del ZIP; `chrome-extension/icon.svg` es su fuente vectorial basada en el logo existente.
5. Probar el ZIP de producción con una cuenta de prueba de Matchply: vincular, guardar una oferta, capturar visibles, revisar que no duplica, desconectar y revocar. Revisar también el comportamiento de «Capturar personas» si se declara esa opción.
6. Enviar a revisión y esperar el resultado. Subir un ZIP no significa que la extensión esté publicada. Si se usa publicación diferida, publicarla tras la aprobación.
7. Cuando la ficha sea pública, configurar `CHROME_EXTENSION_STORE_URL` con `https://chromewebstore.google.com/detail/<nombre>/<ID_REAL>` en el entorno del servidor y recrear el contenedor web para cargarla. Se lee en el servidor al abrir Candidaturas, sin necesitar recompilar la imagen. La guía solo muestra «Instalar en Chrome» si recibe una URL válida de un elemento de la tienda; mientras falta, explica que la instalación estará disponible tras la publicación. Después preparar el PR hacia `main`.

## Texto de la ficha (español)

**Nombre:** Matchply LinkedIn Capture

**Descripción breve:** Captura ofertas en LinkedIn y las envía a tu cuenta de Matchply.

**Descripción completa:**

Guarda las ofertas que te interesan mientras buscas empleo en LinkedIn y organízalas en Matchply.

- Guarda una oferta abierta en modo automático o manual.
- Usa «Capturar visibles» para importar hasta 25 ofertas ya cargadas en una búsqueda, sin abrirlas una por una. La extensión intenta completar sus descripciones a través de páginas públicas de LinkedIn. Las descripciones no disponibles pueden completarse al abrir la oferta.
- Conserva puesto, empresa, enlace, ubicación y los detalles disponibles de la oferta.
- Actualiza las ofertas que ya guardaste sin crear duplicados.
- Si lo activas expresamente, guarda contactos y fotos disponibles en el contexto de la oferta. La opción está apagada al inicio e incluye un aviso sobre las restricciones de LinkedIn.
- Elige el tiempo de lectura y dónde ver los indicadores de captura, o apaga la extensión.

Necesitas una cuenta de Matchply. Genera un código en Ajustes → Integraciones → Extensión de LinkedIn e introdúcelo en el popup. La captura está disponible para todas las cuentas registradas. Las funciones avanzadas de IA del servicio pueden requerir PRO y están sujetas a sus cuotas.

La extensión guarda ofertas para que tú decidas cuáles seguir; no presenta solicitudes ni envía mensajes a empresas. No está afiliada a LinkedIn ni cuenta con su respaldo. La disponibilidad de los datos depende de LinkedIn y de su interfaz.

**Web:** https://matchply.com

**Soporte:** matchplyapp@gmail.com

**Política de privacidad:** https://matchply.com/privacy/extension (verificar desplegada antes de enviar).

## Propósito y justificación de permisos

**Propósito único:** guardar y organizar en la cuenta de Matchply del usuario los empleos de LinkedIn que consulta o selecciona, incluidos los contactos de la oferta si habilita esa opción.

| Permiso | Justificación |
| --- | --- |
| `storage` | Guardar localmente la sesión de extensión, preferencias y marcadores que evitan capturas repetidas. |
| `activeTab` | Identificar la pestaña activa de LinkedIn cuando el usuario captura desde el popup. |
| `scripting` | Activar o recuperar los scripts locales de captura y sus indicadores en las pestañas de LinkedIn, también tras una actualización. No descarga código ejecutable remoto. |
| `https://matchply.com/*` | Canjear el código de vinculación, consultar el estado y guardar ofertas y contactos autorizados en la cuenta del usuario. |
| `https://*.linkedin.com/*`, `https://linkedin.com/*` | Detectar navegación a Empleos, leer los datos disponibles, mostrar controles y consultar descripciones públicas. El script necesita observar navegación interna desde otras páginas de LinkedIn; fuera de Empleos no monta el widget ni captura ofertas. |
| `https://*.licdn.com/*` | Descargar las fotos disponibles de contactos solo si el usuario activa «Capturar personas», reducirlas localmente y subirlas a su cuenta privada de Matchply. |

## Declaración de datos para revisar al rellenar el panel

La declaración debe coincidir con la política y el código publicado. Hay datos personales si el usuario habilita contactos (nombre, URL de perfil, titular, relación con la oferta y foto), información de autenticación propia de Matchply (token de extensión), contenido de páginas/ofertas y sus URLs. Se transmite actividad de captura y versión/estado de la instalación a Matchply para operar la integración; no declarar «no se recogen datos». No se leen contraseñas, cookies de LinkedIn, pagos, salud, mensajes privados ni historial general del navegador. El permiso de host no equivale a recopilar toda la navegación.

La extensión no ejecuta código remoto: los scripts se incluyen en el ZIP. Las peticiones de descripciones públicas obtienen HTML como datos para extraer texto, sin ejecutarlo. No incorpora analítica ni publicidad de terceros. Revisar las categorías exactas que presente Google y declarar las finalidades reales de cada dato, sin marcar certificaciones que el titular no haya revisado.

## Instrucciones de prueba para Google

Preparar una cuenta de prueba de Matchply sin datos reales y proporcionar sus credenciales únicamente en el campo privado de instrucciones del panel, nunca en este repositorio. Una cuenta gratuita permite probar la captura.

1. Iniciar sesión en Matchply con la cuenta de prueba.
2. Ir a Ajustes → Integraciones y generar un código temporal. Es de un uso y caduca en 10 minutos; no proporcionar un código fijo en las instrucciones.
3. Abrir el popup, introducir ese código y pulsar «Conectar extensión».
4. En una pestaña de LinkedIn, abrir Empleos, buscar un puesto y abrir una oferta. Probar el modo manual y «Guardar oferta ahora».
5. Volver a Candidaturas en Matchply, recargar y comprobar puesto, empresa, enlace y descripción disponible.
6. En una búsqueda, usar «Capturar visibles». Comprobar nuevas ofertas y repetir para verificar que actualiza sin duplicar.
7. Mantener «Capturar personas» apagado salvo que se pruebe expresamente esa opción; leer su aviso antes de activarla.
8. Desconectar en el popup y revocar la instalación desde Integraciones.

## Verificación local

```bash
node --import tsx --test scripts/chrome-extension-package.test.ts scripts/people-extension.test.ts scripts/extension-presence.test.ts scripts/public-description.test.ts
npm run typecheck
npm run lint
```

La prueba del paquete comprueba los dos destinos, el manifest en la raíz, los iconos PNG y sus dimensiones, los recursos necesarios y la ausencia de servidores locales en la versión de tienda. Estas comprobaciones no sustituyen la prueba con Chrome ni acreditan aprobación de Google.

Resultado local (18/10/2026): 25 pruebas específicas pasaron; TypeScript y lint de los archivos modificados pasaron. La suite general pasó 409 pruebas, omitió 17 integraciones y falló una prueba de timeout porque el sandbox impedía abrir su puerto local; esa prueba pasó al repetirla con permiso para abrir el puerto (410 pruebas correctas en total). El lint general conserva advertencias de hooks en archivos no modificados. La guía se comprobó en una vista aislada del componente real, sin datos de cuenta: apertura, cierre con Escape, foco devuelto al icono, contención del foco y lectura sin desbordamiento horizontal a 375 px, además de escritorio a 1440 px. No se probó la vinculación real del ZIP de producción ni su instalación desde la tienda.

Fuentes oficiales: [publicación](https://developer.chrome.com/docs/webstore/publish), [imágenes](https://developer.chrome.com/docs/webstore/images), [privacidad](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
