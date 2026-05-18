"use client";

import {
  Activity,
  Brain,
  Gauge,
  Grid3X3,
  Map,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Waves
} from "lucide-react";
import type { SandboxSettings } from "./sandboxTypes";

type TimeControlsProps = {
  settings: SandboxSettings;
  historyLength: number;
  shareCopied: boolean;
  onSettingsChange: (patch: Partial<SandboxSettings>) => void;
  onClear: () => void;
  onShare: () => void;
  onRewind: (ratio: number) => void;
};

export function TimeControls({
  settings,
  historyLength,
  shareCopied,
  onSettingsChange,
  onClear,
  onShare,
  onRewind
}: TimeControlsProps) {
  return (
    <section className="time-controls" aria-label="Simulation controls">
      <div className="control-cluster playback-cluster">
        <button
          type="button"
          className="primary-round"
          onClick={() => onSettingsChange({ paused: !settings.paused })}
          aria-label={settings.paused ? "Play" : "Pause"}
          title={settings.paused ? "Play" : "Pause"}
        >
          {settings.paused ? <Play size={19} /> : <Pause size={19} />}
        </button>
        <button type="button" className="icon-action" onClick={() => onRewind(0)} aria-label="Rewind" title="Rewind">
          <RotateCcw size={17} />
        </button>
        <button type="button" className="icon-action" onClick={onClear} aria-label="Clear all" title="Clear all">
          <Trash2 size={17} />
        </button>
        <button type="button" className="icon-action" onClick={onShare} aria-label="Share state" title="Share state">
          <Share2 size={17} />
          <span>{shareCopied ? "Copied" : "Share"}</span>
        </button>
      </div>

      <div className="slider-cluster">
        <Slider
          icon={<Gauge size={15} />}
          label="Time"
          value={settings.timeScale}
          min={0.1}
          max={10}
          step={0.1}
          suffix="x"
          onChange={(timeScale) => onSettingsChange({ timeScale })}
        />
        <Slider
          icon={<Activity size={15} />}
          label="Gravity"
          value={settings.gravity}
          min={1}
          max={60}
          step={1}
          onChange={(gravity) => onSettingsChange({ gravity })}
        />
        <Slider
          icon={<Brain size={15} />}
          label="Law"
          value={settings.forceExponent}
          min={1}
          max={3}
          step={0.05}
          suffix=""
          onChange={(forceExponent) => onSettingsChange({ forceExponent })}
        />
        <label className="slider-row rewind-row">
          <span>
            <RotateCcw size={15} />
            Rewind
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            defaultValue={100}
            disabled={historyLength < 2}
            onChange={(event) => onRewind(Number(event.target.value) / 100)}
          />
        </label>
      </div>

      <div className="toggle-cluster">
        <Toggle icon={<Sparkles size={16} />} label="Trails" active={settings.trails} onClick={() => onSettingsChange({ trails: !settings.trails })} />
        <Toggle icon={<Grid3X3 size={16} />} label="Grid" active={settings.grid} onClick={() => onSettingsChange({ grid: !settings.grid })} />
        <Toggle icon={<Map size={16} />} label="Field" active={settings.heatmap} onClick={() => onSettingsChange({ heatmap: !settings.heatmap })} />
        <Toggle icon={<Waves size={16} />} label="Lines" active={settings.fieldLines} onClick={() => onSettingsChange({ fieldLines: !settings.fieldLines })} />
        <Toggle icon={<Radar size={16} />} label="Bary" active={settings.barycenter} onClick={() => onSettingsChange({ barycenter: !settings.barycenter })} />
        <Toggle icon={<Activity size={16} />} label="Lagrange" active={settings.lagrange} onClick={() => onSettingsChange({ lagrange: !settings.lagrange })} />
        <Toggle icon={<Brain size={16} />} label="Dark" active={settings.darkMatterVisible} onClick={() => onSettingsChange({ darkMatterVisible: !settings.darkMatterVisible })} />
        <Toggle
          icon={settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          label="Sound"
          active={settings.sound}
          onClick={() => onSettingsChange({ sound: !settings.sound })}
        />
      </div>
    </section>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-row">
      <span>
        {icon}
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>
        {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
        {suffix}
      </strong>
    </label>
  );
}

function Toggle({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`toggle-button ${active ? "is-active" : ""}`} onClick={onClick} title={label} aria-pressed={active}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
