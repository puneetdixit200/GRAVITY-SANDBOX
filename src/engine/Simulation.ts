import {
  BODY_DEFINITIONS,
  Body,
  BodyType,
  Vector,
  add,
  cloneBody,
  distance,
  finiteVector,
  lerpVector,
  makeBody,
  magnitude,
  normalize,
  perpendicular,
  radiusForMass,
  sanitizeBody,
  scale,
  sub,
  upgradeTypeForMass
} from "./Body";
import { ForceMode, computeBarnesHutAccelerations, computeDirectAccelerations, computeHybridAccelerations } from "./GravitySolver";

export {
  BODY_DEFINITIONS,
  PALETTE,
  add,
  cloneBody,
  distance,
  finiteVector,
  headingDegrees,
  makeBody,
  magnitude,
  normalize,
  perpendicular,
  radiusForMass,
  scale,
  shortestAngleDeltaDegrees,
  sub,
  upgradeTypeForMass
} from "./Body";
export type { Body, BodyDefinition, BodyType, TrailPoint, Vector } from "./Body";
export type { ForceMode } from "./GravitySolver";

export type EffectKind = "collision" | "absorb" | "roche" | "wave" | "supernova" | "wormhole";

export type GravityGunMode = "pull" | "repel";

export type SimulationEffect = {
  id: string;
  kind: EffectKind;
  position: Vector;
  radius: number;
  age: number;
  ttl: number;
  color: string;
  strength: number;
};

export type Wormhole = {
  id: string;
  pairId: string;
  position: Vector;
  radius: number;
  color: string;
  phase: number;
};

export type PredictedPath = {
  id: string;
  color: string;
  points: Vector[];
};

export type LagrangePoint = {
  label: "L1" | "L2" | "L3" | "L4" | "L5";
  position: Vector;
  stable: boolean;
};

export type ShareState = {
  bodies: Body[];
  gravity: number;
  timeScale: number;
  forceExponent: number;
};

export type SimulationOptions = {
  bodies?: Body[];
  wormholes?: Wormhole[];
  gravity?: number;
  softening?: number;
  forceExponent?: number;
  collisionScale?: number;
  historyLimit?: number;
  trailLimit?: number;
};

export type EnergyOptions = {
  maxPairs?: number;
};

export type PredictionOptions = {
  steps?: number;
  dt?: number;
  maxBodies?: number;
};

type BodySnapshot = Omit<Body, "trail"> & {
  trail: Body["trail"];
};

const EFFECT_TTL: Record<EffectKind, number> = {
  collision: 0.8,
  absorb: 1.1,
  roche: 1.4,
  wave: 2.6,
  supernova: 1.9,
  wormhole: 1.15
};

let effectId = 0;
let wormholeId = 0;

function canRocheFragment(body: Body): boolean {
  return body.type === "planet" || body.type === "giant";
}

function canCauseRocheFragmentation(body: Body): boolean {
  return body.type === "star" || body.type === "blackHole" || body.type === "giant";
}

function isFineParticle(body: Body): boolean {
  return body.type === "asteroid" || body.type === "debris";
}

function shouldCheckCollision(a: Body, b: Body, denseScene: boolean): boolean {
  if (a.type === "darkMatter" || b.type === "darkMatter") {
    return false;
  }

  if (denseScene && (isFineParticle(a) || isFineParticle(b)) && a.type !== "blackHole" && b.type !== "blackHole") {
    return false;
  }

  return true;
}

export class Simulation {
  bodies: Body[];
  wormholes: Wormhole[];
  effects: SimulationEffect[] = [];
  gravity: number;
  softening: number;
  forceExponent: number;
  collisionScale: number;
  historyLimit: number;
  trailLimit: number;
  elapsed = 0;
  lastForceMode: ForceMode = "direct";
  private history: BodySnapshot[][] = [];
  private waveClock = new Map<string, number>();
  private wormholeCooldown = new Map<string, number>();

