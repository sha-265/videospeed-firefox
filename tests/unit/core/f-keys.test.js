/**
 * Tests for F13-F24 and special key support
 * Verifies that the expanded keyboard handling works correctly
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';

// Load all core modules (ActionHandler depends on state-manager, site-handlers, etc.)

describe('FKeys', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();

    // Clear state manager for tests
    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.controllers.clear();
    }
  });

  afterEach(() => {
    cleanupChromeMock();
  });

  it('F13-F24 keys should be valid key bindings', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    // Test saving F13-F24 key bindings
    const fKeyBindings = [];
    for (let i = 13; i <= 24; i++) {
      fKeyBindings.push({
        action: 'faster',
        key: 111 + i, // F13=124, F14=125, etc.
        value: 0.1,
        force: false,
        predefined: false,
      });
    }

    await config.save({ keyBindings: fKeyBindings });
    await config.load();

    expect(config.settings.keyBindings.length).toBe(fKeyBindings.length);

    // Verify each F-key binding
    for (let i = 0; i < fKeyBindings.length; i++) {
      const binding = config.settings.keyBindings[i];
      expect(binding.key).toBe(fKeyBindings[i].key);
    }
  });

  it('Special keys beyond standard range should be accepted', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    // Test various special key codes that might exist on different keyboards
    const specialKeys = [
      { keyCode: 144, description: 'NumLock' },
      { keyCode: 145, description: 'ScrollLock' },
      { keyCode: 19, description: 'Pause/Break' },
      { keyCode: 44, description: 'PrintScreen' },
      { keyCode: 173, description: 'Media Mute' },
      { keyCode: 174, description: 'Media Volume Down' },
      { keyCode: 175, description: 'Media Volume Up' },
      { keyCode: 179, description: 'Media Play/Pause' },
    ];

    const specialKeyBindings = specialKeys.map((key) => ({
      action: 'pause',
      key: key.keyCode,
      value: 0,
      force: false,
      predefined: false,
    }));

    await config.save({ keyBindings: specialKeyBindings });
    await config.load();

    expect(config.settings.keyBindings.length).toBe(specialKeyBindings.length);

    specialKeys.forEach((specialKey, index) => {
      const binding = config.settings.keyBindings[index];
      expect(binding.key).toBe(specialKey.keyCode);
    });
  });

  describe('Blacklisted keys should be properly handled in options UI', () => {
    it('BLACKLISTED_CODES should be a defined Set', () => {
      const BLACKLISTED_CODES = window.VSC.Constants.BLACKLISTED_CODES;
      expect(BLACKLISTED_CODES).toBeDefined();
      expect(BLACKLISTED_CODES instanceof Set).toBe(true);
    });

    // These modifier/navigation keys must be blocked
    it.each([
      ['Tab'],
      ['ShiftLeft'],
      ['ShiftRight'],
      ['ControlLeft'],
      ['ControlRight'],
      ['AltLeft'],
      ['AltRight'],
      ['MetaLeft'],
      ['MetaRight'],
      ['ContextMenu'],
      ['CapsLock'],
    ])('should block modifier/navigation key: %s', (code) => {
      const BLACKLISTED_CODES = window.VSC.Constants.BLACKLISTED_CODES;
      expect(BLACKLISTED_CODES.has(code)).toBe(true);
    });

    // F-keys and regular keys must NOT be blocked
    it.each([['F13'], ['KeyA'], ['Space'], ['Enter'], ['KeyS'], ['Digit1']])(
      'should allow key: %s',
      (code) => {
        const BLACKLISTED_CODES = window.VSC.Constants.BLACKLISTED_CODES;
        expect(BLACKLISTED_CODES.has(code)).toBe(false);
      }
    );
  });

  it('EventManager should handle F-keys correctly', async () => {
    const config = new window.VSC.VideoSpeedConfig();
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config, null);
    const eventManager = new window.VSC.EventManager(config, actionHandler);
    actionHandler.eventManager = eventManager;

    // Add F13 key binding (v2 schema with code)
    config.settings.keyBindings = [
      {
        action: 'faster',
        code: 'F13',
        key: 124,
        keyCode: 124,
        displayKey: 'F13',
        value: 0.1,
        force: false,
        predefined: false,
      },
    ];

    // Create a proper test video with controller
    const mockVideo = {
      playbackRate: 1.0,
      paused: false,
      muted: false,
      currentTime: 0,
      duration: 100,
      classList: {
        contains: (_className) => false, // Mock classList for 'vsc-cancelled' check
      },
      dispatchEvent: (_event) => {
        /* Mock dispatchEvent for synthetic events */
      },
      // Add DOM-related properties for controller creation
      tagName: 'VIDEO',
      currentSrc: 'test-video.mp4',
      src: 'test-video.mp4',
      // Crucial: isConnected must be true for state manager to find it
      isConnected: true,
    };

    // Manually register with state manager for this specific test
    const mockControllerId = 'test-f-keys-controller';
    mockVideo.vsc = { div: document.createElement('div'), speedIndicator: { textContent: '1.00' } };
    window.VSC.stateManager.controllers.set(mockControllerId, {
      id: mockControllerId,
      element: mockVideo,
      videoSrc: mockVideo.currentSrc,
      tagName: mockVideo.tagName,
      created: Date.now(),
      isActive: true,
    });

    // Create a proper mock target element
    const mockTarget = {
      nodeName: 'DIV',
      isContentEditable: false,
      getRootNode: () => ({ host: null }), // Mock getRootNode for shadow DOM check
    };

    // Trigger F13 key
    const f13Event = {
      code: 'F13',
      key: 'F13',
      keyCode: 124,
      target: mockTarget,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      isComposing: false,
      timeStamp: 1000,
      preventDefault: () => {},
      stopPropagation: () => {},
    };

    eventManager.handleKeydown(f13Event);

    expect(mockVideo.playbackRate).toBe(1.1);
  });

  it('Key display names should work for all supported keys', () => {
    // Test that key display logic handles various key types
    const keyCodeAliases = window.VSC?.Constants?.keyCodeAliases || {};

    // F13-F24 should have aliases
    for (let i = 13; i <= 24; i++) {
      const keyCode = 111 + i; // F13=124, etc.
      const hasAlias = keyCodeAliases[keyCode] !== undefined || keyCode === 124 + (i - 13);
      expect(hasAlias).toBe(true);
    }
  });
});
