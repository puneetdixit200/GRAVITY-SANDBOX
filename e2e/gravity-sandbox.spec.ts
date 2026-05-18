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
  const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 90, center.y - 35);
  await page.mouse.up();
  await expect(page.getByLabel("Simulation stats")).toContainText("1");

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
