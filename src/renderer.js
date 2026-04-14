/**
 * Renderer - pure UI controller.
 * All audio is handled in the main process via afplay.
 * This file only manages the control panel UI and syncs state to main via IPC.
 */

// UI Elements
const enabledToggle = document.getElementById('enabledToggle');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const pitchSlider = document.getElementById('pitchSlider');
const pitchValue = document.getElementById('pitchValue');
const spatialToggle = document.getElementById('spatialToggle');
const mouseToggle = document.getElementById('mouseToggle');
const closeBtn = document.getElementById('closeBtn');
const testDown = document.getElementById('testDown');
const testUp = document.getElementById('testUp');
const testMouse = document.getElementById('testMouse');
const statusEl = document.getElementById('status');

function updateStatus(text, active) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (active ? ' active' : '');
}

// Enable toggle
enabledToggle.addEventListener('change', () => {
  const enabled = enabledToggle.checked;
  window.electronAPI.toggleEnabled(enabled);
  updateStatus(enabled ? 'Listening for keystrokes...' : 'Sounds disabled', enabled);
});

// Volume
volumeSlider.addEventListener('input', () => {
  const pct = parseInt(volumeSlider.value, 10);
  volumeValue.textContent = pct + '%';
  // afplay -v range: 0~2, map slider 0-100 → 0~2
  window.electronAPI.setVolume(pct / 50);
});

// Pitch variation (UI only label for now)
pitchSlider.addEventListener('input', () => {
  pitchValue.textContent = pitchSlider.value + '%';
});

// Spatial / mouse toggles → notify main process
spatialToggle.addEventListener('change', () => {
  window.electronAPI.setSpatialAudio(spatialToggle.checked);
});

mouseToggle.addEventListener('change', () => {
  window.electronAPI.setMouseSounds(mouseToggle.checked);
});

// Test buttons
testDown.addEventListener('click', () => {
  window.electronAPI.testSound('down');
});
testUp.addEventListener('click', () => {
  window.electronAPI.testSound('up');
});
testMouse.addEventListener('click', () => {
  window.electronAPI.testSound('mouse');
});

// Close button
closeBtn.addEventListener('click', () => {
  window.electronAPI.hideWindow();
});

// Settings changed from main (tray menu toggle)
window.electronAPI.onSettingsChanged((data) => {
  if (data.enabled !== undefined) {
    enabledToggle.checked = data.enabled;
    updateStatus(data.enabled ? 'Listening for keystrokes...' : 'Sounds disabled', data.enabled);
  }
});

// Switch profiles - populate buttons
const profiles = [
  { key: 'blue',  name: 'Cherry MX Blue',  color: '#4A90D9' },
  { key: 'red',   name: 'Cherry MX Red',   color: '#E74C3C' },
  { key: 'brown', name: 'Cherry MX Brown', color: '#8B6914' },
];
let currentProfile = 'blue';

function renderProfiles() {
  const container = document.getElementById('switchProfiles');
  container.innerHTML = '';
  profiles.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'profile-btn' + (p.key === currentProfile ? ' active' : '');
    btn.style.setProperty('--profile-color', p.color);
    btn.innerHTML = `<span class="profile-dot" style="background:${p.color}"></span>${p.key.charAt(0).toUpperCase() + p.key.slice(1)}<span class="profile-name">${p.name}</span>`;
    btn.addEventListener('click', () => {
      currentProfile = p.key;
      window.electronAPI.setProfile(p.key);
      renderProfiles();
    });
    container.appendChild(btn);
  });
}
renderProfiles();

updateStatus('Listening for keystrokes...', true);
