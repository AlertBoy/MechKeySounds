/**
 * English / Chinese UI strings
 */
(function (global) {
  const STR = {
    en: {
      appTitle: 'MechKeySounds',
      enableSounds: 'Enable Sounds',
      switchProfile: 'Switch Profile',
      volume: 'Volume',
      pitchVariation: 'Pitch Variation',
      spatialAudio: 'Spatial Audio',
      mouseSounds: 'Mouse Sounds',
      testSounds: 'Test Sounds',
      keyDown: 'Key Down',
      keyUp: 'Key Up',
      mouseClick: 'Mouse Click',
      statusListening: 'Listening for keystrokes…',
      statusDisabled: 'Sounds disabled',
      langShort: 'Language',
      profileBlue: 'Cherry MX Blue',
      profileRed: 'Cherry MX Red',
      profileBrown: 'Cherry MX Brown',
      trayEnabled: '\u2713 Enabled',
      trayDisabled: '\u2717 Disabled',
      trayShowPanel: 'Show Panel',
      trayQuit: 'Quit MechKeySounds',
      trayTooltip: 'MechKeySounds — mechanical key sounds',
    },
    zh: {
      appTitle: '机械键盘音效',
      enableSounds: '启用音效',
      switchProfile: '轴体方案',
      volume: '音量',
      pitchVariation: '音高随机',
      spatialAudio: '空间声像',
      mouseSounds: '鼠标点击音',
      testSounds: '试听',
      keyDown: '按下',
      keyUp: '松开',
      mouseClick: '鼠标',
      statusListening: '正在监听按键…',
      statusDisabled: '音效已关闭',
      langShort: '语言',
      profileBlue: '樱桃 MX 青轴',
      profileRed: '樱桃 MX 红轴',
      profileBrown: '樱桃 MX 茶轴',
      trayEnabled: '\u2713 已启用',
      trayDisabled: '\u2717 已关闭',
      trayShowPanel: '显示控制面板',
      trayQuit: '退出 MechKeySounds',
      trayTooltip: 'MechKeySounds — 机械键盘音效',
    },
  };

  const STORAGE_KEY = 'mechkeysounds-locale';

  function normalize(lang) {
    return lang === 'zh' || lang === 'zh-CN' ? 'zh' : 'en';
  }

  function getInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalize(saved);
    } catch (_) {}
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, normalize(lang));
    } catch (_) {}
  }

  function t(lang, key) {
    const L = normalize(lang);
    return (STR[L] && STR[L][key]) || STR.en[key] || key;
  }

  function applyDOM(lang) {
    const L = normalize(lang);
    document.documentElement.lang = L === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && STR[L][key]) el.textContent = STR[L][key];
    });
    const titleEl = document.querySelector('title');
    if (titleEl && STR[L].appTitle) titleEl.textContent = STR[L].appTitle;
  }

  global.I18N = { STR, normalize, getInitialLang, saveLang, t, applyDOM };
})(typeof window !== 'undefined' ? window : globalThis);
