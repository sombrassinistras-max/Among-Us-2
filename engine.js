class SoundBank {
    constructor() { this.ctx = null; this.initialized = false; this.enabled = true; }
    init() {
        if (this.initialized || !this.enabled) return;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext(); this.initialized = true;
    }
    playTone(freq, type, duration, vol, slideFreq = null) {
        if (!this.ctx || !this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        let osc = this.ctx.createOscillator(); let gain = this.ctx.createGain();
        osc.type = type; osc.connect(gain); gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    }
    play(sound) {
        if (!this.enabled) return;
        this.init(); 
        switch(sound) {
            case 'step': this.playTone(120, 'sine', 0.1, 0.03, 60); break;
            case 'ventEnter': this.playTone(300, 'triangle', 0.4, 0.3, 50); break;
            case 'ventExit': this.playTone(50, 'triangle', 0.4, 0.3, 300); break;
            case 'taskOpen': this.playTone(600, 'square', 0.1, 0.05); break;
            case 'taskComplete': this.playTone(400, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(500, 'sine', 0.1, 0.1), 100); setTimeout(() => this.playTone(600, 'sine', 0.3, 0.15), 200); break;
            case 'click': this.playTone(800, 'square', 0.05, 0.05); break;
            case 'shoot': this.playTone(800, 'sawtooth', 0.15, 0.1, 200); break;
            case 'error': this.playTone(150, 'sawtooth', 0.2, 0.1, 100); break;
            case 'alarm': this.playTone(200, 'square', 0.8, 0.3, 100); break; // Som de reunião
        }
    }
}
const sfx = new SoundBank();

let gameState = "PLAYING"; // PLAYING, DOING_TASK, VOTING
let currentTaskOpen = null; let showDebugUI = false;
let playerInVent = false; let currentVentId = null; let ventBuildStep = 0; let tempOrigemId = null; let ventIdCounter = 20; 
let miniGameData = { asteroids:[], destroyedCount: 0, downloadProgress: 0, isDownloading: false }; let stepTimer = 0;

const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
let mouseX = 0; let mouseY = 0;
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const assets = { map: new Image(), collisionMap: new Image(), playerIdle: new Image(), playerRun: new Image(), ventBase: new Image(), ventArrow: new Image() };
let assetsLoaded = 0; const totalAssets = 6;
function checkLoad() {
    assetsLoaded++; document.getElementById('loadStatus').innerText = `Carregado: ${assetsLoaded}/${totalAssets}`;
    if (assetsLoaded === totalAssets) { setupCollisionSystem(); document.getElementById('loading').style.display = 'none'; initGame(); }
}
Object.values(assets).forEach(img => { img.crossOrigin = "Anonymous"; img.onload = checkLoad; });

assets.map.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/among%20us%20map.jpg';
assets.collisionMap.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/Among%20us%20Map%20COlission.png';
assets.playerIdle.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/Among%20us%20personagem.png';
assets.playerRun.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/Among%20us%20personagem%20Correndo.gif';
assets.ventBase.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/Tubula%C3%A7%C3%A3o.png';
assets.ventArrow.src = 'https://raw.githubusercontent.com/sombrassinistras-max/Among-Us-2/main/Setinha.png';

let collisionCanvas, collisionCtx, collisionPixels;
function setupCollisionSystem() {
    collisionCanvas = document.createElement('canvas'); collisionCanvas.width = assets.collisionMap.width; collisionCanvas.height = assets.collisionMap.height;
    collisionCtx = collisionCanvas.getContext('2d', { willReadFrequently: true });
    collisionCtx.drawImage(assets.collisionMap, 0, 0);
    collisionPixels = collisionCtx.getImageData(0, 0, collisionCanvas.width, collisionCanvas.height).data;
}
function isWall(x, y) {
    if (x < 0 || x >= collisionCanvas.width || y < 0 || y >= collisionCanvas.height) return true;
    return collisionPixels[(Math.floor(y) * collisionCanvas.width + Math.floor(x)) * 4] < 128; 
}
function checkHitboxCollision(x, y, radius) {
    for (let i = 0; i < 8; i++) { if (isWall(x + Math.cos((i * (Math.PI * 2)) / 8) * radius, y + Math.sin((i * (Math.PI * 2)) / 8) * radius)) return true; }
    return false;
}

const player = { x: CONFIG.spawnX, y: CONFIG.spawnY, facingRight: true, isMoving: false, name: "Você" };

// Nomes Aleatórios para os Bots
const possibleNames =["Ciano", "Verde", "Rosa", "Laranja", "Preto", "Branco", "Amarelo", "Roxo"];
function getRandomName() {
    let index = Math.floor(Math.random() * possibleNames.length);
    return possibleNames.splice(index, 1)[0]; // Remove o nome da lista para não repetir
}

class Bot {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * CONFIG.playerSpeed * 0.7; this.vy = (Math.random() - 0.5) * CONFIG.playerSpeed * 0.7;
        this.timer = 0; this.facingRight = true; this.isMoving = false;
        this.name = getRandomName(); // Aplica Nome
        this.isAlive = true;
    }
    update() {
        if(!this.isAlive) return;
        this.timer--;
        if(this.timer <= 0) { this.vx = (Math.random() - 0.5) * CONFIG.playerSpeed; this.vy = (Math.random() - 0.5) * CONFIG.playerSpeed; this.timer = Math.random() * 150 + 50; }
        this.facingRight = this.vx > 0;
        let moveX = 0; let moveY = 0;
        if (!checkHitboxCollision(this.x + this.vx, this.y, CONFIG.hitboxRadius)) { this.x += this.vx; moveX = this.vx; } else this.vx *= -1;
        if (!checkHitboxCollision(this.x, this.y + this.vy, CONFIG.hitboxRadius)) { this.y += this.vy; moveY = this.vy; } else this.vy *= -1;
        this.isMoving = (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1);
    }
    draw(ctx) {
        if(!this.isAlive) return;
        ctx.save(); ctx.translate(this.x, this.y);
        if (!this.facingRight) ctx.scale(-1, 1);
        if (this.isMoving) { ctx.translate(0, -Math.abs(Math.sin(Date.now() / 120 + this.x)) * 3); ctx.rotate(Math.sin(Date.now() / 120 + this.x) * 0.15); }
        ctx.drawImage(assets.playerIdle, -CONFIG.playerSize / 2, -CONFIG.playerSize / 2, CONFIG.playerSize, CONFIG.playerSize);
        ctx.restore();
    }
}
const bots =[];
for(let i=0; i<5; i++) { bots.push(new Bot(CONFIG.spawnX + (Math.random()*20-10), CONFIG.spawnY + (Math.random()*20-10))); }

