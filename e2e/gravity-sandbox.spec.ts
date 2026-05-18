import { expect, test } from "@playwright/test";

test("renders the simulator and responds to core controls", async ({ page }, testInfo) => {
  await page.goto("/");

  const canvas = page.getByLabel("Gravity simulation canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByLabel("Simulation stats")).toContainText("Bodies");

  await page.getByLabel("Pause").click();
  await page.getByLabel("Clear all").click();
  await expect(page.getByLabel("Simulation stats")).toContainText("0");

  await page.getByLabel("Black Hole").click();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const center =
    testInfo.project.name === "mobile"
      ? { x: box!.x + 56, y: box!.y + 580 }
      : { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  if (testInfo.project.name === "mobile") {
    await page.touchscreen.tap(center.x, center.y);
  } else {
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 90, center.y - 35);
    await page.mouse.up();
  }
  await expect
    .poll(async () => {
      const text = await page.getByLabel("Simulation stats").innerText();
      const match = text.match(/Bodies\s+(\d+)/);
      return match ? Number(match[1]) : 0;
    })
    .toBe(1);

  await page.getByTitle("Galaxy Mode").click();
  await expect
    .poll(async () => {
      const text = await page.getByLabel("Simulation stats").innerText();
      const match = text.match(/Bodies\s+(\d+)/);
      return match ? Number(match[1]) : 0;
    })
    .toBeGreaterThan(120);

  const pixelStats = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      return { samples: 0, variance: 0 };
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return { samples: 0, variance: 0 };
    }
    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    let samples = 0;
    let sum = 0;
    let sumSq = 0;
    for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 40))) {
      for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 40))) {
        const index = (y * width + x) * 4;
        const value = data[index] + data[index + 1] + data[index + 2];
        samples += 1;
        sum += value;
        sumSq += value * value;
      }
    }
    const mean = sum / samples;
    return { samples, variance: sumSq / samples - mean * mean };
  });

  expect(pixelStats.samples).toBeGreaterThan(100);
  expect(pixelStats.variance).toBeGreaterThan(20);

  await page.screenshot({ path: testInfo.outputPath("gravity-sandbox.png"), fullPage: true });
});

test("supports movable/resizable dashboards, teach mode, 3D view, and GitHub link", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByLabel("Teach mode")).toContainText("What is happening");
  await expect(page.getByLabel("Teach event log")).toContainText(/Loaded|Ready|Preset|Simulation/);

  if (testInfo.project.name === "chromium") {
    const defaultPanels = [
      { label: "stats movable panel", minWidth: 260, minHeight: 210 },
      { label: "conservation movable panel", minWidth: 310, minHeight: 250 },
      { label: "teach movable panel", minWidth: 430, minHeight: 400 },
      { label: "time-controls movable panel", minWidth: 1040, minHeight: 220 }
    ];

    for (const panel of defaultPanels) {
      const locator = page.getByLabel(panel.label);
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box, `${panel.label} should start expanded`).not.toBeNull();
      expect(box!.width, `${panel.label} width`).toBeGreaterThanOrEqual(panel.minWidth);
      expect(box!.height, `${panel.label} height`).toBeGreaterThanOrEqual(panel.minHeight);
    }
  }

  const stats = page.getByLabel("Simulation stats");
  await expect(stats).toBeVisible();

  const moveHandle = page.getByLabel("Move stats panel");
  const beforeMove = await stats.boundingBox();
  expect(beforeMove).not.toBeNull();
  const moveBox = await moveHandle.boundingBox();
  expect(moveBox).not.toBeNull();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2, moveBox!.y + moveBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2 - 42, moveBox!.y + moveBox!.height / 2 + 78, { steps: 8 });
  await page.mouse.up();
  const afterMove = await stats.boundingBox();
  expect(afterMove).not.toBeNull();
  expect(Math.abs(afterMove!.x - beforeMove!.x) + Math.abs(afterMove!.y - beforeMove!.y)).toBeGreaterThan(30);

  const resizeHandle = page.getByLabel("Resize stats panel");
  const beforeResize = await stats.boundingBox();
  expect(beforeResize).not.toBeNull();
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox!.x + resizeBox!.width / 2 + 86, resizeBox!.y + resizeBox!.height / 2 + 48, { steps: 8 });
  await page.mouse.up();
  const afterResize = await stats.boundingBox();
  expect(afterResize).not.toBeNull();
  expect(afterResize!.width).toBeGreaterThan(beforeResize!.width + 30);

  await page.getByTitle("3D View").click();
  await expect(page.locator(".sandbox-shell")).toHaveAttribute("data-view-mode", "3d");

  const github = page.getByLabel("GitHub profile");
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute("href", "https://github.com/puneetdixit200");
});

test("exposes chaos toys for gravity gun, wormholes, disasters, prediction, and recording", async ({ page }) => {
  await page.goto("/");

  const chaos = page.getByLabel("Chaos controls");
  await expect(chaos).toBeVisible();

  await page.getByRole("button", { name: "Gravity gun" }).click();
  await expect(page.getByRole("button", { name: "Gravity gun" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Orbit prediction" }).click();
  await expect(page.getByRole("button", { name: "Orbit prediction" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Spawn wormholes" }).click();
  await expect(page.getByLabel("Teach event log")).toContainText(/Wormhole/);

  await page.getByRole("button", { name: "Trigger supernova" }).click();
  await expect(page.getByLabel("Cinematic event")).toContainText(/Supernova|Collision|Absorption/);

  await expect(page.getByRole("button", { name: "Record WebM" })).toBeVisible();
});
