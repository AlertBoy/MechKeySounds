const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { uIOhook } = require('uiohook-napi');

let mainWindow = null;
let tray = null;
let isEnabled = true;

/** Tray menu + tooltip locale (synced from renderer preference) */
let uiLocale = 'en';

const TRAY_I18N = {
  en: {
    enabled: (on) => (on ? '\u2713 Enabled' : '\u2717 Disabled'),
    showPanel: 'Show Panel',
    quit: 'Quit MechKeySounds',
    tooltip: 'MechKeySounds \u2014 mechanical key sounds',
  },
  zh: {
    enabled: (on) => (on ? '\u2713 \u5df2\u542f\u7528' : '\u2717 \u5df2\u5173\u95ed'),
    showPanel: '\u663e\u793a\u63a7\u5236\u9762\u677f',
    quit: '\u9000\u51fa MechKeySounds',
    tooltip: 'MechKeySounds \u2014 \u673a\u68b0\u952e\u76d8\u97f3\u6548',
  },
};

function normalizeUiLocale(code) {
  if (!code) return 'en';
  return String(code).toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function applyTrayLocale(code) {
  uiLocale = normalizeUiLocale(code);
  const T = TRAY_I18N[uiLocale];
  if (tray) {
    tray.setToolTip(T.tooltip);
  }
}

// Audio state
let volume = 1.0;
let mouseSoundsEnabled = true;
let currentProfile = 'blue';

/**
 * Packaged app keeps assets in app.asar; afplay and other CLI players need a real path.
 * WAVs are listed in electron-builder.yml asarUnpack → app.asar.unpacked/resources/sounds
 */
function getSoundsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'sounds');
  }
  return path.join(__dirname, 'resources', 'sounds');
}

// uiohook-napi keycodes (cross-platform)
// Heavy keys: space, enter, backspace, tab, delete
const HEAVY_KEYCODES = new Set([
  57,   // Space
  28,   // Enter
  14,   // Backspace
  15,   // Tab
  3639, // Delete (macOS)
  3655, // Numpad Enter
]);
// Modifier keys: shift, ctrl, alt, meta, caps lock, fn
const MODIFIER_KEYCODES = new Set([
  42, 54,   // Shift L/R
  29, 3613, // Ctrl L/R
  56, 3640, // Alt L/R
  3675, 3676, // Meta L/R (macOS Cmd)
  58,   // Caps Lock
  3666, // Fn
]);

function getKeyCategory(keycode) {
  if (HEAVY_KEYCODES.has(keycode))    return 'heavy';
  if (MODIFIER_KEYCODES.has(keycode)) return 'mod';
  return 'regular';
}

// Resolve WAV path with fallback chain
function resolveSound(profile, variant) {
  const base = getSoundsDir();
  const candidates = [
    path.join(base, profile, `${profile}_down_${variant}.wav`),
    path.join(base, 'blue', `blue_down_${variant}.wav`),
    path.join(base, 'blue', 'blue_down.wav'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function getSoundPath(type, keycode) {
  const base = getSoundsDir();
  if (type === 'down') {
    const cat = getKeyCategory(keycode);
    if (cat === 'heavy') {
      return resolveSound(currentProfile, 'heavy');
    } else if (cat === 'mod') {
      return resolveSound(currentProfile, 'mod');
    } else {
      // Regular: alternate between soft/loud/normal for subtle variety
      const variants = ['', '_soft', '_loud'];
      const pick = variants[Math.floor(Math.random() * variants.length)];
      const candidate = path.join(base, currentProfile, `${currentProfile}_down${pick}.wav`);
      if (pick !== '' && fs.existsSync(candidate)) return candidate;
      return resolveSound(currentProfile, '') || path.join(base, 'blue', 'blue_down.wav');
    }
  }
  // up / mouse
  const candidate = path.join(base, currentProfile, `${currentProfile}_${type}.wav`);
  if (fs.existsSync(candidate)) return candidate;
  const fallback = path.join(base, 'blue', `blue_${type}.wav`);
  if (fs.existsSync(fallback)) return fallback;
  return path.join(base, 'blue', 'blue_down.wav');
}

// Track concurrent afplay processes per slot to prevent stacking
const players = {};

function playSound(type, keycode = 0) {
  const file = getSoundPath(type, keycode);
  if (!file || !fs.existsSync(file)) return;

  const slot = type === 'down' ? `down_${getKeyCategory(keycode)}` : type;

  if (players[slot]) {
    players[slot].kill();
    players[slot] = null;
  }

  const proc = spawn('afplay', ['-v', String(volume), file]);
  players[slot] = proc;
  const cleanup = () => { if (players[slot] === proc) players[slot] = null; };
  proc.on('close', cleanup);
  proc.on('error', cleanup);
}

function createTrayIcon() {
  const icon1x = path.join(__dirname, 'resources', 'icons', 'tray.png');
  const icon2x = path.join(__dirname, 'resources', 'icons', 'tray@2x.png');

  let img;
  if (fs.existsSync(icon1x)) {
    img = nativeImage.createFromPath(icon1x);
    // Attach retina variant if available
    if (fs.existsSync(icon2x)) {
      const img2x = nativeImage.createFromPath(icon2x);
      img.addRepresentation({ scaleFactor: 2.0, buffer: img2x.toPNG() });
    }
  } else {
    // Minimal 1px transparent fallback – should never reach here
    img = nativeImage.createEmpty();
  }

  // Full-colour icon (blue gradient + white "M"); do not use template mode
  return img;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Log renderer errors
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[Renderer ${levels[level] || level}] ${message}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
  });

  mainWindow.on('blur', () => {
    console.log('[Main] Window blur event (auto-hide disabled for debug)');
    // mainWindow.hide();
  });
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Position window near the tray
    const trayBounds = tray.getBounds();
    mainWindow.setPosition(
      Math.round(trayBounds.x + trayBounds.width / 2 - 170),
      Math.round(trayBounds.y + trayBounds.height + 4)
    );
    mainWindow.show();
    mainWindow.focus();
    console.log('[Main] Window shown');
  }
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip(TRAY_I18N[uiLocale].tooltip);

  // macOS: setContextMenu overrides left-click and prevents 'click' event.
  // Left-click toggles the panel; right-click shows the context menu.
  tray.on('click', toggleWindow);
  tray.on('right-click', () => {
    tray.popUpContextMenu(buildContextMenu());
  });
}

