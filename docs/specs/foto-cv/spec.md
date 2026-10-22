# Foto opcional en el CV

Solicitud autorizada el 22 de octubre de 2026. Implementación local.

- REQ-01: todos los CVs existentes y nuevos MUST empezar sin foto (`showPhoto=false`). El editor MUST permitir activarla y ocultarla por documento.
- REQ-02: al activar, MUST usar la foto de la cuenta. El usuario MUST poder cambiarla por una imagen descargada desde el propio CV al pasar el cursor, tocar o enfocar con teclado. La imagen personalizada MUST pertenecer solo a ese CV, sin alterar la cuenta. MUST poder volver a la foto de la cuenta.
- REQ-03: la cabecera con foto MUST mostrar retrato rectangular a la izquierda, nombre y contactos a la derecha y separador debajo, con medidas compartidas entre hoja y PDF. Nombres/contactos largos MUST envolver sin solaparse con la foto. Sin foto MUST conservarse la cabecera actual.
- REQ-04: la opción y la imagen MUST persistir al recargar y afectar preview, descarga y caché. La imagen MUST NOT incorporarse al Markdown, a prompts ni a listados.
- INV-01: solo el propietario efectivo MUST poder consultar imágenes y solo un CV editable y sin generación en curso MUST permitir cambios. Subida acotada, JPEG validado y metadatos eliminados por canvas; no se admiten URLs arbitrarias. Las fotos de Google solo se descargan del host HTTPS permitido, sin redirecciones ni cookies y con tamaño/tiempo acotados.

Decisiones: foto de cuenta como fuente predeterminada y sustitución independiente confirmadas por el usuario. Si no hay foto disponible, se ofrece subirla; no se inserta un hueco en el PDF. Activar o subir una imagen es una decisión explícita del usuario. Las nuevas copias/adaptaciones conservan el valor predeterminado sin foto hasta activarlo. No se modifica producción.
