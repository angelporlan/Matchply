import LegalPage from '@/components/legal/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacidad"
      intro="Esta página resume qué información necesita Matchply para prestar el servicio. Debe revisarse con el comportamiento real de producción y la política legal antes de publicarse como documento definitivo."
      sections={[
        { title: 'Datos que introduces', body: 'Matchply puede tratar los datos de tu cuenta, el CV que importes o edites y las ofertas que pegues para generar una optimización solicitada por ti. No envíes información que no estés autorizado a compartir.' },
        { title: 'Uso del servicio', body: 'Usamos esos datos para autenticarte, generar el documento, mostrarte cambios revisables y asociar una versión del CV con una candidatura cuando activas el seguimiento.' },
        { title: 'Proveedores', body: 'La generación de texto y el cobro pueden utilizar proveedores configurados por Matchply, como servicios de IA y Stripe. La lista final, las transferencias y los plazos de conservación deben confirmarse en la política legal operativa.' },
        { title: 'Medición agregada', body: 'Si la medición está activada, Matchply consulta Umami autoalojado para visitas, procedencia y conversiones agregadas. No se envían correos, identificadores de cuenta, CVs ni perfiles. Las rutas se normalizan para eliminar IDs y el referente se limita a su dominio. La conservación prevista es de 12 meses. La recogida permanece desactivada hasta completar la evaluación frente a las condiciones de medición exenta de la AEPD.' },
        { title: 'Comparación de titulares', body: 'Con la medición habilitada, Matchply puede comparar dos titulares de la landing mediante una cookie HttpOnly que conserva la variante v1:A o v1:B durante siete días. sessionStorage evita repetir exposición, clic, primera descarga PDF y registro durante la sesión de una pestaña. Conserva temporalmente eventos experimentales pendientes con variante, etapa y ruta genérica hasta que cargue Umami; se eliminan si se desactiva la recogida. La comparación relaciona la primera descarga o el registro con una exposición previa en esa pestaña; no incorpora el contenido del CV ni un identificador de cuenta. La medición respeta Do Not Track y está excluida en desarrollo, administración e impersonación. Este tratamiento permanece sujeto a los controles de activación de Umami y a la evaluación indicada en el apartado anterior.' },
        { title: 'Tus controles', body: 'Puedes revisar cada cambio antes de descargarlo y solicitar ayuda sobre tu cuenta o tus datos escribiendo a matchplyapp@gmail.com. Matchply no garantiza superar un ATS ni conseguir entrevistas.' },
      ]}
    />
  );
}
