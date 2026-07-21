import { useState, type ReactElement } from "react";
import type { ShareLinkResponse } from "@take-note/shared";

import { ApiError } from "../../lib/apiClient.js";
import { getShareLinkStatus } from "./shareApi.js";
import { useGenerateShareLinkMutation } from "./useGenerateShareLinkMutation.js";
import { useRevokeShareLinkMutation } from "./useRevokeShareLinkMutation.js";

type ShareModalProps = {
  noteId: string;
  open: boolean;
  onClose: () => void;
};

type ExpirationPreset = "default" | "7" | "14" | "30";

const EXPIRATION_OPTIONS: { value: ExpirationPreset; label: string }[] = [
  { value: "default", label: "Use default (7 days)" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function ShareModal({ noteId, open, onClose }: ShareModalProps): ReactElement {
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>("default");
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const generateMutation = useGenerateShareLinkMutation(noteId);
  const revokeMutation = useRevokeShareLinkMutation(noteId);

  if (!open) {
    return <></>;
  }

  function handleGenerate(): void {
    const expiresInDays = expirationPreset === "default" ? undefined : Number(expirationPreset);
    generateMutation.mutate(
      { expiresInDays },
      {
        onSuccess: (data) => {
          setShareLink(data);
          setRevoked(false);
          setGenerateError(null);
        },
        onError: (error) => {
          setGenerateError(
            toErrorMessage(error, "Something went wrong while generating the share link."),
          );
        },
      },
    );
  }

  function handleRevoke(): void {
    revokeMutation.mutate(undefined, {
      onSuccess: () => {
        setRevoked(true);
        setRevokeError(null);
      },
      onError: (error) => {
        setRevokeError(
          toErrorMessage(error, "Something went wrong while revoking the share link."),
        );
      },
    });
  }

  async function handleRefreshViews(): Promise<void> {
    try {
      const status = await getShareLinkStatus(noteId);
      if (shareLink) {
        setShareLink({
          ...shareLink,
          viewCount: status.viewCount,
          expiresAt: status.expiresAt,
          revoked: status.revoked,
        });
      }
    } catch {
      // ignore error
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share note"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded bg-white p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Share note</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Expiration</legend>
          {EXPIRATION_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="expiration"
                value={option.value}
                checked={expirationPreset === option.value}
                onChange={() => setExpirationPreset(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={handleGenerate}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Generate link
        </button>

        {generateError && (
          <p role="alert" className="text-xs text-red-600">
            {generateError}
          </p>
        )}

        {shareLink && !revoked && (
          <div className="space-y-2 rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              Generating a new link replaces any previously shared link.
            </p>
            <p className="break-all text-sm text-slate-900 font-mono bg-slate-50 p-2 rounded border border-slate-200">
              {shareLink.shareLink}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Expires: {formatDate(shareLink.expiresAt)}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Views: {shareLink.viewCount}</span>
                <button
                  type="button"
                  onClick={() => void handleRefreshViews()}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                >
                  Refresh Views
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(shareLink.shareLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 transition-colors"
              >
                Revoke link
              </button>
            </div>
          </div>
        )}

        {shareLink && revoked && (
          <p className="text-sm text-slate-500">Link revoked. It is no longer active.</p>
        )}

        {revokeError && (
          <p role="alert" className="text-xs text-red-600">
            {revokeError}
          </p>
        )}
      </div>
    </div>
  );
}
