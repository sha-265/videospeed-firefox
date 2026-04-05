/**
 * Tests for v1→v2 key binding migration (migrateKeyBindingsV2)
 *
 * The migration runs in background.js but we test the logic in isolation
 * by extracting the same maps and logic from constants.js.
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
// --- Helpers that mirror background.js migration logic ---
// Lazy accessors — window.VSC is populated by vitest-setup.js beforeAll

const Constants = () => window.VSC.Constants;
const PREDEFINED_CODE_MAP = () => Constants().PREDEFINED_CODE_MAP;
const KEYCODE_TO_CODE = () => Constants().KEYCODE_TO_CODE;
const PREDEFINED_ACTIONS = () => Constants().PREDEFINED_ACTIONS;
const displayKeyFromCode = (...args) => Constants().displayKeyFromCode(...args);

const DEFAULT_V2_BINDINGS = {
  slower: { code: 'KeyS', key: 83, keyCode: 83, displayKey: 's', value: 0.1, force: false },
  faster: { code: 'KeyD', key: 68, keyCode: 68, displayKey: 'd', value: 0.1, force: false },
  rewind: { code: 'KeyZ', key: 90, keyCode: 90, displayKey: 'z', value: 10, force: false },
  advance: { code: 'KeyX', key: 88, keyCode: 88, displayKey: 'x', value: 10, force: false },
  reset: { code: 'KeyR', key: 82, keyCode: 82, displayKey: 'r', value: 1.0, force: false },
  fast: { code: 'KeyG', key: 71, keyCode: 71, displayKey: 'g', value: 1.8, force: false },
  display: { code: 'KeyV', key: 86, keyCode: 86, displayKey: 'v', value: 0, force: false },
  mark: { code: 'KeyM', key: 77, keyCode: 77, displayKey: 'm', value: 0, force: false },
  jump: { code: 'KeyJ', key: 74, keyCode: 74, displayKey: 'j', value: 0, force: false },
};

/**
 * Extracted migration logic — mirrors migrateKeyBindingsV2() in background.js
 * Operates on in-memory data instead of chrome.storage for testability.
 */
function migrateBindings(storage) {
  const bindings = storage.keyBindings;

  if (!bindings || !Array.isArray(bindings) || bindings.length === 0) {
    return { skipped: 'no-bindings' };
  }

  if (storage.schemaVersion === 2 && bindings.every((b) => b.code !== undefined)) {
    return { skipped: 'already-v2' };
  }

  let predefinedCount = 0,
    customCount = 0,
    unmappableCount = 0;

  const migrated = bindings.map((binding) => {
    if (binding.code !== undefined) {
      return binding;
    }
    const legacyKey = binding.key;

    if (binding.predefined && PREDEFINED_CODE_MAP()[legacyKey]) {
      const mapped = PREDEFINED_CODE_MAP()[legacyKey];
      predefinedCount++;
      return { ...binding, code: mapped.code, keyCode: legacyKey, displayKey: mapped.displayKey };
    }

    const code = KEYCODE_TO_CODE()[legacyKey];
    if (code) {
      customCount++;
      return { ...binding, code, keyCode: legacyKey, displayKey: displayKeyFromCode(code) };
    }

    unmappableCount++;
    return { ...binding, code: null, keyCode: legacyKey, displayKey: '' };
  });

  const existingActions = new Set(migrated.map((b) => b.action));
  for (const action of PREDEFINED_ACTIONS()) {
    if (!existingActions.has(action)) {
      migrated.push({ action, ...DEFAULT_V2_BINDINGS[action], predefined: true });
    }
  }

  return {
    keyBindings: migrated,
    schemaVersion: 2,
    stats: { predefinedCount, customCount, unmappableCount },
  };
}

