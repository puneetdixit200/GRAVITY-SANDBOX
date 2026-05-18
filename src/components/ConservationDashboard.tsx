"use client";

import type { SimulationStats } from "./sandboxTypes";

type ConservationDashboardProps = {
  history: SimulationStats[];
};

export function ConservationDashboard({ history }: ConservationDashboardProps) {
  const energy = normalizeSeries(history.map((item) => item.energy));
  const momentum = normalizeSeries(history.map((item) => item.momentum));
  const angular = normalizeSeries(history.map((item) => item.angularMomentum));

  return (
    <section className="conservation-panel" aria-label="Conservation dashboard">
      <header>
        <span className="eyebrow">Conservation</span>
        <strong>Energy / Momentum / Angular</strong>
      </header>
      <svg viewBox="0 0 220 86" role="img" aria-label="Conservation graph">
        <Grid />
        <polyline points={toPoints(energy)} className="energy-line" />
        <polyline points={toPoints(momentum)} className="momentum-line" />
        <polyline points={toPoints(angular)} className="angular-line" />
      </svg>
      <div className="legend">
        <span className="energy-dot">Energy</span>
        <span className="momentum-dot">Momentum</span>
        <span className="angular-dot">Angular</span>
      </div>
    </section>
  );
}

function Grid() {
  return (
    <g className="graph-grid">
      {[18, 43, 68].map((y) => (
        <line key={y} x1="0" y1={y} x2="220" y2={y} />
      ))}
    </g>
  );
}

function normalizeSeries(values: number[]) {
  if (values.length === 0) {
    return [0.5];
  }
  const finite = values.map((value) => (Number.isFinite(value) ? value : 0));
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (Math.abs(max - min) < 1e-9) {
    return finite.map(() => 0.5);
  }
  return finite.map((value) => (value - min) / (max - min));
}

function toPoints(values: number[]) {
  const width = 220;
  const height = 78;
  const pad = 4;
  return values
    .slice(-80)
    .map((value, index, list) => {
      const x = list.length <= 1 ? 0 : (index / (list.length - 1)) * width;
      const y = pad + (1 - value) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
