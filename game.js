// ball game. course, physics, collisions and dialogue traced from data.win.
// sprites ripped from the owned copy. fixed 30hz step.
"use strict";

const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;

const STEP = 1 / 30;
const WORLD = { w: 760, h: 580 };
const GEN = { x: 340, y: 120 };
const HOLE = { x: 440, y: 440, w: 20, h: 16 };
const HOLEBOX = { x: 440, y: 447, w: 20, h: 10 };
const PSTART = { x: 60, y: 100 };
const ICE = [[260, 380], [260, 420], [220, 380], [260, 340]];
const SIGNBOX = { x: 440, y: 360, w: 20, h: 20 };
const HOLESIGNBOX = { x: 440, y: 440, w: 20, h: 20 };

// solidparent set: every wall cell is 20x20 except WIDE (40x20).
// singletree true hitbox is (x+5,y+37,46,19), from spr_singletree bbox.
const SOLIDS = [];
for (const arr of [S20, SUL, SUR, SDL, SDR])
  for (const [x, y] of arr) SOLIDS.push({ x, y, w: 20, h: 20 });
// obj_solidlong Create_0 sets image_xscale=400, obj_solidtall image_yscale=400:
// bbox margin 19*400 runs ~7600px, so these walls cross the whole room.
for (const [x, y] of LONG) SOLIDS.push({ x, y, w: 7601, h: 20 });
for (const [x, y] of TALL) SOLIDS.push({ x, y, w: 20, h: 7601 });
for (const [x, y] of WIDE) SOLIDS.push({ x, y, w: 40, h: 20 });
for (const [x, y] of TREE) SOLIDS.push({ x: x + 5, y: y + 37, w: 46, h: 19 });
// corner sets, one slide handler each (sdr=10, sdl=11, sur=12, sul=13).
function cells(arr) { return arr.map(([x, y]) => ({ x, y, w: 20, h: 20 })); }
const CORN = { sdr: cells(SDR), sdl: cells(SDL), sur: cells(SUR), sul: cells(SUL) };
// solidnpcparent set: exact sprite bboxes at instance pos. also the talk targets.
const NPCS = [
  { id: "sans", x: 602, y: 80, w: 21, h: 11 },
  { id: "cream", x: 74, y: 60, w: 57, h: 17 },
  { id: "snow", x: 597, y: 399, w: 6, h: 6 },
  { id: "drake", x: 442, y: 40, w: 25, h: 22 },
];
// obj_golfedge: non-solid, invisible. ball-only bounce boxes.
const EDGES = [];
for (const [x, y] of EDGE) EDGES.push({ x, y, w: 20, h: 20 });

function img(f) { const i = new Image(); i.src = "assets/" + f; return i; }
const SPR = {
  ball: img("spr_rollsnow_0.png"),
  hole: img("spr_hole2_0.png"),
  tileset: img("bg_tundratiles.png"),
  ruins: img("bg_ruinsplaceholder.png"),
  tree: img("spr_singletree_0.png"),
  cream: img("spr_icecreamguy_sad_0.png"),
  creamAnim: img("spr_icecreamguy_anim_0.png"),
  creamHappy: [img("spr_icecreamguy_happy_0.png"), img("spr_icecreamguy_happy_1.png")],
  drake: img("spr_chilldrakenpc_0.png"),
  sans: img("spr_sans_d_0.png"),
  sansU: img("spr_sans_u_0.png"),
  sansL: img("spr_sans_l_0.png"),
  sansR: img("spr_sans_r_0.png"),
  face: img("spr_face_sans_0.png"),
  heart: img("spr_heartsmall_0.png"),
  snow: img("spr_rollsnow_0.png"),
  fontMain: img("fnt_maintext.png"),
  fontComic: img("fnt_comicsans.png"),
  flag: [0, 1, 2, 3, 4, 5, 6].map((n) => img(`spr_iceflag_${n}.png`)),
  d: [0, 1, 2, 3].map((n) => img(`spr_maincharad_${n}.png`)),
  u: [0, 1, 2, 3].map((n) => img(`spr_maincharau_${n}.png`)),
  l: [0, 1].map((n) => img(`spr_maincharal_${n}.png`)),
  r: [0, 1].map((n) => img(`spr_maincharar_${n}.png`)),
};

