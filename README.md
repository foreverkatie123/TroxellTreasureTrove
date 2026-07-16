# Troxell Transparent Overlay

This desktop version turns the existing TV display into a transparent, always-on-top overlay. The underlying VTT, browser, video, image viewer, or other application remains visible and does not need to be captured.

## Run it

1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.

The controller opens on the primary display. The transparent overlay opens on the first non-primary display, or the primary display if only one monitor is connected.

## Interaction modes

By default, mouse clicks pass through the overlay to the application underneath it. In the controller, press **Enable Interaction** when you need to draw an effect, use the ruler, or reveal fog directly on the overlay. Disable interaction afterward.

Keyboard shortcut: **Ctrl+Shift+O** toggles overlay interaction globally.

## Important limitation

A transparent overlay can draw grid lines, initiative, fog, rulers, and spell effects, but it cannot automatically understand the map beneath it. Grid alignment and fog masks still need to be configured against the displayed map. This prototype uses the overlay window dimensions as its coordinate surface.

## Files

- `main.js` — creates the transparent overlay and controller windows.
- `preload.js` — safe IPC bridge between the windows.
- `overlay.html` — converted TV display.
- `controller.html` — converted DM remote.
