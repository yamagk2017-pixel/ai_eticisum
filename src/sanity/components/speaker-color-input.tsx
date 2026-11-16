"use client";

import {set, type StringInputProps} from "sanity";
import {SPEAKER_COLOR_PATTERN, SPEAKER_COLOR_PRESETS} from "@/lib/news/speaker-colors";

export function SpeakerColorInput(props: StringInputProps) {
  const color = typeof props.value === "string" && SPEAKER_COLOR_PATTERN.test(props.value)
    ? props.value.toLowerCase()
    : "#f97316";

  return (
    <div>
      <div style={{display: "flex", alignItems: "center", gap: 12}}>
        <input
          type="color"
          aria-label="話者の色を選ぶ"
          value={color}
          disabled={props.readOnly}
          onChange={(event) => props.onChange(set(event.currentTarget.value))}
          style={{width: 44, height: 36, padding: 0, border: 0, background: "transparent", cursor: "pointer"}}
        />
        <div style={{flex: 1}}>{props.renderDefault(props)}</div>
      </div>
      <div role="group" aria-label="よく使う色" style={{display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12}}>
        {SPEAKER_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-label={preset.title}
            title={preset.title}
            aria-pressed={props.value?.toLowerCase() === preset.value}
            disabled={props.readOnly}
            onClick={() => props.onChange(set(preset.value))}
            style={{
              width: 28, height: 28, borderRadius: "50%", background: preset.value,
              border: "1px solid #888", cursor: "pointer", outlineOffset: 3,
              outline: props.value?.toLowerCase() === preset.value ? "2px solid currentColor" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
