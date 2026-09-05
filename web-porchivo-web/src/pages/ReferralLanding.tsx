import { Link } from "react-router-dom";
import { Gift, UserPlus, ArrowRight } from "lucide-react";

export default function ReferralLanding() {
  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Porchivo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Share Porchivo, earn rewards
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          Every Porchivo user has a personal referral code. When a friend signs
          up with your code and protects their first package, you both get a
          reward.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5">
            <UserPlus className="h-6 w-6 text-amber-700" />
            <p className="mt-3 font-semibold text-stone-900">1. Share your code</p>
            <p className="mt-1 text-sm text-stone-600">
              Find it in the app under your profile, and send it to a neighbor.
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5">
            <Gift className="h-6 w-6 text-amber-700" />
            <p className="mt-3 font-semibold text-stone-900">2. Earn your reward</p>
            <p className="mt-1 text-sm text-stone-600">
              Once they protect their first package, your reward is credited —
              we'll email you the confirmation.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 font-semibold text-white shadow hover:bg-amber-700"
          >
            Get the app & find your code <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
