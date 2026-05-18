"use client";

import { PointerEvent, TouchEvent, useRef } from "react";
import {
  BODY_DEFINITIONS,
  Body,
  BodyType,
  Simulation,
  Vector,
  distance,
  makeBody
} from "@/engine/Simulation";

export type PlacementPreview = {
  start: Vector;
  current: Vector;
  active: boolean;
};

type UsePlacementOptions = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  simulation: Simulation;
  selectedType: BodyType;
  darkMatterVisible: boolean;
  onSelectBody: (body: Body | null, position?: Vector) => void;
  onBodiesChanged: () => void;
  onBodyPlaced?: (body: Body) => void;
};

const PLANET_COLORS = ["#4a9eff", "#ff6b4a", "#50e890", "#ffb84a", "#c77dff", "#5eead4"];

export function usePlacement({
  canvasRef,
  simulation,
  selectedType,
  darkMatterVisible,
  onSelectBody,
  onBodiesChanged,
  onBodyPlaced
}: UsePlacementOptions) {
  const placementRef = useRef<PlacementPreview | null>(null);
  const colorIndexRef = useRef(0);
  const touchPlacementRef = useRef<PlacementPreview | null>(null);

  const pointFromClient = (clientX: number, clientY: number): Vector => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const findBody = (point: Vector) => {
    for (let i = simulation.bodies.length - 1; i >= 0; i -= 1) {
      const body = simulation.bodies[i];
      if (body.hidden && !darkMatterVisible) {
        continue;
      }
      if (distance(point, body.position) <= body.radius + 8) {
        return body;
      }
    }
    return null;
  };

  const nextColor = (type: BodyType) => {
    if (type === "planet") {
      const color = PLANET_COLORS[colorIndexRef.current % PLANET_COLORS.length];
      colorIndexRef.current += 1;
      return color;
    }
    return BODY_DEFINITIONS[type].color;
  };

  const placeBody = (preview: PlacementPreview | null) => {
    if (!preview) {
      return;
    }

    const drag = {
      x: preview.current.x - preview.start.x,
      y: preview.current.y - preview.start.y
    };
    const velocity = distance(preview.start, preview.current) < 5 ? { x: 0, y: 0 } : { x: drag.x * 0.08, y: drag.y * 0.08 };
    const body = makeBody(selectedType, preview.start, velocity, {
      color: nextColor(selectedType),
      hidden: selectedType === "darkMatter"
    });
    simulation.addBody(body);
    onSelectBody(body, preview.start);
    onBodyPlaced?.(body);
    onBodiesChanged();
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch") {
      return;
    }

    const point = pointFromClient(event.clientX, event.clientY);
    const body = findBody(point);

    if (body) {
      onSelectBody(body, point);
      placementRef.current = null;
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    placementRef.current = { start: point, current: point, active: true };
    onSelectBody(null);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!placementRef.current || event.pointerType === "touch") {
      return;
    }
    placementRef.current.current = pointFromClient(event.clientX, event.clientY);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch") {
      return;
    }
    placeBody(placementRef.current);
    placementRef.current = null;
  };

  const onPointerCancel = () => {
    placementRef.current = null;
  };

  const midpointFromTouches = (event: TouchEvent<HTMLCanvasElement>): Vector => {
    const [a, b] = [event.touches[0], event.touches[1]];
    return pointFromClient((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
  };

  const onTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const point = pointFromClient(touch.clientX, touch.clientY);
      const body = findBody(point);
      if (body) {
        onSelectBody(body, point);
        return;
      }
      touchPlacementRef.current = { start: point, current: point, active: true };
      onSelectBody(null);
      return;
    }

    if (event.touches.length >= 2) {
      event.preventDefault();
      const midpoint = midpointFromTouches(event);
      touchPlacementRef.current = { start: midpoint, current: midpoint, active: true };
    }
  };

  const onTouchMove = (event: TouchEvent<HTMLCanvasElement>) => {
    if (!touchPlacementRef.current) {
      return;
    }
    event.preventDefault();
    if (event.touches.length >= 2) {
      touchPlacementRef.current.current = midpointFromTouches(event);
      return;
    }
    const touch = event.touches[0];
    touchPlacementRef.current.current = pointFromClient(touch.clientX, touch.clientY);
  };

  const onTouchEnd = () => {
    placeBody(touchPlacementRef.current);
    touchPlacementRef.current = null;
  };

  return {
    placementRef,
    touchPlacementRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onTouchStart,
      onTouchMove,
      onTouchEnd
    }
  };
}
