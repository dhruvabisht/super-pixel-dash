/* =========================================================
   levels.js — tile definitions, world themes, level tilemaps
   (built with a small layout DSL), enemy pixel art and enemy
   AI behaviours for all five worlds.
   ========================================================= */
(function () {
  'use strict';

  const TILE = 16;
  const ROWS = 14;

  // ---------- Tile ids ----------
  const T = {
    EMPTY: 0, GROUND: 1, BRICK: 2, QBLOCK: 3, USED: 4, PIPE: 5, SPIKE: 6,
    SEMI: 7, CRUMBLE: 8, LAVA: 9, STONE: 10, COIN: 11, CRYSTAL: 12,
  };
  const SOLID = new Set([T.GROUND, T.BRICK, T.QBLOCK, T.USED, T.PIPE, T.SPIKE, T.CRUMBLE, T.STONE]);

  // Characters accepted by builder.row()
  const CHAR = {
    ' ': T.EMPTY, '#': T.GROUND, 'B': T.BRICK, '?': T.QBLOCK, 'U': T.USED, 'P': T.PIPE,
    '^': T.SPIKE, '=': T.SEMI, '~': T.CRUMBLE, 'L': T.LAVA, 'S': T.STONE, 'o': T.COIN, '*': T.CRYSTAL,
  };

  // ---------- Themes (palettes + background style) ----------
  const COMMON = {
    qblock: '#ffc93c', qblockDark: '#b86e00', qmark: '#fff6d0', used: '#8c5a3a', usedDark: '#4a2a14',
    coin: '#ffd23f', coinDark: '#b8860b', coinLight: '#fff6b0',
    spike: '#e6e6f0', spikeDark: '#7a7a96',
    lava: '#ff5a1f', lavaLight: '#ffd23f', lavaDark: '#b81e00',
  };

  const THEMES = {
    grass: Object.assign({}, COMMON, {
      bg: 'hills', bgTop: '#5cc8ff', bgBottom: '#c8f0ff', far: '#9fe0a0', near: '#4caf50', cloud: '#ffffff',
      groundTop: '#56d64a', groundTopDark: '#2a9a2f', ground: '#d27d3c', groundDark: '#8c4a1e', speck: '#f2a65e',
      brick: '#d8642c', brickDark: '#6e2a0e', brickLight: '#f7a46a',
      block: '#c87533', blockLight: '#f5bd7a', blockDark: '#5e2e0c',
      pipe: '#3ec94a', pipeDark: '#1b6b22', pipeLight: '#b4f5a8',
      semiStyle: 'wood', semi: '#e2a04a', semiDark: '#8a5420',
      platform: 'wood', darkness: 0, particle: '#ffffff',
      enemy: {
        walker: { X: '#b0602a', S: '#ffd9a0', K: '#2b1608', W: '#ffffff' },
        spiny: { X: '#e83b3b', Y: '#ffd23f', S: '#ffd9a0', K: '#2b1608', W: '#ffffff' },
        flyer: { X: '#ff7e3b', S: '#ffd23f', K: '#2b1608', W: '#ffffff' },
      },
    }),
    cave: Object.assign({}, COMMON, {
      bg: 'cave', bgTop: '#0b0618', bgBottom: '#24164a', far: '#1d1238', near: '#2e1f57', cloud: '#5cf2ff',
      groundTop: '#7f6bd6', groundTopDark: '#4b3a9a', ground: '#43346a', groundDark: '#241a40', speck: '#6d5c99',
      brick: '#3d58a8', brickDark: '#18213f', brickLight: '#6f8ae0',
      block: '#5a5f82', blockLight: '#9aa0c8', blockDark: '#25283d',
      pipe: '#3a8fd9', pipeDark: '#173d6b', pipeLight: '#a8dcff',
      semiStyle: 'rock', semi: '#6f6299', semiDark: '#352a55',
      platform: 'rock', darkness: 0.62, particle: '#5cf2ff',
      crystalA: '#5cf2ff', crystalB: '#ff7eb6',
      enemy: {
        walker: { X: '#5b7bd6', S: '#cfe0ff', K: '#0b0618', W: '#ffffff' },
        spiny: { X: '#8a4fff', Y: '#5cf2ff', S: '#cfe0ff', K: '#0b0618', W: '#ffffff' },
        flyer: { X: '#7a3fb8', S: '#ff7eb6', K: '#0b0618', W: '#ffe680' },
      },
    }),
    sky: Object.assign({}, COMMON, {
      bg: 'sky', bgTop: '#8fd3ff', bgBottom: '#ffe1f2', far: '#ffffff', near: '#ffd1ec', cloud: '#ffffff',
      groundTop: '#ffffff', groundTopDark: '#a9b4f0', ground: '#d9d0ff', groundDark: '#8f84d6', speck: '#f4f0ff',
      brick: '#ff9ac8', brickDark: '#a83a72', brickLight: '#ffd1e6',
      block: '#ffd6a8', blockLight: '#fff2de', blockDark: '#c47a3a',
      pipe: '#ffb347', pipeDark: '#a8601a', pipeLight: '#ffe2b0',
      semiStyle: 'cloud', semi: '#ffffff', semiDark: '#c9c8f2',
      platform: 'cloud', darkness: 0, particle: '#ffffff',
      enemy: {
        walker: { X: '#ff6fa8', S: '#fff0f6', K: '#3a1030', W: '#ffffff' },
        spiny: { X: '#3a5bd9', Y: '#ffd23f', S: '#fff0f6', K: '#101a40', W: '#ffffff' },
        flyer: { X: '#3ec9c9', S: '#ffd23f', K: '#0e3a3a', W: '#ffffff' },
      },
    }),
    lava: Object.assign({}, COMMON, {
      bg: 'castle', bgTop: '#120303', bgBottom: '#5a1208', far: '#2a0a0a', near: '#3d1010', cloud: '#ff8c1a',
      groundTop: '#8a8a9c', groundTopDark: '#55556a', ground: '#5c5c70', groundDark: '#2e2e3c', speck: '#7a7a90',
      brick: '#6a6a80', brickDark: '#262634', brickLight: '#9a9ab4',
      block: '#707086', blockLight: '#a8a8c0', blockDark: '#2a2a38',
      pipe: '#a83a3a', pipeDark: '#4a1010', pipeLight: '#ff9a8a',
      semiStyle: 'wood', semi: '#8a5a3a', semiDark: '#3a2010',
      platform: 'stone', darkness: 0, particle: '#ffb347',
      enemy: {
        walker: { X: '#8a2a1a', S: '#ffb38a', K: '#1a0505', W: '#ffd23f' },
        spiny: { X: '#c41e1e', Y: '#ffd23f', S: '#ffb38a', K: '#1a0505', W: '#ffffff' },
        flyer: { X: '#4a4a5a', S: '#ff5a1f', K: '#000000', W: '#ffd23f' },
      },
    }),
    fortress: Object.assign({}, COMMON, {
      bg: 'fortress', bgTop: '#07030f', bgBottom: '#3a1a4a', far: '#1a0d2a', near: '#2a1640', cloud: '#8a4fff',
      groundTop: '#9a7ab8', groundTopDark: '#5a3a7a', ground: '#4a3060', groundDark: '#24143a', speck: '#6a4a8a',
      brick: '#5a3a7a', brickDark: '#1e0f30', brickLight: '#8a6aaa',
      block: '#6a5080', blockLight: '#a890c0', blockDark: '#2a1a3a',
      pipe: '#8a4fff', pipeDark: '#3a1a7a', pipeLight: '#d0b0ff',
      semiStyle: 'stone', semi: '#8a7aa0', semiDark: '#3a2a50',
      platform: 'stone', darkness: 0, particle: '#d0b0ff',
      enemy: {
        walker: { X: '#3a3a4a', S: '#d0b0ff', K: '#000000', W: '#ff3b3b' },
        spiny: { X: '#2a2a3a', Y: '#ff3b3b', S: '#d0b0ff', K: '#000000', W: '#ffffff' },
        flyer: { X: '#6a2a8a', S: '#ff3b3b', K: '#000000', W: '#ffd23f' },
      },
    }),
  };

  // ---------- Enemy / boss pixel art (16x16, '.' = transparent) ----------
  const ART = {
    walker: [[
      '................',
      '................',
      '......XXXX......',
      '....XXXXXXXX....',
      '...XXXXXXXXXX...',
      '..XXKKXXXXKKXX..',
      '..XWWKXXXXKWWX..',
      '.XXWKKXXXXKKWXX.',
      '.XXXXXXXXXXXXXX.',
      '.XXXXXKKKKXXXXX.',
      '..XXXXXXXXXXXX..',
      '....SSSSSSSS....',
      '...SSSSSSSSSS...',
      '..KKKSSSSSSKKK..',
      '.KKKKK....KKKKK.',
      '................',
    ], [
      '................',
      '................',
      '......XXXX......',
      '....XXXXXXXX....',
      '...XXXXXXXXXX...',
      '..XXKKXXXXKKXX..',
      '..XWWKXXXXKWWX..',
      '.XXWKKXXXXKKWXX.',
      '.XXXXXXXXXXXXXX.',
      '.XXXXXKKKKXXXXX.',
      '..XXXXXXXXXXXX..',
      '....SSSSSSSS....',
      '...SSSSSSSSSS...',
      '....KKKSSKKK....',
      '...KKKKKKKKKK...',
      '................',
    ]],
    walkerFlat: [[
      '................', '................', '................', '................',
      '................', '................', '................', '................',
      '................', '................', '................',
      '...XXXXXXXXXX...',
      '.XXWKXXXXXXKWXX.',
      '.XXXXXKKKKXXXXX.',
      '..KKKSSSSSSKKK..',
      '................',
    ]],
    spiny: [[
      '................',
      '................',
      '................',
      '...W...W...W....',
      '...WW..WW..WW...',
      '..XXXXXXXXXXX...',
      '.XXXYXXXYXXXXX..',
      '.XXXXXXXXXXXXSS.',
      'XXXYXXXYXXXXSSKS',
      'XXXXXXXXXXXXSSKS',
      'XXXXXXXXXXXXSSSS',
      '.XXXXXXXXXXXSSS.',
      '..YYYYYYYYYYY...',
      '...KK....KK.....',
      '..KKK...KKK.....',
      '................',
    ], [
      '................',
      '................',
      '................',
      '....W...W...W...',
      '...WW..WW..WW...',
      '..XXXXXXXXXXX...',
      '.XXXYXXXYXXXXX..',
      '.XXXXXXXXXXXXSS.',
      'XXXYXXXYXXXXSSKS',
      'XXXXXXXXXXXXSSKS',
      'XXXXXXXXXXXXSSSS',
      '.XXXXXXXXXXXSSS.',
      '..YYYYYYYYYYY...',
      '.....KK....KK...',
      '....KKK...KKK...',
      '................',
    ]],
    flyer: [[
      '................',
      'X..............X',
      'XX............XX',
      'XXX..........XXX',
      '.XXX..XXXX..XXX.',
      '.XXXXXXXXXXXXXX.',
      '..XXXXWKXWKXXX..',
      '...XXXWKXWKXX...',
      '....XXXXXXXX....',
      '....XXSSSSXX....',
      '.....XXXXXX.....',
      '......K..K......',
      '................',
      '................',
      '................',
      '................',
    ], [
      '................',
      '................',
      '................',
      '................',
      '......XXXX......',
      '....XXXXXXXX....',
      '...XXXWKXWKXX...',
      '..XXXXWKXWKXXX..',
      '.XXXXXXXXXXXXXX.',
      'XXX.XXSSSSXX.XXX',
      'XX...XXXXXX...XX',
      'X.....K..K.....X',
      '................',
      '................',
      '................',
      '................',
    ]],
    boss: [[
      '....Y..Y..Y.....',
      '....YYYYYYY.....',
      '...NNNNNNNNN....',
      '..NNSSSSSSSNN...',
      '..NSKWSSSKWSN...',
      '..NSSSSSSSSSN...',
      '..NNSRRRRRSNN...',
      '.NNNNSSSSSNNNN..',
      'NNNNNNNNNNNNNNN.',
      'NSSNNNSSSNNNSSN.',
      'NSSNNSSSSSNNSSN.',
      'NN.NNNNNNNNN.NN.',
      'SS.NNNNNNNNN.SS.',
      'SS.NNNN.NNNN.SS.',
      '...NNN...NNN....',
      '..SSSS...SSSS...',
    ], [
      'SS..Y..Y..Y...SS',
      'SS..YYYYYYY...SS',
      'NN.NNNNNNNNN..NN',
      'NNNNSSSSSSSNNNN.',
      '.NNSKWSSSKWSNN..',
      '..NSSSSSSSSSN...',
      '..NNSRRRRRSNN...',
      '.NNNNSSSSSNNNN..',
      '..NNNNNNNNNNN...',
      '..NNNSSSSSNNN...',
      '..NNSSSSSSSNN...',
      '...NNNNNNNNN....',
      '...NNNNNNNNN....',
      '...NNNN.NNNN....',
      '...NNN...NNN....',
      '..SSSS...SSSS...',
    ]],
  };
  const BOSS_PALETTES = [
    { N: '#6b4a2b', S: '#e0a86a', K: '#000000', W: '#ffffff', R: '#c41e1e', Y: '#ffd23f' },
    { N: '#8a3a22', S: '#ffb38a', K: '#000000', W: '#ffff80', R: '#ffd23f', Y: '#ffd23f' },
    { N: '#4a2a6a', S: '#d0a0ff', K: '#000000', W: '#ff3b3b', R: '#ff3b3b', Y: '#5cf2ff' },
  ];

  // ---------- Layout builder (DSL) ----------
  function makeBuilder(cols) {
    const grid = [];
    for (let y = 0; y < ROWS; y++) grid.push(new Array(cols).fill(T.EMPTY));
    const spawns = [];
    const b = {
      cols, grid, spawns, start: { x: 2, y: 11 },
      set(x, y, t) { if (x >= 0 && x < cols && y >= 0 && y < ROWS) grid[y][x] = t; },
      fill(x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.set(x, y, t); },
      ground(x0, x1, top = 12, t = T.GROUND) { b.fill(x0, top, x1, ROWS - 1, t); },
      ceiling(x0, x1, bottom = 1, t = T.GROUND) { b.fill(x0, 0, x1, bottom, t); },
      row(x, y, str) {
        for (let i = 0; i < str.length; i++) {
          const t = CHAR[str[i]];
          if (t !== undefined) b.set(x + i, y, t);
        }
      },
      pipe(x, h, top = 12) { b.fill(x, top - h, x + 1, top - 1, T.PIPE); },
      coins(x, y, n, step = 1) { for (let i = 0; i < n; i++) b.set(x + i * step, y, T.COIN); },
      arc(x, y, n) {
        for (let i = 0; i < n; i++) {
          const k = (i / (n - 1)) * 2 - 1;
          b.set(x + i, y - Math.round((1 - k * k) * 2), T.COIN);
        }
      },
      stairs(x, h, dir = 1, t = T.STONE, top = 12) {
        for (let i = 0; i < h; i++) {
          const col = dir > 0 ? x + i : x + (h - 1 - i);
          b.fill(col, top - 1 - i, col, top - 1, t);
        }
      },
      enemy(type, x, y, opts) { spawns.push(Object.assign({ type, tx: x, ty: y }, opts || {})); },
      player(x, y) { b.start = { x, y }; },
      checkpoint(x, y = 11) { b.enemy('checkpoint', x, y); },
      goal(x, y = 11) { b.enemy('goal', x, y); },
    };
    return b;
  }

  // Levels are appended below (see LEVELS list).
  const LEVELS = [];

  window.Levels = { TILE, ROWS, T, SOLID, THEMES, ART, BOSS_PALETTES, LEVELS, makeBuilder, BEHAVIORS: {} };
})();

