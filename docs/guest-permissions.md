# Fotos y adaptación: permisos e idempotencia

Un invitado con sesión vigente puede adaptar su CV y añadir, mostrar, ocultar o quitar una foto personalizada de **su CV activo**. Se aplican los límites del plan y los controles de propiedad igual que a una cuenta registrada. El CV base se conserva al adaptar.

La foto de cuenta (`/api/account/avatar`) requiere iniciar sesión o registrarse. Una sesión invitada recibe `401 ACCOUNT_REQUIRED`, con la alternativa de añadir la foto directamente al CV. La foto de otro usuario no es pública. Los cambios de cuenta tampoco se permiten desde una sesión de soporte.

`/api/cv/[cvId]/photo` admite invitados y cuentas. Las escrituras requieren el mismo origen, imagen validada, propiedad y permiso de edición. Repetir una subida con los mismos bytes, la selección de visibilidad o el borrado de la foto personalizada conserva el mismo estado. El guardado usa una única fila por CV.

La adaptación usa un identificador de solicitud estable. Repetir el mismo identificador y contenido de un trabajo vigente o completado devuelve el mismo trabajo y destino, sin otra reserva de uso; la publicación consume una sola operación. Tras un fallo terminal, el botón de reintento prepara una solicitud nueva. Los controles de interfaz bloquean los eventos duplicados desde el inicio de la preparación asíncrona, además de desactivar los botones durante la petición.

Un `403 CV_READ_ONLY` sigue protegiendo un CV que ya no está activo en el plan. Un `409 OPERATION_IN_PROGRESS` protege una escritura distinta mientras se genera ese CV; hay que esperar a que termine. Un identificador reutilizado con otro contenido también es un conflicto real. Estos controles no se eliminan para ocultar errores: el usuario recibe una explicación y la acción que corresponde.

Las pruebas HTTP de fotos comprueban invitados, cuentas, peticiones concurrentes repetidas, propiedad y origen. Las integraciones de optimización comprueban doble admisión, una sola cuota y conservación de las fuentes.
