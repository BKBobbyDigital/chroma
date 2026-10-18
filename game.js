'use strict';

// =====================================================================
//  CHROMA — a Pipe Mania–style game
//  Everything tunable lives in this first block.
// =====================================================================

const GAME_NAME = 'CHROMA';
const GAME_NAME_JP = 'クロマ';
const TAGLINE = 'Keep the Chroma flowing. Keep the city alive.';

const CELL = 64;                                  // board square size (logical px)
// Two layouts: a wide one for desktops and a tall one for phones held upright.
// The board flips to 7 x 10 in the tall layout, so the squares stay big enough to tap.
const LAYOUTS = {
  wide: {
    VW: 1000, VH: 730,
    HOUSING: { x: 16, y: 34, w: 688, h: 690 },        // the machine around the board
    HEADER: { x: 32, y: 50, w: 656, h: 70 },          // title plate on the machine
    FRAME: { x: 30, y: 130, w: 660, h: 468 },         // bezel around the board
    BOARD: { x: 40, y: 140, w: 640, h: 448, cols: 10, rows: 7 },
    DISP: { x: 40, y: 630, slot: 128, h: 76, n: 5 },  // the NEXT tray, next piece on the left
    SIDE: { x: 716, y: 130, w: 268 },                 // control panel column
  },
  tall: {
    VW: 480, VH: 960,
    HOUSING: { x: 10, y: 24, w: 460, h: 928 },
    HEADER: { x: 20, y: 36, w: 440, h: 54 },
    STATS: { x: 20, y: 98, w: 440, h: 72 },           // level / score / timer / pipes strip
    FRAME: { x: 14, y: 178, w: 452, h: 650 },
    BOARD: { x: 16, y: 183, w: 448, h: 640, cols: 7, rows: 10 },
    DISP: { x: 16, y: 860, slot: 89.6, h: 74, n: 5 },
    SIDE: null,
  },
};
let VW, VH, HOUSING, HEADER, STATS, FRAME, BOARD, DISP, SIDE;
let TALL = false;
function setLayout(tall) {
  TALL = tall;
  ({ VW, VH, HOUSING, HEADER, FRAME, BOARD, DISP, SIDE } = LAYOUTS[tall ? 'tall' : 'wide']);
  STATS = LAYOUTS.tall.STATS;
}
setLayout(false);
// Phones held upright get the tall layout.
// Touch screens get "tap" wording and no keyboard hints.
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
const wantTall = () => window.innerHeight > window.innerWidth && window.innerWidth < 820;

const RES_TIME = 5;        // seconds for Chroma to fill a reservoir
const REPLACE_LOCK = 0.7;  // seconds before you can lay again after replacing a pipe
const FAST_FORWARD = 10;   // flow speed multiplier when you hit "flood now" mid-flow

const PTS = {
  piece: 50,        // each section the Chroma crosses
  extra: 100,       // each section beyond the level minimum
  cross: 500,       // Chroma crosses itself in a + piece
  crossFive: 10000, // five crosses in one level
  reservoir: 1000,
  bonusPipe: 1000,  // gold pre-placed pipes
  replace: -50,     // replacing a laid pipe
  unused: -100,     // each laid pipe the Chroma never reached
  bonusRound: 100,  // each section in the bonus round
};

// How each level gets harder. n starts at 1.
function levelConfig(n) {
  return {
    min: Math.min(30, 8 + Math.round(n * 1.7)),
    delay: Math.max(12, 31 - n),                    // seconds before the Chroma starts
    speed: Math.min(2.2, 0.42 + n * 0.06),          // squares per second
    blocks: n < 2 ? 0 : Math.min(1 + Math.floor(n / 2), 9),
    bonusPipes: n < 3 ? 0 : Math.min(1 + Math.floor((n - 3) / 4), 3),
    reservoirs: n < 4 ? 0 : (n < 10 ? 1 : 2),
    hasEnd: n >= 5 && n % 2 === 1,
    oneways: n < 6 ? 0 : Math.min(1 + Math.floor((n - 6) / 3), 4),
    wrap: n < 7 ? 0 : (n < 12 ? 1 : 2),
    fixedPipes: n < 8 ? 0 : Math.min(1 + Math.floor((n - 8) / 3), 3),
  };
}

const BONUS_EVERY = 4;
const PW_WORDS = ['EMBER', 'FORGE', 'MAGMA', 'CINDER', 'SLAG', 'KILN', 'SMELT', 'NEON', 'RAIN', 'CORE', 'FURNACE', 'ZENITH'];

const COLORS = {
  panel: 'rgba(9,10,13,0.92)',
  panelEdge: 'rgba(255,106,42,0.28)',
  goo: '#ff4a12',   // Chroma
  accent: '#ff6a2a',
  label: '#ff7a3a',
  cyan: '#2ad4ff',
  amber: '#ffb020',
  red: '#ff3b30',
  text: '#ece6df',
  muted: '#8a817a',
};
// steel palettes for pipes: outline, body, highlight, specular
const STEEL = { outline: '#050507', base: '#34383f', mid: '#6e7681', spec: '#e3eaf2', rim: 'rgba(150,185,220,0.38)' };
const STEEL_DARK = { outline: '#040405', base: '#1f2226', mid: '#41464d', spec: '#9aa2ab', rim: 'rgba(150,185,220,0.22)' }; // bolted pipes
const STEEL_HOT = { outline: '#160301', base: '#3a120a', mid: '#7a2612', spec: '#ff9466' };  // collars heated by Chroma
const BRASS = { outline: '#180f03', base: '#5e4012', mid: '#a0722a', spec: '#ffe2a0' };      // bonus pipes
// molten Chroma, from the dark crust to the white-hot core
const MOLTEN = { glow: '#ff3a0a', crust: '#4a0802', deep: '#a8180a', body: '#ff4614', hot: '#ff9640', core: '#ffe6c2' };
const FONT = (px, weight = 600) => `${weight} ${px}px "Chakra Petch", "Hiragino Sans", ui-sans-serif, sans-serif`;

// =====================================================================
//  Directions & pieces
// =====================================================================

const N = 0, E = 1, S = 2, W = 3;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const BIT = [1, 2, 4, 8];
const opp = d => (d + 2) % 4;
const dirsOf = m => [N, E, S, W].filter(d => m & BIT[d]);

const SHAPES = { H: 2 | 8, V: 1 | 4, NE: 1 | 2, ES: 2 | 4, SW: 4 | 8, WN: 8 | 1, X: 15 };
const DISPENSE = [['H', 3], ['V', 3], ['NE', 2], ['ES', 2], ['SW', 2], ['WN', 2], ['X', 1.3]];

const rnd = n => Math.floor(Math.random() * n);
function randomShape() {
  const total = DISPENSE.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of DISPENSE) if ((r -= w) < 0) return k;
  return 'H';
}

// =====================================================================
//  Board
// =====================================================================

function emptyCell() {
  return { kind: 'empty', mask: 0, fixed: false, bonus: false, dir: -1, segs: [], axes: { h: false, v: false }, entered: false, anim: null, pop: 0 };
}

function makeBoard(cols, rows) {
  const b = { cols, rows, cells: [], wrapRows: new Set(), wrapCols: new Set() };
  for (let i = 0; i < cols * rows; i++) b.cells.push(emptyCell());
  b.ox = BOARD.x + (BOARD.w - cols * CELL) / 2;
  b.oy = BOARD.y + (BOARD.h - rows * CELL) / 2;
  return b;
}
const at = (b, x, y) => b.cells[y * b.cols + x];
const inBounds = (b, x, y) => x >= 0 && y >= 0 && x < b.cols && y < b.rows;

function buildLevel(n) {
  const cfg = levelConfig(n);
  const b = makeBoard(BOARD.cols, BOARD.rows);
  const reserved = new Set();
  const k = (x, y) => y * b.cols + x;

  // Start: never on the border, and its first two squares stay clear.
  const sx = 1 + rnd(b.cols - 2), sy = 1 + rnd(b.rows - 2), sd = rnd(4);
  Object.assign(at(b, sx, sy), { kind: 'start', mask: BIT[sd], dir: sd, fixed: true });
  reserved.add(k(sx, sy));
  for (let i = 1; i <= 2; i++) {
    const x = sx + DX[sd] * i, y = sy + DY[sd] * i;
    if (inBounds(b, x, y)) reserved.add(k(x, y));
  }

  if (cfg.hasEnd) {
    for (let t = 0; t < 500; t++) {
      const x = rnd(b.cols), y = rnd(b.rows), d = rnd(4);
      const fx = x + DX[d], fy = y + DY[d];
      if (Math.abs(x - sx) + Math.abs(y - sy) < 5) continue;
      if (reserved.has(k(x, y)) || !inBounds(b, fx, fy) || reserved.has(k(fx, fy))) continue;
      Object.assign(at(b, x, y), { kind: 'end', mask: BIT[d], dir: d, fixed: true });
      reserved.add(k(x, y));
      reserved.add(k(fx, fy));
      break;
    }
  }

  for (let i = 0; i < cfg.wrap; i++) {
    if (rnd(2)) b.wrapRows.add(rnd(b.rows));
    else b.wrapCols.add(rnd(b.cols));
  }

  const take = interior => {
    for (let t = 0; t < 500; t++) {
      const x = interior ? 1 + rnd(b.cols - 2) : rnd(b.cols);
      const y = interior ? 1 + rnd(b.rows - 2) : rnd(b.rows);
      if (!reserved.has(k(x, y)) && at(b, x, y).kind === 'empty') {
        reserved.add(k(x, y));
        return at(b, x, y);
      }
    }
    return null;
  };
  const straight = () => (rnd(2) ? SHAPES.H : SHAPES.V);

  for (let i = 0; i < cfg.reservoirs; i++) {
    const c = take(true);
    if (c) Object.assign(c, { kind: 'res', mask: straight(), fixed: true });
  }
  for (let i = 0; i < cfg.oneways; i++) {
    const c = take(true);
    if (!c) continue;
    const horiz = rnd(2);
    const d = horiz ? (rnd(2) ? E : W) : (rnd(2) ? N : S);
    Object.assign(c, { kind: 'oneway', mask: horiz ? SHAPES.H : SHAPES.V, dir: d, fixed: true });
  }
  for (let i = 0; i < cfg.bonusPipes; i++) {
    const c = take(true);
    if (c) Object.assign(c, { kind: 'pipe', mask: straight(), fixed: true, bonus: true });
  }
  for (let i = 0; i < cfg.fixedPipes; i++) {
    const c = take(true);
    if (c) Object.assign(c, { kind: 'pipe', mask: SHAPES[randomShape()], fixed: true });
  }
  for (let i = 0; i < cfg.blocks; i++) {
    const c = take(false);
    if (c) c.kind = 'block';
  }

  return { board: b, cfg, start: { x: sx, y: sy, dir: sd } };
}

