/**
 * AudioEngine v2 - Realistic mechanical keyboard sounds via Web Audio API
 * Uses multi-layer synthesis: transient impact + body resonance + noise texture
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.buffers = {};
    this.keyDownBuffer = null;
    this.enabled = true;
    this.volume = 0.6;
    this.currentProfile = 'blue';
    this.spatialAudio = true;
    this.pitchVariation = 0.08;
    this.mouseSounds = true;

    this.profiles = {
      blue: {
        name: 'Cherry MX Blue',
        color: '#4A90D9',
        down: {
          duration: 0.08,
          layers: [
            // Sharp click jacket snap
            { type: 'tone', freq: 3800, decay: 0.003, gain: 0.35 },
            { type: 'tone', freq: 5200, decay: 0.002, gain: 0.2 },
            // Impact thock
            { type: 'tone', freq: 180, decay: 0.025, gain: 0.4 },
            { type: 'tone', freq: 320, decay: 0.02, gain: 0.15 },
            // Resonance
            { type: 'tone', freq: 900, decay: 0.015, gain: 0.1 },
            // Noise texture (filtered)
            { type: 'noise', hp: 1500, lp: 6000, decay: 0.015, gain: 0.2 },
            // Return spring
            { type: 'tone', freq: 2400, decay: 0.008, gain: 0.08, delay: 0.001 },
          ]
        },
        up: {
          duration: 0.06,
          layers: [
            { type: 'tone', freq: 3200, decay: 0.003, gain: 0.2 },
            { type: 'tone', freq: 200, decay: 0.02, gain: 0.25 },
            { type: 'noise', hp: 2000, lp: 5000, decay: 0.01, gain: 0.12 },
            { type: 'tone', freq: 800, decay: 0.01, gain: 0.06 },
          ]
        },
        mouse: {
          duration: 0.07,
          layers: [
            { type: 'tone', freq: 2500, decay: 0.004, gain: 0.3 },
            { type: 'tone', freq: 160, decay: 0.03, gain: 0.35 },
            { type: 'noise', hp: 1000, lp: 4000, decay: 0.012, gain: 0.18 },
            { type: 'tone', freq: 600, decay: 0.015, gain: 0.08 },
          ]
        }
      },
      red: {
        name: 'Cherry MX Red',
        color: '#E74C3C',
        down: {
          duration: 0.07,
          layers: [
            // Deep thock
            { type: 'tone', freq: 140, decay: 0.035, gain: 0.5 },
            { type: 'tone', freq: 250, decay: 0.025, gain: 0.25 },
            // Mid resonance (hollow case sound)
            { type: 'tone', freq: 700, decay: 0.02, gain: 0.12 },
            { type: 'tone', freq: 1100, decay: 0.012, gain: 0.06 },
            // Smooth noise texture
            { type: 'noise', hp: 400, lp: 2500, decay: 0.02, gain: 0.18 },
            // Subtle high end
            { type: 'noise', hp: 2000, lp: 4000, decay: 0.008, gain: 0.05 },
          ]
        },
        up: {
          duration: 0.05,
          layers: [
            { type: 'tone', freq: 160, decay: 0.025, gain: 0.3 },
            { type: 'tone', freq: 280, decay: 0.018, gain: 0.12 },
            { type: 'noise', hp: 500, lp: 2000, decay: 0.012, gain: 0.1 },
            { type: 'tone', freq: 600, decay: 0.01, gain: 0.05 },
          ]
        },
        mouse: {
          duration: 0.06,
          layers: [
            { type: 'tone', freq: 150, decay: 0.03, gain: 0.4 },
            { type: 'tone', freq: 350, decay: 0.02, gain: 0.15 },
            { type: 'noise', hp: 400, lp: 2200, decay: 0.015, gain: 0.15 },
          ]
        }
      },
      brown: {
        name: 'Cherry MX Brown',
        color: '#8B6914',
        down: {
          duration: 0.075,
          layers: [
            // Tactile bump click
            { type: 'tone', freq: 2200, decay: 0.004, gain: 0.2 },
            // Body thock
            { type: 'tone', freq: 160, decay: 0.03, gain: 0.45 },
            { type: 'tone', freq: 300, decay: 0.022, gain: 0.2 },
            // Mid warmth
            { type: 'tone', freq: 800, decay: 0.015, gain: 0.1 },
            // Noise
            { type: 'noise', hp: 800, lp: 3500, decay: 0.015, gain: 0.15 },
            // Spring return
            { type: 'tone', freq: 1800, decay: 0.006, gain: 0.06, delay: 0.002 },
          ]
        },
        up: {
          duration: 0.055,
          layers: [
            { type: 'tone', freq: 1600, decay: 0.004, gain: 0.12 },
            { type: 'tone', freq: 180, decay: 0.022, gain: 0.3 },
            { type: 'noise', hp: 1000, lp: 3000, decay: 0.01, gain: 0.1 },
            { type: 'tone', freq: 650, decay: 0.012, gain: 0.06 },
          ]
        },
        mouse: {
          duration: 0.065,
          layers: [
            { type: 'tone', freq: 1800, decay: 0.005, gain: 0.22 },
            { type: 'tone', freq: 155, decay: 0.028, gain: 0.38 },
            { type: 'noise', hp: 600, lp: 3000, decay: 0.014, gain: 0.14 },
            { type: 'tone', freq: 700, decay: 0.013, gain: 0.07 },
          ]
        }
      }
    };
  }

  async initialize() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Load the dedicated key-down WAV (used across all profiles)
    this.keyDownBuffer = await this._loadAudioFile('blue/blue_down.wav');

    // Load per-profile up and mouse sounds, fall back to synthesis if missing
    for (const [profileKey, profile] of Object.entries(this.profiles)) {
      this.buffers[profileKey] = {
        up: await this._loadOrRender(profileKey, 'up', profile.up),
        mouse: await this._loadOrRender(profileKey, 'mouse', profile.mouse)
      };
    }
  }

  async _loadAudioFile(filePath) {
    try {
      const arrayBuffer = await window.electronAPI.loadAudio(filePath);
      if (arrayBuffer) {
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        console.log(`Loaded audio: ${filePath}`);
        return audioBuffer;
      }
    } catch (e) {
      console.warn(`Failed to load audio: ${filePath}`, e);
    }
    return null;
  }

  async _loadOrRender(profileKey, type, synthParams) {
    const buffer = await this._loadAudioFile(`${profileKey}/${profileKey}_${type}.wav`);
    return buffer ?? this._renderSound(synthParams);
  }

  /**
   * Render a multi-layered sound into an AudioBuffer
   */
  _renderSound(params) {
    const sr = 44100;
    const length = Math.ceil(sr * params.duration);
    const buffer = this.ctx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);

    // Generate each layer and mix
    for (const layer of params.layers) {
      const delay = Math.floor((layer.delay || 0) * sr);
      if (layer.type === 'tone') {
        this._renderTone(data, sr, length, layer.freq, layer.decay, layer.gain, delay);
      } else if (layer.type === 'noise') {
        this._renderNoise(data, sr, length, layer.hp, layer.lp, layer.decay, layer.gain, delay);
      }
    }

    // Soft clip / normalize
    let maxAmp = 0;
    for (let i = 0; i < length; i++) {
      maxAmp = Math.max(maxAmp, Math.abs(data[i]));
    }
    if (maxAmp > 0.9) {
      const scale = 0.85 / maxAmp;
      for (let i = 0; i < length; i++) {
        data[i] *= scale;
      }
    }

    // Apply a tiny fade-out at the end to avoid clicks
    const fadeLen = Math.min(64, length);
    for (let i = 0; i < fadeLen; i++) {
      data[length - 1 - i] *= i / fadeLen;
    }

    return buffer;
  }

  /**
   * Render a damped sinusoidal tone
   */
  _renderTone(data, sr, totalLength, freq, decayTime, gain, delay) {
    const omega = 2 * Math.PI * freq;
    const decaySamples = Math.ceil(decayTime * sr);
    const samples = Math.min(decaySamples * 4, totalLength - delay);
    if (samples <= 0) return;

    const decayRate = 1 / (decayTime * sr);

    for (let i = 0; i < samples; i++) {
      const idx = delay + i;
      if (idx >= totalLength) break;

      // Exponential decay envelope with smooth attack
      const t = i / sr;
      let env;
      if (t < 0.0005) {
        env = t / 0.0005; // 0.5ms attack
      } else {
        env = Math.exp(-decayRate * (i - Math.floor(0.0005 * sr)));
      }

      // Sine with slight harmonic content
      const phase = omega * t;
      let sample = Math.sin(phase);
      // Add 2nd harmonic for richness
      sample += Math.sin(phase * 2) * 0.15;
      // Add 3rd harmonic subtly
      sample += Math.sin(phase * 3) * 0.05;

      data[idx] += sample * env * gain;
    }
  }

  /**
   * Render band-pass filtered noise
   */
  _renderNoise(data, sr, totalLength, hpFreq, lpFreq, decayTime, gain, delay) {
    const decaySamples = Math.ceil(decayTime * sr);
    const samples = Math.min(decaySamples * 4, totalLength - delay);
    if (samples <= 0) return;

    const decayRate = 1 / (decayTime * sr);

    // One-pole low-pass coefficient
    const lpCoeff = 1 - Math.exp(-2 * Math.PI * lpFreq / sr);
    // One-pole high-pass state
    let hpPrevIn = 0;
    let hpPrevOut = 0;
    const hpCoeff = 1 - Math.exp(-2 * Math.PI * hpFreq / sr);
    let lpPrev = 0;

    for (let i = 0; i < samples; i++) {
      const idx = delay + i;
      if (idx >= totalLength) break;

      const t = i / sr;
      let env;
      if (t < 0.0005) {
        env = t / 0.0005;
      } else {
        env = Math.exp(-decayRate * (i - Math.floor(0.0005 * sr)));
      }

      // White noise
      const raw = Math.random() * 2 - 1;

      // Low-pass filter
      lpPrev += lpCoeff * (raw - lpPrev);
      // High-pass filter
      const hpOut = hpCoeff * (lpPrev - hpPrevIn) + hpPrevOut;
      hpPrevIn = lpPrev;
      hpPrevOut = hpOut;

      data[idx] += hpOut * env * gain;
    }
  }

  async play(type, pan = 0) {
    if (!this.enabled || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    let buffer;
    if (type === 'down' && this.keyDownBuffer) {
      buffer = this.keyDownBuffer;
    } else {
      const profileBuffers = this.buffers[this.currentProfile];
      if (!profileBuffers || !profileBuffers[type]) return;
      buffer = profileBuffers[type];
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Pitch randomization
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * this.pitchVariation;

    // Spatial audio
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = this.spatialAudio ? Math.max(-1, Math.min(1, pan)) : 0;

    const gain = this.ctx.createGain();
    gain.gain.value = 1.0;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);

    source.start();
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
  }

  setProfile(profileKey) {
    if (this.profiles[profileKey]) {
      this.currentProfile = profileKey;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setSpatialAudio(enabled) {
    this.spatialAudio = enabled;
  }

  setPitchVariation(amount) {
    this.pitchVariation = amount;
  }

  setMouseSounds(enabled) {
    this.mouseSounds = enabled;
  }

  getProfileNames() {
    return Object.entries(this.profiles).map(([key, p]) => ({
      key,
      name: p.name,
      color: p.color
    }));
  }
}

window.AudioEngine = AudioEngine;
