const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const startScreen = document.getElementById('start-screen');
const p1CustomScreen = document.getElementById('p1-custom-screen');
const p2CustomScreen = document.getElementById('p2-custom-screen');
const hud = document.getElementById('hud');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score-val');
const speedEl = document.getElementById('speed-val');
const p1LivesEl = document.getElementById('p1-lives-val');
const p2LivesEl = document.getElementById('p2-lives-val');
const finalScoreVal = document.getElementById('final-score-val');

// Buttons
const startBtn = document.getElementById('start-btn');
const p1ConfigBtn = document.getElementById('p1-config-btn');
const p2ConfigBtn = document.getElementById('p2-config-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseExitBtn = document.getElementById('pause-exit-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');

// Game State
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER
let animationId;
let score = 0;
let speed = 0;
let baseSpeed = 500; // Pixels per second
let speedMultiplier = 1;
let lastTime = 0;

// Assets
// Using canvas context to draw player car

const player = {
    x: 0,
    y: 0,
    width: 60,
    height: 100,
    velX: 0,
    velY: 0,
    maxSpeedX: 600,
    maxSpeedY: 300,
    chassis: 'hotrod',
    colorPrimary: '#242628',
    colorSecondary: '#7b383a',
    isCrashed: false,
    tilt: 0,
    steerState: 0,
    targetLane: 1,
    oilTimer: 0,
    lives: 3,
    invulnTimer: 0
};

const player2 = {
    x: 0,
    y: 0,
    width: 60,
    height: 100,
    velX: 0,
    velY: 0,
    maxSpeedX: 600,
    maxSpeedY: 300,
    chassis: 'striker',
    colorPrimary: '#242628',
    colorSecondary: '#7b383a',
    isCrashed: false,
    tilt: 0,
    steerState: 0,
    targetLane: 4,
    oilTimer: 0,
    lives: 3,
    invulnTimer: 0
};

const road = {
    x: 0,
    width: 600,
    laneCount: 6,
    laneWidth: 100,
    markerOffset: 0
};

let traffic = [];
let particles = [];
let trails = []; // For high-speed motion lines
let hazards = [];
let rainDrops = [];

// ─── Day / Night Cycle ───────────────────────────────────────────
// dayPhase: 0 = full day, 0.5 = dusk, 1 = full night
let dayPhase = 0;          // 0‥1, cycles
let daySpeed = 0.012;      // how fast time passes (units/sec)

// ─── Weather ─────────────────────────────────────────────────────
// weatherState: 'clear' | 'rain' | 'fog'
let weatherState = 'clear';
let weatherTimer = 0;      // seconds until next weather change
let fogAlpha = 0;          // current fog opacity (animated)
let rainIntensity = 0;     // 0‥1

// ─── Dynamic Events ──────────────────────────────────────────────
let eventTimer = 45;       // seconds until next big event
let currentEvent = null;   // 'interceptor', 'narrows', null

let interceptor = {
    active: false,
    x: 0,
    y: 0,
    width: 140, // Wide vehicle
    height: 180,
    lane: 2,
    targetLane: 2,
    speed: 0,
    warningTimer: 0,
    sirenFlash: 0
};

let narrowState = {
    active: false,
    phase: 0, // 0 to 1
    duration: 0
};
// Controls
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    a: false,
    d: false,
    w: false,
    s: false,
    A: false,
    D: false,
    W: false,
    S: false
};

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === 'Escape') togglePause();

    if (gameState === 'PLAYING' && !e.repeat) {
        const handleLaneChange = (p, dir) => {
            let move = dir;
            if (p.oilTimer > 0) {
                const rand = Math.random();
                if (rand < 0.33) move = 0; // fail to turn
                else if (rand < 0.66) move = dir * 2; // over-steer
            }
            p.targetLane = Math.max(0, Math.min(road.laneCount - 1, p.targetLane + move));
        };

        if (!player.isCrashed) {
            if (e.key === 'a' || e.key === 'A') handleLaneChange(player, -1);
            if (e.key === 'd' || e.key === 'D') handleLaneChange(player, 1);
        }
        if (!player2.isCrashed) {
            if (e.key === 'ArrowLeft') handleLaneChange(player2, -1);
            if (e.key === 'ArrowRight') handleLaneChange(player2, 1);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', showHome);

p1ConfigBtn.addEventListener('click', showP1Custom);
p2ConfigBtn.addEventListener('click', showP2Custom);
pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
pauseExitBtn.addEventListener('click', showHome);

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        document.querySelectorAll('.screen').forEach(s => {
            if (s.id !== 'hud') s.classList.add('hidden');
            s.classList.remove('active');
        });
        const target = document.getElementById(targetId);
        target.classList.remove('hidden');
        target.classList.add('active');
    });
});

// Customization Event Listeners
const chassisBtns = document.querySelectorAll('.choice-btn');
chassisBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.choice-btn');
        const playerNum = targetBtn.dataset.player;
        const parent = targetBtn.parentElement;

        // Remove active from peers only
        parent.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');

        const targetPlayer = playerNum === '1' ? player : player2;
        targetPlayer.chassis = targetBtn.dataset.type;

        if (gameState === 'START') drawStaticScene();
    });
});

document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const p = btn.dataset.player;
        const type = btn.dataset.type; // 'primary' or 'secondary'
        const color = btn.dataset.color;

        if (p === '1') {
            if (type === 'primary') player.colorPrimary = color;
            else player.colorSecondary = color;
            document.querySelectorAll(`#p1-${type}-options .color-btn`).forEach(b => b.classList.remove('active'));
        } else {
            if (type === 'primary') player2.colorPrimary = color;
            else player2.colorSecondary = color;
            document.querySelectorAll(`#p2-${type}-options .color-btn`).forEach(b => b.classList.remove('active'));
        }
        btn.classList.add('active');
        resizeCanvas();
        drawStaticScene();
    });
});

/**
 * Steering Tilt Animation using anime.js
 */
function animateTilt(targetPlayer, targetValue) {
    if (targetPlayer.tiltAnim) targetPlayer.tiltAnim.pause();
    targetPlayer.tiltAnim = anime({
        targets: targetPlayer,
        tilt: targetValue,
        duration: 400,
        easing: 'easeOutQuad'
    });
}

// Initialization
function showHome() {
    gameState = 'START';
    startScreen.classList.remove('hidden');
    startScreen.classList.add('active');
    p1CustomScreen.classList.add('hidden');
    p1CustomScreen.classList.remove('active');
    p2CustomScreen.classList.add('hidden');
    p2CustomScreen.classList.remove('active');
    hud.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    pauseScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    resizeCanvas();
    drawStaticScene(); // Draw background while waiting
}

function showP1Custom() {
    startScreen.classList.add('hidden');
    startScreen.classList.remove('active');
    p1CustomScreen.classList.remove('hidden');
    p1CustomScreen.classList.add('active');
}

function showP2Custom() {
    startScreen.classList.add('hidden');
    startScreen.classList.remove('active');
    p2CustomScreen.classList.remove('hidden');
    p2CustomScreen.classList.add('active');
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Road setup
    road.width = Math.min(800, canvas.width * 0.95);
    road.laneWidth = road.width / road.laneCount;
    road.x = (canvas.width - road.width) / 2;

    // Player setup
    player.y = canvas.height - 150;
    player2.y = canvas.height - 150;

    if (gameState === 'START') {
        player.x = road.x + player.targetLane * road.laneWidth + (road.laneWidth - player.width) / 2;
        player2.x = road.x + player2.targetLane * road.laneWidth + (road.laneWidth - player2.width) / 2;
    }
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseScreen.classList.remove('hidden');
        pauseScreen.classList.add('active');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseScreen.classList.add('hidden');
        pauseScreen.classList.remove('active');
        lastTime = performance.now();
        requestAnimationFrame(loop);
    }
}

function startGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    startScreen.classList.remove('active');
    pauseScreen.classList.add('hidden');
    pauseScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    hud.classList.remove('hidden');

    score = 0;
    speed = baseSpeed;
    traffic = [];
    particles = [];
    hazards = [];
    rainDrops = [];
    dayPhase = 0;
    weatherState = 'clear';
    weatherTimer = 20 + Math.random() * 20;
    fogAlpha = 0;
    rainIntensity = 0;
    eventTimer = 45;
    currentEvent = null;
    interceptor.active = false;
    narrowState.active = false;
    player.targetLane = 1;
    player2.targetLane = 4;
    player.x = road.x + player.targetLane * road.laneWidth + (road.laneWidth - player.width) / 2;
    player2.x = road.x + player2.targetLane * road.laneWidth + (road.laneWidth - player2.width) / 2;
    player.y = canvas.height - 150;
    player2.y = canvas.height - 150;
    player.velX = 0;
    player2.velX = 0;
    player.velY = 0;
    player2.velY = 0;
    player.isCrashed = false;
    player2.isCrashed = false;
    player.oilTimer = 0;
    player2.oilTimer = 0;
    player.lives = 3;
    player2.lives = 3;
    player.invulnTimer = 0;
    player2.invulnTimer = 0;

    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    loop(lastTime);
}

function gameOver(crashedPlayer) {
    gameState = 'GAMEOVER';
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
    finalScoreVal.innerText = Math.floor(score);

    // Create explosion particles at the crash site
    createParticles(crashedPlayer.x + crashedPlayer.width / 2, crashedPlayer.y + crashedPlayer.height / 2, 60, '#e69a8d');
    createParticles(crashedPlayer.x + crashedPlayer.width / 2, crashedPlayer.y + crashedPlayer.height / 2, 30, '#1a2a30');
}

// Game Loop
function loop(time) {
    if (gameState !== 'PLAYING') return;

    const dt = (time - lastTime) / 1000;
    lastTime = time;

    update(dt);
    draw();

    animationId = requestAnimationFrame(loop);
}