function buildBonusBoard() {
  const b = TALL ? makeBoard(5, 7) : makeBoard(7, 5);
  for (const c of b.cells) Object.assign(c, { kind: 'pipe', mask: SHAPES[randomShape()] });
  const sy = rnd(b.rows);
  Object.assign(at(b, 0, sy), emptyCell(), { kind: 'start', mask: BIT[E], dir: E, fixed: true });
  let ex, ey;
  do { ex = rnd(b.cols); ey = rnd(b.rows); } while (ex === 0 && ey === sy);
  Object.assign(at(b, ex, ey), emptyCell());
  return { board: b, start: { x: 0, y: sy, dir: E } };
}

function buildDemoBoard() {
  const b = makeBoard(BOARD.cols, BOARD.rows);
  for (const c of b.cells) if (Math.random() < 0.55) Object.assign(c, { kind: 'pipe', mask: SHAPES[randomShape()] });
  return b;
}

// =====================================================================
//  Game state
// =====================================================================

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
  set(key, v) { try { localStorage.setItem(key, v); } catch { /* storage unavailable */ } },
};

const G = {
  mode: 'title',          // 'title' | 'play' | 'bonus'
  running: false,         // timers ticking
  paused: false,
  level: 1,
  score: 0,
  levelStartScore: 0,
  board: buildDemoBoard(),
  cfg: null,
  start: null,
  queue: [],
  countdown: 0,
  delay: 1,
  speed: 1,
  flowing: false,
  flow: null,
  ff: false,
  finished: false,
  reachedEnd: false,
  resultTimer: 0,
  len: 0,
  crosses: 0,
  lockUntil: 0,
  time: 0,
  hover: null,
  dispAnim: 0,
  particles: [],
  popups: [],
  high: Number(store.get('gooline.high', 0)) || 0,
};

function resetRun(delay, speed) {
  Object.assign(G, {
    countdown: delay, delay, speed,
    flowing: false, flow: null, ff: false, finished: false, reachedEnd: false,
    len: 0, crosses: 0, lockUntil: 0, laid: {}, running: false, paused: false,
    particles: [], popups: [], levelStartScore: G.score,
  });
}

function newGame(level = 1) {
  G.score = 0;
  startLevel(level);
}

function startLevel(n) {
  applyLayout(wantTall());
  const L = buildLevel(n);
  Object.assign(G, { mode: 'play', level: n, board: L.board, cfg: L.cfg, start: L.start, dispAnim: 0 });
  G.queue = Array.from({ length: DISP.n }, randomShape);
  resetRun(L.cfg.delay, L.cfg.speed);
  showLevelIntro();
}

function startBonus() {
  applyLayout(wantTall());
  const L = buildBonusBoard();
  Object.assign(G, { mode: 'bonus', board: L.board, start: L.start, cfg: { min: 0 } });
  resetRun(25, 0.85);
  showPanel(`
    <h2>Bonus round</h2>
    <p>The board is full of pipe with one gap. Click a pipe next to the gap to <b>slide</b> it in.</p>
    <p>Build the longest line you can before the Chroma arrives — <b>${PTS.bonusRound}</b> points per section. Nothing to lose here.</p>
    <div class="row"><button class="primary" data-action="begin">Go</button></div>
  `);
}

// =====================================================================
//  Flow
// =====================================================================

function canEnter(c, entry) {
  if (!['pipe', 'res', 'oneway', 'end'].includes(c.kind)) return false;
  if (!(c.mask & BIT[entry])) return false;
  if (c.kind === 'oneway') return entry === opp(c.dir) && !c.entered;
  if (c.mask === 15) return !c.axes[entry % 2 === 0 ? 'v' : 'h'];
  return !c.entered;
}

function exitFor(c, entry) {
  if (c.mask === 15) return opp(entry);
  return dirsOf(c.mask).find(d => d !== entry);
}

function startFlow() {
  if (G.flowing || G.finished) return;
  G.flowing = true;
  G.countdown = 0;
  const { x, y, dir } = G.start;
  const c = at(G.board, x, y);
  const seg = { from: -1, to: dir, p: 0 };
  c.segs.push(seg);
  c.entered = true;
  G.flow = { x, y, cell: c, seg };
  Sound.whoosh();
}

function stepFlow(dt) {
  const f = G.flow;
  if (!f) return;
  let rate = f.cell.kind === 'res' ? 1 / RES_TIME : G.speed;
  if (f.seg.from === -1 || f.seg.to === -1) rate *= 2; // half-length segments
  if (G.ff) rate *= FAST_FORWARD;
  f.seg.p += rate * dt;
  if (f.seg.p >= 1) {
    f.seg.p = 1;
    advanceFlow();
  }
}

function advanceFlow() {
  const f = G.flow, b = G.board;
  if (f.cell.kind === 'res') {
    addScore(PTS.reservoir, f.x, f.y, 'TANK');
    Sound.chime();
  }
  if (f.seg.to === -1) return endFlow(true);

  const d = f.seg.to;
  let nx = f.x + DX[d], ny = f.y + DY[d];
  if (nx < 0 || nx >= b.cols) {
    if (b.wrapRows.has(f.y)) nx = (nx + b.cols) % b.cols; else return endFlow(false);
  }
  if (ny < 0 || ny >= b.rows) {
    if (b.wrapCols.has(f.x)) ny = (ny + b.rows) % b.rows; else return endFlow(false);
  }
  const n = at(b, nx, ny), entry = opp(d);
  if (!canEnter(n, entry)) return endFlow(false);

  let crossed = false;
  if (n.mask === 15) {
    const axis = entry % 2 === 0 ? 'v' : 'h';
    crossed = n.axes[axis === 'v' ? 'h' : 'v'];
    n.axes[axis] = true;
  }
  n.entered = true;
  const seg = { from: entry, to: n.kind === 'end' ? -1 : exitFor(n, entry), p: 0 };
  n.segs.push(seg);
  G.flow = { x: nx, y: ny, cell: n, seg };
  G.len++;

  let pts;
  if (G.mode === 'bonus') pts = PTS.bonusRound;
  else pts = G.len > G.cfg.min ? PTS.extra : PTS.piece;
  if (n.bonus) pts += PTS.bonusPipe;
  if (crossed) {
    G.crosses++;
    pts += PTS.cross;
    if (G.crosses === 5) pts += PTS.crossFive;
    Sound.cross();
  } else {
    Sound.flow(G.len);
  }
  addScore(pts, nx, ny, crossed ? (G.crosses === 5 ? 'MEGA X' : 'CROSS') : n.bonus ? 'GOLD' : '');
  if (G.mode === 'play' && G.len === G.cfg.min) {
    popup(nx, ny, 'TARGET!', COLORS.amber, -18);
    Sound.chime();
  }
}

function endFlow(reachedEnd) {
  const f = G.flow;
  if (!reachedEnd && f) {
    const { x, y } = cellCenter(G.board, f.x, f.y);
    splash(x + DX[f.seg.to] * CELL / 2, y + DY[f.seg.to] * CELL / 2, COLORS.goo, 26);
    Sound.splat();
  }
  Object.assign(G, { flowing: false, finished: true, reachedEnd, ff: false, flow: null, resultTimer: 1.4 });
}

function showResult() {
  if (G.mode === 'bonus') {
    const pw = passwordFor(G.level + 1);
    store.set('gooline.pw', pw);
    saveHigh();
    Sound.win();
    showPanel(`
      <h2>Bonus complete</h2>
      <table>
        <tr><td>Sections filled</td><td>${G.len}</td></tr>
        <tr class="total"><td>Bonus points</td><td>+${G.score - G.levelStartScore}</td></tr>
      </table>
      <p>Password for level ${G.level + 1}: <code>${pw}</code></p>
      <div class="row"><button class="primary" data-action="next">Continue</button></div>
    `);
    return;
  }

  const cfg = G.cfg;
  const ok = G.len >= cfg.min && (!cfg.hasEnd || G.reachedEnd);
  if (ok) {
    const unused = G.board.cells.filter(c => c.kind === 'pipe' && !c.fixed && !c.entered).length;
    G.score = Math.max(0, G.score + unused * PTS.unused);
    saveHigh();
    Sound.win();
    const extra = Math.max(0, G.len - cfg.min);
    showPanel(`
      <h2>Sector ${G.level} restored</h2>
      <table>
        <tr><td>Pipes filled</td><td>${G.len} / ${cfg.min}</td></tr>
        ${extra ? `<tr><td>Over the target</td><td>+${extra}</td></tr>` : ''}
        ${G.crosses ? `<tr><td>Crosses</td><td>${G.crosses}</td></tr>` : ''}
        <tr><td>Unused pipes</td><td>${unused ? `${unused} × ${PTS.unused}` : 'none'}</td></tr>
        <tr class="total"><td>Level score</td><td>${G.score - G.levelStartScore >= 0 ? '+' : ''}${G.score - G.levelStartScore}</td></tr>
        <tr><td>Total</td><td>${G.score}</td></tr>
      </table>
      ${G.level % BONUS_EVERY === 0 ? '<p class="muted">Bonus round up next.</p>' : ''}
      <div class="row"><button class="primary" data-action="next">Continue</button></div>
    `);
  } else {
    const reason = G.len < cfg.min
      ? `The pipeline was only ${G.len} long — you needed ${cfg.min}.`
      : 'The Chroma never made it to the drain.';
    const best = saveHigh();
    Sound.lose();
    showPanel(`
      <h2 class="fail">Line breach</h2>
      <p>${reason}</p>
      <table>
        <tr><td>Reached level</td><td>${G.level}</td></tr>
        <tr class="total"><td>Final score</td><td>${G.score}</td></tr>
      </table>
      ${best ? '<p style="color:var(--amber)">New high score</p>' : ''}
      <div class="row">
        <button class="primary" data-action="retry">Retry level</button>
        <button data-action="title">Title screen</button>
      </div>
      <p class="muted">Retrying puts your score back to where it was when this level started.</p>
    `);
  }
}

function saveHigh() {
  if (G.score > G.high) {
    G.high = G.score;
    store.set('gooline.high', G.high);
    return true;
  }
  return false;
}

// =====================================================================
//  Passwords
// =====================================================================

function passwordFor(level) {
  const i = Math.floor((level - 1) / BONUS_EVERY) - 1;
  const word = PW_WORDS[i % PW_WORDS.length];
  const lap = Math.floor(i / PW_WORDS.length);
  return lap ? word + lap : word;
}
function levelForPassword(pw) {
  pw = pw.trim().toUpperCase();
  for (let lv = BONUS_EVERY + 1; lv < 1000; lv += BONUS_EVERY) if (passwordFor(lv) === pw) return lv;
  return null;
}

// =====================================================================
//  Player actions
// =====================================================================

function clickCell(x, y) {
  if (!G.running || G.paused || G.finished) return;
  if (G.mode === 'bonus') return slide(x, y);
  const c = at(G.board, x, y);
  if (G.time < G.lockUntil) return Sound.deny();
  if (c.kind === 'empty') {
    layPipe(c);
    Sound.place();
  } else if (c.kind === 'pipe' && !c.fixed && !c.entered) {
    const { x: px, y: py } = cellCenter(G.board, x, y);
    splash(px, py, STEEL.mid, 14);
    layPipe(c);
    G.score = Math.max(0, G.score + PTS.replace);
    popup(x, y, String(PTS.replace), COLORS.red);
    G.lockUntil = G.time + REPLACE_LOCK;
    Sound.replace();
  } else {
    Sound.deny();
  }
}

