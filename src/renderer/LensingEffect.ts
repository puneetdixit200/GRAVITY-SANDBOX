import { Body, Vector, normalize, scale, sub } from "@/engine/Simulation";

export function distortPoint(point: Vector, bodies: Body[]): Vector {
  let offset = { x: 0, y: 0 };

  for (const body of bodies) {
    if (body.mass < 20) {
      continue;
    }

    const delta = sub(body.position, point);
    const r2 = delta.x * delta.x + delta.y * delta.y;
    if (r2 > 42000 || r2 < 1) {
      continue;
    }
    const pull = Math.min(18, (body.mass / Math.max(1, r2)) * 18);
    offset = {
      x: offset.x + normalize(delta).x * pull,
      y: offset.y + normalize(delta).y * pull
    };
  }

  return { x: point.x + offset.x, y: point.y + offset.y };
}

export function drawLensingRings(ctx: CanvasRenderingContext2D, bodies: Body[]) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const body of bodies) {
    if (body.type !== "blackHole" && body.mass < 90) {
      continue;
    }

    const ringRadius = body.radius * (body.type === "blackHole" ? 2.25 : 2.8);
    ctx.strokeStyle = body.type === "blackHole" ? "rgba(102, 0, 255, 0.42)" : "rgba(255, 245, 204, 0.14)";
    ctx.lineWidth = body.type === "blackHole" ? 2.2 : 1;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    const shimmer = scale({ x: Math.cos(body.spin), y: Math.sin(body.spin) }, ringRadius * 0.22);
    ctx.strokeStyle = body.type === "blackHole" ? "rgba(255, 68, 0, 0.28)" : "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.arc(body.position.x + shimmer.x, body.position.y + shimmer.y, ringRadius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
