/**
 * Tests for icon integration (controller lifecycle events)
 */

import { installChromeMock, cleanupChromeMock } from '../../helpers/chrome-mock.js';

// Load all required modules

describe('IconIntegration', () => {
  beforeEach(() => {
    installChromeMock();
    // Clear state manager before each test to ensure isolation
    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.controllers.clear();
    }
  });

  afterEach(() => {
    cleanupChromeMock();
    // Clear state manager after each test to prevent state leakage
    if (window.VSC && window.VSC.stateManager) {
      window.VSC.stateManager.controllers.clear();
    }
    // Remove any lingering video elements
    document.querySelectorAll('video, audio').forEach((el) => el.remove());
  });

  function createMockVideo(options = {}) {
    const video = document.createElement('video');

    Object.defineProperties(video, {
      readyState: {
        value: options.readyState || 2, // HAVE_CURRENT_DATA
        writable: true,
        configurable: true,
      },
      currentSrc: {
        value: options.currentSrc || 'https://example.com/video.mp4',
        writable: true,
        configurable: true,
      },
      ownerDocument: {
        value: document,
        writable: true,
        configurable: true,
      },
      getBoundingClientRect: {
        value: () => ({
          width: options.width || 640,
          height: options.height || 360,
          top: 0,
          left: 0,
          right: options.width || 640,
          bottom: options.height || 360,
        }),
        writable: true,
        configurable: true,
      },
    });

    return video;
  }

  it('VideoController should register with state manager', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockVideo = createMockVideo();
    document.body.appendChild(mockVideo);

    // Create controller - should register with state manager
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);

    // Verify controller is registered with state manager
    expect(window.VSC.stateManager.controllers.size).toBe(1);
    expect(window.VSC.stateManager.controllers.has(controller.controllerId)).toBe(true);

    // Verify controller has ID
    expect(controller.controllerId).toBeDefined();

    // Verify state manager has correct info
    const controllerInfo = window.VSC.stateManager.controllers.get(controller.controllerId);
    expect(controllerInfo).toBeDefined();
    expect(controllerInfo.element).toBe(mockVideo);
    expect(controllerInfo.tagName).toBe('VIDEO');

    // Cleanup
    controller.remove();
    document.body.removeChild(mockVideo);
  });

  it('VideoController should unregister from state manager on removal', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockVideo = createMockVideo();
    document.body.appendChild(mockVideo);

    // Create controller
    const controller = new window.VSC.VideoController(mockVideo, null, config, actionHandler);
    const controllerId = controller.controllerId;

    expect(window.VSC.stateManager.controllers.size).toBe(1);

    // Remove controller - should unregister from state manager
    controller.remove();

    // Verify controller was unregistered from state manager
    expect(window.VSC.stateManager.controllers.size).toBe(0);
    expect(window.VSC.stateManager.controllers.has(controllerId)).toBe(false);

    // Verify controller is properly cleaned up
    expect(mockVideo.vsc).toBe(undefined);

    // Cleanup
    document.body.removeChild(mockVideo);
  });

  it('Controllers should have unique IDs', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);

    // Create multiple videos
    const video1 = createMockVideo({ currentSrc: 'https://example.com/video1.mp4' });
    const video2 = createMockVideo({ currentSrc: 'https://example.com/video2.mp4' });

    document.body.appendChild(video1);
    document.body.appendChild(video2);

    // Create controllers
    const controller1 = new window.VSC.VideoController(video1, null, config, actionHandler);
    const controller2 = new window.VSC.VideoController(video2, null, config, actionHandler);

    // Verify IDs are unique
    expect(controller1.controllerId).toBeDefined();
    expect(controller2.controllerId).toBeDefined();
    expect(controller1.controllerId !== controller2.controllerId).toBe(true);

    // Cleanup
    controller1.remove();
    controller2.remove();
    document.body.removeChild(video1);
    document.body.removeChild(video2);
  });

  it('Audio controllers should register with state manager too', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();
    config.settings.audioBoolean = true; // Enable audio support

    const actionHandler = new window.VSC.ActionHandler(config);
    const mockAudio = document.createElement('audio');

    Object.defineProperties(mockAudio, {
      readyState: { value: 2, writable: true, configurable: true },
      currentSrc: { value: 'https://example.com/audio.mp3', writable: true, configurable: true },
      ownerDocument: { value: document, writable: true, configurable: true },
      getBoundingClientRect: {
        value: () => ({ width: 15, height: 15, top: 0, left: 0, right: 15, bottom: 15 }),
        writable: true,
        configurable: true,
      },
    });

    document.body.appendChild(mockAudio);

    // Create audio controller - should register with state manager even if small
    const controller = new window.VSC.VideoController(mockAudio, null, config, actionHandler);

    // Verify controller is registered with state manager
    expect(window.VSC.stateManager.controllers.size).toBe(1);
    expect(controller.controllerId).toBeDefined();

    // Verify state manager has correct info for audio
    const controllerInfo = window.VSC.stateManager.controllers.get(controller.controllerId);
    expect(controllerInfo.tagName).toBe('AUDIO');

    // Cleanup
    controller.remove();
    document.body.removeChild(mockAudio);
  });
});
