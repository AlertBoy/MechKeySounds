/**
 * Renderer - pure UI controller.
 * All audio is handled in the main process via afplay.
 */

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
const langEn = document.getElementById('langEn');
const langZh = document.getElementById('langZh');

let currentLang = I18N.getInitialLang();

function updateLangButtons() {
  langEn.classList.toggle('active', currentLang === 'en');
  langZh.classList.toggle('active', currentLang === 'zh');
}

function refreshStatus() {
  const on = enabledToggle.checked;
  statusEl.textContent = I18N.t(currentLang, on ? 'statusListening' : 'statusDisabled');
  statusEl.className = 'status' + (on ? ' active' : '');
}

function setLang(lang) {
  currentLang = I18N.normalize(lang);
  I18N.saveLang(currentLang);
  I18N.applyDOM(currentLang);
  updateLangButtons();
  renderProfiles();
  refreshStatus();
  window.electronAPI.setLocale(currentLang);
}

langEn.addEventListener('click', () => setLang('en'));
langZh.addEventListener('click', () => setLang('zh'));

// Enable toggle
enabledToggle.addEventListener('change', () => {
  const enabled = enabledToggle.checked;
  window.electronAPI.toggleEnabled(enabled);
  refreshStatus();
});

// Volume
volumeSlider.addEventListener('input', () => {
  const pct = parseInt(volumeSlider.value, 10);
  volumeValue.textContent = pct + '%';
  window.electronAPI.setVolume(pct / 50);
});

pitchSlider.addEventListener('input', () => {
  pitchValue.textContent = pitchSlider.value + '%';
});

spatialToggle.addEventListener('change', () => {
  window.electronAPI.setSpatialAudio(spatialToggle.checked);
});

mouseToggle.addEventListener('change', () => {
  window.electronAPI.setMouseSounds(mouseToggle.checked);
});

testDown.addEventListener('click', () => {
  window.electronAPI.testSound('down');
});
testUp.addEventListener('click', () => {
  window.electronAPI.testSound('up');
});
testMouse.addEventListener('click', () => {
  window.electronAPI.testSound('mouse');
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.hideWindow();
});

window.electronAPI.onSettingsChanged((data) => {
  if (data.enabled !== undefined) {
    enabledToggle.checked = data.enabled;
    refreshStatus();
  }
});

const profiles = [
  { key: 'blue', color: '#4A90D9' },
  { key: 'red', color: '#E74C3C' },
  { key: 'brown', color: '#8B6914' },
];
let currentProfile = 'blue';

function profileLabelKey(k) {
  return 'profile' + k.charAt(0).toUpperCase() + k.slice(1);
}

function renderProfiles() {
  const container = document.getElementById('switchProfiles');
  container.innerHTML = '';
  profiles.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'profile-btn' + (p.key === currentProfile ? ' active' : '');
    btn.style.setProperty('--profile-color', p.color);
    const name = I18N.t(currentLang, profileLabelKey(p.key));
    btn.innerHTML =
      `<span class="profile-dot" style="background:${p.color}"></span>` +
      `${p.key.charAt(0).toUpperCase() + p.key.slice(1)}` +
      `<span class="profile-name">${name}</span>`;
    btn.addEventListener('click', () => {
      currentProfile = p.key;
      window.electronAPI.setProfile(p.key);
      renderProfiles();
    });
    container.appendChild(btn);
  });
}

setLang(currentLang);
