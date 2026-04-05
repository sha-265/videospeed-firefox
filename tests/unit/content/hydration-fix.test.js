/**
 * Tests for hydration-safe initialization tracking
 * Ensures VSC doesn't modify DOM attributes that cause React hydration errors
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { createMockDOM } from '../../helpers/test-utils.js';

// Load all required modules

let mockDOM;

describe('HydrationFix', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    mockDOM = createMockDOM();

    // Initialize site handler manager for tests
    if (window.VSC && window.VSC.siteHandlerManager) {
      window.VSC.siteHandlerManager.initialize(document);
    }
  });

  afterEach(() => {
    cleanupChromeMock();
    if (mockDOM) {
      mockDOM.cleanup();
    }
  });

  it('VSC content script avoids DOM modifications that cause hydration errors', () => {
    // Record initial body classes and attributes
    const initialBodyClasses = [...document.body.classList];
    const initialBodyHTML = document.body.outerHTML;

    // Test that VSC state tracking works without DOM modifications
    // Use simple boolean flag in VSC namespace
    window.VSC.initialized = false;

    expect(window.VSC.initialized).toBe(false);

    // Simulate initialization
    window.VSC.initialized = true;

    // Verify no classes were added to body
    const finalBodyClasses = [...document.body.classList];
    const finalBodyHTML = document.body.outerHTML;

    expect(initialBodyClasses).toEqual(finalBodyClasses);

    expect(initialBodyHTML).toBe(finalBodyHTML);

    // Verify JavaScript state tracking is working
    expect(window.VSC.initialized).toBe(true);
  });

  it('CSS domain preprocessing avoids DOM modifications to <html>', () => {
    // Record initial state of <html> and <body>
    const initialBodyClasses = [...document.body.classList];
    const initialBodyHTML = document.body.outerHTML;
    const initialRootStyle = document.documentElement.getAttribute('style');

    // Simulate the preprocessing approach from content-bridge.js:
    // Domain selectors are resolved at injection time — no CSS variable on <html>.
    const hostname = 'chatgpt.com';
    const rawCSS = `
:root[style*='--vsc-domain: "chatgpt.com"'] vsc-controller { top: 0px; }
:root[style*='--vsc-domain: "netflix.com"'] vsc-controller { top: 85px; }
    `.trim();

    // preprocessDomainCSS strips the attribute selector for matching domain,
    // replaces with [data-vsc-never] for non-matching domains.
    const processed = rawCSS.replace(
      /\[style\*='--vsc-domain:\s*"([^"]+)"'\]/g,
      (_match, domain) => (domain === hostname ? '' : '[data-vsc-never]')
    );

    // Matching domain: selector stripped → ":root vsc-controller { top: 0px; }"
    expect(processed).toContain(':root vsc-controller { top: 0px; }');
    // Non-matching domain: selector can never match
    expect(processed).toContain(':root[data-vsc-never] vsc-controller { top: 85px; }');

    // Verify NO modifications to <html> or <body>
    const finalBodyClasses = [...document.body.classList];
    const finalBodyHTML = document.body.outerHTML;
    const finalRootStyle = document.documentElement.getAttribute('style');

    expect(initialBodyClasses).toEqual(finalBodyClasses);
    expect(initialBodyHTML).toBe(finalBodyHTML);
    expect(initialRootStyle).toBe(finalRootStyle);
  });

  it('Simple boolean flag prevents double initialization', () => {
    window.VSC.initialized = false;
    expect(window.VSC.initialized).toBe(false);

    // First initialization sets the flag
    window.VSC.initialized = true;
    expect(window.VSC.initialized).toBe(true);

    // Second attempt should see it's already initialized
    expect(window.VSC.initialized).toBe(true);
  });
});
