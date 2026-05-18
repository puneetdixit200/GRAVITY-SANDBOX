"use client";

import { GripHorizontal } from "lucide-react";
import { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from "react";

type PanelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MovablePanelProps = {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
  defaultLayout: () => PanelLayout;
  minWidth?: number;
  minHeight?: number;
  persist?: boolean;
  resetKey?: string | number | null;
  initialZIndex?: number;
};

type Interaction = {
  kind: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  layout: PanelLayout;
};

const FALLBACK_LAYOUT: PanelLayout = { x: 16, y: 16, width: 280, height: 180 };
let topPanelZ = 10;

export type { PanelLayout };

export function MovablePanel({
  id,
  title,
  className = "",
  children,
  defaultLayout,
  minWidth = 120,
  minHeight = 72,
  persist = true,
  resetKey = null,
  initialZIndex = 3
}: MovablePanelProps) {
  const [layout, setLayout] = useState<PanelLayout>(FALLBACK_LAYOUT);
  const [ready, setReady] = useState(false);
  const [zIndex, setZIndex] = useState(initialZIndex);
  const layoutRef = useRef<PanelLayout>(FALLBACK_LAYOUT);
  const interactionRef = useRef<Interaction | null>(null);
  const defaultLayoutRef = useRef(defaultLayout);
  defaultLayoutRef.current = defaultLayout;

  useEffect(() => {
    const storageKey = panelStorageKey(id);
    const saved = persist ? readLayout(storageKey) : null;
    const next = clampLayout(saved ?? defaultLayoutRef.current(), minWidth, minHeight);
    layoutRef.current = next;
    setLayout(next);
    setReady(true);
  }, [id, minHeight, minWidth, persist, resetKey]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      updateInteraction(event.pointerId, event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      finishInteraction(event.pointerId);
    };
    const onMouseMove = (event: MouseEvent) => {
      updateInteraction(-1, event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      finishInteraction(-1);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  const startInteraction = (kind: Interaction["kind"], event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setZIndex(topPanelZ += 1);
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layout: layoutRef.current
    };
  };

  const startMouseInteraction = (kind: Interaction["kind"], event: ReactMouseEvent<HTMLElement>) => {
    if (interactionRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setZIndex(topPanelZ += 1);
    interactionRef.current = {
      kind,
      pointerId: -1,
      startX: event.clientX,
      startY: event.clientY,
      layout: layoutRef.current
    };
  };

  const updateInteraction = (pointerId: number, clientX: number, clientY: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== pointerId) {
      return;
    }

    const dx = clientX - interaction.startX;
    const dy = clientY - interaction.startY;
    const next =
      interaction.kind === "move"
        ? {
            ...interaction.layout,
            x: interaction.layout.x + dx,
            y: interaction.layout.y + dy
          }
        : {
            ...interaction.layout,
            width: interaction.layout.width + dx,
            height: interaction.layout.height + dy
          };

    const clamped = clampLayout(next, minWidth, minHeight);
    layoutRef.current = clamped;
    setLayout(clamped);
  };

  const finishInteraction = (pointerId: number) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== pointerId) {
      return;
    }
    interactionRef.current = null;
    if (persist) {
      window.localStorage.setItem(panelStorageKey(id), JSON.stringify(layoutRef.current));
    }
  };

  return (
    <section
      className={`panel-frame ${className}`}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        visibility: ready ? "visible" : "hidden",
        zIndex
      }}
      onFocusCapture={() => setZIndex(topPanelZ += 1)}
      aria-label={`${id} movable panel`}
    >
      <header
        className="panel-drag-handle"
        aria-label={`Move ${id} panel`}
        title={`Move ${title}`}
        onPointerDown={(event) => startInteraction("move", event)}
        onMouseDown={(event) => startMouseInteraction("move", event)}
      >
        <GripHorizontal size={15} />
        <span>{title}</span>
      </header>
      <div className="panel-content">{children}</div>
      <button
        type="button"
        className="panel-resize-handle"
        aria-label={`Resize ${id} panel`}
        title={`Resize ${title}`}
        onPointerDown={(event) => startInteraction("resize", event)}
        onMouseDown={(event) => startMouseInteraction("resize", event)}
      />
    </section>
  );
}

function panelStorageKey(id: string) {
  return `gravity-sandbox-panel-v2-${id}`;
}

function readLayout(key: string): PanelLayout | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return null;
    }
    return parsed as PanelLayout;
  } catch {
    return null;
  }
}

function clampLayout(layout: PanelLayout, minWidth: number, minHeight: number): PanelLayout {
  if (typeof window === "undefined") {
    return layout;
  }

  const maxWidth = Math.max(minWidth, window.innerWidth - 16);
  const maxHeight = Math.max(minHeight, window.innerHeight - 16);
  const width = Math.min(Math.max(minWidth, layout.width), maxWidth);
  const height = Math.min(Math.max(minHeight, layout.height), maxHeight);

  return {
    x: Math.min(Math.max(8, layout.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, layout.y), Math.max(8, window.innerHeight - height - 8)),
    width,
    height
  };
}
