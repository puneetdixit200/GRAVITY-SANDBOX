export type Vector = {
  x: number;
  y: number;
};

export type BodyType =
  | "asteroid"
  | "planet"
  | "giant"
  | "star"
  | "blackHole"
  | "debris"
  | "darkMatter";

export type TrailPoint = Vector & {
  t: number;
};

export type BodyDefinition = {
  label: string;
  mass: number;
  radius: number;
  color: string;
  trailWidth: number;
  icon: string;
};

export type Body = {
  id: string;
  type: BodyType;
  name: string;
  mass: number;
  radius: number;
  color: string;
  position: Vector;
  velocity: Vector;
  acceleration: Vector;
  trail: TrailPoint[];
  hidden?: boolean;
  spin: number;
};

export type BodyOverrides = Partial<
  Pick<Body, "id" | "name" | "mass" | "radius" | "color" | "hidden" | "spin">
>;

let bodyId = 0;

export const BODY_DEFINITIONS: Record<BodyType, BodyDefinition> = {
  asteroid: {
    label: "Asteroid",
    mass: 0.1,
    radius: 3,
    color: "#a7a7b1",
    trailWidth: 0,
    icon: "asterisk"
  },
  planet: {
    label: "Planet",
    mass: 1,
    radius: 7,
    color: "#4a9eff",
    trailWidth: 1.4,
    icon: "circle"
  },
  giant: {
    label: "Giant",
    mass: 5,
    radius: 13,
    color: "#ffb84a",
    trailWidth: 2.2,
    icon: "orbit"
  },
  star: {
    label: "Star",
    mass: 50,
    radius: 22,
    color: "#fff5cc",
    trailWidth: 3.2,
    icon: "sun"
  },
  blackHole: {
    label: "Black Hole",
    mass: 500,
    radius: 28,
    color: "#0a0710",
    trailWidth: 3.8,
    icon: "disc"
  },
  debris: {
    label: "Debris",
    mass: 0.03,
    radius: 2,
    color: "#d9d0c2",
    trailWidth: 0.6,
    icon: "sparkle"
  },
  darkMatter: {
    label: "Dark Matter",
    mass: 200,
    radius: 18,
    color: "#8b5cf6",
    trailWidth: 0,
    icon: "eye-off"
  }
};

export const PALETTE = [
  "#4a9eff",
  "#ff6b4a",
  "#50e890",
  "#ffb84a",
  "#c77dff",
  "#5eead4",
  "#f472b6",
  "#a3e635"
];

export function add(a: Vector, b: Vector): Vector {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vector, b: Vector): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector, amount: number): Vector {
  return { x: v.x * amount, y: v.y * amount };
}

export function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

export function magnitude(v: Vector): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(v: Vector): Vector {
  const length = magnitude(v);
  if (length < 1e-9) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / length, y: v.y / length };
}

export function perpendicular(v: Vector): Vector {
  return { x: -v.y, y: v.x };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVector(a: Vector, b: Vector, t: number): Vector {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function finiteVector(v: Vector): Vector {
  return {
    x: Number.isFinite(v.x) ? v.x : 0,
    y: Number.isFinite(v.y) ? v.y : 0
  };
}

export function radiusForMass(type: BodyType, mass: number): number {
  if (type === "blackHole") {
    return Math.max(18, Math.sqrt(mass) * 1.35);
  }
  if (type === "star") {
    return Math.max(18, Math.cbrt(mass) * 6);
  }
  if (type === "giant") {
    return Math.max(11, Math.cbrt(mass) * 6);
  }
  if (type === "darkMatter") {
    return Math.max(16, Math.sqrt(mass) * 0.85);
  }
  if (type === "debris") {
    return Math.max(1.5, Math.sqrt(mass) * 2.2);
  }
  return Math.max(3, Math.sqrt(mass) * 7);
}

export function upgradeTypeForMass(mass: number, preferred: BodyType): BodyType {
  if (preferred === "blackHole" || mass >= BODY_DEFINITIONS.blackHole.mass) {
    return "blackHole";
  }
  if (preferred === "darkMatter") {
    return "darkMatter";
  }
  if (mass >= BODY_DEFINITIONS.star.mass) {
    return "star";
  }
  if (mass >= BODY_DEFINITIONS.giant.mass) {
    return "giant";
  }
  if (mass < 0.2) {
    return "asteroid";
  }
  return "planet";
}

export function makeBody(
  type: BodyType,
  position: Vector,
  velocity: Vector = { x: 0, y: 0 },
  overrides: BodyOverrides = {}
): Body {
  const definition = BODY_DEFINITIONS[type];
  const mass = overrides.mass ?? definition.mass;
  const color = overrides.color ?? definition.color;

  return {
    id: overrides.id ?? `${type}-${bodyId += 1}`,
    type,
    name: overrides.name ?? definition.label,
    mass,
    radius: overrides.radius ?? radiusForMass(type, mass),
    color,
    hidden: overrides.hidden ?? type === "darkMatter",
    position: { ...position },
    velocity: { ...velocity },
    acceleration: { x: 0, y: 0 },
    trail: [],
    spin: overrides.spin ?? Math.random() * Math.PI * 2
  };
}

export function cloneBody(body: Body): Body {
  return {
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
    acceleration: { ...body.acceleration },
    trail: body.trail.map((point) => ({ ...point }))
  };
}

export function sanitizeBody(body: Body): Body {
  return {
    ...body,
    position: finiteVector(body.position),
    velocity: finiteVector(body.velocity),
    acceleration: finiteVector(body.acceleration),
    mass: Number.isFinite(body.mass) && body.mass > 0 ? body.mass : 0.1,
    radius: Number.isFinite(body.radius) && body.radius > 0 ? body.radius : 2
  };
}