// tile overlay baked once from TILES/TILES_F (tiles.js, dumped via UTMT).
// ground layer under objects, front layer (tree canopy, depth 999) over player.
// tile layers cover the full dumped extents, past the room bounds.
// TILE_OX/Y is the layer origin in world coords.
const TILE_OX = -40, TILE_OY = -60, TILE_W = 880, TILE_H = 660;
const TILEC = document.createElement("canvas");
TILEC.width = TILE_W; TILEC.height = TILE_H;
const TILEX = TILEC.getContext("2d");
TILEX.imageSmoothingEnabled = false;
const TILEFC = document.createElement("canvas");
TILEFC.width = TILE_W; TILEFC.height = TILE_H;
const TILEFX = TILEFC.getContext("2d");
TILEFX.imageSmoothingEnabled = false;
let tilesReady = false;
function bakeTiles() {
  if (tilesReady || !SPR.tileset.complete || !SPR.tileset.naturalWidth || !SPR.ruins.complete || !SPR.ruins.naturalWidth) return;
  for (const [x, y, sx, sy, w, h, b] of TILES) TILEX.drawImage(b ? SPR.ruins : SPR.tileset, sx, sy, w, h, x - TILE_OX, y - TILE_OY, w, h);
  for (const [x, y, sx, sy, w, h, b] of TILES_F) TILEFX.drawImage(b ? SPR.ruins : SPR.tileset, sx, sy, w, h, x - TILE_OX, y - TILE_OY, w, h);
  tilesReady = true;
}
// bitmap font pages, one tinted copy per text color (white glyphs on
// transparent, from fnt_maintext/fnt_comicsans via UTMT).
const FONTTINT = { main: null, comic: null };
function tintAtlas(atlas, color) {
  const c = document.createElement("canvas");
  c.width = atlas.naturalWidth; c.height = atlas.naturalHeight;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(atlas, 0, 0);
  return c;
}
function bakeFonts() {
  if (FONTTINT.main) return true;
  for (const a of [SPR.fontMain, SPR.fontComic]) {
    if (!a.complete || !a.naturalWidth) return false;
  }
  const colors = ["#fff", ...new Set(Object.values(TEXTCOLOR))];
  const pages = { main: SPR.fontMain, comic: SPR.fontComic };
  for (const k of ["main", "comic"]) {
    FONTTINT[k] = {};
    for (const col of colors) FONTTINT[k][col] = tintAtlas(pages[k], col);
  }
  return true;
}

let gold = +(localStorage.getItem("bg_gold") || 0);
let reds = +(localStorage.getItem("bg_reds") || 0);
let best = +(localStorage.getItem("bg_best") || 0);
let creamFlag = +(localStorage.getItem("bg_flag60") || 0);

const P = { x: PSTART.x, y: PSTART.y, face: 0, frame: 0, ftick: 0, moving: false, vx: 0, vy: 0, iceT: 0, sliding: false };
let px = P.x, py = P.y;
const B = { x: GEN.x, y: GEN.y, vx: 0, vy: 0, size: 2, live: false,
  t: 0, shrinko: 0, rolltime: 0, timeinc: 0, alarm: 0, falling: 0, specialy: 0, angle: 0 };
const FLAG = { on: false, idx: 0, y: 0 };
const CAM = { x: 0, y: 0 };
let respawnIn = 0;
let holeRead = 0;
let creamConv = 0, creamJ = 0;
let sansFace = 0;
// dialogue state. strings: array of raw textdata strings. halt: 0 typing, 1 wait, 2 end, 5 choice.
let DLG = null;
const keys = {};
// webaudio unlocks on first key. buffers decode once, then play on demand.
let AC = null; const SBUF = {}, SPLAY = {};
function bootAudio() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    for (const n of ["SND_TXT1", "snd_txtsans", "snd_squeak", "snd_dumbvictory"]) {
      if (SBUF[n] || !AC) continue;
      fetch("assets/" + n + ".wav").then((r) => r.arrayBuffer()).then((b) => AC.decodeAudioData(b)).then((d) => SBUF[n] = d).catch(() => {});
    }
  } catch {}
}
// snd_stop then snd_play: restart the same buffer, cut the old voice.
// 3ms fade on the cutoff so 30 restarts a second do not click.
function sfx(n) {
  if (!AC || !SBUF[n]) return;
  if (SPLAY[n]) {
    const o = SPLAY[n];
    try { o.g.gain.linearRampToValueAtTime(0, AC.currentTime + 0.003); o.v.stop(AC.currentTime + 0.01); } catch {}
  }
  const v = AC.createBufferSource();
  const g = AC.createGain();
  v.buffer = SBUF[n]; v.connect(g); g.connect(AC.destination); v.start();
  SPLAY[n] = { v, g };
}

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  bootAudio();
// gml keypress has no autorepeat. held keys poll from keys, not events.
  if (e.repeat) return;
  keys[k] = true;
  if (k === "r") { closeDialogue(); resetAttempt(); }
  if (k === "z" || k === "enter") pressConfirm();
  if (k === "x" || k === "shift") pressCancel();
  if (k === "arrowleft") moveChoice(-1);
  if (k === "arrowright") moveChoice(1);
});
addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

function resetAttempt() {
  P.x = PSTART.x; P.y = PSTART.y; P.face = 0; P.frame = 0; P.vx = P.vy = 0; P.sliding = false;
  if ((P.x % 3) === 2) P.x += 1;
  if ((P.x % 3) === 1) P.x -= 1;
  if ((P.y % 3) === 2) P.y += 1;
  if ((P.y % 3) === 1) P.y -= 1;
  px = P.x; py = P.y;
  B.size = 2; B.vx = B.vy = 0; B.t = 0; B.shrinko = 30;
  B.rolltime = 0; B.timeinc = 0; B.alarm = 0; B.falling = 0; B.angle = 0;
  B.live = true; B.x = GEN.x; B.y = GEN.y;
  FLAG.on = false; respawnIn = 0;
}

