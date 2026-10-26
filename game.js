// ball game. course and physics traced from data.win via UTMT.
// sprites ripped from the owned copy into assets/. fixed 30hz step.
"use strict";

const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;

const STEP = 1 / 30;
const WORLD = { w: 760, h: 580 };
const GEN = { x: 340, y: 120 };
const HOLE = { x: 440, y: 440, w: 20, h: 16 };
const PSTART = { x: 60, y: 100 };
const ICE = [[260, 380], [260, 420], [220, 380], [260, 340]];
const SIGN = { x: 440, y: 360 };

// player walks through ice walls: obj_golfedge is non-solid, no parent.
const SOLIDS = [];
for (const [x, y] of S20) SOLIDS.push({ x, y, w: 20, h: 20 });
for (const [x, y] of WIDE) SOLIDS.push({ x, y, w: 40, h: 20 });
for (const [x, y] of TREE) SOLIDS.push({ x, y, w: 60, h: 60 });
const EDGES = [];
for (const [x, y] of EDGE) EDGES.push({ x, y, w: 20, h: 20 });

function img(f) { const i = new Image(); i.src = "assets/" + f; return i; }
const SPR = {
  ball: img("spr_rollsnow_0.png"),
  hole: img("spr_hole2_0.png"),
  block: img("spr_event_0.png"),
  tree: img("spr_singletree_0.png"),
  sign: img("spr_interactable_0.png"),
  cream: img("spr_icecreamguy_sad_0.png"),
  drake: img("spr_chilldrakenpc_0.png"),
  flag: [0, 1, 2, 3, 4, 5, 6].map((n) => img(`spr_iceflag_${n}.png`)),
  d: [0, 1, 2, 3].map((n) => img(`spr_maincharad_${n}.png`)),
  u: [0, 1, 2, 3].map((n) => img(`spr_maincharau_${n}.png`)),
  l: [0, 1].map((n) => img(`spr_maincharal_${n}.png`)),
  r: [0, 1].map((n) => img(`spr_maincharar_${n}.png`)),
};

let gold = +(localStorage.getItem("bg_gold") || 0);
let reds = +(localStorage.getItem("bg_reds") || 0);
let best = +(localStorage.getItem("bg_best") || 0);

const P = { x: PSTART.x, y: PSTART.y, w: 20, h: 30, face: 0, frame: 0, ftick: 0, moving: false, vx: 0, vy: 0, iceT: 0 };
const B = { x: GEN.x, y: GEN.y, vx: 0, vy: 0, size: 2, live: false,
  t: 0, shrinko: 0, rolltime: 0, timeinc: 0, alarm: 0, falling: 0, specialy: 0, angle: 0 };
const FLAG = { on: false, idx: 0, y: 0 };
let respawnIn = 0, msgUntil = 0, msgDur = 4000, msgQueue = [], prizeLock = false;
const BOOT = "walk into the ball. arrows/WASD move, Z reads, R resets.";
const BOOT_SHORT = "walk into the ball.";
let message = BOOT;
const keys = {};

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === "r") resetAttempt();
  if (k === "z" || k === "enter") readSign();
});
addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

function resetAttempt() {
  P.x = PSTART.x; P.y = PSTART.y; P.face = 0; P.frame = 0;
  B.size = 2; B.vx = B.vy = 0; B.t = 0; B.shrinko = 0;
  B.rolltime = 0; B.timeinc = 0; B.alarm = 0; B.falling = 0; B.angle = 0;
  B.live = true; B.x = GEN.x; B.y = GEN.y;
  FLAG.on = false; respawnIn = 0; msgQueue = []; prizeLock = false;
  message = BOOT_SHORT;
}

function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function playerBox() { return { x: P.x, y: P.y + 19, w: 20, h: 11 }; }
function ballBox() { const h = Math.max(1.5, 2.5 * B.size); return { x: B.x - h, y: B.y - h, w: h * 2, h: h * 2 }; }

