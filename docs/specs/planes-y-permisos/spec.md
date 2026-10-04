# Planes, cuotas y paywall

Estado: implementación local autorizada en esta conversación. Revisión: 4 de octubre de 2026. No implica un despliegue ni una comprobación de producción.

## Resultado esperado

Una sola configuración persistida gobierna Free, Pro, workers, APIs y textos de límites. El administrador puede editar límites y copy desde `/admin/plans`; cada publicación incrementa la versión, conserva historial y registra actor y cambio. Los clientes muestran consumo usado, reservado, disponible y fecha real de renovación.

## Valores iniciales

| Capacidad | Free | Pro |
| --- | --- | --- |
| CVs guardados | 3: 1 base y 2 adaptados | Sin límite de plan |
| Acciones generales de IA | 10/mes | 200/mes |
| Matching | 10 ofertas/mes | 300 ofertas/mes |
| Ofertas por lote | 1 | 50 |
| Investigación profunda | 0 | 10/mes |
| Claves API activas | 0 | 3 |
| Peticiones API por minuto y cuenta | 0 | 60 |

Estos números son predeterminados; la configuración publicada es la fuente de verdad. El administrador puede cambiar todos los límites de Free y Pro. Solo los tres límites de CV aceptan `null` (sin límite); los demás son enteros no negativos. Las capacidades de CV base y adaptado deben encajar en el máximo total. El invitado tiene cuota durante la vida de la sesión: 3 CV, 1 PDF, 10 acciones generales y 10 matching, sin renovación mensual ni API. Sus límites se conservan al publicar planes.

CRM de trabajos, empresas y personas; vistas, filtros, favoritos, columnas y exportaciones; extensión LinkedIn; PDF y Harvard permanecen disponibles en Free y Pro. Asistente de Personas usa la bolsa de IA. El modelo de IA continúa dependiendo de la configuración de proveedor/modelo, sin prometer que Pro utilice otro modelo.

## Cuotas y conservación

La bolsa general incluye adaptación e importación de CV, perfil, cartas, entrevistas y asistente de Personas. Cada acción completada consume una unidad; matching consume una unidad por oferta. Investigación tiene una bolsa separada. Una reserva reduce saldo mientras trabaja. Errores liberan reservas; un `requestId` repetido recupera la misma operación, sin otra unidad. Los límites se verifican en servidor antes de invocar IA y de encolar trabajo. Cambios de configuración no reinician consumo ni invalidan trabajo ya admitido.

Al agotar almacenamiento, la interfaz ofrece sustituir un documento editable concreto tras confirmación. Adaptar una oferta conserva el CV base. La API reserva cuota y destino juntas; publica el contenido cuando la generación termina. Un fallo conserva el contenido anterior y elimina solamente el destino pendiente creado por esa operación.

Al perder Pro no se borran CVs. Los permitidos siguen activos; el resto se consulta y descarga en modo lectura. El usuario puede elegir CV base y versiones activas. Servidor rechaza modificaciones directas sobre documentos de lectura. El rol admin concede acceso administrativo, sin exención comercial en su cuenta personal. Administrar planes exige administrador real y bloquea suplantación de soporte.

## Panel administrativo

El formulario permite editar Free/Pro, modo del paywall (`ab`, `a`, `b`, `paused`), versión del experimento y título, cuerpo y CTA en español e inglés para A y B. Previsualiza con límites Pro y precios validados del catálogo. Admite variables declaradas de cuotas, CVs y precios; no admite variables desconocidas en publicación.

Publicar exige la versión leída. Dos administradores publicando a la vez producen un éxito y un conflicto; el segundo conserva su borrador y recarga la nueva versión antes de reintentar. Cargar predeterminados o una versión histórica modifica el borrador y requiere publicar. Cambiar textos exige incrementar versión del experimento para mantener interpretables las cohortes. El panel muestra historial y métricas agregadas por variante: exposición, CTA, Checkout, prueba, activación pagada, conversión a 30 días y cohorte de pruebas maduras (14 días).

## Paywall y facturación

El usuario recibe copy A/B estable por usuario y versión después de obtener el primer CV generado/adaptado, con asignación persistente. Antes se permite consultar Pro con una CTA genérica. Modo pausado utiliza presentación genérica. Los avisos empiezan al consumir/reservar el 80 % de una bolsa; al agotarla el bloqueo muestra consumo y renovación. PDF y datos siguen accesibles.

`/dashboard/subscription` muestra límites publicados y catálogo verificado de Stripe. Mensual: 10 €/mes; anual: 96 €/año (20 %). Prueba Pro de 7 días una vez por cuenta elegible, con método de pago y términos de cobro visibles. Checkout se crea por POST con intervalo y UUID estable por intento. El retorno consulta `/api/stripe/status`, verifica propiedad y muestra pendiente hasta confirmación; una query de URL jamás registra conversión ni concede acceso. Detalles: [facturación](../../monetization-billing.md).

## Aceptación

| ID | Escenario | Resultado observable |
| --- | --- | --- |
| PL-01 | Admin publica límites válidos | Nueva versión, historial y auditoría; nueva operación web/worker lee esa versión. |
| PL-02 | Publicación con versión antigua | Conflicto, sin escritura y borrador conservado. |
| PL-03 | Free alcanza 10 acciones generales | Matching aún disponible; nueva acción general bloqueada con renovación. |
| PL-04 | Reserva última unidad concurrente | Solo una operación admitida. Reintento técnico recupera resultado. |
| PL-05 | Free adapta con 3 CV guardados | Selección explícita de una versión editable, conserva base y contenido si falla. |
| PL-06 | Pro baja a Free con 5 CV | Conserva 5; puede seleccionar los activos; restantes solo lectura y PDF. |
| PL-07 | Usuario con primer CV completado | CTA del paywall usa su variante y versión en ES/EN. |
| PL-08 | Checkout anual con prueba | Stripe conserva anual; retorno pendiente hasta estado verificado. |
| PL-09 | Prueba ya utilizada | No promete otra prueba; Checkout sin segundo trial. |
| PL-10 | Invitado registra cuenta | Conserva uso y asignación; no regenera una bolsa gratuita. |

Verificación automatizada: `scripts/plan-presentation.test.ts`, `scripts/plans-integration.test.ts`, `scripts/ai-usage-integration.test.ts` y pruebas de facturación. La integración de planes requiere `PLANS_TEST_DATABASE_URL` apuntando a una BD local aislada cuyo nombre contenga `test`. Revisión visual: admin/publicación y conflicto; selección de CV; bloqueo/aviso; tamaños móvil/escritorio; ES/EN; teclado y temas. Registrar evidencia realizada en `estado-actual.md`; no convertir expectativas en pruebas realizadas.
