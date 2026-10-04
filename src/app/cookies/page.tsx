import LegalPage from '@/components/legal/LegalPage';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies y almacenamiento local"
      intro="Matchply utiliza almacenamiento técnico para mantener la sesión y recordar preferencias de interfaz. Esta página debe ajustarse al inventario final de cookies y al consentimiento configurado en producción."
      sections={[
        { title: 'Necesarias', body: 'Las cookies de autenticación y el identificador temporal de invitado permiten mantener tu sesión y conservar una prueba durante el periodo indicado por la aplicación.' },
        { title: 'Preferencias', body: 'El idioma y el tema pueden guardarse localmente para que la interfaz se mantenga consistente entre visitas.' },
        { title: 'Medición', body: 'Umami autoalojado, si está activado, permite medir visitas y conversiones agregadas. No identifica personas ni graba sesiones. La recogida está desactivada en desarrollo, administración e impersonación, respeta la señal Do Not Track y permanece apagada hasta UMAMI_AEPD_CLEARED=true y la configuración de Umami habilitada. Conservación prevista: 12 meses.' },
        { title: 'Prueba de titulares', body: 'Cuando la medición está habilitada, la landing puede comparar dos titulares. La cookie matchply_landing_headline conserva durante siete días únicamente la variante v1:A o v1:B; es HttpOnly, por lo que el código de la página no puede leerla directamente. El almacenamiento sessionStorage marca exposición y conversiones ya contadas para evitar repetirlas durante la sesión de esa pestaña. Conserva temporalmente los eventos experimentales pendientes, con variante, etapa y ruta genérica, hasta que cargue Umami; se eliminan si se desactiva la recogida. Estas marcas no contienen el CV ni un identificador de cuenta. Con la medición desactivada no se crean nuevas asignaciones de la prueba.' },
        { title: 'Control', body: 'Puedes borrar cookies desde la configuración del navegador. Algunas funciones dejarán de funcionar hasta que vuelvas a iniciar sesión o se cree una nueva sesión de prueba.' },
      ]}
    />
  );
}
