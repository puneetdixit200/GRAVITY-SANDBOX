"use client";

import { Activity, Gauge, History, Sigma } from "lucide-react";
import type { SimulationStats } from "./sandboxTypes";

type StatsOverlayProps = {
  stats: SimulationStats;
};

export function StatsOverlay({ stats }: StatsOverlayProps) {
  return (
    <section className="stats-overlay" aria-label="Simulation stats">
      <Stat icon={<Activity size={14} />} label="Bodies" value={stats.bodyCount.toString()} />
      <Stat icon={<Gauge size={14} />} label="FPS" value={stats.fps.toFixed(0)} />
      <Stat icon={<Sigma size={14} />} label="Energy" value={formatNumber(stats.energy)} />
      <Stat icon={<Activity size={14} />} label="Turn" value={`${stats.averageTurnDegrees.toFixed(1)} deg/s`} />
      <Stat icon={<History size={14} />} label="Time" value={`${stats.elapsed.toFixed(1)}s`} />
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat-row">
      <span className="stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Math.abs(value) > 999999) {
    return value.toExponential(2);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
