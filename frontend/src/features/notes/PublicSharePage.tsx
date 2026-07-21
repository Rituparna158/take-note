import { useEffect, useRef, useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { publicShareResponseSchema, type PublicShareResponse } from "@take-note/shared";

import { apiRequest } from "../../lib/apiClient.js";
import { PasteSanitizeExtension } from "./pasteSanitizeExtension.js";

export function PublicSharePage(): ReactElement {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicShareResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(token ? null : "Invalid share token");
  const hasFiredRef = useRef(false);

  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, PasteSanitizeExtension],
  });

  useEffect(() => {
    if (!token || hasFiredRef.current) {
      return;
    }
    hasFiredRef.current = true;

    async function fetchSharedNote(): Promise<void> {
      try {
        const response = await apiRequest<unknown>({
          method: "GET",
          path: `/api/share/${token}`,
        });
        const parsed = publicShareResponseSchema.parse(response);
        setData(parsed);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load shared note");
      } finally {
        setLoading(false);
      }
    }

    void fetchSharedNote();
  }, [token]);

  useEffect(() => {
    if (editor && data?.content) {
      editor.commands.setContent(data.content, { emitUpdate: false });
    }
  }, [editor, data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div role="status" className="text-center text-slate-500 font-medium">
          Loading shared note…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md text-center bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-3"
        >
          <h2 className="text-xl font-bold text-slate-900">Unable to view note</h2>
          <p className="text-sm text-slate-600">
            {error ?? "This share link is expired, revoked, or does not exist."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <main className="mx-auto max-w-3xl px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 mb-2">
              Public Shared Note (Read-Only)
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{data.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Last updated: {new Date(data.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="prose prose-slate max-w-none">
            <EditorContent editor={editor} />
          </div>
        </div>
      </main>
    </div>
  );
}
