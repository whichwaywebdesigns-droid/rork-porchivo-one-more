import PageLayout from "@/components/PageLayout";
import SEOHead from "@/components/SEOHead";
import BreadcrumbNav from "@/components/BreadcrumbNav";
import { BRAND } from "@/config/brand";
import { MX_LEGAL } from "@/config/legalMx";

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
      <span className="text-brand-orange mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

export default function TermsOfServiceEsPage() {
  return (
    <PageLayout>
      <SEOHead
        title="Términos y Condiciones — Porchivo"
        description={`Términos y Condiciones de Porchivo, operado por ${MX_LEGAL.companyName}. Vigentes desde el ${MX_LEGAL.effectiveDate}.`}
        canonical={`${BRAND.url}/es/terminos`}
        ogTitle="Términos y Condiciones — Porchivo"
        ogDescription="Términos que rigen el uso de la aplicación Porchivo en México."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <BreadcrumbNav
          items={[{ label: "Inicio", href: "/" }, { label: "Términos y Condiciones", href: "/es/terminos" }]}
        />

        {/* Header */}
        <div className="mt-8 mb-12 pb-8 border-b border-brand-navy-500/50">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold mb-4">
            📄 Legal
          </div>
          <h1 className="text-4xl font-bold text-brand-text-primary mb-3">Términos y Condiciones</h1>
          <p className="text-brand-text-secondary text-sm">
            Fecha de última actualización:{" "}
            <span className="text-brand-text-secondary font-medium">{MX_LEGAL.effectiveDate}</span>
            &ensp;·&ensp;Operado por{" "}
            <span className="text-brand-text-secondary font-medium">{MX_LEGAL.companyName}</span>
          </p>
          <p className="text-xs mt-3">
            <a href="/terms" className="text-brand-orange hover:text-brand-orange-light underline transition-colors">
              English version →
            </a>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-brand-navy-800/60 border border-brand-navy-500/50 rounded-xl p-6 mb-10 text-brand-text-secondary leading-relaxed">
          <p>
            Al crear una cuenta, descargar o utilizar la aplicación{" "}
            <strong className="text-brand-text-primary">Porchivo</strong> (la "Aplicación"), usted acepta estos
            Términos y Condiciones ("Términos") y el{" "}
            <a href="/es/privacidad" className="text-brand-orange hover:text-brand-orange-light underline transition-colors">
              Aviso de Privacidad
            </a>{" "}
            de Porchivo. Si no está de acuerdo, no utilice la Aplicación. Estos Términos constituyen un acuerdo entre
            usted y <strong className="text-brand-text-primary">{MX_LEGAL.companyName}</strong> ("Porchivo").
          </p>
        </div>

        {/* 1 — Roles */}
        <Section number="1" title="Roles y Gestión de la Comunidad">
          <SubHeading>Administradores</SubHeading>
          <p>
            Los administradores de un condominio o fraccionamiento tienen control sobre la configuración de su
            comunidad, la aprobación de miembros y la biblioteca de documentos. Son responsables de administrar la
            comunidad dentro de la Aplicación y de cumplir la normativa aplicable.
          </p>
          <SubHeading>Residentes y Porch Partners</SubHeading>
          <p>
            Los residentes y los miembros de la red de Porch Partners (vecinos verificados) deben respetar el
            reglamento interno de su comunidad ("Reglamento Interno").{" "}
            <strong className="text-brand-text-primary">
              Porchivo proporciona las herramientas; la aplicación del Reglamento Interno es responsabilidad del
              Administrador de cada comunidad.
            </strong>
          </p>
        </Section>

        {/* 2 — Escudo de responsabilidad */}
        <Section number="2" title="Red de Porch Partners (Escudo de Responsabilidad)">
          <p>
            Porchivo proporciona una plataforma que conecta a residentes con Porch Partners (vecinos verificados).{" "}
            <strong className="text-brand-text-primary">
              Los Porch Partners son personas independientes y no son empleados, agentes ni prestadores de servicios
              de Porchivo.
            </strong>{" "}
            Aunque exigimos verificación de identidad a quienes se incorporan a la red,{" "}
            <strong className="text-brand-text-primary">
              Porchivo no es responsable por paquetes perdidos, robados o dañados una vez entregados a un Porch
              Partner, ni por los actos u omisiones del Porch Partner.
            </strong>{" "}
            Los residentes aceptan que la relación de entrega es directa entre el residente y el Porch Partner.
          </p>
        </Section>

        {/* 3 — Herramientas financieras */}
        <Section number="3" title="Herramientas Financieras y sus Limitaciones">
          <p>
            Porchivo incluye un registro de pagos (la función de "Registro de pagos") que permite a los
            Administradores <strong>registrar y dar seguimiento</strong> a las cuotas de mantenimiento de su
            comunidad. Usted reconoce y acepta que:
          </p>
          <ol className="list-decimal list-inside space-y-1.5">
            <Bullet>
              <strong className="text-brand-text-primary">
                Porchivo no es una institución financiera, ni una pasarela de pagos, ni un banco.
              </strong>
            </Bullet>
            <Bullet>
              <strong className="text-brand-text-primary">
                Porchivo no procesa, no retiene ni transfiere pagos de cuotas de mantenimiento entre residentes.
              </strong>
            </Bullet>
            <Bullet>
              La conciliación financiera de las cuotas registradas es responsabilidad única y exclusiva del
              Administrador de la comunidad.
            </Bullet>
          </ol>
        </Section>

        {/* 4 — Suscripción B2B */}
        <Section number="4" title="Suscripción B2B y Pagos a Porchivo">
          <p>
            La suscripción de Porchivo que contrata la administración de la comunidad se paga mediante la plataforma
            de Stripe. Los precios, periodos de facturación y tarifas de configuración se muestran al momento de la
            contratación. Para comunidades en México, los precios se expresan en pesos mexicanos con IVA incluido
            (16%), conforme a la{" "}
            <a href="/pricing" className="text-brand-orange hover:text-brand-orange-light transition-colors underline">
              página de precios
            </a>
            . Las suscripciones se renuevan automáticamente hasta su cancelación. La cancelación no genera reembolsos
            prorrateados salvo lo exigido por la ley aplicable.
          </p>
        </Section>

        {/* 5 — Chat */}
        <Section number="5" title="Chat Comunitario y Contenido de Usuarios">
          <p>
            <strong className="text-brand-text-primary">
              Los usuarios son los únicos responsables del contenido que publican en los chats comunitarios.
            </strong>{" "}
            Porchivo proporciona herramientas de moderación (reportar y bloquear) a los Administradores; sin embargo,{" "}
            <strong className="text-brand-text-primary">
              Porchivo no es responsable por el contenido generado por los usuarios.
            </strong>{" "}
            Está prohibido publicar contenido ilegal, difamatorio, acosador, discriminatorio o que violen los derechos
            de terceros. Porchivo puede retirar contenido y suspender cuentas que incumplan estos Términos.
          </p>
        </Section>

        {/* 6 — Conducta prohibida */}
        <Section number="6" title="Conducta Prohibida">
          <p>Queda prohibido:</p>
          <ul className="space-y-1.5">
            <Bullet>Suplantar identidades o falsificar verificaciones.</Bullet>
            <Bullet>
              Utilizar la red de Porch Partners para entregas de productos ilegales o peligrosos.
            </Bullet>
            <Bullet>Recolectar datos de otros usuarios sin su consentimiento.</Bullet>
            <Bullet>Interferir con la operación del servicio.</Bullet>
            <Bullet>Cualquier uso contrario a la ley aplicable.</Bullet>
          </ul>
        </Section>

        {/* 7 — Limitación de responsabilidad */}
        <Section number="7" title="Limitación de Responsabilidad">
          <p>
            En la máxima medida permitida por la legislación mexicana,{" "}
            <strong className="text-brand-text-primary">
              Porchivo no será responsable por daños indirectos, incidentales o consecuentes
            </strong>
            , que incluyen de manera enunciativa más no limitativa: paquetes perdidos, disputas entre vecinos o entre
            residentes y administradores, lucro cesante y daños emergentes. La responsabilidad total acumulada de
            Porchivo frente a usted, por cualquier reclamo, no excederá el importe que usted haya pagado a Porchivo
            en los 12 meses previos al reclamo.
          </p>
        </Section>

        {/* 8 — Disponibilidad */}
        <Section number="8" title="Disponibilidad del Servicio">
          <p>
            Porchivo se ofrece "tal cual" y "según disponibilidad". No garantizamos un servicio ininterrumpido o
            libre de errores y podemos modificar o descontinuar funcionalidades; en tal caso notificaremos con
            antelación razonable a los Administradores de comunidades con suscripción activa.
          </p>
        </Section>

        {/* 9 — Terminación */}
        <Section number="9" title="Terminación">
          <p>
            Usted puede eliminar su cuenta en cualquier momento desde Configuración. Porchivo puede suspender o
            terminar cuentas que incumplan estos Términos o para proteger la seguridad de la comunidad. Las secciones
            2, 3, 5, 7, 10 y 11 sobreviven a la terminación.
          </p>
        </Section>

        {/* 10 — Ley aplicable */}
        <Section number="10" title="Ley Aplicable y Jurisdicción">
          <p>
            Estos Términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Cualquier controversia
            derivada de estos Términos se someterá a los tribunales competentes de{" "}
            <strong className="text-brand-text-primary">{MX_LEGAL.jurisdiction}</strong>, renunciando las partes a
            cualquier otra jurisdicción que, por su domicilio presente o futuro, pudiera corresponderles.
          </p>
        </Section>

        {/* 11 — Disposiciones generales */}
        <Section number="11" title="Disposiciones Generales">
          <p>
            Si alguna disposición de estos Términos resulta inválida, las demás permanecerán en vigor. La falta de
            exigencia de un derecho no constituye su renuncia. Estos Términos no crean asociaciones, empleos ni
            agencias entre las partes. Puede contactarnos en{" "}
            <a
              href={`mailto:${MX_LEGAL.supportEmail}`}
              className="text-brand-orange hover:text-brand-orange-light transition-colors"
            >
              {MX_LEGAL.supportEmail}
            </a>{" "}
            para cualquier duda sobre estos Términos.
          </p>
        </Section>

        {/* Footer */}
        <div className="mt-14 pt-8 border-t border-brand-navy-500/50 text-sm text-brand-text-muted">
          <p>
            © {new Date().getFullYear()} {MX_LEGAL.companyName}. Todos los derechos reservados. · Porchivo es un
            producto de {MX_LEGAL.companyName}.
          </p>
          <p className="mt-2">
            Consulte también el{" "}
            <a href="/es/privacidad" className="text-brand-orange hover:text-brand-orange-light transition-colors underline">
              Aviso de Privacidad
            </a>{" "}
            o los{" "}
            <a href="/terms" className="text-brand-orange hover:text-brand-orange-light transition-colors underline">
              Terms of Service en inglés
            </a>
            .
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
