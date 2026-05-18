import { BODY_DEFINITIONS, Body } from "@/engine/Simulation";

export function drawTrails(ctx: CanvasRenderingContext2D, bodies: Body[], trailsEnabled: boolean) {
  if (!trailsEnabled) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const body of bodies) {
    if (body.trail.length < 2 || body.type === "asteroid" || body.hidden) {
      continue;
    }

    const definition = BODY_DEFINITIONS[body.type];
    const width = definition.trailWidth;
    if (width <= 0) {
      continue;
    }

    for (let i = 1; i < body.trail.length; i += 1) {
      const previous = body.trail[i - 1];
      const current = body.trail[i];
      const alpha = (i / body.trail.length) * 0.42;
      ctx.strokeStyle = alphaColor(body.color, alpha);
      ctx.lineWidth = width * (0.45 + i / body.trail.length);
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function alphaColor(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const value = color.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
