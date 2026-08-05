import LegalPage from '@/components/legal/LegalPage';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies y almacenamiento local"
      intro="Matchply utiliza almacenamiento técnico para mantener la sesión y recordar preferencias de interfaz. Esta página debe ajustarse al inventario final de cookies y al consentimiento configurado en producción."
      sections={[
        { title: 'Necesarias', body: 'Las cookies de autenticación y el identificador temporal de invitado permiten mantener tu sesión y conservar una prueba durante el periodo indicado por la aplicación.' },
        { title: 'Preferencias', body: 'El idioma y el tema pueden guardarse localmente para que la interfaz se mantenga consistente entre visitas.' },
        { title: 'Medición', body: 'Los eventos de conversión de la landing se registran sin enviar el contenido del CV ni de la oferta. Si se añaden proveedores externos de analítica, esta información deberá actualizarse y solicitar el consentimiento que corresponda.' },
        { title: 'Control', body: 'Puedes borrar cookies desde la configuración del navegador. Algunas funciones dejarán de funcionar hasta que vuelvas a iniciar sesión o se cree una nueva sesión de prueba.' },
      ]}
    />
  );
}
