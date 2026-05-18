"use client";

import { GitFork } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Body, Simulation, decodeShareState, encodeShareState } from "@/engine/Simulation";
import { PRESETS, PresetKey, createPreset } from "@/engine/Presets";
import { useSoundscape } from "@/hooks/useSoundscape";
import { BackgroundStars } from "./BackgroundStars";
import { BodyInfoPopup } from "./BodyInfoPopup";
import { BodyToolbar } from "./BodyToolbar";
import { ConservationDashboard } from "./ConservationDashboard";
import { MovablePanel, PanelLayout } from "./MovablePanel";
import { PresetLoader } from "./PresetLoader";
import { SimulationCanvas } from "./SimulationCanvas";
import { StatsOverlay } from "./StatsOverlay";
import { TeachPanel } from "./TeachPanel";
import { TimeControls } from "./TimeControls";
import type { SandboxSettings, SimulationStats, TeachEvent } from "./sandboxTypes";

const DEFAULT_STATS: SimulationStats = {
  bodyCount: 0,
  energy: 0,
  momentum: 0,
  angularMomentum: 0,
  elapsed: 0,
  fps: 60,
  historyLength: 0,
  averageTurnDegrees: 0,
  forceMode: "direct"
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
  conservation: true,
  teachMode: false,
  view3d: false
};

const INITIAL_EVENTS: TeachEvent[] = [
  {
    id: "event-ready",
    time: "0.0s",
    message: "Simulation ready with the Solar System preset."
  }
];

export function GravitySandboxApp() {
  const simulationRef = useRef<Simulation | null>(null);
  const [settings, setSettings] = useState<SandboxSettings>(INITIAL_SETTINGS);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("solarSystem");
  const [stats, setStats] = useState<SimulationStats>(DEFAULT_STATS);
  const [statsHistory, setStatsHistory] = useState<SimulationStats[]>([]);
  const [teachEvents, setTeachEvents] = useState<TeachEvent[]>(INITIAL_EVENTS);
  const [selected, setSelected] = useState<{ id: string; anchor: { x: number; y: number } } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [version, setVersion] = useState(0);
  const eventIdRef = useRef(0);
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

  const logEvent = useCallback(
    (message: string) => {
      setTeachEvents((events) => {
        if (events[0]?.message === message) {
          return events;
        }
        return [
          {
            id: `event-${eventIdRef.current += 1}`,
            time: `${simulation.elapsed.toFixed(1)}s`,
            message
          },
          ...events
        ].slice(0, 24);
      });
    },
    [simulation]
  );

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
      logEvent(`Loaded ${labelForPreset(preset)} preset.`);
      setVersion((current) => current + 1);
    },
    [logEvent, simulation]
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
    logEvent("Cleared all bodies from the sandbox.");
    setVersion((current) => current + 1);
  }, [logEvent, simulation]);

  const removeBody = useCallback(
    (body: Body) => {
      simulation.removeBody(body.id);
      setSelected(null);
      setActivePreset(null);
      logEvent(`Removed ${body.name}.`);
      setVersion((current) => current + 1);
    },
    [logEvent, simulation]
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
    logEvent("Copied a shareable state URL.");
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1600);
  }, [logEvent, settings.forceExponent, settings.gravity, settings.timeScale, simulation]);

  const rewind = useCallback(
    (ratio: number) => {
      simulation.rewindTo(ratio);
      setSettings((current) => ({ ...current, paused: true }));
      setSelected(null);
      logEvent(`Rewound history to ${(ratio * 100).toFixed(0)}%.`);
      setVersion((current) => current + 1);
    },
    [logEvent, simulation]
  );

  const handleEffects = useCallback(
    (effects: Parameters<typeof soundscape.trigger>[0]) => {
      soundscape.trigger(effects);
      const kinds = new Set(effects.map((effect) => effect.kind));
      for (const kind of kinds) {
        logEvent(messageForEffect(kind));
      }
    },
    [logEvent, soundscape]
  );

  return (
    <main className="sandbox-shell" data-view-mode={settings.view3d ? "3d" : "2d"}>
      <BackgroundStars />
      <SimulationCanvas
        key={version}
        simulation={simulation}
        settings={settings}
        onSelectBody={handleSelectBody}
        onBodiesChanged={() => {
          setActivePreset(null);
          logEvent(`Placed ${settings.selectedType}.`);
          setVersion((current) => current + 1);
        }}
        onStats={handleStats}
        onAudioFrame={soundscape.update}
        onEffects={handleEffects}
        onBodyPlaced={(body) => logEvent(`${body.name} launched at velocity ${Math.hypot(body.velocity.x, body.velocity.y).toFixed(2)}.`)}
      />
      <MovablePanel id="toolbar" title="Body tools" className="panel-toolbar" defaultLayout={toolbarLayout} minWidth={96} minHeight={70}>
        <BodyToolbar selectedType={settings.selectedType} onSelectType={(selectedType) => updateSettings({ selectedType })} />
      </MovablePanel>
      <MovablePanel id="presets" title="Presets" className="panel-presets" defaultLayout={presetLayout} minWidth={260} minHeight={72}>
        <PresetLoader activePreset={activePreset} onLoadPreset={loadPreset} />
      </MovablePanel>
      <MovablePanel id="stats" title="Simulation stats" className="panel-stats" defaultLayout={statsLayout} minWidth={190} minHeight={150}>
        <StatsOverlay stats={stats} />
      </MovablePanel>
      {settings.conservation ? (
        <MovablePanel id="conservation" title="Conservation" className="panel-conservation" defaultLayout={conservationLayout} minWidth={230} minHeight={170}>
          <ConservationDashboard history={statsHistory} />
        </MovablePanel>
      ) : null}
      {settings.teachMode ? (
        <MovablePanel id="teach" title="Teach mode" className="panel-teach" defaultLayout={teachLayout} minWidth={310} minHeight={260}>
          <TeachPanel stats={stats} events={teachEvents} />
        </MovablePanel>
      ) : null}
      {selectedBody && selected ? (
        <MovablePanel
          id="body-info"
          title="Body details"
          className="panel-body-info"
          defaultLayout={() => bodyInfoLayout(selected.anchor)}
          minWidth={220}
          minHeight={210}
          persist={false}
          resetKey={selectedBody.id}
        >
          <BodyInfoPopup body={selectedBody} anchor={selected.anchor} onClose={() => setSelected(null)} onRemove={removeBody} />
        </MovablePanel>
      ) : null}
      <MovablePanel id="time-controls" title="Controls" className="panel-controls" defaultLayout={controlsLayout} minWidth={320} minHeight={170}>
        <TimeControls
          settings={settings}
          historyLength={stats.historyLength}
          shareCopied={shareCopied}
          onSettingsChange={updateSettings}
          onClear={clear}
          onShare={share}
          onRewind={rewind}
        />
      </MovablePanel>
      <a className="github-link" href="https://github.com/puneetdixit200" target="_blank" rel="noreferrer" aria-label="GitHub profile">
        <GitFork size={16} />
        <span>GitHub</span>
      </a>
    </main>
  );
}

