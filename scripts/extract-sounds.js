/**
 * Automatic keystroke onset detection and clip extraction.
 *
 * Reads keyboard_sounds.wav, detects individual keystroke events via
 * short-time energy onset detection, clusters them by energy level, and
 * exports representative WAV clips for each key-sound category.
 *
 * Output files (all written to resources/sounds/blue/):
 *   blue_down.wav        – regular key press
 *   blue_down_heavy.wav  – heavy key (space / enter / backspace) press
 *   blue_down_mod.wav    – modifier key (shift / ctrl / alt) press
 *   blue_up.wav          – key release
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── paths ──────────────────────────────────────────────────────────────────
const ROOT      = path.join(__dirname, '..');
const SRC_WAV   = path.join(ROOT, 'resources', 'sounds', 'keyboard_sounds.wav');
const OUT_DIR   = path.join(ROOT, 'resources', 'sounds', 'blue');

// ── tuning parameters ──────────────────────────────────────────────────────
const WINDOW_SAMPLES   = 256;    // ~5 ms at 48 kHz – energy window size
const ONSET_THRESHOLD  = 0.012;  // normalised RMS threshold (0-1)
const ONSET_RATIO      = 4.0;    // min ratio of peak energy to background
const MIN_GAP_MS       = 80;     // minimum ms between two onsets
const CLIP_PRE_MS      = 5;      // ms before onset to include
const CLIP_LEN_MS      = 280;    // total clip length in ms
const MAX_CLIPS        = 120;    // max clips to collect before stopping

// ── WAV parser ─────────────────────────────────────────────────────────────
function parseWav(buf) {
  let offset = 12; // skip "RIFF....WAVE"
  let fmt = null;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buf.length - 8) {
    const id   = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    offset += 8;

    if (id === 'fmt ') {
      fmt = {
        audioFormat:   buf.readUInt16LE(offset),
        channels:      buf.readUInt16LE(offset + 2),
        sampleRate:    buf.readUInt32LE(offset + 4),
        byteRate:      buf.readUInt32LE(offset + 8),
        blockAlign:    buf.readUInt16LE(offset + 12),
        bitsPerSample: buf.readUInt16LE(offset + 14),
      };
    } else if (id === 'data') {
      dataOffset = offset;
      dataSize   = size;
      break;
    }
    offset += size + (size & 1); // chunk sizes are word-aligned
  }

  if (!fmt || !dataOffset) throw new Error('Invalid WAV file');
  return { fmt, dataOffset, dataSize };
}

// ── WAV encoder ────────────────────────────────────────────────────────────
function encodeWav(samples, sampleRate, channels, bitsPerSample) {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize       = samples.length * bytesPerSample;
  const buf            = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buf.writeUInt16LE(channels * bytesPerSample, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    buf.writeInt16LE(clamped, 44 + i * 2);
  }
  return buf;
}

// ── helpers ────────────────────────────────────────────────────────────────
function rms(monoSamples, start, len) {
  let sum = 0;
  const end = Math.min(start + len, monoSamples.length);
  for (let i = start; i < end; i++) {
    sum += monoSamples[i] * monoSamples[i];
  }
  return Math.sqrt(sum / (end - start));
}

// Fade in first fadeLen samples, fade out last fadeLen samples
function applyFades(samples, fadeLen) {
  for (let i = 0; i < Math.min(fadeLen, samples.length); i++) {
    samples[i] *= i / fadeLen;
  }
  for (let i = 0; i < Math.min(fadeLen, samples.length); i++) {
    samples[samples.length - 1 - i] *= i / fadeLen;
  }
}

// ── main ───────────────────────────────────────────────────────────────────
function main() {
  console.log('Reading WAV…');
  const buf  = fs.readFileSync(SRC_WAV);
  const { fmt, dataOffset, dataSize } = parseWav(buf);

  console.log(`Format: ${fmt.channels}ch, ${fmt.sampleRate} Hz, ${fmt.bitsPerSample}-bit`);

  const { sampleRate, channels, bitsPerSample } = fmt;
  const bytesPerSample  = bitsPerSample / 8;
  const totalFrames     = dataSize / (channels * bytesPerSample);

  // ── read all frames as normalised mono float ──────────────────────────
  console.log(`Frames: ${totalFrames} (~${(totalFrames / sampleRate).toFixed(1)} s)`);
  const mono = new Float32Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const bytePos = dataOffset + (i * channels + ch) * bytesPerSample;
      sum += buf.readInt16LE(bytePos);
    }
    mono[i] = (sum / channels) / 32768;
  }

  // ── onset detection ───────────────────────────────────────────────────
  const minGapFrames  = Math.floor(MIN_GAP_MS * sampleRate / 1000);
  const clipPreFrames = Math.floor(CLIP_PRE_MS * sampleRate / 1000);
  const clipLenFrames = Math.floor(CLIP_LEN_MS * sampleRate / 1000);

  const onsets = [];          // { frame, peakRms }
  let bgEnergy = 0;
  let lastOnset = -minGapFrames;

  for (let i = 0; i < totalFrames - WINDOW_SAMPLES * 2; i += WINDOW_SAMPLES) {
    const curRms  = rms(mono, i, WINDOW_SAMPLES);
    const prevRms = rms(mono, Math.max(0, i - WINDOW_SAMPLES * 2), WINDOW_SAMPLES);

    // Running background estimate (slow follower)
    bgEnergy = bgEnergy * 0.98 + curRms * 0.02;

    if (
      curRms > ONSET_THRESHOLD &&
      curRms > prevRms * ONSET_RATIO &&
      curRms > bgEnergy * ONSET_RATIO &&
      i - lastOnset > minGapFrames
    ) {
      // Refine onset: find exact peak within ±1 window
      let bestFrame = i;
      let bestRms   = curRms;
      for (let j = Math.max(0, i - WINDOW_SAMPLES); j < i + WINDOW_SAMPLES && j < totalFrames; j += 32) {
        const r = rms(mono, j, 128);
        if (r > bestRms) { bestRms = r; bestFrame = j; }
      }
      onsets.push({ frame: bestFrame, peakRms: bestRms });
      lastOnset = bestFrame;
      if (onsets.length >= MAX_CLIPS) break;
    }
  }

  console.log(`Detected ${onsets.length} onsets`);
  if (onsets.length === 0) {
    console.error('No onsets found – try lowering ONSET_THRESHOLD');
    process.exit(1);
  }

  // ── cluster by energy into 3 tiers ───────────────────────────────────
  // Sort by peak energy to find natural breaks
  const sorted = [...onsets].sort((a, b) => b.peakRms - a.peakRms);
  const maxE   = sorted[0].peakRms;
  const minE   = sorted[sorted.length - 1].peakRms;
  const range  = maxE - minE;

  // Heavy keys  > 60% of range from minimum
  // Modifier    < 30% of range from minimum
  // Regular     everything in between
  const heavyThresh = minE + range * 0.60;
  const modThresh   = minE + range * 0.30;

  const buckets = { heavy: [], regular: [], mod: [] };
  for (const o of onsets) {
    if      (o.peakRms >= heavyThresh) buckets.heavy.push(o);
    else if (o.peakRms <= modThresh)   buckets.mod.push(o);
    else                               buckets.regular.push(o);
  }

  // Also look for "up" strokes: lower energy events that follow a heavy onset
  // by 80–400 ms (key release). We pick the quieter hit after each onset.
  const upCandidates = [];
  for (const o of onsets) {
    // Find first onset in the window 50-300 ms after this one
    const windowStart = o.frame + Math.floor(0.05 * sampleRate);
    const windowEnd   = o.frame + Math.floor(0.35 * sampleRate);
    const follow = onsets.find(x => x.frame > windowStart && x.frame < windowEnd && x.peakRms < o.peakRms * 0.6);
    if (follow) upCandidates.push(follow);
  }

  console.log(`Buckets – heavy: ${buckets.heavy.length}, regular: ${buckets.regular.length}, mod: ${buckets.mod.length}, up candidates: ${upCandidates.length}`);

  // ── extract median representative clip from each bucket ──────────────
  function medianOnset(arr) {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a.peakRms - b.peakRms);
    return s[Math.floor(s.length / 2)];
  }

  function extractClip(onset, originalMono) {
    const start   = Math.max(0, onset.frame - clipPreFrames);
    const end     = Math.min(originalMono.length, start + clipLenFrames);
    const samples = new Float32Array(end - start);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = originalMono[start + i] * 32768;
    }
    applyFades(samples, Math.floor(0.003 * sampleRate)); // 3 ms fades
    return samples;
  }

  // ── read raw stereo for the actual output (preserve stereo) ──────────
  function extractStereoClip(onset) {
    const startFrame = Math.max(0, onset.frame - clipPreFrames);
    const endFrame   = Math.min(totalFrames, startFrame + clipLenFrames);
    const numSamples = (endFrame - startFrame) * channels;
    const samples    = new Float32Array(numSamples);
    for (let i = startFrame; i < endFrame; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const bytePos = dataOffset + (i * channels + ch) * bytesPerSample;
        samples[(i - startFrame) * channels + ch] = buf.readInt16LE(bytePos);
      }
    }
    // Fades on interleaved samples – apply per frame
    const fadeSamples = Math.floor(0.003 * sampleRate);
    for (let f = 0; f < fadeSamples; f++) {
      const gain = f / fadeSamples;
      for (let ch = 0; ch < channels; ch++) {
        samples[f * channels + ch] *= gain;
        const tail = (endFrame - startFrame - 1 - f) * channels + ch;
        if (tail >= 0) samples[tail] *= gain;
      }
    }
    return samples;
  }

  function saveClip(onset, filename) {
    if (!onset) { console.log(`  skip ${filename} (no onset)`); return; }
    const samples = extractStereoClip(onset);
    const wavBuf  = encodeWav(samples, sampleRate, channels, bitsPerSample);
    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, wavBuf);
    console.log(`  Saved ${filename}  (onset @${(onset.frame / sampleRate).toFixed(3)}s, rms=${onset.peakRms.toFixed(4)})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\nExporting clips…');
  saveClip(medianOnset(buckets.regular), 'blue_down.wav');
  saveClip(medianOnset(buckets.heavy),   'blue_down_heavy.wav');
  saveClip(medianOnset(buckets.mod),     'blue_down_mod.wav');
  saveClip(medianOnset(upCandidates),    'blue_up.wav');

  // Export a few alternates for variety
  if (buckets.regular.length >= 3) {
    const alts = [...buckets.regular].sort((a, b) => a.peakRms - b.peakRms);
    saveClip(alts[Math.floor(alts.length * 0.25)], 'blue_down_soft.wav');
    saveClip(alts[Math.floor(alts.length * 0.75)], 'blue_down_loud.wav');
  }

  console.log('\nDone! Files written to', OUT_DIR);

  // ── summary ───────────────────────────────────────────────────────────
  console.log('\n── Key-sound mapping ──────────────────────────────────────');
  console.log('  Space / Enter / Backspace  →  blue_down_heavy.wav');
  console.log('  Shift / Ctrl / Alt / Meta  →  blue_down_mod.wav');
  console.log('  All other keys (down)      →  blue_down.wav');
  console.log('  All keys (up)              →  blue_up.wav');
}

main();
