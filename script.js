const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Shared limiter so several sounds stacked together don't clip/crackle at the output.
const masterCompressor = audioCtx.createDynamicsCompressor();
masterCompressor.threshold.value = -12;
masterCompressor.knee.value = 18;
masterCompressor.ratio.value = 4;
masterCompressor.attack.value = 0.01;
masterCompressor.release.value = 0.25;
masterCompressor.connect(audioCtx.destination);

const SOUNDS = [
  { id: "ocean",   label: "Ocean",       emoji: "🌊", color: "#1e88e5",
    filter: "lowpass",  freq: 400,  q: 0.7, swell: { rate: 0.08, depth: 0.35, base: 0.3 } },
  { id: "rain",    label: "Rain",        emoji: "🌧️", color: "#5c6bc0",
    // A soft, rounded body (bandpass, not hissy highpass) plus gentle low-passed droplet taps.
    filter: "bandpass", freq: 1100, q: 0.5, gain: 0.05,
    crackle: { minMs: 70, maxMs: 260, gainPeak: 0.1, duration: 0.05, filterFreq: 2200 } },
  { id: "wind",    label: "Wind",        emoji: "🌬️", color: "#00bcd4",
    // Lowpass (not resonant bandpass) with cutoff and volume gusting together, like real gusts.
    filter: "lowpass", freq: 700, q: 0.7, gain: 0.16,
    lfoFreq: { rate: 0.09, depth: 400 }, flicker: { rate: 0.09, depth: 0.14 } },
  { id: "breeze",  label: "Soft Breeze", emoji: "🍃", color: "#66bb6a",
    filter: "bandpass", freq: 1000, q: 1.5, gain: 0.06, lfoFreq: { rate: 0.025, depth: 80 },
    burst: { kind: "twinkle", notes: [1046, 1175, 1318, 1568], duration: 1.9, gainPeak: 0.11, minMs: 4500, maxMs: 10000 } },
  { id: "fire",    label: "Campfire",    emoji: "🔥", color: "#ff8a50",
    // Gentle roar body with flicker, plus soft crackle for real fire texture at a natural volume.
    filter: "bandpass", freq: 650, q: 0.5, gain: 0.13, flicker: { rate: 0.4, depth: 0.04 },
    crackle: { minMs: 200, maxMs: 900, gainPeak: 0.26, duration: 0.05 } },
  { id: "trees",   label: "Trees",       emoji: "🌳", color: "#2e7d32",
    // Bright rustling-leaves texture: a slow cutoff drift for gusts through the canopy,
    // plus a faster, shallower flutter so it reads as many small leaves, not one big gust.
    filter: "bandpass", freq: 2000, q: 1.1, gain: 0.14,
    lfoFreq: { rate: 0.18, depth: 400 }, flicker: { rate: 0.9, depth: 0.05 } },
  { id: "birds",   label: "Birds",       emoji: "🐦", color: "#ffd54f",
    burst: { kind: "song", freqRange: [1600, 2600], duration: 0.12, gainPeak: 0.22, minMs: 700, maxMs: 2800 } },
  { id: "crickets",label: "Crickets",    emoji: "🦗", color: "#aed581",
    burst: { kind: "trill", freqRange: [4200, 4600], duration: 0.05, repeats: 3, gainPeak: 0.22, minMs: 200, maxMs: 500 } },
  { id: "chimes",  label: "Wind Chimes", emoji: "🎐", color: "#f48fb1",
    // A moderate, gentler register than before, and quieter so it doesn't jump out.
    burst: { kind: "chime", notes: [659, 784, 880, 1046, 1175], duration: 1.6, gainPeak: 0.22, minMs: 1800, maxMs: 5000 } },
  { id: "conga",   label: "Conga Drums", emoji: "🥁", color: "#ff7043",
    rhythm: { stepMs: 280, pattern: [1, 0, 0.6, 0, 1, 0.6, 0, 0] } },
];

