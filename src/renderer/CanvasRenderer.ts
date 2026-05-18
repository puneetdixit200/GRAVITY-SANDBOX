import { Body, LagrangePoint, Simulation, Vector, magnitude, normalize } from "@/engine/Simulation";
import type { PlacementPreview } from "@/hooks/usePlacement";
import { drawBlackHoleDisk, drawEffects, drawStarGlow } from "./GlowEffects";
import { drawLensingRings, distortPoint } from "./LensingEffect";
import { alphaColor, drawTrails } from "./TrailRenderer";

export type RenderOptions = {
  trails: boolean;
  grid: boolean;
  heatmap: boolean;
  fieldLines: boolean;
  barycenter: boolean;
  lagrange: boolean;
  darkMatterVisible: boolean;
  view3d: boolean;
  placement: PlacementPreview | null;
};

export class CanvasRenderer {
  render(canvas: HTMLCanvasElement, simulation: Simulation, options: RenderOptions, now: number) {
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const bodyCount = simulation.bodies.length;
    const { width, height, ratio } = this.resize(canvas, bodyCount);
    const bodies = options.view3d ? this.projectBodies(simulation.bodies, width, height) : simulation.bodies;
    const effects = options.view3d ? simulation.effects.map((effect) => ({
      ...effect,
      position: this.projectPoint(effect.position, width, height),
      radius: effect.radius * 0.78
    })) : simulation.effects;
    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawSpace(context, width, height);

    if (options.heatmap) {
      this.drawHeatmap(context, simulation, width, height);
    }

    if (options.grid) {
      if (options.view3d) {
        this.drawPerspectiveGrid(context, width, height);
      } else {
        this.drawDistortedGrid(context, simulation.bodies, width, height);
      }
    }

    if (options.fieldLines) {
      this.drawFieldLines(context, simulation, width, height);
    }

    drawTrails(context, bodies, options.trails);
    drawLensingRings(context, bodies);
    drawEffects(context, effects);

    if (options.lagrange) {
      const points = options.view3d
        ? simulation.lagrangePoints().map((point) => ({ ...point, position: this.projectPoint(point.position, width, height) }))
        : simulation.lagrangePoints();
      this.drawLagrangePoints(context, points);
    }

    if (options.barycenter) {
      this.drawBarycenter(context, options.view3d ? this.projectPoint(simulation.barycenter(), width, height) : simulation.barycenter(), now);
    }

    for (const body of bodies) {
      if (body.hidden && !options.darkMatterVisible) {
        continue;
      }
      this.drawBody(context, body, now, options.darkMatterVisible, bodyCount);
    }

    this.drawPlacement(context, options.view3d && options.placement ? this.projectPlacement(options.placement, width, height) : options.placement);
    context.restore();
  }

