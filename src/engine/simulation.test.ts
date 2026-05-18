import { describe, expect, it } from "vitest";
import {
  BODY_DEFINITIONS,
  Simulation,
  decodeShareState,
  encodeShareState,
  headingDegrees,
  makeBody,
  shortestAngleDeltaDegrees,
  totalMomentum
} from "./Simulation";
import { createPreset } from "./Presets";

describe("Simulation physics", () => {
  it("computes equal and opposite accelerations for matching bodies", () => {
    const left = makeBody("planet", { x: -10, y: 0 }, { x: 0, y: 0 });
    const right = makeBody("planet", { x: 10, y: 0 }, { x: 0, y: 0 });
    const sim = new Simulation({ gravity: 20, softening: 0.5, bodies: [left, right] });

    const accelerations = sim.computeAccelerations();

    expect(accelerations[0].x).toBeGreaterThan(0);
    expect(accelerations[1].x).toBeLessThan(0);
    expect(accelerations[0].x).toBeCloseTo(-accelerations[1].x, 8);
    expect(accelerations[0].y).toBeCloseTo(0, 8);
    expect(accelerations[1].y).toBeCloseTo(0, 8);
  });

  it("keeps a light planet in a near-circular orbit with velocity Verlet", () => {
    const star = makeBody("star", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 100 });
    const planet = makeBody("planet", { x: 120, y: 0 }, { x: 0, y: 4.08 }, { mass: 1 });
    const sim = new Simulation({
      gravity: 20,
      softening: 1,
      bodies: [star, planet],
      collisionScale: 0.25
    });

    for (let i = 0; i < 720; i += 1) {
      sim.step(0.016, 3);
    }

    const radius = Math.hypot(sim.bodies[1].position.x, sim.bodies[1].position.y);
    expect(radius).toBeGreaterThan(90);
    expect(radius).toBeLessThan(155);
    expect(Number.isFinite(sim.totalEnergy())).toBe(true);
  });

  it("changes a body's velocity heading when gravity pulls off-axis", () => {
    const star = makeBody("star", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 80, radius: 18 });
    const probe = makeBody("planet", { x: 120, y: 0 }, { x: 0, y: 3.2 }, { mass: 1, radius: 4 });
    const initialHeading = headingDegrees(probe.velocity);
    const sim = new Simulation({
      gravity: 20,
      softening: 1,
      collisionScale: 0.1,
      bodies: [star, probe]
    });

    for (let i = 0; i < 180; i += 1) {
      sim.step(0.016, 3);
    }

    const finalHeading = headingDegrees(sim.bodies[1].velocity);
    const turn = Math.abs(shortestAngleDeltaDegrees(initialHeading, finalHeading));

    expect(turn).toBeGreaterThan(3);
    expect(turn).toBeLessThan(90);
    expect(Number.isFinite(finalHeading)).toBe(true);
  });

  it("merges overlapping bodies while conserving total momentum", () => {
    const a = makeBody("planet", { x: 0, y: 0 }, { x: 2, y: 0 }, { mass: 2 });
    const b = makeBody("giant", { x: 1, y: 0 }, { x: -1, y: 0 }, { mass: 4 });
    const before = totalMomentum([a, b]);
    const sim = new Simulation({ bodies: [a, b], gravity: 1 });

    sim.resolveCollisions();

    expect(sim.bodies).toHaveLength(1);
    expect(sim.bodies[0].mass).toBeCloseTo(6);
    expect(totalMomentum(sim.bodies).x).toBeCloseTo(before.x, 8);
    expect(totalMomentum(sim.bodies).y).toBeCloseTo(before.y, 8);
  });

  it("absorbs bodies that cross a black hole event horizon", () => {
    const blackHole = makeBody("blackHole", { x: 0, y: 0 }, { x: 0, y: 0 });
    const probe = makeBody("asteroid", { x: BODY_DEFINITIONS.blackHole.radius * 0.5, y: 0 }, { x: 0, y: 0 });
    const sim = new Simulation({ bodies: [blackHole, probe], gravity: 1 });

    sim.resolveCollisions();

    expect(sim.bodies).toHaveLength(1);
    expect(sim.bodies[0].type).toBe("blackHole");
    expect(sim.bodies[0].mass).toBeCloseTo(BODY_DEFINITIONS.blackHole.mass + BODY_DEFINITIONS.asteroid.mass);
    expect(sim.effects.some((effect) => effect.kind === "absorb")).toBe(true);
  });

  it("lets dark matter attract bodies without colliding into them", () => {
    const halo = makeBody("darkMatter", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 200, radius: 80, hidden: true });
    const planet = makeBody("planet", { x: 0, y: 0 }, { x: 0, y: 0 });
    const sim = new Simulation({ bodies: [halo, planet], gravity: 20 });

    sim.resolveCollisions();

    expect(sim.bodies).toHaveLength(2);
    expect(sim.computeAccelerations()[1].x).toBeCloseTo(0, 8);
  });

  it("can sample potential energy for dense scenes without exact pair scans", () => {
    const bodies = createPreset("galaxyMode", { width: 1440, height: 900 });
    const sim = new Simulation({ bodies, gravity: 20 });

    const energy = sim.totalEnergy({ maxPairs: 8_000 });

    expect(Number.isFinite(energy)).toBe(true);
  });

  it("restores a previous snapshot for time rewind", () => {
    const sim = new Simulation({
      bodies: [makeBody("planet", { x: 0, y: 0 }, { x: 10, y: 0 })],
      gravity: 0,
      historyLimit: 10
    });

    sim.step(0.1, 1);
    sim.step(0.1, 1);
    const currentX = sim.bodies[0].position.x;

    sim.rewindTo(0);

    expect(sim.bodies[0].position.x).toBeLessThan(currentX);
    expect(sim.bodies[0].position.x).toBeCloseTo(0, 5);
  });

  it("round-trips a compact shareable state", () => {
    const bodies = [
      makeBody("star", { x: 3, y: 4 }, { x: 0.1, y: -0.2 }),
      makeBody("darkMatter", { x: -5, y: 8 }, { x: 0, y: 0 }, { hidden: true })
    ];

    const encoded = encodeShareState({ bodies, gravity: 22, timeScale: 1.5, forceExponent: 2 });
    const decoded = decodeShareState(encoded);

    expect(decoded.gravity).toBe(22);
    expect(decoded.timeScale).toBe(1.5);
    expect(decoded.forceExponent).toBe(2);
    expect(decoded.bodies.map((body) => body.type)).toEqual(["star", "darkMatter"]);
    expect(decoded.bodies[1].hidden).toBe(true);
  });

  it("does not explode galaxy dust into thousands of Roche fragments", () => {
    const bodies = createPreset("galaxyMode", { width: 1440, height: 900 });
    const sim = new Simulation({ bodies, gravity: 20 });

    sim.step(0.064, 1);
    sim.step(0.064, 1);

    expect(sim.bodies.length).toBeLessThanOrEqual(600);
  });

  it("does not burn CPU merging tiny galaxy dust particles into each other", () => {
    const bodies = createPreset("galaxyMode", { width: 1440, height: 900 });
    const sim = new Simulation({ bodies, gravity: 20 });
    const initialCount = bodies.length;

    for (let i = 0; i < 80; i += 1) {
      sim.step(0.064, 1);
    }

    expect(sim.bodies.length).toBeGreaterThanOrEqual(initialCount);
    expect(sim.bodies.length).toBeLessThanOrEqual(initialCount + 80);
  });

  it("switches dense particle scenes to the hybrid force solver", () => {
    const bodies = [
      makeBody("star", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 60 }),
      ...Array.from({ length: 280 }, (_, index) =>
        makeBody(
          "asteroid",
          { x: Math.cos(index) * (80 + index * 0.5), y: Math.sin(index) * (80 + index * 0.5) },
          { x: 0, y: 0 }
        )
      )
    ];
    const sim = new Simulation({ bodies, gravity: 20 });

    sim.step(0.016, 1);

    expect(sim.lastForceMode).toBe("hybrid");
  });

  it("gravity gun can pull and repel bodies without producing invalid velocity", () => {
    const probe = makeBody("planet", { x: 100, y: 0 }, { x: 0, y: 0 });
    const sim = new Simulation({ bodies: [probe], gravity: 20 });

    sim.applyGravityGun({ x: 0, y: 0 }, 0.5, "pull", 120);
    expect(sim.bodies[0].velocity.x).toBeLessThan(0);
    expect(Number.isFinite(sim.bodies[0].velocity.x)).toBe(true);

    sim.bodies[0].velocity = { x: 0, y: 0 };
    sim.applyGravityGun({ x: 0, y: 0 }, 0.5, "repel", 120);
    expect(sim.bodies[0].velocity.x).toBeGreaterThan(0);
    expect(Number.isFinite(sim.bodies[0].velocity.x)).toBe(true);
  });

  it("teleports bodies through wormholes while preserving speed", () => {
    const probe = makeBody("planet", { x: 80, y: 80 }, { x: 2, y: 1 }, { radius: 4 });
    const sim = new Simulation({ bodies: [probe], gravity: 0 });
    const [, exit] = sim.spawnWormholePair(
      { width: 500, height: 400 },
      [
        { x: 80, y: 80 },
        { x: 360, y: 280 }
      ]
    );
    const speedBefore = Math.hypot(probe.velocity.x, probe.velocity.y);

    sim.step(0.016, 1);

    const speedAfter = Math.hypot(sim.bodies[0].velocity.x, sim.bodies[0].velocity.y);
    expect(Math.hypot(sim.bodies[0].position.x - exit.position.x, sim.bodies[0].position.y - exit.position.y)).toBeLessThan(40);
    expect(speedAfter).toBeCloseTo(speedBefore, 5);
  });

  it("supernova converts a massive body into debris and a visible effect", () => {
    const star = makeBody("star", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 80, radius: 20 });
    const planet = makeBody("planet", { x: 70, y: 0 }, { x: 0, y: 1 });
    const sim = new Simulation({ bodies: [star, planet], gravity: 20 });

    const result = sim.triggerSupernova();

    expect(result).toBe(true);
    expect(sim.bodies.some((body) => body.id === star.id)).toBe(false);
    expect(sim.bodies.filter((body) => body.type === "debris").length).toBeGreaterThan(12);
    expect(sim.effects.some((effect) => effect.kind === "supernova")).toBe(true);
  });

  it("predicts future paths without mutating live bodies", () => {
    const star = makeBody("star", { x: 0, y: 0 }, { x: 0, y: 0 }, { mass: 80 });
    const planet = makeBody("planet", { x: 120, y: 0 }, { x: 0, y: 3.5 });
    const sim = new Simulation({ bodies: [star, planet], gravity: 20, collisionScale: 0.1 });
    const before = sim.snapshot();

    const paths = sim.predictPaths({ steps: 24, dt: 0.02, maxBodies: 3 });

    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths[0].points.length).toBeGreaterThan(6);
    expect(sim.bodies[0].position).toEqual(before[0].position);
    expect(sim.bodies[1].velocity).toEqual(before[1].velocity);
  });
});