// One shared noise buffer, reused (not cloned) by every looping/burst source.
// The loop point is crossfaded so it doesn't click every time it repeats.
function makeNoiseBuffer(ctx, seconds = 4) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const fadeSamples = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    const tailIndex = length - fadeSamples + i;
    const blended = data[i] * t + data[tailIndex] * (1 - t);
    data[i] = blended;
    data[tailIndex] = blended;
  }
  return buffer;
}
const noiseBuffer = makeNoiseBuffer(audioCtx);

// Sample-accurate LFO: an oscillator's output summed directly into an AudioParam.
function addLFO(ctx, param, rate, depth) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const depthGain = ctx.createGain();
  depthGain.gain.value = depth;
  lfo.connect(depthGain).connect(param);
  lfo.start();
  return lfo;
}

// A single short pitched note with its own attack/decay envelope; self-disconnects when done.
// freqPeak (optional) gives the note a natural rise-then-fall "kink" instead of a flat sweep.
function playTone(ctx, destination, { freq, freqPeak, freqTo, duration = 0.15, gainPeak = 0.3, wave = "sine", delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqPeak) osc.frequency.exponentialRampToValueAtTime(freqPeak, t0 + duration * 0.4);
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t0 + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.02, duration / 4));
  env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(env).connect(destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

// A single short noise pop (raindrop tap / ember crackle); self-disconnects when done.
// An optional lowpass (filterFreq) rounds off the transient for soft droplets vs. bright fire snaps.
function playNoisePop(ctx, destination, { gainPeak = 0.5, duration = 0.04, filterFreq } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const offset = Math.random() * (noiseBuffer.duration - duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, ctx.currentTime);
  env.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  let filter = null;
  let tail = src;
  if (filterFreq) {
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    src.connect(filter);
    tail = filter;
  }
  tail.connect(env).connect(destination);
  src.start(ctx.currentTime, offset, duration);
  src.onended = () => { src.disconnect(); if (filter) filter.disconnect(); env.disconnect(); };
}

// A hand-drum hit: a bright noise "slap" transient plus a higher-pitched tonal body
// (real congas are tuned much higher than a bass drum, so this reproduces on small speakers).
function playConga(ctx, destination, gainPeak) {
  const t0 = ctx.currentTime;

  const slap = ctx.createBufferSource();
  slap.buffer = noiseBuffer;
  const slapOffset = Math.random() * (noiseBuffer.duration - 0.03);
  const slapFilter = ctx.createBiquadFilter();
  slapFilter.type = "highpass";
  slapFilter.frequency.value = 1500;
  const slapEnv = ctx.createGain();
  slapEnv.gain.setValueAtTime(gainPeak * 0.4, t0);
  slapEnv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.025);
  slap.connect(slapFilter).connect(slapEnv).connect(destination);
  slap.start(t0, slapOffset, 0.03);
  slap.onended = () => { slap.disconnect(); slapFilter.disconnect(); slapEnv.disconnect(); };

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320, t0);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.1);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gainPeak * 0.8, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  osc.connect(env).connect(destination);
  osc.start(t0);
  osc.stop(t0 + 0.24);
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

// A soft, dreamy twinkle: pure sine tone with a slow fade-in (no plucked "bell" attack)
// and gentle vibrato, for a warm music-box/Ghibli feel rather than a metallic chime.
function playTwinkle(ctx, destination, { freq, duration = 1.8, gainPeak = 0.12 } = {}) {
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 4.5;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = freq * 0.004;
  vibrato.connect(vibratoDepth).connect(osc.frequency);
  vibrato.start(t0);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gainPeak, t0 + duration * 0.35);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(env).connect(destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
  vibrato.stop(t0 + duration + 0.05);
  osc.onended = () => { osc.disconnect(); env.disconnect(); vibrato.disconnect(); vibratoDepth.disconnect(); };
}

