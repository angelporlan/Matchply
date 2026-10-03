# Expectativas comprobables

| ID | Expectativa | Verificación |
|---|---|---|
| P01 | Gratis tiene CRM, networking y extensión; invitado no. Research/API siguen PRO. | `people.test.ts`, permisos centrales, Integraciones |
| P02 | Mismo perfil en dos usuarios mantiene fichas e historial independientes. | integración: propiedad y FKs compuestas |
| P03 | Varios vínculos empresa/oferta, agencia separada del cliente. | integración: vínculos recruits_for/works_at y ajenos rechazados |
| P04 | Listado 25 + filtros, sin grandes campos privados. | integración paginación/proyección, navegador/RSC |
| P05 | Original literal, preview, autores/fechas editables; solo selección confirmada. | unidad offsets + integración worker + navegador |
| P06 | Importación idéntica y confirmación concurrente no duplican; «Gracias» legítimos sobreviven. | unidad solapamientos + integración confirmación |
| P07 | Asistente funciona sin CV, salida validada y cambios marcan desactualizado. | integración mock Responses; UI real con Luna |
| P08 | Idempotencia, un activo/persona, errores, reintentos y leases. | integración peticiones simultáneas, keys JSONB, clave ausente, salida inválida, lease obsoleto |
| P09 | Borrado durante IA impide publicación; cascadas correctas. | integración con borrado entre fetch y publicación |
| P10 | Captura posterior conserva informe/puntuación/cartas; legacy sin people válido; cero llamadas IA. | integración servicio/ingesta y extractor DOM |
| P11 | Solo tarjetas/modal visible, sin perfiles implícitos del resumen ni acciones automáticas. | fixtures DOM, revisión de content/background |
| P12 | Teclado, móvil, es/en, claro/oscuro. | revisión de tabs y etiquetas, navegador con viewport |

Invariantes: ninguna referencia ajena aceptada; nunca secretos o texto de chats en logs; original intacto ante errores; cola no copia texto; resultado solo publicado con persona y lease vigentes. No envío automático de mensajes. Captura opcional desactivada inicialmente.
