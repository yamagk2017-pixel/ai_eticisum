import {useMemo} from "react";
import type {DocumentActionComponent} from "sanity";
import {resolvePreviewPath, type PreviewDocumentLike} from "@/sanity/preview-path";

const SECRET_STORAGE_KEY = "preview-share-secret";
const DEFAULT_TTL_MINUTES = 60 * 24 * 5;

function readSecretFromStorage() {
  try {
    const value = window.localStorage.getItem(SECRET_STORAGE_KEY);
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function saveSecretToStorage(secret: string) {
  try {
    window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
  } catch {
    // no-op
  }
}

export const CopyPreviewShareLinkAction: DocumentActionComponent = (props) => {
  const documentValue = (props.draft ?? props.published ?? null) as PreviewDocumentLike | null;
  const path = useMemo(() => (documentValue ? resolvePreviewPath(documentValue) : undefined), [documentValue]);

  if (!path) return null;

  return {
    label: "共有URLをコピー",
    onHandle: async () => {
      try {
        const existingSecret = readSecretFromStorage();
        const secretInput = window.prompt(
          "PREVIEW_SHARE_SECRET を入力してください（次回以降このブラウザに保存されます）",
          existingSecret
        );
        const secret = (secretInput ?? "").trim();
        if (!secret) {
          window.alert("PREVIEW_SHARE_SECRET が未入力のため中断しました。");
          props.onComplete();
          return;
        }
        saveSecretToStorage(secret);

        const ttlInput = window.prompt("有効期限（分）", String(DEFAULT_TTL_MINUTES));
        const ttlMinutes = Number(ttlInput ?? DEFAULT_TTL_MINUTES);
        const safeTtl = Number.isFinite(ttlMinutes) ? Math.max(1, Math.trunc(ttlMinutes)) : DEFAULT_TTL_MINUTES;

        const params = new URLSearchParams({
          secret,
          path,
          ttlMinutes: String(safeTtl),
        });
        const response = await fetch(`/api/draft/share-link?${params.toString()}`);
        const payload = (await response.json()) as {previewUrl?: string; error?: string};
        if (!response.ok || !payload.previewUrl) {
          throw new Error(payload.error || "共有URLの生成に失敗しました。");
        }

        await navigator.clipboard.writeText(payload.previewUrl);
        window.alert("共有URLをコピーしました。");
      } catch (error) {
        const message = error instanceof Error ? error.message : "共有URLのコピーに失敗しました。";
        window.alert(message);
      } finally {
        props.onComplete();
      }
    },
  };
};

