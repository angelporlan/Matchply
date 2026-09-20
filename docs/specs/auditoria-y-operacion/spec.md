# Auditoría, tráfico y operación — comportamiento deseado

Estado: **Aprobado para implementar**  
Responsable: Operación Matchply  
Fecha de revisión: 20 de septiembre de 2026  
Prioridad: Imprescindible

Referencia: [estado actual](estado-actual.md). Umami es la opción de medición acordada.

## 1. Lo que quiero

Separar tres finalidades: **auditoría** (quién hizo qué, para soporte), **tráfico** (visitas agregadas vía Umami) y **logs técnicos** (errores). El administrador consulta auditoría con filtros en servidor y ve métricas de Umami sin credenciales en el cliente.

## 2. Decisiones

- Umami autoalojado, versión fijada, base propia, sin dashboard público.
- Medición desactivada en desarrollo, `/admin`, impersonación y hasta que `UMAMI_AEPD_CLEARED=true`.
- No enviar correos, IDs de usuario, CVs ni perfiles. Sin identificación de personas ni grabación de sesiones.
- Conservación Umami: 12 meses. Auditoría ordinaria: 90 días. Administrativa: 12 meses.
- `createAuditLog` sigue sin bloquear la actividad ordinaria. Los cambios administrativos críticos persisten con su registro en la misma transacción.

## 3. Qué conservar y qué cambiar

| Referencia | Decisión |
| --- | --- |
| ACT-F26-01 Registro de eventos | Mantener y ampliar actor real, afectado, sesión de soporte, requestId |
| ACT-F26-02 Inserción no bloqueante | Mantener para actividad ordinaria |
| ACT-F26-03 Últimos 1000 eventos en cliente | Cambiar: filtros y paginación en PostgreSQL |
| Conteos de visitas desde audit_log | Cambiar: tráfico vía Umami; Postgres sigue siendo verdad de cuentas y suscripciones |

**Invariantes:** INV-01 un error de Umami no rompe el producto ni usuarios. INV-02 las peticiones a Umami no contienen datos personales. INV-03 no se reconstruye tráfico histórico inexistente.

**Fuera de alcance:** PostHog, Plausible gestionado, grabaciones, cruces con cuentas.

## 4–7. Criterios

| ID | Esperado |
| --- | --- |
| CA-A01 | Filtros de auditoría por fecha, acción, admin y usuario afectado se resuelven en SQL con paginación |
| CA-A02 | Inicio/fin de impersonación, roles, suspensión, Pro e IA quedan registrados |
| CA-T01 | El script de Umami no se inyecta en desarrollo, admin ni impersonación |
| CA-T02 | Si Umami falla, Resumen muestra el error de tráfico y el resto del panel funciona |
| CA-T03 | Eventos de conversión: prueba iniciada, registro, importación, optimización y descarga confirmadas, agregados |

## 8. Notas

Documentar la evaluación AEPD en `docs/ops/umami.md`. Actualizar privacidad y cookies. Activación gradual.