// Update Logic
function update(dt) {
    // Increase speed over time
    speed += 10 * dt;
    score += (speed * dt) / 100;

    // Input Handling P1 Y (W/S)
    if (keys.w || keys.W) {
        player.velY = -player.maxSpeedY;
    } else if (keys.s || keys.S) {
        player.velY = player.maxSpeedY;
    } else {
        player.velY = 0;
    }

    // Input Handling P2 Y (Up/Down)
    if (keys.ArrowUp) {
        player2.velY = -player2.maxSpeedY;
    } else if (keys.ArrowDown) {
        player2.velY = player2.maxSpeedY;
    } else {
        player2.velY = 0;
    }

    // Steering Tilt via Anime.js
    let moveP1 = 0;
    const p1TargetX = road.x + player.targetLane * road.laneWidth + (road.laneWidth - player.width) / 2;
    if (player.x < p1TargetX - 1) moveP1 = 1;
    else if (player.x > p1TargetX + 1) moveP1 = -1;

    if (moveP1 !== player.steerState) {
        player.steerState = moveP1;
        animateTilt(player, moveP1 * 0.12); // Max tilt 0.12 rad
    }

    let moveP2 = 0;
    const p2TargetX = road.x + player2.targetLane * road.laneWidth + (road.laneWidth - player2.width) / 2;
    if (player2.x < p2TargetX - 1) moveP2 = 1;
    else if (player2.x > p2TargetX + 1) moveP2 = -1;

    if (moveP2 !== player2.steerState) {
        player2.steerState = moveP2;
        animateTilt(player2, moveP2 * 0.12);
    }

    // Physics
    const p1Dx = p1TargetX - player.x;
    if (Math.abs(p1Dx) < player.maxSpeedX * dt) {
        player.x = p1TargetX;
    } else {
        player.x += Math.sign(p1Dx) * player.maxSpeedX * dt;
    }
    player.y += player.velY * dt;

    const p2Dx = p2TargetX - player2.x;
    if (Math.abs(p2Dx) < player2.maxSpeedX * dt) {
        player2.x = p2TargetX;
    } else {
        player2.x += Math.sign(p2Dx) * player2.maxSpeedX * dt;
    }
    player2.y += player2.velY * dt;

    // Boundaries P1
    if (player.x < road.x) player.x = road.x;
    if (player.x > road.x + road.width - player.width) player.x = road.x + road.width - player.width;
    if (player.y < 50) player.y = 50;
    if (player.y > canvas.height - 120) player.y = canvas.height - 120;

    // Boundaries P2
    if (player2.x < road.x) player2.x = road.x;
    if (player2.x > road.x + road.width - player2.width) player2.x = road.x + road.width - player2.width;
    if (player2.y < 50) player2.y = 50;
    if (player2.y > canvas.height - 120) player2.y = canvas.height - 120;

    // Road Scroll
    const scrollSpeed = speed * dt;
    road.markerOffset += scrollSpeed;
    if (road.markerOffset > 80) road.markerOffset = 0;

    // Traffic Spawning
    if (Math.random() < 0.004) {
        spawnTraffic();
    }

    // Update Traffic
    for (let i = traffic.length - 1; i >= 0; i--) {
        const car = traffic[i];
        car.y += (speed - car.speed) * dt;
        // Relative speed: traffic moves slower than player/road implies player is overtaking,
        // but visually in this style, everything moves down.
        // Actually, "speed" is world speed. 
        // If we say player is going 'speed', then objects with actual speed 0 (static) move down at 'speed'.
        // Traffic cars have their own positive forward speed. So relative speed is (speed - carSpeed).

        if (car.y > canvas.height) {
            traffic.splice(i, 1);
            score += 10;
        }

        // Collision Check for both players
        if (!player.isCrashed && checkCollision(player, car)) {
            handleCrash(player);
        }
        if (!player2.isCrashed && checkCollision(player2, car)) {
            handleCrash(player2);
        }

        if (car.isChangingLane) {
            car.blinkerTimer += dt;
            // Execute movement only when 2/5 down the screen
            if (car.y > canvas.height * 2 / 5) {
                const targetX = road.x + car.targetLane * road.laneWidth + (road.laneWidth - car.width) / 2;
                const dx = targetX - car.x;
                const lerpSpeed = 150 * dt;
                if (Math.abs(dx) < lerpSpeed) {
                    car.x = targetX;
                    car.lane = car.targetLane;
                    car.isChangingLane = false;
                } else {
                    car.x += Math.sign(dx) * lerpSpeed;
                }
            }
        }
    }

    // Dynamic Collision between players
    if (checkCollision(player, player2)) {
        handleCrash(player);
        handleCrash(player2);
    }

    // Update Particles
    updateParticles(dt);

    // Update Trails
    if (speed > 600) {
        if (!player.isCrashed) {
            trails.push({
                x: player.x + Math.random() * player.width,
                y: player.y + player.height,
                life: 0.5,
                color: player.colorPrimary
            });
        }
        if (!player2.isCrashed) {
            trails.push({
                x: player2.x + Math.random() * player2.width,
                y: player2.y + player2.height,
                life: 0.5,
                color: player2.colorPrimary
            });
        }
    }
    for (let i = trails.length - 1; i >= 0; i--) {
        trails[i].y += speed * dt;
        trails[i].life -= dt * 2;
        if (trails[i].life <= 0) trails.splice(i, 1);
    }

    // ─── Day / Night update ──────────────────────────────────────
    dayPhase = (dayPhase + daySpeed * dt) % 1;

    // ─── Weather update ──────────────────────────────────────────
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
        const roll = Math.random();
        if (weatherState === 'clear') {
            weatherState = roll < 0.5 ? 'rain' : 'fog';
        } else {
            weatherState = 'clear';
        }
        weatherTimer = 15 + Math.random() * 25;
    }
    // Animate fog & rain intensity
    const targetFog = weatherState === 'fog' ? 0.35 : 0;
    fogAlpha += (targetFog - fogAlpha) * dt * 1.5;
    const targetRain = weatherState === 'rain' ? 1 : 0;
    rainIntensity += (targetRain - rainIntensity) * dt * 2;

    // ─── Dynamic Events ──────────────────────────────────────────
    if (!currentEvent) {
        eventTimer -= dt;
        if (eventTimer <= 0) {
            currentEvent = Math.random() < 0.5 ? 'interceptor' : 'narrows';
            if (currentEvent === 'interceptor') {
                interceptor.active = true;
                interceptor.y = canvas.height + 200; // Spawns below screen
                interceptor.lane = Math.floor(road.laneCount / 2);
                interceptor.width = road.laneWidth * 1.5;
                interceptor.x = road.x + interceptor.lane * road.laneWidth + (road.laneWidth - interceptor.width) / 2;
                interceptor.targetLane = interceptor.lane;
                interceptor.speed = speed + 80; // Catch up speed
                interceptor.warningTimer = 3;
            } else if (currentEvent === 'narrows') {
                narrowState.active = true;
                narrowState.phase = 0;
                narrowState.duration = 15;
            }
        }
    } else {
        if (currentEvent === 'interceptor') {
            if (interceptor.warningTimer > 0) {
                interceptor.warningTimer -= dt;
                interceptor.sirenFlash = (interceptor.sirenFlash + dt * 10) % 2;
            } else {
                // Move interceptor
                interceptor.y -= (interceptor.speed - speed) * dt;

                // Chase logic: find nearest player
                let targetX = road.x + road.width / 2;
                if (!player.isCrashed && !player2.isCrashed) {
                    targetX = player.y > player2.y ? player.x : player2.x; // Target lowest player
                } else if (!player.isCrashed) {
                    targetX = player.x;
                } else if (!player2.isCrashed) {
                    targetX = player2.x;
                }

                // Steer towards targetX
                if (interceptor.x + interceptor.width / 2 < targetX - 20) interceptor.targetLane = Math.min(road.laneCount - 2, interceptor.lane + 1);
                else if (interceptor.x + interceptor.width / 2 > targetX + 20) interceptor.targetLane = Math.max(0, interceptor.lane - 1);

                const targetLaneX = road.x + interceptor.targetLane * road.laneWidth + (road.laneWidth - interceptor.width) / 2;
                const dx = targetLaneX - interceptor.x;
                interceptor.x += Math.sign(dx) * Math.min(Math.abs(dx), 300 * dt);
                if (Math.abs(dx) < 10) interceptor.lane = interceptor.targetLane;

                // Collision
                if (!player.isCrashed && checkCollision(player, interceptor)) handleCrash(player);
                if (!player2.isCrashed && checkCollision(player2, interceptor)) handleCrash(player2);

                if (interceptor.y < -400) {
                    currentEvent = null;
                    interceptor.active = false;
                    eventTimer = 45;
                }
            }
        } else if (currentEvent === 'narrows') {
            narrowState.duration -= dt;
            if (narrowState.duration <= 0) {
                narrowState.phase -= dt * 0.5;
                if (narrowState.phase <= 0) {
                    narrowState.phase = 0;
                    narrowState.active = false;
                    currentEvent = null;
                    eventTimer = 45;
                }
            } else {
                narrowState.phase = Math.min(1, narrowState.phase + dt * 0.5);
            }

            // Check narrow collision
            if (narrowState.phase > 0.8) {
                const leftLimit = road.x + road.laneWidth;
                const rightLimit = road.x + road.width - road.laneWidth;
                if (!player.isCrashed && (player.x < leftLimit || player.x + player.width > rightLimit)) handleCrash(player);
                if (!player2.isCrashed && (player2.x < leftLimit || player2.x + player2.width > rightLimit)) handleCrash(player2);
            }
        }
    }

    // Spawn rain drops
    if (rainIntensity > 0.05) {
        const count = Math.floor(rainIntensity * 8);
        for (let r = 0; r < count; r++) {
            rainDrops.push({
                x: road.x + Math.random() * road.width,
                y: -20,
                len: 12 + Math.random() * 18,
                speed: 600 + Math.random() * 400
            });
        }
    }
    for (let r = rainDrops.length - 1; r >= 0; r--) {
        rainDrops[r].y += rainDrops[r].speed * dt;
        if (rainDrops[r].y > canvas.height) rainDrops.splice(r, 1);
    }

    // ─── Road Hazards ────────────────────────────────────────────
    // Spawn hazards (roughly every 4 s at base speed)
    if (Math.random() < 0.008) spawnHazard();

    for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i];
        h.y += speed * dt;
        h.animT += dt;
        if (h.y > canvas.height + 50) { hazards.splice(i, 1); continue; }

        // ── Laser: hard collision = crash ──
        if (h.type === 'laser') {
            if (!player.isCrashed && checkCollision(player, h)) { handleCrash(player); }
            if (!player2.isCrashed && checkCollision(player2, h)) { handleCrash(player2); }
        }
        // ── Cone: hard collision = crash ──
        if (h.type === 'cone') {
            if (!player.isCrashed && checkCollision(player, h)) { handleCrash(player); }
            if (!player2.isCrashed && checkCollision(player2, h)) { handleCrash(player2); }
        }
        // ── Oil slick: touching it causes a spin‑out ──
        if (h.type === 'oil') {
            if (!player.isCrashed && !player.oilTimer && checkCollision(player, h)) { player.oilTimer = 2; }
            if (!player2.isCrashed && !player2.oilTimer && checkCollision(player2, h)) { player2.oilTimer = 2; }
        }
        // ── Life Powerup: restores a life ──
        if (h.type === 'life') {
            const hcx = h.x + h.width / 2;
            const hcy = h.y + h.height / 2;
            if (!player.isCrashed && checkCollision(player, h)) {
                if (player.lives < 5) player.lives++;
                createParticles(hcx, hcy, 20, '#00f3ff');
                hazards.splice(i, 1);
                continue;
            }
            if (!player2.isCrashed && checkCollision(player2, h)) {
                if (player2.lives < 5) player2.lives++;
                createParticles(hcx, hcy, 20, '#00f3ff');
                hazards.splice(i, 1);
                continue;
            }
        }
    }

    // ── Oil / bump timer tick ──
    if (player.oilTimer > 0) {
        player.oilTimer -= dt;
        // slide the player sideways
        player.x += Math.sin(player.oilTimer * 10) * 3;
    }
    if (player2.oilTimer > 0) {
        player2.oilTimer -= dt;
        player2.x += Math.sin(player2.oilTimer * 10) * 3;
    }

    // Invulnerability timer tick
    if (player.invulnTimer > 0) player.invulnTimer -= dt;
    if (player2.invulnTimer > 0) player2.invulnTimer -= dt;

    // UI Update
    if (scoreEl) scoreEl.innerText = Math.floor(score).toString().padStart(4, '0');
    if (speedEl) speedEl.innerText = Math.floor(speed / 10).toString();
    if (p1LivesEl) p1LivesEl.innerText = player.lives;
    if (p2LivesEl) p2LivesEl.innerText = player2.lives;
}

function handleCrash(crashedPlayer) {
    if (crashedPlayer.invulnTimer > 0) return;

    crashedPlayer.lives--;

    if (crashedPlayer.lives <= 0) {
        crashedPlayer.isCrashed = true;
        gameOver(crashedPlayer);
    } else {
        crashedPlayer.invulnTimer = 2; // 2 seconds of invulnerability
        // Smaller explosion for losing a life
        createParticles(crashedPlayer.x + crashedPlayer.width / 2, crashedPlayer.y + crashedPlayer.height / 2, 20, '#ffaa00');
    }
}

function gameOver(crashedPlayer) {
    gameState = 'GAMEOVER';
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
    finalScoreVal.innerText = Math.floor(score);

    // Create explosion effect
    createParticles(crashedPlayer.x + crashedPlayer.width / 2, crashedPlayer.y + crashedPlayer.height / 2, 40, '#ff4400');
    createParticles(crashedPlayer.x + crashedPlayer.width / 2, crashedPlayer.y + crashedPlayer.height / 2, 20, '#ffcc00');
}

