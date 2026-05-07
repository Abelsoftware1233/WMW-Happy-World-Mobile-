/* ═══════════════════════════════════════════════════════
   GAME.JS – Mario Game Engine
   Vereist: script.js (LEVELS array), index.html, style.css
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Tile constanten (moeten overeenkomen met script.js) ───
  const T = {
    EMPTY:     0,
    GROUND:    1,
    QUESTION:  2,
    BRICK:     3,
    PIPE_TL:   4,
    PIPE_TR:   5,
    PIPE_BL:   6,
    PIPE_BR:   7,
    COIN:      8,
    STAR:      9,
    FLAG:      10,
  };

  const TILE_SIZE = 40;

  // ─── Kleuren ───
  const COL = {
    sky:        '#5c94fc',
    ground:     '#c84b0c',
    groundDark: '#8b3500',
    brick:      '#b45700',
    brickDark:  '#7a3900',
    question:   '#fbd000',
    questionDk: '#c89000',
    pipeGreen:  '#43b047',
    pipeDark:   '#2d7030',
    coin:       '#ffd700',
    coinShine:  '#fff8a0',
    star:       '#ffffff',
    starGlow:   '#ffffa0',
    flag:       '#ffffff',
    flagPole:   '#888888',
    mario:      '#e52521',
    marioHat:   '#e52521',
    marioPants: '#049cd8',
    marioBrown: '#c87000',
    goomba:     '#8b6914',
    goombaFace: '#c87000',
    koopa:      '#2d8a2d',
    koopaDark:  '#1a5c1a',
    outline:    '#000000',
    hudBg:      'rgba(0,0,0,0.85)',
  };

  // ─── Game state ───
  const state = {
    currentLevel: 0,
    lives:        3,
    totalScore:   0,
    totalCoins:   0,
    completed:    [],        // voltooide level indices
    score:        0,
    coins:        0,
    timeLeft:     400,
    timerInterval: null,
    running:      false,
    paused:       false,
  };

  // ─── Player ───
  const player = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    onGround: false,
    width: TILE_SIZE * 0.8,
    height: TILE_SIZE * 0.9,
    speed: 4,
    jumpPower: -13,
    alive: true,
    frame: 0,
    frameTimer: 0,
  };

  // ─── Enemies ───
  let enemies = [];

  // ─── Coins / pickups in level ───
  let pickups = [];

  // ─── Map data ───
  let mapData = [];
  let mapWidth = 0;
  let mapHeight = 0;

  // ─── Canvas ───
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  // ─── Camera ───
  let cameraX = 0;

  // ─── Input ───
  const keys = { left: false, right: false, jump: false };

  // ─── DOM referenties ───
  const screens = {
    start:    document.getElementById('screen-start'),
    select:   document.getElementById('screen-select'),
    game:     document.getElementById('screen-game'),
    win:      document.getElementById('screen-win'),
    gameover: document.getElementById('screen-gameover'),
    complete: document.getElementById('screen-complete'),
  };

  // ══════════════════════════════════════════
  // SCHERM BEHEER
  // ══════════════════════════════════════════

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ══════════════════════════════════════════
  // LEVEL SELECTIE OPBOUWEN
  // ══════════════════════════════════════════

  function buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const card = document.createElement('div');
      card.className = 'level-card';
      if (state.completed.includes(i)) card.classList.add('completed');

      card.innerHTML = `
        <div class="level-num">LEVEL ${i + 1}</div>
        <div class="level-name">${lvl.name}</div>
        <div class="level-time">⏱ ${lvl.timeLimit}s</div>
      `;
      card.addEventListener('click', () => startLevel(i));
      grid.appendChild(card);
    });
  }

  // ══════════════════════════════════════════
  // LEVEL STARTEN
  // ══════════════════════════════════════════

  function startLevel(index) {
    state.currentLevel = index;
    state.score  = 0;
    state.coins  = 0;
    state.running = true;
    state.paused  = false;

    const lvl = LEVELS[index];
    state.timeLeft = lvl.timeLimit;

    // Map parseren
    mapData   = lvl.map;
    mapHeight = mapData.length;
    mapWidth  = mapData[0].length;

    // Speler, vijanden en pickups initialiseren
    enemies = [];
    pickups = [];
    cameraX = 0;

    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        const cell = mapData[row][col];
        if (cell === 'M') {
          player.x = col * TILE_SIZE;
          player.y = row * TILE_SIZE;
          player.vx = 0; player.vy = 0;
          player.onGround = false;
          player.alive = true;
          player.frame = 0;
          mapData[row][col] = T.EMPTY;
        } else if (cell === 'G') {
          enemies.push({ type: 'goomba', x: col * TILE_SIZE, y: row * TILE_SIZE, vx: -2, vy: 0, alive: true, width: TILE_SIZE * 0.9, height: TILE_SIZE * 0.85 });
          mapData[row][col] = T.EMPTY;
        } else if (cell === 'K') {
          enemies.push({ type: 'koopa', x: col * TILE_SIZE, y: row * TILE_SIZE, vx: -1.5, vy: 0, alive: true, width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.95 });
          mapData[row][col] = T.EMPTY;
        } else if (cell === T.COIN || cell === T.STAR) {
          pickups.push({ type: cell === T.COIN ? 'coin' : 'star', x: col * TILE_SIZE, y: row * TILE_SIZE, collected: false });
          mapData[row][col] = T.EMPTY;
        }
      }
    }

    updateHUD();
    resizeCanvas();
    showScreen('game');
    startTimer();
    requestAnimationFrame(gameLoop);
  }

  // ══════════════════════════════════════════
  // TIMER
  // ══════════════════════════════════════════

  function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      if (!state.running || state.paused) return;
      state.timeLeft--;
      document.getElementById('hud-time').textContent = state.timeLeft;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        killPlayer();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
  }

  // ══════════════════════════════════════════
  // CANVAS RESIZE
  // ══════════════════════════════════════════

  function resizeCanvas() {
    const hud = document.getElementById('hud');
    const touch = document.getElementById('touch-controls');
    const hudH   = hud.offsetHeight   || 48;
    const touchH = touch.offsetHeight || 0;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - hudH - touchH;
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // ══════════════════════════════════════════
  // INPUT
  // ══════════════════════════════════════════

  document.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') keys.left  = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = true;
    e.preventDefault();
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') keys.left  = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = false;
  });

  // Touch buttons
  function addTouch(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', e => { keys[key] = true;  e.preventDefault(); }, { passive: false });
    btn.addEventListener('touchend',   e => { keys[key] = false; e.preventDefault(); }, { passive: false });
    btn.addEventListener('mousedown',  () => keys[key] = true);
    btn.addEventListener('mouseup',    () => keys[key] = false);
  }
  addTouch('tc-left',  'left');
  addTouch('tc-right', 'right');
  addTouch('tc-jump',  'jump');

  // ══════════════════════════════════════════
  // PHYSICS HELPERS
  // ══════════════════════════════════════════

  const GRAVITY = 0.6;
  const TERM_VEL = 16;

  function tileAt(col, row) {
    if (row < 0 || row >= mapHeight) return T.GROUND;
    if (col < 0 || col >= mapWidth)  return T.EMPTY;
    const c = mapData[row][col];
    return (typeof c === 'number') ? c : T.EMPTY;
  }

  function isSolid(t) {
    return t === T.GROUND || t === T.BRICK || t === T.QUESTION ||
           t === T.PIPE_TL || t === T.PIPE_TR || t === T.PIPE_BL || t === T.PIPE_BR;
  }

  function resolveEntity(ent) {
    // Horizontaal
    ent.x += ent.vx;
    const left  = Math.floor(ent.x / TILE_SIZE);
    const right = Math.floor((ent.x + ent.width - 1) / TILE_SIZE);
    const top   = Math.floor(ent.y / TILE_SIZE);
    const bot   = Math.floor((ent.y + ent.height - 1) / TILE_SIZE);

    for (let r = top; r <= bot; r++) {
      if (ent.vx > 0 && isSolid(tileAt(right, r))) {
        ent.x = right * TILE_SIZE - ent.width;
        ent.vx = -Math.abs(ent.vx); // vijand keert om
      }
      if (ent.vx < 0 && isSolid(tileAt(left, r))) {
        ent.x = (left + 1) * TILE_SIZE;
        ent.vx = Math.abs(ent.vx);
      }
    }

    // Verticaal
    ent.vy = Math.min(ent.vy + GRAVITY, TERM_VEL);
    ent.y += ent.vy;
    const l2 = Math.floor(ent.x / TILE_SIZE);
    const r2 = Math.floor((ent.x + ent.width - 1) / TILE_SIZE);
    const t2 = Math.floor(ent.y / TILE_SIZE);
    const b2 = Math.floor((ent.y + ent.height - 1) / TILE_SIZE);

    ent.onGround = false;
    for (let c = l2; c <= r2; c++) {
      if (ent.vy > 0 && isSolid(tileAt(c, b2))) {
        ent.y = b2 * TILE_SIZE - ent.height;
        ent.vy = 0;
        ent.onGround = true;
      }
      if (ent.vy < 0 && isSolid(tileAt(c, t2))) {
        ent.y = (t2 + 1) * TILE_SIZE;
        ent.vy = 0;
      }
    }

    // Vallende vijand van scherm -> verwijderen
    if (ent.y > mapHeight * TILE_SIZE + 200) ent.alive = false;
  }

  // ══════════════════════════════════════════
  // PLAYER UPDATE
  // ══════════════════════════════════════════

  let jumpHeld = false;

  function updatePlayer() {
    if (!player.alive) return;

    // Bewegen
    if (keys.left)  { player.vx = Math.max(player.vx - 1.2, -player.speed); }
    else if (keys.right) { player.vx = Math.min(player.vx + 1.2, player.speed); }
    else {
      // Remmen
      player.vx *= 0.78;
      if (Math.abs(player.vx) < 0.2) player.vx = 0;
    }

    // Springen
    if (keys.jump && !jumpHeld && player.onGround) {
      player.vy = player.jumpPower;
      jumpHeld = true;
    }
    if (!keys.jump) jumpHeld = false;

    resolveEntity(player);

    // Linker grens
    if (player.x < 0) { player.x = 0; player.vx = 0; }

    // Valletje dood
    if (player.y > mapHeight * TILE_SIZE + 100) killPlayer();

    // Animatieframe
    player.frameTimer++;
    if (player.frameTimer > 8) { player.frame = (player.frame + 1) % 3; player.frameTimer = 0; }
  }

  // ══════════════════════════════════════════
  // PICKUP COLLECTIE
  // ══════════════════════════════════════════

  function checkPickups() {
    pickups.forEach(p => {
      if (p.collected) return;
      if (
        player.x < p.x + TILE_SIZE &&
        player.x + player.width > p.x &&
        player.y < p.y + TILE_SIZE &&
        player.y + player.height > p.y
      ) {
        p.collected = true;
        if (p.type === 'coin') {
          state.coins++;
          state.score += 200;
        } else if (p.type === 'star') {
          state.score += 1000;
        }
        updateHUD();
      }
    });
  }

  // ══════════════════════════════════════════
  // VIJAND UPDATE + BOTSING
  // ══════════════════════════════════════════

  function updateEnemies() {
    enemies.forEach(e => {
      if (!e.alive) return;
      resolveEntity(e);

      // Botsing met speler
      if (
        player.alive &&
        player.x < e.x + e.width - 4 &&
        player.x + player.width > e.x + 4 &&
        player.y < e.y + e.height - 4 &&
        player.y + player.height > e.y + 4
      ) {
        // Speler springt op vijand?
        if (player.vy > 0 && player.y + player.height < e.y + e.height * 0.5 + 10) {
          e.alive = false;
          player.vy = -8;
          state.score += 100;
          updateHUD();
        } else {
          killPlayer();
        }
      }
    });
  }

  // ══════════════════════════════════════════
  // VLAG CHECK
  // ══════════════════════════════════════════

  function checkFlag() {
    if (!player.alive) return;
    const col = Math.floor((player.x + player.width / 2) / TILE_SIZE);
    const row = Math.floor((player.y + player.height / 2) / TILE_SIZE);
    if (tileAt(col, row) === T.FLAG) {
      winLevel();
    }
    // Einde van map bereikt
    if (player.x + player.width >= mapWidth * TILE_SIZE - TILE_SIZE) {
      winLevel();
    }
  }

  // ══════════════════════════════════════════
  // WIN / VERLIES
  // ══════════════════════════════════════════

  function winLevel() {
    if (!state.running) return;
    state.running = false;
    stopTimer();

    const timeBonus = state.timeLeft * 50;
    state.score += timeBonus;
    state.totalScore += state.score;
    state.totalCoins += state.coins;

    if (!state.completed.includes(state.currentLevel)) {
      state.completed.push(state.currentLevel);
    }

    document.getElementById('win-score').textContent = state.score;
    document.getElementById('win-coins').textContent = state.coins;
    document.getElementById('win-time').textContent  = state.timeLeft;
    document.getElementById('win-bonus').textContent = timeBonus;

    setTimeout(() => {
      if (state.currentLevel >= LEVELS.length - 1) {
        showCompleteScreen();
      } else {
        showScreen('win');
      }
    }, 600);
  }

  function killPlayer() {
    if (!player.alive) return;
    player.alive = false;
    player.vy = -10;
    state.running = false;
    stopTimer();

    setTimeout(() => {
      state.lives--;
      if (state.lives <= 0) {
        showScreen('gameover');
      } else {
        // Herstart level
        startLevel(state.currentLevel);
      }
    }, 1200);
  }

  function showCompleteScreen() {
    document.getElementById('total-score').textContent = state.totalScore;
    document.getElementById('total-coins').textContent = state.totalCoins;
    showScreen('complete');
  }

  // ══════════════════════════════════════════
  // CAMERA
  // ══════════════════════════════════════════

  function updateCamera() {
    const targetX = player.x - canvas.width / 3;
    cameraX += (targetX - cameraX) * 0.15;
    cameraX = Math.max(0, Math.min(cameraX, mapWidth * TILE_SIZE - canvas.width));
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Achtergrond
    ctx.fillStyle = COL.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wolken (decoratief)
    drawClouds();

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Tiles
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 1);
    const endCol   = Math.min(mapWidth, startCol + Math.ceil(canvas.width / TILE_SIZE) + 2);

    for (let row = 0; row < mapHeight; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = mapData[row][col];
        if (typeof tile !== 'number' || tile === T.EMPTY) continue;
        drawTile(tile, col * TILE_SIZE, row * TILE_SIZE);
      }
    }

    // Pickups
    pickups.forEach(p => {
      if (p.collected) return;
      if (p.type === 'coin') drawCoin(p.x, p.y);
      else drawStar(p.x, p.y);
    });

    // Vijanden
    enemies.forEach(e => {
      if (!e.alive) return;
      if (e.type === 'goomba') drawGoomba(e.x, e.y);
      else drawKoopa(e.x, e.y);
    });

    // Speler
    drawPlayer();

    ctx.restore();
  }

  // ─── Wolken ───
  let cloudPositions = null;
  function drawClouds() {
    if (!cloudPositions) {
      cloudPositions = [];
      for (let i = 0; i < 8; i++) {
        cloudPositions.push({
          x: i * 480 + Math.random() * 200,
          y: 30 + Math.random() * 80,
          w: 80 + Math.random() * 60,
        });
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    cloudPositions.forEach(c => {
      const cx = (c.x - cameraX * 0.4) % (mapWidth * TILE_SIZE + 200);
      drawCloud(cx, c.y, c.w);
    });
  }
  function drawCloud(x, y, w) {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + 16, w * 0.5, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.3, y + 20, w * 0.28, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.7, y + 20, w * 0.26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Tile renderer ───
  function drawTile(t, x, y) {
    const s = TILE_SIZE;
    ctx.lineWidth = 2;

    if (t === T.GROUND) {
      ctx.fillStyle = COL.ground;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.groundDark;
      ctx.fillRect(x, y, s, 4);
      ctx.fillRect(x, y, 4, s);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    } else if (t === T.BRICK) {
      ctx.fillStyle = COL.brick;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.brickDark;
      ctx.fillRect(x, y, s, 3);
      ctx.fillRect(x, y + s / 2 - 1, s, 3);
      ctx.fillRect(x, y, 3, s / 2);
      ctx.fillRect(x + s / 2, y + s / 2, 3, s / 2);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    } else if (t === T.QUESTION) {
      const pulse = Math.sin(Date.now() / 300) * 0.1 + 0.9;
      ctx.fillStyle = COL.question;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.questionDk;
      ctx.fillRect(x, y, s, 4);
      ctx.fillRect(x, y, 4, s);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(s * 0.55 * pulse)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + s / 2, y + s / 2 + 1);
    } else if (t === T.PIPE_TL) {
      ctx.fillStyle = COL.pipeGreen;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.pipeDark;
      ctx.fillRect(x + s - 6, y, 6, s);
      ctx.fillRect(x, y + s - 6, s, 6);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      // Cap
      ctx.fillStyle = COL.pipeGreen;
      ctx.fillRect(x - 4, y, s + 8, 10);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x - 4, y, s + 8, 10);
    } else if (t === T.PIPE_TR) {
      ctx.fillStyle = COL.pipeGreen;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.pipeDark;
      ctx.fillRect(x, y, 6, s);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    } else if (t === T.PIPE_BL || t === T.PIPE_BR) {
      ctx.fillStyle = COL.pipeGreen;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = COL.pipeDark;
      const side = t === T.PIPE_BL ? s - 6 : 0;
      ctx.fillRect(x + side, y, 6, s);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    } else if (t === T.FLAG) {
      // Vlagpaal
      ctx.fillStyle = COL.flagPole;
      ctx.fillRect(x + s / 2 - 3, y, 6, s);
      // Vlag
      ctx.fillStyle = '#e52521';
      ctx.fillRect(x + s / 2 + 3, y + 4, 20, 14);
      ctx.strokeStyle = COL.outline;
      ctx.strokeRect(x + s / 2 + 3, y + 4, 20, 14);
    }
  }

  // ─── Munt ───
  function drawCoin(x, y) {
    const t = Date.now() / 600;
    const s = TILE_SIZE;
    const cx = x + s / 2;
    const cy = y + s / 2;
    const r  = s * 0.28;
    const scaleX = Math.abs(Math.cos(t));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = COL.coin;
    ctx.fill();
    ctx.strokeStyle = COL.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // ─── Ster ───
  function drawStar(x, y) {
    const t = Date.now() / 400;
    const s = TILE_SIZE;
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t);
    ctx.fillStyle = COL.starGlow;
    drawStarShape(ctx, 0, 0, s * 0.32, s * 0.15, 5);
    ctx.fillStyle = COL.star;
    drawStarShape(ctx, 0, 0, s * 0.25, s * 0.11, 5);
    ctx.restore();
  }
  function drawStarShape(ctx, cx, cy, r1, r2, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? r1 : r2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ─── Speler (Mario) ───
  function drawPlayer() {
    if (!player.alive && player.y > mapHeight * TILE_SIZE + 50) return;
    const s  = TILE_SIZE;
    const px = player.x;
    const py = player.y;
    const facing = player.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Lichaam
    ctx.fillStyle = COL.mario;
    ctx.fillRect(-14, -18, 28, 20);

    // Hoed
    ctx.fillStyle = COL.marioHat;
    ctx.fillRect(-10, -28, 24, 10);
    ctx.fillRect(-6, -32, 20, 6);

    // Gezicht (vel)
    ctx.fillStyle = '#f9c498';
    ctx.fillRect(-10, -18, 16, 12);

    // Oog
    ctx.fillStyle = '#000';
    ctx.fillRect(0, -16, 4, 4);

    // Snor
    ctx.fillStyle = '#8b3500';
    ctx.fillRect(-10, -10, 20, 3);

    // Broek
    ctx.fillStyle = COL.marioPants;
    ctx.fillRect(-14, 2, 28, 14);

    // Schoenen (bruin)
    ctx.fillStyle = COL.marioBrown;
    ctx.fillRect(-16, 14, 14, 6);
    ctx.fillRect(4, 14, 14, 6);

    ctx.restore();
  }

  // ─── Goomba ───
  function drawGoomba(x, y) {
    const s  = TILE_SIZE;
    const cx = x + s / 2;
    const cy = y + s * 0.85;
    ctx.fillStyle = COL.goomba;
    // Lichaam
    ctx.beginPath();
    ctx.ellipse(cx, cy - 12, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.outline; ctx.lineWidth = 2; ctx.stroke();
    // Voeten
    ctx.fillStyle = '#5a3800';
    ctx.fillRect(cx - 18, cy - 4, 14, 8);
    ctx.fillRect(cx + 4,  cy - 4, 14, 8);
    // Ogen
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 12, cy - 20, 8, 7);
    ctx.fillRect(cx + 4,  cy - 20, 8, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 10, cy - 19, 5, 5);
    ctx.fillRect(cx + 5,  cy - 19, 5, 5);
    // Wenkbrauwen (boos)
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 13, cy - 24, 9, 3);
    ctx.fillRect(cx + 4,  cy - 24, 9, 3);
  }

  // ─── Koopa ───
  function drawKoopa(x, y) {
    const s  = TILE_SIZE;
    const cx = x + s / 2;
    const cy = y + s * 0.9;
    // Schild
    ctx.fillStyle = COL.koopa;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 14, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.outline; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COL.koopaDark;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 14, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hoofd
    ctx.fillStyle = '#f9c498';
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy - 30, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COL.outline; ctx.stroke();
    // Oog
    ctx.fillStyle = '#000';
    ctx.fillRect(cx + 12, cy - 34, 4, 4);
    // Voeten
    ctx.fillStyle = '#f9c498';
    ctx.fillRect(cx - 18, cy - 6, 12, 8);
    ctx.fillRect(cx + 6,  cy - 6, 12, 8);
  }

  // ══════════════════════════════════════════
  // HUD UPDATE
  // ══════════════════════════════════════════

  function updateHUD() {
    const lvl = LEVELS[state.currentLevel];
    document.getElementById('hud-score').textContent = String(state.score).padStart(6, '0');
    document.getElementById('hud-coins').textContent = '×' + String(state.coins).padStart(2, '0');
    document.getElementById('hud-level').textContent = lvl.name.replace('World ', '').split(' ')[0];
    document.getElementById('hud-time').textContent  = state.timeLeft;
    document.getElementById('hud-lives').textContent = '♥ ' + state.lives;
  }

  // ══════════════════════════════════════════
  // GAME LOOP
  // ══════════════════════════════════════════

  function gameLoop() {
    if (!state.running) {
      // Nog 1 frame renderen zodat doodsanimatie zichtbaar is
      if (player.alive === false) {
        player.vy += GRAVITY;
        player.y  += player.vy;
        updateCamera();
        render();
      }
      return;
    }

    updatePlayer();
    updateEnemies();
    checkPickups();
    checkFlag();
    updateCamera();
    render();

    requestAnimationFrame(gameLoop);
  }

  // ══════════════════════════════════════════
  // BUTTON EVENTS
  // ══════════════════════════════════════════

  document.getElementById('btn-start').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('select');
  });

  document.getElementById('btn-back-select').addEventListener('click', () => {
    showScreen('start');
  });

  document.getElementById('btn-next-level').addEventListener('click', () => {
    const next = state.currentLevel + 1;
    if (next < LEVELS.length) startLevel(next);
    else showCompleteScreen();
  });

  document.getElementById('btn-win-select').addEventListener('click', () => {
    buildLevelGrid();
    showScreen('select');
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    state.lives = 3;
    state.score = 0;
    state.coins = 0;
    startLevel(state.currentLevel);
  });

  document.getElementById('btn-go-select').addEventListener('click', () => {
    state.lives = 3;
    buildLevelGrid();
    showScreen('select');
  });

  document.getElementById('btn-restart-all').addEventListener('click', () => {
    state.lives      = 3;
    state.totalScore = 0;
    state.totalCoins = 0;
    state.completed  = [];
    state.currentLevel = 0;
    buildLevelGrid();
    showScreen('select');
  });

  // ══════════════════════════════════════════
  // START
  // ══════════════════════════════════════════

  showScreen('start');
  resizeCanvas();

})();