  private resize(canvas: HTMLCanvasElement, bodyCount: number) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const denseScene = bodyCount > 120;
    const compactViewport = width < 720 || height < 720;
    const maxRatio = denseScene || compactViewport ? 1 : 1.5;
    const ratio = Math.max(1, Math.min(maxRatio, window.devicePixelRatio || 1));
    const targetWidth = Math.floor(width * ratio);
    const targetHeight = Math.floor(height * ratio);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    return { width, height, ratio };
  }

  private drawSpace(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);
  }

  private drawDistortedGrid(ctx: CanvasRenderingContext2D, bodies: Body[], width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.11)";
    ctx.lineWidth = 1;
    const denseScene = bodies.length > 120;
    if (denseScene) {
      this.drawSimpleGrid(ctx, width, height, 76);
      ctx.restore();
      return;
    }

    const lineStep = denseScene ? 76 : 52;
    const segmentStep = denseScene ? 34 : 20;

    for (let x = -40; x <= width + 40; x += lineStep) {
      ctx.beginPath();
      for (let y = -40; y <= height + 40; y += segmentStep) {
        const point = distortPoint({ x, y }, bodies);
        if (y === -40) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    for (let y = -40; y <= height + 40; y += lineStep) {
      ctx.beginPath();
      for (let x = -40; x <= width + 40; x += segmentStep) {
        const point = distortPoint({ x, y }, bodies);
        if (x === -40) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawSimpleGrid(ctx: CanvasRenderingContext2D, width: number, height: number, step: number) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  private drawPerspectiveGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    const centerY = height * 0.52;
    const rows = 11;
    const columns = 15;

    ctx.beginPath();
    for (let row = -rows; row <= rows; row += 1) {
      const y = centerY + row * 38;
      const left = this.projectPoint({ x: -80, y }, width, height);
      const right = this.projectPoint({ x: width + 80, y }, width, height);
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
    }

    for (let column = -columns; column <= columns; column += 1) {
      const x = width / 2 + column * 70;
      const top = this.projectPoint({ x, y: -120 }, width, height);
      const bottom = this.projectPoint({ x, y: height + 160 }, width, height);
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bottom.x, bottom.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D, simulation: Simulation, width: number, height: number) {
    const cell = 34;
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const field = simulation.fieldAt({ x: x + cell / 2, y: y + cell / 2 });
        const strength = Math.min(1, Math.log10(1 + magnitude(field)) / 2.4);
        if (strength < 0.04) {
          continue;
        }
        ctx.fillStyle = `rgba(${Math.floor(245 * strength)}, ${Math.floor(158 * strength)}, ${Math.floor(40 + 130 * strength)}, ${strength * 0.22})`;
        ctx.fillRect(x, y, cell + 1, cell + 1);
      }
    }

    ctx.restore();
  }

  private drawFieldLines(ctx: CanvasRenderingContext2D, simulation: Simulation, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(94, 234, 212, 0.34)";
    ctx.fillStyle = "rgba(94, 234, 212, 0.42)";
    ctx.lineWidth = 1;

    for (let y = 38; y < height; y += 66) {
      for (let x = 38; x < width; x += 66) {
        const field = simulation.fieldAt({ x, y });
        const length = Math.min(22, magnitude(field) * 36);
        if (length < 2) {
          continue;
        }
        const direction = normalize(field);
        const end = { x: x + direction.x * length, y: y + direction.y * length };
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(end.x, end.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawBody(ctx: CanvasRenderingContext2D, body: Body, now: number, darkMatterVisible: boolean, bodyCount: number) {
    if (body.type === "asteroid" || body.type === "debris" || (body.radius <= 4 && bodyCount > 160)) {
      this.drawParticle(ctx, body);
      return;
    }

    if (body.type === "star") {
      drawStarGlow(ctx, body, now);
    }

    if (body.type === "blackHole") {
      drawBlackHoleDisk(ctx, body, now);
    }

    if (body.type === "darkMatter") {
      this.drawDarkMatter(ctx, body, darkMatterVisible);
      return;
    }

    if (body.type === "blackHole") {
      this.drawBlackHole(ctx, body);
      return;
    }

    if (body.type === "star") {
      this.drawStar(ctx, body, now);
      return;
    }

    if (body.type === "giant") {
      this.drawGiant(ctx, body);
      return;
    }

    this.drawPlanet(ctx, body);
  }

  private drawParticle(ctx: CanvasRenderingContext2D, body: Body) {
    ctx.fillStyle = body.color;
    ctx.globalAlpha = body.type === "debris" ? 0.72 : 0.86;
    const size = Math.max(2, Math.min(4, body.radius * 1.45));
    ctx.fillRect(body.position.x - size / 2, body.position.y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  private drawPlanet(ctx: CanvasRenderingContext2D, body: Body) {
    const gradient = ctx.createRadialGradient(
      body.position.x - body.radius * 0.35,
      body.position.y - body.radius * 0.45,
      0,
      body.position.x,
      body.position.y,
      body.radius * 1.1
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.18, body.color);
    gradient.addColorStop(1, alphaColor(body.color, 0.62));

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.stroke();
    ctx.restore();
  }

  private drawGiant(ctx: CanvasRenderingContext2D, body: Body) {
    this.drawPlanet(ctx, body);
    ctx.save();
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
    ctx.lineWidth = 2;
    for (let y = -body.radius; y <= body.radius; y += 5) {
      ctx.beginPath();
      ctx.moveTo(body.position.x - body.radius, body.position.y + y + Math.sin(body.spin + y) * 1.3);
      ctx.lineTo(body.position.x + body.radius, body.position.y + y + Math.cos(body.spin + y) * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D, body: Body, now: number) {
    const pulse = 1 + Math.sin(now * 0.004 + body.spin) * 0.06;
    const gradient = ctx.createRadialGradient(body.position.x, body.position.y, 0, body.position.x, body.position.y, body.radius * pulse);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.45, "#fff5cc");
    gradient.addColorStop(1, "#ffaa00");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBlackHole(ctx: CanvasRenderingContext2D, body: Body) {
    ctx.save();
    const gradient = ctx.createRadialGradient(body.position.x, body.position.y, body.radius * 0.35, body.position.x, body.position.y, body.radius);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(0.72, "#010102");
    gradient.addColorStop(1, "rgba(102, 0, 255, 0.42)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawDarkMatter(ctx: CanvasRenderingContext2D, body: Body, visible: boolean) {
    if (!visible) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(139, 92, 246, 0.54)";
    ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.radius * 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBarycenter(ctx: CanvasRenderingContext2D, point: Vector, now: number) {
    const pulse = 6 + Math.sin(now * 0.004) * 2;
    ctx.save();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.82)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(point.x - pulse, point.y);
    ctx.lineTo(point.x + pulse, point.y);
    ctx.moveTo(point.x, point.y - pulse);
    ctx.lineTo(point.x, point.y + pulse);
    ctx.stroke();
    ctx.restore();
  }

  private drawLagrangePoints(ctx: CanvasRenderingContext2D, points: LagrangePoint[]) {
    ctx.save();
    ctx.font = "11px var(--font-mono), monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const point of points) {
      ctx.fillStyle = point.stable ? "rgba(80, 232, 144, 0.85)" : "rgba(245, 158, 11, 0.82)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.arc(point.position.x, point.position.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
      ctx.fillText(point.label, point.position.x, point.position.y - 12);
    }

    ctx.restore();
  }

  private drawPlacement(ctx: CanvasRenderingContext2D, placement: PlacementPreview | null) {
    if (!placement?.active) {
      return;
    }

    const delta = {
      x: placement.current.x - placement.start.x,
      y: placement.current.y - placement.start.y
    };
    const length = Math.hypot(delta.x, delta.y);
    const direction = length > 0 ? { x: delta.x / length, y: delta.y / length } : { x: 0, y: 0 };
    const arrowEnd = {
      x: placement.start.x + delta.x,
      y: placement.start.y + delta.y
    };
    const left = {
      x: arrowEnd.x - direction.x * 12 - direction.y * 7,
      y: arrowEnd.y - direction.y * 12 + direction.x * 7
    };
    const right = {
      x: arrowEnd.x - direction.x * 12 + direction.y * 7,
      y: arrowEnd.y - direction.y * 12 - direction.x * 7
    };

    ctx.save();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
    ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(placement.start.x, placement.start.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(placement.start.x, placement.start.y);
    ctx.lineTo(arrowEnd.x, arrowEnd.y);
    ctx.stroke();
    if (length > 10) {
      ctx.beginPath();
      ctx.moveTo(arrowEnd.x, arrowEnd.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private projectBodies(bodies: Body[], width: number, height: number): Body[] {
    return bodies.map((body) => {
      const position = this.projectPoint(body.position, width, height);
      const depthScale = 0.74 + Math.max(0, Math.min(1, body.position.y / Math.max(1, height))) * 0.42;
      return {
        ...body,
        position,
        radius: body.radius * depthScale,
        trail: body.trail.map((point) => ({ ...this.projectPoint(point, width, height), t: point.t }))
      };
    });
  }

  private projectPlacement(placement: PlacementPreview, width: number, height: number): PlacementPreview {
    return {
      ...placement,
      start: this.projectPoint(placement.start, width, height),
      current: this.projectPoint(placement.current, width, height)
    };
  }

  private projectPoint(point: Vector, width: number, height: number): Vector {
    const center = { x: width / 2, y: height / 2 };
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx + dy * 0.18,
      y: center.y + dy * 0.58 - dx * 0.055
    };
  }
}
