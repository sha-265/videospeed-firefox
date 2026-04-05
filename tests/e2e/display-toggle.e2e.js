/**
 * E2E test for display toggle functionality (V key show/hide).
 */

import { launchChromeWithExtension, sleep, waitForController } from './e2e-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDisplayToggle() {
  console.log('🧪 Testing display toggle functionality...');

  const { browser, page } = await launchChromeWithExtension();

  try {
    const testPagePath = `file://${path.join(__dirname, 'test-video.html')}`;
    await page.goto(testPagePath, { waitUntil: 'networkidle2' });

    // Wait for extension controller to be fully attached (not raw sleep)
    const found = await waitForController(page, 15000);
    if (!found) {
      throw new Error('Controller never appeared');
    }

    // Verify controller is initially visible
    const controllerVisible = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      if (!controller) {
        return { success: false, message: 'No controller found' };
      }

      return {
        success: !controller.classList.contains('vsc-hidden'),
        message: `Classes: ${controller.className}`,
      };
    });

    if (!controllerVisible.success) {
      throw new Error(`Controller not initially visible: ${controllerVisible.message}`);
    }

    console.log('✅ Controller is initially visible');

    // Press 'V' to hide controller
    await page.keyboard.press('v');
    await sleep(300);

    const controllerHidden = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      return {
        success: controller.classList.contains('vsc-hidden'),
        message: `Classes: ${controller.className}`,
      };
    });

    if (!controllerHidden.success) {
      throw new Error(`Controller not hidden after first toggle: ${controllerHidden.message}`);
    }

    console.log('✅ Controller hidden after pressing V');

    // Press 'V' again to show controller
    await page.keyboard.press('v');
    await sleep(300);

    const controllerVisibleAgain = await page.evaluate(() => {
      const controller = document.querySelector('.vsc-controller');
      return {
        success: !controller.classList.contains('vsc-hidden'),
        message: `Classes: ${controller.className}`,
      };
    });

    if (!controllerVisibleAgain.success) {
      throw new Error(
        `Controller not visible after second toggle: ${controllerVisibleAgain.message}`
      );
    }

    console.log('✅ Controller visible again after pressing V');
    console.log('✅ Display toggle test passed!');
    return { success: true };
  } catch (error) {
    console.error('❌ Display toggle test failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export test runner function
export async function run() {
  const result = await testDisplayToggle();
  return {
    passed: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
  };
}

export { testDisplayToggle };
