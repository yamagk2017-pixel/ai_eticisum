type PreviewOptions = {
  mode: "copy" | "open";
  path: string;
  createSecret: () => Promise<{secret: string}>;
  onComplete: () => void;
};

export function createPreviewHandler({mode, path, createSecret, onComplete}: PreviewOptions) {
  return async () => {
    let previewWindow: Window | null = null;
    try {
      // Reserve during the click so asynchronous authentication cannot trigger a popup block.
      if (mode === "open") {
        previewWindow = window.open("about:blank", "_blank");
        if (!previewWindow) throw new Error("ポップアップを許可して、もう一度お試しください。");
        previewWindow.opener = null;
      }
      const {secret} = await createSecret();
      const response = await fetch("/api/draft/studio-link", {
        method: "POST",
        headers: {"Content-Type": "application/json", "X-Sanity-Preview-Secret": secret},
        body: JSON.stringify({path, ttlMinutes: mode === "open" ? 60 : 60 * 24 * 5}),
        cache: "no-store",
      });
      const payload = (await response.json()) as {previewUrl?: string; error?: string};
      if (!response.ok || !payload.previewUrl) throw new Error(payload.error || "プレビューURLの生成に失敗しました。");
      if (previewWindow) previewWindow.location.replace(payload.previewUrl);
      else {
        await navigator.clipboard.writeText(payload.previewUrl);
        window.alert("共有URLをコピーしました。");
      }
    } catch (error) {
      previewWindow?.close();
      window.alert(error instanceof Error ? error.message : "プレビューURLの生成に失敗しました。");
    } finally {onComplete();}
  };
}