function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
// spr_mainchar* bbox is (0,19) to (19,29): 20x11 feet box.
function playerBox() { return { x: P.x, y: P.y + 19, w: 20, h: 11 }; }
// spr_rollsnow is 10x10, origin center, bbox (2,4) to (7,9), scaled by size.
function ballBox() { const s = B.size; return { x: B.x - 3 * s, y: B.y - s, w: 6 * s, h: 6 * s }; }
function boxGap(a, b) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}
// collision_point / collision_rectangle / collision_line vs solidparent set.
function pointSolid(x, y) {
  return SOLIDS.some((s) => x >= s.x && x <= s.x + s.w - 1 && y >= s.y && y <= s.y + s.h - 1);
}
function rectSolid(x1, y1, x2, y2) {
  const r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) + 1, h: Math.abs(y2 - y1) + 1 };
  return SOLIDS.some((s) => rectsHit(r, s));
}
function lineSolidH(x1, x2, y) {
  const a = Math.min(x1, x2), b = Math.max(x1, x2);
  return SOLIDS.some((s) => b >= s.x && a <= s.x + s.w - 1 && y >= s.y && y <= s.y + s.h - 1);
}

// prize only raises the flag. gold and flavor text come from reading
// the hole sign afterwards (obj_readable_room2 Alarm), like the original.
function prize(idx) {
  FLAG.on = true; FLAG.idx = idx; FLAG.y = HOLE.y + 10;
  holeRead = 0;
  B.falling = 5;
}

function spawnDrop() {
  B.x = GEN.x; B.y = CAM.y - 10; B.vx = 0; B.vy = 3;
  B.size = 2; B.falling = 1; B.specialy = GEN.y;
  B.t = 0; B.shrinko = 30; B.rolltime = 0; B.timeinc = 0; B.alarm = 0; B.angle = 0;
  B.live = true;
}

function holeCapture() {
  let idx = 0;
  if (B.rolltime > 180) idx = 1;
  if (B.rolltime > 240) idx = 2;
  if (B.rolltime > 330) idx = 3;
  if (B.rolltime > 450) idx = 4;
  if (B.rolltime > 600) idx = 5;
  if (B.size < 0.6) idx = 6;
  if (B.size > 0.3) B.size -= 0.1;
  sfx("snd_dumbvictory");
  prize(idx);
}

function addGold(g) {
  gold += g;
  localStorage.setItem("bg_gold", gold);
  if (!best || B.rolltime / 30 < best) {
    best = B.rolltime / 30;
    localStorage.setItem("bg_best", best);
  }
}

// sans shop chain, SCR_TEXT cases 235 to 239.
function sansStrings(msc, choice) {
  if (msc === 235) return ["s_815", "s_816", "s_817"];
  if (msc === 236) return choice === 0 ? ["s_823", "s_824"] : ["s_828", "s_829"];
  if (msc === 237) return choice === 0 ? ["s_836", "s_837"] : ["s_841", "s_842"];
  if (msc === 238) return choice === 0 ? ["s_849", "s_850"] : ["s_854"];
  if (msc === 239) {
    if (choice !== 0) return ["s_875"];
    return gold >= 50000 ? ["s_867", "s_868", "s_869", "s_870"] : ["s_861", "s_862", "s_863"];
  }
  return [];
}

