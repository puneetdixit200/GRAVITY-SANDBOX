"use client";

import { Activity, Box, Brain, Orbit, Sparkles, Video, Waves, Zap } from "lucide-react";
import type { SandboxSettings } from "./sandboxTypes";

type ChaosControlsProps = {
  settings: SandboxSettings;
  recording: boolean;
  onSettingsChange: (patch: Partial<SandboxSettings>) => void;
  onSpawnWormholes: () => void;
  onSupernova: () => void;
  onMeteorStorm: () => void;
  onCollapse: () => void;
  onRecord: () => void;
};

export function ChaosControls({
  settings,
  recording,
  onSettingsChange,
  onSpawnWormholes,
  onSupernova,
  onMeteorStorm,
  onCollapse,
  onRecord
}: ChaosControlsProps) {
  return (
    <section className="chaos-controls" aria-label="Chaos controls">
      <header>
        <div>
          <span className="eyebrow">Chaos Lab</span>
          <h2>Sandbox toys</h2>
        </div>
        <Sparkles size={18} />
      </header>

      <div className="chaos-grid">
        <ChaosToggle
          icon={<Zap size={15} />}
          label="Gravity gun"
          active={settings.gravityGun}
          onClick={() => onSettingsChange({ gravityGun: !settings.gravityGun })}
        />
        <ChaosToggle
          icon={<Activity size={15} />}
          label="Repel"
          active={settings.gravityGunRepel}
          onClick={() => onSettingsChange({ gravityGunRepel: !settings.gravityGunRepel })}
        />
        <ChaosToggle
          icon={<Orbit size={15} />}
          label="Orbit prediction"
          active={settings.prediction}
          onClick={() => onSettingsChange({ prediction: !settings.prediction })}
        />
        <ChaosButton icon={<Waves size={15} />} label="Spawn wormholes" onClick={onSpawnWormholes} />
        <ChaosButton icon={<Sparkles size={15} />} label="Trigger supernova" onClick={onSupernova} />
        <ChaosButton icon={<Brain size={15} />} label="Meteor storm" onClick={onMeteorStorm} />
        <ChaosButton icon={<Box size={15} />} label="Collapse system" onClick={onCollapse} />
        <ChaosButton icon={<Video size={15} />} label={recording ? "Recording" : "Record WebM"} onClick={onRecord} disabled={recording} />
      </div>
    </section>
  );
}

function ChaosToggle({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`chaos-button ${active ? "is-active" : ""}`} onClick={onClick} aria-label={label} aria-pressed={active} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ChaosButton({
  icon,
  label,
  disabled = false,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="chaos-button" onClick={onClick} disabled={disabled} aria-label={label === "Recording" ? "Record WebM" : label} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
