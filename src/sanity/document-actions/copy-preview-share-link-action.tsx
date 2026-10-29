import {useMemo} from "react";
import type {DocumentActionComponent} from "sanity";
import {resolvePreviewPath, type PreviewDocumentLike} from "@/sanity/preview-path";

const DEFAULT_TTL_MINUTES = 60 * 24 * 5;

function createPreviewAction(mode: "copy" | "open"): DocumentActionComponent {
  return function PreviewShareLinkAction(props) {
    const documentValue = (props.draft ?? props.published ?? null) as PreviewDocumentLike | null;
    const path = useMemo(() => (documentValue ? resolvePreviewPath(documentValue) : undefined), [documentValue]);

    if (!path) return null;

    return {
      label: mode === "open" ? "プレビューを開く" : "共有URLをコピー",
      group: ["paneActions"],
      onHandle: async () => {
        let previewWindow: Window | null = null;
        try {
          // Reserve the tab during the user gesture, before prompts and the asynchronous request.
          if (mode === "open") {
            previewWindow = window.open("about:blank", "_blank");
            if (!previewWindow) throw new Error("ポップアップを許可して、もう一度お試しください。");
            previewWindow.opener = null;
          }
          const secretInput = window.prompt("PREVIEW_SHARE_SECRET を入力してください（この値は保存しません）", "");
          const secret = (secretInput ?? "").trim();
          if (!secret) {
            previewWindow?.close();
            window.alert("PREVIEW_SHARE_SECRET が未入力のため中断しました。");
            return;
          }

          const ttlInput = window.prompt("有効期限（分）", String(DEFAULT_TTL_MINUTES));
          if (ttlInput === null) {
            previewWindow?.close();
            return;
          }
          const ttlMinutes = Number(ttlInput);
          const safeTtl = Number.isFinite(ttlMinutes) ? Math.max(1, Math.trunc(ttlMinutes)) : DEFAULT_TTL_MINUTES;

          const response = await fetch("/api/draft/share-link", {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${secret}`},
            body: JSON.stringify({path, ttlMinutes: safeTtl}),
            cache: "no-store",
          });
          const payload = (await response.json()) as {previewUrl?: string; error?: string};
          if (!response.ok || !payload.previewUrl) {
            throw new Error(payload.error || "共有URLの生成に失敗しました。");
          }

          if (previewWindow) {
            previewWindow.location.replace(payload.previewUrl);
          } else {
            await navigator.clipboard.writeText(payload.previewUrl);
            window.alert("共有URLをコピーしました。");
          }
        } catch (error) {
          previewWindow?.close();
          const message = error instanceof Error ? error.message : "プレビューURLの生成に失敗しました。";
          window.alert(message);
        } finally {
          props.onComplete();
        }
      },
    };
  };
}

export const CopyPreviewShareLinkAction = createPreviewAction("copy");
export const OpenPreviewAction = createPreviewAction("open");