function canUseVents() { return CONFIG.ventRule === "FREE" || (CONFIG.ventRule === "RESTRICTED" && CONFIG.myRole === "IMPOSTOR"); }

function getNearbyInteractable() {
    // 1. Checa o Botão de Emergência
    if (Math.hypot(player.x - CONFIG.buttonX, player.y - CONFIG.buttonY) < 40) return { type: 'BUTTON' };
    
    // 2. Checa Dutos
    if (canUseVents()) { for (let vent of ventsData) { if (Math.hypot(player.x - vent.x, player.y - vent.y) < 30) return { type: 'VENT', obj: vent }; } }
    
    // 3. Checa Tasks
    if(CONFIG.myRole !== "IMPOSTOR") { for (let task of tasks) { if (!task.completed && Math.hypot(player.x - task.x, player.y - task.y) < 30) return { type: 'TASK', obj: task }; } }
    return null;
}

const keys = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
    sfx.init(); 
    if(gameState === 'DOING_TASK' || gameState === 'VOTING') { if(e.key === 'Escape') fecharMenus(); return; }
    
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = true; if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = true; if (e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
    
    if (e.key === 'e' || e.key === 'E') {
        if (playerInVent) { playerInVent = false; currentVentId = null; sfx.play('ventExit'); } 
        else {
            let inter = getNearbyInteractable();
            if (inter) {
                if (inter.type === 'TASK') { currentTaskOpen = inter.obj; gameState = 'DOING_TASK'; keys.w = keys.a = keys.s = keys.d = false; sfx.play('taskOpen'); iniciarMinigame(); } 
                else if (inter.type === 'VENT') { playerInVent = true; currentVentId = inter.obj.id; player.x = inter.obj.x; player.y = inter.obj.y; keys.w = keys.a = keys.s = keys.d = false; sfx.play('ventEnter'); }
                else if (inter.type === 'BUTTON') { gameState = 'VOTING'; keys.w = keys.a = keys.s = keys.d = false; sfx.play('alarm'); }
            }
        }
    }
    if (e.key === 'Tab') { e.preventDefault(); showDebugUI = !showDebugUI; document.getElementById('devMenu').style.display = showDebugUI ? 'block' : 'none'; }
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.w = false; if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.s = false; if (e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
});
window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

