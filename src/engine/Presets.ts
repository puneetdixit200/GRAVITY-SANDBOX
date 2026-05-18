import { Body, BodyType, Vector, add, makeBody, normalize, perpendicular, scale, sub } from "./Simulation";

export type PresetKey =
  | "solarSystem"
  | "binaryStars"
  | "figureEight"
  | "galaxyCollision"
  | "galaxyMode"
  | "captureChallenge"
  | "empty";

export type PresetInfo = {
  key: PresetKey;
  label: string;
};

export const PRESETS: PresetInfo[] = [
  { key: "solarSystem", label: "Solar System" },
  { key: "binaryStars", label: "Binary Stars" },
  { key: "figureEight", label: "Figure 8" },
  { key: "galaxyCollision", label: "Galaxy Collision" },
  { key: "galaxyMode", label: "Galaxy Mode" },
  { key: "captureChallenge", label: "Moon Capture" }
];

type Dimensions = {
  width: number;
  height: number;
};

const DEFAULT_GRAVITY = 20;

export function createPreset(key: PresetKey, dimensions: Dimensions): Body[] {
  const center = {
    x: dimensions.width / 2,
    y: dimensions.height / 2
  };

  switch (key) {
    case "solarSystem":
      return solarSystem(center, dimensions);
    case "binaryStars":
      return binaryStars(center);
    case "figureEight":
      return figureEight(center);
    case "galaxyCollision":
      return galaxyCollision(center, dimensions, dimensions.width < 700 ? 60 : 68);
    case "galaxyMode":
      return galaxyCollision(center, dimensions, dimensions.width < 700 ? 60 : 70);
    case "captureChallenge":
      return captureChallenge(center);
    case "empty":
    default:
      return [];
  }
}

function solarSystem(center: Vector, dimensions: Dimensions): Body[] {
  const sun = makeBody("star", center, { x: 0, y: 0 }, { name: "Sun", mass: 50, color: "#fff5cc" });
  const maxRadius = Math.max(80, Math.min(dimensions.width, dimensions.height) * 0.43);
  const rings = [0.22, 0.31, 0.41, 0.52, 0.65, 0.78, 0.9, 1].map((ratio) => maxRadius * ratio);
  const types: BodyType[] = ["asteroid", "planet", "planet", "planet", "giant", "giant", "giant", "planet"];
  const colors = ["#a7a7b1", "#50e890", "#4a9eff", "#ff6b4a", "#ffb84a", "#c77dff", "#5eead4", "#94a3b8"];
  const names = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
  const bodies = [sun];
  let totalMomentum = { x: 0, y: 0 };

  rings.forEach((radius, index) => {
    const angle = index * 0.83 + 0.35;
    const position = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
    const direction = normalize(sub(position, center));
    const tangent = perpendicular(direction);
    const speed = Math.sqrt((DEFAULT_GRAVITY * sun.mass) / Math.max(1, radius));
    const body = makeBody(types[index], position, scale(tangent, speed), {
      name: names[index],
      color: colors[index],
      mass: index >= 4 && index <= 6 ? 5 : index === 0 ? 0.1 : 1
    });
    bodies.push(body);
    totalMomentum = add(totalMomentum, scale(body.velocity, body.mass));
  });

  sun.velocity = scale(totalMomentum, -1 / sun.mass);
  return bodies;
}

function binaryStars(center: Vector): Body[] {
  const distance = 105;
  const mass = 70;
  const speed = Math.sqrt((DEFAULT_GRAVITY * mass) / (4 * distance));
  const left = makeBody("star", { x: center.x - distance, y: center.y }, { x: 0, y: -speed }, {
    mass,
    name: "Aster",
    color: "#fff5cc"
  });
  const right = makeBody("star", { x: center.x + distance, y: center.y }, { x: 0, y: speed }, {
    mass,
    name: "Vega",
    color: "#ffd28a"
  });

  return [
    left,
    right,
    makeBody("planet", { x: center.x, y: center.y - 210 }, { x: 2.5, y: 0 }, { name: "Circumbinary Planet", color: "#50e890" })
  ];
}

function figureEight(center: Vector): Body[] {
  const scaleFactor = 115;
  const mass = 10;
  const velocityScale = Math.sqrt((DEFAULT_GRAVITY * mass) / scaleFactor);
  const positions = [
    { x: -0.97000436, y: 0.24308753 },
    { x: 0.97000436, y: -0.24308753 },
    { x: 0, y: 0 }
  ];
  const velocities = [
    { x: 0.466203685, y: 0.43236573 },
    { x: 0.466203685, y: 0.43236573 },
    { x: -0.93240737, y: -0.86473146 }
  ];
  const colors = ["#4a9eff", "#ff6b4a", "#50e890"];

  return positions.map((position, index) =>
    makeBody(
      "planet",
      {
        x: center.x + position.x * scaleFactor,
        y: center.y + position.y * scaleFactor
      },
      scale(velocities[index], velocityScale),
      {
        mass,
        radius: 8,
        color: colors[index],
        name: `Figure Body ${index + 1}`
      }
    )
  );
}

