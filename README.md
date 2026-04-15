<p align="center">
  <img src="resources/icons/tray.svg" width="96" height="96" alt="MechKeySounds">
</p>

<h1 align="center">MechKeySounds</h1>

<p align="center">
  <strong>Turn every keystroke into a satisfying mechanical keyboard sound.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/version-1.0.0-green" alt="Version">
  <img src="https://img.shields.io/github/license/AlertBoy/MechKeySounds" alt="License">
</p>

---

## What is it?

MechKeySounds is a lightweight, tray-resident Electron app that plays realistic mechanical keyboard sounds every time you type -- on **any** keyboard. Cherry MX Blue clicks, Red thocks, Brown tactile bumps... your membrane keyboard never sounded this good.

## Features

- **3 Switch Profiles** -- Cherry MX Blue, Red, and Brown with distinct down/up sounds
- **Heavy Key Sounds** -- Space, Enter, Backspace, Tab get a deeper, more satisfying thock
- **Mouse Click Sounds** -- optional mouse click audio
- **Volume & Pitch Control** -- fine-tune volume and add subtle pitch randomization for realism
- **Spatial Audio** -- stereo panning for an immersive soundscape
- **System Tray App** -- stays out of your way, one click to toggle
- **Cross-Platform** -- Windows, macOS, and Linux
- **Bilingual UI** -- English and Chinese (auto-detected)

## Download

Grab the latest installer from [Releases](https://github.com/AlertBoy/MechKeySounds/releases).

| Platform | Format |
|----------|--------|
| Windows  | `.exe` (NSIS installer) |
| macOS    | `.dmg` / `.zip` (Universal) |
| Linux    | `.AppImage` |

## Quick Start

```bash
# Clone and run in development
git clone https://github.com/AlertBoy/MechKeySounds.git
cd MechKeySounds
npm install
npm start
```

## Usage

1. Launch MechKeySounds -- it lives in your system tray
2. **Left-click** the tray icon to open the control panel
3. **Right-click** for quick toggle / quit
4. Pick a switch profile, adjust volume, and start typing

That's it. Every keypress now sounds like a mechanical switch.

## Build from Source

```bash
npm install
npm run build          # build for current platform
npm run build:win      # Windows only
npm run build:mac      # macOS only
npm run build:linux    # Linux only
```

Built installers appear in `dist/`.

## Tech Stack

- **Electron** -- cross-platform desktop runtime
- **uiohook-napi** -- low-level keyboard/mouse hook (native)
- **Web Audio API** -- real-time synthesized switch sounds with multi-layer synthesis
- **PowerShell MediaPlayer / afplay / aplay** -- WAV playback via native OS commands

## License

MIT
