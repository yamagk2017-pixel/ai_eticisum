export type InterviewSpeakerColor = {
  speakerName: string;
  color: string;
};

export const SPEAKER_COLOR_PRESETS = [
  {title: "オレンジ", value: "#f97316"},
  {title: "ピンク", value: "#ec4899"},
  {title: "赤", value: "#ef4444"},
  {title: "青", value: "#3b82f6"},
  {title: "緑", value: "#22c55e"},
  {title: "紫", value: "#a855f7"},
  {title: "黄", value: "#eab308"},
] as const;

export const SPEAKER_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function normalizeSpeakerName(value: string) {
  return value.trim().replace(/[：:]$/, "").trim();
}

export function normalizeSpeakerColors(value: unknown): InterviewSpeakerColor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<InterviewSpeakerColor>;
    const speakerName = typeof item.speakerName === "string" ? normalizeSpeakerName(item.speakerName) : "";
    const color = typeof item.color === "string" ? item.color.trim() : "";
    if (!speakerName || !SPEAKER_COLOR_PATTERN.test(color) || seen.has(speakerName)) return [];
    seen.add(speakerName);
    return [{speakerName, color: color.toLowerCase()}];
  });
}