function spawnTraffic() {
    const lane = Math.floor(Math.random() * road.laneCount);
    const trafficX = road.x + lane * road.laneWidth + (road.laneWidth - 60) / 2;

    // Don't spawn if too close to another car
    for (const car of traffic) {
        if (Math.abs(car.y - (-150)) < 200 && Math.abs(car.x - trafficX) < 10) return;
    }

    const willChange = Math.random() < 0.3; // 30% NPCs change lane
    let targetLane = lane;
    let bSide = null;
    let changing = false;

    if (willChange) {
        const options = [];
        if (lane > 0) options.push(lane - 1);
        if (lane < road.laneCount - 1) options.push(lane + 1);
        if (options.length > 0) {
            targetLane = options[Math.floor(Math.random() * options.length)];
            bSide = targetLane > lane ? 'right' : 'left';
            changing = true;
        }
    }

    traffic.push({
        x: trafficX,
        y: -150,
        lane: lane,
        width: 60,
        height: 100,
        speed: 200 + Math.random() * 200,
        color: getRandomAegisColor(),
        isChangingLane: changing,
        targetLane: targetLane,
        blinkerTimer: 0,
        blinkerSide: bSide
    });
}

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ─── Day / Night Sky ────────────────────────────────────────
    // dayPhase: 0=noon, 0.25=dusk, 0.5=midnight, 0.75=dawn
    const nightT = Math.sin(dayPhase * Math.PI * 2) * 0.5 + 0.5; // 0=day, 1=night
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const dayTop = `rgba(20,30,50,${0.4 + nightT * 0.55})`;
    const dayBot = `rgba(10,15,25,${0.6 + nightT * 0.35})`;
    skyGrad.addColorStop(0, dayTop);
    skyGrad.addColorStop(1, dayBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Road (brightness drops slightly at night)
    const roadBright = Math.round(40 + (1 - nightT) * 25); // 40–65 for better visibility
    ctx.fillStyle = `rgb(${roadBright},${roadBright + 2},${roadBright + 5})`; // Slight tactical blue tint
    ctx.fillRect(road.x - 20, 0, road.width + 40, canvas.height);

    // Shoulders
    ctx.fillStyle = `rgb(${roadBright - 3},${roadBright - 3},${roadBright - 3})`;
    ctx.fillRect(road.x - 20, 0, 15, canvas.height);
    ctx.fillRect(road.x + road.width + 5, 0, 15, canvas.height);

    // Neon rail glow intensifies at night
    const neonA = 0.6 + nightT * 0.4;
    const neonBlur = 10 + nightT * 20;
    ctx.shadowBlur = neonBlur;
    ctx.shadowColor = `rgba(77, 182, 172, ${neonA})`;
    ctx.strokeStyle = `rgba(77, 182, 172, ${neonA})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(road.x, 0); ctx.lineTo(road.x, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(road.x + road.width, 0); ctx.lineTo(road.x + road.width, canvas.height); ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane markers
    ctx.strokeStyle = `rgba(77, 182, 172, ${0.25 + nightT * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([60, 20]);
    ctx.lineDashOffset = -road.markerOffset;
    for (let i = 1; i < road.laneCount; i++) {
        const x = road.x + i * road.laneWidth;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Road Hazards
    drawHazards();

    // Draw Narrows Overlay
    if (narrowState.active) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 50, 0, ${narrowState.phase * 0.4})`;
        ctx.fillRect(road.x, 0, road.laneWidth, canvas.height); // left lane
        ctx.fillRect(road.x + road.width - road.laneWidth, 0, road.laneWidth, canvas.height); // right lane

        ctx.strokeStyle = `rgba(255, 0, 0, ${narrowState.phase})`;
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 20]);
        ctx.lineDashOffset = -road.markerOffset * 2;
        ctx.beginPath(); ctx.moveTo(road.x + road.laneWidth, 0); ctx.lineTo(road.x + road.laneWidth, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(road.x + road.width - road.laneWidth, 0); ctx.lineTo(road.x + road.width - road.laneWidth, canvas.height); ctx.stroke();
        ctx.restore();
    }

    // Draw Traffic
    for (const car of traffic) {
        let bSide = null;
        let bOn = false;
        if (car.isChangingLane) {
            bSide = car.blinkerSide;
            bOn = Math.floor(car.blinkerTimer * 5) % 2 === 0; // Flash 5Hz
        }
        drawCar(car.x, car.y, car.width, car.height, car.color, bSide, bOn);
    }

    // Draw Players
    const timeNow = Date.now();
    if (!player.isCrashed) {
        if (player.invulnTimer <= 0 || Math.floor(timeNow / 100) % 2 === 0) {
            drawPlayerCar(player.x, player.y, player.width, player.height, player.chassis, player.colorPrimary, player.colorSecondary, player.tilt);
        }
    }
    if (!player2.isCrashed) {
        if (player2.invulnTimer <= 0 || Math.floor(timeNow / 100) % 2 === 0) {
            drawPlayerCar(player2.x, player2.y, player2.width, player2.height, player2.chassis, player2.colorPrimary, player2.colorSecondary, player2.tilt);
        }
    }

    // Draw Interceptor
    if (interceptor.active) {
        ctx.save();
        if (interceptor.warningTimer > 0) {
            // Draw Warning overlay
            ctx.fillStyle = interceptor.sirenFlash < 1 ? 'rgba(255,0,0,0.15)' : 'rgba(0,0,255,0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px Outfit, monospace';
            ctx.textAlign = 'center';
            ctx.fillText("INTERCEPTOR INCOMING", canvas.width / 2, canvas.height / 2);
        }

        // Draw Interceptor chassis
        const ix = interceptor.x;
        const iy = interceptor.y;
        const iw = interceptor.width;
        const ih = interceptor.height;

        ctx.fillStyle = '#111'; // Dark armored
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.fillRect(ix, iy, iw, ih);

        // Armored details
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(ix + 10, iy + 10, iw - 20, ih - 20);
        ctx.fillStyle = '#222';
        ctx.fillRect(ix + 20, iy + 30, iw - 40, ih - 60);

        // Sirens
        const sirenColor = (Date.now() % 400 < 200) ? '#ff0000' : '#0000ff';
        ctx.fillStyle = sirenColor;
        ctx.shadowColor = sirenColor;
        ctx.shadowBlur = 30;
        ctx.fillRect(ix + 20, iy + 40, iw - 40, 10);

        // Headlights (facing UP since it's driving UP)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(ix + 20, iy);
        ctx.lineTo(ix - 50, iy - 200);
        ctx.lineTo(ix + 60, iy - 200);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ix + iw - 20, iy);
        ctx.lineTo(ix + iw + 50, iy - 200);
        ctx.lineTo(ix + iw - 60, iy - 200);
        ctx.fill();

        ctx.restore();
    }

    // Draw Particles
    drawParticles();

    // Draw Trails
    ctx.lineWidth = 2;
    for (const t of trails) {
        ctx.globalAlpha = t.life;
        ctx.strokeStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x, t.y + 40);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // ─── Rain ────────────────────────────────────────────────────
    if (rainIntensity > 0.01) {
        ctx.save();
        ctx.strokeStyle = `rgba(174,214,241,${rainIntensity * 0.55})`;
        ctx.lineWidth = 1;
        for (const drop of rainDrops) {
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x - 2, drop.y + drop.len);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ─── Fog overlay ─────────────────────────────────────────────
    if (fogAlpha > 0.005) {
        const fogGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        fogGrad.addColorStop(0, `rgba(200,210,220,${fogAlpha * 0.9})`);
        fogGrad.addColorStop(0.5, `rgba(180,195,210,${fogAlpha * 0.5})`);
        fogGrad.addColorStop(1, `rgba(160,180,200,${fogAlpha * 0.15})`);
        ctx.fillStyle = fogGrad;
        ctx.fillRect(road.x - 20, 0, road.width + 40, canvas.height);
    }

    // Vignette Effect
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2, canvas.height);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ─── Weather HUD badge ───────────────────────────────────────
    if (weatherState !== 'clear') {
        ctx.save();
        ctx.globalAlpha = Math.max(fogAlpha, rainIntensity);
        ctx.fillStyle = weatherState === 'rain' ? 'rgba(100,160,220,0.85)' : 'rgba(180,200,210,0.85)';
        ctx.font = 'bold 13px Outfit, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(weatherState === 'rain' ? '🌧 RAIN' : '🌫 FOG', canvas.width / 2, canvas.height - 40);
        ctx.restore();
    }
}

function drawPlayerCar(x, y, w, h, chassis, primaryColor, secondaryColor, tilt = 0) {
    ctx.save();

    // Position and Rotate
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(tilt);
    ctx.translate(-centerX, -centerY);

    // Gradient Resolution
    function resolveColor(colorStr, gradY, gradH) {
        if (colorStr === 'grad-heat') {
            const g = ctx.createLinearGradient(0, gradY, 0, gradY + gradH);
            g.addColorStop(0, '#d92727'); // Red
            g.addColorStop(0.5, '#ff8800'); // Orange
            g.addColorStop(1, '#ffe600'); // Yellow
            return g;
        }
        if (colorStr === 'grad-cool') {
            const g = ctx.createLinearGradient(0, gradY, 0, gradY + gradH);
            g.addColorStop(0, '#0000ff'); // Deep Blue
            g.addColorStop(0.5, '#0099ff'); // Sky Blue
            g.addColorStop(1, '#00ffff'); // Cyan
            return g;
        }
        if (colorStr === 'grad-nebula') {
            const g = ctx.createLinearGradient(0, gradY, 0, gradY + gradH);
            g.addColorStop(0, '#f0f421'); // Yellow
            g.addColorStop(0.5, '#e66b1a'); // Orange
            g.addColorStop(1, '#611b4d'); // Purple
            return g;
        }
        if (colorStr === 'grad-hazard') {
            const g = ctx.createLinearGradient(0, gradY, 0, gradY + gradH);
            g.addColorStop(0, '#3d6060'); // Industrial Teal
            g.addColorStop(1, '#d92727'); // Warning Red
            return g;
        }
        return colorStr;
    }

    const pColor = resolveColor(primaryColor, y, h);
    const sColor = resolveColor(secondaryColor, y, h);

    // Depth shadow
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';

    if (chassis === 'hotrod') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 2.0;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000'; // Strong black outlines

        const leftShapes = [
            // 1. Rear Wheels (Massive Drag Slicks)
            { color: '#0a0a0a', points: [[-0.42, 0.72], [-0.95, 0.72], [-0.95, 0.96], [-0.42, 0.96]] },
            // 1.5 Rear Wheel Rims (Chrome)
            { color: '#555555', points: [[-0.55, 0.75], [-0.82, 0.75], [-0.82, 0.93], [-0.55, 0.93]] },
            { color: '#aaaaaa', points: [[-0.62, 0.78], [-0.75, 0.78], [-0.75, 0.90], [-0.62, 0.90]] },

            // 2. Front Wheels (Small, Narrow)
            { color: '#0a0a0a', points: [[-0.45, 0.12], [-0.65, 0.12], [-0.65, 0.32], [-0.45, 0.32]] },
            // 2.5 Front Wheel Rims
            { color: '#777777', points: [[-0.50, 0.15], [-0.60, 0.15], [-0.60, 0.29], [-0.50, 0.29]] },

            // 3. Exposed Front Axle & Suspension (Chrome)
            { color: '#dddddd', points: [[-0.1, 0.22], [-0.45, 0.22], [-0.45, 0.24], [-0.1, 0.24]] },
            { color: '#bbbbbb', points: [[-0.1, 0.18], [-0.45, 0.20], [-0.45, 0.22], [-0.1, 0.20]] },

            // 4. Main Body - Tapered Front / Wide Rear
            { color: pColor, points: [[0, 0.1], [-0.25, 0.12], [-0.35, 0.45], [-0.42, 0.65], [-0.48, 0.92], [0, 0.92]] },

            // 5. Classic Flame Decals / Scallops (Secondary Color)
            { color: sColor, points: [[-0.22, 0.15], [-0.32, 0.45], [-0.25, 0.35], [-0.35, 0.55], [-0.28, 0.48], [-0.4, 0.75], [-0.1, 0.5]] },

            // 6. Side Exhaust Pipes (Chrome headers merging into a side pipe)
            { color: '#bbbbbb', points: [[-0.32, 0.35], [-0.5, 0.45], [-0.5, 0.7], [-0.42, 0.7]] },
            { color: '#eeeeee', points: [[-0.42, 0.45], [-0.46, 0.45], [-0.46, 0.68], [-0.42, 0.68]] }, // Pipe highlight
            { color: '#444444', points: [[-0.46, 0.68], [-0.5, 0.68], [-0.5, 0.71], [-0.46, 0.71]] }, // Exhaust Tip
            { color: '#ffaa00', points: [[-0.47, 0.71], [-0.49, 0.71], [-0.49, 0.73], [-0.47, 0.73]] }, // Flame inside tip

            // 7. Engine Block (Grey/Black)
            { color: '#333333', points: [[0, 0.25], [-0.2, 0.28], [-0.2, 0.42], [0, 0.45]] },
            { color: '#1a1a1a', points: [[-0.05, 0.28], [-0.15, 0.30], [-0.15, 0.40], [-0.05, 0.42]] }, // Valve Covers

            // 8. Supercharger Intake (Chrome)
            { color: '#eeeeee', points: [[0, 0.3], [-0.18, 0.3], [-0.18, 0.38], [0, 0.38]] },
            { color: '#0a0a0a', points: [[-0.1, 0.32], [-0.16, 0.32], [-0.16, 0.36], [-0.1, 0.36]] }, // Intake hole (Butterfly valve)
            { color: '#ff3300', points: [[-0.12, 0.33], [-0.14, 0.33], [-0.14, 0.35], [-0.12, 0.35]] }, // Glow inside intake

            // 9. Supercharger Belt & Pulley
            { color: '#000000', points: [[0, 0.39], [-0.1, 0.39], [-0.1, 0.42], [0, 0.42]] },

            // 10. Front Radiator Grille (Chrome surround, dark inner)
            { color: '#dddddd', points: [[0, 0.08], [-0.22, 0.1], [-0.22, 0.15], [0, 0.15]] },
            { color: '#111111', points: [[0, 0.09], [-0.18, 0.11], [-0.18, 0.14], [0, 0.14]] }, // Inner grille
            { color: '#777777', points: [[-0.05, 0.09], [-0.08, 0.09], [-0.08, 0.14], [-0.05, 0.14]] }, // Grille vertical bars
            { color: '#777777', points: [[-0.12, 0.09], [-0.15, 0.09], [-0.15, 0.14], [-0.12, 0.14]] },

            // 11. Front Headlights (Classic Round, Chrome bucket, Yellow glow)
            { color: '#aaaaaa', points: [[-0.28, 0.15], [-0.36, 0.15], [-0.36, 0.22], [-0.28, 0.22]] },
            { color: '#ffeeaa', points: [[-0.29, 0.16], [-0.35, 0.16], [-0.35, 0.21], [-0.29, 0.21]] },

            // 12. Chopped Windshield (Dark Tint)
            { color: '#111111', points: [[0, 0.48], [-0.3, 0.50], [-0.3, 0.55], [0, 0.58]] },
            { color: '#334455', points: [[0, 0.49], [-0.25, 0.51], [-0.25, 0.53], [0, 0.56]] }, // Window glare

            // 13. Roof (Primary Color)
            { color: pColor, points: [[0, 0.58], [-0.28, 0.55], [-0.28, 0.72], [0, 0.75]] },

            // 14. Rear Window (Dark Tint)
            { color: '#111111', points: [[0, 0.75], [-0.22, 0.72], [-0.22, 0.78], [0, 0.82]] },

            // 15. Rear Fenders / Wheel Arches (Secondary Color)
            { color: sColor, points: [[-0.4, 0.65], [-0.52, 0.65], [-0.55, 0.82], [-0.45, 0.94], [-0.38, 0.94]] },

            // 16. Rear Tail Lights (Classic hot rod dots)
            { color: '#cc0000', points: [[-0.35, 0.90], [-0.42, 0.90], [-0.42, 0.93], [-0.35, 0.93]] },
            { color: '#ff5555', points: [[-0.37, 0.91], [-0.40, 0.91], [-0.40, 0.92], [-0.37, 0.92]] }, // Inner bright glow

            // 17. Rear Bumper / Roll Pan (Chrome)
            { color: '#cccccc', points: [[0, 0.92], [-0.35, 0.92], [-0.35, 0.95], [0, 0.95]] }
        ];

        leftShapes.forEach(shape => {
            // Draw Left Side
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            ctx.moveTo(centerX + shape.points[0][0] * dw, y + shape.points[0][1] * h);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(centerX + shape.points[i][0] * dw, y + shape.points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw Right Side (Mirror)
            ctx.beginPath();
            ctx.moveTo(centerX - shape.points[0][0] * dw, y + shape.points[0][1] * h);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(centerX - shape.points[i][0] * dw, y + shape.points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // Center Split Line (Hood crease)
        ctx.beginPath();
        ctx.moveTo(centerX, y + 0.1 * h);
        ctx.lineTo(centerX, y + 0.94 * h);
        ctx.stroke();
    } else if (chassis === 'striker') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000'; // Strong black outlines

        const leftShapes = [
            // 1. Center Column (Black)
            {
                color: '#0a0a0a',
                points: [[0, 0.75], [-0.12, 0.75], [-0.12, 0.95], [0, 0.95]]
            },
            // 2. Left Wheel (Black)
            {
                color: '#0a0a0a',
                points: [[-0.15, 0.78], [-0.45, 0.78], [-0.45, 0.98], [-0.15, 0.98]]
            },
            // 3. Front Orange Backing
            {
                color: sColor,
                points: [[0, 0.1], [-0.4, 0.1], [-0.5, 0.3], [0, 0.3]]
            },
            // 4. Outer Orange Wings
            {
                color: sColor,
                points: [[-0.6, 0.08], [-0.9, 0.12], [-0.95, 0.35], [-0.8, 0.4], [-0.65, 0.2]]
            },
            // 5. Main Green Hull
            {
                color: pColor,
                points: [
                    [0, 0.08], [-0.05, 0.08], [-0.3, 0.2], [-0.8, 0.18], [-0.75, 0.25],
                    [-0.45, 0.34], [-0.3, 0.42], [-0.6, 0.52], [-0.4, 0.7], [-0.85, 0.76],
                    [-0.95, 0.82], [-0.8, 0.85], [-0.2, 0.76], [0, 0.76]
                ]
            },
            // 6. Top Small Green Wings
            {
                color: pColor,
                points: [[-0.1, 0.04], [-0.45, 0.05], [-0.45, 0.1], [-0.15, 0.12]]
            },
            // 7. Glass Area (Cockpit)
            {
                color: '#7a9ebf',
                points: [[0, 0.25], [-0.2, 0.35], [-0.2, 0.45], [0, 0.5]]
            },
            // 8. Leg Black Vent
            {
                color: '#0a0a0a',
                points: [[-0.05, 0.55], [-0.25, 0.55], [-0.15, 0.7], [-0.05, 0.7]]
            },
            // 9. Leg Yellow Stripe 1
            {
                color: '#ffe600',
                points: [[-0.05, 0.57], [-0.2, 0.6], [-0.18, 0.62], [-0.05, 0.59]]
            },
            // 10. Leg Yellow Stripe 2
            {
                color: '#ffe600',
                points: [[-0.05, 0.64], [-0.15, 0.66], [-0.13, 0.68], [-0.05, 0.66]]
            },
            // 11. Inner Hull Tech Detail (Black)
            {
                color: '#1a1a1a',
                points: [[-0.1, 0.35], [-0.25, 0.38], [-0.22, 0.45], [-0.1, 0.42]]
            },
            // 12. Sharpened Wing Tips (Secondary - Orange)
            {
                color: sColor,
                points: [[-0.9, 0.12], [-1.0, 0.05], [-0.95, 0.2]]
            },
            // 13. Cockpit Frame (Secondary - Orange)
            {
                color: sColor,
                points: [[0, 0.22], [-0.25, 0.35], [-0.25, 0.48], [0, 0.53], [0, 0.5], [-0.2, 0.45], [-0.2, 0.35], [0, 0.25]]
            },
            // 14. Sidepod Cooling Vents (Black)
            {
                color: '#0a0a0a',
                points: [[-0.4, 0.55], [-0.55, 0.58], [-0.55, 0.65], [-0.4, 0.62]]
            },
            {
                color: '#0a0a0a',
                points: [[-0.42, 0.64], [-0.52, 0.66], [-0.52, 0.7], [-0.42, 0.68]]
            },
            // 15. Side Light Bars (Glow)
            {
                color: '#ffffff',
                points: [[-0.1, 0.1], [-0.15, 0.12], [-0.15, 0.25], [-0.1, 0.22]]
            },
            {
                color: '#ffffff',
                points: [[-0.05, 0.78], [-0.1, 0.78], [-0.1, 0.9], [-0.05, 0.9]]
            },
            // 16. Forward Sensors (Glowing Cyan)
            {
                color: '#00ffff',
                points: [[-0.2, 0.08], [-0.25, 0.08], [-0.25, 0.12], [-0.2, 0.12]]
            },
            // 17. Rear Spoiler (Primary)
            {
                color: pColor,
                points: [[0, 0.88], [-0.5, 0.85], [-0.5, 0.92], [0, 0.92]]
            },
            // 18. Rear Spoiler Struts (Black)
            {
                color: '#1a1a1a',
                points: [[-0.2, 0.8], [-0.25, 0.8], [-0.25, 0.88], [-0.2, 0.88]]
            },
            // 19. Weapon / Thruster Pods on the Wings (Secondary)
            {
                color: sColor,
                points: [[-0.7, 0.45], [-0.85, 0.48], [-0.85, 0.6], [-0.7, 0.55]]
            },
            // 20. Thruster Pod Glow (Orange)
            {
                color: '#ff8800',
                points: [[-0.75, 0.55], [-0.8, 0.55], [-0.8, 0.58], [-0.75, 0.58]]
            },
            // 21. Additional Cockpit details (Seat - Dark Red)
            {
                color: '#8b0000',
                points: [[0, 0.35], [-0.1, 0.38], [-0.1, 0.45], [0, 0.45]]
            }
        ];

        // Dynamic width scaling: keeps rear wheels slim but flares out the upper body
        const getSlimFactor = (py) => {
            return 0.55 + Math.max(0, (0.6 - py)) * 0.7; // Tapers from 0.97 at nose to 0.55 at wheels
        };

        leftShapes.forEach(shape => {
            // Draw Left Side
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            let p0y = shape.points[0][1];
            ctx.moveTo(centerX + shape.points[0][0] * dw * getSlimFactor(p0y), y + p0y * h);
            for (let i = 1; i < shape.points.length; i++) {
                let py = shape.points[i][1];
                ctx.lineTo(centerX + shape.points[i][0] * dw * getSlimFactor(py), y + py * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw Right Side (Mirror)
            ctx.beginPath();
            ctx.moveTo(centerX - shape.points[0][0] * dw * getSlimFactor(p0y), y + p0y * h);
            for (let i = 1; i < shape.points.length; i++) {
                let py = shape.points[i][1];
                ctx.lineTo(centerX - shape.points[i][0] * dw * getSlimFactor(py), y + py * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // Center Split Line
        ctx.beginPath();
        ctx.moveTo(centerX, y + 0.08 * h);
        ctx.lineTo(centerX, y + 0.95 * h);
        ctx.stroke();

    } else if (chassis === 'muscle') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 2.0;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';

        const leftShapes = [
            // 1. Front Splitter (Carbon/Black)
            { color: '#151515', points: [[0, 0.02], [-0.75, 0.02], [-0.75, 0.06], [-0.4, 0.08], [0, 0.08]] },

            // 2. Front Splitter Winglets/Canards
            { color: '#111111', points: [[-0.75, 0.02], [-0.85, 0.04], [-0.8, 0.12], [-0.72, 0.1]] },

            // 3. Front Wheels
            { color: '#050505', points: [[-0.6, 0.12], [-0.85, 0.12], [-0.85, 0.28], [-0.6, 0.28]] },

            // 4. Rear Wheels
            { color: '#050505', points: [[-0.65, 0.72], [-0.85, 0.72], [-0.85, 0.90], [-0.65, 0.90]] },

            // 5. Side Skirts / Aero Extensions (Carbon/Black)
            { color: '#1a1a1a', points: [[-0.5, 0.35], [-0.6, 0.35], [-0.6, 0.7], [-0.5, 0.7]] },

            // 6. Main Body Base (Primary)
            { color: pColor, points: [[0, 0.06], [-0.45, 0.08], [-0.55, 0.35], [-0.55, 0.7], [-0.48, 0.95], [0, 0.95]] },

            // 7. Front Wide Fender Flares (Primary)
            { color: pColor, points: [[-0.4, 0.06], [-0.75, 0.08], [-0.85, 0.2], [-0.75, 0.35], [-0.55, 0.35]] },

            // 8. Rear Wide Fender Flares (Primary)
            { color: pColor, points: [[-0.55, 0.65], [-0.8, 0.68], [-0.9, 0.8], [-0.8, 0.92], [-0.48, 0.92]] },

            // 9. Central Hood Area (Primary)
            { color: pColor, points: [[0, 0.08], [-0.4, 0.1], [-0.45, 0.35], [0, 0.35]] },

            // 10. Hood Central Louver Vent (Black)
            { color: '#0a0a0a', points: [[0, 0.12], [-0.2, 0.12], [-0.22, 0.28], [0, 0.28]] },

            // 11. Hood Central Louver Slats (Secondary)
            { color: sColor, points: [[0, 0.14], [-0.18, 0.14], [-0.18, 0.15], [0, 0.15]] },
            { color: sColor, points: [[0, 0.18], [-0.19, 0.18], [-0.19, 0.19], [0, 0.19]] },
            { color: sColor, points: [[0, 0.22], [-0.20, 0.22], [-0.20, 0.23], [0, 0.23]] },
            { color: sColor, points: [[0, 0.26], [-0.21, 0.26], [-0.21, 0.27], [0, 0.27]] },

            // 12. Hood Side Vents (Black)
            { color: '#0a0a0a', points: [[-0.28, 0.15], [-0.36, 0.15], [-0.38, 0.25], [-0.3, 0.25]] },
            { color: sColor, points: [[-0.29, 0.17], [-0.35, 0.17], [-0.35, 0.18], [-0.29, 0.18]] },
            { color: sColor, points: [[-0.30, 0.21], [-0.36, 0.21], [-0.36, 0.22], [-0.30, 0.22]] },

            // 13. Windshield (Dark Tint)
            { color: '#111111', points: [[0, 0.35], [-0.4, 0.38], [-0.38, 0.50], [0, 0.52]] },

            // 14. Windshield Sun Banner (Black)
            { color: '#050505', points: [[0, 0.35], [-0.4, 0.38], [-0.39, 0.41], [0, 0.39]] },

            // 15. Roof (Primary)
            { color: pColor, points: [[0, 0.52], [-0.38, 0.50], [-0.35, 0.70], [0, 0.72]] },

            // 16. Rear Window (Dark Tint)
            { color: '#1a1a1a', points: [[0, 0.72], [-0.35, 0.70], [-0.3, 0.85], [0, 0.88]] },

            // 17. Rear Window Louvers (Black)
            { color: '#050505', points: [[0, 0.74], [-0.34, 0.72], [-0.33, 0.73], [0, 0.75]] },
            { color: '#050505', points: [[0, 0.78], [-0.32, 0.76], [-0.31, 0.77], [0, 0.79]] },
            { color: '#050505', points: [[0, 0.82], [-0.31, 0.80], [-0.30, 0.81], [0, 0.83]] },
            { color: '#050505', points: [[0, 0.86], [-0.30, 0.84], [-0.29, 0.85], [0, 0.87]] },

            // 18. Rear Trunk / Decklid (Primary)
            { color: pColor, points: [[0, 0.88], [-0.3, 0.85], [-0.48, 0.92], [0, 0.95]] },

            // 19. Rear Diffuser (Carbon/Black)
            { color: '#151515', points: [[0, 0.95], [-0.7, 0.92], [-0.7, 0.99], [0, 0.99]] },

            // 20. Rear Wing Struts (Black)
            { color: '#0a0a0a', points: [[-0.3, 0.88], [-0.35, 0.88], [-0.35, 0.97], [-0.3, 0.97]] },

            // 21. Massive Rear Wing (Carbon/Black)
            { color: '#111111', points: [[0, 0.93], [-0.85, 0.93], [-0.85, 0.98], [0, 0.98]] },

            // 22. Rear Wing Endplates (Secondary for accent)
            { color: sColor, points: [[-0.82, 0.86], [-0.88, 0.86], [-0.88, 1.0], [-0.82, 1.0]] },

            // 23. Front Splitter Support Rods (Silver)
            { color: '#dddddd', points: [[-0.2, 0.05], [-0.22, 0.05], [-0.22, 0.09], [-0.2, 0.09]] },
            { color: '#dddddd', points: [[-0.4, 0.04], [-0.42, 0.04], [-0.42, 0.08], [-0.4, 0.08]] },

            // 24. Front Splitter Edge Trim (Secondary)
            { color: sColor, points: [[0, 0.015], [-0.74, 0.015], [-0.74, 0.025], [0, 0.025]] },

            // 25. Side Skirt Aero Trim (Secondary)
            { color: sColor, points: [[-0.60, 0.36], [-0.63, 0.36], [-0.63, 0.69], [-0.60, 0.69]] },

            // 26. Roof Racing Stripes (Secondary)
            { color: sColor, points: [[-0.08, 0.52], [-0.18, 0.52], [-0.16, 0.70], [-0.08, 0.71]] },

            // 27. Trunk Racing Stripes (Secondary)
            { color: sColor, points: [[-0.08, 0.87], [-0.16, 0.86], [-0.22, 0.93], [-0.08, 0.94]] }
        ];

        leftShapes.forEach(shape => {
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            ctx.moveTo(centerX + shape.points[0][0] * dw, y + shape.points[0][1] * h);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(centerX + shape.points[i][0] * dw, y + shape.points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(centerX - shape.points[0][0] * dw, y + shape.points[0][1] * h);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(centerX - shape.points[i][0] * dw, y + shape.points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // --- REALISM OVERLAYS ---

        // Window Reflections (Glossy diagonal shines)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        // Windshield shine
        ctx.moveTo(centerX - 0.05 * dw, y + 0.36 * h);
        ctx.lineTo(centerX - 0.25 * dw, y + 0.38 * h);
        ctx.lineTo(centerX - 0.15 * dw, y + 0.48 * h);
        ctx.lineTo(centerX - 0.02 * dw, y + 0.48 * h);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX + 0.05 * dw, y + 0.36 * h);
        ctx.lineTo(centerX + 0.25 * dw, y + 0.38 * h);
        ctx.lineTo(centerX + 0.15 * dw, y + 0.48 * h);
        ctx.lineTo(centerX + 0.02 * dw, y + 0.48 * h);
        ctx.fill();

        // Rear window shine
        ctx.beginPath();
        ctx.moveTo(centerX - 0.05 * dw, y + 0.73 * h);
        ctx.lineTo(centerX - 0.25 * dw, y + 0.72 * h);
        ctx.lineTo(centerX - 0.15 * dw, y + 0.82 * h);
        ctx.lineTo(centerX - 0.02 * dw, y + 0.82 * h);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX + 0.05 * dw, y + 0.73 * h);
        ctx.lineTo(centerX + 0.25 * dw, y + 0.72 * h);
        ctx.lineTo(centerX + 0.15 * dw, y + 0.82 * h);
        ctx.lineTo(centerX + 0.02 * dw, y + 0.82 * h);
        ctx.fill();

        // Body Edge Highlights (To give 3D depth to the widebody)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Left front fender shine
        ctx.moveTo(centerX - 0.4 * dw, y + 0.08 * h);
        ctx.lineTo(centerX - 0.7 * dw, y + 0.1 * h);
        ctx.lineTo(centerX - 0.8 * dw, y + 0.2 * h);
        // Right front fender shine
        ctx.moveTo(centerX + 0.4 * dw, y + 0.08 * h);
        ctx.lineTo(centerX + 0.7 * dw, y + 0.1 * h);
        ctx.lineTo(centerX + 0.8 * dw, y + 0.2 * h);
        ctx.stroke();

        ctx.beginPath();
        // Left rear fender shine
        ctx.moveTo(centerX - 0.55 * dw, y + 0.65 * h);
        ctx.lineTo(centerX - 0.75 * dw, y + 0.68 * h);
        ctx.lineTo(centerX - 0.85 * dw, y + 0.8 * h);
        // Right rear fender shine
        ctx.moveTo(centerX + 0.55 * dw, y + 0.65 * h);
        ctx.lineTo(centerX + 0.75 * dw, y + 0.68 * h);
        ctx.lineTo(centerX + 0.85 * dw, y + 0.8 * h);
        ctx.stroke();

        // Carbon Fiber Splitter and Wing Highlights (Dark shine)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(centerX - 0.7 * dw, y + 0.025 * h, 1.4 * dw, 0.015 * h);
        ctx.fillRect(centerX - 0.8 * dw, y + 0.94 * h, 1.6 * dw, 0.015 * h);

        // Bolted-on Fender Rivets (Small silver dots)
        ctx.fillStyle = '#cccccc';
        const rivetPoints = [
            [-0.45, 0.07], [-0.6, 0.075], [-0.65, 0.085], [-0.75, 0.11], [-0.82, 0.15], [-0.85, 0.2], [-0.82, 0.25], [-0.75, 0.3], [-0.65, 0.33], [-0.6, 0.34],
            [-0.58, 0.65], [-0.65, 0.66], [-0.7, 0.68], [-0.8, 0.72], [-0.88, 0.8], [-0.86, 0.86], [-0.8, 0.9], [-0.7, 0.91], [-0.65, 0.915]
        ];

        ctx.beginPath();
        rivetPoints.forEach(pt => {
            // Left rivet
            ctx.moveTo(centerX + pt[0] * dw, y + pt[1] * h);
            ctx.arc(centerX + pt[0] * dw, y + pt[1] * h, 1, 0, Math.PI * 2);
            // Right rivet
            ctx.moveTo(centerX - pt[0] * dw, y + pt[1] * h);
            ctx.arc(centerX - pt[0] * dw, y + pt[1] * h, 1, 0, Math.PI * 2);
        });
        ctx.fill();

        // Engine/Hood Vent Depth (Shadows inside vents)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        // Center vent shadow
        ctx.fillRect(centerX - 0.2 * dw, y + 0.12 * h, 0.4 * dw, 0.02 * h);

        // Exhaust holes (Deep black center on the side exhausts)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 0.61 * dw, y + 0.68 * h, 2, 0, Math.PI * 2);
        ctx.arc(centerX - 0.61 * dw, y + 0.65 * h, 2, 0, Math.PI * 2);
        ctx.arc(centerX + 0.61 * dw, y + 0.68 * h, 2, 0, Math.PI * 2);
        ctx.arc(centerX + 0.61 * dw, y + 0.65 * h, 2, 0, Math.PI * 2);
        ctx.fill();

    } else if (chassis === 'phantom') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'square';
        ctx.strokeStyle = '#000000';

        // Helper to draw a symmetric left+right shape
        const drawSym = (color, pts) => {
            // Left
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(centerX + pts[0][0] * dw, y + pts[0][1] * h);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(centerX + pts[i][0] * dw, y + pts[i][1] * h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Right (mirror)
            ctx.beginPath();
            ctx.moveTo(centerX - pts[0][0] * dw, y + pts[0][1] * h);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(centerX - pts[i][0] * dw, y + pts[i][1] * h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // ── LAYER 1: Upper Orange Backing ──
        drawSym(sColor, [
            [-0.15, 0.12], [-0.38, 0.16], [-0.38, 0.25], [-0.18, 0.24]
        ]);

        // ── LAYER 2: Black Wing Gaps (Top) ──
        drawSym('#000000', [
            [-0.38, 0.24], [-0.52, 0.27], [-0.48, 0.35], [-0.32, 0.32]
        ]);

        // ── LAYER 3: Outer Green Horns (Top wings) ──
        drawSym(pColor, [
            [-0.55, 0.45], [-0.80, 0.16], [-0.70, 0.05], [-0.50, 0.05], [-0.38, 0.12], [-0.56, 0.25], [-0.55, 0.45]
        ]);

        // ── LAYER 3.5: Orange Armor Inserts on Horns ──
        drawSym(sColor, [
            [-0.52, 0.38], [-0.74, 0.18], [-0.66, 0.09], [-0.54, 0.09], [-0.46, 0.15], [-0.54, 0.25]
        ]);

        // ── LAYER 3.8: Blaster Cannons ──
        drawSym('#4f5d65', [
            [-0.62, 0.05], [-0.62, 0.01], [-0.58, 0.01], [-0.58, 0.05]
        ]);
        drawSym('#ff3b30', [
            [-0.61, 0.01], [-0.61, -0.005], [-0.59, -0.005], [-0.59, 0.01]
        ]);

        // ── LAYER 4: Lower Side Black Gaps/Thrusters (Wider) ──
        drawSym('#000000', [
            [-0.42, 0.72], [-0.68, 0.74], [-0.68, 0.84], [-0.42, 0.8]
        ]);

        // ── LAYER 5: Lower Orange Wing Panels (Wider) ──
        drawSym(sColor, [
            [-0.42, 0.58], [-0.78, 0.58], [-0.78, 0.85], [-0.42, 0.8]
        ]);

        // ── LAYER 5.5: Heat Vent Slits on Orange Wing Panels ──
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        // Left side vents
        ctx.moveTo(centerX - dw * 0.5, y + 0.64 * h);
        ctx.lineTo(centerX - dw * 0.72, y + 0.64 * h);
        ctx.moveTo(centerX - dw * 0.5, y + 0.70 * h);
        ctx.lineTo(centerX - dw * 0.72, y + 0.70 * h);
        ctx.moveTo(centerX - dw * 0.5, y + 0.76 * h);
        ctx.lineTo(centerX - dw * 0.72, y + 0.76 * h);
        // Right side vents
        ctx.moveTo(centerX + dw * 0.5, y + 0.64 * h);
        ctx.lineTo(centerX + dw * 0.72, y + 0.64 * h);
        ctx.moveTo(centerX + dw * 0.5, y + 0.70 * h);
        ctx.lineTo(centerX + dw * 0.72, y + 0.70 * h);
        ctx.moveTo(centerX + dw * 0.5, y + 0.76 * h);
        ctx.lineTo(centerX + dw * 0.72, y + 0.76 * h);
        ctx.stroke();

        // ── LAYER 5.8: Metallic Rear Exhaust Nozzles ──
        // Center Nozzle
        ctx.fillStyle = '#4f5d65';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.rect(centerX - dw * 0.08, y + 0.78 * h, dw * 0.16, h * 0.08);
        ctx.fill();
        ctx.stroke();
        // Left Nozzle
        ctx.beginPath();
        ctx.rect(centerX - dw * 0.32, y + 0.78 * h, dw * 0.12, h * 0.07);
        ctx.fill();
        ctx.stroke();
        // Right Nozzle
        ctx.beginPath();
        ctx.rect(centerX + dw * 0.20, y + 0.78 * h, dw * 0.12, h * 0.07);
        ctx.fill();
        ctx.stroke();

        // ── LAYER 6: Lower Green Outer Fins (Wider + Double Winglet stabilizer) ──
        drawSym(pColor, [
            [-0.62, 0.58], [-0.78, 0.58], [-0.92, 0.74], [-0.92, 0.94], [-0.72, 0.92], [-0.72, 0.85], [-0.52, 0.8]
        ]);

        // ── LAYER 7: Orange Rear Chevron / V-bracket (Wider) ──
        drawSym(sColor, [
            [0, 0.8], [-0.38, 0.86], [-0.72, 0.85], [-0.72, 0.92], [-0.38, 0.92], [0, 0.84]
        ]);

        // ── LAYER 8: Green Central Fuselage Nose & Body ──
        drawSym(pColor, [
            [0, 0.06], [-0.20, 0.12], [-0.24, 0.28], [-0.32, 0.45], [-0.42, 0.58], [-0.42, 0.8], [0, 0.82]
        ]);

        // ── LAYER 8.5: Nose Intakes / Nostrils ──
        drawSym('#000000', [
            [-0.03, 0.18], [-0.07, 0.22], [-0.03, 0.24]
        ]);

        // ── LAYER 9: Large Upper Blue Canopy ──
        drawSym('#7a9ebf', [
            [0, 0.16], [-0.20, 0.28], [-0.34, 0.42], [-0.22, 0.52], [0, 0.56]
        ]);

        // ── LAYER 9.5: Canopy Reflection Shine ──
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(centerX - dw * 0.02, y + 0.2 * h);
        ctx.lineTo(centerX - dw * 0.18, y + 0.32 * h);
        ctx.lineTo(centerX - dw * 0.24, y + 0.42 * h);
        ctx.lineTo(centerX - dw * 0.16, y + 0.42 * h);
        ctx.lineTo(centerX - dw * 0.08, y + 0.32 * h);
        ctx.lineTo(centerX - dw * 0.01, y + 0.22 * h);
        ctx.closePath();
        ctx.fill();

        // ── LAYER 10: Green Inner Cowl / Loop ──
        drawSym(pColor, [
            [0, 0.38], [-0.15, 0.46], [-0.18, 0.65], [-0.08, 0.8], [0, 0.82]
        ]);

        // ── LAYER 11: Lower Blue Canopy ──
        drawSym('#7a9ebf', [
            [0, 0.45], [-0.08, 0.52], [-0.08, 0.58], [0, 0.62]
        ]);

        // ── LAYER 11.5: Glowing Energy Conduits ──
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        // Left conduit
        ctx.moveTo(centerX - dw * 0.28, y + 0.46 * h);
        ctx.lineTo(centerX - dw * 0.36, y + 0.54 * h);
        ctx.lineTo(centerX - dw * 0.36, y + 0.72 * h);
        // Right conduit
        ctx.moveTo(centerX + dw * 0.28, y + 0.46 * h);
        ctx.lineTo(centerX + dw * 0.36, y + 0.54 * h);
        ctx.lineTo(centerX + dw * 0.36, y + 0.72 * h);
        ctx.stroke();

        // ── LAYER 12: Central Black Slot ──
        drawSym('#000000', [
            [0, 0.62], [-0.04, 0.62], [-0.04, 0.77], [0, 0.77]
        ]);

        // ── LAYER 13: Yellow Slanted Stripes ──
        drawSym('#ffe600', [
            [-0.04, 0.65], [-0.05, 0.65], [-0.07, 0.76], [-0.05, 0.76]
        ]);

        // ── Center keel line ──
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(centerX, y + 0.06 * h);
        ctx.lineTo(centerX, y + 0.94 * h);
        ctx.stroke();

    } // end phantom chassis
    else if (chassis === 'cyber') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 1.0;
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#050505';

        const drawSym = (color, points) => {
            ctx.fillStyle = color;
            // Left Side
            ctx.beginPath();
            ctx.moveTo(centerX + points[0][0] * dw, y + points[0][1] * h);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(centerX + points[i][0] * dw, y + points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // Right Side
            ctx.beginPath();
            ctx.moveTo(centerX - points[0][0] * dw, y + points[0][1] * h);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(centerX - points[i][0] * dw, y + points[i][1] * h);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        };

        // 1. Lower Floor/Diffuser (Dark)
        drawSym('#151515', [[0, 0.85], [-0.65, 0.85], [-0.75, 0.98], [0, 0.98]]);

        // 2. Wheels (Dark Grey with silver lines)
        // Rear Wheels
        drawSym('#151515', [[-0.68, 0.72], [-0.98, 0.72], [-0.98, 0.94], [-0.68, 0.94]]);
        // Rear Wheel rims
        drawSym('#444', [[-0.75, 0.75], [-0.9, 0.75], [-0.9, 0.91], [-0.75, 0.91]]);

        // Front Wheels
        drawSym('#151515', [[-0.62, 0.18], [-0.88, 0.18], [-0.88, 0.35], [-0.62, 0.35]]);
        // Front Wheel rims
        drawSym('#444', [[-0.68, 0.21], [-0.82, 0.21], [-0.82, 0.32], [-0.68, 0.32]]);

        // 3. Rear Suspension (Dark)
        drawSym('#222', [[-0.2, 0.78], [-0.68, 0.75], [-0.68, 0.8], [-0.2, 0.82]]);
        drawSym('#333', [[-0.2, 0.85], [-0.68, 0.83], [-0.68, 0.86], [-0.2, 0.88]]);

        // 4. Front Suspension (Dark)
        drawSym('#222', [[-0.15, 0.25], [-0.62, 0.22], [-0.62, 0.26], [-0.15, 0.29]]);
        drawSym('#333', [[-0.15, 0.32], [-0.62, 0.29], [-0.62, 0.33], [-0.15, 0.35]]);

        // 5. Main Rear Wing (Primary)
        drawSym(pColor, [[0, 0.9], [-0.8, 0.9], [-0.85, 0.98], [0, 0.98]]);
        // Rear Wing Decals (White)
        drawSym('#ffffff', [[-0.2, 0.92], [-0.7, 0.92], [-0.7, 0.96], [-0.2, 0.96]]);

        // 6. Rear Wing Endplates (Secondary - Yellow)
        drawSym(sColor, [[-0.82, 0.86], [-0.9, 0.86], [-0.95, 1.0], [-0.85, 1.0]]);

        // 7. Sidepods (Primary - Grey)
        drawSym(pColor, [
            [-0.2, 0.36], [-0.7, 0.46], [-0.7, 0.52], [-0.82, 0.65],
            [-0.8, 0.72], [-0.4, 0.75], [-0.2, 0.78]
        ]);

        // 8. Sidepod Aero Vanes / Intakes (Black/Dark)
        drawSym('#111', [[-0.2, 0.35], [-0.7, 0.38], [-0.7, 0.46], [-0.2, 0.42]]);

        // 9. Sidepod Accents / Lines (Secondary - Yellow)
        drawSym(sColor, [[-0.65, 0.44], [-0.68, 0.46], [-0.8, 0.64], [-0.76, 0.64]]);
        drawSym(sColor, [[-0.3, 0.7], [-0.5, 0.72], [-0.48, 0.74], [-0.28, 0.72]]);
        drawSym(sColor, [[-0.25, 0.38], [-0.6, 0.42], [-0.58, 0.44], [-0.25, 0.4]]);

        // 10. Front Wing (Primary)
        drawSym(pColor, [
            [0, 0.04], [-0.78, 0.07], [-0.78, 0.16], [-0.5, 0.16],
            [-0.3, 0.12], [-0.15, 0.14], [0, 0.14]
        ]);

        // 11. Front Wing Elements (Secondary - Yellow)
        drawSym(sColor, [[-0.65, 0.05], [-0.8, 0.05], [-0.82, 0.17], [-0.75, 0.17]]);
        drawSym(sColor, [[-0.2, 0.08], [-0.5, 0.1], [-0.48, 0.12], [-0.2, 0.1]]);

        // 12. Central Hull (Primary)
        drawSym(pColor, [
            [0, 0.02], [-0.12, 0.06], [-0.16, 0.28], [-0.25, 0.4],
            [-0.25, 0.65], [-0.18, 0.75], [-0.18, 0.88], [0, 0.9]
        ]);

        // 13. Central Spine / Nose Details (Secondary)
        drawSym(sColor, [[0, 0.15], [-0.08, 0.22], [-0.08, 0.42], [0, 0.45]]);
        drawSym(sColor, [[0, 0.6], [-0.12, 0.65], [-0.08, 0.85], [0, 0.86]]);

        // 14. White details on sidepods
        drawSym('#ffffff', [[-0.6, 0.52], [-0.64, 0.52], [-0.66, 0.62], [-0.62, 0.62]]);
        drawSym('#ffffff', [[-0.55, 0.54], [-0.57, 0.54], [-0.58, 0.6], [-0.56, 0.6]]);

        // 15. Cockpit area
        // Outer rim
        drawSym('#111', [[0, 0.42], [-0.18, 0.48], [-0.18, 0.62], [0, 0.68]]);
        // Seat/Inner
        drawSym('#ff4400', [[0, 0.46], [-0.12, 0.52], [-0.12, 0.58], [0, 0.62]]);
        // Headrest
        drawSym('#111', [[0, 0.58], [-0.08, 0.6], [-0.08, 0.65], [0, 0.65]]);
        // Halo (Primary)
        drawSym(pColor, [[0, 0.46], [-0.05, 0.48], [-0.14, 0.52], [-0.14, 0.54], [0, 0.5]]);

        // Center Split Line
        ctx.beginPath();
        ctx.moveTo(centerX, y + 0.02 * h);
        ctx.lineTo(centerX, y + 0.98 * h);
        ctx.stroke();

    } // end cyber chassis
    else if (chassis === 'aerowing') {
        const centerX = x + w / 2;
        const dw = w / 2;

        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#000000';

        const drawSym = (color, pts) => {
            // Left
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(centerX + pts[0][0] * dw, y + pts[0][1] * h);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(centerX + pts[i][0] * dw, y + pts[i][1] * h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Right
            ctx.beginPath();
            ctx.moveTo(centerX - pts[0][0] * dw, y + pts[0][1] * h);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(centerX - pts[i][0] * dw, y + pts[i][1] * h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // 1. Lower chassis base (Dark grey/black)
        drawSym('#151515', [
            [0, 0.05], [-0.4, 0.1], [-0.8, 0.3], [-0.8, 0.8], [-0.5, 0.95], [0, 0.98]
        ]);

        // 2. Rear angled side skirts (Dark grey)
        drawSym('#222222', [
            [-0.5, 0.6], [-0.8, 0.65], [-0.85, 0.85], [-0.5, 0.9]
        ]);

        // 3. Central main hull (Primary)
        drawSym(pColor, [
            [0, 0.02], [-0.15, 0.05], [-0.25, 0.2], [-0.3, 0.4], [-0.28, 0.7], [-0.15, 0.95], [0, 0.98]
        ]);

        // 4. Nose accent panels (Yellow/Secondary)
        drawSym(sColor, [
            [-0.15, 0.05], [-0.25, 0.15], [-0.18, 0.25], [-0.08, 0.18]
        ]);

        // 5. Massive Forward Swept Black Pontoons (Black)
        drawSym('#111111', [
            [-0.25, 0.2], [-0.5, 0.08], [-0.7, 0.15], [-0.8, 0.35], [-0.5, 0.5], [-0.3, 0.4]
        ]);

        // 6. Glowing Vents inside the Black Pontoons (Blue)
        drawSym('#00f3ff', [
            [-0.45, 0.18], [-0.55, 0.22], [-0.6, 0.28], [-0.5, 0.24]
        ]);

        // 7. Middle side wings (Secondary / Yellow)
        drawSym(sColor, [
            [-0.5, 0.5], [-0.95, 0.45], [-0.9, 0.6], [-0.5, 0.6]
        ]);
        // Red accent circle on yellow wings
        ctx.fillStyle = '#d92e2e';
        ctx.beginPath();
        ctx.arc(centerX - 0.75 * dw, y + 0.52 * h, 0.03 * dw, 0, Math.PI * 2);
        ctx.arc(centerX + 0.75 * dw, y + 0.52 * h, 0.03 * dw, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // 8. Rear sharp winglets (Primary)
        drawSym(pColor, [
            [-0.5, 0.65], [-0.85, 0.75], [-0.8, 0.9], [-0.5, 0.85]
        ]);
        // Yellow tips on rear winglets
        drawSym(sColor, [
            [-0.8, 0.85], [-0.85, 0.75], [-0.9, 0.95], [-0.8, 0.9]
        ]);

        // 9. Central Canopy (Glossy Black)
        drawSym('#0a0a0a', [
            [0, 0.28], [-0.18, 0.4], [-0.2, 0.65], [-0.12, 0.75], [0, 0.78]
        ]);
        // Canopy Reflection
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(centerX - 0.02 * dw, y + 0.3 * h);
        ctx.lineTo(centerX - 0.12 * dw, y + 0.4 * h);
        ctx.lineTo(centerX - 0.1 * dw, y + 0.6 * h);
        ctx.lineTo(centerX - 0.02 * dw, y + 0.72 * h);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + 0.02 * dw, y + 0.3 * h);
        ctx.lineTo(centerX + 0.12 * dw, y + 0.4 * h);
        ctx.lineTo(centerX + 0.1 * dw, y + 0.6 * h);
        ctx.lineTo(centerX + 0.02 * dw, y + 0.72 * h);
        ctx.fill();

        // 10. Canopy HUD details (Green & Red lines)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(centerX - 0.1 * dw, y + 0.45 * h);
        ctx.lineTo(centerX - 0.15 * dw, y + 0.5 * h);
        ctx.lineTo(centerX - 0.1 * dw, y + 0.55 * h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX + 0.1 * dw, y + 0.45 * h);
        ctx.lineTo(centerX + 0.15 * dw, y + 0.5 * h);
        ctx.lineTo(centerX + 0.1 * dw, y + 0.55 * h);
        ctx.stroke();

        ctx.strokeStyle = '#ff003c';
        ctx.beginPath();
        ctx.moveTo(centerX - 0.15 * dw, y + 0.68 * h);
        ctx.lineTo(centerX - 0.2 * dw, y + 0.72 * h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX + 0.15 * dw, y + 0.68 * h);
        ctx.lineTo(centerX + 0.2 * dw, y + 0.72 * h);
        ctx.stroke();
        ctx.strokeStyle = '#000';

        // 11. White "100" side decals
        drawSym('#ffffff', [
            [-0.15, 0.72], [-0.22, 0.74], [-0.22, 0.82], [-0.15, 0.8]
        ]);

        // 12. Rear central spine/exhaust cover (Dark Grey)
        drawSym('#2a2a2a', [
            [0, 0.78], [-0.1, 0.8], [-0.15, 0.95], [0, 0.98]
        ]);

        // 13. Turbine engines embedded on the sides
        const turbX = centerX - 0.4 * dw;
        const turbY = y + 0.65 * h;
        const turbX2 = centerX + 0.4 * dw;

        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(turbX, turbY, 0.1 * dw, 0, Math.PI * 2);
        ctx.arc(turbX2, turbY, 0.1 * dw, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(turbX, turbY, 0.05 * dw, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(turbX2, turbY, 0.05 * dw, 0, Math.PI * 2);
        ctx.stroke();

        // 14. Inner turbine fan lines
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            let angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(turbX, turbY);
            ctx.lineTo(turbX + Math.cos(angle) * 0.08 * dw, turbY + Math.sin(angle) * 0.08 * dw);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(turbX2, turbY);
            ctx.lineTo(turbX2 + Math.cos(angle) * 0.08 * dw, turbY + Math.sin(angle) * 0.08 * dw);
            ctx.stroke();
        }

        // 15. White panel separation highlights
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(centerX - 0.3 * dw, y + 0.4 * h);
        ctx.lineTo(centerX - 0.25 * dw, y + 0.2 * h);
        ctx.moveTo(centerX + 0.3 * dw, y + 0.4 * h);
        ctx.lineTo(centerX + 0.25 * dw, y + 0.2 * h);
        ctx.stroke();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
    } // end aerowing chassis

    // --- ADVANCED THRUSTER SYSTEM ---
    const timeNow = Date.now();
    const flicker = Math.sin(timeNow / 50) * 0.1;
    const pulse = 1 + Math.sin(timeNow / 100) * 0.2 + flicker;
    const jetH = h * 0.15 * pulse;

    ctx.save();

    if (chassis === 'hotrod') {
        // REAR DEEP BURNOUT
        drawEnhancedJet(x + w * 0.5, y + h * 1.0, w * 0.15, jetH * 1.5, '#00f3ff', '#fff');
    } else if (chassis === 'striker') {
        // REAR WHEEL JETS (Massive thrust from the central column and base)
        drawEnhancedJet(x + w * 0.5, y + h * 0.95, w * 0.1, jetH * 1.5, '#ff4400', '#ffcc00'); // Center Pillar
    } else if (chassis === 'phantom') {
        // PHANTOM: Triple plasma jets - two wing pods + central
        drawEnhancedJet(x + w * 0.30, y + h * 0.88, w * 0.12, jetH * 1.3, '#ffe600', '#ffffff');
        drawEnhancedJet(x + w * 0.5, y + h * 0.93, w * 0.10, jetH * 1.6, '#00f3ff', '#ffffff');
        drawEnhancedJet(x + w * 0.70, y + h * 0.88, w * 0.12, jetH * 1.3, '#ffe600', '#ffffff');
    } else if (chassis === 'cyber') {
        // CYBER: Wide triple array thrust
        drawEnhancedJet(x + w * 0.35, y + h * 0.9, w * 0.12, jetH * 1.4, '#ffaa00', '#ffffff');
        drawEnhancedJet(x + w * 0.65, y + h * 0.9, w * 0.12, jetH * 1.4, '#ffaa00', '#ffffff');
        drawEnhancedJet(x + w * 0.5, y + h * 0.95, w * 0.15, jetH * 1.6, '#ffaa00', '#ffffff');
    } else if (chassis === 'aerowing') {
        // AEROWING: Double main jets + side turbine trails
        drawEnhancedJet(x + w * 0.4, y + h * 0.95, w * 0.15, jetH * 1.5, '#ff4400', '#ffcc00');
        drawEnhancedJet(x + w * 0.6, y + h * 0.95, w * 0.15, jetH * 1.5, '#ff4400', '#ffcc00');
        drawEnhancedJet(x + w * 0.15, y + h * 0.9, w * 0.08, jetH * 0.8, '#00f3ff', '#ffffff');
        drawEnhancedJet(x + w * 0.85, y + h * 0.9, w * 0.08, jetH * 0.8, '#00f3ff', '#ffffff');
    } else {
        // DEFAULT DUAL JETS
        drawEnhancedJet(x + w * 0.375, y + h * 0.95, w * 0.18, jetH, '#00f3ff', '#ffffff');
        drawEnhancedJet(x + w * 0.625, y + h * 0.95, w * 0.18, jetH, '#00f3ff', '#ffffff');
    }

    ctx.restore();
    ctx.restore();
}

/**
 * Enhanced Multi-Layered Jet Effect
 */
function drawEnhancedJet(cx, cy, width, height, outerColor, innerColor) {
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = outerColor;

    // 1. Outer Flame (Wide & Faded)
    ctx.fillStyle = outerColor;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - width / 1.5, cy);
    ctx.lineTo(cx + width / 1.5, cy);
    ctx.lineTo(cx, cy + height * 1.4);
    ctx.fill();

    // 2. Core Flame (Tapered)
    ctx.globalAlpha = 0.8;
    const grad = ctx.createLinearGradient(cx, cy, cx, cy + height);
    grad.addColorStop(0, outerColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - width / 2, cy);
    ctx.lineTo(cx + width / 2, cy);
    ctx.lineTo(cx, cy + height);
    ctx.fill();

    // 3. Inner Plasma Core (Hot Point)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = innerColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = innerColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * 0.3, width * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Heat Spike
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.15, cy);
    ctx.lineTo(cx + width * 0.15, cy);
    ctx.lineTo(cx, cy + height * 0.4);
    ctx.fill();

    ctx.restore();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

function drawCar(x, y, w, h, color, blinkerSide = null, blinkerOn = false) {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';

    const centerX = x + w / 2;

    // 1. NPC Chassis (Sleek Heavy Industrial)
    ctx.fillStyle = '#1c2229'; // Dark base
    ctx.beginPath();
    ctx.moveTo(centerX - w * 0.35, y);
    ctx.lineTo(centerX + w * 0.35, y);
    ctx.lineTo(centerX + w * 0.48, y + h * 0.15);
    ctx.lineTo(centerX + w * 0.48, y + h * 0.85);
    ctx.lineTo(centerX + w * 0.35, y + h);
    ctx.lineTo(centerX - w * 0.35, y + h);
    ctx.lineTo(centerX - w * 0.48, y + h * 0.85);
    ctx.lineTo(centerX - w * 0.48, y + h * 0.15);
    ctx.closePath();
    ctx.fill();

    // Colored Secondary Accent Stripe
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Armored Windshield (Top-down view cockpit)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(centerX - w * 0.28, y + h * 0.2);
    ctx.lineTo(centerX + w * 0.28, y + h * 0.2);
    ctx.lineTo(centerX + w * 0.22, y + h * 0.45);
    ctx.lineTo(centerX - w * 0.22, y + h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Technical Indentations (Industrial feel)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(centerX - w * 0.15, y + h * 0.6, w * 0.3, h * 0.2);

    // 4. Heavy Wheel/Engine Pods
    ctx.fillStyle = '#0a0a0a';
    // Front Pods
    ctx.fillRect(x - 2, y + h * 0.1, w * 0.15, h * 0.22);
    ctx.fillRect(x + w - w * 0.15 + 2, y + h * 0.1, w * 0.15, h * 0.22);
    // Rear Pods
    ctx.fillRect(x - 2, y + h * 0.68, w * 0.15, h * 0.22);
    ctx.fillRect(x + w - w * 0.15 + 2, y + h * 0.68, w * 0.15, h * 0.22);

    // 5. Active Optics (Headlights)
    ctx.fillStyle = '#f0f0f0';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#fff';
    ctx.fillRect(centerX - w * 0.4, y + 2, w * 0.2, 3);
    ctx.fillRect(centerX + w * 0.2, y + 2, w * 0.2, 3);

    // 6. Signal Units (Taillights)
    ctx.fillStyle = '#cc2200';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff0000';
    ctx.fillRect(centerX - w * 0.35, y + h - 5, w * 0.25, 3);
    ctx.fillRect(centerX + w * 0.1, y + h - 5, w * 0.25, 3);

    // 7. Active Blinkers
    if (blinkerSide && blinkerOn) {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffaa00';
        if (blinkerSide === 'left') {
            ctx.fillRect(x - 5, y + h * 0.1, 6, 12);
            ctx.fillRect(x - 5, y + h * 0.8, 6, 12);
        } else {
            ctx.fillRect(x + w - 1, y + h * 0.1, 6, 12);
            ctx.fillRect(x + w - 1, y + h * 0.8, 6, 12);
        }
    }

    ctx.restore();
}

function getRandomAegisColor() {
    const colors = [
        '#556b2f', '#cc5500', '#708090', '#e1ad01', '#f5f5dc', '#e2725b',
        '#1a2a30', '#8c9c84', '#9e7b7b', '#2a2a2a', '#b87333', '#4682b4', '#d32f2f'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ─── Road Hazard System ──────────────────────────────────────────────────────
function spawnHazard() {
    const types = ['oil', 'cone', 'laser', 'life'];
    let type = types[Math.floor(Math.random() * (types.length - 1))]; // mostly hazards

    // 8% chance for a life powerup
    if (Math.random() < 0.08) type = 'life';

    let lane = Math.floor(Math.random() * road.laneCount);

    let hw = 70, hh = 20; // default hitbox
    if (type === 'cone') { hw = 22; hh = 30; }
    if (type === 'oil') { hw = 80; hh = 40; }
    if (type === 'life') { hw = 40; hh = 40; }
    if (type === 'laser') {
        const lanesSpan = Math.random() < 0.5 ? 2 : 3;
        if (lane + lanesSpan > road.laneCount) lane = road.laneCount - lanesSpan;
        hw = lanesSpan * road.laneWidth;
        hh = 10;
    }

    const cx = road.x + lane * road.laneWidth + hw / 2;

    hazards.push({
        type,
        x: road.x + lane * road.laneWidth, // Position starting from left edge of lane
        y: -80,
        width: hw,
        height: hh,
        lane,
        animT: 0
    });

    // Fix X position for non-laser hazards (center in lane)
    if (type !== 'laser') {
        hazards[hazards.length - 1].x = (road.x + lane * road.laneWidth + road.laneWidth / 2) - hw / 2;
    }
}

function drawHazards() {
    for (const h of hazards) {
        const cx = h.x + h.width / 2;
        const cy = h.y + h.height / 2;

        if (h.type === 'oil') {
            // Rainbow shimmer ellipse
            ctx.save();
            const shimmer = ctx.createRadialGradient(cx, cy, 2, cx, cy, h.width * 0.6);
            shimmer.addColorStop(0, `hsla(${(h.animT * 120) % 360},100%,60%,0.55)`);
            shimmer.addColorStop(0.5, `hsla(${(h.animT * 120 + 120) % 360},100%,50%,0.35)`);
            shimmer.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = shimmer;
            ctx.beginPath();
            ctx.ellipse(cx, cy, h.width * 0.6, h.height * 0.9, 0, 0, Math.PI * 2);
            ctx.fill();
            // label
            ctx.font = '10px Outfit,monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.textAlign = 'center';
            ctx.fillText('OIL', cx, cy + 3);
            ctx.restore();


        } else if (h.type === 'cone') {
            // Traffic cone
            ctx.save();
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(cx, h.y + h.height + 4, h.width * 0.45, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            // Orange cone body
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.moveTo(cx, h.y);                                    // tip
            ctx.lineTo(cx + h.width / 2, h.y + h.height);           // bottom-right
            ctx.lineTo(cx - h.width / 2, h.y + h.height);           // bottom-left
            ctx.closePath();
            ctx.fill();
            // White stripe
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(cx - h.width * 0.18, h.y + h.height * 0.45);
            ctx.lineTo(cx + h.width * 0.18, h.y + h.height * 0.45);
            ctx.lineTo(cx + h.width * 0.28, h.y + h.height * 0.62);
            ctx.lineTo(cx - h.width * 0.28, h.y + h.height * 0.62);
            ctx.closePath();
            ctx.fill();
            // Black outline
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, h.y);
            ctx.lineTo(cx + h.width / 2, h.y + h.height);
            ctx.lineTo(cx - h.width / 2, h.y + h.height);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        } else if (h.type === 'laser') {
            ctx.save();
            ctx.fillStyle = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0055';
            ctx.fillRect(h.x, cy - 2, h.width, 4);

            // End posts
            ctx.fillStyle = '#222';
            ctx.shadowBlur = 0;
            ctx.fillRect(h.x - 10, h.y - 10, 20, 30);
            ctx.fillRect(h.x + h.width - 10, h.y - 10, 20, 30);

            // Post lights
            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            ctx.arc(h.x, h.y + 5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(h.x + h.width, h.y + 5, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } else if (h.type === 'life') {
            // Repair Core / Life Powerup
            ctx.save();
            ctx.translate(cx, cy);
            const scale = 1 + Math.sin(h.animT * 4) * 0.1;
            ctx.scale(scale, scale);

            // Tactical Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f3ff';

            // Diamond / Core Shape
            ctx.fillStyle = '#4db6ac';
            ctx.beginPath();
            ctx.moveTo(0, -h.height / 2);
            ctx.lineTo(h.width / 2, 0);
            ctx.lineTo(0, h.height / 2);
            ctx.lineTo(-h.width / 2, 0);
            ctx.closePath();
            ctx.fill();

            // Inner pulsing core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 8 * scale, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
}

// Particle System
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color: color
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 2;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Draw static scene initially
resizeCanvas();
function drawStaticScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const time = Date.now() / 1000;

    // Road surface - Lighter tactical grey
    ctx.fillStyle = '#2c343a';
    ctx.fillRect(road.x - 20, 0, road.width + 40, canvas.height);

    // Draw Edges - Tactical Teal
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(77, 182, 172, 0.4)';
    ctx.strokeStyle = '#4db6ac';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(road.x, 0);
    ctx.lineTo(road.x, canvas.height);
    ctx.stroke();

    ctx.strokeStyle = '#4db6ac';
    ctx.beginPath();
    ctx.moveTo(road.x + road.width, 0);
    ctx.lineTo(road.x + road.width, canvas.height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Decor: Animated Background Dots
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 50; i++) {
        const x = (Math.sin(i) * 0.5 + 0.5) * canvas.width;
        const y = ((time * 50) + i * 150) % canvas.height;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Draw Preview Car on Start Screen
    if (gameState === 'START') {
        const isP1Active = p1CustomScreen.classList.contains('active');
        const isP2Active = p2CustomScreen.classList.contains('active');

        const previewW = (isP1Active || isP2Active) ? 180 : 160;
        const previewH = (isP1Active || isP2Active) ? 300 : 280;
        const previewY = canvas.height / 2 - previewH / 2;

        ctx.save();
        // Floating effect
        const floatOffset = Math.sin(time * 2) * 15;
        ctx.translate(0, floatOffset);

        if (isP1Active) {
            // Focus P1 inside the Circle Lens (Left)
            ctx.save();
            const lensCenterX = canvas.width * 0.05 + 260;
            ctx.translate(lensCenterX - previewW / 2, 0);
            drawPlayerCar(0, previewY, previewW, previewH, player.chassis, player.colorPrimary, player.colorSecondary, player.tilt);
            ctx.restore();
        } else if (isP2Active) {
            // Focus P2 inside the Circle Lens (Left)
            ctx.save();
            const lensCenterX = canvas.width * 0.05 + 260;
            ctx.translate(lensCenterX - previewW / 2, 0);
            drawPlayerCar(0, previewY, previewW, previewH, player2.chassis, player2.colorPrimary, player2.colorSecondary, player2.tilt);
            ctx.restore();
        } else {
            // Default Start Screen View (Dual Portal View)
            const homePreviewW = 150;
            const homePreviewH = 220;
            const homePreviewY = canvas.height / 2 - homePreviewH / 2 + 50;

            // Preview P1
            ctx.save();
            ctx.translate(canvas.width * 0.25 - homePreviewW / 2, 0);
            drawPlayerCar(0, homePreviewY, homePreviewW, homePreviewH, player.chassis, player.colorPrimary, player.colorSecondary, 0);
            ctx.restore();

            // Preview P2
            ctx.save();
            ctx.translate(canvas.width * 0.75 - homePreviewW / 2, 0);
            drawPlayerCar(0, homePreviewY, homePreviewW, homePreviewH, player2.chassis, player2.colorPrimary, player2.colorSecondary, 0);
            ctx.restore();
        }

        ctx.restore();
        requestAnimationFrame(drawStaticScene);
    }
}
drawStaticScene();
