"use client";

import { Asterisk, Circle, Disc3, EyeOff, Orbit, Sparkles, Sun } from "lucide-react";
import { BODY_DEFINITIONS, BodyType } from "@/engine/Simulation";

type BodyToolbarProps = {
  selectedType: BodyType;
  onSelectType: (type: BodyType) => void;
};

const TYPES: BodyType[] = ["asteroid", "planet", "giant", "star", "blackHole", "darkMatter"];

const icons = {
  asteroid: Asterisk,
  planet: Circle,
  giant: Orbit,
  star: Sun,
  blackHole: Disc3,
  debris: Sparkles,
  darkMatter: EyeOff
};

export function BodyToolbar({ selectedType, onSelectType }: BodyToolbarProps) {
  return (
    <aside className="body-toolbar" aria-label="Body type selector">
      <div className="toolbar-brand">
        <span>Gravity</span>
        <strong>Play</strong>
      </div>
      <div className="tool-stack">
        {TYPES.map((type) => {
          const Icon = icons[type];
          const definition = BODY_DEFINITIONS[type];
          return (
            <button
              key={type}
              className={`tool-button ${selectedType === type ? "is-active" : ""}`}
              type="button"
              title={`${definition.label} mass ${definition.mass}`}
              aria-label={definition.label}
              onClick={() => onSelectType(type)}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{definition.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