function layPipe(c) {
  const shape = G.queue.shift();
  G.laid[shape] = (G.laid[shape] || 0) + 1;
  G.queue.push(randomShape());
  Object.assign(c, emptyCell(), { kind: 'pipe', mask: SHAPES[shape], pop: 1 });
  G.dispAnim = 1;
}

function slide(x, y) {
  const b = G.board, c = at(b, x, y);
  if (c.kind !== 'pipe' || c.entered) return Sound.deny();
  for (let d = 0; d < 4; d++) {
    const ex = x + DX[d], ey = y + DY[d];
    if (!inBounds(b, ex, ey) || at(b, ex, ey).kind !== 'empty') continue;
    const e = at(b, ex, ey);
    b.cells[ey * b.cols + ex] = c;
    b.cells[y * b.cols + x] = e;
    c.anim = { dx: x - ex, dy: y - ey, t: 0 };
    return Sound.place();
  }
  Sound.deny();
}

function canSlide(x, y) {
  const b = G.board, c = at(b, x, y);
  if (c.kind !== 'pipe' || c.entered) return false;
  return [0, 1, 2, 3].some(d => inBounds(b, x + DX[d], y + DY[d]) && at(b, x + DX[d], y + DY[d]).kind === 'empty');
}

function flood() {
  if (!G.running || G.paused || G.finished) return;
  if (!G.flowing) startFlow();
  else G.ff = true;
}

function togglePause(force) {
  if (!G.running || G.finished) return;
  const next = force ?? !G.paused;
  if (next === G.paused) return;
  G.paused = next;
  if (G.paused) showPanel(`<h2>Paused</h2><div class="row"><button class="primary" data-action="resume">Resume</button><button data-action="title">Quit to title</button></div>`);
  else hidePanel();
}

// =====================================================================
//  Effects
// =====================================================================

function cellCenter(b, x, y) {
  return { x: b.ox + x * CELL + CELL / 2, y: b.oy + y * CELL + CELL / 2 };
}
function popup(cx, cy, text, color = COLORS.goo, offset = 0) {
  const { x, y } = cellCenter(G.board, cx, cy);
  G.popups.push({ x, y: y + offset, text, color, life: 1.3 });
}
function addScore(pts, cx, cy, label) {
  G.score = Math.max(0, G.score + pts);
  popup(cx, cy, label ? `${label} +${pts}` : `+${pts}`, label ? COLORS.amber : COLORS.goo);
}
function splash(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160;
    G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6 + Math.random() * 0.6, r: 2 + Math.random() * 4, color });
  }
}

// =====================================================================
//  Sound (tiny WebAudio blips, no assets)
// =====================================================================

const Sound = {
  ac: null,
  muted: store.get('gooline.muted', '0') === '1',
  init() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
    if (this.ac.state === 'suspended') this.ac.resume();
  },
  tone(freq, dur, type = 'square', vol = 0.05, slideTo = null, delay = 0) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  place() { this.tone(520, 0.06, 'square', 0.04); },
  deny() { this.tone(110, 0.1, 'square', 0.04); },
  replace() { this.tone(200, 0.25, 'sawtooth', 0.05, 60); },
  tick() { this.tone(880, 0.04, 'square', 0.03); },
  whoosh() { this.tone(90, 0.5, 'sawtooth', 0.05, 300); },
  flow(n) { this.tone(180 + Math.min(n, 40) * 14, 0.07, 'triangle', 0.06); },
  cross() { this.tone(660, 0.08, 'square', 0.05); this.tone(990, 0.12, 'square', 0.05, null, 0.08); },
  chime() { this.tone(1046, 0.12, 'triangle', 0.06); this.tone(1318, 0.18, 'triangle', 0.06, null, 0.1); },
  splat() { this.tone(160, 0.3, 'sawtooth', 0.06, 40); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.045, null, i * 0.1)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.24, 'sawtooth', 0.045, null, i * 0.17)); },
};

// =====================================================================
//  Update loop
// =====================================================================

function update(dt) {
  G.time += dt;
  G.dispAnim = Math.max(0, G.dispAnim - dt * 7);
  for (const c of G.board.cells) {
    if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 6);
    if (c.anim && (c.anim.t += dt * 8) >= 1) c.anim = null;
  }
  for (const p of G.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const p of G.popups) { p.life -= dt; p.y -= 28 * dt; }
  G.popups = G.popups.filter(p => p.life > 0);

  if (!G.running || G.paused) return;

  if (G.finished) {
    if ((G.resultTimer -= dt) <= 0) {
      G.running = false;
      showResult();
    }
    return;
  }
  if (!G.flowing) {
    const before = Math.ceil(G.countdown);
    G.countdown -= dt;
    if (Math.ceil(G.countdown) !== before && before <= 3 && G.countdown > 0) Sound.tick();
    if (G.countdown <= 0) startFlow();
  } else {
    stepFlow(dt);
  }
}

// =====================================================================
//  Rendering — game canvas
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1;
const plateCache = new Map();
let adLayer = null;

function resizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VW * DPR;
  canvas.height = VH * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  plateCache.clear();
  adLayer = null;
  buildCity();
}

const stage = document.querySelector('.stage');
let layoutReady = false;

// Switch between the wide and tall layouts (only when a new board is about to be built).
function applyLayout(tall) {
  if (layoutReady && tall === TALL) return;
  layoutReady = true;
  setLayout(tall);
  stage.style.setProperty('--ar', String(VW / VH));
  stage.style.aspectRatio = `${VW} / ${VH}`;
  resizeCanvas();
}

function offscreen(w, h, dpr = DPR) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, g];
}

// Small seeded RNG so textures and the skyline look the same every time.
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chamfer(x, y, w, h, c = 12, g = ctx) {
  g.beginPath();
  g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c);
  g.closePath();
}

function panelBox(x, y, w, h, c = 12) {
  chamfer(x, y, w, h, c);
  ctx.fillStyle = COLORS.panel; ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5; ctx.stroke();
  // inner hairline, like a machined bezel
  chamfer(x + 5, y + 5, w - 10, h - 10, Math.max(4, c - 4));
  ctx.strokeStyle = 'rgba(255,90,40,0.10)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(x + w - 60, y - 1, 34, 2);
}

function spaced(px) { if (ctx.letterSpacing !== undefined) ctx.letterSpacing = px; }

function label(text, x, y, color = COLORS.label, size = 12, align = 'left') {
  ctx.font = FONT(size, 600);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  spaced('2px');
  ctx.fillText(text, x, y);
  spaced('0px');
}