  constructor(options: SimulationOptions = {}) {
    this.bodies = (options.bodies ?? []).map((body) => sanitizeBody(cloneBody(body)));
    this.wormholes = (options.wormholes ?? []).map((wormhole) => ({ ...wormhole, position: { ...wormhole.position } }));
    this.gravity = options.gravity ?? 20;
    this.softening = options.softening ?? 0.6;
    this.forceExponent = options.forceExponent ?? 2;
    this.collisionScale = options.collisionScale ?? 1;
    this.historyLimit = options.historyLimit ?? 520;
    this.trailLimit = options.trailLimit ?? 220;
    this.captureSnapshot();
  }

  setBodies(bodies: Body[]) {
    this.bodies = bodies.map((body) => sanitizeBody(cloneBody(body)));
    this.wormholes = [];
    this.wormholeCooldown.clear();
    this.effects = [];
    this.history = [];
    this.elapsed = 0;
    this.captureSnapshot();
  }

  addBody(body: Body) {
    this.bodies.push(sanitizeBody(cloneBody(body)));
    this.captureSnapshot();
  }

  removeBody(id: string) {
    this.bodies = this.bodies.filter((body) => body.id !== id);
    this.captureSnapshot();
  }

  clear() {
    this.bodies = [];
    this.wormholes = [];
    this.wormholeCooldown.clear();
    this.effects = [];
    this.history = [];
    this.elapsed = 0;
    this.captureSnapshot();
  }

  applyGravityGun(position: Vector, dt: number, mode: GravityGunMode = "pull", strength = 120) {
    const safeDt = Math.max(0, Math.min(0.25, dt));
    if (safeDt <= 0 || strength <= 0) {
      return;
    }

    for (const body of this.bodies) {
      if (body.hidden || body.type === "darkMatter") {
        continue;
      }

      const directionVector = mode === "pull" ? sub(position, body.position) : sub(body.position, position);
      const gap = Math.max(16, magnitude(directionVector));
      const direction = normalize(directionVector);
      const acceleration = Math.min(38, strength / (gap + 72));
      body.velocity = finiteVector(add(body.velocity, scale(direction, acceleration * safeDt * 8)));
    }
  }

  spawnWormholePair(dimensions: { width: number; height: number }, endpoints?: [Vector, Vector]): Wormhole[] {
    const pairId = `wormhole-pair-${wormholeId += 1}`;
    const radius = Math.max(24, Math.min(42, Math.min(dimensions.width, dimensions.height) * 0.045));
    const positions = endpoints ?? [
      { x: dimensions.width * 0.3, y: dimensions.height * 0.36 },
      { x: dimensions.width * 0.7, y: dimensions.height * 0.64 }
    ];
    const holes: Wormhole[] = positions.map((position, index) => ({
      id: `${pairId}-${index}`,
      pairId,
      position: { ...position },
      radius,
      color: index === 0 ? "#5eead4" : "#c77dff",
      phase: Math.random() * Math.PI * 2
    }));

    this.wormholes = this.wormholes.concat(holes).slice(-8);
    this.spawnEffect("wormhole", holes[0].position, radius * 2.4, "#5eead4", 1.4);
    this.spawnEffect("wormhole", holes[1].position, radius * 2.4, "#c77dff", 1.4);
    return holes;
  }

