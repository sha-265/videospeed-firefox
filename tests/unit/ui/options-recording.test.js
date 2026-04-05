/**
 * Tests for options page shortcut recording and saving (v2 schema).
 *
 * Tests recordKeyPress, createKeyBindings, and the BLACKLISTED_CODES check.
 * These functions are defined in options.js but we test their logic here
 * using extracted/replicated helpers.
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
describe('OptionsRecording', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
  });

  afterEach(() => {
    cleanupChromeMock();
  });

  // --- Replicate minimal recording logic from options.js for testing ---

  function recordKeyPress(e) {
    const BLACKLISTED_CODES = window.VSC.Constants.BLACKLISTED_CODES;

    if (e.code === 'Backspace') {
      e.target.value = '';
      e.target.code = null;
      e.target.keyCode = null;
      e.target.displayKey = null;
      e.target.modifiers = undefined;
      return 'backspace';
    } else if (e.code === 'Escape') {
      e.target.value = 'null';
      e.target.code = null;
      e.target.keyCode = null;
      e.target.displayKey = null;
      e.target.modifiers = undefined;
      return 'escape';
    }

    if (BLACKLISTED_CODES.has(e.code)) {
      return 'blocked';
    }

    e.target.code = e.code;
    e.target.keyCode = e.keyCode;
    e.target.displayKey = e.key;

    const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
    e.target.modifiers = hasMod
      ? {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        }
      : undefined;

    return 'accepted';
  }

  function createKeyBindings(input, action, value, force, predefined) {
    return {
      action,
      code: input.code,
      key: input.keyCode,
      keyCode: input.keyCode,
      displayKey: input.displayKey,
      value,
      force,
      predefined,
      ...(input.modifiers ? { modifiers: input.modifiers } : {}),
    };
  }

  function makeInput() {
    return {
      value: '',
      code: undefined,
      keyCode: undefined,
      displayKey: undefined,
      modifiers: undefined,
    };
  }

  function makeKeyEvent(code, key, keyCode, mods = {}) {
    return {
      code,
      key,
      keyCode,
      ctrlKey: mods.ctrl || false,
      altKey: mods.alt || false,
      shiftKey: mods.shift || false,
      metaKey: mods.meta || false,
      target: makeInput(),
    };
  }

  // --- Tests ---

  it('recordKeyPress captures code, key, keyCode on input element', () => {
    const e = makeKeyEvent('KeyS', 's', 83);
    const result = recordKeyPress(e);

    expect(result).toBe('accepted');
    expect(e.target.code).toBe('KeyS');
    expect(e.target.keyCode).toBe(83);
    expect(e.target.displayKey).toBe('s');
  });

  it('createKeyBindings emits v2 schema with legacy key field', () => {
    const input = { code: 'KeyD', keyCode: 68, displayKey: 'd', modifiers: undefined };
    const binding = createKeyBindings(input, 'faster', 0.1, false, true);

    expect(binding.code).toBe('KeyD');
    expect(binding.key).toBe(68);
    expect(binding.keyCode).toBe(68);
    expect(binding.displayKey).toBe('d');
    expect(binding.predefined).toBe(true);
    expect(binding.modifiers).toBe(undefined);
  });

  it('BLACKLISTED_CODES: Tab is blocked', () => {
    const e = makeKeyEvent('Tab', 'Tab', 9);
    const result = recordKeyPress(e);
    expect(result).toBe('blocked');
  });

  it('BLACKLISTED_CODES: ContextMenu is blocked (regression for keyCode 93)', () => {
    const e = makeKeyEvent('ContextMenu', 'ContextMenu', 93);
    const result = recordKeyPress(e);
    expect(result).toBe('blocked');
  });

  it('BLACKLISTED_CODES: ShiftLeft is blocked', () => {
    const e = makeKeyEvent('ShiftLeft', 'Shift', 16);
    const result = recordKeyPress(e);
    expect(result).toBe('blocked');
  });

  it('BLACKLISTED_CODES: CapsLock is blocked (new in v2)', () => {
    const e = makeKeyEvent('CapsLock', 'CapsLock', 20);
    const result = recordKeyPress(e);
    expect(result).toBe('blocked');
  });

  it('Backspace clears input via event.code', () => {
    const e = makeKeyEvent('Backspace', 'Backspace', 8);
    e.target.code = 'KeyS';
    e.target.keyCode = 83;
    e.target.displayKey = 's';

    const result = recordKeyPress(e);

    expect(result).toBe('backspace');
    expect(e.target.value).toBe('');
    expect(e.target.code).toBe(null);
    expect(e.target.keyCode).toBe(null);
  });

  it('Escape sets null via event.code', () => {
    const e = makeKeyEvent('Escape', 'Escape', 27);
    const result = recordKeyPress(e);

    expect(result).toBe('escape');
    expect(e.target.value).toBe('null');
    expect(e.target.code).toBe(null);
    expect(e.target.keyCode).toBe(null);
  });

  it('Modifier recording: Ctrl+S captures modifiers object', () => {
    const e = makeKeyEvent('KeyS', 's', 83, { ctrl: true });
    const result = recordKeyPress(e);

    expect(result).toBe('accepted');
    expect(e.target.modifiers).toBeDefined();
    expect(e.target.modifiers.ctrl).toBe(true);
    expect(e.target.modifiers.alt).toBe(false);
    expect(e.target.modifiers.shift).toBe(false);
    expect(e.target.modifiers.meta).toBe(false);
  });

  it('Modifiers omitted when all false', () => {
    const e = makeKeyEvent('KeyS', 's', 83);
    const result = recordKeyPress(e);

    expect(result).toBe('accepted');
    expect(e.target.modifiers).toBe(undefined);
  });

  it('createKeyBindings includes modifiers when present', () => {
    const input = {
      code: 'KeyS',
      keyCode: 83,
      displayKey: 's',
      modifiers: { ctrl: true, alt: false, shift: false, meta: false },
    };
    const binding = createKeyBindings(input, 'save-chord', 0, false, false);

    expect(binding.modifiers).toBeDefined();
    expect(binding.modifiers.ctrl).toBe(true);
  });

  it('createKeyBindings omits modifiers when undefined', () => {
    const input = { code: 'KeyS', keyCode: 83, displayKey: 's', modifiers: undefined };
    const binding = createKeyBindings(input, 'slower', 0.1, false, true);

    expect(binding.modifiers).toBe(undefined);
    // Verify modifiers is not even in the object
    expect('modifiers' in binding).toBe(false);
  });
});
