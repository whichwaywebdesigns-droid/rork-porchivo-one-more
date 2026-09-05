import { Link } from "react-router-dom";
import { Activity, MapPinned, BellRing, ArrowRight } from "lucide-react";

export default function SafetyLanding() {
  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Porchivo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Neighborhood safety, at a glance
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          Porchivo's safety tools watch your block together with your
          neighbors: risk alerts when theft reports spike, suspicious-activity
          reports from verified neighbors, and a weekly digest of what's
          happening on your street.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: BellRing,
              title: "Risk alerts",
              body: "Get warned when package theft spikes in your area.",
            },
            {
              icon: MapPinned,
              title: "Neighbor reports",
              body: "Verified neighbors flag suspicious activity near you.",
            },
            {
              icon: Activity,
              title: "Weekly digest",
              body: "Deliveries, at-risk packages, and your safest delivery window.",
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
            Open safety tools in the app <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/guide" className="text-amber-700 underline">
            How safety works
          </Link>
        </div>
      </div>
    </div>
  );
}
