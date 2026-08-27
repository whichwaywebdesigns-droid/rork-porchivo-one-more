/**
 * ManageAnnouncements — recent community announcements (org_announcements)
 * plus a composer. Inserts are protected by RLS: author_id must be the
 * caller and the caller must hold an active staff/board role.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, SendHorizonal, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { OrgAnnouncementRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";
import { usePortalAuth } from "@/providers/PortalAuthProvider";

type PriorityValue = "low" | "normal" | "high" | "urgent";

const PRIORITIES: PriorityValue[] = ["low", "normal", "high", "urgent"];

function priorityClasses(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "low":
      return "bg-brand-navy-700 text-brand-text-muted";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

export default function ManageAnnouncementsPage() {
  const { org, membership } = usePortalOrg();
  const { userId } = usePortalAuth();
  const queryClient = useQueryClient();
  const orgId = org?.id;

  const [titleValue, setTitleValue] = useState<string>("");
  const [bodyValue, setBodyValue] = useState<string>("");
  const [priorityValue, setPriorityValue] = useState<PriorityValue>("normal");
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["portal", "announcements", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_announcements")
        .select("id, title, body, priority, is_pinned, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      return (data ?? []) as OrgAnnouncementRow[];
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !userId) throw new Error("no org");
      if (!titleValue.trim() || !bodyValue.trim()) throw new Error("Title and message are required.");
      const { error } = await supabase.from("org_announcements").insert({
        org_id: orgId,
        author_id: userId,
        title: titleValue.trim(),
        body: bodyValue.trim(),
        priority: priorityValue,
        is_pinned: isPinned,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTitleValue("");
      setBodyValue("");
      setPriorityValue("normal");
      setIsPinned(false);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["portal", "announcements", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["portal", "dashboard-counts", orgId] });
    },
    onError: (err: Error) => {
      setFormError(err.message.includes("violates")
        ? "Your role can't post announcements. Ask your HOA admin."
        : err.message);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Announcements</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Pushed instantly to every resident of {org?.name ?? "your community"}.
        </p>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          postMutation.mutate();
        }}
        className="paper-sheet rounded-xl px-6 py-5 space-y-4"
      >
        <input
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          placeholder="Headline — e.g. Pool closed Saturday for resurfacing"
          maxLength={120}
          className="w-full rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[15px] font-semibold text-brand-text-primary placeholder:font-normal placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-tape-gold/50 focus:border-tape-gold transition-colors"
        />
        <textarea
          value={bodyValue}
          onChange={(e) => setBodyValue(e.target.value)}
          placeholder="Details your residents should know…"
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[14px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-tape-gold/50 focus:border-tape-gold transition-colors resize-y"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-[13px] text-brand-text-secondary">
            Priority
            <select
              value={priorityValue}
              onChange={(e) => setPriorityValue(e.target.value as PriorityValue)}
              className="rounded-md border border-brand-navy-500/70 bg-transparent px-2 py-1 text-[13px] text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-tape-gold/40"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-brand-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="accent-[#8B6914]"
            />
            Pin to top
          </label>
          <button
            type="submit"
            disabled={postMutation.isPending}
            className="btn-orange ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] disabled:opacity-60"
          >
            {postMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <SendHorizonal className="w-4 h-4" />}
            Post announcement
          </button>
        </div>
        {formError && (
          <p className="text-[13px] text-red-600" role="alert">{formError}</p>
        )}
        <p className="text-[11px] text-brand-text-muted">
          Posting as {membership ? membership.role.replace(/_/g, " ") : "staff"} · appears in the resident app immediately.
        </p>
      </form>

      {/* Recent list */}
      {listQuery.isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : (listQuery.data ?? []).length === 0 ? (
        <p className="text-[13px] text-brand-text-muted">Nothing posted yet — your first announcement goes out instantly.</p>
      ) : (
        <ul className="space-y-3">
          {(listQuery.data ?? []).map((row) => (
            <li key={row.id} className="paper-sheet rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-brand-text-primary">{row.title}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {row.is_pinned && <Pin className="w-3.5 h-3.5 text-tape-gold" aria-label="Pinned" />}
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${priorityClasses(row.priority)}`}>
                    {row.priority}
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-[13px] text-brand-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                {row.body.length > 320 ? `${row.body.slice(0, 320)}…` : row.body}
              </p>
              <p className="mt-2 text-[11px] text-brand-text-muted">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