// Random-interval event scheduler shared by every non-continuous sound.
function scheduleBurst(ctx, destination, cfg) {
  let timeoutId;
  const fire = () => {
    if (cfg.kind === "pop") {
      // Vary the intensity a little so a run of taps/crackle doesn't sound mechanical.
      const jitter = 0.55 + Math.random() * 0.9;
      playNoisePop(ctx, destination, { gainPeak: cfg.gainPeak * jitter, duration: cfg.duration, filterFreq: cfg.filterFreq });
    } else if (cfg.kind === "twinkle") {
      const freq = cfg.notes[Math.floor(Math.random() * cfg.notes.length)];
      playTwinkle(ctx, destination, { freq, duration: cfg.duration, gainPeak: cfg.gainPeak });
    } else if (cfg.kind === "chime") {
      // Soft, warm bell: fundamental plus quiet, purely consonant overtones (octave + fifth).
      // No detuning between tones - that beating reads as dissonant/eerie, not gentle.
      const freq = cfg.notes[Math.floor(Math.random() * cfg.notes.length)];
      playTone(ctx, destination, { freq, duration: cfg.duration, gainPeak: cfg.gainPeak, wave: "sine" });
      playTone(ctx, destination, { freq: freq * 2, duration: cfg.duration * 0.6, gainPeak: cfg.gainPeak * 0.3, wave: "sine" });
      playTone(ctx, destination, { freq: freq * 3, duration: cfg.duration * 0.35, gainPeak: cfg.gainPeak * 0.15, wave: "sine" });
    } else if (cfg.kind === "trill") {
      for (let i = 0; i < cfg.repeats; i++) {
        const freq = cfg.freqRange[0] + Math.random() * (cfg.freqRange[1] - cfg.freqRange[0]);
        playTone(ctx, destination, { freq, duration: cfg.duration, gainPeak: cfg.gainPeak, wave: "square", delay: i * 0.06 });
      }
    } else if (cfg.kind === "song") {
      // A short "tweet-tweet" phrase: 2-3 notes, each with a natural rise-then-fall kink.
      const noteCount = 2 + Math.floor(Math.random() * 2);
      let t = 0;
      for (let i = 0; i < noteCount; i++) {
        const freq = cfg.freqRange[0] + Math.random() * (cfg.freqRange[1] - cfg.freqRange[0]);
        playTone(ctx, destination, {
          freq, freqPeak: freq * 1.25, freqTo: freq * 0.85,
          duration: cfg.duration, gainPeak: cfg.gainPeak, wave: "sine", delay: t,
        });
        t += cfg.duration + 0.04 + Math.random() * 0.05;
      }
    }
    timeoutId = setTimeout(fire, cfg.minMs + Math.random() * (cfg.maxMs - cfg.minMs));
  };
  timeoutId = setTimeout(fire, cfg.minMs + Math.random() * (cfg.maxMs - cfg.minMs));
  return () => clearTimeout(timeoutId);
}

// Fixed-tempo pattern scheduler for conga drums.
function scheduleRhythm(ctx, destination, cfg) {
  let step = 0;
  const intervalId = setInterval(() => {
    const gainPeak = cfg.pattern[step % cfg.pattern.length];
    step++;
    if (!gainPeak) return;
    playConga(ctx, destination, gainPeak);
  }, cfg.stepMs);
  return () => clearInterval(intervalId);
}

function startSound(config) {
  const padGain = audioCtx.createGain();
  padGain.gain.setValueAtTime(0, audioCtx.currentTime);
  padGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.6);
  padGain.connect(masterCompressor);

  const stopFns = [];

  if (config.filter) {
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = config.filter;
    filter.frequency.value = config.freq;
    filter.Q.value = config.q;

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = config.swell ? config.swell.base : (config.gain || 0.3);

    source.connect(filter).connect(voiceGain).connect(padGain);
    source.start();

    let lfo = null;
    let flickerLfo = null;
    if (config.swell) lfo = addLFO(audioCtx, voiceGain.gain, config.swell.rate, config.swell.depth);
    else if (config.lfoFreq) lfo = addLFO(audioCtx, filter.frequency, config.lfoFreq.rate, config.lfoFreq.depth);
    if (config.flicker) flickerLfo = addLFO(audioCtx, voiceGain.gain, config.flicker.rate, config.flicker.depth);

    stopFns.push(() => {
      source.stop();
      source.disconnect();
      filter.disconnect();
      voiceGain.disconnect();
      if (lfo) lfo.stop();
      if (flickerLfo) flickerLfo.stop();
    });
  }

  if (config.crackle) {
    stopFns.push(scheduleBurst(audioCtx, padGain, { kind: "pop", ...config.crackle }));
  }

  if (config.burst) {
    stopFns.push(scheduleBurst(audioCtx, padGain, config.burst));
  }

  if (config.rhythm) {
    stopFns.push(scheduleRhythm(audioCtx, padGain, config.rhythm));
  }

  return { padGain, stopFns };
}

