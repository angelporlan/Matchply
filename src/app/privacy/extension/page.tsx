import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacidad de la extensión de Chrome | Matchply',
  description: 'Qué datos utiliza Matchply LinkedIn Capture y cómo controlar la captura.',
};

export default function ExtensionPrivacyPage() {
  return (
    <LegalPage
      title="Privacidad de Matchply LinkedIn Capture"
      intro="Última actualización: 18 de octubre de 2026. Esta política describe los datos que trata la extensión de Chrome Matchply LinkedIn Capture al conectarla con tu cuenta de Matchply. Contacto: matchplyapp@gmail.com."
      sections={[
        { title: 'Conexión con tu cuenta', body: 'La extensión utiliza un código temporal que generas en Matchply para obtener una sesión limitada a la integración de LinkedIn. Guarda el token de esa sesión y tus preferencias en el almacenamiento local de la extensión, dentro de tu perfil de Chrome. No solicita tu contraseña de Matchply ni tu contraseña o las cookies de LinkedIn.' },
        { title: 'Ofertas que guardas', body: 'En las páginas de LinkedIn, la extensión lee los datos de empleo disponibles: identificador, URL, puesto, empresa, ubicación, modalidad, tipo de contrato, descripción y metadatos de la oferta. En modo automático guarda la oferta abierta tras el tiempo de lectura configurado; en modo manual lo hace cuando lo solicitas. «Capturar visibles» guarda hasta 25 ofertas de la lista cargada e intenta completar las descripciones mediante páginas públicas de LinkedIn, sin enviar cookies en esas peticiones. Estos datos se envían por HTTPS a Matchply y se asocian a tus candidaturas. Guardar ofertas no presenta solicitudes ni envía mensajes a empresas.' },
        { title: 'Personas y fotografías opcionales', body: '«Capturar personas» está desactivado al inicio. Si lo activas, la extensión puede guardar los nombres, enlaces de perfil, titulares profesionales, grado de conexión, relación con la oferta y fotografías disponibles de los contactos que LinkedIn muestra en el contexto de la oferta. Las fotos se descargan de dominios de LinkedIn sin enviar el token de Matchply, se reducen en el navegador y se guardan en tu cuenta privada de Matchply. Puedes dejar esta opción apagada y añadir personas manualmente. LinkedIn impone restricciones sobre las extensiones que copian perfiles; consulta el aviso de la extensión antes de activarla.' },
        { title: 'Finalidad, destinos y uso limitado', body: 'Los datos de la extensión se utilizan para vincular tu instalación, guardar y actualizar ofertas y contactos en tu espacio de Matchply, evitar duplicados y mostrar el estado de la captura. La extensión se comunica con Matchply y con LinkedIn y sus dominios de imágenes para las funciones descritas. No incorpora servicios de publicidad ni seguimiento de navegación fuera de LinkedIn. No vendemos los datos de la extensión ni los utilizamos para publicidad personalizada. El uso y la transferencia de la información obtenida mediante las APIs de Chrome se ajustan a la política de datos de usuarios de Chrome Web Store, incluidos sus requisitos de uso limitado. Las herramientas de IA de Matchply son funciones separadas, sujetas a las condiciones y controles del servicio.' },
        { title: 'Permisos del navegador', body: 'El almacenamiento local conserva la sesión, las preferencias y los marcadores de captura. El acceso a la pestaña activa y la ejecución de scripts permiten capturar desde el popup y activar la interfaz de Matchply en LinkedIn. Los permisos de sitios se limitan a Matchply, LinkedIn y sus dominios de imágenes; la versión de Chrome Web Store no solicita acceso a servidores de desarrollo locales.' },
        { title: 'Control, conservación y eliminación', body: 'Puedes apagar la extensión, cambiar entre captura automática y manual, desactivar la captura de personas y desconectarte desde el popup. En Ajustes → Integraciones de Matchply puedes revocar instalaciones. Desconectar o desinstalar no borra las ofertas y contactos ya guardados en Matchply: permanecen en tu cuenta hasta que los elimines. Puedes gestionar esos registros desde la aplicación y solicitar acceso o eliminación de tus datos escribiendo a matchplyapp@gmail.com. La desinstalación elimina el almacenamiento propio de la extensión en ese perfil de Chrome.' },
      ]}
    />
  );
}
