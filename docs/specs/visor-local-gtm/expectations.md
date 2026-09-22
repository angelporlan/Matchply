# Expectativas verificables — visor local GTM

| ID | Dado este contexto | Cuando ocurre | Resultado esperado |
| --- | --- | --- | --- |
| AC-001 | El flag está activo y el navegador usa localhost con un admin activo | Se abre `/gtm` | Se muestra el panel y los documentos canónicos disponibles |
| AC-002 | El flag está desactivado o el host no es local | Se abre `/gtm` | La ruta responde como no encontrada |
| AC-003 | Dos bots o dos ejecuciones usan el mismo segundo | Se ejecuta `gtm:run start` | Se crean directorios distintos y no se sobrescribe ningún output |
| AC-004 | Una ejecución contiene Markdown, JSON y texto | Se selecciona cada archivo | El panel muestra una vista segura y legible de cada formato |
| AC-005 | Hay ejecuciones de varios bots y fechas | Se aplican filtros | Solo permanecen las ejecuciones que coinciden |
| AC-006 | Una búsqueda coincide con el nombre o el contenido | Se escribe el texto | El panel devuelve las referencias coincidentes sin recargar la página |
| AC-007 | Un run queda en `running` más de 30 minutos | Se escanea el workspace | Se muestra como `incomplete` |
| AC-008 | La referencia contiene `../`, una ruta absoluta o un symlink externo | Se solicita el contenido | La API rechaza la petición y no lee el archivo |
| AC-009 | El visitante no es admin | Se solicita `/gtm` o `/api/gtm/*` | No se entrega contenido GTM |
| AC-010 | Se generan archivos dentro de `docs/gtm/runs` | Se consulta Git | Siguen ignorados y no alteran el índice del repositorio |

## Invariantes

- **INV-001:** El visor nunca escribe en `docs/gtm/`.
- **INV-002:** Una ejecución finalizada conserva su directorio y sus outputs.
- **INV-003:** Ningún path aceptado por la API puede escapar de `docs/gtm/`.
- **INV-004:** Ninguna respuesta de GTM se ejecuta como HTML o JavaScript.