function galaxyCollision(center: Vector, dimensions: Dimensions, particlesPerGalaxy: number): Body[] {
  const span = Math.min(dimensions.width, dimensions.height);
  const leftCenter = { x: center.x - span * 0.25, y: center.y - span * 0.08 };
  const rightCenter = { x: center.x + span * 0.25, y: center.y + span * 0.08 };

  return [
    ...galaxyCluster(leftCenter, { x: 1.15, y: 0.18 }, 1, particlesPerGalaxy, 17),
    ...galaxyCluster(rightCenter, { x: -1.15, y: -0.18 }, -1, particlesPerGalaxy, 71)
  ];
}

function galaxyCluster(center: Vector, drift: Vector, spinSign: 1 | -1, count: number, seed: number): Body[] {
  const random = seeded(seed);
  const halo = makeBody("darkMatter", center, drift, {
    mass: 240,
    radius: 42,
    hidden: true,
    name: "Dark Matter Halo"
  });
  const core = makeBody("star", add(center, { x: (random() - 0.5) * 14, y: (random() - 0.5) * 14 }), drift, {
    mass: 36,
    radius: 16,
    name: "Galactic Core",
    color: "#fff5cc"
  });
  const bodies = [halo, core];

  for (let i = 0; i < count; i += 1) {
    const arm = i % 4;
    const t = (i + random()) / count;
    const angle = arm * (Math.PI / 2) + t * Math.PI * 4 * spinSign + random() * 0.55;
    const radius = 18 + Math.pow(t, 0.72) * 170 + random() * 18;
    const jitter = { x: (random() - 0.5) * 10, y: (random() - 0.5) * 10 };
    const position = add(center, {
      x: Math.cos(angle) * radius + jitter.x,
      y: Math.sin(angle) * radius * 0.62 + jitter.y
    });
    const direction = normalize(sub(position, center));
    const tangent = scale(perpendicular(direction), spinSign);
    const orbitSpeed = Math.sqrt((DEFAULT_GRAVITY * (halo.mass + core.mass)) / Math.max(20, radius)) * 0.64;
    const type: BodyType = i % 31 === 0 ? "planet" : i % 5 === 0 ? "debris" : "asteroid";
    const body = makeBody(type, position, add(drift, scale(tangent, orbitSpeed)), {
      mass: type === "planet" ? 0.35 : type === "debris" ? 0.03 : 0.08,
      radius: type === "planet" ? 4 : 2,
      color: galaxyColor(i, random()),
      name: type === "planet" ? "Rogue Planet" : "Star Dust"
    });
    bodies.push(body);
  }

  return bodies;
}

function captureChallenge(center: Vector): Body[] {
  const capturePlanet = makeBody("giant", { x: center.x - 190, y: center.y + 20 }, { x: 0, y: -0.42 }, {
    name: "Capture Planet",
    mass: 12,
    radius: 17,
    color: "#4a9eff"
  });
  const rival = makeBody("giant", { x: center.x + 160, y: center.y - 20 }, { x: 0, y: 0.38 }, {
    name: "Rival Planet",
    mass: 11,
    radius: 16,
    color: "#ff6b4a"
  });
  const moonDistance = 48;
  const moonPosition = { x: rival.position.x, y: rival.position.y - moonDistance };
  const moonSpeed = Math.sqrt((DEFAULT_GRAVITY * rival.mass) / moonDistance);
  const targetMoon = makeBody("planet", moonPosition, add(rival.velocity, { x: moonSpeed, y: 0 }), {
    name: "Target Moon",
    mass: 0.45,
    radius: 5,
    color: "#dbeafe"
  });
  const launcher = makeBody("asteroid", { x: center.x - 330, y: center.y + 150 }, { x: 2.6, y: -1.3 }, {
    name: "Launcher",
    mass: 0.35,
    radius: 4,
    color: "#f59e0b"
  });

  return [capturePlanet, rival, targetMoon, launcher];
}

function galaxyColor(index: number, random: number): string {
  const colors = ["#dbeafe", "#c4b5fd", "#fef3c7", "#fbcfe8", "#bae6fd", "#fed7aa"];
  return colors[(index + Math.floor(random * colors.length)) % colors.length];
}

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