canvas.addEventListener('mousedown', (e) => {
    sfx.init(); const rect = canvas.getBoundingClientRect();
    let worldX = ((e.clientX - rect.left) - canvas.width / 2) / CONFIG.cameraZoom + player.x;
    let worldY = ((e.clientY - rect.top) - canvas.height / 2) / CONFIG.cameraZoom + player.y;

    // VOTAÇÃO CLIQUES
    if (gameState === 'VOTING') {
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        let localX = mouseX - cx; let localY = mouseY - cy;
        
        // Clicar em Bots
        bots.forEach((b, i) => {
            let bx = (i % 2 === 0) ? -280 : 80; let by = -60 + Math.floor(i / 2) * 70;
            if(localX > bx && localX < bx+200 && localY > by && localY < by+50) { sfx.play('click'); fecharMenus(); /* Mock Vote Ends */ }
        });
        // Skip Vote
        if(localX > -100 && localX < 100 && localY > 180 && localY < 220) { sfx.play('click'); fecharMenus(); }
        return;
    }

    if (playerInVent && currentVentId !== null) {
        let currentVent = ventsData.find(v => v.id === currentVentId);
        if(currentVent && currentVent.links) {
            currentVent.links.forEach(targetId => {
                let destVent = ventsData.find(v => v.id === targetId);
                if(destVent) {
                    let angle = Math.atan2(destVent.y - currentVent.y, destVent.x - currentVent.x);
                    if (Math.hypot(worldX - (currentVent.x + Math.cos(angle) * 35), worldY - (currentVent.y + Math.sin(angle) * 35)) < 20) {
                        player.x = destVent.x; player.y = destVent.y; currentVentId = destVent.id; sfx.play('ventEnter'); 
                    }
                }
            });
        }
        return; 
    }
    
    // DEBUG: DEFINIR BOTÃO
    if (showDebugUI && document.getElementById('chkSetButton').checked && gameState === 'PLAYING') {
        CONFIG.buttonX = Math.round(worldX); CONFIG.buttonY = Math.round(worldY); return;
    }
    if (showDebugUI && document.getElementById('chkBuildVent').checked && gameState === 'PLAYING') {
        if (ventBuildStep === 1) {
            let newVent = { id: `vent_${ventIdCounter++}`, x: worldX, y: worldY, links:[] }; ventsData.push(newVent);
            tempOrigemId = newVent.id; ventBuildStep = 2; document.getElementById('ventBuilderStatus').innerText = "Clique para definir a Saída";
        } else if (ventBuildStep === 2) {
            let newVent = { id: `vent_${ventIdCounter++}`, x: worldX, y: worldY, links:[] }; ventsData.push(newVent);
            ventsData.find(v => v.id === tempOrigemId).links.push(newVent.id); newVent.links.push(tempOrigemId);
            ventBuildStep = 1; document.getElementById('ventBuilderStatus').innerText = "Link Criado! Clique p/ nova Origem";
        }
        return;
    }
    if (showDebugUI && document.getElementById('chkSetSpawn').checked && gameState === 'PLAYING') { CONFIG.spawnX = Math.round(worldX); CONFIG.spawnY = Math.round(worldY); return;}

    if (gameState === 'DOING_TASK') {
        let cx = canvas.width / 2; let cy = canvas.height / 2; let localMouseX = mouseX - cx; let localMouseY = mouseY - cy;
        if(currentTaskOpen.type === 'ASTEROIDS') {
            let hit = false;
            for (let i = miniGameData.asteroids.length - 1; i >= 0; i--) {
                let ast = miniGameData.asteroids[i];
                if (Math.hypot(localMouseX - ast.x, localMouseY - ast.y) < ast.radius) {
                    miniGameData.asteroids.splice(i, 1); miniGameData.destroyedCount++; hit = true; sfx.play('shoot'); 
                    if (miniGameData.destroyedCount >= 10) concluirTask(); break;
                }
            }
            if(!hit) sfx.play('error');
        }
        else if(currentTaskOpen.type === 'DOWNLOAD') { if (localMouseX > -60 && localMouseX < 60 && localMouseY > 120 && localMouseY < 160) { miniGameData.isDownloading = true; sfx.play('click'); } }
        else { if (localMouseX > -100 && localMouseX < 100 && localMouseY > 140 && localMouseY < 190) { sfx.play('click'); concluirTask(); } }
    }
});

