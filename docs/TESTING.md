# Testing And Deployment

![Gravity Sandbox desktop screenshot](screenshots/gravity-sandbox-desktop.png)

## Local Checks

Run these before pushing:

```bash
npm run test:run
npm run lint
npm run build
npm run test:e2e
```

## What The Tests Cover

- Physics acceleration direction and orbit stability.
- Velocity heading changes under gravity.
- Momentum-conserving collision merges.
- Black hole absorption.
- Dark matter attraction without collision.
- Dense galaxy performance guardrails.
- Time rewind and share-state round trips.
- Gravity gun pull and repel behavior.
- Wormhole teleport with speed preservation.
- Supernova debris generation.
- Orbit prediction without mutating live bodies.
- Desktop and mobile browser flows for placement, controls, movable dashboards, teach mode, 3D view, GitHub link, and Chaos Lab.

## Production Verification

Production is deployed on Vercel:

https://gravity-sandbox-eight.vercel.app

After deployment, verify:

```bash
npx vercel inspect https://gravity-sandbox-eight.vercel.app
npx vercel logs https://gravity-sandbox-eight.vercel.app --since 1h --level error
```

Then run the Playwright suite against production:

```bash
PLAYWRIGHT_BASE_URL=https://gravity-sandbox-eight.vercel.app npm run test:e2e
```

On Windows PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://gravity-sandbox-eight.vercel.app'
npm run test:e2e
```

## Visual Check

Use the screenshot gallery as the expected visual reference:

- [Screenshot gallery](SCREENSHOTS.md)
- [Desktop screenshot](screenshots/gravity-sandbox-desktop.png)
- [Mobile screenshot](screenshots/gravity-sandbox-mobile.png)
