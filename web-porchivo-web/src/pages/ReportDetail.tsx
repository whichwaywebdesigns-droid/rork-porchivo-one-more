import { useParams, Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";

/**
 * Landing target for report CTAs in transactional emails (suspicious
 * activity + theft reports). The live report detail lives in the app —
 * this page gives the email click a real destination with context.
 */
export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white shadow-lg border border-stone-200 p-8">
          <FileText className="h-10 w-10 text-amber-700" />
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            Report {id ? `#${id.slice(0, 8)}` : ""}
          </h1>
          <p className="mt-3 text-stone-600">
            The full report — photos, status, and updates — lives in the
            Porchivo app. Open it to see the latest on this report, add
            details, or close it out once it's resolved.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 font-semibold text-white shadow hover:bg-amber-700"
            >
              Open in the app <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/safety" className="text-amber-700 underline">
              About neighborhood safety
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