// dialogue box engine. ported from obj_dialoguer + obj_base_writer.
// typer 5: Determination; typer 17: comic voice. face: sans portrait or null.
function openDialogue(strs, opts) {
  const side = P.y > CAM.y + 130 ? 0 : 1;
  // writer coords are view-locked (room point vx+16 lands 16px into the view).
  DLG = {
    strings: strs.map((k) => TEXT[k] || k), idx: 0, pos: 0, halt: 0, pause: 0,
    typer: opts.typer || 5, face: opts.face || null,
    side, wx: 30 + (opts.face ? 58 : 0), wy: side === 0 ? 15 : 170, xend: 290,
    choice: false, sel: 0, chooseTimer: 0, msc: opts.msc || 0,
    onClose: opts.onClose || null,
  };
}
function closeDialogue() {
  if (!DLG) return;
  const cb = DLG.onClose;
  DLG = null;
  if (cb) cb();
}
function pressConfirm() {
  if (!DLG) { tryInteract(); return; }
  if (DLG.choice) { confirmChoice(); return; }
  if (DLG.halt === 1) {
    DLG.idx++; DLG.pos = 0; DLG.halt = 0;
  } else if (DLG.halt === 2) {
    closeDialogue();
  }
}
function pressCancel() {
  if (!DLG || DLG.halt !== 0) return;
  DLG.pos = DLG.strings[DLG.idx].length;
}
function moveChoice(d) {
  if (!DLG || !DLG.choice || DLG.chooseTimer > 0) return;
  DLG.sel = d < 0 ? 0 : 1;
  sfx("snd_squeak");
}
function confirmChoice() {
  if (!DLG || !DLG.choice || DLG.chooseTimer > 0) return;
  const choice = DLG.sel;
  DLG.msc++;
  DLG.strings = sansStrings(DLG.msc, choice).map((k) => TEXT[k] || k);
  DLG.idx = 0; DLG.pos = 0; DLG.halt = 0; DLG.pause = 0;
  DLG.choice = false; DLG.sel = 0; DLG.chooseTimer = 0;
}
// one typewriter step. codes mirror the writer Alarm: ^N pauses N*10,
// backslash codes free except \z, visible chars cost one step.
function dlgStep() {
  if (!DLG) return;
  if (DLG.chooseTimer > 0) DLG.chooseTimer--;
  if (DLG.halt !== 0 || DLG.pause > 0) { if (DLG.pause > 0) DLG.pause--; return; }
  const s = DLG.strings[DLG.idx];
  let guard = 0;
  while (DLG.pos < s.length && guard++ < 32) {
    const p = DLG.pos + 1;
    const ch = s[p - 1];
    if (ch === "^") {
      const n = s[p];
      DLG.pos = p + 1;
      if (n === "0") continue;
      DLG.pause = (+n) * 10;
      return;
    } else if (ch === "\\") {
      if (s[p] === "C" && !DLG.choice) { DLG.choice = true; DLG.sel = 0; DLG.chooseTimer = 3; DLG.halt = 5; }
      DLG.pos = p + 1;
      if (s[p] === "z") return;
      continue;
    } else if (ch === "&") { DLG.pos = p; continue; }
    else if (ch === "%") { DLG.pos = p; continue; }
    else if (ch === "/") {
      DLG.pos = p;
      DLG.halt = (s[p] === "%") ? 2 : 1;
      continue;
    }
    DLG.pos = p;
// typer 5 beeps SND_TXT1, typer 17 beeps sans. spaces stay silent.
    if (ch !== " " && ch !== "　") sfx(DLG.typer === 17 ? "snd_txtsans" : "SND_TXT1");
    return;
  }
}
// interact trigger, from obj_mainchara Other_10: facing rectangles
// against obj_interactable boxes (readables + npc sprite boxes).
function interactTargets() {
  const t = [];
  t.push({ id: "sign", box: SIGNBOX });
  t.push({ id: "hole", box: HOLESIGNBOX });
  for (const n of NPCS) t.push({ id: n.id, box: n });
  return t;
}
function facingRect() {
  if (P.face === 1) return [{ x: P.x + 10, y: P.y + 19, w: 25, h: 11 }, { x: P.x + 10, y: P.y + 15, w: 25, h: 15 }];
  if (P.face === 3) return [{ x: P.x - 15, y: P.y + 19, w: 25, h: 11 }, { x: P.x - 15, y: P.y + 18, w: 25, h: 15 }];
  if (P.face === 0) return [{ x: P.x + 4, y: P.y + 20, w: 12, h: 25 }, { x: P.x + 4, y: P.y + 20, w: 12, h: 25 }];
  return [{ x: P.x + 4, y: P.y + 5, w: 12, h: 20 }, { x: P.x + 4, y: P.y + 8, w: 12, h: 17 }];
}
function tryInteract() {
  if (DLG || P.sliding || creamConv === 2) return;
  const [coarse, fine] = facingRect();
  for (const t of interactTargets()) {
    if (!rectsHit(coarse, t.box)) continue;
    if (!rectsHit(fine, t.box)) continue;
    startTalk(t.id);
    return;
  }
}
function startTalk(id) {
  if (id === "sans") sansFace = (P.face + 2) % 4;
  if (id === "sign") openDialogue(["room3_112"], { typer: 5 });
  else if (id === "hole") openHoleDialogue();
  else if (id === "sans") openDialogue(sansStrings(235), { typer: 17, face: true, msc: 235, onClose: () => { sansFace = 0; } });
  else if (id === "drake") openDialogue(["cd_82", "cd_83", "cd_84"], { typer: 5 });
  else if (id === "snow") openDialogue(["sn_102", "sn_103"], { typer: 5 });
  else if (id === "cream") talkCream();
}
function openHoleDialogue() {
  if (!FLAG.on) { openDialogue(["r2_245"], { typer: 5 }); return; }
  if (holeRead !== 0) { openDialogue(["r2_238"], { typer: 5 }); return; }
  const pages = {
    1: ["r2_194", "r2_195"], 2: ["r2_201", "r2_202"], 3: ["r2_208", "r2_209"],
    4: ["r2_215", "r2_216"], 5: ["r2_222", "r2_223"], 6: ["r2_229", "r2_230", "r2_231"],
  };
  if (FLAG.idx === 0) {
    if (reds === 0) {
      addGold(50); reds++; localStorage.setItem("bg_reds", reds);
      openDialogue(["r2_178", "r2_179", "r2_180"], { typer: 5 });
    } else {
      addGold(10);
      openDialogue(["r2_186", "r2_187"], { typer: 5 });
    }
  } else {
    addGold([0, 5, 3, 2, 1, 2, 4][FLAG.idx]);
    openDialogue(pages[FLAG.idx], { typer: 5 });
  }
  holeRead = 1;
}
// nicecream conversation machine (Alarm_0 + Step_1, tundra8 first talk).
function talkCream() {
  if (creamFlag !== 0) { openDialogue(["nc_135"], { typer: 5 }); return; }
  if (creamConv !== 0) return;
  creamConv = 1;
  openDialogue(["nc_122", "nc_123"], { typer: 5, onClose: () => {
    creamConv = 2; creamJ = 0;
  } });
}
function stepCream() {
  if (creamConv === 2 && !DLG) {
    if (++creamJ > 30) {
      creamConv = 3;
      openDialogue(["nc_288"], { typer: 5, onClose: () => {
        creamConv = 4; creamFlag = 1; localStorage.setItem("bg_flag60", 1);
        openDialogue(["nc_320"], { typer: 5 });
      } });
    }
  }
}
function creamSprite() {
  if (creamConv === 2) return SPR.creamAnim;
  if (creamConv >= 3 && DLG && DLG.halt === 0) return SPR.creamHappy[Math.floor(tick / 5) % 2];
  if (creamConv >= 3) return SPR.creamHappy[0];
  return SPR.cream;
}