  triggerSupernova(origin?: Vector): boolean {
    const candidates = this.bodies
      .filter((body) => body.type !== "darkMatter" && body.type !== "blackHole" && body.type !== "debris" && body.mass >= 1)
      .sort((a, b) => {
        if (origin) {
          return distance(a.position, origin) - distance(b.position, origin);
        }
        const starBonusA = a.type === "star" ? 10_000 : 0;
        const starBonusB = b.type === "star" ? 10_000 : 0;
        return b.mass + starBonusB - (a.mass + starBonusA);
      });
    const source = candidates[0];
    if (!source) {
      return false;
    }

    const debrisCount = Math.max(18, Math.min(72, Math.round(source.mass * 0.72)));
    const debrisMass = Math.max(0.025, (source.mass * 0.22) / debrisCount);
    const fragments: Body[] = Array.from({ length: debrisCount }, (_, index) => {
      const angle = (index / debrisCount) * Math.PI * 2 + Math.sin(index * 8.17) * 0.18;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const offset = scale(direction, source.radius * (0.55 + (index % 5) * 0.18));
      const burstSpeed = 4.5 + (index % 9) * 0.55 + Math.sqrt(source.mass) * 0.18;
      return makeBody("debris", add(source.position, offset), add(source.velocity, scale(direction, burstSpeed)), {
        mass: debrisMass,
        radius: Math.max(1.8, source.radius * 0.11),
        color: index % 3 === 0 ? "#fef3c7" : index % 3 === 1 ? "#fb7185" : "#f59e0b",
        name: "Supernova ejecta"
      });
    });

    for (const body of this.bodies) {
      if (body.id === source.id || body.type === "darkMatter") {
        continue;
      }
      const direction = normalize(sub(body.position, source.position));
      const gap = Math.max(24, distance(body.position, source.position));
      const impulse = Math.min(16, (source.mass * 18) / (gap + 80));
      body.velocity = finiteVector(add(body.velocity, scale(direction, impulse)));
    }

    this.bodies = this.bodies.filter((body) => body.id !== source.id).concat(fragments);
    this.spawnEffect("supernova", source.position, source.radius * 7.5, "#ffffff", Math.min(5, source.mass / 16));
    this.captureSnapshot();
    return true;
  }

  spawnBlackHole(position = this.barycenter()): Body {
    const blackHole = makeBody("blackHole", position, { x: 0, y: 0 }, {
      mass: BODY_DEFINITIONS.blackHole.mass,
      name: "Emergency Singularity"
    });
    this.addBody(blackHole);
    this.spawnEffect("absorb", position, blackHole.radius * 3.2, "#ff7a18", 2);
    return blackHole;
  }

  spawnMeteorStorm(dimensions: { width: number; height: number }, count = 28): Body[] {
    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const meteors = Array.from({ length: count }, (_, index) => {
      const side = index % 4;
      const t = ((index * 37) % 100) / 100;
      const position =
        side === 0
          ? { x: -28, y: dimensions.height * t }
          : side === 1
            ? { x: dimensions.width + 28, y: dimensions.height * t }
            : side === 2
              ? { x: dimensions.width * t, y: -28 }
              : { x: dimensions.width * t, y: dimensions.height + 28 };
      const aim = add(center, {
        x: Math.sin(index * 1.91) * dimensions.width * 0.24,
        y: Math.cos(index * 1.37) * dimensions.height * 0.24
      });
      const speed = 4.8 + (index % 7) * 0.55;
      return makeBody("asteroid", position, scale(normalize(sub(aim, position)), speed), {
        mass: 0.12,
        radius: 3,
        color: index % 3 === 0 ? "#fca5a5" : "#d1d5db",
        name: "Meteor"
      });
    });

    this.bodies = this.bodies.concat(meteors);
    this.spawnEffect("wave", center, Math.min(dimensions.width, dimensions.height) * 0.18, "#f59e0b", 1.2);
    this.captureSnapshot();
    return meteors;
  }

  collapseAtBarycenter(): Body {
    const center = this.barycenter();
    for (const body of this.bodies) {
      if (body.type === "darkMatter" || body.type === "blackHole") {
        continue;
      }
      const direction = normalize(sub(center, body.position));
      body.velocity = finiteVector(add(body.velocity, scale(direction, 2.8)));
    }
    return this.spawnBlackHole(center);
  }

