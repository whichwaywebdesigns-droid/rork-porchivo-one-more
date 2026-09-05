import { Link } from "react-router-dom";
import { HandHeart, ShieldCheck, PackageCheck, ArrowRight } from "lucide-react";

export default function PartnersLanding() {
  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Porchivo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Porch Partners — neighbors who watch your porch
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          A Porch Partner is a verified neighbor who can hold your packages
          safely when you're not home. Request a partner, agree on terms, and
          your deliveries get a trusted pair of hands.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: HandHeart,
              title: "Request a partner",
              body: "Pick a trusted neighbor from your community and send a request.",
            },
            {
              icon: PackageCheck,
              title: "They hold your packages",
              body: "When a delivery lands, your partner keeps it safe until you're back.",
            },
            {
              icon: ShieldCheck,
              title: "Verified & in your control",
              body: "Partners go through verification. Pause or end a connection anytime.",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5"
            >
              <s.icon className="h-6 w-6 text-amber-700" />
              <p className="mt-3 font-semibold text-stone-900">{s.title}</p>
              <p className="mt-1 text-sm text-stone-600">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 font-semibold text-white shadow hover:bg-amber-700"
          >
            Get the app to request a partner <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/guide" className="text-amber-700 underline">
            Read the Field Guide
          </Link>
        </div>
      </div>
    </div>
  );
}
