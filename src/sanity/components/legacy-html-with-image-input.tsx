"use client";

import {useRef, useState} from "react";
import type {TextInputProps} from "sanity";
import {set, unset, useClient} from "sanity";

type UploadedImageAsset = {
  _id: string;
  url?: string;
};

function escapeHtmlAttr(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildCdnUrlFromAssetId(assetId: string, projectId?: string, dataset?: string) {
  if (!projectId || !dataset) return null;
  const match = assetId.match(/^image-(.+)-(\d+x\d+)-([a-z0-9]+)$/i);
  if (!match) return null;
  const [, imageId, dimensions, format] = match;
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${imageId}-${dimensions}.${format}`;
}

function buildImageHtml(url: string, alt: string) {
  const safeUrl = escapeHtmlAttr(url);
  const safeAlt = escapeHtmlAttr(alt);
  return `<p><img src="${safeUrl}" alt="${safeAlt}" /></p>`;
}

export function LegacyHtmlWithImageInput(props: TextInputProps) {
  const client = useClient({apiVersion: "2026-03-10"});
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const value = typeof props.value === "string" ? props.value : "";

  function applyValue(nextValue: string) {
    props.onChange(nextValue ? set(nextValue) : unset());
  }

  function insertHtmlSnippet(snippet: string) {
    const textarea = containerRef.current?.querySelector("textarea");
    if (!textarea) {
      const base = value.trimEnd();
      applyValue(base ? `${base}\n\n${snippet}` : snippet);
      return;
    }

    const selectionStart = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : value.length;
    const selectionEnd = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
    const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
    applyValue(next);

    const nextCaret = selectionStart + snippet.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);

    try {
      const asset = (await client.assets.upload("image", file, {
        filename: file.name,
      })) as UploadedImageAsset;
      const config = client.config();
      const url =
        asset.url ?? buildCdnUrlFromAssetId(asset._id, config.projectId as string | undefined, config.dataset as string | undefined);

      if (!url) {
        throw new Error("画像URLの取得に失敗しました。");
      }

      const alt = file.name.replace(/\.[^.]+$/, "");
      insertHtmlSnippet(buildImageHtml(url, alt));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "画像アップロードに失敗しました。");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {props.renderDefault(props)}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={props.readOnly || isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-[var(--card-border-color)] px-3 py-2 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "画像をアップロードして本文に挿入"}
        </button>
        <span className="text-xs opacity-70">`&lt;img&gt;` タグをカーソル位置に挿入します。</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={props.readOnly || isUploading}
        onChange={(event) => {
          const nextFile = event.currentTarget.files?.[0] ?? null;
          void handleFileSelected(nextFile);
        }}
        className="hidden"
      />
      {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
    </div>
  );
}