function prize(idx) {
  const T = [
    { f: "RED", g: reds === 0 ? 50 : 10, why: reds === 0
      ? "Bravery. Justice. Integrity. Kindness. Perseverance. Patience. You won at Ball Game."
      : "RED - Try as you might, you continue to be yourself." },
    { f: "ORANGE", g: 5, why: "ORANGE - You rush fists-first through all obstacles." },
    { f: "YELLOW", g: 3, why: "YELLOW - Sure-fire accuracy ended the mayhem of Ball." },
    { f: "BLUE", g: 2, why: "BLUE - Hopping and twirling, your style pulled you through." },
    { f: "GREEN", g: 1, why: "GREEN - Care for Ball led to a delicious victory." },
    { f: "PURPLE", g: 2, why: "PURPLE - Trapped, you took notes and finished Ball." },
    { f: "LIGHT BLUE", g: 4, why: "LIGHT BLUE - Ball is Small. You waited, then dethroned Ball." },
  ][idx];
  gold += T.g;
  if (idx === 0) reds++;
  if (!best || B.rolltime / 30 < best) best = B.rolltime / 30;
  localStorage.setItem("bg_gold", gold);
  localStorage.setItem("bg_reds", reds);
  localStorage.setItem("bg_best", best);
  FLAG.on = true; FLAG.idx = idx; FLAG.y = HOLE.y + 10;
  const award = `(You earned ${T.g}G.)`;
  const pages = (idx === 0 && T.g === 50)
    ? [[T.why, 4000], ["RED - Try as you might, you continue to be yourself.", 4000], [award, 3500]]
    : [[T.why, 4000], [award, 3500]];
  message = pages[0][0]; msgDur = pages[0][1];
  msgQueue = pages.slice(1); prizeLock = true;
  B.live = false;
  respawnIn = 45;
}

function holeCapture() {
  let idx = 0;
  if (B.rolltime > 180) idx = 1;
  if (B.rolltime > 240) idx = 2;
  if (B.rolltime > 330) idx = 3;
  if (B.rolltime > 450) idx = 4;
  if (B.rolltime > 600) idx = 5;
  if (B.size < 0.6) idx = 6;
  prize(idx);
}

function readSign() {
  if (prizeLock) return;
  if (P.vx || P.vy) return; // interact locked while sliding, like the original
  const nearSign = Math.hypot(P.x - SIGN.x, P.y - SIGN.y) < 50;
  const nearHole = Math.hypot(P.x - HOLE.x, P.y - HOLE.y) < 60;
  if (nearSign || nearHole) message = "ball game.";
}

function spawnDrop() {
  B.x = GEN.x; B.y = GEN.y - 60; B.vx = 0; B.vy = 3;
  B.size = 2; B.falling = 1; B.specialy = GEN.y;
  B.t = 0; B.shrinko = 0; B.rolltime = 0; B.timeinc = 0; B.alarm = 0;
  B.live = true;
}

