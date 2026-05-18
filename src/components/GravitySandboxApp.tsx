"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Body, Simulation, decodeShareState, encodeShareState } from "@/engine/Simulation";
import { PresetKey, createPreset } from "@/engine/Presets";
import { useSoundscape } from "@/hooks/useSoundscape";
import { BackgroundStars } from "./BackgroundStars";
import { BodyInfoPopup } from "./BodyInfoPopup";
import { BodyToolbar } from "./BodyToolbar";
import { ConservationDashboard } from "./ConservationDashboard";
import { PresetLoader } from "./PresetLoader";
import { SimulationCanvas } from "./SimulationCanvas";
import { StatsOverlay } from "./StatsOverlay";
import { TimeControls } from "./TimeControls";
import type { SandboxSettings, SimulationStats } from "./sandboxTypes";

const DEFAULT_STATS: SimulationStats = {
  bodyCount: 0,
  energy: 0,
  momentum: 0,
  angularMomentum: 0,
  elapsed: 0,
  fps: 60,
  historyLength: 0
};

const INITIAL_SETTINGS: SandboxSettings = {
  selectedType: "planet",
  paused: false,
  timeScale: 4,
  gravity: 20,
  forceExponent: 2,
  trails: true,
  grid: true,
  heatmap: false,
  fieldLines: false,
  barycenter: true,
  lagrange: false,
  darkMatterVisible: false,
  sound: false,
  conservation: true
};

export function GravitySandboxApp() {
  const simulationRef = useRef<Simulation | null>(null);
  const [settings, setSettings] = useState<SandboxSettings>(INITIAL_SETTINGS);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("solarSystem");
  const [stats, setStats] = useState<SimulationStats>(DEFAULT_STATS);
  const [statsHistory, setStatsHistory] = useState<SimulationStats[]>([]);
  const [selected, setSelected] = useState<{ id: string; anchor: { x: number; y: number } } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [version, setVersion] = useState(0);
  const soundscape = useSoundscape(settings.sound);

  if (!simulationRef.current) {
    simulationRef.current = new Simulation({
      bodies: createPreset("solarSystem", { width: 1200, height: 800 }),
      gravity: INITIAL_SETTINGS.gravity,
      forceExponent: INITIAL_SETTINGS.forceExponent,
      historyLimit: 720
    });
  }

  const simulation = simulationRef.current;

  useEffect(() => {
    const dimensions = { width: window.innerWidth, height: window.innerHeight };
    const stateParam = new URLSearchParams(window.location.search).get("state");
    if (stateParam) {
      try {
        const decoded = decodeShareState(stateParam);
        simulation.setBodies(decoded.bodies);
        setSettings((current) => ({
          ...current,
          gravity: decoded.gravity,
          timeScale: decoded.timeScale,
          forceExponent: decoded.forceExponent
        }));
        setActivePreset(null);
        setVersion((current) => current + 1);
        return;
      } catch {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    simulation.setBodies(createPreset("solarSystem", dimensions));
    setVersion((current) => current + 1);
  }, [simulation]);

  const selectedBody = selected ? simulation.bodies.find((body) => body.id === selected.id) ?? null : null;

  const updateSettings = useCallback((patch: Partial<SandboxSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const loadPreset = useCallback(
    (preset: PresetKey) => {
      const dimensions = { width: window.innerWidth, height: window.innerHeight };
      simulation.setBodies(createPreset(preset, dimensions));
      setActivePreset(preset);
      setSelected(null);
      setStatsHistory([]);
      setVersion((current) => current + 1);
    },
    [simulation]
  );

  const handleSelectBody = useCallback((body: Body | null, position = { x: 0, y: 0 }) => {
    setSelected(body ? { id: body.id, anchor: position } : null);
  }, []);

  const handleStats = useCallback((nextStats: SimulationStats) => {
    setStats(nextStats);
    setStatsHistory((history) => {
      const next = history.concat(nextStats);
      return next.length > 90 ? next.slice(next.length - 90) : next;
    });
  }, []);

  const clear = useCallback(() => {
    simulation.clear();
    setSelected(null);
    setActivePreset(null);
    setStatsHistory([]);
    setVersion((current) => current + 1);
  }, [simulation]);

  const removeBody = useCallback(
    (body: Body) => {
      simulation.removeBody(body.id);
      setSelected(null);
      setActivePreset(null);
      setVersion((current) => current + 1);
    },
    [simulation]
  );

  const share = useCallback(async () => {
    const encoded = encodeShareState({
      bodies: simulation.snapshot(),
      gravity: settings.gravity,
      timeScale: settings.timeScale,
      forceExponent: settings.forceExponent
    });
    const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", `?state=${encoded}`);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1600);
  }, [settings.forceExponent, settings.gravity, settings.timeScale, simulation]);

  const rewind = useCallback(
    (ratio: number) => {
      simulation.rewindTo(ratio);
      setSettings((current) => ({ ...current, paused: true }));
      setSelected(null);
      setVersion((current) => current + 1);
    },
    [simulation]
  );

  return (
    <main className="sandbox-shell">
      <BackgroundStars />
      <SimulationCanvas
        key={version}
        simulation={simulation}
        settings={settings}
        onSelectBody={handleSelectBody}
        onBodiesChanged={() => {
          setActivePreset(null);
          setVersion((current) => current + 1);
        }}
        onStats={handleStats}
        onAudioFrame={soundscape.update}
        onEffects={soundscape.trigger}
      />
      <BodyToolbar selectedType={settings.selectedType} onSelectType={(selectedType) => updateSettings({ selectedType })} />
      <PresetLoader activePreset={activePreset} onLoadPreset={loadPreset} />
      <StatsOverlay stats={stats} />
      {settings.conservation ? <ConservationDashboard history={statsHistory} /> : null}
      <BodyInfoPopup body={selectedBody} anchor={selected?.anchor ?? null} onClose={() => setSelected(null)} onRemove={removeBody} />
      <TimeControls
        settings={settings}
        historyLength={stats.historyLength}
        shareCopied={shareCopied}
        onSettingsChange={updateSettings}
        onClear={clear}
        onShare={share}
        onRewind={rewind}
      />
    </main>
  );
}
