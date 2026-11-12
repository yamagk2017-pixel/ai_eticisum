"use client";

import { useState } from "react";

export function IdolProfile({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsExpansion = body.length > 200;
  return (
    <div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--ui-text-muted)] sm:text-base sm:leading-8">
        {needsExpansion && !expanded ? `${body.slice(0, 200)}…` : body}
      </p>
      {needsExpansion && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-2 min-h-11 text-sm font-semibold text-[var(--ui-link)] underline underline-offset-4"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      )}
    </div>
  );
}