  predictPaths(options: PredictionOptions = {}): PredictedPath[] {
    const steps = Math.max(4, Math.min(90, Math.floor(options.steps ?? 48)));
    const dt = Math.max(0.005, Math.min(0.08, options.dt ?? 0.035));
    const maxBodies = Math.max(1, Math.min(24, Math.floor(options.maxBodies ?? 12)));
    const predictedBodies = [...this.bodies]
      .filter((body) => !body.hidden && body.type !== "debris" && body.type !== "asteroid")
      .sort((a, b) => b.mass * b.radius - a.mass * a.radius)
      .slice(0, maxBodies);
    const ids = new Set(predictedBodies.map((body) => body.id));
    const paths = new Map<string, PredictedPath>(
      predictedBodies.map((body) => [body.id, { id: body.id, color: body.color, points: [{ ...body.position }] }])
    );
    const clone = new Simulation({
      bodies: this.snapshot(),
      wormholes: this.wormholes,
      gravity: this.gravity,
      softening: this.softening,
      forceExponent: this.forceExponent,
      collisionScale: 0,
      historyLimit: 1,
      trailLimit: 0
    });

    for (let step = 0; step < steps; step += 1) {
      clone.integrate(dt);
      clone.resolveWormholes();
      for (const body of clone.bodies) {
        if (ids.has(body.id)) {
          paths.get(body.id)?.points.push({ ...body.position });
        }
      }
    }

    return [...paths.values()].filter((path) => path.points.length > 1);
  }

  computeAccelerations(bodies = this.bodies, mode?: ForceMode): Vector[] {
    const forceMode = mode ?? this.selectForceMode(bodies);
    this.lastForceMode = forceMode;
    const options = {
      gravity: this.gravity,
      softening: this.softening,
      forceExponent: this.forceExponent
    };

    if (forceMode === "hybrid") {
      return computeHybridAccelerations(bodies, options);
    }

    return forceMode === "barnesHut" ? computeBarnesHutAccelerations(bodies, options) : computeDirectAccelerations(bodies, options);
  }

  private selectForceMode(bodies: Body[]): ForceMode {
    if (bodies.length < 120) {
      return "direct";
    }

    const particleCount = bodies.reduce((count, body) => count + (isFineParticle(body) ? 1 : 0), 0);
    if (bodies.length >= 120 && particleCount / bodies.length > 0.5) {
      return "hybrid";
    }

    return "barnesHut";
  }

  step(dt: number, substeps = 2) {
    if (this.bodies.length === 0) {
      this.ageEffects(dt);
      return;
    }

    const safeDt = Math.max(0, Math.min(dt, 0.08));
    const steps = Math.max(1, Math.min(8, Math.floor(substeps)));
    const subDt = safeDt / steps;

    for (let index = 0; index < steps; index += 1) {
      this.integrate(subDt);
      this.resolveWormholes();
      this.resolveRocheLimits();
      this.resolveCollisions();
      this.detectGravitationalWaves();
      this.ageEffects(subDt);
      this.elapsed += subDt;
    }

    this.updateTrails();
    this.captureSnapshot();
  }

  resolveCollisions() {
    let changed = true;
    let guard = 0;
    const denseScene = this.bodies.length > 120;

    while (changed && guard < 20) {
      changed = false;
      guard += 1;

      for (let i = 0; i < this.bodies.length; i += 1) {
        if (changed) {
          break;
        }

        for (let j = i + 1; j < this.bodies.length; j += 1) {
          const a = this.bodies[i];
          const b = this.bodies[j];
          if (!shouldCheckCollision(a, b, denseScene)) {
            continue;
          }

          const gap = distance(a.position, b.position);

          const blackHole = a.type === "blackHole" ? a : b.type === "blackHole" ? b : undefined;
          if (blackHole) {
            const other = blackHole.id === a.id ? b : a;
            if (gap <= blackHole.radius + other.radius * 0.35) {
              this.absorbBody(blackHole, other);
              changed = true;
              break;
            }
          }

          if (gap <= (a.radius + b.radius) * this.collisionScale) {
            this.mergeBodies(a, b);
            changed = true;
            break;
          }
        }
      }
    }
  }

