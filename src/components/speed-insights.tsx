"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

export function FilteredSpeedInsights() {
  return (
    <SpeedInsights
      beforeSend={(event) => {
        const pathname = new URL(event.url, "http://localhost").pathname;
        if (
          pathname === "/relay-9147" ||
          pathname.startsWith("/relay-9147/") ||
          pathname === "/studio" ||
          pathname.startsWith("/studio/")
        ) {
          return null;
        }
        return event;
      }}
    />
  );
}
