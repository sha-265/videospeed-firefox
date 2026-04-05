/**
 * Tests for event.code-based keyboard matching algorithm in EventManager.
 * Covers: chord match, simple match, legacy fallback, IME guard, dedup, precedence.
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { createMockVideo, createMockDOM } from '../../helpers/test-utils.js';
let mockDOM;

function setupEnv(keyBindings) {
  const config = window.VSC.videoSpeedConfig;
  config._loaded = true;
  config.settings.keyBindings = keyBindings;

  const actions = [];
  const actionHandler = {
    runAction: (action, value, _event) => actions.push({ action, value }),
  };

  const eventManager = new window.VSC.EventManager(config, actionHandler);

  const video = createMockVideo({ playbackRate: 1.0 });
  if (!video.parentElement) {
    mockDOM.container.appendChild(video);
  }
  video.vsc = { div: document.createElement('div'), speedIndicator: { textContent: '1.00' } };
  window.VSC.stateManager.controllers.set('test-video', {
    id: 'test-video',
    element: video,
    videoSrc: 'test',
    tagName: 'VIDEO',
    created: Date.now(),
    isActive: true,
  });

  return { config, eventManager, actions, video };
}

function makeEvent(overrides = {}) {
  return {
    code: overrides.code || '',
    key: overrides.key || '',
    keyCode: overrides.keyCode || 0,
    ctrlKey: overrides.ctrlKey || false,
    altKey: overrides.altKey || false,
    shiftKey: overrides.shiftKey || false,
    metaKey: overrides.metaKey || false,
    isComposing: overrides.isComposing || false,
    timeStamp: overrides.timeStamp || Date.now(),
    type: overrides.type || 'keydown',
    target: overrides.target || document.body,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
}

describe('EventManager Matching', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    mockDOM = createMockDOM();
    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.controllers.clear();
    }
  });

  afterEach(() => {
    cleanupChromeMock();
    if (mockDOM) {
      mockDOM.cleanup();
    }
  });

  // Chord matching

  it('Chord: Ctrl+KeyS matches chord binding, not simple binding', () => {
    const { eventManager, actions } = setupEnv([
      { action: 'slower', code: 'KeyS', key: 83, keyCode: 83, value: 0.1, force: false },
      {
        action: 'save-chord',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        value: 0,
        force: false,
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        ctrlKey: true,
        timeStamp: 100,
      })
    );

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('save-chord');
  });

  // Simple matching

  it('Simple: KeyS matches simple binding when no modifiers active', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        timeStamp: 200,
      })
    );

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('slower');
  });

  it('Simple: Shift+KeyS still matches simple KeyS binding (backward compat)', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 'S',
        keyCode: 83,
        shiftKey: true,
        timeStamp: 300,
      })
    );

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('slower');
  });

  it('Simple: Ctrl+KeyS does NOT match simple binding', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        ctrlKey: true,
        timeStamp: 400,
      })
    );

    expect(actions.length).toBe(0);
  });

  // Legacy fallback

  it('Legacy: binding with code:null matches on keyCode', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'custom',
        code: null,
        key: 255,
        keyCode: 255,
        displayKey: '',
        value: 0.1,
        force: false,
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'Unidentified',
        key: '',
        keyCode: 255,
        timeStamp: 500,
      })
    );

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('custom');
  });

  it('Legacy: Ctrl+keyCode does NOT match legacy binding (modifier gating)', () => {
    const { eventManager, actions } = setupEnv([
      { action: 'slower', code: null, key: 83, keyCode: 83, value: 0.1, force: false },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: '',
        key: 's',
        keyCode: 83,
        ctrlKey: true,
        timeStamp: 600,
      })
    );

    expect(actions.length).toBe(0);
  });

  // Empty event.code runtime fallback

  it('Empty event.code: falls back to keyCode matching for all bindings', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: '',
        key: 's',
        keyCode: 83,
        timeStamp: 700,
      })
    );

    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('slower');
  });

  // IME guards

  it('IME: isComposing=true should block all matching', () => {
    const { eventManager, actions } = setupEnv([
      { action: 'slower', code: 'KeyS', key: 83, keyCode: 83, value: 0.1, force: false },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        isComposing: true,
        timeStamp: 800,
      })
    );

    expect(actions.length).toBe(0);
  });

  it('IME: keyCode 229 should block all matching', () => {
    const { eventManager, actions } = setupEnv([
      { action: 'slower', code: 'KeyS', key: 83, keyCode: 83, value: 0.1, force: false },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: '',
        key: '',
        keyCode: 229,
        timeStamp: 900,
      })
    );

    expect(actions.length).toBe(0);
  });

  it('IME: key="Process" should block all matching', () => {
    const { eventManager, actions } = setupEnv([
      { action: 'slower', code: 'KeyS', key: 83, keyCode: 83, value: 0.1, force: false },
    ]);

    eventManager.handleKeydown(
      makeEvent({
        code: '',
        key: 'Process',
        keyCode: 0,
        timeStamp: 1000,
      })
    );

    expect(actions.length).toBe(0);
  });

  // Event deduplication

  it('Event dedup: same code+key+timeStamp+type should be deduplicated', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
    ]);

    const event = makeEvent({ code: 'KeyS', key: 's', keyCode: 83, timeStamp: 1100 });
    eventManager.handleKeydown(event);
    eventManager.handleKeydown(event);

    expect(actions.length).toBe(1);
  });

  // Numpad key matching

  it('Numpad: NumpadEnter binding fires correctly on NumpadEnter press', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'reset',
        code: 'NumpadEnter',
        key: 13,
        keyCode: 13,
        displayKey: 'Num Enter',
        value: 1.0,
        force: false,
      },
    ]);
    eventManager.handleKeydown(
      makeEvent({ code: 'NumpadEnter', key: 'Enter', keyCode: 13, timeStamp: 1400 })
    );
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('reset');
  });

  it('Numpad: Enter binding (code:"Enter") does NOT fire on NumpadEnter — keys are distinct, no coalesce', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'reset',
        code: 'Enter',
        key: 13,
        keyCode: 13,
        displayKey: 'Enter',
        value: 1.0,
        force: false,
      },
    ]);
    eventManager.handleKeydown(
      makeEvent({ code: 'NumpadEnter', key: 'Enter', keyCode: 13, timeStamp: 1500 })
    );
    expect(actions.length).toBe(0);
  });

  it('displayKeyFromCode: NumpadEnter → "Num Enter" (distinct from regular Enter)', () => {
    expect(window.VSC.Constants.displayKeyFromCode('NumpadEnter')).toBe('Num Enter');
    expect(window.VSC.Constants.displayKeyFromCode('Enter')).toBe('Enter');
  });

  // Chord precedence

  it('Chord precedence: Ctrl+S chord fires instead of plain S binding', () => {
    const { eventManager, actions } = setupEnv([
      {
        action: 'slower',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        displayKey: 's',
        value: 0.1,
        force: false,
      },
      {
        action: 'ctrl-s-action',
        code: 'KeyS',
        key: 83,
        keyCode: 83,
        value: 0,
        force: true,
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
      },
    ]);

    // Plain S → slower
    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        timeStamp: 1200,
      })
    );
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('slower');

    // Ctrl+S → chord action
    eventManager.handleKeydown(
      makeEvent({
        code: 'KeyS',
        key: 's',
        keyCode: 83,
        ctrlKey: true,
        timeStamp: 1300,
      })
    );
    expect(actions.length).toBe(2);
    expect(actions[1].action).toBe('ctrl-s-action');
  });
});
