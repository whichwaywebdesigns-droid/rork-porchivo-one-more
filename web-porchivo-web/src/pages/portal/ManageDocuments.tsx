/**
 * ManageDocuments — community document library (org_documents + private
 * `org-documents` bucket). Manager-portal parity with the resident app's
 * Document Library screen: every active member can browse, staff add
 * external links or upload files (PDF/Office/image/text, 25 MB cap) and
 * remove them. Uploaded files open via short-lived signed URLs.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Link2, Loader2, Trash2, Upload } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { OrgDocumentRow } from "@/lib/portalTypes";
import { usePortalOrg } from "@/hooks/usePortalOrg";
import { usePortalAuth } from "@/providers/PortalAuthProvider";

const DOC_BUCKET = "org-documents";
const MAX_FILE_BYTES = 25 * 1024 * 1024; // mirrors the bucket's file_size_limit

// Same allowlist the bucket enforces server-side.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function fmtSize(bytes: number | null): string | null {
  if (typeof bytes !== "number" || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ManageDocumentsPage() {
  const { org } = usePortalOrg();
  const { userId } = usePortalAuth();
  const queryClient = useQueryClient();
  const orgId = org?.id;

  const [name, setName] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsQuery = useQuery({
    queryKey: ["portal", "documents", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("no org");
      const { data, error } = await supabase
        .from("org_documents")
        .select("id, org_id, name, external_url, file_path, file_size, mime_type, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OrgDocumentRow[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["portal", "documents", orgId] });
  };

  const addLink = useMutation({
    mutationFn: async () => {
      if (!orgId || !userId) throw new Error("no org");
      const trimmed = url.trim();
      if (!/^https?:\/\//i.test(trimmed)) throw new Error("Link must start with http:// or https://");
      const { error } = await supabase.from("org_documents").insert({
        org_id: orgId,
        name: name.trim(),
        external_url: trimmed,
        uploaded_by: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setName("");
      setUrl("");
      setFormError(null);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!orgId || !userId) throw new Error("no org");
      if (file.size > MAX_FILE_BYTES) throw new Error("Files are limited to 25 MB.");
      if (file.type && !ALLOWED_MIME.has(file.type)) {
        throw new Error("That file type isn't supported. Use a PDF, Office file, image, or text file.");
      }
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "bin";
      // Path MUST be `{org_id}/…` — storage RLS scopes on the first folder.
      const path = `${orgId}/${Date.now()}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) throw new Error("Upload failed — try again.");
      const { error } = await supabase.from("org_documents").insert({
        org_id: orgId,
        name: (name.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 120),
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setName("");
      setFormError(null);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const removeDoc = useMutation({
    mutationFn: async (doc: OrgDocumentRow) => {
      if (doc.file_path) {
        const { error: rmErr } = await supabase.storage.from(DOC_BUCKET).remove([doc.file_path]);
        if (rmErr) console.warn("storage remove (non-fatal):", rmErr.message);
      }
      const { error } = await supabase.from("org_documents").delete().eq("id", doc.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (err: Error) => setFormError(err.message),
  });

  const openDoc = async (doc: OrgDocumentRow): Promise<void> => {
    if (doc.external_url) {
      window.open(doc.external_url, "_blank", "noopener");
      return;
    }
    if (doc.file_path) {
      const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(doc.file_path, 300);
      if (error || !data?.signedUrl) {
        setFormError("Could not open the document — the link expired. Try again.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener");
    }
  };

  const docs = docsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Document library</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Bylaws, budgets, minutes, and notices — visible to every resident of {org?.name ?? "your community"}.
        </p>
      </div>

      {/* Composer: link or upload */}
      <div className="paper-sheet rounded-xl px-6 py-5 space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name (optional for uploads) — e.g. 2026 Budget"
          maxLength={120}
          className="w-full rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[15px] font-semibold text-brand-text-primary placeholder:font-normal placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-tape-gold/50 focus:border-tape-gold transition-colors"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://link-to-a-doc…"
            maxLength={500}
            className="flex-1 rounded-lg border border-brand-navy-500/70 bg-white/70 dark:bg-brand-navy-800/60 px-3.5 py-2.5 text-[14px] text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-tape-gold/50 focus:border-tape-gold transition-colors"
          />
          <button
            type="button"
            disabled={!name.trim() || !url.trim() || addLink.isPending}
            onClick={() => addLink.mutate()}
            className="btn-orange inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] disabled:opacity-60"
          >
            {addLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Add link
          </button>
          <button
            type="button"
            disabled={uploadFile.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-navy-500/70 px-4 py-2.5 text-[14px] font-semibold text-brand-text-secondary hover:text-brand-text-primary hover:border-brand-orange/60 transition-colors disabled:opacity-60"
          >
            {uploadFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile.mutate(file);
            }}
          />
        </div>
        {formError && <p className="text-[13px] text-red-600" role="alert">{formError}</p>}
        <p className="text-[11px] text-brand-text-muted">
          Uploads are private — residents open them through expiring secure links. Max 25 MB per file (PDF, Office, image, or text).
        </p>
      </div>

      {/* List */}
      {docsQuery.isLoading ? (
        <div className="py-10 flex justify-center">
          <div className="w-7 h-7 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-[13px] text-brand-text-muted">
          Nothing here yet — add your first bylaw, budget, or community notice above.
        </p>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc) => {
            const size = fmtSize(doc.file_size);
            return (
              <li
                key={doc.id}
                className="paper-sheet rounded-xl px-5 py-4 flex items-center gap-4 group cursor-pointer"
                onClick={() => void openDoc(doc)}
              >
                <span
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.external_url ? "bg-brand-navy-700 text-brand-blue-light" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  }`}
                >
                  {doc.external_url ? <Link2 className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-brand-text-primary truncate">{doc.name}</h3>
                  <p className="text-[12px] text-brand-text-muted">
                    {doc.external_url ? "External link" : "File"}
                    {size ? ` · ${size}` : ""} · {fmtDate(doc.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${doc.name}`}
                  disabled={removeDoc.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove "${doc.name}" from the library?`)) removeDoc.mutate(doc);
                  }}
                  className="p-2 rounded-lg text-brand-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