function value(text, x, y, size = 30, color = COLORS.text, align = 'left') {
  ctx.font = FONT(size, 500);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function bolt(x, y, r = 3.5) {
  ctx.fillStyle = '#030304'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b6068'; ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

// ---------- pipe geometry ----------

function mid(cx, cy, d, s) { return [cx + DX[d] * s / 2, cy + DY[d] * s / 2]; }

// Adds a quarter-arc from side a toward side b (fraction p) to the current path.
function arcPath(a, b, cx, cy, s, p) {
  const kx = cx + (DX[a] + DX[b]) * s / 2, ky = cy + (DY[a] + DY[b]) * s / 2;
  const [ax, ay] = mid(cx, cy, a, s), [bx, by] = mid(cx, cy, b, s);
  const a0 = Math.atan2(ay - ky, ax - kx), a1 = Math.atan2(by - ky, bx - kx);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const end = a0 + d * p;
  ctx.arc(kx, ky, s / 2, a0, end, d < 0);
  return [kx + Math.cos(end) * s / 2, ky + Math.sin(end) * s / 2];
}

function maskPath(mask, cx, cy, s) {
  const ds = dirsOf(mask);
  ctx.beginPath();
  if (ds.length === 1) {
    ctx.moveTo(cx, cy);
    ctx.lineTo(...mid(cx, cy, ds[0], s));
  } else if (mask === 15) {
    ctx.moveTo(...mid(cx, cy, N, s)); ctx.lineTo(...mid(cx, cy, S, s));
    ctx.moveTo(...mid(cx, cy, W, s)); ctx.lineTo(...mid(cx, cy, E, s));
  } else if (ds[1] === opp(ds[0])) {
    ctx.moveTo(...mid(cx, cy, ds[0], s)); ctx.lineTo(...mid(cx, cy, ds[1], s));
  } else {
    arcPath(ds[0], ds[1], cx, cy, s, 1);
  }
}

// Path for the part of a flow segment that's filled so far; returns the leading point.
function segPath(seg, cx, cy, s, p) {
  ctx.beginPath();
  if (seg.from === -1) {
    ctx.moveTo(cx, cy);
    const head = [cx + DX[seg.to] * s / 2 * p, cy + DY[seg.to] * s / 2 * p];
    ctx.lineTo(...head);
    return head;
  }
  if (seg.to === -1) {
    const [ax, ay] = mid(cx, cy, seg.from, s);
    const head = [ax + (cx - ax) * p, ay + (cy - ay) * p];
    ctx.moveTo(ax, ay); ctx.lineTo(...head);
    return head;
  }
  if (seg.to === opp(seg.from)) {
    const [ax, ay] = mid(cx, cy, seg.from, s), [bx, by] = mid(cx, cy, seg.to, s);
    const head = [ax + (bx - ax) * p, ay + (by - ay) * p];
    ctx.moveTo(ax, ay); ctx.lineTo(...head);
    return head;
  }
  return arcPath(seg.from, seg.to, cx, cy, s, p);
}

// Layered strokes fake a lit steel cylinder (light from the top left).
function tube(build, pal, s, k = 1) {
  ctx.save();
  ctx.lineCap = 'butt';
  // cool edge light from the city, so cold steel still stands out against the black board
  if (pal.rim) { build(); ctx.strokeStyle = pal.rim; ctx.lineWidth = s * 0.5 * k; ctx.stroke(); }
  build(); ctx.strokeStyle = pal.outline; ctx.lineWidth = s * 0.44 * k; ctx.stroke();
  build(); ctx.strokeStyle = pal.base; ctx.lineWidth = s * 0.38 * k; ctx.stroke();
  ctx.translate(-s * 0.03, -s * 0.03);
  build(); ctx.strokeStyle = pal.mid; ctx.lineWidth = s * 0.16 * k; ctx.stroke();
  ctx.globalAlpha *= 0.55;
  build(); ctx.strokeStyle = pal.spec; ctx.lineWidth = s * 0.045 * k; ctx.stroke();
  ctx.restore();
}

function collars(mask, cx, cy, s, pal) {
  const ds = dirsOf(mask);
  const ring = (x0, y0, x1, y1, bolts) => {
    tube(() => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }, pal, s, 1.32);
    if (!bolts) return;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    for (const o of [-1, 1]) {
      const bx = mx + (horiz ? 0 : o * s * 0.22), by = my + (horiz ? o * s * 0.22 : 0);
      ctx.fillStyle = pal.outline;
      ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.spec; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(bx - 0.5, by - 0.5, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };
  for (const d of ds) {
    const [ex, ey] = mid(cx, cy, d, s);
    ring(ex - DX[d] * 1, ey - DY[d] * 1, ex - DX[d] * s * 0.15, ey - DY[d] * s * 0.15, true);
  }
  const straight = ds.length === 2 && ds[1] === opp(ds[0]);
  if (straight) {
    const h = ds.includes(E);
    ring(cx - (h ? s * 0.05 : 0), cy - (h ? 0 : s * 0.05), cx + (h ? s * 0.05 : 0), cy + (h ? 0 : s * 0.05), false);
  }
  if (mask === 15) {
    ctx.fillStyle = pal.outline;
    ctx.fillRect(cx - s * 0.22, cy - s * 0.22, s * 0.44, s * 0.44);
    ctx.fillStyle = pal.base;
    ctx.fillRect(cx - s * 0.19, cy - s * 0.19, s * 0.38, s * 0.38);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(cx - s * 0.19, cy - s * 0.19, s * 0.38, s * 0.06);
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillStyle = pal.outline;
      ctx.beginPath(); ctx.arc(cx + ox * s * 0.12, cy + oy * s * 0.12, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// A cold pipe: steel body then collars. Used on the board, in the tray and as the ghost.
function drawPipe(mask, cx, cy, s, pal = STEEL, ringPal = pal) {
  tube(() => maskPath(mask, cx, cy, s), pal, s);
  collars(mask, cx, cy, s, ringPal);
}

// Chroma inside a pipe: the whole bore turns molten, with a slow crust and fast bright streaks.
function drawMolten(seg, cx, cy, s) {
  const p = Math.min(seg.p, 1);
  if (p <= 0) return null;
  let head;
  const build = () => { head = segPath(seg, cx, cy, s, p); };
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.shadowColor = MOLTEN.glow;
  ctx.shadowBlur = 26;
  build(); ctx.strokeStyle = MOLTEN.crust; ctx.lineWidth = s * 0.44; ctx.stroke();
  ctx.shadowBlur = 0;
  build(); ctx.strokeStyle = MOLTEN.deep; ctx.lineWidth = s * 0.38; ctx.stroke();
  build(); ctx.strokeStyle = MOLTEN.body; ctx.lineWidth = s * 0.29; ctx.stroke();
  ctx.setLineDash([7, 13, 4, 19]);
  ctx.lineDashOffset = -G.time * 16;
  ctx.globalAlpha = 0.5;
  build(); ctx.strokeStyle = MOLTEN.deep; ctx.lineWidth = s * 0.24; ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.translate(-s * 0.02, -s * 0.02);
  build(); ctx.strokeStyle = MOLTEN.hot; ctx.lineWidth = s * 0.14; ctx.stroke();
  ctx.globalAlpha = 0.9;
  build(); ctx.strokeStyle = MOLTEN.core; ctx.lineWidth = s * 0.045; ctx.stroke();
  ctx.setLineDash([2, 7, 6, 12]);
  ctx.lineDashOffset = -G.time * 80;
  ctx.globalAlpha = 0.6;
  build(); ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = s * 0.08; ctx.stroke();
  ctx.restore();
  return head;
}

function litAmount(c) {
  let a = 0;
  for (const s of c.segs) a += s.p;
  return Math.min(1, a);
}

// ---------- cells ----------

function drawBlock(px, py) {
  const pad = 4, w = CELL - pad * 2;
  ctx.save();
  chamfer(px + pad, py + pad, w, w, 8);
  ctx.fillStyle = '#121316'; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,90,20,0.2)'; ctx.lineWidth = 6;
  for (let i = -CELL; i < CELL * 2; i += 15) {
    ctx.beginPath(); ctx.moveTo(px + i, py); ctx.lineTo(px + i - CELL, py + CELL); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(px + pad + 8, py + pad + 8, w - 16, w - 16);
  ctx.restore();
  chamfer(px + pad, py + pad, w, w, 8);
  ctx.strokeStyle = '#26282d'; ctx.lineWidth = 2; ctx.stroke();
  for (const [bx, by] of [[10, 10], [CELL - 10, 10], [10, CELL - 10], [CELL - 10, CELL - 10]]) bolt(px + bx, py + by, 3);
}

function drawCornerBolts(px, py) {
  for (const [bx, by] of [[6, 6], [CELL - 6, 6], [6, CELL - 6], [CELL - 6, CELL - 6]]) bolt(px + bx, py + by, 3);
}

function drawArrow(cx, cy, d) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate([-Math.PI / 2, 0, Math.PI / 2, Math.PI][d]);
  ctx.fillStyle = COLORS.amber; ctx.strokeStyle = '#140c02'; ctx.lineWidth = 2;
  for (const off of [-8, 6]) {
    ctx.beginPath();
    ctx.moveTo(off + 7, 0); ctx.lineTo(off - 4, -9); ctx.lineTo(off - 1, 0); ctx.lineTo(off - 4, 9); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawDiamond(cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
  ctx.fillStyle = '#ffd27a'; ctx.fill();
  ctx.strokeStyle = '#2a1a04'; ctx.lineWidth = 1.5; ctx.stroke();
}

// A heavy ring valve: the Chroma source (start) or the drain (end).
function drawPort(cx, cy, lit, pulse) {
  const r = CELL * 0.34;
  ctx.save();
  if (lit > 0 || pulse > 0) { ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 24 * Math.max(lit, pulse); }
  ctx.fillStyle = '#030304';
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.lineWidth = CELL * 0.14;
  if (lit > 0) {
    ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 20;
    ctx.strokeStyle = MOLTEN.deep;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = CELL * 0.09; ctx.strokeStyle = MOLTEN.body;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = CELL * 0.03; ctx.strokeStyle = MOLTEN.core;
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, r * 0.74, Math.PI * 0.9, Math.PI * 1.8); ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#6c727b'); g.addColorStop(0.5, '#25282d'); g.addColorStop(1, '#0d0e10');
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    if (pulse > 0) {
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,74,18,${0.3 + 0.6 * pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = '#020203';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2); ctx.fill();
  if (lit > 0) {
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.48);
    gg.addColorStop(0, MOLTEN.core); gg.addColorStop(0.5, MOLTEN.hot); gg.addColorStop(1, MOLTEN.deep);
    ctx.globalAlpha = lit * (0.85 + 0.15 * Math.sin(G.time * 7));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawTank(cx, cy, fill) {
  const w = CELL * 0.5, h = CELL * 0.66, x0 = cx - w / 2, y0 = cy - h / 2;
  ctx.fillStyle = '#030304';
  ctx.beginPath(); ctx.roundRect(x0 - 3, y0 - 3, w + 6, h + 6, 8); ctx.fill();
  ctx.fillStyle = '#0a0b0e';
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6); ctx.fill();
  if (fill > 0) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6); ctx.clip();
    const top = y0 + h * (1 - fill);
    const g = ctx.createLinearGradient(0, top, 0, y0 + h);
    g.addColorStop(0, MOLTEN.core); g.addColorStop(0.15, MOLTEN.hot); g.addColorStop(0.6, MOLTEN.body); g.addColorStop(1, MOLTEN.deep);
    ctx.fillStyle = g;
    ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(x0, y0 + h);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x0 + (w * i) / 6, top + Math.sin(G.time * 6 + i * 1.3) * 1.6);
    ctx.lineTo(x0 + w, y0 + h); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0 + 5, y0 + 6); ctx.lineTo(x0 + 5, y0 + h - 6); ctx.stroke();
  for (const yy of [y0 + 4, y0 + h - 4]) { ctx.fillStyle = '#2c2f34'; ctx.fillRect(x0 - 3, yy - 2, w + 6, 4); }
}

function drawCellAt(c, px, py) {
  if (c.kind === 'empty') return;
  if (c.kind === 'block') return drawBlock(px, py);
  const cx = px + CELL / 2, cy = py + CELL / 2;
  ctx.save();
  if (c.pop > 0) {
    const sc = 1 - 0.3 * c.pop;
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  }
  const lit = litAmount(c);
  const pal = c.fixed && c.kind === 'pipe' && !c.bonus ? STEEL_DARK : STEEL;
  let ringPal = lit > 0 ? STEEL_HOT : pal;
  if (c.bonus) ringPal = BRASS;

  tube(() => maskPath(c.mask, cx, cy, CELL), pal, CELL);
  for (const seg of c.segs) {
    const head = drawMolten(seg, cx, cy, CELL);
    if (head && G.flow && seg === G.flow.seg) {
      const r = CELL * 0.28;
      const g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], r);
      g.addColorStop(0, 'rgba(255,248,230,1)'); g.addColorStop(0.3, 'rgba(255,140,50,0.95)'); g.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(head[0], head[1], r * (1 + Math.sin(G.time * 20) * 0.08), 0, Math.PI * 2); ctx.fill();
    }
  }
  if (c.kind !== 'start' && c.kind !== 'end') collars(c.mask, cx, cy, CELL, ringPal);

  if (c.kind === 'start') {
    const pulse = G.running && !G.flowing && !G.finished ? 0.5 + 0.5 * Math.sin(G.time * 5) : 0;
    drawPort(cx, cy, G.flowing || G.finished ? 1 : 0, pulse);
  }
  if (c.kind === 'end') drawPort(cx, cy, c.segs.some(s => s.p >= 1) ? 1 : 0, 0);
  if (c.kind === 'res') drawTank(cx, cy, c.segs.length ? c.segs[0].p : 0);
  if (c.kind === 'oneway') drawArrow(cx, cy, c.dir);
  if (c.bonus) drawDiamond(cx, cy, 6);
  if (c.fixed && c.kind !== 'start' && c.kind !== 'end') drawCornerBolts(px, py);
  ctx.restore();
}

// Worn, scratched black plate under the board, generated once per board size.
function boardPlate(b) {
  const key = `${b.cols}x${b.rows}`;
  if (plateCache.has(key)) return plateCache.get(key);
  const w = b.cols * CELL, h = b.rows * CELL;
  const [c, g] = offscreen(w, h);
  const R = seeded(b.cols * 31 + b.rows);
  g.fillStyle = '#050506'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    const px = x * CELL, py = y * CELL, v = 20 + Math.floor(R() * 6);
    g.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    g.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(px + 1, py + 1, CELL - 2, 1); g.fillRect(px + 1, py + 1, 1, CELL - 2);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(px + 1, py + CELL - 2, CELL - 2, 1); g.fillRect(px + CELL - 2, py + 1, 1, CELL - 2);
  }
  for (let i = 0; i < 180; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.015 + R() * 0.04})`;
    g.lineWidth = 0.6;
    const x = R() * w, y = R() * h, l = 6 + R() * 30, a = R() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const x = R() * w, y = R() * h, r = 10 + R() * 44;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, R() < 0.5 ? 'rgba(80,40,20,0.12)' : 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(190,215,235,${0.025 + R() * 0.06})`;
    g.beginPath(); g.arc(R() * w, R() * h, 0.4 + R() * 1.1, 0, Math.PI * 2); g.fill();
  }
  plateCache.set(key, c);
  return c;
}

// ---------- the machine around the board ----------