/* =========================================================
   LEVEL LAYOUTS — 14 rows tall, built with the builder DSL.
   Tile coords: x = column, y = row (0 = top, ground top = 12).
   Physics budget: max jump ≈ 3 tiles up, ≈ 5 tiles across.
   ========================================================= */
(function () {
  'use strict';
  const { T, LEVELS } = window.Levels;

  // ---------------- WORLD 1: GRASSLAND ----------------
  LEVELS.push({
    id: 1, key: 'grass', name: 'GRASSLAND', blurb: 'Rolling hills & green pipes', theme: 'grass', music: 'overworld', cols: 212,
    build(b) {
      b.player(3, 11);
      b.ground(0, 40); b.ground(44, 85); b.ground(89, 118); b.ground(127, 160); b.ground(164, 211);

      b.row(10, 8, '?');
      b.row(14, 8, 'B?B?B');
      b.row(16, 4, '?');
      b.enemy('walker', 20, 11);
      b.pipe(24, 2);
      b.enemy('walker', 28, 11);
      b.pipe(32, 3);
      b.coins(36, 9, 3);
      b.arc(40, 9, 5);

      b.row(47, 8, 'B?B');
      b.row(52, 5, 'BBBBBBB');
      b.coins(53, 4, 5);
      b.enemy('walker', 54, 11);
      b.enemy('walker', 57, 11);
      b.enemy('flyer', 62, 7, { mode: 'hover', range: 2 });

      b.stairs(66, 4, 1); b.stairs(70, 4, -1);
      b.coins(68, 6, 4);
      b.coins(76, 9, 5);
      b.enemy('walker', 79, 11);
      b.pipe(82, 2);
      b.arc(85, 9, 5);

      // Barrel alley — a tribute to the arcade ape
      b.row(94, 8, '?B?B?');
      b.checkpoint(100);
      b.coins(104, 9, 4);
      b.enemy('barrelSpawner', 116, 11, { dir: -1, interval: 170 });

      // Moving platform across the wide gap
      b.enemy('platform', 119, 10, { w: 3, axis: 'x', range: 5, speed: 0.8 });
      b.coins(120, 7, 6);

      b.pipe(132, 3);
      b.enemy('walker', 136, 11);
      b.pipe(140, 2);
      b.row(144, 8, 'BB?BB?B');
      b.coins(144, 7, 7);
      b.enemy('walker', 147, 11);
      b.enemy('walker', 151, 11);
      b.enemy('flyer', 156, 8, { mode: 'patrol', range: 3 });
      b.arc(160, 9, 5);

      b.coins(168, 9, 4);
      b.enemy('walker', 172, 11);
      b.stairs(176, 8, 1);
      b.goal(192);
    },
  });

  // ---------------- WORLD 2: UNDERGROUND CAVERN ----------------
  LEVELS.push({
    id: 2, key: 'cave', name: 'CRYSTAL CAVERN', blurb: 'Dark tunnels & dripping ceilings', theme: 'cave', music: 'cave', cols: 212,
    build(b) {
      b.player(2, 11);
      b.ceiling(0, 211);
      b.ground(0, 30);
      b.row(4, 2, '*...*.....*....*..*');
      b.row(10, 8, '?B?');
      b.enemy('walker', 15, 11);
      b.enemy('drip', 18, 2, { interval: 120 });
      b.coins(20, 10, 4);
      b.enemy('walker', 24, 11);

      b.ground(31, 33, 13); b.row(31, 12, '^^^');
      b.arc(30, 9, 5);
      b.ground(34, 70);

      // Low tunnel
      b.fill(40, 2, 48, 7, T.GROUND);
      b.coins(41, 10, 7);
      b.enemy('walker', 46, 11);
      b.row(52, 8, 'B?BB?B');
      b.row(50, 2, '*.....*');
      b.enemy('flyer', 58, 3, { mode: 'swoop' });
      b.enemy('spiny', 64, 11);

      // Crumbling rocks over a spike floor
      b.ground(71, 84, 13); b.row(71, 12, '^^^^^^^^^^^^^^');
      b.row(73, 9, '~~~'); b.row(78, 9, '~~~');
      b.coins(73, 7, 3); b.coins(78, 7, 3);

      b.ground(85, 130);
      b.enemy('drip', 90, 2, { interval: 100 });
      b.enemy('drip', 96, 2, { interval: 100, offset: 50 });
      b.row(92, 8, '?');
      b.enemy('spiny', 100, 11);
      b.checkpoint(104);
      b.row(110, 9, '####');
      b.row(116, 6, '####');
      b.coins(116, 5, 4);
      b.row(108, 2, '*..*..*...*');
      b.enemy('walker', 120, 11);
      b.enemy('flyer', 124, 3, { mode: 'swoop' });

      // Bottomless chasm
      b.arc(130, 9, 6);
      b.row(131, 2, '*.*.*');
      b.ground(135, 175);
      b.row(140, 9, 'B?BB?B');
      b.coins(140, 7, 6);
      b.enemy('walker', 143, 11);
      b.row(150, 11, '^^');
      b.enemy('spiny', 156, 11);
      b.row(160, 11, '^^');
      b.coins(164, 9, 5);
      b.enemy('flyer', 163, 3, { mode: 'swoop' });
      b.enemy('drip', 167, 2, { interval: 90 });
      b.row(150, 2, '*....*....*....*');

      b.ground(179, 211);
      b.arc(175, 9, 5);
      b.stairs(186, 4, 1);
      b.goal(198);
      b.row(180, 2, '*...*...*...*...*.*');
    },
  });

  // ---------------- WORLD 3: SKY KINGDOM ----------------
  LEVELS.push({
    id: 3, key: 'sky', name: 'SKY KINGDOM', blurb: 'Cloud hopping in gusty winds', theme: 'sky', music: 'sky', cols: 222,
    build(b) {
      b.player(2, 11);
      b.ground(0, 14);
      b.coins(5, 9, 3);
      b.row(17, 10, '===='); b.coins(17, 8, 4);
      b.row(24, 8, '===='); b.coins(24, 6, 4);
      b.row(31, 10, '====');
      b.ground(37, 50);
      b.enemy('walker', 42, 11);
      b.row(44, 8, '?B?');

      // Headwind zone
      b.enemy('wind', 52, 0, { x1: 75, force: -0.7 });
      b.row(53, 11, '====');
      b.row(60, 9, '===='); b.coins(60, 7, 4);
      b.row(67, 11, '====');
      b.ground(73, 90);
      b.enemy('flyer', 78, 6, { mode: 'hover', range: 3 });
      b.checkpoint(82);
      b.enemy('walker', 86, 11);

      // Moving platforms
      b.enemy('platform', 92, 10, { w: 3, axis: 'x', range: 7, speed: 0.9 });
      b.coins(94, 7, 5);
      b.row(103, 8, '===='); b.coins(103, 6, 4);
      b.enemy('platform', 109, 6, { w: 3, axis: 'y', range: 5, speed: 0.6 });

      b.ground(114, 140);
      b.row(118, 8, '?B?B');
      b.enemy('spiny', 124, 11);
      b.enemy('flyer', 130, 7, { mode: 'patrol', range: 4 });
      b.coins(134, 10, 4);

      // Tailwind zone — big cloud jumps
      b.enemy('wind', 141, 0, { x1: 171, force: 0.8 });
      b.row(144, 10, '===='); b.coins(144, 8, 4);
      b.row(151, 9, '====');  b.coins(151, 7, 4);
      b.row(158, 10, '===='); b.coins(158, 8, 4);
      b.row(165, 9, '====');  b.coins(165, 7, 4);
      b.enemy('flyer', 156, 5, { mode: 'hover', range: 2 });

      b.ground(172, 221);
      b.enemy('walker', 180, 11);
      b.stairs(188, 5, 1);
      b.goal(206);
    },
  });

  // ---------------- WORLD 4: LAVA CASTLE ----------------
  LEVELS.push({
    id: 4, key: 'lava', name: 'LAVA CASTLE', blurb: 'Fire bars, crumbling bridges, rising lava', theme: 'lava', music: 'lava', cols: 222,
    build(b) {
      b.player(2, 11);
      b.ceiling(0, 221, 1, T.STONE);
      b.ground(0, 24);
      b.row(8, 8, '?S?');
      b.enemy('spiny', 14, 11);
      b.set(20, 8, T.USED); b.enemy('firebar', 20, 8, { len: 5, speed: 0.035 });

      b.fill(25, 12, 28, 13, T.LAVA);
      b.enemy('podoboo', 26, 13, { height: 7, interval: 150 });
      b.ground(29, 50);
      b.row(34, 9, 'SSS'); b.coins(34, 8, 3);
      b.enemy('spiny', 38, 11);
      b.coins(40, 10, 3);
      b.set(44, 7, T.USED); b.enemy('firebar', 44, 7, { len: 4, speed: -0.045 });

      // Crumbling bridge #1
      b.fill(51, 12, 62, 13, T.LAVA);
      b.row(51, 12, '~~~~~~~~~~~~');
      b.coins(52, 9, 10);

      b.ground(63, 90);
      b.checkpoint(66);
      b.enemy('spiny', 72, 11);
      b.row(74, 8, '?B?');
      b.set(80, 9, T.USED); b.enemy('firebar', 80, 9, { len: 6, speed: 0.03 });
      b.enemy('walker', 86, 11);

      // Rising lava climb
      b.ground(91, 140);
      b.enemy('risingLava', 91, 13, { x1: 140, maxRow: 7, speed: 0.2, delay: 60 });
      b.row(96, 10, 'SSS');
      b.row(102, 8, 'SSS');
      b.row(108, 6, 'SSSS'); b.coins(108, 5, 4);
      b.row(115, 6, 'SSSS'); b.coins(115, 5, 4);
      b.row(122, 5, 'SSSS'); b.coins(122, 4, 4);
      b.row(129, 6, 'SSSS'); b.coins(129, 5, 4);
      b.row(136, 6, 'SSS');
      b.fill(141, 6, 144, 13, T.STONE);

      b.ground(141, 159);
      b.stairs(145, 5, -1);
      b.enemy('spiny', 153, 11);
      b.fill(160, 12, 163, 13, T.LAVA);
      b.enemy('podoboo', 161, 13, { height: 8, interval: 140 });
      b.arc(159, 9, 6);
      b.ground(164, 167);
      b.set(166, 7, T.USED); b.enemy('firebar', 166, 7, { len: 5, speed: 0.05 });

      // Crumbling bridge #2
      b.fill(168, 12, 175, 13, T.LAVA);
      b.row(168, 12, '~~~~~~~~');
      b.coins(169, 9, 6);
      b.ground(176, 221);
      b.enemy('spiny', 186, 11);
      b.stairs(190, 4, 1);
      b.goal(206);
    },
  });

  // ---------------- WORLD 5: BOSS FORTRESS ----------------
  LEVELS.push({
    id: 5, key: 'fortress', name: 'IRON FORTRESS', blurb: 'Defeat Grokk the Iron Ape!', theme: 'fortress', music: 'lava', cols: 68, boss: true,
    build(b) {
      b.player(2, 11);
      b.ceiling(0, 67, 1, T.STONE);
      b.ground(0, 29);
      b.row(8, 11, '^^');
      b.set(14, 8, T.USED); b.enemy('firebar', 14, 8, { len: 5, speed: 0.04 });
      b.row(18, 11, '^^^');
      b.coins(17, 8, 5);
      b.enemy('spiny', 23, 11);
      b.row(25, 8, '?S?');
      b.fill(30, 12, 33, 13, T.LAVA);
      b.enemy('podoboo', 31, 13, { height: 7, interval: 120 });
      b.ground(34, 67);
      b.checkpoint(38);
      b.coins(39, 10, 3);

      // Arena: door (col 44) slams shut when the fight starts; right wall col 67.
      b.fill(67, 2, 67, 11, T.STONE);
      b.row(47, 9, '====');
      b.row(60, 9, '====');
      b.enemy('bossTrigger', 47, 11, { door: 44 });
      b.enemy('boss', 60, 11);
    },
  });
})();