function step() {
  // ice: doorparent overlap fires the slide (obj_iceevent User9). speed 0
  // takes the held direction, then the glide locks until 3 steps past the ice.
  const onIce = ICE.some(([ix, iy]) => rectsHit(playerBox(), { x: ix, y: iy, w: 40, h: 40 }));
  if (onIce) {
    P.iceT = 3;
    if (P.vx === 0 && P.vy === 0) {
      if (keys["arrowup"] || keys["w"]) P.vy = -3;
      if (keys["arrowdown"] || keys["s"]) P.vy = 3;
      if (keys["arrowleft"] || keys["a"]) P.vx = -3;
      if (keys["arrowright"] || keys["d"]) P.vx = 3;
    }
  } else if (P.iceT > 0 && --P.iceT === 0) { P.vx = P.vy = 0; }
  if (P.vx || P.vy) {
    P.moving = true;
    P.face = Math.abs(P.vy) >= Math.abs(P.vx) ? (P.vy < 0 ? 2 : 0) : (P.vx < 0 ? 3 : 1);
    const gx = { x: P.x + P.vx, y: P.y + 19, w: 20, h: 11 };
    if (!SOLIDS.some((s) => rectsHit(gx, s))) P.x += P.vx; else P.vx = 0;
    const gy = { x: P.x, y: P.y + 19 + P.vy, w: 20, h: 11 };
    if (!SOLIDS.some((s) => rectsHit(gy, s))) P.y += P.vy; else P.vy = 0;
  } else {
  let dx = 0, dy = 0;
  if (keys["arrowleft"] || keys["a"]) dx -= 3;
  if (keys["arrowright"] || keys["d"]) dx += 3;
  if (keys["arrowup"] || keys["w"]) dy -= 3;
  if (keys["arrowdown"] || keys["s"]) dy += 3;
  P.moving = !!(dx || dy);
  if (P.moving && (message === BOOT || message === BOOT_SHORT)) { message = ""; msgState.v = ""; msgN.v = 0; }
  if (P.moving) {
    P.face = dy < 0 ? 2 : dy > 0 ? 0 : dx < 0 ? 3 : 1;
    if (P.ftick++ % 5 === 0) {
      const n = P.face === 0 || P.face === 2 ? 4 : 2;
      P.frame = (P.frame + 1) % n;
    }
    const at = (ax, ay) => ({ x: P.x + ax, y: P.y + 19 + ay, w: 20, h: 11 });
    if (!SOLIDS.some((s) => rectsHit(at(dx, dy), s))) { P.x += dx; P.y += dy; }
    else if (!SOLIDS.some((s) => rectsHit(at(dx, 0), s))) P.x += dx;
    else if (!SOLIDS.some((s) => rectsHit(at(0, dy), s))) P.y += dy;
  } else { P.frame = 0; }
  }
  P.x = Math.max(0, Math.min(WORLD.w - P.w, P.x));
  P.y = Math.max(0, Math.min(WORLD.h - P.h, P.y));

  if (!B.live) {
    if (respawnIn > 0 && --respawnIn === 0) spawnDrop();
    return;
  }
  if (B.alarm > 0) B.alarm--;

  if (B.falling === 1) {
    B.vy += 0.1; B.y += B.vy;
    if (B.y >= B.specialy) { B.y = B.specialy; B.vy = 0; B.falling = 0; }
    return;
  }

  if (rectsHit(playerBox(), ballBox()) && B.alarm <= 0) {
    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    const ang = Math.atan2(pcy - B.y, pcx - B.x);
    const sp = 4 + 1 / B.size + 0.1;
    B.vx = -Math.cos(ang) * sp; B.vy = -Math.sin(ang) * sp;
    B.shrinko = 30; B.alarm = 15; B.t = 1;
    B.timeinc = 1;
    if (B.rolltime === 0) message = "my balls shrink if they stay too still.";
  }

  const fr = 0.1, sp0 = Math.hypot(B.vx, B.vy);
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

  if (B.size < 0.2) {
    B.live = false; message = "ball shrunk into a subatomic particle... new ball dropping.";
    respawnIn = 10; return;
  }

  for (const s of EDGES) {
    if (!rectsHit(ballBox(), s)) continue;
    B.x = ppx; B.y = ppy;
    let sp = Math.hypot(B.vx, B.vy);
    sp = sp <= 0.06 ? 0 : sp - 0.05;
    const bb = ballBox();
    const ox = Math.min(bb.x + bb.w - s.x, s.x + s.w - bb.x);
    const oy = Math.min(bb.y + bb.h - s.y, s.y + s.h - bb.y);
    if (ox < oy) B.vx = -B.vx; else B.vy = -B.vy;
    const ns = Math.hypot(B.vx, B.vy) || 1;
    B.vx *= sp / ns; B.vy *= sp / ns;
    if (sp === 0) { B.vx = B.vy = 0; }
    B.x += B.vx; B.y += B.vy;
    break;
  }

  const hx = HOLE.x + HOLE.w / 2, hy = HOLE.y + HOLE.h / 2;
  const hd = Math.hypot(B.x - hx, B.y - hy);
  if (hd - 5 < 8 && B.t !== 0 && hd > 0.01) { B.x += (hx - B.x) / hd * 0.2; B.y += (hy - B.y) / hd * 0.2; }
  if (rectsHit(ballBox(), HOLE) && B.t !== 0) holeCapture();
  if (FLAG.on && FLAG.y > HOLE.y - 30) FLAG.y -= 1;
}

