/**
 * Integration tests for VSCStateManager
 * Tests the complete flow: Controller creation → State tracking → Cleanup
 */

import { installChromeMock, cleanupChromeMock, resetMockStorage } from '../helpers/chrome-mock.js';
import { createMockVideo } from '../helpers/test-utils.js';
describe('StateManagerIntegration', () => {
  beforeEach(() => {
    installChromeMock();
    resetMockStorage();
    window.VSC.stateManager.controllers.clear();
  });

  afterEach(() => {
    window.VSC.stateManager.controllers.clear();
    document.querySelectorAll('video, audio').forEach((el) => el.remove());
    cleanupChromeMock();
  });

  it('StateManager registers and tracks controllers correctly', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);

    const parent1 = document.createElement('div');
    const parent2 = document.createElement('div');
    document.body.appendChild(parent1);
    document.body.appendChild(parent2);

    const mockVideo1 = createMockVideo();
    const mockVideo2 = createMockVideo();
    parent1.appendChild(mockVideo1);
    parent2.appendChild(mockVideo2);

    // Creating first controller should register with state manager
    const controller1 = new window.VSC.VideoController(mockVideo1, parent1, config, actionHandler);
    expect(window.VSC.stateManager.controllers.size).toBe(1);

    // Creating second controller
    const controller2 = new window.VSC.VideoController(mockVideo2, parent2, config, actionHandler);
    expect(window.VSC.stateManager.controllers.size).toBe(2);

    // Removing first controller should unregister
    controller1.remove();
    expect(window.VSC.stateManager.controllers.size).toBe(1);

    // Removing last controller
    controller2.remove();
    expect(window.VSC.stateManager.controllers.size).toBe(0);
  });

  it('StateManager getAllMediaElements includes all tracked videos', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);

    const parent1 = document.createElement('div');
    const parent2 = document.createElement('div');
    document.body.appendChild(parent1);
    document.body.appendChild(parent2);

    const mockVideo1 = createMockVideo();
    const mockVideo2 = createMockVideo();
    parent1.appendChild(mockVideo1);
    parent2.appendChild(mockVideo2);

    const controller1 = new window.VSC.VideoController(mockVideo1, parent1, config, actionHandler);
    const controller2 = new window.VSC.VideoController(mockVideo2, parent2, config, actionHandler);

    const allMedia = window.VSC.stateManager.getAllMediaElements();
    expect(allMedia.length).toBe(2);
    expect(allMedia.includes(mockVideo1)).toBe(true);
    expect(allMedia.includes(mockVideo2)).toBe(true);

    const controlledMedia = window.VSC.stateManager.getControlledElements();
    expect(controlledMedia.length).toBe(2);
    expect(controlledMedia.every((v) => v.vsc)).toBe(true);

    controller1.remove();
    controller2.remove();
  });

  it('StateManager handles disconnected elements gracefully', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const mockVideo = createMockVideo();
    parent.appendChild(mockVideo);

    new window.VSC.VideoController(mockVideo, parent, config, actionHandler);
    expect(window.VSC.stateManager.controllers.size).toBe(1);

    // Remove the parent div (which contains the video) from DOM
    // This simulates a site removing a video player
    parent.remove();

    // getAllMediaElements should detect disconnected elements and clean up
    const allMedia = window.VSC.stateManager.getAllMediaElements();
    expect(allMedia.length).toBe(0);
    expect(window.VSC.stateManager.controllers.size).toBe(0);
  });

  it('StateManager tracks multiple rapid controller registrations', async () => {
    const config = window.VSC.videoSpeedConfig;
    await config.load();

    const actionHandler = new window.VSC.ActionHandler(config);

    const videos = [];
    for (let i = 0; i < 5; i++) {
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      const video = createMockVideo();
      parent.appendChild(video);
      videos.push(video);
      new window.VSC.VideoController(video, parent, config, actionHandler);
    }

    // All 5 should be registered
    expect(window.VSC.stateManager.controllers.size).toBe(5);
    expect(window.VSC.stateManager.getAllMediaElements().length).toBe(5);

    // Clean up
    videos.forEach((video) => {
      video.vsc?.remove();
    });

    expect(window.VSC.stateManager.controllers.size).toBe(0);
  });
});
