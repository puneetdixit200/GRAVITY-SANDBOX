"use client";

import { Activity, BookOpen, Orbit, Sigma } from "lucide-react";
import type { SimulationStats, TeachEvent } from "./sandboxTypes";

type TeachPanelProps = {
  stats: SimulationStats;
  events: TeachEvent[];
};

export function TeachPanel({ stats, events }: TeachPanelProps) {
  return (
    <section className="teach-panel" aria-label="Teach mode">
      <header>
        <div>
          <span className="eyebrow">Teach Mode</span>
          <h2>What is happening</h2>
        </div>
        <BookOpen size={18} />
      </header>

      <div className="teach-summary">
        <TeachMetric icon={<Activity size={14} />} label="Bodies" value={stats.bodyCount.toString()} />
        <TeachMetric icon={<Orbit size={14} />} label="Turn" value={`${stats.averageTurnDegrees.toFixed(2)} deg/s`} />
        <TeachMetric icon={<Sigma size={14} />} label="Solver" value={stats.forceMode} />
      </div>

      <p>
        Gravity is adding acceleration toward massive bodies. When acceleration is not parallel to velocity, the body&apos;s heading
        bends; the turn reading estimates that heading change from the live velocity and acceleration vectors.
      </p>

      <ol className="teach-log" aria-label="Teach event log">
        <li key="teach-live">
          <time>live</time>
          <span>Simulation vectors, collisions, presets, and gravity events are being logged here.</span>
        </li>
        {events.slice(0, 18).map((event) => (
          <li key={event.id}>
            <time>{event.time}</time>
            <span>{event.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TeachMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <span className="stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
