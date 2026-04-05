/**
 * Settings management for Video Speed Controller
 */

window.VSC = window.VSC || {};

if (!window.VSC.VideoSpeedConfig) {
  class VideoSpeedConfig {
    constructor() {
      this.settings = { ...window.VSC.Constants.DEFAULT_SETTINGS };
      this.pendingSave = null;
      this.saveTimer = null;
      this.SAVE_DELAY = 1000; // 1 second
      this._loaded = false;
      // Tracks the last speed value we wrote to storage, so the onChanged
      // listener can distinguish our own echo from a genuine external write.
      this._lastWrittenSpeed = null;

      // Keep in-memory settings fresh when other contexts write to storage.
      // This prevents the stale-read problem where e.g. the options page holds
      // an old lastSpeed while the content script has already updated it.
      this._setupStorageListener();
    }

    /**
     * Listen for storage changes from other contexts and update in-memory state.
     * @private
     */
    _setupStorageListener() {
      try {
        window.VSC.StorageManager.onChanged((changes) => {
          for (const [key, change] of Object.entries(changes)) {
            if (!(key in this.settings) || change.newValue === undefined) {
              continue;
            }

            // Self-echo guard: skip our own debounced speed write echoing back.
            // Without this, the echo reverts in-memory state and mis-cancels timers.
            if (key === 'lastSpeed') {
              const isSelfEcho =
                this._lastWrittenSpeed !== null && change.newValue === this._lastWrittenSpeed;
              this._lastWrittenSpeed = null; // always clear — stale token is worse than missing one
              if (isSelfEcho) {
                continue;
              }
            }

            this.settings[key] = change.newValue;

            // External lastSpeed write while we have a pending debounce:
            // cancel our stale timer — the external value is more recent.
            if (key === 'lastSpeed' && this.saveTimer) {
              clearTimeout(this.saveTimer);
              this.saveTimer = null;
              this.pendingSave = null;
            }

            window.VSC.logger.debug(`Settings updated from storage change: ${key}`);
          }
        });
      } catch (e) {
        // StorageManager may not be fully available yet (e.g. during tests).
        // Non-fatal — the listener just won't be active.
        window.VSC.logger.debug(`Could not set up storage change listener: ${e.message}`);
      }
    }

    /**
     * Load settings from Chrome storage or pre-injected settings
     * @returns {Promise<Object>} Loaded settings
     */
    async load() {
      try {
        // Use StorageManager which handles both contexts automatically
        const storage = await window.VSC.StorageManager.get(window.VSC.Constants.DEFAULT_SETTINGS);

        // null = bridge signaled abort (site disabled/blacklisted)
        if (storage === null) {
          this.settings._abort = true;
          return;
        }

        this._loaded = true;

        // Handle key bindings migration/initialization
        this.settings.keyBindings = (
          storage.keyBindings || window.VSC.Constants.DEFAULT_SETTINGS.keyBindings
        ).map(VideoSpeedConfig.normalizeKeyBinding);

        if (!storage.keyBindings || storage.keyBindings.length === 0) {
          window.VSC.logger.info('First initialization - setting up default key bindings');
          this.settings.keyBindings = [...window.VSC.Constants.DEFAULT_SETTINGS.keyBindings];
          await this.save({ keyBindings: this.settings.keyBindings });
        }

        // Migrate legacy blacklist → siteRules (one-shot)
        if (storage.blacklist !== null && storage.blacklist !== undefined && !storage.siteRules) {
          const regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;
          storage.siteRules = storage.blacklist
            .split('\n')
            .map((l) => l.replace(regStrip, ''))
            .filter(Boolean)
            .map((pattern) => ({ pattern, enabled: false, speed: null }));
          await this.save({ siteRules: storage.siteRules });
          // Keep blacklist in storage for backward compat with older extension
          // versions that may be synced across devices. Harmless dead weight.
          window.VSC.logger.info('Migrated blacklist to siteRules');
        } else if (
          storage.blacklist !== null &&
          storage.blacklist !== undefined &&
          storage.siteRules
        ) {
          // Both exist (e.g. partial sync, rollback). Prefer siteRules, log warning.
          window.VSC.logger.warn('Found both blacklist and siteRules — using siteRules');
        }

        // Apply siteRules
        this.settings.siteRules =
          storage.siteRules || window.VSC.Constants.DEFAULT_SETTINGS.siteRules;

        // Match current URL against site rules to derive per-site default speed.
        // matchSiteRule is exposed on window.VSC by inject-entry.js; guard for
        // test environments where it may not be available.
        if (window.VSC.matchSiteRule) {
          const matched = window.VSC.matchSiteRule(this.settings.siteRules, window.location.href);
          if (matched && matched.speed !== null && matched.speed !== undefined) {
            this.settings.siteDefaultSpeed = matched.speed;
            window.VSC.logger.info(
              `Site rule matched: pattern="${matched.pattern}", speed=${matched.speed}`
            );
          }
        }

        // Apply loaded settings
        this.settings.lastSpeed = Number(storage.lastSpeed);
        this.settings.rememberSpeed = Boolean(storage.rememberSpeed);

        // When rememberSpeed is OFF, discard the stored lastSpeed so that
        // site rule baselines (siteDefaultSpeed) win on fresh page loads
        // instead of a stale speed from a previous session.
        if (!this.settings.rememberSpeed) {
          this.settings.lastSpeed = 1.0;
        }
        this.settings.exclusiveKeys = Boolean(storage.exclusiveKeys);
        this.settings.audioBoolean = Boolean(storage.audioBoolean);
        this.settings.startHidden = Boolean(storage.startHidden);
        this.settings.controllerOpacity = Number(storage.controllerOpacity);
        this.settings.controllerButtonSize = Number(storage.controllerButtonSize);
        this.settings.controllerCSS =
          storage.controllerCSS ?? window.VSC.Constants.DEFAULT_CONTROLLER_CSS;
        this.settings.logLevel = Number(
          storage.logLevel || window.VSC.Constants.DEFAULT_SETTINGS.logLevel
        );

        // Update logger verbosity
        window.VSC.logger.setVerbosity(this.settings.logLevel);

        window.VSC.logger.info('Settings loaded successfully');
        return this.settings;
      } catch (error) {
        window.VSC.logger.error(`Failed to load settings: ${error.message}`);
        return window.VSC.Constants.DEFAULT_SETTINGS;
      }
    }

    /**
     * Save settings to Chrome storage
     *
     * IMPORTANT: Only the keys present in newSettings are written to storage.
     * This avoids the "stale full-blob write" race condition where two contexts
     * (e.g. options page + content script) each hold their own in-memory copy
     * and overwrite each other's changes.  chrome.storage.sync.set({key: val})
     * atomically merges — it updates only the supplied keys and leaves the
     * rest untouched.
     *
     * In-memory settings are updated immediately regardless of persistence
     * outcome — the current session should always reflect the user's intent.
     * Returns false only when the storage write observably fails (options page
     * context with direct chrome.storage access). In page context, the
     * postMessage bridge is fire-and-forget so failures are invisible here.
     *
     * @param {Object} newSettings - Settings to save (only these keys are written)
     * @returns {Promise<boolean>} true if persisted (or debounced), false on storage failure
     */
    async save(newSettings = {}) {
      const keys = Object.keys(newSettings);
      if (keys.length === 0) {
        return true;
      }

      // Guard: refuse to write before load() has read from storage.
      // Without this, a save() during initialization writes DEFAULT_SETTINGS
      // to storage, silently clobbering the user's real persisted values.
      if (!this._loaded) {
        window.VSC.logger.error(
          'save() called before load() — refusing to overwrite user data with defaults'
        );
        return false;
      }

      // Update in-memory settings immediately
      this.settings = { ...this.settings, ...newSettings };

      // Check if this is a speed-only update that should be debounced
      if (keys.length === 1 && keys[0] === 'lastSpeed') {
        this.pendingSave = newSettings.lastSpeed;

        if (this.saveTimer) {
          clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(async () => {
          const speedToSave = this.pendingSave;
          this.pendingSave = null;
          this.saveTimer = null;

          this._lastWrittenSpeed = speedToSave;
          try {
            await window.VSC.StorageManager.set({ lastSpeed: speedToSave });
            window.VSC.logger.info('Debounced speed setting saved successfully');
          } catch (error) {
            this._lastWrittenSpeed = null;
            window.VSC.logger.error(`Failed to persist speed: ${error.message}`);
          }
        }, this.SAVE_DELAY);

        return true; // in-memory updated, persistence is deferred
      }

      try {
        await window.VSC.StorageManager.set(newSettings);
      } catch (error) {
        window.VSC.logger.error(`Failed to save settings: ${error.message}`);
        return false;
      }

      if (newSettings.logLevel !== undefined) {
        window.VSC.logger.setVerbosity(this.settings.logLevel);
      }

      window.VSC.logger.info('Settings saved successfully');
      return true;
    }

    /**
     * Get a specific key binding
     * @param {string} action - Action name
     * @param {string} property - Property to get (default: 'value')
     * @returns {*} Key binding property value
     */
    getKeyBinding(action, property = 'value') {
      try {
        const binding = this.settings.keyBindings.find((item) => item.action === action);
        return binding ? binding[property] : false;
      } catch (e) {
        window.VSC.logger.error(`Failed to get key binding for ${action}: ${e.message}`);
        return false;
      }
    }

    /**
     * Set a key binding value with validation
     * @param {string} action - Action name
     * @param {*} value - Value to set
     */
    setKeyBinding(action, value) {
      try {
        const binding = this.settings.keyBindings.find((item) => item.action === action);
        if (!binding) {
          window.VSC.logger.warn(`No key binding found for action: ${action}`);
          return;
        }

        // Validate speed-related values to prevent corruption
        if (['reset', 'fast', 'slower', 'faster'].includes(action)) {
          if (typeof value !== 'number' || isNaN(value)) {
            window.VSC.logger.warn(`Invalid numeric value for ${action}: ${value}`);
            return;
          }
        }

        binding.value = value;
        window.VSC.logger.debug(`Updated key binding ${action} to ${value}`);
      } catch (e) {
        window.VSC.logger.error(`Failed to set key binding for ${action}: ${e.message}`);
      }
    }

    /**
     * Normalize a key binding's modifiers to strict booleans.
     * Strips the modifiers object entirely when all values are falsy.
     * Defensive against corrupt storage data (e.g., modifiers: { shift: 1 }).
     * @param {Object} binding
     * @returns {Object} Sanitized binding (shallow copy)
     * @private
     */
    static normalizeKeyBinding(binding) {
      if (!binding || !binding.modifiers) {
        return binding;
      }
      const m = binding.modifiers;
      const normalized = {
        shift: Boolean(m.shift),
        ctrl: Boolean(m.ctrl),
        alt: Boolean(m.alt),
        meta: Boolean(m.meta),
      };
      const result = { ...binding };
      if (normalized.shift || normalized.ctrl || normalized.alt || normalized.meta) {
        result.modifiers = normalized;
      } else {
        delete result.modifiers;
      }
      return result;
    }
  }

  // Create singleton instance
  window.VSC.videoSpeedConfig = new VideoSpeedConfig();

  // Export constructor for testing
  window.VSC.VideoSpeedConfig = VideoSpeedConfig;
}
