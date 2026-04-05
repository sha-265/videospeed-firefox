/**
 * Unit tests for recursive shadow DOM media element detection
 * Tests the findShadowMedia functionality in dom-utils.js and MediaElementObserver
 */

import {
  installChromeMock,
  cleanupChromeMock,
  resetMockStorage,
} from '../../helpers/chrome-mock.js';
import { createMockVideo, createMockDOM } from '../../helpers/test-utils.js';
let mockDOM;

function createNestedShadowDOM(depth, includeVideo = true) {
  const host = document.createElement('div');
  host.className = 'shadow-host-root';

  let currentHost = host;
  let currentShadow = null;

  for (let i = 0; i < depth; i++) {
    currentShadow = currentHost.attachShadow({ mode: 'open' });

    if (i < depth - 1) {
      const nextHost = document.createElement('div');
      nextHost.className = `shadow-host-level-${i + 1}`;
      currentShadow.appendChild(nextHost);
      currentHost = nextHost;
    }
  }

  let video = null;
  if (includeVideo && currentShadow) {
    video = createMockVideo();
    video.className = 'nested-shadow-video';
    currentShadow.appendChild(video);
  }

  return { host, deepestShadow: currentShadow, video };
}

function createComplexPlayerStructure() {
  const player = document.createElement('custom-player');
  const playerShadow = player.attachShadow({ mode: 'open' });

  const playback = document.createElement('video-playback');
  const playbackShadow = playback.attachShadow({ mode: 'open' });
  playerShadow.appendChild(playback);

  const video = createMockVideo();
  playbackShadow.appendChild(video);

  return { player, video };
}

describe('Recursive Shadow DOM', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    mockDOM = createMockDOM();

    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  afterEach(() => {
    cleanupChromeMock();
    if (mockDOM) {
      mockDOM.cleanup();
    }

    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('DomUtils.findShadowMedia should recursively find media in single shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = createMockVideo();
    shadow.appendChild(video);

    const results = window.VSC.DomUtils.findShadowMedia(shadow, 'video');

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('DomUtils.findShadowMedia should recursively find media in nested shadow roots', () => {
    const { host, video } = createNestedShadowDOM(3);

    const results = window.VSC.DomUtils.findShadowMedia(host, 'video');

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
    expect(results[0].className).toBe('nested-shadow-video');
  });

  it('DomUtils.findShadowMedia should find multiple videos across different shadow roots', () => {
    const container = document.createElement('div');

    const { host: host1, video: video1 } = createNestedShadowDOM(2);
    video1.id = 'video-1';

    const { host: host2, video: video2 } = createNestedShadowDOM(3);
    video2.id = 'video-2';

    const regularVideo = createMockVideo();
    regularVideo.id = 'regular-video';

    container.appendChild(host1);
    container.appendChild(host2);
    container.appendChild(regularVideo);

    const results = window.VSC.DomUtils.findShadowMedia(container, 'video');

    expect(results.length).toBe(3);

    const videoIds = results.map((v) => v.id).sort();
    expect(videoIds).toEqual(['regular-video', 'video-1', 'video-2']);
  });

  it('DomUtils.findShadowMedia should handle deeply nested shadow roots (5 levels)', () => {
    const { host, video } = createNestedShadowDOM(5);

    const results = window.VSC.DomUtils.findShadowMedia(host, 'video');

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('DomUtils.findShadowMedia should work with audio elements when enabled', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    const video = createMockVideo();
    const audio = document.createElement('audio');
    audio.className = 'test-audio';

    shadow.appendChild(video);
    shadow.appendChild(audio);

    const videoResults = window.VSC.DomUtils.findShadowMedia(shadow, 'video');
    const audioVideoResults = window.VSC.DomUtils.findShadowMedia(shadow, 'video,audio');

    expect(videoResults.length).toBe(1);
    expect(audioVideoResults.length).toBe(2);
    expect(audioVideoResults[1].className).toBe('test-audio');
  });

  it('DomUtils.findMediaElements should use recursive shadow search', () => {
    const { host, video } = createNestedShadowDOM(3);

    const results = window.VSC.DomUtils.findMediaElements(host, false);

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('MediaElementObserver should find media in nested shadow roots', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const siteHandler = new window.VSC.BaseSiteHandler();
    const observer = new window.VSC.MediaElementObserver(config, siteHandler);

    const testContainer = document.createElement('div');
    const { host, video } = createNestedShadowDOM(3);
    testContainer.appendChild(host);
    document.body.appendChild(testContainer);

    const results = observer.scanForMedia(testContainer);

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('Should handle complex nested player structure', () => {
    const { player, video } = createComplexPlayerStructure();

    const results = window.VSC.DomUtils.findShadowMedia(player, 'video');

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('Should handle complex player structure with MediaElementObserver', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const siteHandler = new window.VSC.BaseSiteHandler();
    const observer = new window.VSC.MediaElementObserver(config, siteHandler);

    const testContainer = document.createElement('div');
    const { player, video } = createComplexPlayerStructure();
    testContainer.appendChild(player);
    document.body.appendChild(testContainer);

    const results = observer.scanForMedia(testContainer);

    expect(results.length).toBe(1);
    expect(results[0]).toBe(video);
  });

  it('Should handle empty shadow roots gracefully', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' });

    const results = window.VSC.DomUtils.findShadowMedia(host.shadowRoot, 'video');

    expect(results.length).toBe(0);
  });

  it('Should handle shadow roots with no video elements', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    const div = document.createElement('div');
    const span = document.createElement('span');
    shadow.appendChild(div);
    shadow.appendChild(span);

    const results = window.VSC.DomUtils.findShadowMedia(shadow, 'video');

    expect(results.length).toBe(0);
  });

  it('Should handle mixed regular and shadow DOM content', () => {
    const container = document.createElement('div');

    const regularVideo = createMockVideo();
    regularVideo.id = 'regular';
    container.appendChild(regularVideo);

    const { host, video: shadowVideo } = createNestedShadowDOM(2);
    shadowVideo.id = 'shadow';
    container.appendChild(host);

    const results = window.VSC.DomUtils.findShadowMedia(container, 'video');

    expect(results.length).toBe(2);
    const ids = results.map((v) => v.id).sort();
    expect(ids).toEqual(['regular', 'shadow']);
  });

  it('Should handle complex nested structure with multiple videos per level', () => {
    const host = document.createElement('div');
    const level1Shadow = host.attachShadow({ mode: 'open' });

    const video1 = createMockVideo();
    video1.id = 'level-1';
    level1Shadow.appendChild(video1);

    const level2Host = document.createElement('div');
    level1Shadow.appendChild(level2Host);
    const level2Shadow = level2Host.attachShadow({ mode: 'open' });

    const video2a = createMockVideo();
    video2a.id = 'level-2a';
    const video2b = createMockVideo();
    video2b.id = 'level-2b';
    level2Shadow.appendChild(video2a);
    level2Shadow.appendChild(video2b);

    const results = window.VSC.DomUtils.findShadowMedia(host, 'video');

    expect(results.length).toBe(3);
    const ids = results.map((v) => v.id).sort();
    expect(ids).toEqual(['level-1', 'level-2a', 'level-2b']);
  });

  it('Performance test - should handle many nested shadow roots efficiently', () => {
    const container = document.createElement('div');
    const startTime = performance.now();

    for (let i = 0; i < 10; i++) {
      const { host } = createNestedShadowDOM(4);
      container.appendChild(host);
    }

    const results = window.VSC.DomUtils.findShadowMedia(container, 'video');

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(results.length).toBe(10);
    expect(duration).toBeLessThan(100);
  });
});