// corner slide handlers, ported from Collision_10..13 (sdr, sdl, sur, sul).
// px/py are step-start (xprevious/yprevious); box is recomputed live.
function hitSdr() {
  const b = playerBox();
  const L = b.x, T = b.y, R = b.x + 19, Bt = b.y + 10;
  if (P.face === 1) {
    if (!pointSolid(R + 2, T - 2)) { P.x = px + 3; P.y = py - 3; }
    else P.x = px;
  }
  if (P.face === 0) {
    if (!pointSolid(L - 3, Bt + 3)) { P.x = px - 3; P.y = py + 3; }
    else P.y = py;
  }
  if (P.face === 2) { P.x = px; P.y = py - 3; }
  if (P.face === 3) { P.y = py; P.x = px - 3; }
  if ((keys["arrowdown"] || keys["s"]) && (keys["arrowright"] || keys["d"])) { P.x = px; P.y = py; }
  if ((P.x % 3) !== 0) P.x -= 1;
  if ((P.y % 3) !== 0) P.y -= 1;
  P.moving = false;
}
function hitSdl() {
  const b = playerBox();
  const L = b.x, T = b.y, R = b.x + 19, Bt = b.y + 10;
  if (P.face === 3) {
    if (!pointSolid(L - 2, T - 2)) { P.x = px - 3; P.y = py - 3; }
    else P.x = px;
  }
  if (P.face === 0) {
    if (!pointSolid(R + 3, Bt + 3)) { P.x = px + 3; P.y = py + 3; }
    else P.y = py;
  }
  if (P.face === 2) { P.x = px; P.y = py - 3; }
  if (P.face === 1) { P.y = py; P.x = px + 3; }
  if ((keys["arrowdown"] || keys["s"]) && (keys["arrowleft"] || keys["a"])) { P.x = px; P.y = py; }
  if ((P.x % 3) !== 0) P.x += 1;
  if ((P.y % 3) !== 0) P.y -= 1;
  P.moving = false;
}
function hitSur() {
  const b = playerBox();
  const L = b.x, T = b.y, R = b.x + 19, Bt = b.y + 10;
  if (P.face === 1) {
    if (!pointSolid(R + 3, Bt + 3)) { P.x = px + 3; P.y = py + 3; }
    else P.x = px;
  }
  if (P.face === 2) {
    if (!pointSolid(L - 3, T - 3)) { P.x = px - 3; P.y = py - 3; }
    else P.y = py;
  }
  if (P.face === 0) { P.x = px; P.y = py + 3; }
  if (P.face === 3) { P.y = py; P.x = px - 3; }
  if ((keys["arrowup"] || keys["w"]) && (keys["arrowright"] || keys["d"])) { P.x = px; P.y = py; }
  if ((P.x % 3) !== 0) P.x -= 1;
  if ((P.y % 3) !== 0) P.y += 1;
  P.moving = false;
}
function hitSul() {
  const b = playerBox();
  const L = b.x, T = b.y, R = b.x + 19, Bt = b.y + 10;
  if (P.face === 3) {
    if (!pointSolid(L - 3, Bt + 3)) { P.x = px - 3; P.y = py + 3; }
    else P.x = px;
  }
  if (P.face === 2) {
    if (!pointSolid(R + 3, T - 3)) { P.x = px + 3; P.y = py - 3; }
    else P.y = py;
  }
  if (P.face === 0) { P.x = px; P.y = py + 3; }
  if (P.face === 1) { P.y = py; P.x = px + 3; }
  if ((keys["arrowup"] || keys["w"]) && (keys["arrowleft"] || keys["a"])) { P.x = px; P.y = py; }
  if ((P.x % 3) !== 0) P.x += 1;
  if ((P.y % 3) !== 0) P.y += 1;
  P.moving = false;
}
// solidparent handler (Collision_822): revert, then slide along the wall.
function hitSolid() {
  P.x = px; P.y = py;
  const L = P.x, T = P.y + 19, R = P.x + 19, Bt = P.y + 29;
  if (keys["arrowup"] || keys["w"]) {
    if (rectSolid(P.x + 2, P.y + 15, P.x + 18, P.y + 19)) {
      if ((keys["arrowleft"] || keys["a"]) && !lineSolidH(L - 3, L, T)) { P.x -= 3; P.face = 3; }
      if ((keys["arrowright"] || keys["d"]) && !lineSolidH(R + 3, R, T)) { P.x += 3; P.face = 1; }
    } else { P.y -= 3; P.face = 2; }
  }
  if (keys["arrowdown"] || keys["s"]) {
    if (rectSolid(P.x + 2, P.y + 30, P.x + 18, P.y + 33)) {
      if ((keys["arrowleft"] || keys["a"]) && !lineSolidH(L - 3, L, Bt)) { P.x -= 3; P.face = 3; }
      if ((keys["arrowright"] || keys["d"]) && !lineSolidH(R + 3, R, Bt)) { P.x += 3; P.face = 1; }
    } else { P.y += 3; P.face = 0; }
  }
  P.moving = false;
}
// solidnpcparent handler (Collision_1367): hard revert.
function hitNpc() {
  P.x = px; P.y = py;
  P.moving = false;
}
function collidePlayer() {
  const b = playerBox();
  if (CORN.sdr.some((s) => rectsHit(b, s))) hitSdr();
  if (CORN.sdl.some((s) => rectsHit(playerBox(), s))) hitSdl();
  if (CORN.sur.some((s) => rectsHit(playerBox(), s))) hitSur();
  if (CORN.sul.some((s) => rectsHit(playerBox(), s))) hitSul();
  if (SOLIDS.some((s) => rectsHit(playerBox(), s))) hitSolid();
  if (NPCS.some((s) => rectsHit(playerBox(), s))) hitNpc();
}

