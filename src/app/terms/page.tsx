import LegalPage from '@/components/legal/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos del servicio"
      intro="Al usar Matchply aceptas utilizar la herramienta de forma legal y revisar el contenido generado antes de enviarlo a una empresa. Estos términos requieren validación legal antes de sustituir el contrato definitivo."
      sections={[
        { title: 'Servicio', body: 'Matchply ofrece herramientas para adaptar CVs a ofertas y organizar candidaturas. La IA propone redacciones; tú decides qué conservar y eres responsable del documento final.' },
        { title: 'Planes y cobro', body: 'El plan Gratis y PRO tienen los límites descritos en la página de precios. PRO se cobra mensualmente a través de Stripe y puede cancelarse desde el portal de facturación, sujeto a las condiciones aplicables.' },
        { title: 'Uso responsable', body: 'No uses Matchply para introducir datos de terceros sin autorización, suplantar identidades, inventar experiencia profesional o intentar acceder a cuentas y documentos ajenos.' },
        { title: 'Limitación', body: 'La optimización no es una promesa de superar filtros ATS, obtener entrevistas o conseguir empleo. El servicio puede cambiar para corregir errores, mejorar seguridad o cumplir obligaciones legales.' },
      ]}
    />
  );
}
