/**
 * Unit tests for user-editable controller CSS feature
 * Covers: DEFAULT_CONTROLLER_CSS constant, controllerCSS in settings,
 * www. stripping in applyDomainStyles, dynamic CSS injection, live updates
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
  getMockStorage,
} from '../../helpers/chrome-mock.js';
// Helper: ensure chrome mock is active and storage is clean
function setupMock() {
  installChromeMock();
  resetMockStorage();
  window.VSC_settings = null;
}

describe('ControllerCSS', () => {
  beforeEach(() => {
    setupMock();
  });

  afterEach(() => {
    cleanupChromeMock();
  });

  // --- Phase 1: Foundation ---

  it('DEFAULT_CONTROLLER_CSS constant exists and is a non-empty string', () => {
    const css = window.VSC.Constants.DEFAULT_CONTROLLER_CSS;
    expect(css).toBeDefined();
    expect(typeof css).toBe('string');
    expect(css.length > 100).toBe(true);
  });

  it('DEFAULT_CONTROLLER_CSS contains site override rules (not base rule)', () => {
    const css = window.VSC.Constants.DEFAULT_CONTROLLER_CSS;
    // Base rule (position:absolute etc) is in inject.css for timing safety — not here
    expect(css.includes('vsc-controller')).toBe(true);
    expect(!css.startsWith('vsc-controller {')).toBe(true);
  });

  it('DEFAULT_CONTROLLER_CSS contains domain-based rules', () => {
    const css = window.VSC.Constants.DEFAULT_CONTROLLER_CSS;
    expect(css.includes('--vsc-domain: "facebook.com"')).toBe(true);
    expect(css.includes('--vsc-domain: "netflix.com"')).toBe(true);
    expect(css.includes('--vsc-domain: "chatgpt.com"')).toBe(true);
    expect(css.includes('--vsc-domain: "drive.google.com"')).toBe(true);
  });

  it('DEFAULT_CONTROLLER_CSS preserves DOM-contextual YouTube rules', () => {
    const css = window.VSC.Constants.DEFAULT_CONTROLLER_CSS;
    expect(css.includes('.ytp-hide-info-bar')).toBe(true);
    expect(css.includes('.ytp-paid-content-overlay-link')).toBe(true);
    expect(css.includes('#player > vsc-controller')).toBe(true);
  });

  it('DEFAULT_SETTINGS includes controllerCSS field (sync storage)', () => {
    const defaults = window.VSC.Constants.DEFAULT_SETTINGS;
    expect(defaults.controllerCSS).toBeDefined();
    expect(defaults.controllerCSS).toBe(window.VSC.Constants.DEFAULT_CONTROLLER_CSS);
  });

  it('controllerCSS loads from storage into settings', async () => {
    setupMock();
    const customCSS = 'vsc-controller { top: 999px; }';
    getMockStorage().controllerCSS = customCSS;

    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    expect(config.settings.controllerCSS).toBe(customCSS);
  });

  it('controllerCSS falls back to default when absent from storage', async () => {
    setupMock();

    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    expect(config.settings.controllerCSS).toBe(window.VSC.Constants.DEFAULT_CONTROLLER_CSS);
  });

  it('controllerCSS round-trips through save and load', async () => {
    setupMock();

    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    const customCSS = 'vsc-controller { position: relative; top: 42px; }';
    await config.save({ controllerCSS: customCSS });

    // Create a fresh config and load from storage
    const config2 = new window.VSC.VideoSpeedConfig();
    await config2.load();

    expect(config2.settings.controllerCSS).toBe(customCSS);
  });
});
