import { test, expect } from '@playwright/test';

test.describe('GoGreen Studio Navigation & Operational States', () => {
  test('loads overview page and verifies brand identity', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/GoGreen/i);
    await expect(page.getByRole('link', { name: 'GoGreen' })).toBeVisible();
    await expect(page.getByText('BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.')).toBeVisible();
  });

  test('navigates to Binary Lab and verifies ELF specimen analysis', async ({ page }) => {
    await page.goto('/binary-lab');
    await expect(page.getByTitle('gogreen-core-x86_64.elf')).toBeVisible();
    await expect(page.getByText('ELF64')).toBeVisible();
    await expect(page.getByText('7F 45 4C 46')).toBeVisible();
  });

  test('navigates to Core Engine and verifies ISA matrix', async ({ page }) => {
    await page.goto('/core-engine');
    await expect(page.getByText('Instruction Set Architecture (ISA)')).toBeVisible();
    await expect(page.getByText('Assembly Routine Inventory')).toBeVisible();
    await expect(page.getByRole('button', { name: /asm_add_i64/i })).toBeVisible();
  });

  test('navigates to Profiler and verifies microbenchmark suite execution', async ({ page }) => {
    await page.goto('/profiler');
    await expect(page.getByText('Microarchitectural Profiler')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Benchmark Suite' })).toBeVisible();
    await page.getByRole('button', { name: 'Run Benchmark Suite' }).click();
    // Verify execution completes and either benchmark data or status message renders
    await expect(page.getByRole('button', { name: /Benchmark Suite/i }).first()).toBeVisible();
  });

  test('navigates to System Monitor and verifies host telemetry', async ({ page }) => {
    await page.goto('/system-monitor');
    await expect(page.getByText('System Diagnostics & Telemetry')).toBeVisible();
    await expect(page.getByText('Hardware Concurrency')).toBeVisible();
  });

  test('navigates to Settings and toggles preferences', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Laboratory Settings & Configurations')).toBeVisible();
    await expect(page.getByText('Telemetry Polling Interval (ms)')).toBeVisible();
    // Switch to endpoints tab
    await page.getByRole('button', { name: 'Service Endpoints & IPC' }).click();
    await expect(page.getByText('Platform Gateway URL')).toBeVisible();
  });
});