document.getElementById('chkSound').addEventListener('change', e => sfx.enabled = e.target.checked);
document.getElementById('chkBuildVent').addEventListener('change', (e) => { ventBuildStep = e.target.checked ? 1 : 0; document.getElementById('ventBuilderStatus').innerText = e.target.checked ? "Clique no mapa: Origem" : "Aguardando..."; });
document.querySelectorAll('input[name="myRole"]').forEach(r => r.addEventListener('change', e => CONFIG.myRole = e.target.value));
document.querySelectorAll('input[name="ventRule"]').forEach(r => r.addEventListener('change', e => CONFIG.ventRule = e.target.value));
document.getElementById('btnTeleport').addEventListener('click', () => { player.x = CONFIG.spawnX; player.y = CONFIG.spawnY; });
document.getElementById('btnGenerate').addEventListener('click', () => { document.getElementById('configOutput').value = JSON.stringify({ config: CONFIG, tubulacoes: ventsData }, null, 2); });
const sZoom = document.getElementById('zoomSlider'); const sSpeed = document.getElementById('speedSlider');
function updateConfigFromUI() { CONFIG.cameraZoom = parseFloat(sZoom.value); document.getElementById('valZoom').innerText = CONFIG.cameraZoom; CONFIG.playerSpeed = parseFloat(sSpeed.value); }
sZoom.addEventListener('input', updateConfigFromUI); sSpeed.addEventListener('input', updateConfigFromUI);

function fecharMenus() { currentTaskOpen = null; gameState = 'PLAYING'; }
function iniciarMinigame() { miniGameData = { asteroids:[], destroyedCount: 0, downloadProgress: 0, isDownloading: false }; }
function concluirTask() { currentTaskOpen.completed = true; sfx.play('taskComplete'); fecharMenus(); }

function updateMiniGames() {
    if(currentTaskOpen.type === 'ASTEROIDS') {
        if(miniGameData.asteroids.length < 5 && Math.random() < 0.05) miniGameData.asteroids.push({ x: 350, y: (Math.random() * 300) - 150, vx: -(Math.random() * 3 + 2), vy: (Math.random() - 0.5) * 2, radius: Math.random() * 15 + 15 });
        miniGameData.asteroids.forEach(ast => { ast.x += ast.vx; ast.y += ast.vy; });
        miniGameData.asteroids = miniGameData.asteroids.filter(ast => ast.x > -350);
    }
    if(currentTaskOpen.type === 'DOWNLOAD' && miniGameData.isDownloading) {
        miniGameData.downloadProgress += 0.5; if(miniGameData.downloadProgress >= 100) concluirTask();
    }
}