  totalEnergy(options: EnergyOptions = {}): number {
    let kinetic = 0;
    let potential = 0;
    const exponent = Math.max(0.35, Math.min(4, this.forceExponent));
    const totalPairs = (this.bodies.length * (this.bodies.length - 1)) / 2;
    const maxPairs = options.maxPairs && options.maxPairs > 0 ? options.maxPairs : totalPairs;
    const stride = totalPairs > maxPairs ? Math.ceil(totalPairs / maxPairs) : 1;
    let pairIndex = 0;

    for (const body of this.bodies) {
      const speed = magnitude(body.velocity);
      kinetic += 0.5 * body.mass * speed * speed;
    }

    for (let i = 0; i < this.bodies.length; i += 1) {
      for (let j = i + 1; j < this.bodies.length; j += 1) {
        pairIndex += 1;
        if (stride > 1 && pairIndex % stride !== 0) {
          continue;
        }

        const r = Math.max(this.softening, distance(this.bodies[i].position, this.bodies[j].position));
        if (Math.abs(exponent - 1) < 1e-4) {
          potential += this.gravity * this.bodies[i].mass * this.bodies[j].mass * Math.log(r) * stride;
        } else {
          potential -=
            ((this.gravity * this.bodies[i].mass * this.bodies[j].mass) / ((exponent - 1) * Math.pow(r, exponent - 1))) *
            stride;
        }
      }
    }

    return Number.isFinite(kinetic + potential) ? kinetic + potential : 0;
  }

  totalAngularMomentum(): number {
    return this.bodies.reduce(
      (total, body) => total + body.mass * (body.position.x * body.velocity.y - body.position.y * body.velocity.x),
      0
    );
  }

  barycenter(): Vector {
    const mass = this.bodies.reduce((sum, body) => sum + body.mass, 0);
    if (mass <= 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: this.bodies.reduce((sum, body) => sum + body.position.x * body.mass, 0) / mass,
      y: this.bodies.reduce((sum, body) => sum + body.position.y * body.mass, 0) / mass
    };
  }

  lagrangePoints(): LagrangePoint[] {
    const pair = [...this.bodies]
      .filter((body) => body.type !== "debris" && body.type !== "asteroid")
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 2);

    if (pair.length < 2) {
      return [];
    }

    const [a, b] = pair;
    const delta = sub(b.position, a.position);
    const d = Math.max(1, magnitude(delta));
    const u = normalize(delta);
    const p = perpendicular(u);
    const mu = Math.min(a.mass, b.mass) / Math.max(a.mass, b.mass);
    const nearSmaller = Math.cbrt(mu / 3);
    const larger = a.mass >= b.mass ? a : b;
    const smaller = larger.id === a.id ? b : a;
    const towardSmaller = normalize(sub(smaller.position, larger.position));
    const side = perpendicular(towardSmaller);

