import { BODY_DEFINITIONS, Body } from "@/engine/Simulation";

export function drawTrails(ctx: CanvasRenderingContext2D, bodies: Body[], trailsEnabled: boolean) {
  if (!trailsEnabled) {
    return;
  }

  const denseScene = bodies.length > 120;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const body of bodies) {
    if (body.trail.length < 2 || body.type === "asteroid" || body.hidden || (denseScene && body.type === "debris")) {
      continue;
    }

    const definition = BODY_DEFINITIONS[body.type];
    const width = definition.trailWidth;
    if (width <= 0) {
      continue;
    }

    const stride = denseScene ? Math.max(1, Math.floor(body.trail.length / 42)) : 1;

    for (let i = stride; i < body.trail.length; i += stride) {
      const previous = body.trail[i - stride];
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
