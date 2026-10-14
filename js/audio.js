/* =========================================================
   audio.js — Web Audio API synthesizer
   Retro sound effects + a tiny step sequencer for chiptunes.
   Zero external audio files.
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'spd.muted';
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { /* storage blocked */ }

  // ---------- Context bootstrap (must follow a user gesture) ----------
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        console.warn('[audio] AudioContext unavailable:', e);
        return null;
      }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      // Gentle compression keeps stacked SFX from clipping.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.22;
      musicBus.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // ---------- Primitive voices ----------
  function tone(opts) {
    const c = ensure();
    if (!c) return;
    const {
      type = 'square', freq = 440, freqEnd = null, dur = 0.12, vol = 0.25,
      delay = 0, attack = 0.004, bus = sfxBus, vibrato = 0, when = null,
    } = opts;
    const t0 = (when != null ? when : c.currentTime) + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    if (vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(opts) {
    const c = ensure();
    if (!c) return;
    const { dur = 0.15, vol = 0.3, delay = 0, filter = 'lowpass', freq = 2000, freqEnd = null, bus = sfxBus, when = null } = opts;
    const t0 = (when != null ? when : c.currentTime) + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  function arp(notes, step, opts = {}) {
    notes.forEach((n, i) => {
      if (n) tone({ type: opts.type || 'square', freq: noteFreq(n), dur: opts.dur || step * 1.1, vol: opts.vol || 0.2, delay: i * step });
    });
  }

  // ---------- Note helpers ----------
  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function noteFreq(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);
    if (!m) return 0;
    let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    s += (parseInt(m[3], 10) - 4) * 12;
    return 440 * Math.pow(2, s / 12);
  }

  // ---------- Sound effect library ----------
  const SFX = {
    jump() { tone({ type: 'square', freq: 260, freqEnd: 720, dur: 0.16, vol: 0.16 }); },
    bigJump() { tone({ type: 'square', freq: 200, freqEnd: 900, dur: 0.22, vol: 0.16 }); },
    coin() {
      tone({ type: 'square', freq: 988, dur: 0.07, vol: 0.18 });
      tone({ type: 'square', freq: 1319, dur: 0.28, vol: 0.18, delay: 0.07 });
    },
    stomp() {
      tone({ type: 'square', freq: 520, freqEnd: 120, dur: 0.12, vol: 0.22 });
      noise({ dur: 0.08, vol: 0.2, freq: 1200 });
    },
    bump() { tone({ type: 'triangle', freq: 160, freqEnd: 90, dur: 0.1, vol: 0.35 }); },
    brick() {
      noise({ dur: 0.25, vol: 0.35, freq: 3000, freqEnd: 300 });
      tone({ type: 'square', freq: 220, freqEnd: 60, dur: 0.18, vol: 0.12 });
    },
    hurt() {
      tone({ type: 'sawtooth', freq: 600, freqEnd: 150, dur: 0.3, vol: 0.18 });
      tone({ type: 'square', freq: 300, freqEnd: 80, dur: 0.3, vol: 0.1, delay: 0.05 });
    },
    die() { arp(['B4', 'F5', null, 'F5', 'F5', 'E5', 'D5', 'C5'], 0.11, { dur: 0.1, vol: 0.18 }); },
    oneUp() { arp(['E5', 'G5', 'E6', 'C6', 'D6', 'G6'], 0.08, { vol: 0.16 }); },
    checkpoint() { arp(['C5', 'E5', 'G5', 'C6'], 0.07, { type: 'triangle', vol: 0.3 }); },
    select() { tone({ type: 'square', freq: 880, dur: 0.05, vol: 0.1 }); },
    confirm() { arp(['C6', 'G6'], 0.05, { vol: 0.12 }); },
    pause() { arp(['E6', 'C6', 'E6', 'C6'], 0.06, { vol: 0.12 }); },
    fireball() { noise({ dur: 0.2, vol: 0.2, filter: 'bandpass', freq: 800, freqEnd: 2400 }); },
    barrel() { tone({ type: 'triangle', freq: 110, freqEnd: 70, dur: 0.12, vol: 0.3 }); },
    crumble() { noise({ dur: 0.35, vol: 0.25, freq: 900, freqEnd: 120 }); },
    drip() { tone({ type: 'sine', freq: 1400, freqEnd: 500, dur: 0.12, vol: 0.18 }); },
    wind() { noise({ dur: 1.2, vol: 0.12, filter: 'bandpass', freq: 400, freqEnd: 1400 }); },
    lava() { noise({ dur: 0.5, vol: 0.12, freq: 300, freqEnd: 100 }); },
    flag() {
      tone({ type: 'square', freq: 300, freqEnd: 1200, dur: 0.6, vol: 0.12 });
    },
    bossHit() {
      tone({ type: 'sawtooth', freq: 180, freqEnd: 40, dur: 0.45, vol: 0.3 });
      noise({ dur: 0.3, vol: 0.35, freq: 1500, freqEnd: 100 });
    },
    bossRoar() {
      tone({ type: 'sawtooth', freq: 90, freqEnd: 55, dur: 0.9, vol: 0.28, vibrato: 12 });
      noise({ dur: 0.9, vol: 0.18, freq: 600, freqEnd: 150 });
    },
    shockwave() {
      tone({ type: 'triangle', freq: 70, freqEnd: 35, dur: 0.5, vol: 0.5 });
      noise({ dur: 0.4, vol: 0.3, freq: 500, freqEnd: 60 });
    },
    explosion() { noise({ dur: 0.6, vol: 0.4, freq: 1800, freqEnd: 60 }); },
    levelClear() {
      arp(['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', null, 'E6', null, 'G6'], 0.09, { vol: 0.16 });
      arp(['C3', null, 'G3', null, 'C4', null, 'E4', null, 'G4', null, 'C5'], 0.09, { type: 'triangle', vol: 0.3 });
    },
    gameOver() {
      arp(['C5', null, 'G4', null, 'E4', 'A4', 'B4', 'A4', 'G#4', 'A#4', 'G#4', 'G4', null, 'F4', 'G4'], 0.13, { type: 'triangle', vol: 0.35 });
    },
    victory() {
      const mel = ['C5', 'C5', 'C5', 'C5', 'G#4', 'A#4', 'C5', null, 'A#4', 'C5', null, null, 'G5', 'E5', 'C6', null];
      arp(mel, 0.12, { vol: 0.18 });
      arp(['C3', null, 'G3', null, 'G#2', null, 'D#3', null, 'A#2', null, 'F3', null, 'C3', 'G3', 'C4', null], 0.12, { type: 'triangle', vol: 0.32 });
    },
    firework() {
      noise({ dur: 0.5, vol: 0.25, freq: 3000, freqEnd: 200 });
      tone({ type: 'sine', freq: 1200 + Math.random() * 800, freqEnd: 300, dur: 0.4, vol: 0.06 });
    },
  };

  // ---------- Music sequencer ----------
  // Each track is a string of 8th-note steps: a note name, "-" for rest, "~" to hold.
  const SONGS = {
    title: {
      bpm: 140, drums: true,
      lead: 'G4 B4 D5 G5 ~ D5 B4 D5 E5 ~ C5 ~ A4 ~ - - F#4 A4 D5 F#5 ~ D5 A4 D5 G5 ~ ~ ~ - - - -',
      bass: 'G2 - D3 - G2 - D3 - C3 - G3 - C3 - G3 - D3 - A3 - D3 - A3 - G2 - D3 - G2 - - -',
    },
    overworld: {
      bpm: 150, drums: true,
      lead: 'C5 E5 G5 E5 A5 G5 E5 ~ F5 A5 C6 A5 G5 ~ - - E5 G5 C6 G5 A5 F5 D5 ~ G5 F5 E5 D5 C5 ~ - -',
      bass: 'C3 - G3 - C3 - G3 - F3 - C4 - F3 - C4 - C3 - G3 - A2 - E3 - G2 - D3 - C3 - G2 -',
    },
    cave: {
      bpm: 112, drums: false, leadType: 'triangle',
      lead: 'A4 - C5 - E5 - D5 C5 B4 - - - G4 - - - A4 - C5 - E5 - G5 F5 E5 - - - - - - -',
      bass: 'A2 ~ ~ ~ E3 ~ ~ ~ G2 ~ ~ ~ D3 ~ ~ ~ F2 ~ ~ ~ C3 ~ ~ ~ E2 ~ ~ ~ E3 ~ ~ ~',
    },
    sky: {
      bpm: 132, drums: true,
      lead: 'F5 A5 C6 ~ A5 ~ G5 F5 G5 ~ E5 ~ C5 ~ - - D5 F5 A5 ~ G5 ~ F5 E5 F5 ~ ~ ~ - - - -',
      bass: 'F3 - C4 - F3 - C4 - C3 - G3 - C3 - G3 - Bb2 - F3 - Bb2 - F3 - C3 - G3 - F3 - - -',
    },
    lava: {
      bpm: 160, drums: true, leadType: 'sawtooth',
      lead: 'D5 D5 F5 D5 Eb5 D5 C5 D5 D5 D5 F5 G5 A5 G5 F5 Eb5 D5 D5 F5 D5 Eb5 D5 C5 Bb4 A4 ~ C5 ~ D5 ~ - -',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 Bb1 Bb2 Bb1 Bb2 C2 C3 C2 C3 D2 D3 D2 D3 D2 D3 D2 D3 A1 A2 A1 A2 D2 - D2 -',
    },
    boss: {
      bpm: 176, drums: true, leadType: 'sawtooth',
      lead: 'E5 - E5 G5 - E5 F#5 G5 B5 - A5 - G5 - F#5 - E5 - E5 G5 - E5 F#5 G5 A5 G5 F#5 D5 E5 ~ - -',
      bass: 'E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 D2 D2 D3 D2 E2 E2 E3 E2 E2 E3 E2 E3 C2 C3 D2 D3 E2 E3 E2 -',
    },
  };

  function parseTrack(str) {
    const tokens = str.trim().split(/\s+/);
    const events = [];
    tokens.forEach((tok, i) => {
      if (tok === '~') {
        if (events.length) events[events.length - 1].len++;
      } else if (tok !== '-') {
        events.push({ step: i, note: tok, len: 1 });
      }
    });
    return { events, length: tokens.length };
  }

  const music = { name: null, timer: null, nextTime: 0, step: 0, parsed: null };

  function playMusic(name) {
    if (music.name === name) return;
    stopMusic();
    const song = SONGS[name];
    const c = ensure();
    if (!song || !c) return;
    music.name = name;
    music.parsed = { lead: parseTrack(song.lead), bass: parseTrack(song.bass), song };
    music.step = 0;
    music.nextTime = c.currentTime + 0.08;
    music.timer = setInterval(scheduler, 25);
  }

  function stopMusic() {
    if (music.timer) clearInterval(music.timer);
    music.timer = null;
    music.name = null;
  }

  // Look-ahead scheduler: queue notes ~120ms ahead so timing stays tight.
  function scheduler() {
    if (!ctx || !music.parsed) return;
    const { lead, bass, song } = music.parsed;
    const stepDur = 60 / song.bpm / 2;
    const len = lead.length;
    while (music.nextTime < ctx.currentTime + 0.12) {
      const s = music.step % len;
      const t = music.nextTime;
      for (const ev of lead.events) {
        if (ev.step === s) tone({ type: song.leadType || 'square', freq: noteFreq(ev.note), dur: stepDur * ev.len * 0.95, vol: 0.13, when: t, bus: musicBus, attack: 0.01 });
      }
      for (const ev of bass.events) {
        if (ev.step === s) tone({ type: 'triangle', freq: noteFreq(ev.note), dur: stepDur * ev.len * 0.9, vol: 0.4, when: t, bus: musicBus, attack: 0.01 });
      }
      if (song.drums) {
        if (s % 4 === 0) tone({ type: 'sine', freq: 150, freqEnd: 40, dur: 0.12, vol: 0.5, when: t, bus: musicBus });
        if (s % 8 === 4) noise({ dur: 0.1, vol: 0.25, freq: 1800, when: t, bus: musicBus });
        if (s % 2 === 1) noise({ dur: 0.03, vol: 0.08, filter: 'highpass', freq: 7000, when: t, bus: musicBus });
      }
      music.nextTime += stepDur;
      music.step++;
    }
  }

  // ---------- Public API ----------
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
  }

  window.Sound = {
    unlock: ensure,
    play(name) {
      if (muted) return;
      const fn = SFX[name];
      if (!fn) return;
      try { fn(); } catch (e) { console.warn('[audio] sfx failed:', name, e); }
    },
    music(name) { try { playMusic(name); } catch (e) { console.warn('[audio] music failed:', e); } },
    stopMusic,
    isMuted: () => muted,
    setMuted,
    toggleMute() { setMuted(!muted); return muted; },
    // Pause/resume the whole audio graph (used when the tab is hidden).
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    duckMusic(on) {
      if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? 0.06 : 0.22, ctx.currentTime, 0.05);
    },
  };
})();