    return [
      {
        label: "L1",
        position: add(larger.position, scale(towardSmaller, d * (1 - nearSmaller))),
        stable: false
      },
      {
        label: "L2",
        position: add(smaller.position, scale(towardSmaller, d * nearSmaller)),
        stable: false
      },
      {
        label: "L3",
        position: add(larger.position, scale(towardSmaller, -d * (1 + (5 * mu) / 12))),
        stable: false
      },
      {
        label: "L4",
        position: add(lerpVector(a.position, b.position, 0.5), scale(p, (Math.sqrt(3) / 2) * d)),
        stable: true
      },
      {
        label: "L5",
        position: add(lerpVector(a.position, b.position, 0.5), scale(side, -(Math.sqrt(3) / 2) * d)),
        stable: true
      }
    ];
  }

  fieldAt(position: Vector): Vector {
    return this.bodies.reduce((field, body) => {
      const delta = sub(body.position, position);
      const r2 = delta.x * delta.x + delta.y * delta.y + this.softening * this.softening;
      const denominator = Math.pow(r2, (this.forceExponent + 1) / 2);
      return add(field, scale(delta, denominator > 0 ? (this.gravity * body.mass) / denominator : 0));
    }, { x: 0, y: 0 });
  }

  findBodyAt(position: Vector, padding = 6): Body | undefined {
    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const body = this.bodies[i];
      if (body.hidden) {
        continue;
      }
      if (distance(position, body.position) <= body.radius + padding) {
        return body;
      }
    }
    return undefined;
  }

  historyLength(): number {
    return this.history.length;
  }

  rewindTo(indexOrRatio: number) {
    if (this.history.length === 0) {
      return;
    }

    const index =
      indexOrRatio >= 0 && indexOrRatio <= 1
        ? Math.round(indexOrRatio * (this.history.length - 1))
        : Math.max(0, Math.min(this.history.length - 1, Math.round(indexOrRatio)));

    this.bodies = this.history[index].map((body) => sanitizeBody(cloneBody(body)));
    this.history = this.history.slice(0, index + 1);
  }

  snapshot(): Body[] {
    return this.bodies.map(cloneBody);
  }

  private integrate(dt: number) {
    const firstAccelerations = this.computeAccelerations();

    for (let i = 0; i < this.bodies.length; i += 1) {
      const body = this.bodies[i];
      const acceleration = firstAccelerations[i];
      body.position = finiteVector(add(add(body.position, scale(body.velocity, dt)), scale(acceleration, 0.5 * dt * dt)));
      body.acceleration = acceleration;
    }

    const secondAccelerations = this.computeAccelerations();

    for (let i = 0; i < this.bodies.length; i += 1) {
      const body = this.bodies[i];
      body.velocity = finiteVector(add(body.velocity, scale(add(firstAccelerations[i], secondAccelerations[i]), 0.5 * dt)));
      body.acceleration = secondAccelerations[i];
      body.spin += dt * Math.max(0.05, magnitude(body.velocity) * 0.002);
    }
  }

  private resolveWormholes() {
    if (this.wormholes.length < 2) {
      return;
    }

    for (const body of this.bodies) {
      if (body.type === "darkMatter" || body.type === "blackHole") {
        continue;
      }

      const cooldownUntil = this.wormholeCooldown.get(body.id) ?? -Infinity;
      if (cooldownUntil > this.elapsed) {
        continue;
      }

      for (const entry of this.wormholes) {
        if (distance(body.position, entry.position) > entry.radius + body.radius * 0.7) {
          continue;
        }

        const exit = this.wormholes.find((wormhole) => wormhole.pairId === entry.pairId && wormhole.id !== entry.id);
        if (!exit) {
          continue;
        }

        const speed = magnitude(body.velocity);
        const entryOffset = sub(body.position, entry.position);
        const direction =
          magnitude(entryOffset) > 0.001
            ? normalize(entryOffset)
            : { x: Math.cos(exit.phase + this.elapsed), y: Math.sin(exit.phase + this.elapsed) };
        body.position = finiteVector(add(exit.position, scale(direction, exit.radius + body.radius + 10)));
        body.velocity = finiteVector(speed > 0 ? scale(normalize(body.velocity), speed) : body.velocity);
        this.wormholeCooldown.set(body.id, this.elapsed + 0.55);
        this.spawnEffect("wormhole", entry.position, entry.radius * 1.5, entry.color, 1.1);
        this.spawnEffect("wormhole", exit.position, exit.radius * 1.7, exit.color, 1.1);
        break;
      }
    }
  }

  private resolveRocheLimits() {
    if (this.bodies.length > 900) {
      return;
    }

    const additions: Body[] = [];
    const removed = new Set<string>();

    for (const massive of this.bodies) {
      if (removed.has(massive.id) || massive.mass < 20 || !canCauseRocheFragmentation(massive)) {
        continue;
      }

      for (const small of this.bodies) {
        if (
          massive.id === small.id ||
          removed.has(small.id) ||
          small.type === "blackHole" ||
          small.type === "darkMatter" ||
          small.type === "debris" ||
          !canRocheFragment(small) ||
          massive.mass < small.mass * 25
        ) {
          continue;
        }

        const gap = distance(massive.position, small.position);
        const limit = massive.radius * Math.cbrt(massive.mass / Math.max(0.05, small.mass)) * (massive.type === "blackHole" ? 1.25 : 0.85);
        const collisionLimit = massive.radius + small.radius * 0.65;

        if (gap < limit && gap > collisionLimit) {
          removed.add(small.id);
          additions.push(...this.createDebrisFrom(small, massive));
          this.spawnEffect("roche", small.position, small.radius * 4, "#f8fafc", Math.min(2.8, massive.mass / small.mass / 40));
        }
      }
    }

    if (removed.size > 0) {
      this.bodies = this.bodies.filter((body) => !removed.has(body.id)).concat(additions);
    }
  }

  private createDebrisFrom(source: Body, attractor: Body): Body[] {
    const count = Math.max(6, Math.min(18, Math.round(source.mass * 4 + 6)));
    const direction = normalize(sub(source.position, attractor.position));
    const tangent = perpendicular(direction);
    const debrisMass = Math.max(0.01, source.mass / count);

    return Array.from({ length: count }, (_, index) => {
      const spread = (index - (count - 1) / 2) / count;
      const radialOffset = scale(direction, source.radius * spread * 1.8);
      const tangentOffset = scale(tangent, source.radius * Math.sin(index * 2.1));
      const shear = scale(tangent, spread * Math.sqrt(this.gravity * attractor.mass / Math.max(1, distance(source.position, attractor.position))) * 1.6);

      return makeBody(
        "debris",
        add(add(source.position, radialOffset), tangentOffset),
        add(source.velocity, shear),
        {
          mass: debrisMass,
          radius: Math.max(1.4, source.radius * 0.18),
          color: source.color,
          name: `${source.name} fragment`
        }
      );
    });
  }

  private mergeBodies(a: Body, b: Body) {
    const mass = a.mass + b.mass;
    const position = {
      x: (a.position.x * a.mass + b.position.x * b.mass) / mass,
      y: (a.position.y * a.mass + b.position.y * b.mass) / mass
    };
    const velocity = {
      x: (a.velocity.x * a.mass + b.velocity.x * b.mass) / mass,
      y: (a.velocity.y * a.mass + b.velocity.y * b.mass) / mass
    };
    const dominant = a.mass >= b.mass ? a : b;
    const type = upgradeTypeForMass(mass, dominant.type);
    const merged = makeBody(type, position, velocity, {
      mass,
      radius: radiusForMass(type, mass),
      color: dominant.color,
      name: type === dominant.type ? dominant.name : BODY_DEFINITIONS[type].label
    });

    merged.trail = dominant.trail.slice(-Math.floor(this.trailLimit / 2));
    this.bodies = this.bodies.filter((body) => body.id !== a.id && body.id !== b.id).concat(merged);
    this.spawnEffect("collision", position, merged.radius * 3, "#ffffff", Math.min(3, mass));
  }

  private absorbBody(blackHole: Body, other: Body) {
    const mass = blackHole.mass + other.mass;
    blackHole.position = {
      x: (blackHole.position.x * blackHole.mass + other.position.x * other.mass) / mass,
      y: (blackHole.position.y * blackHole.mass + other.position.y * other.mass) / mass
    };
    blackHole.velocity = {
      x: (blackHole.velocity.x * blackHole.mass + other.velocity.x * other.mass) / mass,
      y: (blackHole.velocity.y * blackHole.mass + other.velocity.y * other.mass) / mass
    };
    blackHole.mass = mass;
    blackHole.radius = radiusForMass("blackHole", mass);
    blackHole.type = "blackHole";
    blackHole.hidden = false;
    this.bodies = this.bodies.filter((body) => body.id !== other.id);
    this.spawnEffect("absorb", other.position, blackHole.radius * 2.4, "#ff7a18", Math.min(4, other.mass));
  }

  private detectGravitationalWaves() {
    const massiveBodies = this.bodies.filter((body) => body.mass >= 20 && body.type !== "darkMatter");

    for (let i = 0; i < massiveBodies.length; i += 1) {
      for (let j = i + 1; j < massiveBodies.length; j += 1) {
        const a = massiveBodies[i];
        const b = massiveBodies[j];

        const gap = distance(a.position, b.position);
        if (gap > 230 || gap < 1) {
          continue;
        }

        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        const last = this.waveClock.get(key) ?? -Infinity;
        const cadence = Math.max(0.45, 2.6 - Math.min(1.8, (a.mass * b.mass) / 120000));
        if (this.elapsed - last > cadence) {
          this.waveClock.set(key, this.elapsed);
          const position = lerpVector(a.position, b.position, 0.5);
          this.spawnEffect("wave", position, gap * 0.5, "#93c5fd", Math.min(3, (a.mass * b.mass) / 25000));
        }
      }
    }
  }

  private updateTrails() {
    const denseScene = this.bodies.length > 120;

    for (const body of this.bodies) {
      if (body.type === "asteroid" || body.hidden || (denseScene && body.type === "debris")) {
        body.trail = [];
        continue;
      }

      body.trail.push({ ...body.position, t: this.elapsed });
      const limit = denseScene ? Math.min(this.trailLimit, body.type === "star" ? 96 : 64) : this.trailLimit;
      if (body.trail.length > limit) {
        body.trail.splice(0, body.trail.length - limit);
      }
    }
  }

  private spawnEffect(kind: EffectKind, position: Vector, radius: number, color: string, strength = 1) {
    this.effects.push({
      id: `effect-${effectId += 1}`,
      kind,
      position: { ...position },
      radius,
      age: 0,
      ttl: EFFECT_TTL[kind],
      color,
      strength
    });
  }

  private ageEffects(dt: number) {
    for (const effect of this.effects) {
      effect.age += dt;
    }
    this.effects = this.effects.filter((effect) => effect.age < effect.ttl);
  }

  private captureSnapshot() {
    this.history.push(this.bodies.map((body) => cloneBody(body)));
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }
}

