import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('GoGreen Studio Visual Capture', () => {
  test.beforeAll(() => {
    const dir = path.resolve('docs/screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('capture Overview page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/01_overview.png', fullPage: true });
  });

  test('capture Core Engine page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/core-engine');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/02_core_engine.png', fullPage: true });
  });

  test('capture Binary Lab page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/binary-lab');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/03_binary_lab.png', fullPage: true });
  });

  test('capture Profiler page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/profiler');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/04_profiler.png', fullPage: true });
  });

  test('capture Distributed Mesh page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/distributed-mesh');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/05_distributed_mesh.png', fullPage: true });
  });

  test('capture Sandbox page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/sandbox');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/06_sandbox.png', fullPage: true });
  });

  test('capture System Monitor page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/system-monitor');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/07_system_monitor.png', fullPage: true });
  });

  test('capture Experiments page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/experiments');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/08_experiments.png', fullPage: true });
  });

  test('capture Logs page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/09_logs.png', fullPage: true });
  });

  test('capture Settings page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/10_settings.png', fullPage: true });
  });
});