function drawHousing() {
  const { x, y, w, h } = HOUSING;

  // cables and conduit running up off the top of the machine
  ctx.save();
  ctx.lineCap = 'round';
  for (const [fx, sway, wdt] of [[0.1, -30, 9], [0.14, 10, 6], [0.19, -8, 12], [0.81, 26, 10], [0.87, -14, 7], [0.92, 6, 5]]) {
    const cx = w * fx;
    ctx.strokeStyle = '#050506'; ctx.lineWidth = wdt + 3;
    ctx.beginPath(); ctx.moveTo(x + cx, y + 2); ctx.bezierCurveTo(x + cx, y - 14, x + cx + sway, y - 20, x + cx + sway, -10); ctx.stroke();
    ctx.strokeStyle = '#1b1d21'; ctx.lineWidth = wdt;
    ctx.stroke();
  }
  ctx.restore();
  // warning lamp on top
  ctx.save();
  ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 20;
  ctx.fillStyle = `rgba(255,90,30,${0.75 + 0.2 * Math.sin(G.time * 3)})`;
  ctx.fillRect(x + w * 0.36, y - 9, 70, 5);
  ctx.restore();
  ctx.fillStyle = '#0b0c0e'; ctx.fillRect(x + w * 0.36 - 6, y - 4, 82, 6);

  // the housing itself: heavy black steel
  chamfer(x, y, w, h, 22);
  const hg = ctx.createLinearGradient(0, y, 0, y + h);
  hg.addColorStop(0, '#16171b'); hg.addColorStop(0.5, '#0d0e11'); hg.addColorStop(1, '#08090b');
  ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = '#2a2624'; ctx.lineWidth = 2; ctx.stroke();
  chamfer(x + 6, y + 6, w - 12, h - 12, 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
  for (const [bx, by] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 30, y + h - 14]]) bolt(bx, by);

  // neon tube on the left side
  ctx.save();
  ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 18;
  ctx.fillStyle = `rgba(255,96,40,${0.8 + 0.12 * Math.sin(G.time * 2.3)})`;
  ctx.fillRect(x - 6, y + 120, 4, h - 260);
  ctx.restore();

  drawHeader();

  // inner board frame
  chamfer(FRAME.x, FRAME.y, FRAME.w, FRAME.h, 16);
  ctx.fillStyle = '#060608'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,40,0.38)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawHeader() {
  const { x, y, w, h } = HEADER;
  chamfer(x, y, w, h, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#121317'); g.addColorStop(1, '#0a0a0d');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,40,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

  // emblem and name, drawn at the wide size and scaled to fit the plate
  const k = h / 70;
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  drawLogo();
  ctx.restore();

  if (TALL) {
    // crossover lights live up here when there's no side panel
    label('X', x + w - 118, y + h / 2 + 4, COLORS.muted, 10);
    drawCrossLights(x + w - 102, y + h / 2 - 5);
    return;
  }
  const dx = x + w - 250;
  ctx.fillStyle = 'rgba(255,90,40,0.4)'; ctx.fillRect(dx, y + 16, 1, h - 32);
  label('KEEP THE CHROMA FLOWING', dx + 16, y + 32, COLORS.text, 11);
  label('KEEP THE CITY ALIVE', dx + 16, y + 50, COLORS.muted, 11);
  // vent grille
  ctx.fillStyle = '#050506';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + w - 34 + i * 4, y + 18, 2, h - 36);
}

function drawCrossLights(x, y) {
  for (let i = 0; i < 5; i++) {
    const on = i < G.crosses;
    ctx.save();
    if (on) { ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 10; }
    ctx.fillStyle = on ? COLORS.goo : '#1c1d21';
    ctx.fillRect(x + i * 18, y, 14, 9);
    ctx.restore();
  }
}

// The molten-elbow emblem and the name, in the title plate's own coordinates (70 high).
function drawLogo() {
  const x = 0, y = 0;
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 16;
  ctx.strokeStyle = MOLTEN.body; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x + 24, y + 56); ctx.lineTo(x + 24, y + 36); ctx.arc(x + 40, y + 36, 16, Math.PI, -Math.PI / 2); ctx.lineTo(x + 62, y + 20); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = MOLTEN.core; ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 16;
  ctx.font = FONT(36, 700); ctx.fillStyle = COLORS.goo; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  spaced('10px');
  ctx.fillText(GAME_NAME, x + 82, y + 44);
  spaced('0px');
  ctx.restore();
  ctx.font = '500 12px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.fillStyle = '#c4452a'; ctx.textAlign = 'left';
  spaced('8px');
  ctx.fillText(GAME_NAME_JP, x + 84, y + 61);
  spaced('0px');
}

