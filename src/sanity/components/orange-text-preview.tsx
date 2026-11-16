import type {ReactNode} from "react";

export function OrangeTextPreview({children}: {children?: ReactNode}) {
  return <span style={{color: "#f97316"}}>{children}</span>;
}
