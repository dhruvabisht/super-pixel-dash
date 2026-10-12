/* =========================================================
   game.js — main loop, input, physics, collisions, rendering,
   particles, run/score bookkeeping and UI glue.
   Depends on: audio.js (Sound), levels.js (Levels),
               firebase.js (Leaderboard)
   ========================================================= */
(function () {
  'use strict';

  const L = window.Levels;
  const Sound = window.Sound || { play() {}, music() {}, stopMusic() {}, unlock() {}, isMuted: () => true, toggleMute: () => true, duckMusic() {} };
  const Board = window.Leaderboard;
  if (!L) { document.body.innerHTML = '<p style="color:#fff;padding:20px">Failed to load level data.</p>'; return; }

  const { TILE, ROWS, T, SOLID } = L;
  const VIEW_W = 384;
  const VIEW_H = 224;
  const STEP_MS = 1000 / 60;

  // Arcade physics (units: pixels / frame at 60 fps)
  const PHYS = {
    gravity: 0.38, maxFall: 7,
    accel: 0.16, airAccel: 0.12, friction: 0.2, turnBoost: 2.2,
    walk: 2.4, run: 3.3,
    jumpV: -6.6, jumpCut: -2.6,
    coyote: 6, buffer: 7,
    stomp: -5, stompHeld: -7.2,
  };
  const START_LIVES = 3;
  const MAX_HP = 3;
  const COINS_PER_LIFE = 50;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // ---------- Utilities ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const levelScore = (coins, secs) => coins * 500 + Math.max(0, 10000 - secs * 50);

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full / blocked */ } },
  };

  function loadProgress() {
    const p = store.get('spd.progress', null);
    const out = { unlocked: 1, best: {} };
    if (p && typeof p === 'object') {
      out.unlocked = clamp(parseInt(p.unlocked, 10) || 1, 1, L.LEVELS.length);
      if (p.best && typeof p.best === 'object') out.best = p.best;
    }
    return out;
  }
  let progress = loadProgress();
  const settings = Object.assign({ crt: true }, store.get('spd.settings', {}));

  // =========================================================
  // SPRITES — pixel-string art rendered once into cached canvases
  // with an automatic dark outline.
  // =========================================================
  const PLAYER_PAL = {
    R: '#e83b3b', W: '#ffffff', S: '#ffcf9e', K: '#3b1f0e', B: '#3a5bd9', Y: '#ffd23f', N: '#6b3a1a',
  };
  const HEAD = [
    '................',
    '.....RRRRR......',
    '....RRRRRRRR....',
    '....RRWWRRRRRRR.',
    '....KKKSSSSS....',
    '...KKSSSSKSS....',
    '...KSSSSSKSSS...',
    '....SSSSSSSSS...',
    '.....SSSKKK.....',
  ];
  const PLAYER_ART = {
    idle: HEAD.concat([
      '....RRBRRRBR....',
      '...RRRBRRRBRR...',
      '...SSBBYBYBBSS..',
      '...SSBBBBBBBSS..',
      '.....BBB.BBB....',
      '....NNNN.NNNN...',
      '....NNNN.NNNN...',
    ]),
    run1: HEAD.concat([
      '...SRRBRRRBR....',
      '..SSRRBRRRBRR...',
      '....BBBYBYBBSS..',
      '....BBBBBBBBS...',
      '....BBB..BBB....',
      '...NNN.....NNN..',
      '..NNN.......NN..',
    ]),
    run2: HEAD.concat([
      '....RRBRRRBR....',
      '...RRRBRRRBRS...',
      '...SSBBYBYBBS...',
      '....SBBBBBBB....',
      '.....BBBBBB.....',
      '......NNNN......',
      '.....NNNNN......',
    ]),
    jump: HEAD.concat([
      '..SRRBRRRBRRS...',
      '..SRRRBRRRBRRS..',
      '....BBYBYBB.....',
      '....BBBBBBBB....',
      '...BBB...BBB....',
      '..NNN.....NNNN..',
      '..NN............',
    ]),
    crouch: [
      '................',
      '................',
      '................',
      '................',
      '.....RRRRR......',
      '....RRRRRRRR....',
      '....RRWWRRRRRRR.',
      '....KKKSSSSS....',
      '...KKSSSSKSS....',
      '...KSSSSSKSSS...',
      '....SSSSSSSSS...',
      '...SRRBRRRBRS...',
      '...SBBBYBYBBBS..',
      '...BBBBBBBBBB...',
      '...NNNN..NNNN...',
      '...NNNN..NNNN...',
    ],
  };
  const PLAYER_FRAMES = ['idle', 'run1', 'run2', 'jump', 'crouch'];
  const OUTLINE = '#120a1e';

  const spriteCache = new Map();
  const paletteIds = new WeakMap();
  let paletteCounter = 0;
  function paletteId(p) {
    if (!paletteIds.has(p)) paletteIds.set(p, ++paletteCounter);
    return paletteIds.get(p);
  }

  function buildSprite(rows, pal, scale, flash) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = (w + 2) * scale;
    c.height = (h + 2) * scale;
    const g = c.getContext('2d');
    const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.';
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        let color = null;
        if (filled(x, y)) {
          color = flash ? '#ffffff' : (pal[rows[y][x]] || '#ff00ff');
        } else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          color = flash ? '#ffffff' : OUTLINE;
        }
        if (color) {
          g.fillStyle = color;
          g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
        }
      }
    }
    return c;
  }

  function getSprite(name, frame, pal, scale, flash) {
    const key = name + '|' + frame + '|' + paletteId(pal) + '|' + scale + '|' + (flash ? 1 : 0);
    let c = spriteCache.get(key);
    if (!c) {
      const rows = name === 'player' ? PLAYER_ART[PLAYER_FRAMES[frame]] : (L.ART[name] && L.ART[name][frame]);
      if (!rows) return null;
      c = buildSprite(rows, pal, scale, flash);
      spriteCache.set(key, c);
    }
    return c;
  }

  // Draws a sprite with its top-left art pixel at (x, y) in screen space.
  function drawSprite(name, frame, x, y, opts) {
    const o = opts || {};
    const s = o.scale || 1;
    const pal = o.palette || (L.DEFAULT_PALETTES && L.DEFAULT_PALETTES[name]) || PLAYER_PAL;
    const c = getSprite(name, frame, pal, s, o.flash);
    if (!c) return;
    const dx = Math.round(x) - s, dy = Math.round(y) - s;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.flip || o.flipY) {
      ctx.save();
      ctx.translate(dx + (o.flip ? c.width : 0), dy + (o.flipY ? c.height : 0));
      ctx.scale(o.flip ? -1 : 1, o.flipY ? -1 : 1);
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(c, dx, dy);
    }
    if (o.alpha != null) ctx.globalAlpha = 1;
  }

  function drawCoin(x, y, t) {
    const phase = Math.floor(t / 8) % 4;
    const widths = [8, 6, 2, 6];
    const w = widths[phase];
    const cx = Math.round(x + 8 - w / 2);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(cx, y + 2, w, 12);
    ctx.fillRect(cx - 1, y + 4, w + 2, 8);
    if (w > 2) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(cx + 1, y + 3, w - 2, 10);
      ctx.fillStyle = '#fff6b0';
      ctx.fillRect(cx + 1, y + 4, 1, 6);
      if (w >= 6) { ctx.fillStyle = '#d9a400'; ctx.fillRect(cx + w / 2 - 1, y + 5, 2, 6); }
    }
  }

  function drawFireball(cx, cy, r, flipped) {
    const flick = (G.frame >> 2) & 1;
    ctx.fillStyle = '#b81e00';
    ctx.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 2);
    ctx.fillRect(cx - r + 1, cy - r, r * 2 - 2, r * 2);
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(cx - r + 1, cy - r + 1, r * 2 - 2, r * 2 - 2);
    ctx.fillStyle = '#ffd23f';
    const ir = Math.max(1, r - 2);
    ctx.fillRect(cx - ir + flick, cy - ir + (flipped ? 1 : 0), ir * 2 - 1, ir * 2 - 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  // =========================================================
  // PARTICLES
  // =========================================================
  const particles = [];
  function burst(x, y, opts) {
    const o = opts || {};
    const n = o.count || 8;
    const colors = o.colors || ['#ffffff'];
    const sp = o.speed || 2;
    for (let i = 0; i < n && particles.length < 700; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
      const v = sp * (0.35 + Math.random() * 0.65);
      const life = (o.life || 30) * (0.6 + Math.random() * 0.4);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: o.gravity != null ? o.gravity : 0.12, life, max: life,
        size: o.size || 2, color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g; p.x += p.vx; p.y += p.vy;
      if (--p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles(camX, camY) {
    for (const p of particles) {
      ctx.globalAlpha = p.life < 10 ? p.life / 10 : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX - p.size / 2), Math.round(p.y - camY - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // =========================================================
  // INPUT — keyboard, touch buttons, gamepad
  // =========================================================
  const input = { left: false, right: false, up: false, down: false, jump: false, run: false };
  const touchState = { left: false, right: false, down: false, jump: false, run: false };
  let jumpPressedEdge = false;
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
  };
  const keyState = {};

  function syncInput() {
    let pad = null;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) { pad = p; break; }
    } catch (e) { pad = null; }
    const ax = pad ? pad.axes[0] || 0 : 0;
    const pb = (i) => !!(pad && pad.buttons[i] && pad.buttons[i].pressed);
    const prevJump = input.jump;
    input.left = !!keyState.left || touchState.left || ax < -0.4 || pb(14);
    input.right = !!keyState.right || touchState.right || ax > 0.4 || pb(15);
    input.down = !!keyState.down || touchState.down || (pad ? (pad.axes[1] || 0) > 0.5 : false) || pb(13);
    input.jump = !!keyState.jump || touchState.jump || pb(0) || pb(12);
    input.run = !!keyState.run || touchState.run || pb(2) || pb(1);
    if (input.jump && !prevJump) jumpPressedEdge = true;
    if (pad) {
      const start = pb(9);
      if (start && !syncInput.prevStart) togglePause();
      syncInput.prevStart = start;
    }
  }

  window.addEventListener('keydown', (ev) => {
    Sound.unlock();
    const action = KEYMAP[ev.code];
    const typing = ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA');
    if (typing) {
      if (ev.code === 'Enter') ev.target.blur();
      return;
    }
    if (action) {
      keyState[action] = true;
      if (G.state === 'play' || G.state === 'intro') ev.preventDefault();
    }
    if (ev.repeat) return;
    if (ev.code === 'KeyP' || ev.code === 'Escape') {
      if (G.state === 'play' || G.state === 'pause') { ev.preventDefault(); togglePause(); }
      else if (ev.code === 'Escape') ui.back();
    } else if (ev.code === 'KeyM') {
      ui.toggleMute();
    } else if (ev.code === 'Enter' && G.state === 'title' && ui.current === 'screen-title' && document.activeElement === document.body) {
      startRun(0);
    } else if ((ev.code === 'ArrowUp' || ev.code === 'ArrowDown') && G.state !== 'play') {
      ui.moveFocus(ev.code === 'ArrowDown' ? 1 : -1);
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', (ev) => {
    const action = KEYMAP[ev.code];
    if (action) keyState[action] = false;
  });
  window.addEventListener('blur', () => { for (const k in keyState) keyState[k] = false; });

  // =========================================================
  // TILESET — procedurally painted 16x16 tiles per theme
  // =========================================================
  const tilesetCache = {};
  function paintTile(fn) {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d');
    fn(g, (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    return c;
  }

  function buildTileset(key, th) {
    if (tilesetCache[key]) return tilesetCache[key];
    const ts = {};
    const dirt = (g, px, seed) => {
      px(0, 0, 16, 16, th.ground);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(hash(seed + i) * 14), y = Math.floor(hash(seed + i + 50) * 14);
        px(x, y, 2, 2, i % 2 ? th.speck : th.groundDark);
      }
      px(0, 15, 16, 1, th.groundDark);
    };
    ts.ground = paintTile((g, px) => dirt(g, px, 3));
    ts.groundTop = paintTile((g, px) => {
      dirt(g, px, 7);
      px(0, 0, 16, 5, th.groundTop);
      px(0, 5, 16, 1, th.groundTopDark);
      px(2, 5, 2, 2, th.groundTop); px(9, 5, 3, 2, th.groundTop); px(13, 5, 1, 3, th.groundTop);
      px(0, 0, 16, 1, th.groundTopDark);
      px(3, 1, 2, 1, '#ffffff33'); px(10, 2, 3, 1, '#ffffff33');
    });
    ts.brick = paintTile((g, px) => {
      px(0, 0, 16, 16, th.brickDark);
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? 4 : 0;
        for (let b = -1; b < 2; b++) {
          const bx = b * 8 + off;
          px(bx + 1, r * 4 + 1, 7, 3, th.brick);
          px(bx + 1, r * 4 + 1, 7, 1, th.brickLight);
        }
      }
    });
    ts.qblock = [0, 1, 2].map((f) => paintTile((g, px) => {
      px(0, 0, 16, 16, th.qblockDark);
      px(1, 1, 14, 14, th.qblock);
      px(1, 1, 14, 1, '#fff2a8');
      [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => px(x, y, 2, 2, th.qblockDark));
      const m = f === 1 ? '#ffffff' : f === 2 ? '#ffe680' : th.qmark;
      // "?" glyph with drop shadow
      [[5, 4, 6, 2], [9, 5, 2, 3], [7, 7, 3, 2], [7, 9, 2, 1], [7, 11, 2, 2]].forEach(([x, y, w, h]) => {
        px(x + 1, y + 1, w, h, th.qblockDark);
        px(x, y, w, h, m);
      });
      px(4, 5, 2, 2, m);
    }));
    ts.used = paintTile((g, px) => {
      px(0, 0, 16, 16, th.usedDark);
      px(1, 1, 14, 14, th.used);
      [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => px(x, y, 2, 2, th.usedDark));
    });
    ts.stone = paintTile((g, px) => {
      px(0, 0, 16, 16, th.blockDark);
      px(0, 0, 15, 15, th.blockLight);
      px(1, 1, 14, 14, th.block);
      px(3, 3, 10, 10, th.blockLight + '55');
      px(4, 4, 8, 8, th.block);
    });
    const pipeBody = (left, lip) => paintTile((g, px) => {
      px(0, 0, 16, 16, th.pipeDark);
      if (lip) {
        if (left) { px(1, 1, 15, 14, th.pipe); px(3, 1, 3, 14, th.pipeLight); px(7, 1, 1, 14, th.pipeLight); }
        else { px(0, 1, 15, 14, th.pipe); px(10, 1, 3, 14, th.pipeDark); }
      } else if (left) {
        px(2, 0, 14, 16, th.pipe); px(4, 0, 3, 16, th.pipeLight); px(8, 0, 1, 16, th.pipeLight);
      } else {
        px(0, 0, 14, 16, th.pipe); px(9, 0, 3, 16, th.pipeDark);
      }
    });
    ts.pipe = { lipL: pipeBody(true, true), lipR: pipeBody(false, true), bodyL: pipeBody(true, false), bodyR: pipeBody(false, false) };
    ts.spike = paintTile((g, px) => {
      px(0, 13, 16, 3, th.spikeDark);
      for (let s = 0; s < 2; s++) {
        const bx = s * 8;
        for (let i = 0; i < 4; i++) {
          px(bx + 3 - i, 3 + i * 3, 2 + i * 2, 3, th.spikeDark);
          px(bx + 3 - i, 3 + i * 3, 1 + i, 3, th.spike);
        }
        px(bx + 3, 1, 2, 2, '#ffffff');
      }
    });
    ts.semi = paintTile((g, px) => {
      if (th.semiStyle === 'cloud') {
        px(0, 2, 16, 7, th.semi);
        px(2, 0, 5, 3, th.semi); px(9, 1, 5, 2, th.semi);
        px(0, 8, 16, 2, th.semiDark);
        px(3, 1, 2, 1, '#ffffff');
      } else if (th.semiStyle === 'rock') {
        px(0, 0, 16, 7, th.semiDark);
        px(0, 0, 16, 5, th.semi);
        px(3, 5, 3, 3, th.semiDark); px(11, 5, 2, 4, th.semiDark);
        px(1, 1, 4, 1, '#ffffff44');
      } else if (th.semiStyle === 'stone') {
        px(0, 0, 16, 6, th.semiDark);
        px(0, 0, 15, 5, th.semi);
        px(1, 1, 13, 1, '#ffffff55');
      } else {
        px(0, 0, 16, 6, th.semiDark);
        px(0, 0, 16, 4, th.semi);
        px(0, 0, 16, 1, '#ffffff55');
        px(7, 0, 1, 6, th.semiDark);
        px(2, 6, 2, 3, th.semiDark); px(12, 6, 2, 3, th.semiDark);
      }
    });
    ts.crumble = paintTile((g, px) => {
      if (key === 'lava' || key === 'fortress') {
        px(0, 2, 16, 8, '#4a2410');
        px(0, 2, 16, 6, '#a0602a');
        for (let i = 0; i < 4; i++) px(i * 4, 2, 1, 6, '#4a2410');
        px(0, 0, 16, 1, '#c8c8d8'); px(0, 10, 16, 1, '#c8c8d8');
      } else {
        px(0, 0, 16, 16, th.blockDark);
        px(0, 0, 15, 15, th.block);
        px(4, 0, 1, 6, th.blockDark); px(5, 5, 4, 1, th.blockDark); px(9, 5, 1, 6, th.blockDark);
        px(10, 10, 4, 1, th.blockDark); px(2, 10, 1, 5, th.blockDark);
      }
    });
    ts.crystal = [th.crystalA || '#5cf2ff', th.crystalB || '#ff7eb6'].map((c) => paintTile((g, px) => {
      px(6, 0, 4, 2, c); px(5, 2, 6, 4, c); px(6, 6, 4, 3, c); px(7, 9, 2, 3, c);
      px(1, 0, 3, 2, c); px(2, 2, 2, 3, c);
      px(12, 0, 3, 2, c); px(12, 2, 2, 4, c);
      px(6, 2, 1, 5, '#ffffff'); px(2, 1, 1, 2, '#ffffff');
    }));
    tilesetCache[key] = ts;
    return ts;
  }

  function drawLavaTile(sx, sy, top) {
    const th = G.theme;
    ctx.fillStyle = th.lavaDark;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = th.lava;
    if (top) {
      for (let x = 0; x < TILE; x += 4) {
        const w = Math.round(Math.sin((sx + G.cam.x + x) * 0.1 + G.frame * 0.08) * 1.5);
        ctx.fillRect(sx + x, sy + 3 + w, 4, 13 - w);
      }
      ctx.fillStyle = th.lavaLight;
      ctx.fillRect(sx + ((G.frame >> 3) % 12), sy + 4, 3, 1);
    } else {
      ctx.fillRect(sx, sy, TILE, TILE);
      if (((G.frame >> 4) + sx) % 5 === 0) { ctx.fillStyle = th.lavaLight; ctx.fillRect(sx + 6, sy + 6, 2, 2); }
    }
  }

  function drawTiles(camX, camY, lights) {
    const ts = G.tileset;
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const x1 = Math.min(G.cols - 1, x0 + Math.ceil(VIEW_W / TILE) + 1);
    for (let ty = 0; ty < ROWS; ty++) {
      const row = G.grid[ty];
      for (let tx = x0; tx <= x1; tx++) {
        const t = row[tx];
        if (!t) continue;
        const key = tx + ',' + ty;
        let sx = tx * TILE - camX;
        let sy = ty * TILE - camY;
        const bump = G.bumps.get(key);
        if (bump) sy -= Math.round(Math.sin((bump / 12) * Math.PI) * 5);
        switch (t) {
          case T.GROUND: {
            const above = ty > 0 ? G.grid[ty - 1][tx] : 0;
            ctx.drawImage(above === T.GROUND ? ts.ground : ts.groundTop, sx, sy);
            break;
          }
          case T.BRICK: ctx.drawImage(ts.brick, sx, sy); break;
          case T.QBLOCK: ctx.drawImage(ts.qblock[[0, 0, 1, 2, 1, 0][(G.frame >> 3) % 6]], sx, sy); break;
          case T.USED: ctx.drawImage(ts.used, sx, sy); break;
          case T.STONE: ctx.drawImage(ts.stone, sx, sy); break;
          case T.PIPE: {
            let n = 0;
            while (tileAt(tx - 1 - n, ty) === T.PIPE) n++;
            const left = n % 2 === 0;
            const lip = tileAt(tx, ty - 1) !== T.PIPE;
            ctx.drawImage(ts.pipe[(lip ? 'lip' : 'body') + (left ? 'L' : 'R')], sx, sy);
            break;
          }
          case T.SPIKE: ctx.drawImage(ts.spike, sx, sy); break;
          case T.SEMI: ctx.drawImage(ts.semi, sx, sy); break;
          case T.CRUMBLE: {
            const c = G.crumbles.get(key);
            if (c && c.state === 'shake') sx += ((G.frame >> 1) & 1) ? 1 : -1;
            ctx.drawImage(ts.crumble, sx, sy);
            break;
          }
          case T.LAVA: drawLavaTile(sx, sy, tileAt(tx, ty - 1) !== T.LAVA); break;
          case T.COIN: drawCoin(sx, sy, G.frame + tx * 3); break;
          case T.CRYSTAL: {
            ctx.drawImage(ts.crystal[(tx + ty) % 2], sx, sy);
            if (lights) lights.push({ x: sx + 8, y: sy + 6, r: 34 });
            break;
          }
          default: break;
        }
      }
    }
  }

  // =========================================================
  // BACKGROUNDS — parallax layers painted procedurally
  // =========================================================
  const gradCache = {};
  function layer(camX, factor, spacing, fn) {
    const off = camX * factor;
    const first = Math.floor(off / spacing) - 1;
    const n = Math.ceil(VIEW_W / spacing) + 3;
    for (let i = first; i < first + n; i++) fn(Math.round(i * spacing - off), i, hash(i * 7.31 + factor * 13));
  }
  function hill(x, baseY, w, h, col) {
    ctx.fillStyle = col;
    for (let dx = 0; dx < w; dx += 2) {
      const k = (dx - w / 2) / (w / 2);
      const hh = Math.round(h * Math.sqrt(Math.max(0, 1 - k * k)));
      ctx.fillRect(x + dx, baseY - hh, 2, hh);
    }
  }
  function cloud(x, y, s, col, shade) {
    if (shade) { ctx.fillStyle = shade; ctx.fillRect(x + 2 * s, y + 7 * s, 20 * s, 3 * s); }
    ctx.fillStyle = col;
    ctx.fillRect(x, y + 4 * s, 24 * s, 5 * s);
    ctx.fillRect(x + 4 * s, y + 1 * s, 8 * s, 6 * s);
    ctx.fillRect(x + 10 * s, y, 9 * s, 7 * s);
    ctx.fillRect(x + 2 * s, y + 3 * s, 20 * s, 3 * s);
  }

  const BG = {
    hills(th, camX) {
      layer(camX, 0.12, 150, (x, i, h) => cloud(x + h * 40, 26 + Math.floor(h * 50), h > 0.5 ? 2 : 1, th.cloud, '#d8f2ff'));
      layer(camX, 0.3, 180, (x, i, h) => hill(x, 204, 160 + Math.floor(h * 60), 60 + Math.floor(h * 40), th.far));
      layer(camX, 0.55, 140, (x, i, h) => {
        hill(x, 204, 96 + Math.floor(h * 40), 30 + Math.floor(h * 26), th.near);
        ctx.fillStyle = '#2f8a36';
        ctx.fillRect(x + 30, 194 - Math.floor(h * 10), 3, 3);
        ctx.fillRect(x + 50, 190 - Math.floor(h * 12), 3, 3);
      });
      layer(camX, 0.8, 110, (x, i, h) => { if (h > 0.4) cloud(x + 20, 182, 1, '#2fae3a', '#23902d'); });
    },
    cave(th, camX) {
      layer(camX, 0.18, 70, (x, i, h) => {
        ctx.fillStyle = th.far;
        const len = 30 + Math.floor(h * 60);
        for (let k = 0; k < len; k += 6) ctx.fillRect(x + Math.floor(k / 5), 0 + k, Math.max(2, 22 - Math.floor(k / 3)), 6);
        const up = 20 + Math.floor(hash(i + 9) * 50);
        for (let k = 0; k < up; k += 6) ctx.fillRect(x + 30 + Math.floor(k / 5), VIEW_H - k - 6, Math.max(2, 26 - Math.floor(k / 2)), 6);
      });
      layer(camX, 0.42, 110, (x, i, h) => {
        ctx.fillStyle = th.near;
        const len = 20 + Math.floor(h * 40);
        for (let k = 0; k < len; k += 4) ctx.fillRect(x + Math.floor(k / 4), k, Math.max(2, 16 - Math.floor(k / 3)), 4);
      });
      layer(camX, 0.08, 46, (x, i, h) => {
        const a = 0.35 + 0.35 * Math.sin(G.frame * 0.05 + i);
        ctx.globalAlpha = a;
        ctx.fillStyle = h > 0.5 ? (th.crystalA || '#5cf2ff') : (th.crystalB || '#ff7eb6');
        ctx.fillRect(x + Math.floor(h * 30), 40 + Math.floor(hash(i + 3) * 130), 2, 2);
        ctx.globalAlpha = 1;
      });
    },
    sky(th, camX) {
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(300, 26, 34, 34);
      ctx.fillStyle = '#ffe680'; ctx.fillRect(304, 30, 26, 26);
      ctx.fillStyle = '#fff6c8'; ctx.fillRect(296, 34, 42, 18); ctx.fillRect(308, 22, 18, 42);
      ctx.globalAlpha = 0.7;
      layer(camX, 0.08, 120, (x, i, h) => cloud(x, 20 + Math.floor(h * 70), 1, '#ffffff'));
      ctx.globalAlpha = 1;
      layer(camX, 0.22, 64, (x, i, h) => { ctx.fillStyle = th.near; ctx.fillRect(x, 150 + Math.floor(h * 14), 66, 80); ctx.fillRect(x + 10, 142 + Math.floor(h * 14), 40, 10); });
      layer(camX, 0.4, 170, (x, i, h) => cloud(x + Math.floor(h * 60), 70 + Math.floor(h * 60), 2, '#ffffff', '#e8e0ff'));
      // Translucent mist far below: makes it clear that pits are bottomless.
      let mist = gradCache.skyMist;
      if (!mist) { mist = ctx.createLinearGradient(0, 170, 0, VIEW_H); mist.addColorStop(0, 'rgba(255,255,255,0)'); mist.addColorStop(1, 'rgba(190,170,255,0.55)'); gradCache.skyMist = mist; }
      ctx.fillStyle = mist;
      ctx.fillRect(0, 170, VIEW_W, VIEW_H - 170);
    },
    castle(th, camX) {
      let g = gradCache.lavaGlow;
      if (!g) { g = ctx.createLinearGradient(0, 120, 0, VIEW_H); g.addColorStop(0, 'rgba(255,90,31,0)'); g.addColorStop(1, 'rgba(255,90,31,0.45)'); gradCache.lavaGlow = g; }
      layer(camX, 0.2, 150, (x, i, h) => {
        ctx.fillStyle = th.far;
        const tw = 26 + Math.floor(h * 20), tht = 70 + Math.floor(h * 60);
        ctx.fillRect(x, VIEW_H - tht, tw, tht);
        for (let k = 0; k < tw; k += 8) ctx.fillRect(x + k, VIEW_H - tht - 6, 5, 6);
        ctx.fillRect(x + tw, VIEW_H - 50, 70, 50);
        ctx.fillStyle = (G.frame >> 4) % 3 === i % 3 ? '#ffb347' : '#ff8c1a';
        ctx.fillRect(x + 9, VIEW_H - tht + 16, 6, 9);
      });
      ctx.fillStyle = g; ctx.fillRect(0, 120, VIEW_W, VIEW_H - 120);
      layer(camX, 0.5, 120, (x, i, h) => {
        ctx.fillStyle = th.near; ctx.fillRect(x, 0, 18, VIEW_H);
        ctx.fillStyle = '#2a0808'; ctx.fillRect(x + 14, 0, 4, VIEW_H);
        if (h > 0.4) { ctx.fillStyle = '#a01818'; ctx.fillRect(x + 22, 36, 14, 34); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 27, 46, 4, 4); }
      });
    },
    fortress(th, camX) {
      const off = Math.floor(camX * 0.3);
      ctx.fillStyle = th.near;
      for (let y = 0; y < VIEW_H; y += 16) {
        const shift = ((y / 16) % 2) * 16;
        for (let x = -((off + shift) % 32) - 32; x < VIEW_W; x += 32) ctx.fillRect(x, y, 31, 15);
      }
      layer(camX, 0.3, 128, (x, i) => {
        ctx.fillStyle = '#120820'; ctx.fillRect(x + 40, 60, 24, 40); ctx.fillRect(x + 44, 54, 16, 6);
        ctx.fillStyle = (G.frame >> 3) % 4 === i % 4 ? '#8a4fff' : '#5a2a9a';
        ctx.fillRect(x + 44, 64, 16, 32);
        ctx.fillStyle = '#120820'; ctx.fillRect(x + 51, 64, 2, 32);
      });
      layer(camX, 0.55, 90, (x, i, h) => {
        if (h < 0.5) return;
        ctx.fillStyle = '#6a6a80';
        for (let y = 32; y < 32 + 40 + h * 40; y += 6) ctx.fillRect(x, y, 3, 4);
      });
      if (G.frame % 420 < 5) { ctx.fillStyle = 'rgba(208,176,255,0.25)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    },
  };

  function drawBackground(th, camX) {
    let grad = gradCache[th.bg];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, th.bgTop);
      grad.addColorStop(1, th.bgBottom);
      gradCache[th.bg] = grad;
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    (BG[th.bg] || BG.hills)(th, camX);
  }

  // =========================================================
  // WORLD / COLLISION HELPERS
  // =========================================================
  function tileAt(tx, ty) {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= G.cols) return T.EMPTY;
    return G.grid[ty][tx];
  }
  function isSolid(tx, ty) {
    if (tx < 0 || tx >= G.cols) return true; // level edges are walls
    if (ty < 0 || ty >= ROWS) return false;
    return SOLID.has(G.grid[ty][tx]);
  }
  function setTile(tx, ty, t) {
    if (tx >= 0 && tx < G.cols && ty >= 0 && ty < ROWS) G.grid[ty][tx] = t;
  }
  const solidPx = (px, py) => isSolid(Math.floor(px / TILE), Math.floor(py / TILE));

  function moveX(e, dx) {
    if (!dx) return false;
    e.x += dx;
    const top = Math.floor(e.y / TILE), bot = Math.floor((e.y + e.h - 0.01) / TILE);
    if (dx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { e.x = tx * TILE - e.w; return true; }
    } else {
      const tx = Math.floor(e.x / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { e.x = (tx + 1) * TILE; return true; }
    }
    return false;
  }

  // Returns 1 on landing, -1 on ceiling hit, 0 otherwise.
  function moveY(e, dy) {
    if (!dy) return 0;
    const prevBottom = e.y + e.h;
    e.y += dy;
    const left = Math.floor(e.x / TILE), right = Math.floor((e.x + e.w - 0.01) / TILE);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(tx, ty) || (tileAt(tx, ty) === T.SEMI && prevBottom <= ty * TILE + 0.01)) {
          e.y = ty * TILE - e.h;
          return 1;
        }
      }
    } else {
      const ty = Math.floor(e.y / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(tx, ty)) { e.y = (ty + 1) * TILE; return -1; }
      }
    }
    return 0;
  }

  // =========================================================
  // GAME STATE
  // =========================================================
  const G = {
    state: 'boot', frame: 0, stateT: 0,
    levelIndex: 0, def: null, theme: null, themeKey: '', tileset: null,
    grid: null, baseGrid: null, cols: 0, spawns: [], start: { x: 2, y: 11 },
    entities: [], player: null,
    cam: { x: 0, y: 0 }, camMin: 0,
    bumps: new Map(), crumbles: new Map(),
    time: 0, coins: 0,
    checkpoint: null, bossActive: false, arena: null,
    shake: { mag: 0, t: 0 }, message: null,
    run: null, result: null, attract: false, introLen: 110,
  };

  // World API handed to entity behaviours (see levels.js)
  const W = {
    get P() { return G.player; },
    get frame() { return G.frame; },
    get theme() { return G.theme; },
    get cam() { return G.cam; },
    get widthPx() { return G.cols * TILE; },
    get heightPx() { return ROWS * TILE; },
    get checkpoint() { return G.checkpoint; },
    get bossActive() { return G.bossActive; },
    get arena() { return G.arena || { x0: 0, x1: G.cols * TILE }; },
    viewW: VIEW_W,
    viewH: VIEW_H,
    tile: tileAt,
    setTile,
    solid: isSolid,
    solidPx,
    inView(e, m) { const mm = m || 0; return e.x + e.w > G.cam.x - mm && e.x < G.cam.x + VIEW_W + mm; },
    move(e) {
      e.vy = Math.min((e.vy || 0) + (e.gravity != null ? e.gravity : 0.35), 6);
      e.hitWall = moveX(e, e.vx || 0);
      const r = moveY(e, e.vy);
      e.onGround = r === 1;
      if (r !== 0) e.vy = 0;
    },
    groundAhead(e) {
      const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
      const tx = Math.floor(fx / TILE), ty = Math.floor((e.y + e.h + 2) / TILE);
      return isSolid(tx, ty) || tileAt(tx, ty) === T.SEMI;
    },
    spawn(type, x, y, props) { return spawnEntity(type, x, y, props); },
    burst,
    sfx(name) { Sound.play(name); },
    shake(mag, t) { if (mag >= G.shake.mag || G.shake.t <= 0) { G.shake.mag = mag; G.shake.t = t; } },
    message(text) { G.message = { text, t: 150 }; },
    sprite: drawSprite,
    drawFireball,
    drawCoin,
    hurtPlayer: (src) => hurtPlayer(src),
    killPlayer: (reason) => killPlayer(reason),
    bouncePlayer: (vy) => bouncePlayer(vy),
    setCheckpoint(e) { G.checkpoint = { tx: e.tx, x: e.x, y: e.y + e.h }; },
    completeLevel: (goal) => completeLevel(goal),
    startBoss: (door) => startBoss(door),
    bossDefeated: (boss) => bossDefeated(boss),
    setBossBar: (hp, max, phase) => ui.bossBar(hp, max, phase),
    clearHazards() {
      for (const e of G.entities) {
        if (e.type === 'fireball' || e.type === 'shockwave' || e.type === 'barrel') {
          e.remove = true;
          burst(e.x + e.w / 2, e.y + e.h / 2, { count: 6, colors: ['#ffffff', '#d0b0ff'], speed: 1.5, life: 18 });
        }
      }
    },
  };

  // ---------- Entities ----------
  function createEntity(spawn) {
    const B = L.BEHAVIORS[spawn.type];
    if (!B) { console.warn('[game] unknown entity type:', spawn.type); return null; }
    const e = Object.assign({ x: spawn.tx * TILE, y: (spawn.ty + 1) * TILE, vx: 0, vy: 0, w: 16, h: 16 }, spawn);
    e.B = B;
    if (B.init) B.init(e, W);
    if (!e.customPos) {
      e.x = spawn.tx * TILE + (TILE - e.w) / 2;
      e.y = (spawn.ty + 1) * TILE - e.h;
    }
    return e;
  }

  function spawnEntity(type, x, y, props) {
    const B = L.BEHAVIORS[type];
    if (!B) return null;
    const e = Object.assign({ type, vx: 0, vy: 0, w: 16, h: 16, tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) }, props || {});
    e.B = B;
    if (B.init) B.init(e, W);
    e.x = x;
    e.y = y;
    G.entities.push(e);
    return e;
  }

  function buildEntities() {
    G.entities = G.spawns.map(createEntity).filter(Boolean);
  }

  function updateEntities() {
    for (const e of G.entities) {
      if (e.remove || !e.B.update) continue;
      try { e.B.update(e, W); } catch (err) { console.error('[game] entity update failed:', e.type, err); e.remove = true; }
    }
  }

  function interact() {
    const P = G.player;
    if (P.dead) return;
    for (const e of G.entities) {
      if (e.remove) continue;
      const B = e.B;
      if (B.collide) { B.collide(e, W, P); if (P.dead) return; continue; }
      if (e.dead || (!e.harmful && !e.stompable && !B.onTouch)) continue;
      if (!overlap(P, e)) continue;
      if (B.onTouch) { B.onTouch(e, W, P); continue; }
      const falling = P.lastVy > 0 && P.prevBottom <= e.y + 6;
      if (e.stompable && falling) {
        if (B.onStomp) B.onStomp(e, W); else e.remove = true;
        bouncePlayer();
      } else if (e.harmful) {
        hurtPlayer(e);
        if (P.dead) return;
      }
    }
  }

  function cleanupEntities() {
    if (G.entities.some((e) => e.remove)) G.entities = G.entities.filter((e) => !e.remove);
  }

  // =========================================================
  // PLAYER
  // =========================================================
  function makePlayer(x, y) {
    return {
      x, y, w: 12, h: 15, vx: 0, vy: 0, face: 1,
      onGround: false, coyote: 0, buffer: 0, jumping: false, crouch: false,
      hp: MAX_HP, invuln: 0, dead: false, deadT: 0, windX: 0, ride: null,
      dist: 0, prevBottom: y + 15, lastVy: 0, hidden: false,
    };
  }

  function boxHitsSolid(b) {
    const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tx, ty)) return true;
    return false;
  }

  function dust(x, y, n) {
    burst(x, y, { count: n || 4, colors: [G.theme.particle || '#ffffff', '#cccccc'], speed: 1, life: 16, gravity: -0.02, size: 2, up: true });
  }

  function updatePlayer() {
    const P = G.player;
    if (P.invuln > 0) P.invuln--;
    if (P.dead) { updateDeath(P); return; }

    if (P.ride) {
      moveX(P, P.ride.dx);
      P.y = P.ride.y - P.h;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // Crouch (only starts on the ground; stand back up when there is head room)
    if (input.down && P.onGround && !P.crouch) {
      P.crouch = true; P.y += 5; P.h = 10;
    } else if (!input.down && P.crouch) {
      if (!boxHitsSolid({ x: P.x, y: P.y - 5, w: P.w, h: 15 })) { P.crouch = false; P.y -= 5; P.h = 15; }
    }

    const max = input.run ? PHYS.run : PHYS.walk;
    const moveDir = P.crouch && P.onGround ? 0 : dir;
    if (moveDir) {
      let a = P.onGround ? PHYS.accel : PHYS.airAccel;
      if (Math.sign(P.vx) === -moveDir) {
        a *= PHYS.turnBoost;
        if (P.onGround && Math.abs(P.vx) > 1.2 && G.frame % 4 === 0) dust(P.x + P.w / 2, P.y + P.h, 2);
      }
      P.vx += moveDir * a;
      if (Math.abs(P.vx) > max) P.vx = Math.sign(P.vx) * Math.max(max, Math.abs(P.vx) - 0.1);
      P.face = moveDir;
    } else {
      const f = P.onGround ? (P.crouch ? 0.08 : PHYS.friction) : 0.04;
      P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
    }

    // Jumping: buffered presses + coyote time + variable height
    if (jumpPressedEdge) P.buffer = PHYS.buffer;
    if (P.onGround) P.coyote = PHYS.coyote; else if (P.coyote > 0) P.coyote--;
    if (P.buffer > 0) {
      P.buffer--;
      if (P.coyote > 0) {
        P.vy = PHYS.jumpV - Math.min(0.5, Math.abs(P.vx) * 0.12);
        P.onGround = false; P.coyote = 0; P.buffer = 0; P.jumping = true; P.ride = null;
        Sound.play('jump');
        dust(P.x + P.w / 2, P.y + P.h, 4);
      }
    }
    if (!input.jump && P.jumping && P.vy < PHYS.jumpCut) P.vy = PHYS.jumpCut;
    P.vy = Math.min(P.vy + PHYS.gravity, PHYS.maxFall);

    // Horizontal movement (+ wind gusts)
    if (moveX(P, P.vx + P.windX)) P.vx = 0;
    P.x = clamp(P.x, G.camMin, G.cols * TILE - P.w);

    // Vertical movement
    const vyBefore = P.vy;
    P.prevBottom = P.y + P.h;
    P.lastVy = P.vy;
    const r = moveY(P, P.vy);
    P.onGround = false;
    P.ride = null;
    if (r === 1) {
      P.onGround = true; P.jumping = false; P.vy = 0;
      if (vyBefore > 5) dust(P.x + P.w / 2, P.y + P.h, 5);
    } else if (r === -1) {
      P.vy = 1;
      bumpCeiling(P);
    }

    // Moving platforms (one-way, rideable)
    if (r !== 1 && P.vy >= 0) {
      for (const e of G.entities) {
        if (!e.platform) continue;
        if (P.x + P.w > e.x + 1 && P.x < e.x + e.w - 1 && P.prevBottom <= e.y + Math.abs(e.dy || 0) + 1 && P.y + P.h >= e.y) {
          P.y = e.y - P.h; P.vy = 0; P.onGround = true; P.jumping = false; P.ride = e;
          break;
        }
      }
    }

    if (P.y > ROWS * TILE + 24) { killPlayer('pit'); return; }

    tileInteractions(P);
    if (P.dead) return;

    // Crumbling tiles start shaking once stood on
    if (P.onGround && !P.ride) {
      const ty = Math.floor((P.y + P.h + 1) / TILE);
      const a = Math.floor((P.x + 1) / TILE), b = Math.floor((P.x + P.w - 2) / TILE);
      for (let tx = a; tx <= b; tx++) if (tileAt(tx, ty) === T.CRUMBLE) startCrumble(tx, ty);
    }

    if (P.onGround && Math.abs(P.vx) > 0.1) P.dist += Math.abs(P.vx);
  }

  function tileInteractions(P) {
    const x0 = Math.floor((P.x + 1) / TILE), x1 = Math.floor((P.x + P.w - 2) / TILE);
    const y0 = Math.floor((P.y + 1) / TILE), y1 = Math.floor((P.y + P.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(tx, ty);
        if (t === T.COIN) {
          setTile(tx, ty, T.EMPTY);
          collectCoin(tx * TILE + 8, ty * TILE + 8);
        } else if (t === T.LAVA && P.y + P.h > ty * TILE + 5) {
          killPlayer('lava');
          return;
        }
      }
    }
    // Spikes: under the feet or pressed against the sides
    const feet = Math.floor((P.y + P.h + 1) / TILE);
    let spiked = false;
    if (P.onGround) for (let tx = x0; tx <= x1; tx++) if (tileAt(tx, feet) === T.SPIKE) spiked = true;
    const by0 = Math.floor(P.y / TILE), by1 = Math.floor((P.y + P.h - 1) / TILE);
    for (let ty = by0; ty <= by1 && !spiked; ty++) {
      if (tileAt(Math.floor((P.x - 1) / TILE), ty) === T.SPIKE || tileAt(Math.floor((P.x + P.w) / TILE), ty) === T.SPIKE) spiked = true;
    }
    if (spiked) {
      hurtPlayer({ x: P.x + P.w / 2 - P.face * 4, w: 0 });
      if (!P.dead && P.invuln > 0) P.vy = -5.5;
    }
  }

  function bumpCeiling(P) {
    const ty = Math.floor((P.y - 1) / TILE);
    let tx = Math.floor((P.x + P.w / 2) / TILE);
    if (!isSolid(tx, ty)) {
      const l = Math.floor(P.x / TILE), rr = Math.floor((P.x + P.w - 1) / TILE);
      tx = isSolid(l, ty) ? l : rr;
    }
    const t = tileAt(tx, ty);
    const key = tx + ',' + ty;
    if (t === T.QBLOCK) {
      setTile(tx, ty, T.USED);
      G.bumps.set(key, 12);
      spawnEntity('coinPop', tx * TILE + 3, ty * TILE - 14);
      collectCoin(tx * TILE + 8, ty * TILE - 8, true);
    } else if (t === T.BRICK) {
      setTile(tx, ty, T.EMPTY);
      Sound.play('brick');
      const th = G.theme;
      for (let i = 0; i < 4; i++) {
        particles.push({ x: tx * TILE + 4 + (i % 2) * 8, y: ty * TILE + 4 + (i >> 1) * 8, vx: (i % 2 ? 1.2 : -1.2), vy: (i >> 1) ? -3 : -4.5, g: 0.3, life: 50, max: 50, size: 5, color: th.brick });
      }
      burst(tx * TILE + 8, ty * TILE + 8, { count: 6, colors: [th.brickLight, th.brickDark], speed: 2, life: 25, size: 2 });
    } else {
      G.bumps.set(key, 12);
      Sound.play('bump');
    }
    const zone = { x: tx * TILE, y: ty * TILE - 6, w: TILE, h: 6 };
    for (const e of G.entities) if (!e.dead && !e.remove && e.B.onBump && overlap(e, zone)) e.B.onBump(e, W);
    if (tileAt(tx, ty - 1) === T.COIN) {
      setTile(tx, ty - 1, T.EMPTY);
      collectCoin(tx * TILE + 8, (ty - 1) * TILE + 8);
    }
  }

  function startCrumble(tx, ty) {
    const key = tx + ',' + ty;
    if (!G.crumbles.has(key)) G.crumbles.set(key, { tx, ty, t: 0, state: 'shake' });
  }

  function updateTileFx() {
    for (const [key, t] of G.bumps) { if (t <= 1) G.bumps.delete(key); else G.bumps.set(key, t - 1); }
    for (const [key, c] of G.crumbles) {
      c.t++;
      if (c.state === 'shake' && c.t >= 26) {
        setTile(c.tx, c.ty, T.EMPTY);
        c.state = 'gone'; c.t = 0;
        Sound.play('crumble');
        burst(c.tx * TILE + 8, c.ty * TILE + 8, { count: 10, colors: [G.theme.block, G.theme.blockDark, '#a0602a'], speed: 1.5, life: 40, gravity: 0.25, size: 3 });
      } else if (c.state === 'gone' && c.t >= 260) {
        if (!overlap(G.player, { x: c.tx * TILE, y: c.ty * TILE, w: TILE, h: TILE })) {
          setTile(c.tx, c.ty, T.CRUMBLE);
          G.crumbles.delete(key);
        }
      }
    }
  }

  function collectCoin(x, y, silentSparkle) {
    G.coins++;
    Sound.play('coin');
    if (!silentSparkle) burst(x, y, { count: 6, colors: ['#ffd23f', '#fff6b0', '#ffffff'], speed: 1.6, life: 18, gravity: 0, size: 2 });
    if (G.run) {
      G.run.lifeCoins++;
      if (G.run.lifeCoins >= COINS_PER_LIFE) {
        G.run.lifeCoins -= COINS_PER_LIFE;
        G.run.lives++;
        Sound.play('oneUp');
        W.message('1-UP!');
      }
    }
  }

  function hurtPlayer(src) {
    const P = G.player;
    if (P.dead || P.invuln > 0 || G.state !== 'play') return;
    P.hp--;
    Sound.play('hurt');
    W.shake(3, 12);
    burst(P.x + P.w / 2, P.y + P.h / 2, { count: 10, colors: ['#ff3b3b', '#ffffff'], speed: 2, life: 20, size: 2 });
    if (P.hp <= 0) { killPlayer('hit'); return; }
    P.invuln = 100;
    P.vy = -5; P.onGround = false; P.ride = null; P.jumping = false;
    const sx = src && src.x != null ? src.x + (src.w || 0) / 2 : P.x;
    P.vx = (P.x + P.w / 2 < sx ? -1 : 1) * 2.2;
  }

  function killPlayer(reason) {
    const P = G.player;
    if (P.dead || G.state !== 'play') return;
    P.dead = true; P.deadT = 0; P.hp = 0; P.vx = 0; P.ride = null;
    P.vy = reason === 'pit' ? 0 : -7;
    if (P.crouch) { P.crouch = false; P.y -= 5; P.h = 15; }
    if (reason === 'lava') burst(P.x + P.w / 2, P.y + P.h, { count: 24, colors: ['#ffd23f', '#ff5a1f', '#b81e00'], speed: 3, life: 35, gravity: 0.1, size: 3, up: true });
    Sound.stopMusic();
    Sound.play('die');
    G.state = 'dying';
    G.stateT = 0;
  }

  function updateDeath(P) {
    P.deadT++;
    if (P.deadT > 24) {
      P.vy = Math.min(P.vy + 0.35, 8);
      P.y += P.vy;
    }
    if (P.deadT === 150) loseLife();
  }

  function bouncePlayer(vy) {
    const P = G.player;
    if (vy != null) P.vy = input.jump ? Math.min(vy, PHYS.stompHeld) : vy;
    else P.vy = input.jump ? PHYS.stompHeld : PHYS.stomp;
    P.onGround = false; P.coyote = 0; P.ride = null;
    P.jumping = !!input.jump;
  }

  // =========================================================
  // LEVEL & RUN FLOW
  // =========================================================
  function placePlayer(respawned) {
    let x, y;
    if (G.checkpoint) { x = G.checkpoint.x; y = G.checkpoint.y - 15; }
    else { x = G.start.x * TILE + 2; y = (G.start.y + 1) * TILE - 15; }
    G.player = makePlayer(x, y);
    if (respawned) G.player.invuln = 90;
    updateCamera(true);
  }

  function loadLevel(i) {
    const def = L.LEVELS[i];
    if (!def) throw new Error('Level ' + i + ' does not exist');
    const b = L.makeBuilder(def.cols);
    def.build(b);
    G.levelIndex = i;
    G.def = def;
    G.cols = def.cols;
    G.baseGrid = b.grid;
    G.grid = b.grid.map((r) => r.slice());
    G.spawns = b.spawns;
    G.start = b.start;
    G.themeKey = def.theme;
    G.theme = L.THEMES[def.theme];
    G.tileset = buildTileset(def.theme, G.theme);
    G.bumps.clear();
    G.crumbles.clear();
    particles.length = 0;
    G.time = 0;
    G.coins = 0;
    G.checkpoint = null;
    G.bossActive = false;
    G.arena = null;
    G.camMin = 0;
    G.message = null;
    G.result = null;
    buildEntities();
    placePlayer(false);
    ui.hideBossBar();
  }

  function beginIntro(respawned) {
    G.state = 'intro';
    G.stateT = 0;
    G.introLen = respawned ? 80 : 120;
    ui.showIntro(G.def, G.run ? G.run.lives : START_LIVES);
  }

  function startPlay() {
    G.state = 'play';
    ui.show(null);
    ui.hud(true);
    Sound.music(G.bossActive ? 'boss' : G.def.music);
  }

  function startRun(levelIndex) {
    Sound.unlock();
    Sound.play('confirm');
    G.attract = false;
    G.run = { lives: START_LIVES, scoreTotal: 0, coinsTotal: 0, timeTotal: 0, startLevel: levelIndex + 1, reached: levelIndex + 1, cleared: false, lifeCoins: 0 };
    loadLevel(levelIndex);
    ui.hud(true);
    beginIntro(false);
  }

  function loseLife() {
    G.run.lives--;
    if (G.run.lives <= 0) { gameOver(); return; }
    for (const c of G.crumbles.values()) setTile(c.tx, c.ty, T.CRUMBLE);
    G.crumbles.clear();
    if (G.arena) for (let ty = 2; ty <= 11; ty++) setTile(G.arena.door, ty, G.baseGrid[ty][G.arena.door]);
    G.bossActive = false;
    G.arena = null;
    G.camMin = 0;
    ui.hideBossBar();
    particles.length = 0;
    buildEntities();
    placePlayer(true);
    beginIntro(true);
  }

  function recordProgress(levelId, score) {
    const best = progress.best[levelId] || 0;
    if (score > best) progress.best[levelId] = score;
    progress.unlocked = clamp(Math.max(progress.unlocked, levelId + 1), 1, L.LEVELS.length);
    store.set('spd.progress', progress);
  }

  function tallyLevel() {
    const secs = Math.floor(G.time);
    const coinPts = G.coins * 500;
    const timePts = Math.max(0, 10000 - secs * 50);
    const score = levelScore(G.coins, secs);
    G.result = { coins: G.coins, secs, coinPts, timePts, score };
    G.run.scoreTotal += score;
    G.run.coinsTotal += G.coins;
    G.run.timeTotal += secs;
    G.run.reached = Math.max(G.run.reached, G.def.id);
    recordProgress(G.def.id, score);
  }

  function completeLevel(goal) {
    if (G.state !== 'play') return;
    const P = G.player;
    G.state = 'clear';
    G.stateT = 0;
    G.clearPhase = 'slide';
    G.goal = goal;
    if (P.crouch) { P.crouch = false; P.y -= 5; P.h = 15; }
    P.vx = 0; P.vy = 0; P.invuln = 0; P.face = 1; P.ride = null;
    P.x = goal.x - P.w + 2;
    Sound.stopMusic();
    Sound.play('flag');
    tallyLevel();
  }

  function updateClear() {
    const P = G.player;
    G.stateT++;
    if (G.goal && G.goal.B.update) G.goal.B.update(G.goal, W);
    if (G.clearPhase === 'slide') {
      if (moveY(P, 2.4) === 1 || G.stateT > 120) {
        G.clearPhase = 'walk'; G.stateT = 0;
        P.onGround = true;
        Sound.play('levelClear');
      }
    } else if (G.clearPhase === 'walk') {
      P.vx = 1.3;
      P.face = 1;
      moveX(P, P.vx);
      P.vy = Math.min(P.vy + PHYS.gravity, PHYS.maxFall);
      if (moveY(P, P.vy) === 1) { P.vy = 0; P.onGround = true; } else P.onGround = false;
      P.dist += 1.3;
      if (P.x > G.goal.x + 78) P.hidden = true;
      if (G.stateT > 110) {
        G.clearPhase = 'done';
        ui.showLevelClear(G.result, G.run.scoreTotal, G.def);
      }
    }
  }

  function startBoss(door) {
    G.bossActive = true;
    G.arena = { door, x0: (door + 1) * TILE, x1: (G.cols - 1) * TILE };
    for (let ty = 2; ty <= 11; ty++) setTile(door, ty, T.STONE);
    G.camMin = door * TILE;
    W.shake(4, 30);
    Sound.play('crumble');
    Sound.music('boss');
    ui.showBossBar();
    W.message('GROKK THE IRON APE!');
  }

  function bossDefeated() {
    G.state = 'victoryAnim';
    G.stateT = 0;
    G.run.cleared = true;
    Sound.stopMusic();
    Sound.play('victory');
    ui.hideBossBar();
    tallyLevel();
  }

  function gameOver() {
    G.state = 'gameover';
    const coins = G.run.coinsTotal + G.coins;
    const time = G.run.timeTotal + Math.floor(G.time);
    const score = G.run.scoreTotal + G.coins * 500; // partial credit: no time bonus for an unfinished world
    G.run.reached = Math.max(G.run.reached, G.def.id);
    Sound.stopMusic();
    Sound.play('gameOver');
    ui.hud(false);
    ui.showGameOver({ level: G.run.reached, coins, time, score });
    submitRun({ level: G.run.reached, coins, time, score, cleared: false }, 'go-submit');
  }

  function showVictory() {
    G.state = 'victory';
    const r = G.run;
    ui.hud(false);
    ui.showVictory({ coins: r.coinsTotal, time: r.timeTotal, score: r.scoreTotal });
    submitRun({ level: L.LEVELS.length, coins: r.coinsTotal, time: r.timeTotal, score: r.scoreTotal, cleared: true }, 'vic-submit');
  }

  async function submitRun(entry, statusId) {
    const el = $(statusId);
    if (!Board || entry.score <= 0) { if (el) el.textContent = ''; return; }
    if (el) el.textContent = 'SAVING SCORE...';
    try {
      const res = await Board.submitScore(entry);
      const msg = res.remote ? 'SCORE POSTED TO THE GLOBAL LEADERBOARD!'
        : res.reason === 'signed-out' ? 'SAVED LOCALLY. SIGN IN TO GO GLOBAL!'
          : res.reason === 'not-configured' ? 'SAVED LOCALLY (FIREBASE NOT CONFIGURED).'
            : 'SAVED LOCALLY. UPLOAD WILL RETRY LATER.';
      if (el) el.textContent = msg;
    } catch (err) {
      console.error('[game] score submit failed:', err);
      if (el) el.textContent = 'COULD NOT SAVE SCORE.';
    }
  }

  function togglePause() {
    if (G.state === 'play') {
      G.state = 'pause';
      Sound.play('pause');
      Sound.duckMusic(true);
      ui.show('screen-pause');
    } else if (G.state === 'pause') {
      G.state = 'play';
      Sound.duckMusic(false);
      ui.show(null);
    }
  }

  function quitToTitle() {
    Sound.duckMusic(false);
    G.run = null;
    enterTitle();
  }

  function enterTitle() {
    G.attract = true;
    loadLevel(0);
    G.player.dead = true;
    G.player.x = -4000;
    G.cam.x = 0;
    G.state = 'title';
    ui.hud(false);
    ui.hideBossBar();
    ui.show('screen-title');
    if (audioStarted) Sound.music('title');
  }

  function updateCamera(snap) {
    const P = G.player;
    if (!P || G.attract) return;
    const maxX = Math.max(G.camMin, G.cols * TILE - VIEW_W);
    const target = clamp(P.x + P.w / 2 - VIEW_W / 2 + P.face * 20, G.camMin, maxX);
    if (snap) G.cam.x = target; else G.cam.x += (target - G.cam.x) * 0.1;
    G.cam.x = clamp(G.cam.x, G.camMin, maxX);
  }

  // =========================================================
  // UPDATE
  // =========================================================
  function ambient() {
    const key = G.themeKey;
    if ((key === 'lava' || key === 'fortress') && G.frame % 9 === 0) {
      burst(G.cam.x + Math.random() * VIEW_W, VIEW_H + 4, { count: 1, colors: key === 'lava' ? ['#ffb347', '#ff5a1f'] : ['#d0b0ff', '#8a4fff'], speed: 0.4, life: 120, gravity: -0.012, size: 2 });
    }
  }

  function fireworks() {
    const x = G.cam.x + 40 + Math.random() * (VIEW_W - 80);
    const y = 40 + Math.random() * 80;
    const palettes = [['#ff3b3b', '#ffd23f'], ['#5cc8ff', '#ffffff'], ['#3ec94a', '#fff6b0'], ['#ff7eb6', '#8a4fff']];
    burst(x, y, { count: 36, colors: palettes[(Math.random() * palettes.length) | 0], speed: 3.2, life: 50, gravity: 0.05, size: 2 });
    Sound.play('firework');
  }

  function update() {
    G.frame++;
    syncInput();
    switch (G.state) {
      case 'title': {
        const maxX = G.cols * TILE - VIEW_W;
        G.cam.x += 0.6;
        if (G.cam.x > maxX) G.cam.x = 0;
        updateEntities();
        cleanupEntities();
        break;
      }
      case 'intro':
        if (++G.stateT >= G.introLen) startPlay();
        break;
      case 'play':
        G.time += 1 / 60;
        updateTileFx();
        G.player.windX = 0;
        updateEntities();
        updatePlayer();
        interact();
        cleanupEntities();
        updateCamera();
        ambient();
        break;
      case 'dying':
        updatePlayer();
        break;
      case 'clear':
        updateClear();
        updateCamera();
        break;
      case 'victoryAnim':
        G.stateT++;
        G.player.windX = 0;
        updateEntities();
        updatePlayer();
        cleanupEntities();
        updateCamera();
        if (G.stateT % 20 === 0 && G.stateT < 240) fireworks();
        if (G.stateT === 290) showVictory();
        break;
      case 'victory':
        if (G.frame % 45 === 0) fireworks();
        break;
      default:
        break;
    }
    if (G.state !== 'pause') updateParticles();
    if (G.shake.t > 0) G.shake.t--;
    if (G.message && G.state !== 'pause' && --G.message.t <= 0) G.message = null;
    jumpPressedEdge = false;
    ui.updateHud();
  }

  // =========================================================
  // RENDER
  // =========================================================
  const darkCanvas = document.createElement('canvas');
  darkCanvas.width = VIEW_W;
  darkCanvas.height = VIEW_H;
  const dctx = darkCanvas.getContext('2d');

  function drawDarkness(camX, camY, lights) {
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, VIEW_W, VIEW_H);
    dctx.fillStyle = 'rgba(4,2,12,' + G.theme.darkness + ')';
    dctx.fillRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'destination-out';
    const P = G.player;
    if (P && !G.attract) lights.push({ x: P.x + P.w / 2 - camX, y: P.y + P.h / 2 - camY, r: 86 + Math.sin(G.frame * 0.1) * 2 });
    else lights.push({ x: VIEW_W / 2, y: VIEW_H / 2, r: 170 });
    for (const e of G.entities) {
      if ((e.type === 'fireball' || e.type === 'drip') && e.x > camX - 40 && e.x < camX + VIEW_W + 40) lights.push({ x: e.x - camX + e.w / 2, y: e.y - camY + e.h / 2, r: 22 });
    }
    for (const l of lights) {
      const g = dctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(darkCanvas, 0, 0);
  }

  function drawEntity(e, camX, camY) {
    if (!e.B.draw) return;
    if (e.type !== 'risingLava' && e.type !== 'wind' && (e.x > camX + VIEW_W + 140 || e.x + e.w < camX - 140)) return;
    try {
      e.B.draw(e, W, ctx, Math.round(e.x - camX), Math.round(e.y - camY));
    } catch (err) {
      console.error('[game] entity draw failed:', e.type, err);
      e.remove = true;
    }
  }

  function drawPlayer(camX, camY) {
    const P = G.player;
    if (!P || G.attract || P.hidden) return;
    if (P.invuln > 0 && !P.dead && ((G.frame >> 2) & 1) === 0) return;
    let frame;
    if (P.dead) frame = 3;
    else if (P.crouch) frame = 4;
    else if (!P.onGround) frame = 3;
    else if (Math.abs(P.vx) > 0.15) frame = 1 + (Math.floor(P.dist / 9) % 2);
    else frame = 0;
    drawSprite('player', frame, P.x - 2 - camX, P.y + P.h - 16 - camY, { flip: P.face < 0 });
  }

  function drawMessage() {
    const m = G.message;
    if (!m || G.attract) return;
    if (m.t < 30 && ((m.t >> 2) & 1)) return;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(m.text, VIEW_W / 2 + 1, 51);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(m.text, VIEW_W / 2, 50);
  }

  function render() {
    if (!G.theme) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    let shx = 0, shy = 0;
    if (G.shake.t > 0) {
      shx = Math.round((Math.random() * 2 - 1) * G.shake.mag);
      shy = Math.round((Math.random() * 2 - 1) * G.shake.mag);
    }
    const camX = Math.round(G.cam.x) + shx;
    const camY = shy;
    drawBackground(G.theme, Math.round(G.cam.x));
    const lights = G.theme.darkness ? [] : null;
    drawTiles(camX, camY, lights);
    const front = [];
    for (const e of G.entities) {
      if (e.type === 'risingLava' || e.type === 'wind') front.push(e);
      else drawEntity(e, camX, camY);
    }
    drawPlayer(camX, camY);
    for (const e of front) drawEntity(e, camX, camY);
    drawParticles(camX, camY);
    if (lights) drawDarkness(camX, camY, lights);
    drawMessage();
    if (G.state === 'pause') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // =========================================================
  // UI — overlays, HUD, leaderboard, auth
  // =========================================================
  const ui = {
    current: null,
    prev: [],
    cache: {},
    lbToken: 0,
    toastTimer: null,
    screens: Array.from(document.querySelectorAll('.screen')),

    show(id) {
      for (const s of this.screens) s.classList.toggle('active', s.id === id);
      this.current = id;
      if (id && id !== 'screen-intro') {
        const el = $(id);
        const first = el && el.querySelector('.btn-primary:not([disabled]), .level-card:not([disabled]), .btn:not([disabled])');
        if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
      } else if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    },
    open(id) {
      if (this.current && this.current !== id) this.prev.push(this.current);
      this.show(id);
    },
    back() {
      if (G.state === 'pause') { togglePause(); return; }
      if (G.state !== 'title' && G.state !== 'gameover' && G.state !== 'victory') return;
      const target = this.prev.pop() || (G.state === 'title' ? 'screen-title' : this.current);
      this.show(target);
      Sound.play('select');
    },
    moveFocus(dir) {
      const root = this.current && $(this.current);
      if (!root) return;
      const items = Array.from(root.querySelectorAll('button:not([disabled]), input')).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      const next = items[(idx + dir + items.length) % items.length];
      next.focus({ preventScroll: true });
      Sound.play('select');
    },
    set(id, value) {
      if (this.cache[id] === value) return;
      this.cache[id] = value;
      const el = $(id);
      if (el) el.textContent = value;
    },
    hud(on) { $('hud').classList.toggle('hidden', !on); },
    updateHud() {
      if (!G.run || !G.def || $('hud').classList.contains('hidden')) return;
      const P = G.player;
      this.set('hud-level', String(G.def.id));
      this.set('hud-coins', String(G.coins));
      this.set('hud-score', String(G.run.scoreTotal + (G.result ? 0 : G.coins * 500)));
      const secs = Math.floor(G.time);
      this.set('hud-time', String(secs));
      $('hud-time').style.color = secs >= 160 ? '#ff3b3b' : '';
      this.set('hud-lives', String(Math.max(0, G.run.lives)));
      const hp = P ? clamp(P.hp, 0, MAX_HP) : 0;
      if (this.cache.hp !== hp) {
        this.cache.hp = hp;
        const el = $('hud-hp');
        el.textContent = '';
        for (let i = 0; i < MAX_HP; i++) {
          const s = document.createElement('span');
          s.textContent = '♥';
          if (i >= hp) s.className = 'empty';
          el.appendChild(s);
        }
      }
    },
    showIntro(def, lives) {
      $('intro-world').textContent = 'WORLD ' + def.id;
      $('intro-name').textContent = def.name;
      $('intro-lives').textContent = '× ' + lives;
      this.show('screen-intro');
    },
    countUp(id, to, ms) {
      const el = $(id);
      const start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        el.textContent = String(Math.round(to * k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    showLevelClear(r, total, def) {
      G.state = 'tally';
      $('lc-title').textContent = def.name + ' CLEAR!';
      $('lc-coins').textContent = String(r.coins);
      $('lc-time').textContent = r.secs + 's';
      this.countUp('lc-coinpts', r.coinPts, 700);
      this.countUp('lc-timepts', r.timePts, 900);
      this.countUp('lc-score', r.score, 1100);
      this.countUp('lc-total', total, 1300);
      this.prev = [];
      this.show('screen-levelclear');
    },
    showGameOver(d) {
      $('go-level').textContent = String(d.level);
      $('go-coins').textContent = String(d.coins);
      $('go-time').textContent = fmtTime(d.time);
      $('go-score').textContent = String(d.score);
      this.prev = [];
      this.show('screen-gameover');
    },
    showVictory(d) {
      $('vic-coins').textContent = String(d.coins);
      $('vic-time').textContent = fmtTime(d.time);
      this.countUp('vic-score', d.score, 1500);
      this.prev = [];
      this.show('screen-victory');
    },
    showBossBar() {
      this.cache.boss = null;
      $('boss-bar').classList.remove('hidden', 'phase2', 'phase3');
      $('boss-bar-fill').style.width = '100%';
    },
    hideBossBar() { $('boss-bar').classList.add('hidden'); },
    bossBar(hp, max, phase) {
      const key = hp + '/' + phase;
      if (this.cache.boss === key) return;
      this.cache.boss = key;
      $('boss-bar-fill').style.width = Math.max(0, (hp / max) * 100) + '%';
      const bar = $('boss-bar');
      bar.classList.toggle('phase2', phase === 2);
      bar.classList.toggle('phase3', phase === 3);
    },
    toast(msg, isError) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.toggle('error', !!isError);
      t.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
    },
    toggleMute() {
      const muted = Sound.toggleMute();
      this.syncMuteLabels();
      if (!muted) Sound.play('select');
    },
    syncMuteLabels() {
      const label = 'SOUND: ' + (Sound.isMuted() ? 'OFF' : 'ON');
      document.querySelectorAll('[data-action="mute"]').forEach((b) => { b.textContent = label; });
    },
    toggleCrt() {
      settings.crt = !settings.crt;
      store.set('spd.settings', settings);
      this.syncCrt();
      Sound.play('select');
    },
    syncCrt() {
      document.body.classList.toggle('crt', !!settings.crt);
      $('btn-crt').textContent = 'CRT: ' + (settings.crt ? 'ON' : 'OFF');
    },
    renderLevels() {
      const grid = $('level-grid');
      grid.textContent = '';
      L.LEVELS.forEach((lv, i) => {
        const th = L.THEMES[lv.theme];
        const b = document.createElement('button');
        b.className = 'level-card';
        b.dataset.action = 'play-level';
        b.dataset.level = String(i);
        b.style.background = 'linear-gradient(to bottom, ' + th.bgTop + ' 0%, ' + th.bgBottom + ' 55%, ' + th.groundTopDark + ' 56%, ' + th.groundDark + ' 100%)';
        const locked = lv.id > progress.unlocked;
        b.disabled = locked;
        const num = document.createElement('span'); num.className = 'num'; num.textContent = String(lv.id);
        const name = document.createElement('span'); name.textContent = lv.name;
        const best = document.createElement('span'); best.className = locked ? 'lock' : 'best';
        best.textContent = locked ? 'LOCKED' : (progress.best[lv.id] ? 'BEST ' + progress.best[lv.id] : 'NEW!');
        b.title = lv.blurb;
        b.append(num, name, best);
        grid.appendChild(b);
      });
    },
    avatar(entry) {
      const fallback = () => {
        const s = document.createElement('span');
        s.className = 'avatar avatar-fallback';
        s.textContent = (entry.name || '?').charAt(0).toUpperCase();
        return s;
      };
      if (!entry.photoURL) return fallback();
      const img = document.createElement('img');
      img.className = 'avatar';
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = entry.photoURL;
      img.onerror = () => img.replaceWith(fallback());
      return img;
    },
    async renderLeaderboard() {
      const body = $('lb-body');
      const msgRow = (text) => {
        body.textContent = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6; td.className = 'lb-empty'; td.textContent = text;
        tr.appendChild(td); body.appendChild(tr);
      };
      msgRow('LOADING...');
      const token = ++this.lbToken;
      let res;
      try {
        res = Board ? await Board.fetchTop(25) : { source: 'local', entries: [] };
      } catch (err) {
        res = { source: 'local', entries: [], error: err.message };
      }
      if (token !== this.lbToken) return;
      const badge = $('lb-source');
      badge.textContent = res.source === 'global' ? 'GLOBAL' : 'LOCAL (THIS DEVICE)';
      badge.classList.toggle('global', res.source === 'global');
      if (!res.entries.length) { msgRow('NO SCORES YET. BE THE FIRST!'); }
      else {
        body.textContent = '';
        const me = Board && Board.user();
        res.entries.forEach((en, i) => {
          const tr = document.createElement('tr');
          if (me && en.uid && en.uid === me.uid) tr.className = 'me';
          const cells = [String(i + 1), null, en.cleared ? en.level + '★' : String(en.level), String(en.coins), fmtTime(en.time), String(en.score)];
          cells.forEach((c, k) => {
            const td = document.createElement('td');
            if (k === 1) {
              const wrap = document.createElement('div');
              wrap.className = 'lb-player';
              const name = document.createElement('span');
              name.textContent = en.name;
              wrap.append(this.avatar(en), name);
              td.appendChild(wrap);
            } else td.textContent = c;
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
      }
      if (res.error) this.toast('GLOBAL BOARD UNAVAILABLE: ' + res.error, true);
    },
    loginStatus(msg, isError) {
      const el = $('login-status');
      let text = msg;
      if (text == null) {
        text = Board && Board.isConfigured()
          ? (Board.user() ? 'SIGNED IN AS ' + Board.user().name.toUpperCase() : '')
          : 'FIREBASE IS NOT CONFIGURED YET. SCORES ARE SAVED ON THIS DEVICE.';
      }
      el.textContent = text;
      el.style.color = isError ? '#ff3b3b' : '';
    },
    updateAuth(s) {
      const user = s && s.user;
      const btn = $('btn-login');
      const chip = $('user-chip');
      btn.classList.toggle('hidden', !!user);
      chip.classList.toggle('hidden', !user);
      btn.textContent = s && s.status === 'loading' ? 'CONNECTING...' : 'SIGN IN';
      if (user) {
        $('user-name').textContent = user.name.toUpperCase();
        const img = $('user-avatar');
        if (user.photoURL) { img.src = user.photoURL; img.classList.remove('hidden'); img.onerror = () => img.classList.add('hidden'); }
        else img.classList.add('hidden');
      }
    },
  };

  // ---------- Actions ----------
  async function doSignIn() {
    if (!Board) return;
    if (!Board.isConfigured()) {
      ui.loginStatus('FIREBASE IS NOT CONFIGURED YET (SEE README). YOU CAN STILL PLAY AS A GUEST.', true);
      return;
    }
    ui.loginStatus('OPENING GOOGLE SIGN-IN...');
    try {
      const u = await Board.signIn();
      if (u) {
        ui.toast('WELCOME, ' + u.name.toUpperCase() + '!');
        ui.prev = [];
        ui.show('screen-title');
      } else ui.loginStatus();
    } catch (err) {
      ui.loginStatus(String(err.message || err).toUpperCase(), true);
    }
  }

  async function doSignOut() {
    try {
      await Board.signOut();
      ui.toast('SIGNED OUT');
    } catch (err) {
      ui.toast(String(err.message || err), true);
    }
  }

  function restartLevel() {
    if (!G.run) return;
    Sound.duckMusic(false);
    Sound.stopMusic();
    loadLevel(G.levelIndex);
    beginIntro(false);
  }

  function nextLevel() {
    if (G.state !== 'tally') return;
    const next = G.levelIndex + 1;
    if (next >= L.LEVELS.length) { showVictory(); return; }
    loadLevel(next);
    beginIntro(false);
  }

  function toggleFullscreen() {
    const done = (p) => { if (p && p.catch) p.catch(() => ui.toast('FULLSCREEN NOT AVAILABLE', true)); };
    try {
      if (!document.fullscreenElement) done(document.documentElement.requestFullscreen && document.documentElement.requestFullscreen());
      else done(document.exitFullscreen && document.exitFullscreen());
    } catch (err) {
      ui.toast('FULLSCREEN NOT AVAILABLE', true);
    }
  }

  function handleAction(action, el) {
    switch (action) {
      case 'start': startRun(0); break;
      case 'levels': ui.renderLevels(); ui.open('screen-levels'); Sound.play('select'); break;
      case 'play-level': startRun(clamp(parseInt(el.dataset.level, 10) || 0, 0, L.LEVELS.length - 1)); break;
      case 'leaderboard': ui.open('screen-leaderboard'); ui.renderLeaderboard(); Sound.play('select'); break;
      case 'lb-refresh': ui.renderLeaderboard(); break;
      case 'login':
        ui.open('screen-login');
        $('guest-name').value = Board ? Board.getGuestName() : 'GUEST';
        ui.loginStatus();
        break;
      case 'google-signin': doSignIn(); break;
      case 'logout': doSignOut(); break;
      case 'guest': {
        const n = Board ? Board.setGuestName($('guest-name').value) : 'GUEST';
        ui.toast('PLAYING AS ' + n);
        ui.back();
        break;
      }
      case 'help': ui.open('screen-help'); Sound.play('select'); break;
      case 'back': ui.back(); break;
      case 'mute': ui.toggleMute(); break;
      case 'crt': ui.toggleCrt(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'resume': togglePause(); break;
      case 'restart': restartLevel(); break;
      case 'quit': quitToTitle(); break;
      case 'next': nextLevel(); break;
      case 'retry': startRun(G.run ? G.run.startLevel - 1 : 0); break;
      default: break;
    }
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    Sound.unlock();
    try { handleAction(btn.dataset.action, btn); } catch (err) {
      console.error('[game] action failed:', btn.dataset.action, err);
      ui.toast('SOMETHING WENT WRONG: ' + err.message, true);
    }
  });

  function setupTouch() {
    const isTouch = 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch) document.body.classList.add('touch');
    document.querySelectorAll('#touch-controls [data-key]').forEach((btn) => {
      const key = btn.dataset.key;
      const on = (ev) => {
        ev.preventDefault();
        Sound.unlock();
        btn.classList.add('pressed');
        if (key === 'pause') { if (G.state === 'play' || G.state === 'pause') togglePause(); return; }
        touchState[key] = true;
      };
      const off = (ev) => {
        ev.preventDefault();
        btn.classList.remove('pressed');
        if (key !== 'pause') touchState[key] = false;
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
    });
  }

  // Start title music on the first user gesture (browsers block autoplay).
  let audioStarted = false;
  function firstGesture() {
    if (audioStarted) return;
    audioStarted = true;
    Sound.unlock();
    if (G.state === 'title') Sound.music('title');
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') togglePause();
  });
  window.addEventListener('unhandledrejection', (ev) => console.warn('[game] unhandled rejection:', ev.reason));

  // =========================================================
  // MAIN LOOP & BOOT
  // =========================================================
  let lastTime = performance.now();
  let acc = 0;
  let consecutiveErrors = 0;
  function frame(now) {
    acc += Math.min(250, now - lastTime);
    lastTime = now;
    try {
      let steps = 0;
      while (acc >= STEP_MS && steps < 5) { update(); acc -= STEP_MS; steps++; }
      if (steps >= 5) acc = 0;
      render();
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      console.error('[game] frame error:', err);
      if (consecutiveErrors > 30) {
        ui.toast('THE GAME HIT AN ERROR. PLEASE RELOAD THE PAGE.', true);
        return;
      }
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    try {
      if (new URLSearchParams(location.search).has('unlockall')) progress.unlocked = L.LEVELS.length;
      ui.syncCrt();
      ui.syncMuteLabels();
      setupTouch();
      if (Board) {
        Board.onChange((s) => ui.updateAuth(s));
        ui.updateAuth({ status: Board.status(), user: null });
        Board.init().catch((err) => console.warn('[game] leaderboard init failed:', err));
      }
      enterTitle();
    } catch (err) {
      console.error('[game] boot failed:', err);
      const l = $('loading');
      if (l) l.innerHTML = '<p>FAILED TO START. CHECK THE CONSOLE.</p>';
      return;
    }
    requestAnimationFrame(frame);
  }

  // Debug hook for the browser console (read-only use).
  window.SPD = {
    G,
    startRun,
    loadLevel: (i) => { loadLevel(i); beginIntro(false); },
    // Advance the simulation n fixed steps with optional held keys, e.g. SPD.step(60, { right: true }).
    step(n, keys) {
      Object.assign(keyState, keys || {});
      for (let i = 0; i < (n || 1); i++) update();
      render();
      for (const k in keys || {}) keyState[k] = false;
      return { state: G.state, x: Math.round(G.player.x), y: Math.round(G.player.y), hp: G.player.hp, coins: G.coins, lives: G.run && G.run.lives };
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
