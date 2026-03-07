import type {ReactNode} from "react";

type BlockStylePreviewProps = {
  children?: ReactNode;
};

export function Well3StylePreview({children}: BlockStylePreviewProps) {
  return (
    <span
      style={{
        backgroundColor: "#d1d5db",
        color: "#111827",
        borderRadius: "4px",
        padding: "0.05em 0.3em",
      }}
    >
      {children}
    </span>
  );
}