function drawBoard() {
  const b = G.board;
  const bw = b.cols * CELL, bh = b.rows * CELL;

  ctx.drawImage(boardPlate(b), b.ox, b.oy, bw, bh);

  // wrap-around gates: cyan neon on the frame
  ctx.save();
  ctx.fillStyle = COLORS.cyan; ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(G.time * 4);
  for (const r of b.wrapRows) {
    const y = b.oy + r * CELL + CELL * 0.18, h = CELL * 0.64;
    ctx.fillRect(b.ox - 7, y, 3, h); ctx.fillRect(b.ox + bw + 4, y, 3, h);
  }
  for (const col of b.wrapCols) {
    const x = b.ox + col * CELL + CELL * 0.18, w = CELL * 0.64;
    ctx.fillRect(x, b.oy - 7, w, 3); ctx.fillRect(x, b.oy + bh + 4, w, 3);
  }
  ctx.restore();

  // pipes: still ones first, sliding ones on top
  const moving = [];
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    const c = at(b, x, y);
    if (c.anim) { moving.push([c, x, y]); continue; }
    drawCellAt(c, b.ox + x * CELL, b.oy + y * CELL);
  }
  for (const [c, x, y] of moving) {
    const t = 1 - Math.pow(1 - c.anim.t, 3);
    drawCellAt(c, b.ox + (x + c.anim.dx * (1 - t)) * CELL, b.oy + (y + c.anim.dy * (1 - t)) * CELL);
  }

  // molten Chroma throws light onto the steel around it
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
    const c = at(b, x, y);
    const lit = c.kind === 'start' && (G.flowing || G.finished) ? 1 : litAmount(c);
    if (lit <= 0) continue;
    const cx = b.ox + x * CELL + CELL / 2, cy = b.oy + y * CELL + CELL / 2, r = CELL * 1.3;
    const flick = 0.85 + 0.15 * Math.sin(G.time * 9 + x * 1.7 + y * 2.3);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,70,20,${0.22 * lit * flick})`);
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();

  // hover feedback
  if (G.hover && G.running && !G.paused && !G.finished) {
    const [hx, hy] = G.hover, c = at(b, hx, hy);
    const px = b.ox + hx * CELL, py = b.oy + hy * CELL;
    let color = null;
    if (G.mode === 'play') {
      const locked = G.time < G.lockUntil;
      if (c.kind === 'empty') {
        ctx.save(); ctx.globalAlpha = locked ? 0.15 : 0.45;
        drawPipe(SHAPES[G.queue[0]], px + CELL / 2, py + CELL / 2, CELL);
        ctx.restore();
        color = locked ? COLORS.red : COLORS.text;
      } else if (c.kind === 'pipe' && !c.fixed && !c.entered) {
        color = COLORS.red;
      }
    } else if (G.mode === 'bonus' && canSlide(hx, hy)) {
      color = COLORS.accent;
    }
    if (color) brackets(px + 3, py + 3, CELL - 6, CELL - 6, color);
  }
}

function brackets(x, y, w, h, color) {
  const l = 10;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
  ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
  ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  ctx.stroke();
}

function drawTray() {
  const { x: sx, y: sy, slot, h, n } = DISP;
  if (G.mode === 'bonus') {
    label('OVERFLOW TEST — SLIDE A PIPE INTO THE GAP', sx, sy + h / 2 + 4, COLORS.muted, 12);
    return;
  }
  label('NEXT', sx + 2, sy - 10, COLORS.label, 14);
  if (TALL) {
    const bad = G.time < G.lockUntil || (G.finished && !levelWon());
    label(statusLine(), sx + n * slot - 2, sy - 10, bad ? COLORS.red : COLORS.muted, 9, 'right');
  }
  ctx.strokeStyle = COLORS.label; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx + 52, sy - 22); ctx.lineTo(sx + 58, sy - 16); ctx.lineTo(sx + 52, sy - 10); ctx.stroke();
  if (!TALL) { ctx.fillStyle = 'rgba(255,90,40,0.25)'; ctx.fillRect(sx + 72, sy - 16, n * slot - 72, 1); }

  ctx.save();
  ctx.beginPath(); ctx.rect(sx - 2, sy - 2, slot * n + 4, h + 4); ctx.clip();
  for (let i = 0; i < n; i++) {
    chamfer(sx + i * slot + 4, sy, slot - 8, h, 10);
    ctx.fillStyle = '#0a0b0d'; ctx.fill();
    ctx.strokeStyle = '#25272b'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < G.queue.length; i++) {
    const cx = sx + i * slot + slot / 2 + G.dispAnim * slot, cy = sy + h / 2;
    drawPipe(SHAPES[G.queue[i]], cx, cy, CELL * 0.92);
  }
  ctx.restore();

  const locked = G.time < G.lockUntil;
  const col = locked ? COLORS.red : COLORS.accent;
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 14;
  chamfer(sx + 4, sy, slot - 8, h, 10);
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  if (locked) {
    chamfer(sx + 4, sy, slot - 8, h, 10);
    ctx.fillStyle = 'rgba(255,59,48,0.2)'; ctx.fill();
    label('VALVE LOCK', sx + slot / 2, sy + h - 8, COLORS.red, 9, 'center');
  }
}

// ---------- control panel ----------

function timerInfo() {
  if (G.mode === 'title') return { label: 'HI SCORE', text: G.high.toLocaleString('en-US'), color: COLORS.text };
  if (G.flowing || G.finished) return { label: G.flowing ? 'FLOWING' : 'STOPPED', text: '0:00', color: COLORS.text, hot: G.flowing };
  const s = Math.ceil(G.countdown);
  return { label: 'CHROMA IN', text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, color: G.countdown <= 3 ? COLORS.red : COLORS.text };
}

// The tall layout's compact readout: level, score, timer and pipeline in one strip.
function drawStats() {
  const { x, y, w, h } = STATS;
  const play = G.mode === 'play', bonus = G.mode === 'bonus';
  panelBox(x, y, w, h, 12);
  const t = timerInfo();
  const met = play && G.len >= G.cfg.min;
  const items = [
    ['LEVEL', bonus ? 'BONUS' : G.mode === 'title' ? '--' : String(G.level).padStart(2, '0'), COLORS.text, COLORS.label],
    ['SCORE', G.score.toLocaleString('en-US'), COLORS.text, COLORS.label],
    [t.label, t.text, t.color, t.hot ? COLORS.goo : COLORS.label],
    [bonus ? 'SECTIONS' : 'PIPES', play ? `${G.len}/${G.cfg.min}` : bonus ? String(G.len) : '--', met ? COLORS.goo : COLORS.text, COLORS.label],
  ];
  const cw = (w - 16) / items.length;
  items.forEach(([l, v, c, lc], i) => {
    const cx = x + 14 + i * cw;
    if (i) { ctx.fillStyle = 'rgba(255,90,40,0.25)'; ctx.fillRect(cx - 8, y + 12, 1, h - 30); }
    label(l, cx, y + 24, lc, 9);
    value(v, cx, y + 50, i === 2 || i === 0 ? 22 : 18, c);
  });
  const bx = x + 14, by = y + h - 13, bw = w - 28;
  ctx.fillStyle = '#121316'; ctx.fillRect(bx, by, bw, 5);
  const frac = play ? Math.min(1, G.len / G.cfg.min) : bonus ? Math.min(1, G.len / 20) : 0;
  if (frac > 0) {
    ctx.save();
    ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.goo; ctx.fillRect(bx, by, bw * frac, 5);
    ctx.restore();
  }
}

const LAID_SHAPES = ['H', 'NE', 'ES', 'X', 'V', 'SW'];

function drawSide() {
  const { x, w } = SIDE;
  const play = G.mode === 'play', bonus = G.mode === 'bonus';

  // level, score, time
  let y = SIDE.y;
  panelBox(x, y, w, 158, 14);
  label('LEVEL', x + 20, y + 30);
  if (bonus) value('BONUS', x + 20, y + 70, 34);
  else if (G.mode === 'title') value('--', x + 20, y + 70, 34);
  else {
    value(String(G.level).padStart(2, '0'), x + 20, y + 70, 38);
    label('TARGET', x + w - 20, y + 48, COLORS.muted, 10, 'right');
    value(`${G.cfg.min} PIPES`, x + w - 20, y + 70, 18, COLORS.text, 'right');
  }
  ctx.fillStyle = 'rgba(255,90,40,0.3)';
  ctx.fillRect(x + 20, y + 86, w - 40, 1);
  ctx.fillRect(x + w / 2 + 6, y + 98, 1, 46);
  label('SCORE', x + 20, y + 110);
  value(G.score.toLocaleString('en-US'), x + 20, y + 140, 26);
  const timeLabel = G.mode === 'title' ? 'HI SCORE' : G.flowing ? 'FLOWING' : G.finished ? 'STOPPED' : 'CHROMA IN';
  label(timeLabel, x + w / 2 + 20, y + 110, G.flowing ? COLORS.goo : COLORS.label);
  let t;
  if (G.mode === 'title') t = G.high.toLocaleString('en-US');
  else if (G.flowing || G.finished) t = '0:00';
  else { const s = Math.ceil(G.countdown); t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  value(t, x + w / 2 + 20, y + 140, 26, !G.flowing && !G.finished && G.mode !== 'title' && G.countdown <= 3 ? COLORS.red : COLORS.text);

  // pipes laid, by shape
  y += 170;
  panelBox(x, y, w, 196, 14);
  label('PIPES LAID', x + 20, y + 30);
  const cw = (w - 40) / 3, ch = 58;
  LAID_SHAPES.forEach((sh, i) => {
    const cx = x + 20 + (i % 3) * cw, cy = y + 42 + Math.floor(i / 3) * (ch + 6);
    chamfer(cx + 2, cy, cw - 4, ch, 6);
    ctx.fillStyle = '#08090b'; ctx.fill();
    ctx.strokeStyle = '#24262a'; ctx.lineWidth = 1; ctx.stroke();
    drawPipe(SHAPES[sh], cx + cw / 2, cy + 22, CELL * 0.48);
    label(`× ${(G.laid && G.laid[sh]) || 0}`, cx + cw / 2, cy + ch - 6, COLORS.muted, 10, 'center');
  });
  label('CROSSOVERS', x + 20, y + 182, COLORS.muted, 10);
  drawCrossLights(x + w - 20 - 5 * 18, y + 173);

  // flow: pipeline length toward the target
  y += 208;
  panelBox(x, y, w, 82, 14);
  label('FLOW', x + 20, y + 30);
  const lenText = play ? `${G.len} / ${G.cfg.min}` : bonus ? `${G.len}` : '';
  label(lenText, x + w - 20, y + 30, play && G.len >= G.cfg.min ? COLORS.goo : COLORS.text, 12, 'right');
  const bx = x + 20, by = y + 44, bw = w - 40, bh = 12;
  ctx.fillStyle = '#121316'; ctx.fillRect(bx, by, bw, bh);
  let frac = 0;
  if (play) frac = Math.min(1, G.len / G.cfg.min);
  else if (bonus) frac = Math.min(1, G.len / 20);
  if (frac > 0) {
    ctx.save();
    ctx.shadowColor = MOLTEN.glow; ctx.shadowBlur = 12;
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, MOLTEN.deep); fg.addColorStop(1, MOLTEN.hot);
    ctx.fillStyle = fg; ctx.fillRect(bx, by, bw * frac, bh);
    ctx.restore();
  }
  if (G.flowing) {
    ctx.fillStyle = 'rgba(255,240,220,0.6)';
    const sp = G.ff ? 160 : 50;
    for (let i = -1; i < bw / 16 + 1; i++) {
      const cx = bx + ((i * 16 + G.time * sp) % (bw + 16));
      if (cx < bx || cx > bx + bw * frac - 6) continue;
      ctx.beginPath(); ctx.moveTo(cx, by + 2); ctx.lineTo(cx + 5, by + bh / 2); ctx.lineTo(cx, by + bh - 2); ctx.lineTo(cx + 2, by + bh / 2); ctx.closePath(); ctx.fill();
    }
  }
  label(statusLine(), x + 20, y + 72, G.time < G.lockUntil || (G.finished && !levelWon()) ? COLORS.red : COLORS.muted, 9);

  // city ad
  y += 94;
  const ah = HOUSING.y + HOUSING.h - y;
  drawAd(x, y, w, ah);
}

function levelWon() {
  return G.mode === 'bonus' || (G.cfg && G.len >= G.cfg.min && (!G.cfg.hasEnd || G.reachedEnd));
}

function statusLine() {
  if (G.mode === 'title') return 'GRID OFFLINE — AWAITING OPERATOR';
  if (G.time < G.lockUntil) return 'VALVE LOCK';
  if (G.finished) return levelWon() ? 'SECTOR RESTORED' : 'LINE BREACH';
  if (G.flowing) {
    if (G.ff) return 'FLOODING — MAX PRESSURE';
    return G.mode === 'play' && G.len >= G.cfg.min ? 'TARGET MET — KEEP IT FLOWING' : 'CHROMA IN THE LINES';
  }
  if (G.mode === 'play' && G.cfg.hasEnd) return 'DRAIN ONLINE — ROUTE REQUIRED';
  return TOUCH ? 'PRESSURE BUILDING' : 'PRESSURE BUILDING — [F] RELEASE';
}

// A little advert screen from the city, in the bottom of the control column.
function drawAd(x, y, w, h) {
  if (!adLayer || adLayer.w !== w || adLayer.h !== h) {
    const [c, g] = offscreen(w, h);
    const R = seeded(99);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#12060a'); bg.addColorStop(0.6, '#3a0c0a'); bg.addColorStop(1, '#0a0304');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w * 0.7, h * 0.75, 0, w * 0.7, h * 0.75, w * 0.6);
    glow.addColorStop(0, 'rgba(255,80,30,0.55)'); glow.addColorStop(1, 'rgba(255,40,10,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    let bxp = -4;
    while (bxp < w) {
      const bw = 10 + R() * 24, bh = h * (0.25 + R() * 0.55);
      g.fillStyle = '#0a0304'; g.fillRect(bxp, h - bh, bw, bh);
      for (let wy = h - bh + 6; wy < h - 4; wy += 6) for (let wx = bxp + 3; wx < bxp + bw - 3; wx += 5) {
        if (R() < 0.12) { g.fillStyle = `rgba(255,${120 + R() * 80},60,${0.4 + R() * 0.5})`; g.fillRect(wx, wy, 2, 2); }
      }
      bxp += bw + R() * 4;
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < h; i += 3) g.fillRect(0, i, w, 1);
    adLayer = { c, w, h };
  }
  ctx.save();
  chamfer(x, y, w, h, 14);
  ctx.clip();
  ctx.drawImage(adLayer.c, x, y, w, h);
  // a flying car drifting across
  const carX = x + ((G.time * 18) % (w + 80)) - 40, carY = y + h * 0.38;
  ctx.fillStyle = '#050203';
  ctx.beginPath(); ctx.ellipse(carX, carY, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(170,230,255,0.9)'; ctx.fillRect(carX + 14, carY - 1, 3, 2);
  // vertical neon katakana
  ctx.save();
  ctx.shadowColor = '#ff3b2a'; ctx.shadowBlur = 12;
  ctx.fillStyle = Math.sin(G.time * 17) > 0.97 ? 'rgba(255,80,60,0.3)' : '#ff4a3a';
  ctx.font = '600 20px "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...GAME_NAME_JP].forEach((ch, i) => ctx.fillText(ch, x + w - 26, y + 26 + i * 24));
  ctx.restore();
  label('SAME PIPES.', x + 16, y + 26, '#ffb08a', 10);
  label('NEW WORLD.', x + 16, y + 42, '#ffb08a', 10);
  label(GAME_NAME, x + 16, y + h - 12, '#ff7a4a', 9);
  ctx.restore();
  chamfer(x, y, w, h, 14);
  ctx.strokeStyle = 'rgba(255,90,40,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function render() {
  ctx.clearRect(0, 0, VW, VH);
  drawHousing();
  drawBoard();
  drawTray();
  if (TALL) drawStats(); else drawSide();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.font = FONT(13, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of G.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.fillStyle = '#000'; ctx.fillText(p.text, p.x + 1.5, p.y + 1.5);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
//  Rendering — the city behind everything
// =====================================================================

const cityCanvas = document.getElementById('city');
const cctx = cityCanvas.getContext('2d');
const city = { w: 0, h: 0, layer: null, signs: [], beacons: [], holo: [], cars: [], rain: [], steam: [], vents: [] };

const NEON = ['#ff2d55', '#ff5a1f', '#2ad4ff', '#ff36c8', '#ffb020', '#ff3b2a'];
const SIGN_TEXT = ['未来', '配管', '冷却', '営業中', '危険', '修理', '電力', 'クロマ', '夜', '工場', '酒', '薬'];

function skyline(g, R, w, street, h, o, out) {
  let x = -30;
  while (x < w + 30) {
    const bw = o.wMin + R() * (o.wMax - o.wMin);
    const bh = h * (o.hMin + R() * (o.hMax - o.hMin));
    const top = street - bh;
    g.fillStyle = o.col;
    g.fillRect(x, top, bw, h - top);
    if (R() < 0.45) {
      const cw = bw * (0.4 + R() * 0.35), chh = bh * (0.05 + R() * 0.06);
      g.fillRect(x + (bw - cw) / 2, top - chh, cw, chh + 1);
      if (R() < o.spire) {
        const sx = x + bw / 2, sh = 30 + R() * 70;
        g.fillRect(sx - 1, top - chh - sh, 2, sh);
        out.beacons.push({ x: sx, y: top - chh - sh, p: R() * 6 });
      }
    }
    // ledges and light bands
    for (let ly = top + 14; ly < street; ly += 26 + R() * 40) {
      g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(x, ly, bw, 2);
    }
    for (let wy = top + 8; wy < street - 4; wy += o.wh + o.gy) {
      const band = R() < o.band;
      for (let wx = x + 4; wx < x + bw - 4 - o.ww; wx += o.ww + o.gx) {
        if (R() < (band ? 0.7 : o.win)) { g.fillStyle = o.wcol(R); g.fillRect(wx, wy, o.ww, o.wh); }
      }
    }
    if (R() < o.strip) {
      const col = NEON[Math.floor(R() * NEON.length)];
      g.save(); g.shadowColor = col; g.shadowBlur = 12; g.fillStyle = col; g.globalAlpha = 0.55;
      g.fillRect(x + (R() < 0.5 ? 1 : bw - 3), top + bh * 0.08, 2, bh * (0.3 + R() * 0.4));
      g.restore();
    }
    if (R() < o.sign) {
      const vertical = R() < 0.75, col = NEON[Math.floor(R() * NEON.length)];
      const text = SIGN_TEXT[Math.floor(R() * SIGN_TEXT.length)];
      const sz = o.signSize * (0.8 + R() * 0.5);
      const sw = vertical ? sz + 12 : [...text].length * sz + 18, sh = vertical ? [...text].length * (sz + 4) + 14 : sz + 16;
      const sx = x + R() * Math.max(4, bw - sw), sy = top + 16 + R() * Math.max(10, bh * 0.45);
      out.signs.push({ x: sx, y: sy, w: sw, h: sh, flick: R() < 0.3, seed: R() * 100 });
      g.save();
      g.shadowColor = col; g.shadowBlur = 20;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(sx, sy, sw, sh);
      g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(sx, sy, sw, sh);
      g.fillStyle = col;
      g.font = `700 ${sz}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (vertical) [...text].forEach((ch, i) => g.fillText(ch, sx + sw / 2, sy + 10 + sz / 2 + i * (sz + 4)));
      else g.fillText(text, sx + sw / 2, sy + sh / 2 + 1);
      g.restore();
      out.reflect.push({ x: sx + sw / 2, w: sw, col });
    }
    x += bw + R() * o.gap;
  }
}

