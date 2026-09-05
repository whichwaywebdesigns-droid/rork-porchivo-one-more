import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";
import { MX_LEGAL } from "@/config/legalMx";

const domicilioClause = MX_LEGAL.domicilio ? `, con domicilio en ${MX_LEGAL.domicilio}` : "";

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-brand-text-primary mb-3">
        {number}. {title}
      </h2>
      <div className="text-brand-text-secondary leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-brand-text-primary mt-4 mb-2">{children}</h3>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPolicyEsPage() {
  return (
    <PageLayout>
      <SEOHead
        title="Aviso de Privacidad — Porchivo"
        description={`Aviso de Privacidad de Porchivo conforme a la LFPDPPP, operado por ${MX_LEGAL.companyName}. Vigente desde el ${MX_LEGAL.effectiveDate}.`}
        canonical={`${BRAND.url}/es/privacidad`}
        ogTitle="Aviso de Privacidad — Porchivo"
        ogDescription="Cómo Porchivo recaba, usa y protege su información personal (LFPDPPP)."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <BreadcrumbNav
          items={[{ label: "Inicio", href: "/" }, { label: "Aviso de Privacidad", href: "/es/privacidad" }]}
        />

        {/* Header */}
        <div className="mt-8 mb-12 pb-8 border-b border-brand-navy-500/50">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold mb-4">
            🛡️ Privacidad
          </div>
          <h1 className="text-4xl font-bold text-brand-text-primary mb-3">Aviso de Privacidad</h1>
          <p className="text-brand-text-secondary text-sm">
            Fecha de última actualización:{" "}
            <span className="text-brand-text-secondary font-medium">{MX_LEGAL.effectiveDate}</span>
            &ensp;·&ensp;Operado por{" "}
            <span className="text-brand-text-secondary font-medium">{MX_LEGAL.companyName}</span>
          </p>
          <p className="text-xs mt-3">
            <a
              href="/privacy"
              className="text-brand-orange hover:text-brand-orange-light underline transition-colors"
            >
              English version →
            </a>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-6 mb-10 text-brand-text-secondary leading-relaxed">
          <p>
            Este Aviso de Privacidad describe cómo <strong className="text-brand-text-primary">Porchivo</strong>{" "}
            recaba, usa, almacena y protege sus datos personales, en términos de la{" "}
            <strong className="text-brand-text-primary">
              Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)
            </strong>{" "}
            y su Reglamento.
          </p>
          <p className="mt-3">
            Dudas o ejercer sus derechos:{" "}
            <a
              href={`mailto:${MX_LEGAL.privacyEmail}`}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <strong>{MX_LEGAL.privacyEmail}</strong>
            </a>
          </p>
        </div>

        {/* 1 — Identidad del Responsable */}
        <Section number="1" title="Identidad del Responsable">
          <p>
            Porchivo, operado por <strong className="text-brand-text-primary">{MX_LEGAL.companyName}</strong>,{" "}
            {MX_LEGAL.entityDescriptor}
            {domicilioClause}, es el responsable del tratamiento de sus datos personales.
          </p>
          <p>
            Correo de contacto para cuestiones de privacidad:{" "}
            <a
              href={`mailto:${MX_LEGAL.privacyEmail}`}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {MX_LEGAL.privacyEmail}
            </a>
          </p>
        </Section>

        {/* 2 — Datos Personales */}
        <Section number="2" title="Datos Personales que Recabamos">
          <SubHeading>Datos identificativos</SubHeading>
          <p>Nombre, correo electrónico, número telefónico y domicilio físico (condominio / unidad o departamento).</p>

          <SubHeading>Datos administrativos</SubHeading>
          <p>
            Nombre del condominio o fraccionamiento al que pertenece y su rol dentro de la comunidad
            (administrador, residente o miembro de la red de Porch Partners).
          </p>

          <SubHeading>Datos de verificación</SubHeading>
          <p>
            Identificación oficial emitida por gobierno y verificación de antecedentes, recabados{" "}
            <strong className="text-brand-text-primary">exclusivamente</strong> de quienes se postulan como Porch
            Partners (vecinos verificados). Estos datos se utilizan únicamente para la verificación de identidad y no
            se comparten con otros usuarios.
          </p>

          <SubHeading>Datos financieros</SubHeading>
          <p>
            Información de facturación correspondiente a la suscripción B2B de Porchivo que contrata la
            administración de su comunidad. El procesamiento del pago se realiza de forma segura a través de Stripe,
            nuestro proveedor de pagos.{" "}
            <strong className="text-brand-text-primary">
              No almacenamos números completos de tarjeta de crédito ni de débito en nuestros sistemas.
            </strong>
          </p>
        </Section>

        {/* 3 — Finalidades */}
        <Section number="3" title="Finalidades del Tratamiento">
          <p>Tratamos sus datos personales para las siguientes finalidades:</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <Bullet>
              Proporcionar la red de seguridad de paquetes: seguimiento de envíos, alertas de riesgo y coordinación de
              entregas a través de la red de Porch Partners (vecinos verificados).
            </Bullet>
            <Bullet>
              Operar las herramientas comunitarias: chat comunitario, reservación de áreas comunes, biblioteca de
              documentos, anuncios y directorio de residentes.
            </Bullet>
            <Bullet>
              Mantener el registro de pagos de cuotas de mantenimiento de su comunidad (
              <strong className="text-brand-text-primary">
                únicamente con fines de registro y control; Porchivo no cobra, retiene ni transfiere pagos de cuotas
              </strong>
              — véase la sección 4 de los Términos y Condiciones).
            </Bullet>
            <Bullet>
              Procesar y administrar la suscripción B2B de Porchivo contratada por la administración de su condominio,
              incluida la facturación.
            </Bullet>
            <Bullet>
              Enviar comunicaciones del servicio: verificación de cuenta, alertas, notificaciones de la comunidad y
              avisos operativos.
            </Bullet>
          </ol>
        </Section>

        {/* 4 — Transferencias */}
        <Section number="4" title="Transferencias de Datos">
          <p>
            <strong className="text-brand-text-primary">No vendemos sus datos personales.</strong> Únicamente
            compartimos datos con prestadores de servicios esenciales —por ejemplo, Stripe (facturación), Resend
            (correo electrónico) y proveedores de alojamiento en la nube— bajo estrictos acuerdos de confidencialidad
            y con la finalidad exclusiva de operar el servicio.
          </p>
          <p>
            Sus datos pueden almacenarse en servidores ubicados fuera de México. Dichas transferencias se realizan a
            proveedores que mantienen medidas de seguridad comparables a las descritas en este aviso.
          </p>
        </Section>

        {/* 5 — ARCO */}
        <Section number="5" title="Derechos ARCO">
          <p>
            De conformidad con la LFPDPPP, usted tiene derecho a <strong>Acceder</strong>, <strong>Rectificar</strong>,{" "}
            <strong>Cancelar</strong> u <strong>Oponerse</strong> al tratamiento de sus datos personales, así como a
            revocar el consentimiento otorgado.
          </p>
          <p>
            Para ejercer estos derechos, envíe su solicitud a nuestro responsable de protección de datos personales
            en:{" "}
            <a
              href={`mailto:${MX_LEGAL.privacyEmail}`}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <strong>{MX_LEGAL.privacyEmail}</strong>
            </a>
          </p>
          <p>
            Su solicitud deberá incluir: (i) su nombre completo y datos de contacto; (ii) el correo electrónico
            registrado en la aplicación; (iii) una descripción clara del derecho que desea ejercer; y (iv)
            documentación que acredite su identidad. Responderemos su solicitud en un plazo máximo de 20 días
            hábiles.
          </p>
        </Section>

        {/* 6 — Limitación */}
        <Section number="6" title="Limitación del Uso y Divulgación de sus Datos">
          <p>
            Usted puede limitar el uso o la divulgación de sus datos personales, así como desactivar las
            notificaciones de la aplicación, desde la sección Configuración de Porchivo, o escribiendo a{" "}
            <a
              href={`mailto:${MX_LEGAL.privacyEmail}`}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {MX_LEGAL.privacyEmail}
            </a>
            .
          </p>
        </Section>

        {/* 7 — Seguridad */}
        <Section number="7" title="Medidas de Seguridad">
          <p>
            Implementamos salvaguardas administrativas, técnicas y físicas conforme a los estándares de la industria
            para proteger sus datos personales, incluyendo cifrado en tránsito, controles de acceso por rol y
            prácticas de minimización de datos.{" "}
            <strong className="text-brand-text-primary">Sin embargo, ningún sistema es 100% seguro.</strong> En caso
            de presentar una vulneración de seguridad sustancial que afecte sus datos, se lo notificaremos por los
            medios de contacto que tengamos registrados.
          </p>
        </Section>

        {/* 8 — Modificaciones */}
        <Section number="8" title="Modificaciones al Aviso">
          <p>
            Este aviso puede ser actualizado. Cualquier cambio se publicará en esta página y, cuando el cambio sea
            sustancial, se notificará dentro de la aplicación con al menos 30 días de anticipación.
          </p>
        </Section>

        {/* Datos sensibles */}
        <Section number="9" title="Datos que NO recabamos (sensibles)">
          <p>
            Porchivo <strong className="text-brand-text-primary">no recaba</strong> datos personales sensibles (salud,
            origen racial o étnico, religión, preferencias sexuales, opiniones políticas).
          </p>
        </Section>

        {/* Menores */}
        <Section number="10" title="Menores de edad">
          <p>
            El servicio está dirigido a personas mayores de 18 años. No recabamos deliberadamente datos de menores.
            Si detectamos una cuenta de un menor, la eliminaremos.
          </p>
        </Section>

        {/* Footer */}
        <div className="mt-14 pt-8 border-t border-brand-navy-500/50 text-sm text-brand-text-muted">
          <p>
            © {new Date().getFullYear()} {MX_LEGAL.companyName}. Todos los derechos reservados. · Porchivo es un
            producto de {MX_LEGAL.companyName}.
          </p>
          <p className="mt-2">
            Consulte también los{" "}
            <a href="/es/terminos" className="text-brand-orange hover:text-brand-orange-light transition-colors underline">
              Términos y Condiciones
            </a>{" "}
            o la{" "}
            <a href="/privacy" className="text-brand-orange hover:text-brand-orange-light transition-colors underline">
              Privacy Policy en inglés
            </a>
            .
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