function buildContextMenu() {
  const T = TRAY_I18N[uiLocale];
  return Menu.buildFromTemplate([
    {
      label: T.enabled(isEnabled),
      click: () => {
        isEnabled = !isEnabled;
        if (mainWindow) {
          mainWindow.webContents.send('settings-changed', { enabled: isEnabled });
        }
      }
    },
    { type: 'separator' },
    {
      label: T.showPanel,
      click: toggleWindow
    },
    { type: 'separator' },
    {
      label: T.quit,
      click: () => app.quit()
    }
  ]);
}

// Track held keys to filter out key repeat
const heldKeys = new Set();

function setupHooks() {
  uIOhook.on('keydown', (e) => {
    if (!isEnabled) return;
    if (heldKeys.has(e.keycode)) return;
    heldKeys.add(e.keycode);
    playSound('down', e.keycode);
  });

  uIOhook.on('keyup', (e) => {
    if (!isEnabled) return;
    heldKeys.delete(e.keycode);
    playSound('up', e.keycode);
  });

  uIOhook.on('mousedown', () => {
    if (!isEnabled || !mouseSoundsEnabled) return;
    playSound('mouse');
  });

  try {
    uIOhook.start();
    console.log('Keyboard hooks started successfully');
  } catch (err) {
    console.error('Failed to start keyboard hooks:', err.message);
    // Notify renderer about the permission issue
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-error', {
          message: 'Accessibility permission required. Please grant it in System Settings > Privacy & Security > Accessibility.'
        });
      }
    }, 1000);
  }
}

// IPC handlers
ipcMain.on('set-locale', (_event, lang) => {
  applyTrayLocale(lang);
});

ipcMain.on('toggle-enabled', (_event, enabled) => {
  isEnabled = enabled;
});

ipcMain.on('set-volume', (_event, vol) => {
  volume = Math.max(0, Math.min(2, Number(vol)));
});

ipcMain.on('set-profile', (_event, profileKey) => {
  currentProfile = profileKey;
});

ipcMain.on('set-spatial-audio', () => {
  // Spatial audio is UI-only for now; afplay doesn't support panning
});

ipcMain.on('set-mouse-sounds', (_event, enabled) => {
  mouseSoundsEnabled = enabled;
});

ipcMain.on('test-sound', (_event, type) => {
  playSound(type);
});

ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

// Disable GPU hardware acceleration to prevent renderer SIGSEGV crashes
// on macOS with transparent frameless windows
app.disableHardwareAcceleration();

// App lifecycle
app.whenReady().then(() => {
  // Don't show in dock on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  applyTrayLocale(app.getLocale());

  createWindow();
  createTray();
  setupHooks();
});

// Prevent app from quitting when all windows close
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  try {
    uIOhook.stop();
  } catch (_) {}
});
