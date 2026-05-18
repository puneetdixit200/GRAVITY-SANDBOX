# Gravity Play

Browser-based N-body gravity sandbox built with Next.js, TypeScript, and Canvas 2D.

Live app: https://gravity-sandbox-eight.vercel.app

![Gravity Play desktop screenshot](docs/screenshots/gravity-sandbox-desktop.png)

## What It Does

Drop asteroids, planets, giants, stars, black holes, and dark matter onto a space canvas. Drag while placing to set initial velocity, then watch the bodies orbit, merge, eject, collapse, or get absorbed.

The simulation uses custom TypeScript physics with softened N-body gravity, Velocity Verlet integration, collision merging with momentum conservation, Roche-limit debris, dense-scene solver optimization, and real-time Canvas rendering.

## Highlights

- Real-time gravitational interaction between all bodies
- Click and drag body placement with velocity arrows
- Movable and resizable dashboards
- Teach mode on by default with live event logging
- 2D and fake 3D view modes
- Gravity gun pull/repel tool
- Orbit prediction ghost paths
- Wormholes with velocity-preserving teleport
- Supernova, meteor storm, and system collapse controls
- WebM replay export
- Presets for Solar System, binary stars, figure-eight, galaxy collision, galaxy mode, and moon capture

## Screenshots

| Desktop chaos view | Mobile dashboard view |
| --- | --- |
| ![Desktop chaos screenshot](docs/screenshots/gravity-sandbox-desktop.png) | ![Mobile dashboard screenshot](docs/screenshots/gravity-sandbox-mobile.png) |

More details are in [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md).

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verification

```bash
npm run test:run
npm run lint
npm run build
npm run test:e2e
```

The current production deployment was verified with unit tests, lint, production build, desktop/mobile Playwright tests, Vercel inspect, and Vercel error log checks. See [docs/TESTING.md](docs/TESTING.md).

## More Docs

- [Feature guide](docs/FEATURES.md)
- [Screenshot gallery](docs/SCREENSHOTS.md)
- [Testing and deployment notes](docs/TESTING.md)