function labelForPreset(key: PresetKey): string {
  return PRESETS.find((preset) => preset.key === key)?.label ?? key;
}

function messageForEffect(kind: string): string {
  if (kind === "collision") {
    return "Collision detected: overlapping bodies merged and momentum was conserved.";
  }
  if (kind === "absorb") {
    return "Black hole absorption: a body crossed the event horizon.";
  }
  if (kind === "roche") {
    return "Roche limit event: tidal gravity tore a body into debris.";
  }
  return "Gravitational wave ripple emitted by nearby massive bodies.";
}

function toolbarLayout(): PanelLayout {
  const { width, height } = viewport();
  if (width < 700) {
    return { x: 8, y: 8, width: width - 16, height: 76 };
  }
  return { x: 16, y: 16, width: 108, height: Math.max(360, height - 188) };
}

function presetLayout(): PanelLayout {
  const { width } = viewport();
  if (width < 700) {
    return { x: 8, y: 92, width: width - 16, height: 58 };
  }
  return { x: 140, y: 16, width: Math.min(720, Math.max(280, width - 560)), height: 58 };
}

function statsLayout(): PanelLayout {
  const { width } = viewport();
  if (width < 700) {
    return { x: Math.max(8, width - 166), y: 166, width: 158, height: 188 };
  }
  return { x: Math.max(8, width - 214), y: 16, width: 198, height: 176 };
}

function conservationLayout(): PanelLayout {
  const { width } = viewport();
  if (width < 700) {
    return { x: 8, y: 364, width: width - 16, height: 214 };
  }
  return { x: Math.max(8, width - 282), y: 214, width: 266, height: 222 };
}

function teachLayout(): PanelLayout {
  const { width } = viewport();
  if (width < 700) {
    return { x: 8, y: 220, width: width - 16, height: 330 };
  }
  return { x: Math.max(140, width - 686), y: 84, width: 392, height: 360 };
}

function controlsLayout(): PanelLayout {
  const { width, height } = viewport();
  if (width < 700) {
    return { x: 8, y: Math.max(8, height - 270), width: width - 16, height: 254 };
  }
  const panelWidth = Math.min(1060, width - 32);
  return { x: Math.max(8, (width - panelWidth) / 2), y: Math.max(8, height - 188), width: panelWidth, height: 172 };
}

function bodyInfoLayout(anchor: { x: number; y: number }): PanelLayout {
  const { width, height } = viewport();
  return {
    x: Math.min(width - 258, Math.max(12, anchor.x + 16)),
    y: Math.min(height - 256, Math.max(12, anchor.y + 16)),
    width: 242,
    height: 236
  };
}

function viewport() {
  if (typeof window === "undefined") {
    return { width: 1200, height: 800 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}
