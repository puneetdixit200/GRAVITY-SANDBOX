import { describe, expect, it } from "vitest";
import {
  BODY_DEFINITIONS,
  Simulation,
  decodeShareState,
  encodeShareState,
  makeBody,
  totalMomentum
} from "./Simulation";

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
});
