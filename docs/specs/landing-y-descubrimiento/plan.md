# Plan de implementación de la landing

Estado: **Aplicado; comprobaciones automáticas y rendimiento aprobados, QA manual parcial**. Revisión: 04/10/2026. Contrato: [spec.md](spec.md); aceptación: [expectations.md](expectations.md); resultados y límites: [evidence.md](evidence.md).

## 1. Narrativa y estructura

Renderizar `/` como página de servidor con copy ES/EN, actor efectivo y H1 asignado. Componer hero con demo y precio, tres pasos, comparación Gratis/PRO, FAQ de objeciones y cierre. Mantener una acción de conversión por sección y cabecera con enlaces discretos. Sustituir el contenedor cliente anterior, partículas, marquesina, escritura progresiva, hover glow, giro 3D y calculadora por esta narrativa.

Conservar los tokens y Button compartidos de `design.md`. Leer capacidad de CV y cuotas Gratis/PRO desde `getPlanConfig()` y mantener constantes vigentes de invitado; mostrar candidaturas también en Gratis. Conservar `/try`, dashboard y el destino de opciones/gestión de suscripción con intención mensual, sin modificar permisos o precios de producción.

## 2. Demo e interacción

Una isla cliente muestra datos ficticios de administración contable y una reformulación que conserva hechos. Cuatro pasos de tres segundos con resultado final persistente, pausa/reanudación, repetición y selección manual. Detener el temporizador por visibilidad y movimiento reducido. Reservar dimensiones para evitar saltos; usar HTML/CSS sin recursos remotos, editor ni motor PDF.

Cabecera accesible con salto al contenido, anclas y menú móvil con Escape/foco. Mantener idioma y tema disponibles. FAQ con `details`/`summary` nativos. Validar los estados en móvil y escritorio.

## 3. Asignación y medición

Preparar `landing_headline_v1`, 50/50 entre visitantes/invitados nuevos, cookie versionada HttpOnly siete días y cabecera interna hacia SSR. Conservar la asignación al registrarse sin admitir cuentas autenticadas nuevas. Solo cambia el titular; preservar gates existentes, DNT y exclusiones de administración/soporte. Prefetch conserva la variante existente sin asignar ni exponer. No activar variables operativas.

Registrar exposición visible, primer CTA, primer PDF y registro por variante; deduplicar etapas por sesión de pestaña. La analítica espera al script y falla sin bloquear el flujo. Documentar cookie y `sessionStorage` en cookies/privacidad conservando el texto de proveedores.

Unificar descargas del visor y tarjetas: respuesta HTTP correcta, PDF no vacío, disparo de descarga y callback de éxito. Guard en vuelo evita peticiones dobles. Mantener nombres, cuota y recuperación de invitado; no contar preview ni errores.

Evaluar la tasa `first_pdf/exposed` después de ≥14 días con diferencia e IC95 % (Wilson/Newcombe), registrando las limitaciones de la unidad sesión de pestaña. Con evidencia insuficiente mantener A y no proclamar ganador.

## 4. Verificación y entrega

Ejecutar las pruebas focales, typecheck, lint, suite y build. Revisar ES/EN, temas, teclado, movimiento reducido, zoom 200 % y rutas según actor. Medir Lighthouse móvil sobre build de producción: mediana de tres ejecuciones con caché fría, LCP <3 s, CLS ≤0,1, peso JS y condiciones guardados.

Completar [evidence.md](evidence.md) con resultados realmente obtenidos y limitaciones. El rediseño, la medición local y el experimento preparado no implican despliegue, activación de analítica ni resultado de conversión medido.
