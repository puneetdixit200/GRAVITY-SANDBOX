"use client";

import { Crosshair, GitFork, Infinity, Orbit, Sparkles, Sun } from "lucide-react";
import { PRESETS, PresetKey } from "@/engine/Presets";

type PresetLoaderProps = {
  activePreset: PresetKey | null;
  onLoadPreset: (preset: PresetKey) => void;
};

const icons = {
  solarSystem: Sun,
  binaryStars: GitFork,
  figureEight: Infinity,
  galaxyCollision: Sparkles,
  galaxyMode: Orbit,
  captureChallenge: Crosshair,
  empty: Orbit
};

export function PresetLoader({ activePreset, onLoadPreset }: PresetLoaderProps) {
  return (
    <div className="preset-loader" aria-label="Preset loader">
      {PRESETS.map((preset) => {
        const Icon = icons[preset.key];
        return (
          <button
            key={preset.key}
            className={`preset-button ${activePreset === preset.key ? "is-active" : ""}`}
            type="button"
            onClick={() => onLoadPreset(preset.key)}
            title={preset.label}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