function drawVotingScreen(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Fundo Painel Votação
    ctx.fillStyle = '#1c2331'; ctx.beginPath(); ctx.roundRect(-350, -250, 700, 500, 15); ctx.fill(); ctx.strokeStyle = '#394b5f'; ctx.lineWidth = 4; ctx.stroke();
    
    // Título
    ctx.fillStyle = '#ff0000'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText("QUEM É O IMPOSTOR?", 0, -200);

    // Box Jogador
    ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.roundRect(-280, -140, 200, 50, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'left'; ctx.fillText(player.name + ` (${CONFIG.myRole})`, -260, -110);

    // Box Bots
    bots.forEach((b, i) => {
        let bx = (i % 2 === 0) ? -280 : 80; let by = -60 + Math.floor(i / 2) * 70;
        
        ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.roundRect(bx, by, 200, 50, 10); ctx.fill();
        // Efeito Hover Mouse
        if(mouseX - canvas.width/2 > bx && mouseX - canvas.width/2 < bx+200 && mouseY - canvas.height/2 > by && mouseY - canvas.height/2 < by+50) {
            ctx.strokeStyle = '#00ffcc'; ctx.strokeRect(bx, by, 200, 50);
        }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.fillText(b.name, bx + 20, by + 30);
    });

    // Pular Voto
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.roundRect(-100, 180, 200, 40, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText("PULAR VOTO", 0, 206);
    
    ctx.restore();
}

function drawTaskInterface(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#1c2331'; ctx.beginPath(); ctx.roundRect(-325, -225, 650, 450, 15); ctx.fill(); ctx.strokeStyle = '#394b5f'; ctx.lineWidth = 4; ctx.stroke();
    let localMouseX = mouseX - canvas.width / 2; let localMouseY = mouseY - canvas.height / 2; let time = Date.now();

    switch (currentTaskOpen.type) {
        case 'WIRES':
            ctx.fillStyle = '#222938'; ctx.beginPath(); ctx.roundRect(-250, -130, 500, 260, 10); ctx.fill();
            const colors =['#e74c3c', '#3498db', '#f1c40f', '#e67e22'];
            for(let i=0; i<4; i++) {
                ctx.fillStyle = '#111'; ctx.fillRect(-220, -100 + i*60, 50, 24); ctx.fillStyle = colors[i]; ctx.fillRect(-180, -95 + i*60, 20, 14); 
                ctx.fillStyle = '#111'; ctx.fillRect(170, -100 + i*60, 50, 24); ctx.fillStyle = colors[(i+1)%4]; ctx.beginPath(); ctx.arc(165, -88 + i*60, 8, 0, Math.PI*2); ctx.fill(); 
            } break;
        case 'SCAN':
            let scanGrad = ctx.createRadialGradient(0, 80, 10, 0, 80, 150); scanGrad.addColorStop(0, '#1d3557'); scanGrad.addColorStop(1, '#0b162c');
            ctx.fillStyle = scanGrad; ctx.beginPath(); ctx.ellipse(0, 80, 180, 60, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(0, 255, 204, 0.2)'; ctx.beginPath(); ctx.roundRect(-40, -80, 80, 130, 20); ctx.fill(); ctx.beginPath(); ctx.arc(0, -100, 35, 0, Math.PI*2); ctx.fill(); 
            let scanY = -140 + Math.abs(Math.sin(time / 800)) * 260;
            ctx.fillStyle = 'rgba(0, 255, 204, 0.4)'; ctx.fillRect(-150, -150, 300, scanY - (-150)); 
            ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-160, scanY); ctx.lineTo(160, scanY); ctx.stroke(); break;
        case 'FUEL':
            ctx.fillStyle = '#666'; ctx.beginPath(); ctx.roundRect(-120, -130, 240, 260, 20); ctx.fill(); ctx.fillStyle = '#0b0f19'; ctx.fillRect(-60, -80, 120, 200);
            let fillLevel = Math.abs(Math.sin(time / 1500)) * 200; ctx.fillStyle = '#e67e22'; ctx.fillRect(-60, 120 - fillLevel, 120, fillLevel); break;
        case 'SWIPE':
            ctx.fillStyle = '#4a2f1d'; ctx.beginPath(); ctx.roundRect(-180, -50, 360, 180, 20); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(-250, -150, 500, 70, 10); ctx.fill();
            ctx.fillStyle = '#000'; ctx.fillRect(-250, -110, 500, 10); ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(200, -115, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.roundRect(-120, 0, 240, 140, 10); ctx.fill(); ctx.fillStyle = '#2c3e50'; ctx.fillRect(-120, 20, 240, 30); ctx.fillStyle = '#3498db'; ctx.fillRect(-100, 70, 45, 55); break;
        case 'TRASH':
            ctx.fillStyle = '#333'; ctx.fillRect(-60, -120, 120, 240); ctx.fillStyle = '#666'; ctx.fillRect(80, 0, 40, 120); ctx.fillStyle = 'red'; ctx.fillRect(70, -20, 60, 20);
            ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(-20, 50, 15, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#557a3a'; ctx.beginPath(); ctx.arc(20, 80, 20, 0, Math.PI*2); ctx.fill(); break;
        case 'CALIBRATE':
            for(let i=0; i<3; i++) {
                let r = -150 + i*150; ctx.strokeStyle = '#555'; ctx.lineWidth = 15; ctx.beginPath(); ctx.arc(r, -20, 50, 0, Math.PI*2); ctx.stroke();
                ctx.save(); ctx.translate(r, -20); ctx.rotate((time/ (1000 - i*200))); ctx.fillStyle = '#f2a900'; ctx.fillRect(-10, -50, 20, 30); ctx.restore();
            } break;
        case 'ALIGN':
            ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-200, -30); ctx.lineTo(200, -30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, 90); ctx.stroke();
            let tgtX = Math.sin(time / 800) * 100; let tgtY = Math.cos(time / 600) * 100 - 30; ctx.fillStyle = 'rgba(76, 175, 80, 0.5)'; ctx.beginPath(); ctx.arc(tgtX, tgtY, 30, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.strokeRect(tgtX - 5, tgtY - 5, 10, 10); break;
        case 'LEAVES':
            ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-100, -20, 80, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-100, -20, 30, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#4caf50';
            for(let i=0; i<6; i++) { let lx = 50 + Math.sin(time/200 + i)*50; let ly = -100 + i*30; ctx.save(); ctx.translate(lx, ly); ctx.rotate(time/500 + i); ctx.fillRect(-15, -10, 30, 20); ctx.restore(); } break;
        case 'ASTEROIDS':
            ctx.fillStyle = '#001a00'; ctx.fillRect(-250, -140, 500, 280); ctx.fillStyle = '#7f8c8d'; ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 2;
            miniGameData.asteroids.forEach(ast => { ctx.beginPath(); ctx.arc(ast.x, ast.y, ast.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke(); });
            ctx.fillStyle = '#00ff00'; ctx.font = '20px monospace'; ctx.fillText(`Destruídos: ${miniGameData.destroyedCount} / 10`, -240, -110);
            ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(localMouseX - 20, localMouseY); ctx.lineTo(localMouseX + 20, localMouseY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(localMouseX, localMouseY - 20); ctx.lineTo(localMouseX, localMouseY + 20); ctx.stroke(); break; 
        case 'DOWNLOAD':
            ctx.fillStyle = '#1e2738'; ctx.fillRect(-250, -120, 500, 240); ctx.fillStyle = '#0b0f19'; ctx.beginPath(); ctx.roundRect(-200, 60, 400, 30, 15); ctx.fill();
            let barW = (miniGameData.downloadProgress / 100) * 400; ctx.fillStyle = '#00ffcc'; ctx.beginPath(); ctx.roundRect(-200, 60, Math.max(15, barW), 30, 15); ctx.fill();
            ctx.fillStyle = miniGameData.isDownloading ? '#555' : '#3498db'; ctx.beginPath(); ctx.roundRect(-60, 120, 120, 40, 5); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign='center'; ctx.fillText(miniGameData.isDownloading ? 'Baixando...' : 'Iniciar Download', 0, 145); break; 
    }

    if (currentTaskOpen.type !== 'ASTEROIDS' && currentTaskOpen.type !== 'DOWNLOAD') {
        ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.roundRect(-100, 140, 200, 50, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign='center'; ctx.fillText('CLIQUE PARA COMPLETAR', 0, 170);
    }

    ctx.fillStyle = '#0f1423'; ctx.beginPath(); ctx.roundRect(-325, -225, 650, 60,[15, 15, 0, 0]); ctx.fill();
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 22px "Segoe UI"'; ctx.textAlign = 'center'; ctx.fillText(`[${currentTaskOpen.room}] - ${currentTaskOpen.name}`, 0, -187);
    ctx.restore();
}

function update() {
    if (gameState === 'DOING_TASK' || gameState === 'VOTING') { updateMiniGames(); return; }
    if (playerInVent) return; 

    let moveX = 0; let moveY = 0;
    if (keys.w) moveY = -CONFIG.playerSpeed; if (keys.s) moveY = CONFIG.playerSpeed;
    if (keys.a) { moveX = -CONFIG.playerSpeed; player.facingRight = false; }
    if (keys.d) { moveX = CONFIG.playerSpeed; player.facingRight = true; }
    player.isMoving = (moveX !== 0 || moveY !== 0);

    if (moveX !== 0 && !checkHitboxCollision(player.x + moveX, player.y, CONFIG.hitboxRadius)) player.x += moveX;
    if (moveY !== 0 && !checkHitboxCollision(player.x, player.y + moveY, CONFIG.hitboxRadius)) player.y += moveY;

    bots.forEach(b => b.update());
    if (player.isMoving) { stepTimer--; if (stepTimer <= 0) { sfx.play('step'); stepTimer = 18; } }
}

function draw() {
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(CONFIG.cameraZoom, CONFIG.cameraZoom); ctx.translate(-player.x, -player.y);
    ctx.drawImage(assets.map, 0, 0);

    // Desenhar Botão de Emergência
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(CONFIG.buttonX, CONFIG.buttonY, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.beginPath(); ctx.arc(CONFIG.buttonX, CONFIG.buttonY, 12, 0, Math.PI*2); ctx.fill();
    if (Math.hypot(player.x - CONFIG.buttonX, player.y - CONFIG.buttonY) < 40 && !playerInVent) {
        ctx.strokeStyle = 'yellow'; ctx.lineWidth = 2; ctx.stroke();
    }

    ventsData.forEach(vent => {
        let isNear = Math.hypot(player.x - vent.x, player.y - vent.y) < 30;
        if (isNear && canUseVents() && !playerInVent) {
            let ventW = assets.ventBase.width || 68; let ventH = assets.ventBase.height || 48;
            let pulse = Math.abs(Math.sin(Date.now() / 150)) * 0.3; ctx.globalAlpha = 0.7 + pulse;
            ctx.drawImage(assets.ventBase, vent.x - ventW/2, vent.y - ventH/2, ventW, ventH); ctx.globalAlpha = 1.0; 
        }
    });

    if (playerInVent && currentVentId !== null) {
        let currentVent = ventsData.find(v => v.id === currentVentId);
        if(currentVent && currentVent.links) {
            currentVent.links.forEach(targetId => {
                let destVent = ventsData.find(v => v.id === targetId);
                if(destVent) {
                    let angle = Math.atan2(destVent.y - currentVent.y, destVent.x - currentVent.x);
                    ctx.save(); ctx.translate(currentVent.x + Math.cos(angle) * 35, currentVent.y + Math.sin(angle) * 35);
                    ctx.rotate(angle); let arrowW = (assets.ventArrow.width || 30) * 0.5; let arrowH = (assets.ventArrow.height || 30) * 0.5;
                    ctx.drawImage(assets.ventArrow, -arrowW/2, -arrowH/2, arrowW, arrowH); ctx.restore(); 
                }
            });
        }
    }

    if (CONFIG.myRole !== "IMPOSTOR") {
        tasks.forEach(task => {
            if (!task.completed && Math.hypot(player.x - task.x, player.y - task.y) < 30 && !playerInVent) {
                let pulse = Math.abs(Math.sin(Date.now() / 150)) * 4; ctx.beginPath(); ctx.arc(task.x, task.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; ctx.fill(); ctx.lineWidth = 1.5 + pulse; ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; ctx.stroke();
            }
        });
    }

    bots.forEach(b => b.draw(ctx));

    if (!playerInVent) {
        ctx.save(); ctx.translate(player.x, player.y);
        if (!player.facingRight) ctx.scale(-1, 1);
        if (player.isMoving) { ctx.translate(0, -Math.abs(Math.sin(Date.now() / 120)) * 3); ctx.rotate(Math.sin(Date.now() / 120) * 0.15); }
        ctx.drawImage(assets.playerIdle, -CONFIG.playerSize / 2, -CONFIG.playerSize / 2, CONFIG.playerSize, CONFIG.playerSize); ctx.restore();
    }
    ctx.restore(); 

    if (gameState === 'PLAYING') {
        let inter = getNearbyInteractable();
        if (playerInVent) {
            ctx.fillStyle = 'rgba(200,0,0,0.8)'; ctx.beginPath(); ctx.roundRect(canvas.width/2 - 70, canvas.height/2 + 60, 140, 35, 8); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('Sair [E]', canvas.width/2, canvas.height/2 + 84);
        } else if (inter) {
            let msg = 'Usar [E]';
            if(inter.type === 'VENT') msg = 'Duto [E]';
            if(inter.type === 'BUTTON') msg = 'Reunião [E]';

            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.roundRect(canvas.width/2 - 70, canvas.height/2 + 60, 140, 35, 8); ctx.fill();
            ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(msg, canvas.width/2, canvas.height/2 + 84);
        }
    }
    if (gameState === 'DOING_TASK') drawTaskInterface(ctx);
    if (gameState === 'VOTING') drawVotingScreen(ctx);
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
function initGame() { document.getElementById('zoomSlider').value = CONFIG.cameraZoom; document.getElementById('speedSlider').value = CONFIG.playerSpeed; gameLoop(); }
