# Suscripción, Checkout y portal de facturación — comportamiento deseado

Estado: **Borrador — pendiente de rellenar**  
Responsable: [POR DEFINIR]  
Fecha de revisión: [POR DEFINIR]  
Prioridad: [Imprescindible / Importante / Más adelante / Sin cambio]

Referencia: [lo que hace actualmente](estado-actual.md). Las observaciones ACT son una fotografía del código; no son requisitos aprobados.

Puedes empezar rellenando solo las secciones 1, 2 y 7. Escribe con tus palabras; el resto ayuda a concretar cuando lo necesites. Usa «No aplica» en vez de inventar una decisión. Ningún campo vacío implica aceptar el comportamiento actual.

## 1. Lo que quiero

**Quiero que esta funcionalidad…**

[ESCRIBE AQUÍ]

**El problema que quiero resolver y para quién:**

[ESCRIBE AQUÍ]

**Al terminar, la persona debe obtener/ver…**

[ESCRIBE AQUÍ]

## 2. Decisiones específicas de esta funcionalidad

**¿Qué precios, moneda, periodicidad, prueba y promociones quieres ofrecer?**

[ESCRIBE AQUÍ]

**¿Qué pasa ante impago, cancelación, reembolso y regreso a Gratis?**

[ESCRIBE AQUÍ]

**¿Qué impuestos y datos de facturación necesita el flujo, y qué debe poder gestionar el cliente en el portal?**

[ESCRIBE AQUÍ]

## 3. Qué conservar y qué cambiar

Consulta los puntos ACT de la ficha actual. Puedes mantener, modificar o eliminar cada comportamiento que sea relevante.

| Referencia actual o comportamiento | Mantener / Cambiar / Eliminar / Añadir | Mi decisión y motivo |
| --- | --- | --- |
| [ACT-… o descripción] | [POR DEFINIR] | [POR DEFINIR] |

**Lo que debe seguir funcionando siempre, incluso si hay errores:**

- INV-01: [POR DEFINIR]

**Lo que queda fuera de este cambio:**

[POR DEFINIR]

## 4. Quién puede usarlo y con qué límites

| Persona o plan | Puede verlo | Puede usarlo o modificarlo | Límite y qué ocurre al agotarlo |
| --- | --- | --- | --- |
| Visitante / invitado | [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |
| Usuario Gratis | [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |
| Usuario PRO | [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |
| Administrador / integración, si aplica | [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |

## 5. Cómo debe funcionar

**Dónde comienza y qué debe existir antes:** [POR DEFINIR]

1. La persona o integración hace: [POR DEFINIR].
2. La aplicación comprueba: [POR DEFINIR].
3. La aplicación procesa y muestra: [POR DEFINIR].
4. La persona revisa o confirma, si procede: [POR DEFINIR].
5. La aplicación guarda y termina en: [POR DEFINIR].

| Dato de entrada | Obligatorio | Formato, ejemplo ficticio y validación |
| --- | --- | --- |
| [POR DEFINIR] | [Sí / No] | [POR DEFINIR] |

| Resultado o dato guardado | Dónde se muestra/guarda | Momento de guardado y si sustituye algo |
| --- | --- | --- |
| [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |

**Confirmación, deshacer, versiones o recuperación:** [POR DEFINIR]

## 6. Casos especiales y errores

| Situación | Qué debe ver la persona | Qué debe conservar/hacer el sistema |
| --- | --- | --- |
| No hay datos o es el primer uso | [POR DEFINIR] | [POR DEFINIR] |
| Datos incompletos o inválidos | [POR DEFINIR] | [POR DEFINIR] |
| Falta sesión, permiso o cuota | [POR DEFINIR] | [POR DEFINIR] |
| IA/servicio lento, caído o respuesta inválida | [POR DEFINIR / No aplica] | [POR DEFINIR / No aplica] |
| Cierre de pestaña o pérdida de conexión | [POR DEFINIR] | [POR DEFINIR] |
| Reintento, doble clic o dos cambios simultáneos | [POR DEFINIR] | [POR DEFINIR] |
| Éxito parcial o datos ya existentes | [POR DEFINIR] | [POR DEFINIR] |

## 7. Resultado esperado y criterios para darlo por correcto

Escribe ejemplos observables. Una frase como «que funcione bien» no permite comprobar el resultado. Estos criterios se completarán antes de implementar; todavía no son pruebas realizadas.

| ID | Dado este contexto | Cuando ocurre esta acción | Entonces espero exactamente |
| --- | --- | --- | --- |
| CA-01 | [POR DEFINIR] | [POR DEFINIR] | [POR DEFINIR] |
| CA-02 | [Caso de error] | [POR DEFINIR] | [POR DEFINIR] |
| CA-03 | [Caso de permiso/límite] | [POR DEFINIR] | [POR DEFINIR] |

**Ejemplo completo con datos ficticios (entrada → resultado):**

[ESCRIBE AQUÍ]

**Cómo lo comprobaré manualmente:** [POR DEFINIR]

## 8. Experiencia, datos y condiciones adicionales (si aplica)

- Pantalla, textos, botones, móvil y accesibilidad: [POR DEFINIR; referencia visual en design.md].
- Idiomas de interfaz y de resultados: [POR DEFINIR].
- Tiempo de respuesta, progreso y coste máximo: [POR DEFINIR].
- Datos enviados a IA/terceros y confirmación necesaria: [POR DEFINIR].
- Conservación, exportación, borrado y registro de acciones: [POR DEFINIR].
- Qué ocurre con datos existentes al activar el cambio: [POR DEFINIR].
- Dependencias de otras funcionalidades: [POR DEFINIR; enlazar sus fichas].
- Dudas por resolver: [POR DEFINIR].

## 9. Revisión antes de implementar

- [ ] He definido el objetivo y el resultado esperado.
- [ ] He decidido qué conservar y qué cambiar.
- [ ] He revisado permisos, errores y datos existentes.
- [ ] Los criterios CA describen resultados comprobables.

Decisión final: [Borrador / Listo para revisión / Aprobado para implementar]  
Quién y cuándo toma la decisión: [POR DEFINIR]
