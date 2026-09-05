import { useSearchParams, Link } from "react-router-dom";
import { MailCheck, ArrowRight } from "lucide-react";

export default function InviteLanding() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white shadow-lg border border-stone-200 p-8 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-amber-700" />
          <h1 className="mt-4 text-2xl font-bold text-stone-900">
            You've been invited to a community on Porchivo
          </h1>
          {code ? (
            <>
              <p className="mt-3 text-stone-600">
                Your invite code is{" "}
                <span className="rounded bg-stone-100 px-2 py-1 font-mono font-semibold text-stone-900">
                  {code}
                </span>
              </p>
              <p className="mt-3 text-stone-600">
                Getting set up takes about a minute: create your account in the
                app, then enter this code when asked for your community invite
                code — you'll land straight inside your new community.
              </p>
            </>
          ) : (
            <p className="mt-3 text-stone-600">
              Open your invitation email for the invite code, then create your
              account in the app and enter the code when asked for your
              community invite code.
            </p>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 font-semibold text-white shadow hover:bg-amber-700"
            >
              Get the app <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-stone-500">
              Already have the app? Sign in first — the code works from your
              community settings too.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
