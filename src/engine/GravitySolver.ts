import { Body, Vector, finiteVector } from "./Body";

export type ForceMode = "direct" | "barnesHut" | "hybrid";

export type GravitySolverOptions = {
  gravity: number;
  softening: number;
  forceExponent: number;
  theta?: number;
};

type QuadNode = {
  centerX: number;
  centerY: number;
  half: number;
  mass: number;
  comX: number;
  comY: number;
  count: number;
  items: Body[];
  children: QuadNode[] | null;
};

const MAX_DEPTH = 18;
const MIN_HALF_SIZE = 0.25;

export function computeDirectAccelerations(bodies: Body[], options: GravitySolverOptions): Vector[] {
  const accelerations = bodies.map(() => ({ x: 0, y: 0 }));
  const exponent = Math.max(0.35, Math.min(4, options.forceExponent));

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const distanceSquared = dx * dx + dy * dy + options.softening * options.softening;
      const denominator = Math.pow(distanceSquared, (exponent + 1) / 2);
      const factor = denominator > 0 ? options.gravity / denominator : 0;

      accelerations[i].x += dx * factor * b.mass;
      accelerations[i].y += dy * factor * b.mass;
      accelerations[j].x -= dx * factor * a.mass;
      accelerations[j].y -= dy * factor * a.mass;
    }
  }

  return accelerations.map(finiteVector);
}

export function computeBarnesHutAccelerations(bodies: Body[], options: GravitySolverOptions): Vector[] {
  if (bodies.length < 2) {
    return bodies.map(() => ({ x: 0, y: 0 }));
  }

  const root = buildTree(bodies);
  const theta = options.theta ?? 0.82;
  return bodies.map((body) => finiteVector(accumulateAcceleration(root, body, options, theta)));
}

export function computeHybridAccelerations(bodies: Body[], options: GravitySolverOptions): Vector[] {
  const accelerations = bodies.map(() => ({ x: 0, y: 0 }));
  const sourceEntries = bodies
    .map((body, index) => ({ body, index }))
    .filter((entry) => !isFineParticle(entry.body));

  if (sourceEntries.length === 0) {
    return computeBarnesHutAccelerations(bodies, options);
  }

  const sources = sourceEntries.map((entry) => entry.body);
  const sourceAccelerations =
    sources.length >= 120 ? computeBarnesHutAccelerations(sources, options) : computeDirectAccelerations(sources, options);

  sourceEntries.forEach((entry, sourceIndex) => {
    accelerations[entry.index] = sourceAccelerations[sourceIndex];
  });

  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    if (!isFineParticle(body)) {
      continue;
    }

    let ax = 0;
    let ay = 0;
    for (const source of sources) {
      const dx = source.position.x - body.position.x;
      const dy = source.position.y - body.position.y;
      const acceleration = accelerationFromMass(dx, dy, source.mass, options);
      ax += acceleration.x;
      ay += acceleration.y;
    }
    accelerations[i] = finiteVector({ x: ax, y: ay });
  }

  return accelerations;
}

export function isFineParticle(body: Body): boolean {
  return body.type === "asteroid" || body.type === "debris";
}

function buildTree(bodies: Body[]): QuadNode {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const body of bodies) {
    minX = Math.min(minX, body.position.x);
    minY = Math.min(minY, body.position.y);
    maxX = Math.max(maxX, body.position.x);
    maxY = Math.max(maxY, body.position.y);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const size = Math.max(width, height) + 4;
  const root = createNode((minX + maxX) / 2, (minY + maxY) / 2, size / 2);

  for (const body of bodies) {
    insertBody(root, body, 0);
  }

  return root;
}

function createNode(centerX: number, centerY: number, half: number): QuadNode {
  return {
    centerX,
    centerY,
    half,
    mass: 0,
    comX: 0,
    comY: 0,
    count: 0,
    items: [],
    children: null
  };
}

function insertBody(node: QuadNode, body: Body, depth: number) {
  const nextMass = node.mass + body.mass;
  node.comX = nextMass > 0 ? (node.comX * node.mass + body.position.x * body.mass) / nextMass : body.position.x;
  node.comY = nextMass > 0 ? (node.comY * node.mass + body.position.y * body.mass) / nextMass : body.position.y;
  node.mass = nextMass;
  node.count += 1;

  if (!node.children) {
    if (node.items.length === 0 || depth >= MAX_DEPTH || node.half <= MIN_HALF_SIZE) {
      node.items.push(body);
      return;
    }

    const existing = node.items;
    node.items = [];
    node.children = createChildren(node);
    for (const existingBody of existing) {
      insertBody(selectChild(node, existingBody), existingBody, depth + 1);
    }
  }

  insertBody(selectChild(node, body), body, depth + 1);
}

function createChildren(node: QuadNode): QuadNode[] {
  const quarter = node.half / 2;
  return [
    createNode(node.centerX - quarter, node.centerY - quarter, quarter),
    createNode(node.centerX + quarter, node.centerY - quarter, quarter),
    createNode(node.centerX - quarter, node.centerY + quarter, quarter),
    createNode(node.centerX + quarter, node.centerY + quarter, quarter)
  ];
}

function selectChild(node: QuadNode, body: Body): QuadNode {
  const east = body.position.x >= node.centerX ? 1 : 0;
  const south = body.position.y >= node.centerY ? 2 : 0;
  return node.children![east + south];
}

function accumulateAcceleration(node: QuadNode, target: Body, options: GravitySolverOptions, theta: number): Vector {
  if (node.count === 0 || node.mass <= 0) {
    return { x: 0, y: 0 };
  }

  if (!node.children) {
    return accumulateDirectLeaf(node, target, options);
  }

  const dx = node.comX - target.position.x;
  const dy = node.comY - target.position.y;
  const distance = Math.hypot(dx, dy);
  const containsTarget = containsPoint(node, target.position.x, target.position.y);

  if (!containsTarget && distance > 0 && (node.half * 2) / distance < theta) {
    return accelerationFromMass(dx, dy, node.mass, options);
  }

  let ax = 0;
  let ay = 0;
  for (const child of node.children) {
    const acceleration = accumulateAcceleration(child, target, options, theta);
    ax += acceleration.x;
    ay += acceleration.y;
  }

  return { x: ax, y: ay };
}

function accumulateDirectLeaf(node: QuadNode, target: Body, options: GravitySolverOptions): Vector {
  let ax = 0;
  let ay = 0;

  for (const body of node.items) {
    if (body.id === target.id) {
      continue;
    }
    const dx = body.position.x - target.position.x;
    const dy = body.position.y - target.position.y;
    const acceleration = accelerationFromMass(dx, dy, body.mass, options);
    ax += acceleration.x;
    ay += acceleration.y;
  }

  return { x: ax, y: ay };
}

function accelerationFromMass(dx: number, dy: number, mass: number, options: GravitySolverOptions): Vector {
  const exponent = Math.max(0.35, Math.min(4, options.forceExponent));
  const distanceSquared = dx * dx + dy * dy + options.softening * options.softening;
  const denominator = Math.pow(distanceSquared, (exponent + 1) / 2);
  const factor = denominator > 0 ? (options.gravity * mass) / denominator : 0;
  return {
    x: dx * factor,
    y: dy * factor
  };
}

function containsPoint(node: QuadNode, x: number, y: number): boolean {
  return x >= node.centerX - node.half && x <= node.centerX + node.half && y >= node.centerY - node.half && y <= node.centerY + node.half;
}
