import {useMemo} from "react";
import {useClient, useCurrentUser, type DocumentActionComponent} from "sanity";
import {createPreviewSecret} from "@sanity/preview-url-secret/create-secret";
import {resolvePreviewPath, type PreviewDocumentLike} from "@/sanity/preview-path";
import {createPreviewHandler} from "./preview-share-handler";

function createPreviewAction(mode: "copy" | "open"): DocumentActionComponent {
  return function PreviewShareLinkAction(props) {
    const client = useClient({apiVersion: "2026-02-24"});
    const currentUser = useCurrentUser();
    const documentValue = (props.draft ?? props.published ?? null) as PreviewDocumentLike | null;
    const path = useMemo(() => (documentValue ? resolvePreviewPath(documentValue) : undefined), [documentValue]);
    if (!path) return null;
    return {
      label: mode === "open" ? "プレビューを開く" : "共有URLをコピー",
      group: ["paneActions"],
      onHandle: createPreviewHandler({mode, path, onComplete: props.onComplete, createSecret: async () => {
        if (!currentUser) throw new Error("Sanityにログインし直してください。");
        return createPreviewSecret(client, "musicite-studio-preview", window.location.href, currentUser.id);
      }}),
    };
  };
}

export const CopyPreviewShareLinkAction = createPreviewAction("copy");
export const OpenPreviewAction = createPreviewAction("open");