// doorparent overlap uses the feet bbox, same as every other collision.
function iceOverlap() {
  return ICE.some(([ix, iy]) => rectsHit(playerBox(), { x: ix, y: iy, w: 40, h: 40 }));
}
// ice slide take, from obj_iceevent Other_19: four independent held-key ifs
// (up, down, right, left), so down overwrites up and left overwrites right.
function iceTake(L, R, U, D) {
  if (U) P.vy = -3;
  if (D) P.vy = 3;
  if (R) P.vx = 3;
  if (L) P.vx = -3;
}
// slide lock collapses every collision to a step-start revert.
// corner slides and wall sidesteps need interact==0, reverts do not.
function slideCollide() {
  const b = playerBox();
  const hit = CORN.sdr.some((s) => rectsHit(b, s)) ||
    CORN.sdl.some((s) => rectsHit(b, s)) ||
    CORN.sur.some((s) => rectsHit(b, s)) ||
    CORN.sul.some((s) => rectsHit(b, s)) ||
    SOLIDS.some((s) => rectsHit(b, s)) ||
    NPCS.some((s) => rectsHit(b, s));
  if (hit) { P.x = px; P.y = py; }
}
// one walked step. left wins over right, up wins over down.
function walkInput(L, R, U, D) {
  if (L) {
    if (!P.moving) P.frame = 1;
    P.moving = true;
    P.x -= 3;
    if (!(U && P.face === 2) && !(D && P.face === 0)) P.face = 3;
  }
  if (U) {
    if (!P.moving) P.frame = 1;
    P.moving = true;
    P.y -= 3;
    if (!(R && P.face === 1) && !(L && P.face === 3)) P.face = 2;
  }
  if (R && !L) {
    if (!P.moving) P.frame = 1;
    P.moving = true;
    P.x += 3;
    if (!(U && P.face === 2) && !(D && P.face === 0)) P.face = 1;
  }
  if (D && !U) {
    if (!P.moving) P.frame = 1;
    P.moving = true;
    P.y += 3;
    if (!(R && P.face === 1) && !(L && P.face === 3)) P.face = 0;
  }
}
function stepPlayer() {
  if (DLG || creamConv === 2) { P.moving = false; P.frame = 0; return; }
  px = P.x; py = P.y;
  const L = keys["arrowleft"] || keys["a"], R = keys["arrowright"] || keys["d"];
  const U = keys["arrowup"] || keys["w"], D = keys["arrowdown"] || keys["s"];
// other_19 reverts the walked step, then glides on slide velocity.
// alarm_0 zeroes out and the next input step runs the same frame.
  let held = L || R || U || D;
  if (P.sliding) {
    if (--P.iceT <= 0) {
      P.vx = P.vy = 0; P.sliding = false; P.frame = 0;
      walkInput(L, R, U, D);
      if (iceOverlap()) {
        P.x = px; P.y = py;
        P.sliding = true; P.iceT = 3;
        iceTake(L, R, U, D);
        P.x += P.vx; P.y += P.vy;
        slideCollide();
        P.moving = (P.x !== px || P.y !== py);
        if (!P.moving) P.frame = 0;
      } else {
        collidePlayer();
      }
    } else {
// locked glide, no input. overlap re-arms; stopped takes held keys.
      if (iceOverlap()) {
        P.iceT = 3;
        if (P.vx === 0 && P.vy === 0) iceTake(L, R, U, D);
      }
      P.x += P.vx; P.y += P.vy;
      slideCollide();
    }
// pinned glide steps reset the frozen frame.
    P.moving = (P.x !== px || P.y !== py);
    if (!P.moving) P.frame = 0;
  } else {
    walkInput(L, R, U, D);
    if (iceOverlap()) {
// entry reverts the walked step, then glides on the take.
// residual speed skips the take, unreachable in normal play.
      P.x = px; P.y = py;
      P.sliding = true; P.iceT = 3;
      if (P.vx === 0 && P.vy === 0) {
        iceTake(L, R, U, D);
      }
      P.x += P.vx; P.y += P.vy;
      slideCollide();
      P.moving = (P.x !== px || P.y !== py);
      if (!P.moving) P.frame = 0;
    } else {
      collidePlayer();
      P.moving = (P.x !== px || P.y !== py);
    }
  }
  if (!held && !P.sliding) P.moving = false;
  if (!P.sliding) {
    if (P.moving) {
      if (P.ftick++ % 5 === 0) {
        const n = P.face === 0 || P.face === 2 ? 4 : 2;
        P.frame = (P.frame + 1) % n;
      }
    } else P.frame = 0;
  }
  P.x = Math.max(0, Math.min(WORLD.w - 20, P.x));
  P.y = Math.max(0, Math.min(WORLD.h - 30, P.y));
}
function step() {
  stepPlayer();
  stepCream();
  dlgStep();

  if (!B.live) {
    if (respawnIn > 0 && --respawnIn === 0) spawnDrop();
    return;
  }
  if (B.alarm > 0) B.alarm--;

  if (B.falling === 1) {
    B.vy += 0.1; B.y += B.vy;
    B.angle += ((Math.abs(B.vx) + Math.abs(B.vy)) * 30) / (B.size * 10);
    if (B.y > B.specialy) { B.y = B.specialy; B.vy = 0; B.falling = 0; }
    return;
  }

  // golfhole magnet: edge gap under 8 pulls 0.2 along each axis.
  {
    const bb = ballBox();
    if (boxGap(bb, HOLEBOX) < 8) {
      if (bb.y + bb.h <= HOLEBOX.y) B.y += 0.2;
      if (bb.y >= HOLEBOX.y + HOLEBOX.h) B.y -= 0.2;
      if (B.x < HOLE.x + HOLE.w / 2) B.x += 0.2;
      if (B.x > HOLE.x + HOLE.w / 2) B.x -= 0.2;
    }
  }

  const sinking = B.falling === 5;
  const fr = sinking ? 1 : 0.1, sp0 = Math.hypot(B.vx, B.vy);
  if (sp0 > 0) {
    const ns = Math.max(0, sp0 - fr);
    B.vx *= ns / sp0; B.vy *= ns / sp0;
  }
  const ppx = B.x, ppy = B.y;
  B.x += B.vx; B.y += B.vy;
  B.angle += ((Math.abs(B.vx) + Math.abs(B.vy)) * 30) / (B.size * 10);

  if (B.t === 1 || B.t === 2) B.t = (B.vx === 0 && B.vy === 0) ? 1 : 2;
  if (B.t === 1) {
    if (B.shrinko > 0) B.shrinko--;
    else B.size -= 0.01;
  }
  if (B.timeinc === 1) B.rolltime++;
  if (sinking && B.size >= 0.2) B.size -= 0.05;

  if (B.size < 0.2) {
    B.live = false; B.falling = 0;
    respawnIn = 10; return;
  }

  if (!sinking) {
    for (const s of EDGES) {
      if (!rectsHit(ballBox(), s)) continue;
      B.x = ppx; B.y = ppy;
      let sp = Math.hypot(B.vx, B.vy);
      sp = sp <= 0.06 ? 0 : sp - 0.05;
      const bb = ballBox();
      if (s.x + s.w <= bb.x) { B.x += 2; B.vx = -B.vx; }
      if (s.x >= bb.x + bb.w) { B.x -= 2; B.vx = -B.vx; }
      if (s.y >= bb.y + bb.h) { B.y -= 2; B.vy = -B.vy; }
      if (s.y + s.h <= bb.y) { B.y += 2; B.vy = -B.vy; }
      const ns = Math.hypot(B.vx, B.vy) || 1;
      B.vx *= sp / ns; B.vy *= sp / ns;
      if (sp === 0) { B.vx = B.vy = 0; }
      break;
    }
    if (B.falling !== 5 && rectsHit(ballBox(), HOLEBOX)) holeCapture();
  }

  if (B.falling === 0 && B.alarm <= 0 && rectsHit(playerBox(), ballBox())) {
    const pcx = P.x + 9.5, pcy = P.y + 24;
    const ang = Math.atan2(pcy - B.y, pcx - B.x);
    const sp = 4 + 1 / B.size + 0.1;
    B.vx = -Math.cos(ang) * sp; B.vy = -Math.sin(ang) * sp;
    B.shrinko = 30; B.alarm = 15; B.t = 1;
    B.timeinc = 1;
  }
  if (FLAG.on && FLAG.y > HOLE.y - 29) FLAG.y -= 1;
}

