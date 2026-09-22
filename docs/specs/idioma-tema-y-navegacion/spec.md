# Idioma, tema, navegación y componentes comunes — comportamiento deseado

## Propuesta acotada: fluidez de navegación (20/09/2026)

Modo `assist`: diagnóstico y planificación solicitados; implementación no realizada. Esta propuesta cubre la navegación y conserva pendiente la plantilla general de idioma/tema que sigue debajo.

Contexto: el usuario observa lentitud sin caché tanto en local como en producción y confirma que producción tiene la última build. Véanse [evidencia y límites del diagnóstico](evidence.md), [plan priorizado](plan.md) y [criterios de aceptación](expectations.md).

- **REQ-NAV-01:** La interfaz DEBE confirmar inmediatamente la navegación y permitir elegir otro destino durante la espera. El destino pendiente debe distinguirse de la página ya cargada.
- **REQ-NAV-02:** Los cambios de presentación con datos disponibles DEBEN realizarse en cliente sin volver a solicitar la página completa. Una pestaña sin datos DEBE cargar solo lo necesario y mostrar su propio estado de carga.
- **REQ-NAV-03:** La cabecera y navegación DEBEN conservarse mientras se carga contenido. Las secciones independientes DEBEN poder aparecer sin esperar consultas ajenas.
- **REQ-NAV-04:** Los listados DEBEN tener una carga inicial acotada; los CVs completos, informes y detalles se recuperan al usarlos. Paginación y filtros DEBEN conservar resultados, conteos y acciones existentes.
- **REQ-NAV-05:** El JavaScript y las miniaturas no esenciales DEBERÍAN quedar fuera del camino crítico de navegación. Las tareas obsoletas DEBERÍAN cancelarse y las solicitudes iguales en curso deduplicarse.
- **REQ-NAV-06:** La mejora DEBE verificarse separando caché del router, recursos del navegador, proceso servidor y compilación de desarrollo, y registrando la versión realmente evaluada.
- **NFR-NAV-01:** Objetivos propuestos: primer feedback p95 ≤100 ms; cambio visual local p95 ≤100 ms; contenido útil p95 ≤1 s en escritorio y ≤2 s en el perfil móvil de prueba. Son objetivos, no tiempos actuales ni garantías aprobadas; el entorno y la muestra se definen en expectativas.
- **INV-NAV-01:** Mantener autorización por usuario efectivo, roles, suscripción, suspensión y modo soporte; ninguna caché ni precarga puede mezclar identidades.
- **INV-NAV-02:** Mantener URLs directas, atrás/adelante, vistas guardadas, filtros, selección y exportaciones. Los cambios entre pestañas de Ajustes no deben perder ediciones sin guardar.
- **INV-NAV-03:** Una mutación confirmada debe reflejarse al volver al listado; finalizar sesión o cambiar de actor invalida cualquier reutilización de datos del actor anterior.

Supuestos: se priorizan Mis CVs, Postulaciones, Empresas y Ajustes; no se ha identificado una única pareja de pestañas afectada. No se cambian reglas de negocio, proveedor de hosting ni autenticación. Los cambios sobre administración quedan sujetos a que la medición la identifique como afectada. **ASSUMP-NAV-01:** producción ejecuta la última build; lo confirma el usuario, no el metadato `legacy` del gateway.

**DEC-NAV-01:** El destino pendiente se implementa con `Link` y estado compartido compatibles con Next 14. No se usará `useLinkStatus` ni APIs de versiones posteriores.

**DEC-NAV-02:** La casilla de cabecera y «Seleccionar las N» siguen significando el conjunto filtrado, no solo la página visible. Exportación, cambio de estado e IA operan sobre esa selección. Al paginar en SQL, se recuperan los IDs del filtro o las acciones aceptan el filtro como alcance; no se recorta a la página sin aviso. El tope de exportación de 1.000 IDs se conserva y se informa si se supera.

**DEC-NAV-03:** Los umbrales de NFR-NAV-01 sirven para comparar antes/después. No son SLOs operativos ni, por sí solos, criterio de rollback.

**DEC-NAV-04:** Una miniatura persistida en servidor solo se plantea si, tras el resto de recortes, AC-NAV-08 sigue mostrando coste relevante en el camino de navegación.

Transiciones del destino pendiente:

| Desde | Evento | Hacia |
| --- | --- | --- |
| Reposo | Clic en destino A | Pendiente A; feedback inmediato; `aria-current` sigue en la ruta confirmada |
| Pendiente A | Clic en destino B | Pendiente B |
| Pendiente A | Ruta A confirmada | Reposo; `aria-current` en A |
| Pendiente A | Error, sin red o redirección | Se retira el pendiente o se muestra recuperación |
| Pendiente A | Espera >3 s | Se anuncia la espera; el sidebar sigue usable |
| Pendiente A | Espera >15 s | Se ofrece salir o reintentar; no se afirma que el servidor haya cancelado su trabajo |

Fuera de esta propuesta: idioma/tema de la plantilla F27 que sigue debajo; autenticación; hosting; reglas de negocio; desplegar o actualizar producción como solución; prometer un factor concreto de aceleración.

**Revisión de especificación: lista para revisar.** Comportamiento, invariantes y verificaciones definidos. Falta medir la navegación autenticada de la última build; es el primer paso del plan, no un resultado ya obtenido. No se autoriza ni realiza despliegue con este documento.

---

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

**¿Qué idiomas soportará toda la experiencia y cómo se elige el inicial?**

[ESCRIBE AQUÍ]

**¿Qué navegación y preferencias deben persistirse por cuenta o por dispositivo?**

[ESCRIBE AQUÍ]

**¿Qué resultados de accesibilidad y comportamiento móvil consideras obligatorios?**

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
