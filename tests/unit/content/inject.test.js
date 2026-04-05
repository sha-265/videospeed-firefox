/**
 * Unit tests for VideoSpeedExtension (inject.js)
 * Testing the fix for video elements without parentElement
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { createMockVideo, createMockDOM } from '../../helpers/test-utils.js';

// Load all required modules

let mockDOM;
let extension;

describe('Inject', () => {
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
    if (extension) {
      extension = null;
    }

    // Clean up any remaining video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video.vsc) {
        try {
          video.vsc.remove();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (video.parentNode) {
        try {
          video.parentNode.removeChild(video);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  /**
   * Create a video element without parentElement but with parentNode
   * This simulates shadow DOM scenarios where parentElement is undefined
   */
  function createVideoWithoutParentElement() {
    const video = createMockVideo({ readyState: 4 });
    const parentNode = document.createElement('div');

    // Simulate shadow DOM scenario where parentElement is undefined
    Object.defineProperty(video, 'parentElement', {
      value: null,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'parentNode', {
      value: parentNode,
      writable: false,
      configurable: true,
    });

    // Mock isConnected property for validity check
    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    return { video, parentNode };
  }

  it('onVideoFound should handle video elements without parentElement', async () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    const { video, parentNode } = createVideoWithoutParentElement();

    extension.onVideoFound(video, parentNode);

    expect(video.vsc).toBeDefined();
    expect(video.vsc instanceof window.VSC.VideoController).toBe(true);
    expect(video.vsc.parent).toBe(parentNode);
  });

  it('onVideoFound should prefer parentElement when available', async () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    const video = createMockVideo({ readyState: 4 });
    const parentElement = document.createElement('div');
    const parentNode = document.createElement('span');

    Object.defineProperty(video, 'parentElement', {
      value: parentElement,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'parentNode', {
      value: parentNode,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    extension.onVideoFound(video, parentNode);

    expect(video.vsc).toBeDefined();
    // VideoController constructor uses target.parentElement || parent
    expect(video.vsc.parent).toBe(parentElement);
  });

  it('onVideoFound defers controller when readyState < 2 and video has src', () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    // readyState=1 with a src → should defer, not attach immediately
    const video = createMockVideo({ readyState: 1 });
    const parent = document.createElement('div');

    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    extension.onVideoFound(video, parent);

    // Controller should NOT be attached yet — waiting for loadeddata
    expect(video.vsc).toBeUndefined();
  });

  it('onVideoFound attaches immediately when readyState >= 2', () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    const video = createMockVideo({ readyState: 4 });
    const parent = document.createElement('div');

    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    extension.onVideoFound(video, parent);

    // Controller should be attached immediately
    expect(video.vsc).toBeDefined();
    expect(video.vsc instanceof window.VSC.VideoController).toBe(true);
  });

  it('onVideoFound attaches immediately when video has no src (no-source placeholder)', () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    // readyState=0, no src → should attach immediately (no loadeddata to wait for)
    const video = createMockVideo({ readyState: 0, currentSrc: '' });
    const parent = document.createElement('div');

    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    extension.onVideoFound(video, parent);

    expect(video.vsc).toBeDefined();
  });

  it('onVideoFound should handle video with neither parentElement nor parentNode', async () => {
    extension = window.VSC_controller;
    expect(extension).toBeDefined();

    const video = createMockVideo({ readyState: 4 });
    const fallbackParent = document.createElement('div');

    Object.defineProperty(video, 'parentElement', {
      value: null,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'parentNode', {
      value: null,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(video, 'isConnected', {
      value: true,
      writable: false,
      configurable: true,
    });

    // Should not throw even with no parent references
    extension.onVideoFound(video, fallbackParent);

    expect(video.vsc).toBeDefined();
    expect(video.vsc.parent).toBe(fallbackParent);
  });
});
