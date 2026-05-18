"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Body,
  Simulation,
  SimulationEffect,
  add,
  headingDegrees,
  magnitude,
  scale,
  shortestAngleDeltaDegrees,
  totalMomentum
} from "@/engine/Simulation";
import { CanvasRenderer } from "@/renderer/CanvasRenderer";
import { useAnimationLoop } from "@/hooks/useAnimationLoop";
import { usePlacement } from "@/hooks/usePlacement";
import type { SandboxSettings, SimulationStats } from "./sandboxTypes";

type SimulationCanvasProps = {
  simulation: Simulation;
  settings: SandboxSettings;
  cinematicActive: boolean;
  recordRequest: number;
  onSelectBody: (body: Body | null, position?: { x: number; y: number }) => void;
  onBodiesChanged: () => void;
  onStats: (stats: SimulationStats) => void;
  onAudioFrame: (bodies: Body[]) => void;
  onEffects: (effects: SimulationEffect[]) => void;
  onBodyPlaced: (body: Body) => void;
  onRecordingState: (recording: boolean) => void;
  onRecordingComplete: (message: string) => void;
};

export function SimulationCanvas({
  simulation,
  settings,
  cinematicActive,
  recordRequest,
  onSelectBody,
  onBodiesChanged,
  onStats,
  onAudioFrame,
  onEffects,
  onBodyPlaced,
  onRecordingState,
  onRecordingComplete
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer = useMemo(() => new CanvasRenderer(), []);
  const lastStatsRef = useRef(0);
  const lastEnergyRef = useRef({ time: 0, value: 0 });
  const accumulatedDtRef = useRef(0);
  const lastProcessedFrameRef = useRef(0);
  const frameCounterRef = useRef({ frames: 0, fps: 60, time: 0 });
  const effectIdsRef = useRef(new Set<string>());
  const lastRecordRequestRef = useRef(0);

  const placement = usePlacement({
    canvasRef,
    simulation,
    selectedType: settings.selectedType,
    darkMatterVisible: settings.darkMatterVisible,
    gravityGunEnabled: settings.gravityGun,
    gravityGunRepel: settings.gravityGunRepel,
    onSelectBody,
    onBodiesChanged,
    onBodyPlaced
  });

  useEffect(() => {
    if (recordRequest <= 0 || recordRequest === lastRecordRequestRef.current) {
      return;
    }
    lastRecordRequestRef.current = recordRequest;
    startCanvasRecording(canvasRef.current, onRecordingState, onRecordingComplete);
  }, [onRecordingComplete, onRecordingState, recordRequest]);

  useAnimationLoop((dt, now) => {
    accumulatedDtRef.current += dt;
    const crowdedScene = simulation.bodies.length > 120;
    const compactViewport = typeof window !== "undefined" && window.innerWidth < 720;
    const denseScene = crowdedScene || compactViewport;
    const frameBudgetMs = denseScene ? 1000 / 38 : 0;
    if (frameBudgetMs > 0 && now - lastProcessedFrameRef.current < frameBudgetMs) {
      return;
    }
    const frameDt = Math.min(0.08, accumulatedDtRef.current);
    accumulatedDtRef.current = 0;
    lastProcessedFrameRef.current = now;

    simulation.gravity = settings.gravity;
    simulation.forceExponent = settings.forceExponent;

    frameCounterRef.current.frames += 1;
    if (now - frameCounterRef.current.time > 500) {
      frameCounterRef.current.fps = (frameCounterRef.current.frames * 1000) / Math.max(1, now - frameCounterRef.current.time);
      frameCounterRef.current.frames = 0;
      frameCounterRef.current.time = now;
    }

    const activeTimeScale = cinematicActive ? Math.min(settings.timeScale, 0.55) : settings.timeScale;
    const gravityGun = placement.gravityGunRef.current;
    if (!settings.paused && gravityGun?.active) {
      simulation.applyGravityGun(gravityGun.position, frameDt * activeTimeScale, gravityGun.mode);
    }

    if (!settings.paused) {
      const substeps = crowdedScene || simulation.bodies.length > 220 ? 1 : activeTimeScale > 6 ? 4 : 3;
      simulation.step(frameDt * activeTimeScale, substeps);
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
          view3d: settings.view3d,
          prediction: settings.prediction,
          placement: preview,
          gravityGun
        },
        now
      );
    }

    const statsInterval = crowdedScene ? 500 : 220;
    if (now - lastStatsRef.current > statsInterval) {
      lastStatsRef.current = now;
      const momentum = totalMomentum(simulation.bodies);
      if (simulation.bodies.length <= 120 || now - lastEnergyRef.current.time > 1000) {
        lastEnergyRef.current = {
          time: now,
          value: simulation.totalEnergy(simulation.bodies.length > 220 ? { maxPairs: 12_000 } : undefined)
        };
      }
      onStats({
        bodyCount: simulation.bodies.length,
        energy: lastEnergyRef.current.value,
        momentum: magnitude(momentum),
        angularMomentum: simulation.totalAngularMomentum(),
        elapsed: simulation.elapsed,
        fps: frameCounterRef.current.fps,
        historyLength: simulation.historyLength(),
        averageTurnDegrees: averageTurnDegrees(simulation.bodies, frameDt * activeTimeScale),
        forceMode: simulation.lastForceMode
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

function startCanvasRecording(
  canvas: HTMLCanvasElement | null,
  onRecordingState: (recording: boolean) => void,
  onRecordingComplete: (message: string) => void
) {
  if (!canvas || typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    onRecordingComplete("Recording is not available in this browser.");
    return;
  }

  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    onRecordingState(false);
    if (chunks.length === 0) {
      onRecordingComplete("Recording did not capture any frames.");
      return;
    }
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gravity-sandbox-${Date.now()}.webm`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    onRecordingComplete("Exported a WebM replay.");
  };
  onRecordingState(true);
  recorder.start();
  window.setTimeout(() => {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, 6000);
}

function averageTurnDegrees(bodies: Body[], dt: number): number {
  const turns = bodies
    .filter((body) => magnitude(body.velocity) > 0.01 && magnitude(body.acceleration) > 0.0001)
    .map((body) => {
      const before = headingDegrees(body.velocity);
      const after = headingDegrees(add(body.velocity, scale(body.acceleration, dt)));
      return Math.abs(shortestAngleDeltaDegrees(before, after));
    });

  if (turns.length === 0 || dt <= 0) {
    return 0;
  }

  return turns.reduce((total, value) => total + value, 0) / turns.length / dt;
}
