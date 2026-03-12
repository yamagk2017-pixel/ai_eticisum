import {useMemo} from "react";
import type {DocumentActionComponent} from "sanity";
import {resolvePreviewPath, type PreviewDocumentLike} from "@/sanity/preview-path";

const DEFAULT_TTL_MINUTES = 60 * 24 * 5;

export const CopyPreviewShareLinkAction: DocumentActionComponent = (props) => {
  const documentValue = (props.draft ?? props.published ?? null) as PreviewDocumentLike | null;
  const path = useMemo(() => (documentValue ? resolvePreviewPath(documentValue) : undefined), [documentValue]);

  if (!path) return null;

  return {
    label: "共有URLをコピー",
    onHandle: async () => {
      try {
        const secretInput = window.prompt("PREVIEW_SHARE_SECRET を入力してください（この値は保存しません）", "");
        const secret = (secretInput ?? "").trim();
        if (!secret) {
          window.alert("PREVIEW_SHARE_SECRET が未入力のため中断しました。");
          props.onComplete();
          return;
        }

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