/* =========================================================
   ENEMY AI & HAZARD BEHAVIOURS
   Each behaviour: init(e, W), update(e, W), draw(e, W, ctx, sx, sy)
   and optionally onStomp / onBump / onTouch / collide.
   `W` is the world API exposed by game.js.
   ========================================================= */
(function () {
  'use strict';
  const L = window.Levels;
  const { TILE, ROWS, BOSS_PALETTES } = L;
  const B = L.BEHAVIORS;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Enemies wake up when they first scroll into view.
  function awake(e, W) {
    if (!e.active && W.inView(e, 40)) e.active = true;
    return e.active;
  }

  function deadFall(e, W) {
    e.vy += 0.3;
    e.x += e.vx;
    e.y += e.vy;
    if (e.y > W.heightPx + 40) e.remove = true;
  }

  function knockOut(e, W, dir) {
    e.dead = true;
    e.harmful = e.stompable = false;
    e.vy = -4.5;
    e.vx = (dir || (Math.random() < 0.5 ? -1 : 1)) * 0.9;
    W.sfx('stomp');
  }

  function puff(W, x, y, color) {
    W.burst(x, y, { count: 8, colors: [color || '#ffffff', '#dddddd'], speed: 1.6, life: 22, gravity: 0.02, size: 2 });
  }

  // ---------------- Walker (stompable) ----------------
  B.walker = {
    init(e) {
      e.w = 14; e.h = 14;
      e.vx = 0.5 * (e.dir || -1);
      e.stompable = true; e.harmful = true;
    },
    update(e, W) {
      if (e.squash) { if (--e.squash <= 0) e.remove = true; return; }
      if (e.dead) return deadFall(e, W);
      if (!awake(e, W)) return;
      W.move(e);
      if (e.hitWall) e.vx = -e.vx;
      if (e.edgeTurn && e.onGround && !W.groundAhead(e)) e.vx = -e.vx;
      if (e.y > W.heightPx + 32) e.remove = true;
    },
    onStomp(e, W) {
      e.squash = 30;
      e.harmful = e.stompable = false;
      W.sfx('stomp');
      puff(W, e.x + 7, e.y + 10);
    },
    onBump(e, W) { knockOut(e, W); },
    draw(e, W, ctx, sx, sy) {
      const pal = W.theme.enemy.walker;
      if (e.squash) W.sprite('walkerFlat', 0, sx - 1, sy - 2, { palette: pal });
      else W.sprite('walker', (W.frame >> 3) & 1, sx - 1, sy - 2, { palette: pal, flipY: e.dead });
    },
  };

  // ---------------- Spiny (cannot be stomped) ----------------
  B.spiny = {
    init(e) {
      e.w = 14; e.h = 13;
      e.vx = 0.6 * (e.dir || -1);
      e.stompable = false; e.harmful = true;
      if (e.edgeTurn === undefined) e.edgeTurn = true;
    },
    update(e, W) {
      if (e.dead) return deadFall(e, W);
      if (!awake(e, W)) return;
      W.move(e);
      if (e.hitWall) e.vx = -e.vx;
      if (e.edgeTurn && e.onGround && !W.groundAhead(e)) e.vx = -e.vx;
      if (e.y > W.heightPx + 32) e.remove = true;
    },
    onBump(e, W) { knockOut(e, W); },
    draw(e, W, ctx, sx, sy) {
      W.sprite('spiny', (W.frame >> 3) & 1, sx - 1, sy - 3, { palette: W.theme.enemy.spiny, flip: e.vx < 0, flipY: e.dead });
    },
  };

  // ---------------- Flyer (hover / patrol / swoop) ----------------
  B.flyer = {
    init(e) {
      e.w = 14; e.h = 10;
      e.stompable = true; e.harmful = true;
      e.mode = e.mode || 'hover';
      e.range = e.range || 2;
      e.t = 0;
      e.state = 'hang';
    },
    update(e, W) {
      if (e.dead) return deadFall(e, W);
      if (e.homeX === undefined) { e.homeX = e.x; e.homeY = e.y; }
      if (!awake(e, W)) return;
      e.t++;
      const P = W.P;
      if (e.mode === 'hover') {
        e.y = e.homeY + Math.sin(e.t * 0.04) * e.range * TILE;
        e.x = e.homeX + Math.sin(e.t * 0.02) * 6;
        e.face = P.x < e.x ? -1 : 1;
      } else if (e.mode === 'patrol') {
        const nx = e.homeX + Math.sin(e.t * 0.02) * e.range * TILE;
        e.face = nx < e.x ? -1 : 1;
        e.x = nx;
        e.y = e.homeY + Math.sin(e.t * 0.09) * 6;
      } else { // swoop: hang from the ceiling, dive at the player in an arc
        if (e.state === 'hang') {
          const dx = (P.x + P.w / 2) - (e.x + e.w / 2);
          if (Math.abs(dx) < 96 && P.y > e.y && !P.dead) {
            e.state = 'dive';
            e.vx = Math.sign(dx || 1) * 1.7;
            e.vy = 2.6;
            e.face = Math.sign(e.vx);
          }
        } else if (e.state === 'dive') {
          e.vy -= 0.055;
          e.x += e.vx;
          e.y += e.vy;
          if (e.y <= e.homeY && e.vy < 0) { e.y = e.homeY; e.state = 'cruise'; e.t = 0; }
        } else if (e.state === 'cruise') {
          e.x += e.vx * 0.6;
          if (e.t > 50) { e.state = 'hang'; e.homeX = e.x; }
        }
      }
    },
    onStomp(e, W) { knockOut(e, W); puff(W, e.x + 7, e.y + 5); },
    onBump(e, W) { knockOut(e, W); },
    draw(e, W, ctx, sx, sy) {
      const flapRate = e.mode === 'swoop' && e.state === 'hang' ? 5 : 3;
      W.sprite('flyer', (W.frame >> flapRate) & 1, sx - 1, sy - 3, { palette: W.theme.enemy.flyer, flip: e.face < 0, flipY: e.dead });
    },
  };

  // ---------------- Rolling barrel ----------------
  B.barrel = {
    init(e) {
      e.w = 14; e.h = 14;
      e.vx = (e.speed || 1.4) * (e.dir || -1);
      e.vy = e.vy || 0;
      e.gravity = 0.3;
      e.stompable = true; e.harmful = true;
      e.rot = 0;
      e.active = true;
    },
    update(e, W) {
      if (e.dead) return deadFall(e, W);
      const vy0 = e.vy;
      const wasGround = e.onGround;
      W.move(e);
      if (e.hitWall) { e.vx = -e.vx; W.sfx('barrel'); }
      if (e.onGround && !wasGround && vy0 > 2.5) {
        e.vy = -vy0 * 0.35;
        if (W.inView(e, 0)) W.sfx('barrel');
      }
      e.rot += Math.abs(e.vx) * 0.15;
      if (e.life !== undefined && --e.life <= 0) B.barrel.onStomp(e, W, true);
      if (e.y > W.heightPx + 32) e.remove = true;
    },
    onStomp(e, W, silent) {
      e.remove = true;
      if (!silent) W.sfx('brick');
      W.burst(e.x + 7, e.y + 7, { count: 10, colors: ['#c8742c', '#5a2a0a', '#e8a060'], speed: 2.5, life: 35, gravity: 0.25, size: 3 });
    },
    onBump(e, W) { knockOut(e, W); },
    draw(e, W, ctx, sx, sy) {
      W.sprite('barrel', Math.floor(e.rot) & 1, sx - 1, sy - 1, { flipY: e.dead });
    },
  };

  // ---------------- Barrel stack that keeps rolling barrels ----------------
  B.barrelSpawner = {
    init(e) {
      e.w = 30; e.h = 30;
      e.timer = 40;
      e.interval = e.interval || 160;
    },
    update(e, W) {
      if (!W.inView(e, 96)) return;
      const P = W.P;
      if (--e.timer <= 0) {
        e.timer = e.interval;
        if (!P.dead && (e.dir < 0 ? P.x < e.x : P.x > e.x)) {
          W.spawn('barrel', e.x + (e.dir < 0 ? -10 : e.w - 4), e.y + e.h - 14, { dir: e.dir, speed: 1.4 });
          W.sfx('barrel');
        }
      }
    },
    draw(e, W, ctx, sx, sy) {
      const shake = e.timer < 20 ? ((W.frame >> 1) & 1) : 0;
      W.sprite('barrel', 0, sx, sy + 14);
      W.sprite('barrel', 1, sx + 14, sy + 14);
      W.sprite('barrel', 0, sx + 7 + shake, sy);
    },
  };

  // ---------------- Fireball projectile ----------------
  B.fireball = {
    init(e) {
      e.r = e.r || 4;
      e.w = e.h = e.r * 2;
      e.life = e.life || 360;
      e.harmful = !(e.delay > 0);
      e.customPos = true;
    },
    update(e, W) {
      if (e.delay > 0) {
        if (--e.delay === 0) { e.harmful = true; W.sfx('fireball'); }
        return;
      }
      e.vy += e.gravity || 0;
      e.x += e.vx || 0;
      e.y += e.vy || 0;
      if (--e.life <= 0) e.remove = true;
      if (e.collides && W.solidPx(e.x + e.r, e.y + e.r * 2)) {
        e.remove = true;
        W.burst(e.x + e.r, e.y + e.r, { count: 8, colors: ['#ffd23f', '#ff5a1f'], speed: 2, life: 20, gravity: 0.1, size: 2 });
      }
      if (e.y > W.heightPx + 16 || e.y < -64 || e.x < -64 || e.x > W.widthPx + 64) e.remove = true;
    },
    draw(e, W, ctx, sx, sy) {
      if (e.delay > 0) {
        if ((W.frame >> 2) & 1) {
          ctx.fillStyle = '#ff3b3b';
          ctx.fillRect(sx, 34, e.w, 3);
          ctx.fillRect(sx + e.r - 1, 38, 2, 4);
        }
        return;
      }
      W.drawFireball(sx + e.r, sy + e.r, e.r);
    },
  };

  // ---------------- Podoboo (lava fireball that leaps) ----------------
  B.podoboo = {
    init(e) {
      e.customPos = true;
      e.w = 12; e.h = 12;
      e.x = e.tx * TILE + 2;
      e.baseY = (e.ty + 1) * TILE + 4;
      e.y = e.baseY;
      e.state = 'wait';
      e.timer = e.delay || 40;
      e.interval = e.interval || 150;
      e.jumpV = -Math.sqrt(2 * 0.25 * (e.height || 6) * TILE);
      e.harmful = false;
    },
    update(e, W) {
      if (e.state === 'wait') {
        if (--e.timer <= 0) {
          e.state = 'jump';
          e.vy = e.jumpV;
          e.harmful = true;
          if (W.inView(e, 0)) W.sfx('lava');
          W.burst(e.x + 6, e.baseY - 8, { count: 6, colors: ['#ffd23f', '#ff5a1f'], speed: 1.5, life: 20, gravity: 0.15, size: 2 });
        }
      } else {
        e.vy += 0.25;
        e.y += e.vy;
        if (e.vy > 0 && e.y >= e.baseY) {
          e.y = e.baseY;
          e.state = 'wait';
          e.timer = e.interval;
          e.harmful = false;
        }
      }
    },
    draw(e, W, ctx, sx, sy) {
      if (e.state === 'jump') W.drawFireball(sx + 6, sy + 6, 6, e.vy > 0);
    },
  };

  // ---------------- Fire bar (rotating chain of fireballs) ----------------
  B.firebar = {
    init(e) {
      e.customPos = true;
      e.len = e.len || 5;
      e.cx = e.tx * TILE + 8;
      e.cy = e.ty * TILE + 8;
      e.angle = e.angle || 0;
      e.speed = e.speed || 0.04;
      e.x = e.cx - e.len * 8; e.y = e.cy - e.len * 8;
      e.w = e.h = e.len * 16;
    },
    update(e) { e.angle += e.speed; },
    collide(e, W, P) {
      if (P.dead || P.invuln > 0) return;
      const ca = Math.cos(e.angle), sa = Math.sin(e.angle);
      for (let i = 1; i < e.len; i++) {
        const fx = e.cx + ca * i * 8, fy = e.cy + sa * i * 8;
        const nx = clamp(fx, P.x + 1, P.x + P.w - 1), ny = clamp(fy, P.y + 1, P.y + P.h - 1);
        if ((fx - nx) * (fx - nx) + (fy - ny) * (fy - ny) < 16) { W.hurtPlayer(e); return; }
      }
    },
    draw(e, W, ctx) {
      const ca = Math.cos(e.angle), sa = Math.sin(e.angle);
      for (let i = 0; i < e.len; i++) {
        W.drawFireball(Math.round(e.cx + ca * i * 8 - W.cam.x), Math.round(e.cy + sa * i * 8 - W.cam.y), 4);
      }
    },
  };

  // ---------------- Ceiling drip ----------------
  B.drip = {
    init(e) {
      e.customPos = true;
      e.x = e.tx * TILE + 5; e.y = e.ty * TILE;
      e.homeY = e.y;
      e.w = 6; e.h = 8;
      e.interval = e.interval || 110;
      e.timer = e.offset || 0;
      e.state = 'grow';
      e.harmful = false;
    },
    update(e, W) {
      if (!W.inView(e, 64)) return;
      if (e.state === 'grow') {
        if (++e.timer >= e.interval) { e.state = 'fall'; e.vy = 0; e.harmful = true; }
      } else {
        e.vy = Math.min(e.vy + 0.25, 6);
        e.y += e.vy;
        if (W.solidPx(e.x + 3, e.y + e.h) || e.y > W.heightPx) {
          W.burst(e.x + 3, e.y + e.h, { count: 6, colors: [W.theme.crystalA || '#5cf2ff', '#ffffff'], speed: 1.4, life: 18, gravity: 0.15, size: 2, up: true });
          if (W.inView(e, 0)) W.sfx('drip');
          e.state = 'grow'; e.timer = 0; e.y = e.homeY; e.harmful = false;
        }
      }
    },
    draw(e, W, ctx, sx, sy) {
      const c = W.theme.crystalA || '#5cf2ff';
      ctx.fillStyle = c;
      if (e.state === 'grow') {
        const s = Math.floor((e.timer / e.interval) * 4);
        ctx.fillRect(sx + 1, sy, 4, 1 + s);
        if (s > 2) ctx.fillRect(sx + 2, sy + 1 + s, 2, 2);
      } else {
        ctx.fillRect(sx + 2, sy, 2, 2);
        ctx.fillRect(sx + 1, sy + 2, 4, 4);
        ctx.fillRect(sx, sy + 3, 6, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 1, sy + 3, 1, 2);
      }
    },
  };

  // ---------------- Moving platform (one-way, rideable) ----------------
  B.platform = {
    init(e) {
      e.customPos = true;
      e.tilesW = e.w || 3;
      e.w = e.tilesW * TILE;
      e.h = 8;
      e.x0 = e.tx * TILE; e.y0 = e.ty * TILE;
      e.x = e.x0; e.y = e.y0;
      e.platform = true;
      e.dist = (e.range || 4) * TILE;
      e.speed = e.speed || 0.8;
      e.phase = 0;
      e.dx = e.dy = 0;
    },
    update(e) {
      const px = e.x, py = e.y;
      e.phase += (e.speed * 2) / e.dist;
      const off = (1 - Math.cos(e.phase)) / 2 * e.dist;
      if (e.axis === 'y') e.y = e.y0 + off; else e.x = e.x0 + off;
      e.dx = e.x - px; e.dy = e.y - py;
    },
    draw(e, W, ctx, sx, sy) {
      const th = W.theme;
      const style = th.platform;
      if (style === 'cloud') {
        ctx.fillStyle = th.semiDark;
        ctx.fillRect(sx + 2, sy + 4, e.w - 4, 6);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < e.tilesW * 2; i++) ctx.fillRect(sx + i * 8, sy + ((i & 1) ? 1 : 0), 8, 7);
        ctx.fillRect(sx + 2, sy - 2, e.w - 4, 4);
      } else {
        const main = style === 'wood' ? '#c8742c' : th.block;
        const dark = style === 'wood' ? '#5a2a0a' : th.blockDark;
        const light = style === 'wood' ? '#f0b070' : th.blockLight;
        ctx.fillStyle = dark; ctx.fillRect(sx, sy, e.w, e.h);
        ctx.fillStyle = main; ctx.fillRect(sx + 1, sy + 1, e.w - 2, e.h - 2);
        ctx.fillStyle = light; ctx.fillRect(sx + 1, sy + 1, e.w - 2, 1);
        ctx.fillStyle = dark;
        for (let i = 1; i < e.tilesW * 2; i++) ctx.fillRect(sx + i * 8, sy + 2, 1, e.h - 3);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(sx + 3, sy + 3, 2, 2); ctx.fillRect(sx + e.w - 5, sy + 3, 2, 2);
      }
    },
  };

  // ---------------- Wind gust zone ----------------
  B.wind = {
    init(e) {
      e.customPos = true;
      e.x = e.tx * TILE;
      e.w = (e.x1 + 1) * TILE - e.x;
      e.y = 0; e.h = ROWS * TILE;
      e.period = e.period || 300;
      e.onFrames = e.onFrames || 170;
      e.t = 0; e.on = false; e.warn = false;
      e.streaks = [];
    },
    update(e, W) {
      e.t++;
      const ph = e.t % e.period;
      const was = e.on;
      e.on = ph < e.onFrames;
      e.warn = !e.on && ph > e.period - 50;
      const P = W.P;
      const inside = P.x + P.w > e.x && P.x < e.x + e.w;
      if (e.on && !was && inside) W.sfx('wind');
      if (e.on && inside && !P.dead) P.windX += e.force;
      if ((e.on || e.warn) && W.inView(e, 0) && W.frame % (e.on ? 2 : 8) === 0) {
        const vx0 = Math.max(e.x, W.cam.x), vx1 = Math.min(e.x + e.w, W.cam.x + W.viewW);
        e.streaks.push({ x: vx0 + Math.random() * (vx1 - vx0), y: 24 + Math.random() * 180, len: 8 + Math.random() * 18, life: 30 });
      }
      for (const s of e.streaks) { s.x += e.force * 7; s.life--; }
      e.streaks = e.streaks.filter((s) => s.life > 0);
    },
    draw(e, W, ctx) {
      for (const s of e.streaks) {
        ctx.globalAlpha = Math.min(1, s.life / 15) * (e.on ? 0.8 : 0.35);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(s.x - W.cam.x), Math.round(s.y), Math.round(s.len), 1);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ---------------- Rising lava section ----------------
  B.risingLava = {
    init(e) {
      e.customPos = true;
      e.x = e.tx * TILE;
      e.x1px = (e.x1 + 1) * TILE;
      e.w = e.x1px - e.x;
      e.baseY = ROWS * TILE + 4;
      e.maxY = (e.maxRow || 7) * TILE;
      e.level = e.baseY;
      e.y = e.level; e.h = 0;
      e.triggered = false;
      e.timer = 0;
    },
    update(e, W) {
      const P = W.P;
      const inside = P.x + P.w > e.x && P.x < e.x1px;
      if (inside && !e.triggered && !P.dead) {
        e.triggered = true;
        e.timer = e.delay || 60;
        W.sfx('lava');
        W.shake(2, 50);
        W.message('THE LAVA IS RISING!');
      }
      if (e.triggered) {
        if (e.timer > 0) e.timer--;
        else if (inside) e.level = Math.max(e.maxY, e.level - e.speed);
        else if (P.x >= e.x1px) e.level = Math.min(e.baseY, e.level + 1);
        if (inside && W.frame % 100 === 0) W.sfx('lava');
        if (W.frame % 6 === 0 && e.level < e.baseY) {
          const vx0 = Math.max(e.x, W.cam.x);
          W.burst(vx0 + Math.random() * W.viewW, e.level, { count: 1, colors: ['#ffd23f', '#ff8c1a'], speed: 0.6, life: 40, gravity: -0.03, size: 2 });
        }
      }
      e.y = e.level;
      e.h = e.baseY - e.level + 40;
    },
    collide(e, W, P) {
      if (!P.dead && P.y + P.h > e.level + 5 && P.x + P.w > e.x && P.x < e.x1px) W.killPlayer('lava');
    },
    draw(e, W, ctx, sx) {
      if (e.level >= e.baseY) return;
      const th = W.theme;
      const top = Math.round(e.level - W.cam.y);
      const x0 = Math.max(0, sx), x1 = Math.min(W.viewW, sx + e.w);
      ctx.fillStyle = th.lavaDark;
      ctx.fillRect(x0, top + 4, x1 - x0, W.viewH - top);
      ctx.fillStyle = th.lava;
      for (let x = x0; x < x1; x += 4) {
        const wave = Math.round(Math.sin((x + W.cam.x) * 0.08 + W.frame * 0.1) * 2);
        ctx.fillRect(x, top + wave, 4, 8);
      }
      ctx.fillStyle = th.lavaLight;
      for (let x = x0; x < x1; x += 8) {
        const wave = Math.round(Math.sin((x + W.cam.x) * 0.08 + W.frame * 0.1) * 2);
        ctx.fillRect(x + 1, top + wave, 3, 2);
      }
    },
  };

  // ---------------- Checkpoint flag ----------------
  B.checkpoint = {
    init(e, W) {
      e.w = 12; e.h = 32;
      e.reached = !!(W.checkpoint && W.checkpoint.tx === e.tx);
    },
    onTouch(e, W) {
      if (e.reached) return;
      e.reached = true;
      W.setCheckpoint(e);
      W.sfx('checkpoint');
      W.burst(e.x + 6, e.y + 4, { count: 16, colors: ['#3ec94a', '#ffd23f', '#ffffff'], speed: 2.2, life: 35, gravity: 0.06, size: 2 });
    },
    draw(e, W, ctx, sx, sy) {
      ctx.fillStyle = '#d0d0e0';
      ctx.fillRect(sx + 1, sy, 2, e.h);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(sx, sy - 2, 4, 3);
      const wave = e.reached ? Math.round(Math.sin(W.frame * 0.15) * 1.5) : 0;
      ctx.fillStyle = e.reached ? '#3ec94a' : '#7a7a96';
      ctx.fillRect(sx + 3, sy + 2 + wave, 9, 7);
      ctx.fillStyle = e.reached ? '#ffffff' : '#b0b0c8';
      ctx.fillRect(sx + 6, sy + 4 + wave, 3, 3);
    },
  };

  // ---------------- Goal flagpole (+ castle) ----------------
  B.goal = {
    init(e) {
      e.customPos = true;
      e.x = e.tx * TILE + 6;
      e.w = 4;
      e.y = (e.ty - 8) * TILE;
      e.h = 9 * TILE;
      e.flagY = 0;
      e.done = false;
    },
    onTouch(e, W) {
      if (e.done) return;
      e.done = true;
      W.completeLevel(e);
    },
    update(e) { if (e.done) e.flagY = Math.min(e.flagY + 2, e.h - 26); },
    draw(e, W, ctx, sx, sy) {
      const th = W.theme;
      // castle (5 tiles to the right of the pole)
      const cx = sx + 56, cy = sy + e.h - 64;
      ctx.fillStyle = th.brickDark; ctx.fillRect(cx, cy + 16, 64, 48);
      ctx.fillStyle = th.brick; ctx.fillRect(cx + 1, cy + 17, 62, 46);
      ctx.fillStyle = th.brickDark;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) ctx.fillRect(cx + 1 + x * 8 + ((y & 1) ? 4 : 0), cy + 17 + y * 8, 1, 8);
      for (let y = 0; y < 6; y++) ctx.fillRect(cx + 1, cy + 24 + y * 8, 62, 1);
      ctx.fillStyle = th.brick;
      for (let i = 0; i < 4; i++) ctx.fillRect(cx + 2 + i * 16, cy + 8, 10, 9);
      ctx.fillRect(cx + 16, cy - 8, 32, 25);
      for (let i = 0; i < 3; i++) ctx.fillRect(cx + 17 + i * 11, cy - 14, 7, 7);
      ctx.fillStyle = '#1a1033';
      ctx.fillRect(cx + 26, cy + 40, 12, 24);
      ctx.fillRect(cx + 28, cy + 37, 8, 3);
      ctx.fillRect(cx + 28, cy, 8, 10);
      // pole
      ctx.fillStyle = '#3a8a3a'; ctx.fillRect(sx, sy + 6, e.w, e.h - 6);
      ctx.fillStyle = '#b4f5a8'; ctx.fillRect(sx + 1, sy + 6, 1, e.h - 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx - 2, sy, 8, 7);
      ctx.fillStyle = '#fff6b0'; ctx.fillRect(sx - 1, sy + 1, 2, 2);
      // flag
      const fy = sy + 8 + e.flagY;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx - 18, fy + 7); ctx.lineTo(sx, fy + 14); ctx.fill();
      ctx.fillStyle = '#e83b3b'; ctx.fillRect(sx - 8, fy + 5, 4, 4);
      // base block
      ctx.fillStyle = th.blockDark; ctx.fillRect(sx - 6, sy + e.h - 16, 16, 16);
      ctx.fillStyle = th.block; ctx.fillRect(sx - 5, sy + e.h - 15, 14, 14);
    },
  };

  // ---------------- Coin popping out of a ? block ----------------
  B.coinPop = {
    init(e) { e.customPos = true; e.w = 10; e.h = 14; e.vy = -5; e.life = 26; },
    update(e, W) {
      e.vy += 0.38; e.y += e.vy;
      if (--e.life <= 0) {
        e.remove = true;
        W.burst(e.x + 5, e.y + 7, { count: 5, colors: ['#ffd23f', '#ffffff'], speed: 1.2, life: 14, size: 1 });
      }
    },
    draw(e, W, ctx, sx, sy) { W.drawCoin(sx - 3, sy, W.frame * 2); },
  };

  // ---------------- Boss arena trigger ----------------
  B.bossTrigger = {
    init(e) { e.customPos = true; e.x = e.tx * TILE; e.y = 0; e.w = TILE; e.h = ROWS * TILE; e.fired = false; },
    update(e, W) {
      if (!e.fired && !W.P.dead && W.P.x > e.x) { e.fired = true; W.startBoss(e.door); }
    },
    draw() {},
  };

  // ---------------- Shockwave from the boss' ground pound ----------------
  B.shockwave = {
    init(e) { e.customPos = true; e.w = 12; e.h = 14; e.harmful = true; e.life = 180; },
    update(e, W) {
      e.x += e.vx;
      if (--e.life <= 0 || e.x < W.arena.x0 || e.x + e.w > W.arena.x1) e.remove = true;
      if (W.frame % 3 === 0) W.burst(e.x + 6, e.y + 13, { count: 1, colors: ['#d0b0ff', '#ffffff'], speed: 0.8, life: 16, gravity: -0.02, size: 2 });
    },
    draw(e, W, ctx, sx, sy) {
      const f = (W.frame >> 1) & 1;
      ctx.fillStyle = f ? '#ffffff' : '#d0b0ff';
      ctx.fillRect(sx + 4, sy, 4, 14);
      ctx.fillRect(sx + 2, sy + 4, 8, 10);
      ctx.fillRect(sx, sy + 9, 12, 5);
      ctx.fillStyle = '#8a4fff';
      ctx.fillRect(sx + 5, sy + 3, 2, 11);
    },
  };

  // =========================================================
  // BOSS — Grokk the Iron Ape (3 phases, 9 HP)
  // =========================================================
  const PATTERNS = {
    1: ['walk', 'throw', 'jump', 'throw'],
    2: ['jump', 'spread', 'walk', 'throw', 'jump'],
    3: ['jump', 'rain', 'spread', 'jump', 'throw', 'walk'],
  };
  const phaseOf = (e) => (e.hp > 6 ? 1 : e.hp > 3 ? 2 : 3);

  function go(e, state, dur) { e.state = state; e.t = 0; e.dur = dur || 0; }

  function nextAttack(e) {
    const list = PATTERNS[phaseOf(e)];
    go(e, list[e.patternIdx % list.length]);
    e.patternIdx++;
  }

  function throwBarrel(e, W, ph) {
    W.spawn('barrel', e.x + e.w / 2 - 7, e.y + 2, { dir: e.dir, speed: 1.5 + ph * 0.35, vy: -3.5, life: 420 });
    W.sfx('barrel');
  }

  B.boss = {
    init(e) {
      e.w = 36; e.h = 42;
      e.hp = e.maxHp = 9;
      e.state = 'dormant'; e.t = 0;
      e.vx = 0; e.vy = 0; e.dir = -1;
      e.harmful = false;
      e.patternIdx = 0;
      e.invuln = 0;
      e.lastPhase = 1;
    },
    update(e, W) {
      if (e.state === 'dormant') {
        if (!W.bossActive) return;
        e.floorY = e.y;
        e.y = -e.h;
        go(e, 'intro');
      }
      e.t++;
      if (e.invuln > 0) e.invuln--;
      const P = W.P;
      const ph = phaseOf(e);
      const sp = [1, 1.25, 1.6][ph - 1];
      const face = () => { e.dir = (P.x + P.w / 2 < e.x + e.w / 2) ? -1 : 1; };

      switch (e.state) {
        case 'intro':
          if (!e.landed) {
            e.vy = Math.min(e.vy + 0.4, 9);
            e.y += e.vy;
            if (e.y >= e.floorY) {
              e.y = e.floorY; e.vy = 0; e.landed = true;
              W.shake(6, 30); W.sfx('shockwave');
              W.burst(e.x + e.w / 2, e.y + e.h, { count: 24, colors: ['#d0b0ff', '#ffffff'], speed: 3, life: 30, gravity: 0.05, size: 3 });
            }
          }
          if (e.landed && e.t === 70) { W.sfx('bossRoar'); W.shake(3, 60); }
          if (e.t > 140) { e.harmful = true; go(e, 'idle', 40); }
          break;
        case 'idle':
          face();
          if (e.t >= e.dur) nextAttack(e);
          break;
        case 'walk':
          face();
          e.x += e.dir * 1.1 * sp;
          if (e.t >= 80 || e.x <= W.arena.x0 + 2 || e.x + e.w >= W.arena.x1 - 2) go(e, 'idle', 30 / sp);
          break;
        case 'throw':
          face();
          if (e.t === 24) throwBarrel(e, W, ph);
          if (ph === 3 && e.t === 50) throwBarrel(e, W, ph);
          if (e.t >= (ph === 3 ? 74 : 48)) go(e, 'idle', 40 / sp);
          break;
        case 'jump':
          if (e.t === 1) face();
          if (e.t === 20) {
            const target = P.x + P.w / 2 - e.w / 2;
            const air = (2 * 8) / 0.4;
            e.vx = clamp((target - e.x) / air, -4.5, 4.5);
            e.vy = -8;
            e.air = true;
            W.sfx('bigJump');
          } else if (e.air) {
            e.vy += 0.4;
            e.x += e.vx;
            e.y += e.vy;
            if (e.y >= e.floorY) {
              e.y = e.floorY; e.air = false; e.vx = 0;
              W.shake(7, 26); W.sfx('shockwave');
              W.burst(e.x + e.w / 2, e.y + e.h, { count: 18, colors: ['#d0b0ff', '#ffffff'], speed: 2.6, life: 26, gravity: 0.05, size: 3 });
              if (ph >= 2) {
                const gy = e.floorY + e.h - 14;
                W.spawn('shockwave', e.x - 12, gy, { vx: -2.4 * sp });
                W.spawn('shockwave', e.x + e.w, gy, { vx: 2.4 * sp });
              }
              go(e, 'stunned', ph === 3 ? 40 : 55);
            }
          }
          break;
        case 'stunned':
          if (e.t >= e.dur) go(e, 'idle', 20);
          break;
        case 'spread':
          face();
          if (e.t === 30) {
            const n = ph === 3 ? 5 : 3;
            const mx = e.x + e.w / 2 + e.dir * 10, my = e.y + 16;
            const base = Math.atan2((P.y + P.h / 2) - my, (P.x + P.w / 2) - mx);
            for (let i = 0; i < n; i++) {
              const a = base + (i - (n - 1) / 2) * 0.24;
              W.spawn('fireball', mx - 5, my - 5, { r: 5, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 240 });
            }
            W.sfx('fireball');
          }
          if (e.t >= 64) go(e, 'idle', 40 / sp);
          break;
        case 'rain':
          if (e.t === 1) { W.sfx('bossRoar'); W.shake(4, 60); }
          if (e.t === 30) {
            for (let i = 0; i < 7; i++) {
              const x = W.arena.x0 + 16 + Math.random() * (W.arena.x1 - W.arena.x0 - 40);
              W.spawn('fireball', x, 34, { r: 5, vx: 0, vy: 0, gravity: 0.12, delay: 40 + i * 14, collides: true, life: 400 });
            }
          }
          if (e.t >= 100) go(e, 'idle', 40 / sp);
          break;
        case 'hurt':
          e.x += e.vx;
          e.vx *= 0.9;
          if (e.t >= 50) {
            if (phaseOf(e) !== e.lastPhase) { e.lastPhase = phaseOf(e); go(e, 'roar'); } else go(e, 'idle', 24);
          }
          break;
        case 'roar':
          if (e.t === 1) {
            W.sfx('bossRoar'); W.shake(5, 60);
            W.message('GROKK IS ENRAGED!');
            W.burst(e.x + e.w / 2, e.y + 10, { count: 30, colors: ['#ff3b3b', '#ffd23f', '#8a4fff'], speed: 3.5, life: 40, gravity: 0.02, size: 3 });
          }
          if (e.t >= 75) go(e, 'idle', 20);
          break;
        case 'dying':
          e.harmful = false;
          if (e.t % 7 === 0) {
            W.burst(e.x + Math.random() * e.w, e.y + Math.random() * e.h, { count: 10, colors: ['#ffd23f', '#ff5a1f', '#ffffff'], speed: 2.6, life: 30, gravity: 0, size: 3 });
            if (e.t % 14 === 0) W.sfx('explosion');
          }
          if (e.t === 160) {
            W.burst(e.x + e.w / 2, e.y + e.h / 2, { count: 60, colors: ['#ffd23f', '#ff5a1f', '#ffffff', '#8a4fff'], speed: 5, life: 60, gravity: 0.05, size: 3 });
            W.shake(8, 40);
            e.remove = true;
            W.bossDefeated(e);
          }
          break;
        default:
          go(e, 'idle', 30);
      }
      e.x = clamp(e.x, W.arena.x0, W.arena.x1 - e.w);
      W.setBossBar(e.hp, e.maxHp, ph);
    },
    collide(e, W, P) {
      if (e.state === 'dormant' || e.state === 'dying' || P.dead) return;
      const hb = { x: e.x + 3, y: e.y + 4, w: e.w - 6, h: e.h - 4 };
      if (!overlap(P, hb)) return;
      const canHit = e.invuln === 0 && e.state !== 'intro' && e.state !== 'hurt' && e.state !== 'roar';
      if (P.vy > 0 && P.y + P.h - P.vy <= hb.y + 10) {
        W.bouncePlayer(-7.5);
        if (!canHit) return;
        e.hp--;
        e.invuln = 60;
        W.sfx('bossHit');
        W.shake(5, 20);
        W.burst(P.x + P.w / 2, e.y + 4, { count: 16, colors: ['#ffffff', '#ffd23f'], speed: 3, life: 24, gravity: 0.1, size: 2 });
        if (e.hp <= 0) {
          go(e, 'dying');
          W.clearHazards();
        } else {
          e.vx = (P.x + P.w / 2 < e.x + e.w / 2) ? 3 : -3;
          e.air = false;
          if (e.y < e.floorY) e.y = e.floorY;
          go(e, 'hurt');
        }
        return;
      }
      if (e.harmful && e.state !== 'hurt') W.hurtPlayer(e);
    },
    draw(e, W, ctx, sx, sy) {
      if (e.state === 'dormant') return;
      const ph = e.state === 'dying' ? 3 : phaseOf(e);
      const flash = (e.invuln > 0 || e.state === 'dying') && ((W.frame >> 2) & 1) === 1;
      const armsUp = (e.state === 'throw' && e.t < 30) || e.state === 'roar' || e.state === 'rain' || (e.state === 'spread' && e.t < 34) || (e.state === 'intro' && e.t > 60);
      const crouch = e.state === 'jump' && e.t < 20 ? 3 : 0;
      const wobble = e.state === 'stunned' ? Math.round(Math.sin(e.t * 0.6) * 2) : 0;
      W.sprite('boss', armsUp ? 1 : 0, sx + e.w / 2 - 24 + wobble, sy + e.h - 48 + crouch, { scale: 3, palette: BOSS_PALETTES[ph - 1], flip: e.dir > 0, flash });
      if (e.state === 'stunned') {
        for (let i = 0; i < 3; i++) {
          const a = W.frame * 0.12 + i * 2.1;
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(Math.round(sx + e.w / 2 + Math.cos(a) * 14), Math.round(sy - 8 + Math.sin(a) * 4), 3, 3);
        }
      }
    },
  };
})();