function text(str, x, y, color = "#fff", size = 16, font) {
  ctx.font = `${size}px ${font || "DeterminationSans"}, monospace`;
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
// dialogue renderer. view coords in, canvas 2x out, like the writer Draw.
function dlgPen() {
  const d = DLG;
  let penX = d.wx, penY = d.wy, color = "#fff", ci = 0;
  const chars = [];
  const s = d.strings[d.idx];
  let n = 1;
  const emit = (ch, cx, cy, col) => chars.push({ ch, x: cx, y: cy, color: col });
  while (n <= d.pos) {
    let ch = s[n - 1];
    if (ch === "^" && s[n] !== "0") { n += 2; continue; }
    if (ch === "\\") {
      n++;
      const c = s[n - 1];
      if (c === "C") {
        if (!d.choice) { d.choice = true; d.sel = 0; d.chooseTimer = 3; d.halt = 5; }
      } else if (c === "E") { n++; }
      else if (TEXTCOLOR[c]) color = TEXTCOLOR[c];
      n++;
      continue;
    }
    if (ch === "&") { penX = d.wx; penY += 18; n++; continue; }
    if (ch === "/") { d.halt = 1; if (s[n] === "%") d.halt = 2; break; }
    if (ch === "%") break;
    if (penX > d.xend) { penX = d.wx; penY += 18; }
    emit(ch, penX, penY, color);
    penX += 8; n++; ci++;
  }
  return chars;
}
function drawDialogue() {
  const d = DLG;
  // box, from obj_dialoguer Draw_0. white shell, black inset. view locked.
  let wy0, wy1, by0, by1;
  if (d.side === 0) { wy0 = 5; wy1 = 80; by0 = 8; by1 = 77; }
  else { wy0 = 160; wy1 = 235; by0 = 163; by1 = 232; }
  ctx.fillStyle = "#fff";
  ctx.fillRect(2 * 16, 2 * wy0, 2 * (304 - 16), 2 * (wy1 - wy0));
  ctx.fillStyle = "#000";
  ctx.fillRect(2 * 19, 2 * by0, 2 * (301 - 19), 2 * (by1 - by0));
  if (d.face) ctx.drawImage(SPR.face, 2 * 33, 2 * (d.side === 0 ? 20 : 175), 80, 80);
// glyph cells blit from source font pages, scaled 2x, smoothing off.
// advance stays in fixed 8px slots per the spacing param.
  const glyphs = dlgPen();
  if (!bakeFonts()) return;
  const page = d.typer === 17 ? FONTGLYPH.comic : FONTGLYPH.main;
  const set = d.typer === 17 ? FONTTINT.comic : FONTTINT.main;
  for (const g of glyphs) {
    const m = page[g.ch.charCodeAt(0)];
    if (!m) continue;
    ctx.drawImage(set[g.color] || set["#fff"], m[0], m[1], m[2], m[3],
      Math.round(2 * g.x) + m[5] * 2, 2 * g.y, m[2] * 2, m[3] * 2);
  }
  if (d.choice) {
    let hy = 210;
    if (P.y > CAM.y + 130 || d.side === 0) hy -= 155;
    const hx = d.sel === 0 ? 89 : 185;
    ctx.drawImage(SPR.heart, 2 * hx, 2 * hy, 18, 18);
  }
}

function draw() {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
// engine clamps views into room bounds. small rooms would render
// negative offsets constantly without it.
  const camX = Math.max(0, Math.min(WORLD.w - 320, Math.round(P.x - 160 + 10)));
  const camY = Math.max(0, Math.min(WORLD.h - 240, Math.round(P.y - 120 + 10)));
  CAM.x = camX; CAM.y = camY;
  ctx.save(); ctx.scale(2, 2); ctx.translate(-camX, -camY);

  bakeTiles();
  if (tilesReady) ctx.drawImage(TILEC, TILE_OX, TILE_OY);
  else ctx.fillRect(camX, camY, 320, 240);
  ctx.drawImage(SPR.hole, HOLE.x, HOLE.y);

  // actors y-sorted like scr_depth: key = y*10 + h*10, ball uses h*4.
  const actors = [
    { k: 20 * 10 + 60 * 10, f: () => ctx.drawImage(creamSprite(), 60, 20) },
    { k: 20 * 10 + 42 * 10, f: () => ctx.drawImage(SPR.drake, 440, 20) },
    { k: 60 * 10 + 32 * 10, f: () => {
      const set = sansFace === 0 ? SPR.sans : sansFace === 2 ? SPR.sansU : sansFace === 3 ? SPR.sansL : SPR.sansR;
      ctx.drawImage(set, 600, 60);
    } },
    { k: 400 * 10 + 10 * 10, f: () => ctx.drawImage(SPR.snow, 600 - 5, 400 - 5) },
  ];
  // singletrees y-sort with actors (Other_4 Room Start runs scr_depth).
  for (const [x, y] of TREE) actors.push({ k: y * 10 + 60 * 10, f: () => ctx.drawImage(SPR.tree, x, y) });
  if (B.live) {
    actors.push({ k: B.y * 10 + 40, f: () => {
      ctx.save();
      ctx.translate(B.x, B.y);
      ctx.rotate(B.angle * Math.PI / 180);
      const d = 10 * B.size;
      ctx.drawImage(SPR.ball, -d / 2, -d / 2, d, d);
      ctx.restore();
    } });
  }
  {
    const set = P.face === 0 ? SPR.d : P.face === 2 ? SPR.u : P.face === 3 ? SPR.l : SPR.r;
    const py = P.y, fr = P.frame % set.length, fx = Math.round(P.x);
    actors.push({ k: py * 10 + 30 * 10, f: () => ctx.drawImage(set[fr], fx, Math.round(py)) });
  }
  if (FLAG.on) {
    const fy = FLAG.y;
    actors.push({ k: fy * 10 + 40 * 10, f: () => {
// draw_self_custom clips the pole below ystart+40 (hole line, y=450),
// so only rows fy..450 show while it rises.
      const visH = HOLE.y + 10 - fy + 1;
      if (visH <= 0) return;
      ctx.drawImage(SPR.flag[FLAG.idx], 0, 0, 21, visH, HOLE.x, fy, 21, visH);
    } });
  }
  actors.sort((a, b) => a.k - b.k).forEach((a) => a.f());
  if (tilesReady) ctx.drawImage(TILEFC, TILE_OX, TILE_OY);
  ctx.restore();

  if (DLG) drawDialogue();

  tick++;
  text(`${(B.rolltime / 30).toFixed(1)}s   ${gold}G`, 12, 24);
  if (best) text(`best ${best.toFixed(1)}s`, 12, 44, "#9fb0c3");
  else text(`size ${B.live ? (B.size <= 0.6 ? "tiny" : B.size < 1.4 ? "small" : "big") : "-"}`, 12, 44, "#9fb0c3");
}
let tick = 0;

let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= STEP) { step(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}
resetAttempt();
// touch only devices get the warning. touchscreen laptops pass through.
if (matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches) {
  document.getElementById("mobilewarn").hidden = false;
}
requestAnimationFrame(loop);
