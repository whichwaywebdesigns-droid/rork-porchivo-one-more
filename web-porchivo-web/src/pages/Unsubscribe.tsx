import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

// Token-based preference endpoint — the unsubscribe token IS the credential.
const PREFS_URL =
  "https://axmdzrtyznphlfganljb.supabase.co/functions/v1/email-prefs";

const CATEGORIES = [
  {
    key: "partners",
    label: "Porch Partner requests & updates",
    desc: "Requests from neighbors, acceptances, and partner changes",
  },
  {
    key: "packages",
    label: "Package alerts",
    desc: "Arriving today, picked up, and at-risk warnings",
  },
  {
    key: "community",
    label: "Community & safety",
    desc: "Neighborhood digests, safety alerts, member news",
  },
  {
    key: "marketing",
    label: "Product news & reminders",
    desc: "Feature announcements and come-back reminders",
  },
] as const;

type State = "loading" | "ready" | "invalid" | "saved";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState("");
  const [cats, setCats] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`${PREFS_URL}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad token"))))
      .then((d: { email_masked: string; categories: Record<string, boolean> }) => {
        setEmail(d.email_masked);
        setCats(d.categories);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const toggle = async (key: string) => {
    const optOut = !cats[key];
    setPending(key);
    try {
      const r = await fetch(PREFS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, category: key, optOut }),
      });
      if (!r.ok) throw new Error("failed");
      setCats((c) => ({ ...c, [key]: optOut }));
      setState("saved");
    } catch {
      // leave the toggle as-is on failure
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white shadow-lg border border-stone-200 p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            Porchivo
          </p>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">
            Email preferences
          </h1>

          {state === "loading" && (
            <p className="mt-6 text-stone-500">Loading your preferences…</p>
          )}

          {state === "invalid" && (
            <div className="mt-6">
              <p className="text-stone-600">
                This link isn't valid anymore. Unsubscribe links expire when a
                new email is sent — open the most recent Porchivo email and use
                its footer link.
              </p>
              <p className="mt-3 text-sm text-stone-500">
                Need help?{" "}
                <a className="text-amber-700 underline" href="mailto:support@porchivo.com">
                  support@porchivo.com
                </a>
              </p>
            </div>
          )}

          {(state === "ready" || state === "saved") && (
            <>
              <p className="mt-3 text-stone-600">
                Choose which emails {email ? `(${email}) ` : ""}receives.
                Changes apply immediately.
              </p>
              {state === "saved" && (
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                  Preferences saved.
                </div>
              )}
              <ul className="mt-6 divide-y divide-stone-100">
                {CATEGORIES.map((c) => {
                  const optedOut = !!cats[c.key];
                  return (
                    <li key={c.key} className="flex items-center gap-4 py-4">
                      <div className="flex-1">
                        <p className="font-medium text-stone-900">{c.label}</p>
                        <p className="text-sm text-stone-500">{c.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        disabled={pending === c.key}
                        aria-pressed={optedOut}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          optedOut ? "bg-stone-300" : "bg-emerald-600"
                        } ${pending === c.key ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            optedOut ? "left-1" : "left-6"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-6 rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-500">
                Security emails (account deletion, theft reports) and billing
                receipts are always sent — they can't be turned off here.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          <Link to="/" className="text-amber-700 underline">
            porchivo.com
          </Link>
        </p>
      </div>
    </div>
  );
}
