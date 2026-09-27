# Visor local de ejecuciones GTM

Estado: **Aprobado para implementar**  
Responsable: Ángel  
Fecha: 2026-09-22

## Objetivo

Disponer de un panel local y de solo lectura para consultar las entregas que los
bots de GTM exportan al workspace de Matchply, sin mezclar ejecuciones ni
sobrescribir los documentos canónicos.

## Requisitos

- **REQ-001:** La aplicación DEBE mostrar `/gtm` solo con la bandera local
  `GTM_VIEWER_ENABLED=true`, un host localhost y una cuenta administradora
  activa.
- **REQ-002:** Cada ejecución DEBE vivir en una carpeta única fechada bajo
  `docs/gtm/runs/YYYY-MM-DD/HH-mm-ss__bot__id/`.
- **REQ-003:** Los documentos raíz de `docs/gtm/` DEBEN seguir tratándose como
  material canónico y no serán modificados por el visor.
- **REQ-004:** El visor DEBE separar material canónico e histórico, y permitir
  filtrar por bot, estado, fecha, tipo y texto.
- **REQ-005:** La lectura de archivos DEBE impedir traversal, symlinks fuera del
  workspace y ejecución de HTML no confiable.
- **REQ-006:** No se importará automáticamente el historial de Grok; solo se
  mostrarán archivos exportados por los bots.

## Fuera de alcance

- Envío de DMs, publicación, edición o promoción de contenido.
- Persistencia en PostgreSQL.
- Disponibilidad en producción o para usuarios no administradores.
- Importación automática de conversaciones de Grok.

## Decisiones

- Los bots empiezan y terminan ejecuciones con `npm run gtm:run`.
- `Europe/Madrid` es el huso horario de los nombres de carpeta.
- El código del visor se versiona; todo `docs/gtm/` permanece ignorado por Git.
