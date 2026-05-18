import { describe, expect, it } from "vitest";
import { createPreset } from "./Presets";

describe("preset generation", () => {
  it("creates a solar system with one central star and eight orbiting bodies", () => {
    const bodies = createPreset("solarSystem", { width: 1200, height: 800 });

    expect(bodies.filter((body) => body.type === "star")).toHaveLength(1);
    expect(bodies).toHaveLength(9);
    expect(bodies.slice(1).every((body) => Number.isFinite(body.velocity.x) && Number.isFinite(body.velocity.y))).toBe(true);
  });

  it("creates the known figure-eight three-body setup", () => {
    const bodies = createPreset("figureEight", { width: 1200, height: 800 });

    expect(bodies).toHaveLength(3);
    expect(new Set(bodies.map((body) => body.mass)).size).toBe(1);
    expect(bodies.reduce((sum, body) => sum + body.velocity.x, 0)).toBeCloseTo(0, 5);
    expect(bodies.reduce((sum, body) => sum + body.velocity.y, 0)).toBeCloseTo(0, 5);
  });

  it("creates a dense galaxy collision with dark matter halos", () => {
    const bodies = createPreset("galaxyCollision", { width: 1400, height: 900 });

    expect(bodies.length).toBeGreaterThanOrEqual(120);
    expect(bodies.length).toBeLessThanOrEqual(160);
    expect(bodies.filter((body) => body.type === "darkMatter" && body.hidden)).toHaveLength(2);
  });

  it("keeps galaxy mode particle counts within the Canvas 2D performance budget", () => {
    const desktop = createPreset("galaxyMode", { width: 1440, height: 900 });
    const mobile = createPreset("galaxyMode", { width: 412, height: 915 });

    expect(desktop.length).toBeGreaterThanOrEqual(120);
    expect(desktop.length).toBeLessThanOrEqual(160);
    expect(mobile.length).toBeGreaterThanOrEqual(110);
    expect(mobile.length).toBeLessThanOrEqual(150);
  });

  it("creates a capture challenge with a named target moon", () => {
    const bodies = createPreset("captureChallenge", { width: 1200, height: 800 });

    expect(bodies.some((body) => body.name === "Target Moon")).toBe(true);
    expect(bodies.some((body) => body.name === "Capture Planet")).toBe(true);
  });
});
