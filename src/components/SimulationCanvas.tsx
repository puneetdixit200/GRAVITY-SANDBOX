"use client";

import { useMemo, useRef } from "react";
import {
  Body,
  Simulation,
  SimulationEffect,
  magnitude,
  totalMomentum
} from "@/engine/Simulation";
import { CanvasRenderer } from "@/renderer/CanvasRenderer";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { usePlacement } from "@/hooks/usePlacement";
import type { SandboxSettings, SimulationStats } from "./sandboxTypes";

type SimulationCanvasProps = {
  simulation: Simulation;
  settings: SandboxSettings;
  onSelectBody: (body: Body | null, position?: { x: number; y: number }) => void;
  onBodiesChanged: () => void;
  onStats: (stats: SimulationStats) => void;
  onAudioFrame: (bodies: Body[]) => void;
  onEffects: (effects: SimulationEffect[]) => void;
};

export function SimulationCanvas({
  simulation,
  settings,
  onSelectBody,
  onBodiesChanged,
  onStats,
  onAudioFrame,
  onEffects
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer = useMemo(() => new CanvasRenderer(), []);
  const lastStatsRef = useRef(0);
  const frameCounterRef = useRef({ frames: 0, fps: 60, time: 0 });
  const effectIdsRef = useRef(new Set<string>());

  const placement = usePlacement({
    canvasRef,
    simulation,
    selectedType: settings.selectedType,
    darkMatterVisible: settings.darkMatterVisible,
    onSelectBody,
    onBodiesChanged
  });

  useAnimationLoop((dt, now) => {
    simulation.gravity = settings.gravity;
    simulation.forceExponent = settings.forceExponent;

    frameCounterRef.current.frames += 1;
    if (now - frameCounterRef.current.time > 500) {
      frameCounterRef.current.fps = (frameCounterRef.current.frames * 1000) / Math.max(1, now - frameCounterRef.current.time);
      frameCounterRef.current.frames = 0;
      frameCounterRef.current.time = now;
    }

    if (!settings.paused) {
      const substeps = simulation.bodies.length > 220 ? 1 : settings.timeScale > 6 ? 4 : 3;
      simulation.step(dt * settings.timeScale, substeps);
    }

    const currentEffectIds = new Set(simulation.effects.map((effect) => effect.id));
    const newEffects = simulation.effects.filter((effect) => !effectIdsRef.current.has(effect.id));
    effectIdsRef.current = currentEffectIds;
    if (newEffects.length > 0) {
      onEffects(newEffects);
    }

    onAudioFrame(simulation.bodies);

    const preview = placement.touchPlacementRef.current ?? placement.placementRef.current;
    if (canvasRef.current) {
      renderer.render(
        canvasRef.current,
        simulation,
        {
          trails: settings.trails,
          grid: settings.grid,
          heatmap: settings.heatmap,
          fieldLines: settings.fieldLines,
          barycenter: settings.barycenter,
          lagrange: settings.lagrange,
          darkMatterVisible: settings.darkMatterVisible,
          placement: preview
        },
        now
      );
    }

    if (now - lastStatsRef.current > 220) {
      lastStatsRef.current = now;
      const momentum = totalMomentum(simulation.bodies);
      onStats({
        bodyCount: simulation.bodies.length,
        energy: simulation.totalEnergy(),
        momentum: magnitude(momentum),
        angularMomentum: simulation.totalAngularMomentum(),
        elapsed: simulation.elapsed,
        fps: frameCounterRef.current.fps,
        historyLength: simulation.historyLength()
      });
    }
  });

  return (
    <canvas
      ref={canvasRef}
      className="simulation-canvas"
      aria-label="Gravity simulation canvas"
      {...placement.handlers}
    />
  );
}