function stopSound({ padGain, stopFns }) {
  padGain.gain.cancelScheduledValues(audioCtx.currentTime);
  padGain.gain.setValueAtTime(padGain.gain.value, audioCtx.currentTime);
  padGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
  stopFns.forEach((stop) => stop());
  setTimeout(() => padGain.disconnect(), 650);
}

// Procedurally draw the wave horizon (3 parallax layers), no image assets.
const SVG_NS = "http://www.w3.org/2000/svg";
const WAVE_LAYERS = [
  { period: 220, amplitude: 10, baseline: 55 },
  { period: 260, amplitude: 16, baseline: 65 },
  { period: 180, amplitude: 22, baseline: 78 },
];

function buildWavePath(period, amplitude, baseline, periods = 24) {
  const half = period / 2;
  let d = `M0,${baseline}`;
  for (let i = 0; i < periods; i++) {
    d += ` q${half / 2},${-amplitude} ${half},0 q${half / 2},${amplitude} ${half},0`;
  }
  const width = period * periods;
  d += ` L${width},100 L0,100 Z`;
  return { d, width };
}

document.querySelectorAll(".wave-row").forEach((row, i) => {
  const { period, amplitude, baseline } = WAVE_LAYERS[i];
  const { d, width } = buildWavePath(period, amplitude, baseline);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} 100`);
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  row.appendChild(svg);
});

// Ocean / Wind toggled on: the wave horizon grows taller, faster, brighter.
const WAVE_INTENSITY_IDS = ["ocean", "wind"];

// Each sound gets its own glow, positioned under its own pad rather than one shared blob.
const glowLayer = document.getElementById("glow-layer");
const glowEls = new Map();
const padButtons = new Map();

function layoutGlows() {
  SOUNDS.forEach((config) => {
    const btn = padButtons.get(config.id);
    const glow = glowEls.get(config.id);
    if (!btn || !glow) return;
    const rect = btn.getBoundingClientRect();
    const leftPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
    glow.style.left = `${leftPct}%`;
  });
}

function createPadButton(config) {
  const btn = document.createElement("button");
  btn.className = "pad";
  btn.style.setProperty("--pad-color", config.color);
  btn.innerHTML = `<span class="emoji">${config.emoji}</span><span class="label">${config.label}</span>`;

  const glow = document.createElement("div");
  glow.className = "sound-glow";
  glow.style.setProperty("--glow-color", config.color);
  glowLayer.appendChild(glow);
  glowEls.set(config.id, glow);
  padButtons.set(config.id, btn);

  btn.addEventListener("click", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();

    if (active.has(config.id)) {
      stopSound(active.get(config.id));
      active.delete(config.id);
      btn.classList.remove("active");
    } else {
      active.set(config.id, startSound(config));
      btn.classList.add("active");
    }
    glow.classList.toggle("active", active.has(config.id));
    document.body.classList.toggle("waves-active", WAVE_INTENSITY_IDS.some((id) => active.has(id)));
  });

  return btn;
}

const active = new Map();
const grid = document.getElementById("grid");

// Pyramid layout: rows of 1, 2, 3, 4 pads.
const ROW_SIZES = [1, 2, 3, 4];
let cursor = 0;
ROW_SIZES.forEach((size) => {
  const row = document.createElement("div");
  row.className = "pyramid-row";
  SOUNDS.slice(cursor, cursor + size).forEach((config) => row.appendChild(createPadButton(config)));
  cursor += size;
  grid.appendChild(row);
});

layoutGlows();
window.addEventListener("resize", layoutGlows);