describe('Migration', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
  });

  afterEach(() => {
    cleanupChromeMock();
  });

  // --- Test cases ---

  it('Fresh install (no bindings) should skip migration', () => {
    const result = migrateBindings({ keyBindings: [] });
    expect(result.skipped).toBe('no-bindings');
  });

  it('Existing v1 storage with all defaults should migrate all 9 predefined bindings', () => {
    const v1Bindings = [
      { action: 'slower', key: 83, value: 0.1, force: false, predefined: true },
      { action: 'faster', key: 68, value: 0.1, force: false, predefined: true },
      { action: 'rewind', key: 90, value: 10, force: false, predefined: true },
      { action: 'advance', key: 88, value: 10, force: false, predefined: true },
      { action: 'reset', key: 82, value: 1.0, force: false, predefined: true },
      { action: 'fast', key: 71, value: 1.8, force: false, predefined: true },
      { action: 'display', key: 86, value: 0, force: false, predefined: true },
      { action: 'mark', key: 77, value: 0, force: false, predefined: true },
      { action: 'jump', key: 74, value: 0, force: false, predefined: true },
    ];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });

    expect(result.schemaVersion).toBe(2);
    expect(result.stats.predefinedCount).toBe(9);
    expect(result.stats.customCount).toBe(0);
    expect(result.stats.unmappableCount).toBe(0);

    // Verify each binding has v2 fields
    for (const b of result.keyBindings) {
      expect(b.code).toBeDefined();
      expect(b.keyCode).toBeDefined();
      expect(b.displayKey).toBeDefined();
      expect(b.key).toBeDefined();
    }

    // Spot check
    const slower = result.keyBindings.find((b) => b.action === 'slower');
    expect(slower.code).toBe('KeyS');
    expect(slower.keyCode).toBe(83);
    expect(slower.key).toBe(83);
    expect(slower.displayKey).toBe('s');
  });

  it('Custom bindings with standard keyCodes should map correctly', () => {
    const v1Bindings = [
      { action: 'pause', key: 32, value: 0, force: false, predefined: false }, // Space
      { action: 'faster', key: 112, value: 0.5, force: false, predefined: false }, // F1
      { action: 'muted', key: 186, value: 0, force: false, predefined: false }, // Semicolon
    ];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });

    expect(result.stats.customCount).toBe(3);

    const pause = result.keyBindings.find((b) => b.action === 'pause');
    expect(pause.code).toBe('Space');
    expect(pause.displayKey).toBe('Space');

    const faster = result.keyBindings.find((b) => b.action === 'faster');
    expect(faster.code).toBe('F1');

    const muted = result.keyBindings.find((b) => b.action === 'muted');
    expect(muted.code).toBe('Semicolon');
    expect(muted.displayKey).toBe(';');
  });

  it('Unmappable keyCodes (255, 0) should get code: null', () => {
    const v1Bindings = [
      { action: 'faster', key: 255, value: 0.1, force: false, predefined: false },
      { action: 'slower', key: 0, value: 0.1, force: false, predefined: false },
    ];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });

    expect(result.stats.unmappableCount).toBe(2);

    for (const b of result.keyBindings) {
      if (b.action === 'faster' || b.action === 'slower') {
        expect(b.code).toBe(null);
        expect(b.displayKey).toBe('');
      }
    }
  });

  it('Partially migrated storage should be idempotent', () => {
    const bindings = [
      // Already migrated
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
        predefined: true,
      },
      // Not yet migrated
      { action: 'faster', key: 68, value: 0.1, force: false, predefined: true },
    ];

    const result = migrateBindings({ keyBindings: bindings, schemaVersion: 1 });

    const slower = result.keyBindings.find((b) => b.action === 'slower');
    expect(slower.code).toBe('KeyS');
    expect(slower.displayKey).toBe('s');

    const faster = result.keyBindings.find((b) => b.action === 'faster');
    expect(faster.code).toBe('KeyD');
    expect(faster.keyCode).toBe(68);
  });

  it('schemaVersion 2 but bindings lack code fields should re-migrate', () => {
    const bindings = [{ action: 'slower', key: 83, value: 0.1, force: false, predefined: true }];

    // schemaVersion is 2 but bindings don't have code — downgrade recovery
    const result = migrateBindings({ keyBindings: bindings, schemaVersion: 2 });

    expect(result.skipped).toBe(undefined);
    expect(result.schemaVersion).toBe(2);
    const slower = result.keyBindings.find((b) => b.action === 'slower');
    expect(slower.code).toBe('KeyS');
  });

  it('schemaVersion 2 with all code fields should skip', () => {
    const bindings = [
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
        predefined: true,
      },
    ];

    const result = migrateBindings({ keyBindings: bindings, schemaVersion: 2 });
    expect(result.skipped).toBe('already-v2');
  });

  it('v2 storage read by v1 matching logic should still work via key field', () => {
    const v1Bindings = [{ action: 'slower', key: 83, value: 0.1, force: false, predefined: true }];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });
    const slower = result.keyBindings.find((b) => b.action === 'slower');

    // v1 code would do: binding.key === event.keyCode
    expect(slower.key).toBe(83);
    expect(slower.key === 83).toBe(true);
  });

  it('Missing predefined actions should be added by Phase 4', () => {
    // Only 7 of 9 predefined actions present (missing display, jump)
    const v1Bindings = [
      { action: 'slower', key: 83, value: 0.1, force: false, predefined: true },
      { action: 'faster', key: 68, value: 0.1, force: false, predefined: true },
      { action: 'rewind', key: 90, value: 10, force: false, predefined: true },
      { action: 'advance', key: 88, value: 10, force: false, predefined: true },
      { action: 'reset', key: 82, value: 1.0, force: false, predefined: true },
      { action: 'fast', key: 71, value: 1.8, force: false, predefined: true },
      { action: 'mark', key: 77, value: 0, force: false, predefined: true },
    ];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });

    const display = result.keyBindings.find((b) => b.action === 'display');
    expect(display).toBeDefined();
    expect(display.code).toBe('KeyV');
    expect(display.predefined).toBe(true);

    const jump = result.keyBindings.find((b) => b.action === 'jump');
    expect(jump).toBeDefined();
    expect(jump.code).toBe('KeyJ');
  });

  it('Migrated bindings should NOT have modifiers object', () => {
    const v1Bindings = [{ action: 'slower', key: 83, value: 0.1, force: false, predefined: true }];

    const result = migrateBindings({ keyBindings: v1Bindings, schemaVersion: 1 });
    const slower = result.keyBindings.find((b) => b.action === 'slower');
    expect(slower.modifiers).toBe(undefined);
  });

  it('displayKeyFromCode should produce correct labels', () => {
    expect(displayKeyFromCode('KeyA')).toBe('a');
    expect(displayKeyFromCode('KeyZ')).toBe('z');
    expect(displayKeyFromCode('Digit0')).toBe('0');
    expect(displayKeyFromCode('Digit9')).toBe('9');
    expect(displayKeyFromCode('F1')).toBe('F1');
    expect(displayKeyFromCode('F24')).toBe('F24');
    expect(displayKeyFromCode('Space')).toBe('Space');
    expect(displayKeyFromCode('Semicolon')).toBe(';');
    expect(displayKeyFromCode('BracketLeft')).toBe('[');
    expect(displayKeyFromCode('NumpadAdd')).toBe('Num +');
    expect(displayKeyFromCode(null)).toBe('');
    expect(displayKeyFromCode('')).toBe('');
  });
});