// Barrel art (two roll frames) + default palettes for sprites that are not theme-tinted.
(function () {
  'use strict';
  const L = window.Levels;
  L.ART.barrel = [[
    '................',
    '.....NNNNNN.....',
    '...NNYYYYYYNN...',
    '..NYHYNYYNYYYN..',
    '..NYHYNYYNYYYN..',
    '.NNNNNNNNNNNNNN.',
    '.NYHYYNYYNYYYYN.',
    '.NYHYYNYYNYYYYN.',
    '.NYHYYNYYNYYYYN.',
    '.NYHYYNYYNYYYYN.',
    '.NNNNNNNNNNNNNN.',
    '..NYHYNYYNYYYN..',
    '..NYHYNYYNYYYN..',
    '...NNYYYYYYNN...',
    '.....NNNNNN.....',
    '................',
  ], [
    '................',
    '.....NNNNNN.....',
    '...NNYYYYYYNN...',
    '..NHNYYNYYNYYN..',
    '..NHNYYNYYNYYN..',
    '.NNNNNNNNNNNNNN.',
    '.NHYNYYNYYNYYYN.',
    '.NHYNYYNYYNYYYN.',
    '.NHYNYYNYYNYYYN.',
    '.NHYNYYNYYNYYYN.',
    '.NNNNNNNNNNNNNN.',
    '..NHNYYNYYNYYN..',
    '..NHNYYNYYNYYN..',
    '...NNYYYYYYNN...',
    '.....NNNNNN.....',
    '................',
  ]];
  L.DEFAULT_PALETTES = {
    barrel: { Y: '#c8742c', N: '#4a2208', H: '#f0b070' },
  };
})();
