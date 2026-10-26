# Matchply: cifrado del almacenamiento y recuperación

Este procedimiento está preparado para la base y las copias de Matchply. La presencia del código no significa que esté activado: verificar el marcador y los montajes en el VPS antes de afirmar que los datos están cifrados.

## Diseño y límites

- Un archivo de volumen LUKS2 contiene PostgreSQL y `/var/backups/matchply`. La clave de 64 bytes reside fuera del VPS, en `~/.ssh/matchply_storage.key` del ordenador de operación. Los procesos de desbloqueo la transmiten por SSH en stdin; no debe aparecer en argumentos, registros, el repositorio ni archivos del servidor.
- Existe una única clave de desbloqueo: mantener una copia separada, cifrada o físicamente segura y probar su recuperación antes de migrar. Si se pierde, los datos y copias cifrados pueden quedar irrecuperables. Cambiar de ordenador exige trasladar esa clave y la clave SSH de operador por un canal seguro.
- El disco debe desbloquearse manualmente después de cada reinicio o reinicio del daemon Docker. Hasta entonces la aplicación no está disponible. No poner la clave en un servicio de arranque, entorno o copia del VPS.
- La protección del volumen en reposo no evita accesos de root ni ataques a la aplicación mientras esté abierto, ni demuestra borrado físico de bloques previos, snapshots del proveedor o copias externas. El sistema operativo y los demás servicios no se migran.
- La migración conserva los directorios anteriores en texto claro para volver atrás. Mientras existan, y hasta revisar cualquier snapshot o copia externa, **no se debe afirmar que toda copia histórica esté cifrada**. Su eliminación es una operación separada que requiere un procedimiento y autorización específicos.

## Antes de migrar

1. Revisar scripts y cambios operativos, ensayar en una instalación aislada, comprobar espacio y preparar una ventana de servicio. No utilizar el directorio antiguo de la aplicación como fuente de despliegue.
2. Guardar una copia recuperable de la clave **en otro soporte** y verificar que es legible sin imprimir su contenido. No realizar la migración hasta confirmar esa copia.
3. Comprobar la release activa, estado de los servicios, sistema de backup y protección de ramas. Comparar `/opt/matchply-ops/ops.py` y `compose.yml` con el código propuesto: la instalación existente puede contener cambios locales. Conservarlos y revisar las diferencias; no sustituir ciegamente esos archivos.
4. Instalar la protección de operaciones y el comando de desbloqueo en los gateways de Matchply. La protección comprueba que las rutas de PostgreSQL y copias estén montadas sobre el dispositivo cifrado antes de backup, despliegue o recreación. Preparar recuperación de los archivos operativos originales.
5. Ejecutar la migración revisada con la clave únicamente por stdin, bajo el bloqueo de operaciones. Crear y verificar una copia, parar solo Matchply, copiar datos a almacenamiento cifrado y comparar árboles. Conservar las carpetas de origen. Al activar, comprobar salud de base, aplicación y workers, y verificar una nueva copia cifrada.
6. Ensayar en una ventana acordada el cierre y desbloqueo del volumen y una restauración aislada de una copia con datos sintéticos. No dar por verificada una restauración solamente porque el archivo exista.

## Desbloqueo después de reiniciar

Desde el ordenador que conserva ambas claves y el checkout de Matchply:

```bash
python3 scripts/deploy/unlock-from-mac.py
```

El gateway comprueba la clave, monta el volumen y sus dos rutas, inicia PostgreSQL y espera su salud antes de arrancar web y workers. Si falla, no copiar datos a un directorio sin montar ni inicializar una nueva base: investigar con `matchply-vps` y conservar los originales. El desbloqueo requiere acceso SSH de operador con host key verificada y una instalación compatible del gateway.

## Conservación y borrado observados

El CV puede eliminarse desde la aplicación; las relaciones concretas y las copias conservadas requieren revisión al atender una solicitud completa. Los invitados caducan a los siete días y se eliminan cuando su cookie caducada vuelve a presentarse, pero no se ha comprobado una limpieza programada para los que no regresan. Los PDF exportados no vinculados a una candidatura tienen vencimiento de 30 días; los vinculados permanecen mientras exista la referencia. Los informes y errores operativos se limpian por lotes tras 30 días. El sistema conserva las 14 copias de despliegue verificadas más recientes y puede haber copias anteriores adicionales. Los plazos legales, la limpieza de invitados abandonados y la eliminación de copias antiguas deben decidirse y probarse explícitamente antes de activarse; esta guía no es una política legal definitiva.
