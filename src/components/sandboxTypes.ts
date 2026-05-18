import type { BodyType } from "@/engine/Simulation";

export type SandboxSettings = {
  selectedType: BodyType;
  paused: boolean;
  timeScale: number;
  gravity: number;
  forceExponent: number;
  trails: boolean;
  grid: boolean;
  heatmap: boolean;
  fieldLines: boolean;
  barycenter: boolean;
  lagrange: boolean;
  darkMatterVisible: boolean;
  sound: boolean;
  conservation: boolean;
};

export type SimulationStats = {
  bodyCount: number;
  energy: number;
  momentum: number;
  angularMomentum: number;
  elapsed: number;
  fps: number;
  historyLength: number;
};