function text(str, x, y, color = "#fff", size = 16) {
  ctx.font = `${size}px DeterminationSans, monospace`;
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function wrap(s, n) {
  const words = s.split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) { lines.push(cur.trim()); cur = w; }
    else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
function box(x, y, w, h) {
  ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
let tick = 0;
function typed(full, last, n) {
  if (full !== last.v) { last.v = full; n.v = 0; }
  if (n.v < full.length && tick % 2 === 0) n.v++;
  return full.slice(0, n.v);
}
const msgState = { v: "" }, msgN = { v: 0 };

function draw() {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
  const camX = Math.max(0, Math.min(WORLD.w - 320, Math.round(P.x + 10 - 160)));
  const camY = Math.max(0, Math.min(WORLD.h - 240, Math.round(P.y + 15 - 120)));
  ctx.save(); ctx.scale(2, 2); ctx.translate(-camX, -camY);

  ctx.fillStyle = "#dce8f5"; ctx.fillRect(camX, camY, 320, 240);
  for (const [x, y] of ICE) { ctx.drawImage(SPR.block, x, y, 40, 40); }
  for (const s of EDGES) ctx.drawImage(SPR.block, s.x, s.y);
  for (const t of (() => { const a = []; for (const [x, y] of TREE) a.push({ x, y }); return a; })()) ctx.drawImage(SPR.tree, t.x, t.y - 10);
  ctx.drawImage(SPR.sign, SIGN.x - 10, SIGN.y - 10);
  ctx.drawImage(SPR.sign, HOLE.x - 10, HOLE.y - 10);
  ctx.drawImage(SPR.cream, 60, 20);
  ctx.drawImage(SPR.drake, 440, 20);
  ctx.drawImage(SPR.hole, HOLE.x, HOLE.y);

  if (FLAG.on) ctx.drawImage(SPR.flag[FLAG.idx], HOLE.x, FLAG.y);

  if (B.live) {
    if (B.falling === 1) {
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath(); ctx.ellipse(GEN.x, GEN.y, 8, 4, 0, 0, 7); ctx.fill();
    }
    ctx.save();
    ctx.translate(B.x, B.y);
    ctx.rotate(B.angle * Math.PI / 180);
    const d = 10 * B.size;
    ctx.drawImage(SPR.ball, -d / 2, -d / 2, d, d);
    ctx.restore();
  }
  const set = P.face === 0 ? SPR.d : P.face === 2 ? SPR.u : P.face === 3 ? SPR.l : SPR.r;
  ctx.drawImage(set[P.frame % set.length], Math.round(P.x), Math.round(P.y));
  ctx.restore();

  tick++;
  text(`${(B.rolltime / 30).toFixed(1)}s   ${gold}G`, 12, 24);
  if (best) text(`best ${best.toFixed(1)}s`, 12, 44, "#9fb0c3");
  else text(`size ${B.live ? (B.size <= 0.6 ? "tiny" : B.size < 1.4 ? "small" : "big") : "-"}`, 12, 44, "#9fb0c3");
  if (message && message !== msgState.v) { msgUntil = performance.now() + msgDur; msgDur = 4000; }
  if (message && performance.now() > msgUntil) {
    if (msgQueue.length) { const [t, d] = msgQueue.shift(); msgDur = d; message = t; msgUntil = performance.now() + d; }
    else { message = ""; msgState.v = ""; msgN.v = 0; prizeLock = false; }
  }
  if (message) {
    box(8, 398, 624, 74);
    const m = typed(message, msgState, msgN);
    wrap("* " + m, 58).slice(0, 2).forEach((ln, i) => text(ln, 24, 428 + i * 20, "#fff", 16));
  }
}

let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= STEP) { step(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}
resetAttempt();
message = "walk into the ball. arrows/WASD move, Z reads, R resets.";
requestAnimationFrame(loop);
