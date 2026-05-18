import { Body, SimulationEffect } from "@/engine/Simulation";
import { alphaColor } from "./TrailRenderer";

export function drawStarGlow(ctx: CanvasRenderingContext2D, body: Body, time: number) {
  const pulse = 1 + Math.sin(time * 0.003 + body.spin) * 0.08;
  const radius = body.radius * 4.2 * pulse;
  const gradient = ctx.createRadialGradient(body.position.x, body.position.y, 0, body.position.x, body.position.y, radius);
  gradient.addColorStop(0, "rgba(255, 245, 204, 0.82)");
  gradient.addColorStop(0.18, "rgba(255, 170, 0, 0.32)");
  gradient.addColorStop(1, "rgba(255, 170, 0, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBlackHoleDisk(ctx: CanvasRenderingContext2D, body: Body, time: number) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(time * 0.0005 + body.spin);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = i === 0 ? "rgba(255, 68, 0, 0.72)" : i === 1 ? "rgba(245, 158, 11, 0.48)" : "rgba(102, 0, 255, 0.36)";
    ctx.lineWidth = 2.5 - i * 0.45;
    ctx.beginPath();
    ctx.ellipse(0, 0, body.radius * (1.35 + i * 0.25), body.radius * (0.48 + i * 0.1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 26; i += 1) {
    const phase = time * 0.0018 + i * 0.73;
    const radius = body.radius * (1.25 + (i % 9) * 0.055);
    const x = Math.cos(phase) * radius;
    const y = Math.sin(phase) * radius * 0.42;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255, 132, 43, 0.76)" : "rgba(168, 85, 247, 0.58)";
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawEffects(ctx: CanvasRenderingContext2D, effects: SimulationEffect[]) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const effect of effects) {
    const progress = effect.age / effect.ttl;
    const alpha = Math.max(0, 1 - progress);
    const radius = effect.radius * (0.25 + progress * (effect.kind === "wave" ? 4.2 : 1.6));

    if (effect.kind === "wave") {
      ctx.strokeStyle = alphaColor(effect.color, alpha * 0.28);
      ctx.lineWidth = 1 + effect.strength * 0.7;
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.arc(effect.position.x, effect.position.y, radius + ring * 26, 0, Math.PI * 2);
        ctx.stroke();
      }
      continue;
    }

    const gradient = ctx.createRadialGradient(effect.position.x, effect.position.y, 0, effect.position.x, effect.position.y, radius);
    gradient.addColorStop(0, alphaColor(effect.color, alpha * 0.85));
    gradient.addColorStop(0.4, alphaColor(effect.color, alpha * 0.24));
    gradient.addColorStop(1, alphaColor(effect.color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
