/**
 * E2E tests for settings injection and runtime modification.
 *
 * With world:"MAIN", settings arrive via the CustomEvent bridge at init.
 * These tests verify that modifying in-memory config at runtime correctly
 * changes extension behavior (key bindings, speed increments, reset speed).
 */

import { launchChromeWithExtension, sleep } from './e2e-utils.js';

export default async function runSettingsInjectionE2ETests() {
  console.log('🧪 Running Settings Injection E2E Tests...');

  let browser;
  let passed = 0;
  let failed = 0;

  const runTest = async (testName, testFn) => {
    try {
      console.log(`   🧪 ${testName}`);
      await testFn();
      console.log(`   ✅ ${testName}`);
      passed++;
    } catch (error) {
      console.log(`   ❌ ${testName}: ${error.message}`);
      failed++;
    }
  };

  try {
    const { browser: chromeBrowser, page } = await launchChromeWithExtension();
    browser = chromeBrowser;

    await page.goto('https://www.youtube.com/watch?v=gGCJOTvECVQ', { waitUntil: 'networkidle2' });
    await sleep(3000);

    await page.waitForFunction(
      () => !!(window.VSC?.StorageManager && window.VSC_controller?.initialized),
      { timeout: 10000 }
    );

    await runTest('In-memory settings modification should change behavior', async () => {
      // Directly modify config.settings — the runtime source of truth.
      // (The bridge/storage path is tested in unit tests; here we verify
      // that the extension actually respects whatever is in config.settings.)
      await page.evaluate(() => {
        const config = window.VSC_controller.config;
        config.settings.keyBindings = [
          { action: 'slower', key: 83, value: 0.2, force: false, predefined: true },
          { action: 'faster', key: 68, value: 0.2, force: false, predefined: true },
          { action: 'rewind', key: 90, value: 10, force: false, predefined: true },
          { action: 'advance', key: 88, value: 10, force: false, predefined: true },
          { action: 'reset', key: 82, value: 1.9, force: false, predefined: true },
          { action: 'fast', key: 71, value: 1.8, force: false, predefined: true },
          { action: 'display', key: 86, value: 0, force: false, predefined: true },
        ];
      });

      const settingsState = await page.evaluate(() => {
        const config = window.VSC?.videoSpeedConfig;
        const fasterBinding = config?.settings?.keyBindings?.find((kb) => kb.action === 'faster');
        const resetBinding = config?.settings?.keyBindings?.find((kb) => kb.action === 'reset');
        return {
          hasConfig: !!config,
          fasterIncrement: fasterBinding?.value,
          resetPreferredSpeed: resetBinding?.value,
        };
      });

      if (!settingsState.hasConfig) {
        throw new Error('Extension config not found');
      }
      if (settingsState.fasterIncrement !== 0.2) {
        throw new Error(`Expected faster increment 0.2, got ${settingsState.fasterIncrement}`);
      }
      if (settingsState.resetPreferredSpeed !== 1.9) {
        throw new Error(`Expected reset speed 1.9, got ${settingsState.resetPreferredSpeed}`);
      }
    });

    await runTest('Keyboard shortcuts should use modified settings', async () => {
      // Reset video to 1.0 first
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.playbackRate = 1.0;
        }
      });
      await sleep(100);

      const initialSpeed = await page.evaluate(() => document.querySelector('video')?.playbackRate);

      await page.keyboard.press('KeyD');
      await sleep(100);

      const newSpeed = await page.evaluate(() => document.querySelector('video')?.playbackRate);
      const speedDifference = Math.round((newSpeed - initialSpeed) * 10) / 10;

      if (speedDifference !== 0.2) {
        throw new Error(`Expected speed increment of 0.2, got ${speedDifference}`);
      }
    });

    await runTest('Reset key should use preferred speed', async () => {
      const speedBeforeReset = await page.evaluate(
        () => document.querySelector('video')?.playbackRate
      );

      await page.keyboard.press('KeyR');
      await sleep(100);

      const resetSpeed = await page.evaluate(() => document.querySelector('video')?.playbackRate);

      if (resetSpeed === speedBeforeReset) {
        throw new Error(
          `Reset key should change speed from ${speedBeforeReset}, but it stayed the same`
        );
      }
    });

    await runTest('Settings should survive in-memory across actions', async () => {
      // After the previous tests modified speed, verify config still holds our values
      const fasterValue = await page.evaluate(() => {
        const config = window.VSC?.videoSpeedConfig;
        return config?.settings?.keyBindings?.find((kb) => kb.action === 'faster')?.value;
      });

      if (fasterValue !== 0.2) {
        throw new Error(`Settings lost after actions: expected 0.2, got ${fasterValue}`);
      }
    });
  } catch (error) {
    console.log(`   💥 Test setup failed: ${error.message}`);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n   📊 Settings Injection E2E Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
