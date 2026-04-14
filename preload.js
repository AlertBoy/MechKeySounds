const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-changed', (_event, data) => callback(data));
  },
  toggleEnabled: (enabled) => {
    ipcRenderer.send('toggle-enabled', enabled);
  },
  setVolume: (vol) => {
    ipcRenderer.send('set-volume', vol);
  },
  setProfile: (profileKey) => {
    ipcRenderer.send('set-profile', profileKey);
  },
  setSpatialAudio: (enabled) => {
    ipcRenderer.send('set-spatial-audio', enabled);
  },
  setMouseSounds: (enabled) => {
    ipcRenderer.send('set-mouse-sounds', enabled);
  },
  testSound: (type) => {
    ipcRenderer.send('test-sound', type);
  },
  hideWindow: () => {
    ipcRenderer.send('hide-window');
  },
  setLocale: (lang) => {
    ipcRenderer.send('set-locale', lang);
  },
});