function fog(g, w, street, h, height, color) {
  const fg = g.createLinearGradient(0, street - h * height, 0, street);
  fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, color);
  g.fillStyle = fg; g.fillRect(0, street - h * height, w, h * height);
}

// A giant holographic advert on the side of a mega-tower.
function holoAd(g, x, y, w, h, out) {
  g.save();
  g.shadowColor = '#ff3b2a'; g.shadowBlur = 40;
  const bg = g.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(255,60,50,0.55)'); bg.addColorStop(0.5, 'rgba(160,20,40,0.5)'); bg.addColorStop(1, 'rgba(60,5,20,0.55)');
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.restore();
  // a molten pipe graphic winding down the ad
  g.save();
  g.lineCap = 'round';
  g.shadowColor = '#ff6a1f'; g.shadowBlur = 18;
  g.strokeStyle = 'rgba(255,170,90,0.9)'; g.lineWidth = w * 0.09;
  g.beginPath();
  g.moveTo(x + w * 0.25, y + h * 0.08);
  g.lineTo(x + w * 0.25, y + h * 0.3);
  g.quadraticCurveTo(x + w * 0.25, y + h * 0.38, x + w * 0.5, y + h * 0.38);
  g.quadraticCurveTo(x + w * 0.75, y + h * 0.38, x + w * 0.75, y + h * 0.46);
  g.lineTo(x + w * 0.75, y + h * 0.6);
  g.stroke();
  g.restore();
  g.save();
  g.shadowColor = '#ffffff'; g.shadowBlur = 14;
  g.fillStyle = 'rgba(255,235,225,0.95)';
  const sz = Math.min(w * 0.42, h * 0.1);
  g.font = `700 ${sz}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  [...GAME_NAME_JP].forEach((ch, i) => g.fillText(ch, x + w / 2, y + h * 0.66 + i * sz * 1.05));
  g.font = `700 ${Math.max(9, w * 0.11)}px "Chakra Petch", sans-serif`;
  g.fillText(GAME_NAME, x + w / 2, y + h * 0.95);
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = y; i < y + h; i += 3) g.fillRect(x, i, w, 1);
  out.holo.push({ x, y, w, h });
}

function buildCity() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  cityCanvas.width = Math.ceil(w * dpr);
  cityCanvas.height = Math.ceil(h * dpr);
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [c, g] = offscreen(w, h, dpr);
  const R = seeded(2077);
  const street = h * 0.9;
  const out = { signs: [], beacons: [], holo: [], reflect: [] };

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#02030a'); sky.addColorStop(0.4, '#080a1c'); sky.addColorStop(0.72, '#1a0c26'); sky.addColorStop(1, '#2a0d1c');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (const [px, py, r, col] of [[0.88, 0.55, 0.5, 'rgba(255,40,90,0.16)'], [0.1, 0.5, 0.45, 'rgba(40,140,255,0.10)'], [0.5, 0.9, 0.7, 'rgba(255,80,30,0.12)']]) {
    const gr = g.createRadialGradient(w * px, h * py, 0, w * px, h * py, w * r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }

  // far: a dense forest of pale towers lost in the haze
  skyline(g, R, w, street, h, {
    col: '#161a33', wMin: 14, wMax: 44, hMin: 0.3, hMax: 0.82, gap: 4, spire: 0.5,
    ww: 2, wh: 3, gx: 3, gy: 4, win: 0.06, band: 0.05, wcol: R2 => `rgba(140,180,255,${0.12 + R2() * 0.2})`,
    strip: 0.15, sign: 0, signSize: 10,
  }, out);
  fog(g, w, street, h, 0.6, 'rgba(70,40,90,0.55)');

  // mega-towers carrying the giant holograms, near the edges where they show around the game
  for (const fx of [0.06, 0.9]) {
    const tw = Math.max(90, w * 0.075), tx = w * fx - tw / 2, top = h * 0.06;
    g.fillStyle = '#0c0d18'; g.fillRect(tx, top, tw, street - top);
    g.fillRect(tx + tw * 0.4, top - 70, 3, 70);
    out.beacons.push({ x: tx + tw * 0.4 + 1, y: top - 70, p: R() * 6 });
    for (let wy = top + 10; wy < street; wy += 7) for (let wx = tx + 4; wx < tx + tw - 4; wx += 6) {
      if (R() < 0.08) { g.fillStyle = `rgba(120,170,255,${0.1 + R() * 0.2})`; g.fillRect(wx, wy, 2, 3); }
    }
    holoAd(g, tx + tw * 0.12, top + h * 0.1, tw * 0.76, h * 0.42, out);
  }

  // mid: darker blocks with warm windows and neon signs
  skyline(g, R, w, street, h, {
    col: '#0b0c16', wMin: 34, wMax: 90, hMin: 0.22, hMax: 0.6, gap: 8, spire: 0.3,
    ww: 3, wh: 4, gx: 4, gy: 4, win: 0.07, band: 0.08,
    wcol: R2 => (R2() < 0.75 ? `rgba(255,170,100,${0.15 + R2() * 0.35})` : `rgba(90,210,255,${0.15 + R2() * 0.3})`),
    strip: 0.3, sign: 0.45, signSize: 15,
  }, out);
  fog(g, w, street, h, 0.3, 'rgba(60,20,40,0.5)');

  // near: black industrial hulks with pipework
  skyline(g, R, w, street, h, {
    col: '#040406', wMin: 60, wMax: 160, hMin: 0.1, hMax: 0.34, gap: 12, spire: 0.1,
    ww: 4, wh: 5, gx: 7, gy: 9, win: 0.03, band: 0.02, wcol: R2 => `rgba(255,140,70,${0.2 + R2() * 0.3})`,
    strip: 0.15, sign: 0.35, signSize: 22,
  }, out);
  for (let i = 0; i < 14; i++) {
    const py = street - h * (0.03 + R() * 0.25);
    g.strokeStyle = '#0d0e11'; g.lineWidth = 3 + R() * 6;
    g.beginPath(); g.moveTo(R() * w, py); g.lineTo(R() * w, py); g.stroke();
  }
  const vents = Array.from({ length: 5 }, () => ({ x: R() * w, y: street - h * (0.04 + R() * 0.2) }));

  // wet street: smeared reflections of everything that glows
  const st = g.createLinearGradient(0, street, 0, h);
  st.addColorStop(0, '#0a0710'); st.addColorStop(1, '#020203');
  g.fillStyle = st; g.fillRect(0, street, w, h - street);
  for (const r of out.reflect) {
    const rg = g.createLinearGradient(0, street, 0, h);
    rg.addColorStop(0, r.col + '55'); rg.addColorStop(1, r.col + '00');
    g.fillStyle = rg; g.fillRect(r.x - r.w * 0.3, street, r.w * 0.6, h - street);
  }
  for (const ho of out.holo) {
    const rg = g.createLinearGradient(0, street, 0, h);
    rg.addColorStop(0, 'rgba(255,60,50,0.35)'); rg.addColorStop(1, 'rgba(255,60,50,0)');
    g.fillStyle = rg; g.fillRect(ho.x, street, ho.w, h - street);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.04})`;
    g.fillRect(R() * w, street + R() * (h - street), 20 + R() * 80, 1);
  }
  // the lone figure at the railing
  g.fillStyle = '#010102';
  const fx = w * 0.955, fy = street;
  g.fillRect(fx - 8, fy - 50, 16, 44); g.beginPath(); g.arc(fx, fy - 57, 7, 0, Math.PI * 2); g.fill();
  g.fillRect(fx - 7, fy - 8, 6, 8); g.fillRect(fx + 1, fy - 8, 6, 8);
  g.fillStyle = '#0b0b10'; g.fillRect(0, street - 20, w, 3);
  for (let rx = 0; rx < w; rx += 24) g.fillRect(rx, street - 20, 2, 20);

  Object.assign(city, {
    w, h, street, layer: c, signs: out.signs, beacons: out.beacons, holo: out.holo, vents,
    cars: Array.from({ length: 7 }, (_, i) => {
      const depth = 0.4 + R() * 0.8;
      return { x: R() * w, y: h * (0.1 + R() * 0.45), v: (12 + R() * 30) * depth * (i % 2 ? -1 : 1), s: depth };
    }),
    rain: Array.from({ length: Math.round((w * h) / 5000) }, () => {
      const near = R() < 0.3;
      return { x: R() * w, y: R() * h, l: near ? 18 + R() * 16 : 6 + R() * 8, v: near ? 900 + R() * 300 : 500 + R() * 200, a: near ? 0.22 : 0.1 };
    }),
    steam: [],
  });
}