export function totalMomentum(bodies: Body[]): Vector {
  return bodies.reduce(
    (momentum, body) => ({
      x: momentum.x + body.velocity.x * body.mass,
      y: momentum.y + body.velocity.y * body.mass
    }),
    { x: 0, y: 0 }
  );
}

export function encodeShareState(state: ShareState): string {
  const compact = {
    v: 1,
    g: state.gravity,
    t: state.timeScale,
    e: state.forceExponent,
    b: state.bodies.map((body) => [
      body.type,
      round(body.mass),
      round(body.position.x),
      round(body.position.y),
      round(body.velocity.x),
      round(body.velocity.y),
      body.hidden ? 1 : 0,
      body.color
    ])
  };
  const json = JSON.stringify(compact);
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));

  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShareState(encoded: string): ShareState {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const json =
    typeof Buffer !== "undefined"
      ? Buffer.from(padded, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(padded)));
  const parsed = JSON.parse(json) as {
    g?: number;
    t?: number;
    e?: number;
    b?: Array<[BodyType, number, number, number, number, number, number, string?]>;
  };

  return {
    gravity: parsed.g ?? 20,
    timeScale: parsed.t ?? 1,
    forceExponent: parsed.e ?? 2,
    bodies: (parsed.b ?? []).map((entry) =>
      makeBody(entry[0], { x: entry[2], y: entry[3] }, { x: entry[4], y: entry[5] }, {
        mass: entry[1],
        hidden: Boolean(entry[6]),
        color: entry[7] ?? BODY_DEFINITIONS[entry[0]].color
      })
    )
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
