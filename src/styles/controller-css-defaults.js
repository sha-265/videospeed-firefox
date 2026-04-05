/**
 * Default CSS for controller site-specific positioning overrides.
 *
 * Base vsc-controller rule lives in inject.css (manifest-loaded).
 * This module contains site-specific overrides that layer on top.
 *
 * Domain selectors use :root[style*='--vsc-domain: "DOMAIN"'] syntax.
 * At injection time, matching domains get the selector stripped (rule
 * applies unconditionally); non-matching get [data-vsc-never] (never
 * matches). No CSS variable is actually set on :root.
 */

export const DEFAULT_CONTROLLER_CSS = `/* === Domain-based rules (stable — hostname only) === */

/* Facebook */
:root[style*='--vsc-domain: "facebook.com"'] vsc-controller {
  position: relative;
  top: 40px;
}

/* Google Photos — inline preview */
:root[style*='--vsc-domain: "photos.google.com"'] vsc-controller {
  position: relative;
  top: 35px;
}

/* Google Photos — full-screen view */
:root[style*='--vsc-domain: "photos.google.com"'] #player .house-brand vsc-controller {
  top: 50px;
}

/* Netflix */
:root[style*='--vsc-domain: "netflix.com"'] vsc-controller {
  position: relative;
  top: 85px;
}

/* Google Drive — shift native controls overlay down to expose video */
:root[style*='--vsc-domain: "drive.google.com"'] section[role="tabpanel"][aria-label="Video Player"] {
  top: 80px;
}

/* ChatGPT */
:root[style*='--vsc-domain: "chatgpt.com"'] vsc-controller {
  position: relative;
  top: 0px;
  left: 35px;
}

/* === DOM-contextual rules (may break if site changes HTML structure) === */

/* YouTube — shifts controller below info bar when hidden */
.ytp-hide-info-bar vsc-controller {
  position: relative;
  top: 10px;
}

/* YouTube — shifts below paid promotion overlay when visible */
.ytp-hide-info-bar:has(.ytp-paid-content-overlay-link:not([style*="display: none"])) vsc-controller {
  top: 40px;
}

/* YouTube embedded player (on third-party sites) */
.html5-video-player:not(.ytp-hide-info-bar) vsc-controller,
#player > vsc-controller {
  position: relative;
  top: 60px;
}

/* OpenAI — prevent black overlay */
.Shared-Video-player > vsc-controller {
  height: 0 !important;
}

/* Amazon Prime Video — prevent black overlay */
.dv-player-fullscreen vsc-controller {
  height: 0 !important;
}

/* Google Drive YouTube embed — no info bar, override embedded player offset.
   Extra :root bumps specificity above .html5-video-player:not(...) rule. */
:root:root[style*='--vsc-domain: "youtube.googleapis.com"'] vsc-controller {
  position: relative;
  top: 0px;
}`;