function drawCity(dt) {
  if (!city.layer) return;
  const { w, h, street } = city;
  const g = cctx;
  g.drawImage(city.layer, 0, 0, w, h);

  // searchlights sweeping the haze
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [bx, sp, ph] of [[0.22, 0.25, 0], [0.7, 0.18, 2]]) {
    const a = -Math.PI / 2 + Math.sin(G.time * sp + ph) * 0.35;
    const x0 = w * bx, y0 = street, len = h * 1.1;
    const x1 = x0 + Math.cos(a - 0.04) * len, y1 = y0 + Math.sin(a - 0.04) * len;
    const x2 = x0 + Math.cos(a + 0.04) * len, y2 = y0 + Math.sin(a + 0.04) * len;
    const bg = g.createLinearGradient(x0, y0, (x1 + x2) / 2, (y1 + y2) / 2);
    bg.addColorStop(0, 'rgba(160,200,255,0.10)'); bg.addColorStop(1, 'rgba(160,200,255,0)');
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
  }
  g.restore();

  // flickering signs and glitching holograms
  for (const s of city.signs) {
    if (!s.flick) continue;
    const n = Math.sin(G.time * 13 + s.seed) + Math.sin(G.time * 31 + s.seed * 2);
    if (n > 1.4) { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8); }
  }
  for (const ho of city.holo) {
    if (Math.sin(G.time * 2.1 + ho.x) > 0.985) {
      const by = ho.y + ((G.time * 400) % ho.h), bh = 10;
      const dpr = city.layer.width / w;
      g.drawImage(city.layer, ho.x * dpr, by * dpr, ho.w * dpr, bh * dpr, ho.x + 8, by, ho.w, bh);
    }
  }
  for (const b of city.beacons) {
    if (Math.sin(G.time * 2 + b.p) > 0.6) {
      g.save(); g.shadowColor = '#ff2020'; g.shadowBlur = 8; g.fillStyle = '#ff3030';
      g.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); g.restore();
    }
  }

  // flying cars
  for (const car of city.cars) {
    car.x += car.v * dt;
    if (car.x > w + 80) car.x = -80;
    if (car.x < -80) car.x = w + 80;
    const dir = Math.sign(car.v), x = car.x, y = car.y, s = car.s;
    const tg = g.createLinearGradient(x - dir * 60 * s, 0, x, 0);
    tg.addColorStop(0, 'rgba(255,60,60,0)'); tg.addColorStop(1, 'rgba(255,60,60,0.25)');
    g.fillStyle = tg; g.fillRect(Math.min(x, x - dir * 60 * s), y - 1, 60 * s, 2);
    g.fillStyle = '#07080c';
    g.beginPath(); g.ellipse(x, y, 22 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 8 * s, y - 7 * s, 16 * s, 4 * s);
    g.fillStyle = 'rgba(180,235,255,0.95)'; g.fillRect(x + dir * 19 * s, y - 1, 3, 2);
    g.fillStyle = 'rgba(255,50,50,0.95)'; g.fillRect(x - dir * 22 * s, y - 1, 2, 2);
    const glow = g.createRadialGradient(x, y + 6 * s, 0, x, y + 6 * s, 24 * s);
    glow.addColorStop(0, 'rgba(90,200,255,0.25)'); glow.addColorStop(1, 'rgba(90,200,255,0)');
    g.fillStyle = glow; g.fillRect(x - 24 * s, y, 48 * s, 30 * s);
  }

  // steam from the vents
  if (Math.random() < dt * 6) {
    const v = city.vents[Math.floor(Math.random() * city.vents.length)];
    city.steam.push({ x: v.x, y: v.y, r: 8, life: 1 });
  }
  for (const p of city.steam) { p.life -= dt * 0.25; p.y -= dt * 22; p.x += dt * 6; p.r += dt * 14; }
  city.steam = city.steam.filter(p => p.life > 0);
  for (const p of city.steam) {
    const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    sg.addColorStop(0, `rgba(200,190,210,${0.07 * p.life})`); sg.addColorStop(1, 'rgba(200,190,210,0)');
    g.fillStyle = sg; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }

  // rain, two depths
  for (const pass of [0.1, 0.22]) {
    g.strokeStyle = `rgba(175,205,255,${pass})`;
    g.lineWidth = pass > 0.15 ? 1.2 : 0.8;
    g.beginPath();
    for (const d of city.rain) {
      if (d.a !== pass) continue;
      d.y += d.v * dt; d.x -= d.v * dt * 0.15;
      if (d.y > h) { d.y = -20; d.x = Math.random() * (w + 100); }
      g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.15, d.y - d.l);
    }
    g.stroke();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  drawCity(dt);
  render();
  requestAnimationFrame(frame);
}

// =====================================================================
//  Panels (HTML overlay)
// =====================================================================

const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');

function showPanel(html) {
  panel.innerHTML = html;
  overlay.classList.remove('hidden');
  const focus = panel.querySelector('.primary') || panel.querySelector('button');
  if (focus) focus.focus();
}
function hidePanel() { overlay.classList.add('hidden'); }

function showTitle() {
  applyLayout(wantTall());
  Object.assign(G, { mode: 'title', running: false, paused: false, finished: false, flowing: false, flow: null, board: buildDemoBoard(), score: 0 });
  const savedPw = store.get('gooline.pw', '');
  const lastPw = levelForPassword(savedPw) ? savedPw : '';
  showPanel(`
    <h1>${GAME_NAME}</h1>
    <p class="tag">${TAGLINE}<span>${GAME_NAME_JP}</span></p>
    <ul>
      <li>${TOUCH ? 'Tap' : 'Click'} an empty square to lay the <b>NEXT</b> pipe from the dispenser. No rotating.</li>
      <li>When the timer runs out, Chroma pours from the source valve. Keep it flowing for at least the target length.</li>
      <li>${TOUCH ? 'Tap' : 'Click'} a laid pipe to swap it for the next one (${PTS.replace} points and a short wait).</li>
      <li>Chroma crossing itself in a <b>+</b> piece scores big. Unused pipes cost you at the end.</li>
      <li>${TOUCH ? '<b>Flood now</b> releases the Chroma early, or speeds it up once it\'s flowing.' : '<b>F</b> floods early / fast-forwards. <b>P</b> pauses. <b>M</b> mutes.'}</li>
    </ul>
    <div class="row">
      <button class="primary" data-action="new">New game</button>
      <input id="pw" placeholder="PASSWORD" maxlength="10" value="${lastPw}" autocomplete="off" spellcheck="false">
      <button data-action="pw">Go</button>
    </div>
    <p class="muted" id="pw-msg">High score: ${G.high}</p>
  `);
}

const FEATURE_TEXT = [
  ['blocks', 'Hazard blocks can\'t be built on.'],
  ['bonusPipes', `Brass ◆ pipes are already laid — run Chroma through them for +${PTS.bonusPipe}.`],
  ['reservoirs', `Reservoir tanks take ${RES_TIME}s to fill, buying you time (+${PTS.reservoir}).`],
  ['hasEnd', 'This level has a <b>DRAIN</b>. The Chroma must finish there or it\'s game over.'],
  ['oneways', 'Arrow pipes only let Chroma flow one way.'],
  ['wrap', 'Glowing cyan gates on the edge wrap Chroma around to the opposite side.'],
  ['fixedPipes', 'Bolted pipes can\'t be replaced.'],
];

function showLevelIntro() {
  const c = G.cfg;
  const rules = FEATURE_TEXT.filter(([k]) => c[k]).map(([, t]) => `<li>${t}</li>`).join('');
  showPanel(`
    <h2>Sector ${G.level}</h2>
    <p>Lay at least <b>${c.min}</b> pipes. Chroma arrives in <b>${c.delay}s</b>.</p>
    ${rules ? `<ul>${rules}</ul>` : ''}
    <div class="row"><button class="primary" data-action="begin">Go</button></div>
  `);
}

const actions = {
  new() { hidePanel(); newGame(1); },
  pw() {
    const input = panel.querySelector('#pw');
    const lv = levelForPassword(input ? input.value : '');
    if (lv) { hidePanel(); newGame(lv); }
    else {
      const msg = panel.querySelector('#pw-msg');
      if (msg) { msg.textContent = 'That password doesn\'t ring a bell.'; msg.style.color = COLORS.red; }
      Sound.deny();
    }
  },
  begin() { hidePanel(); G.running = true; },
  next() {
    hidePanel();
    if (G.mode === 'play' && G.level % BONUS_EVERY === 0) startBonus();
    else startLevel(G.level + 1);
  },
  retry() { G.score = G.levelStartScore; startLevel(G.level); },
  resume() { togglePause(false); },
  title() { showTitle(); },
};

panel.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  Sound.init();
  actions[el.dataset.action]?.();
});
panel.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'pw') { Sound.init(); actions.pw(); }
});

// =====================================================================
//  Input
// =====================================================================

function toCell(e) {
  const r = canvas.getBoundingClientRect();
  const lx = (e.clientX - r.left) * VW / r.width, ly = (e.clientY - r.top) * VH / r.height;
  const b = G.board;
  const x = Math.floor((lx - b.ox) / CELL), y = Math.floor((ly - b.oy) / CELL);
  return inBounds(b, x, y) ? [x, y] : null;
}

canvas.addEventListener('pointermove', e => { G.hover = toCell(e); });
canvas.addEventListener('pointerleave', () => { G.hover = null; });
canvas.addEventListener('pointerdown', e => {
  Sound.init();
  const c = toCell(e);
  G.hover = e.pointerType === 'touch' ? null : c;
  if (c) clickCell(c[0], c[1]);
});

const soundBtn = document.getElementById('btn-sound');
function syncSoundBtn() { soundBtn.textContent = `Sound ${Sound.muted ? 'off' : 'on'}${TOUCH ? '' : ' [M]'}`; }
if (TOUCH) {
  document.getElementById('btn-flood').textContent = 'Flood now';
  document.getElementById('btn-pause').textContent = 'Pause';
}
function toggleMute() {
  Sound.muted = !Sound.muted;
  store.set('gooline.muted', Sound.muted ? '1' : '0');
  syncSoundBtn();
}
document.getElementById('btn-flood').addEventListener('click', () => { Sound.init(); flood(); });
document.getElementById('btn-pause').addEventListener('click', () => togglePause());
soundBtn.addEventListener('click', toggleMute);

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === 'f' || (k === ' ' && overlay.classList.contains('hidden'))) { e.preventDefault(); Sound.init(); flood(); }
  else if (k === 'p' || k === 'escape') togglePause();
  else if (k === 'm') toggleMute();
});
window.addEventListener('blur', () => togglePause(true));

// =====================================================================
//  Boot
// =====================================================================

window.addEventListener('resize', () => {
  // the title screen follows the phone's orientation; a level in progress keeps its board
  if (G.mode === 'title' && wantTall() !== TALL) { applyLayout(wantTall()); G.board = buildDemoBoard(); }
  else resizeCanvas();
});
syncSoundBtn();
showTitle();
requestAnimationFrame(frame);

// Installable app: cache the game so it opens offline from the home screen.
// (Browsers only allow this on https or localhost.)
if ('serviceWorker' in navigator && window.isSecureContext) {
  const registerSW = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  if (document.readyState === 'complete') registerSW();
  else window.addEventListener('load', registerSW);
}
