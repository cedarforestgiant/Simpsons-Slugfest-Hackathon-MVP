// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'LOADING'; // LOADING, INTRO, PLAYING, GAME_OVER
let frame = 0;

// Image Loading
const images = {
    fighter1: new Image(),
    fighter2: new Image(),
    loaded: 0,
    total: 2
};

images.fighter1.onload = () => {
    images.loaded++;
    if (images.loaded === images.total) {
        gameState = 'INTRO';
    }
};

images.fighter2.onload = () => {
    images.loaded++;
    if (images.loaded === images.total) {
        gameState = 'INTRO';
    }
};

images.fighter1.src = 'fighter1.png';
images.fighter2.src = 'fighter2.png';

// Player (uses fighter1)
const player = {
    x: 150,
    y: 350,
    width: 80,
    height: 120,
    image: images.fighter1,
    health: 100,
    punching: false,
    punchFrame: 0,
    dancing: true,
    facingRight: true
};

// AI Opponent (uses fighter2)
const opponent = {
    x: 550,
    y: 350,
    width: 80,
    height: 120,
    image: images.fighter2,
    health: 100,
    punching: false,
    punchFrame: 0,
    dancing: true,
    facingRight: false,
    aiTimer: 0
};

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === 'Enter' && gameState === 'INTRO') {
        gameState = 'PLAYING';
        player.dancing = false;
        opponent.dancing = false;
    }
    
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'PLAYING' && !player.punching) {
            player.punching = true;
            player.punchFrame = 0;
            playPunchSound();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Sound Effects (using Web Audio API)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'square') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playMoveSound() {
    // Create white noise for that "crusty" NES footstep sound
    const bufferSize = audioContext.sampleRate * 0.05; // 50ms
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Fill with random noise
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = audioContext.createBufferSource();
    whiteNoise.buffer = buffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    whiteNoise.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    whiteNoise.start(audioContext.currentTime);
    whiteNoise.stop(audioContext.currentTime + 0.05);
}

function playPunchSound() {
    playSound(100, 0.1, 'sawtooth');
}

function playHitSound() {
    playSound(150, 0.15, 'square');
    setTimeout(() => playSound(80, 0.1, 'square'), 50);
}

function playDanceSound() {
    // Shorter, crustier white noise burst for dancing
    const bufferSize = audioContext.sampleRate * 0.03; // 30ms
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = audioContext.createBufferSource();
    whiteNoise.buffer = buffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.03);
    
    whiteNoise.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    whiteNoise.start(audioContext.currentTime);
    whiteNoise.stop(audioContext.currentTime + 0.03);
}

// Draw Functions
function drawBoxer(boxer) {
    ctx.save();
    
    // Apply FRANTIC JITTER animation
    let xJitter = 0;
    let yJitter = 0;
    if (boxer.dancing) {
        xJitter = (Math.random() - 0.5) * 4;
        yJitter = (Math.random() - 0.5) * 4;
        
        if (frame % 20 === 0) playDanceSound();
    }
    
    const baseX = boxer.x + xJitter;
    const baseY = boxer.y + yJitter;
    
    // Handle sprite flipping for facing direction
    if (boxer.facingRight) {
        // Draw normally
        ctx.drawImage(boxer.image, baseX, baseY, boxer.width, boxer.height);
    } else {
        // Flip horizontally
        ctx.save();
        ctx.translate(baseX + boxer.width, baseY);
        ctx.scale(-1, 1);
        ctx.drawImage(boxer.image, 0, 0, boxer.width, boxer.height);
        ctx.restore();
    }
    
    // Punch animation overlay (optional visual effect)
    if (boxer.punching && boxer.punchFrame < 10) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        const punchExtend = boxer.punchFrame * 5;
        if (boxer.facingRight) {
            ctx.fillRect(baseX + boxer.width, baseY + boxer.height / 3, punchExtend, 20);
        } else {
            ctx.fillRect(baseX - punchExtend, baseY + boxer.height / 3, punchExtend, 20);
        }
    }
    
    ctx.restore();
}

function drawHealthBar(x, y, health, color) {
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 200, 30);
    
    // Health
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, (health / 100) * 196, 26);
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText(Math.floor(health), x + 85, y + 21);
}

function drawBackground() {
    // VOID AESTHETIC - pure black background (no crowd, no floor texture)
    // Background is already black from the main clear
    
    // BOXING RING ROPES - simple horizontal white lines
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 3;
    
    // Top rope
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(canvas.width, 250);
    ctx.stroke();
    
    // Middle rope
    ctx.beginPath();
    ctx.moveTo(0, 350);
    ctx.lineTo(canvas.width, 350);
    ctx.stroke();
    
    // Bottom rope
    ctx.beginPath();
    ctx.moveTo(0, 450);
    ctx.lineTo(canvas.width, 450);
    ctx.stroke();
    
    // Ring floor line (just a simple line, not a textured floor)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(canvas.width, 520);
    ctx.stroke();
}

function drawUI() {
    // Player health bar
    drawHealthBar(50, 30, player.health, '#00ff00');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('PLAYER', 50, 20);
    
    // Opponent health bar
    drawHealthBar(550, 30, opponent.health, '#ff00ff');
    ctx.fillText('OPPONENT', 550, 20);
    
    if (gameState === 'LOADING') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('LOADING...', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 24px Courier New';
        ctx.fillText(`${images.loaded} / ${images.total}`, canvas.width / 2, canvas.height / 2 + 50);
        ctx.textAlign = 'left';
    }
    
    if (gameState === 'INTRO') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('READY?', canvas.width / 2, canvas.height / 2 - 50);
        
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 24px Courier New';
        ctx.fillText('Press ENTER to fight!', canvas.width / 2, canvas.height / 2 + 20);
        ctx.textAlign = 'left';
    }
    
    if (gameState === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = player.health <= 0 ? '#f00' : '#0f0';
        ctx.font = 'bold 64px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(player.health <= 0 ? 'YOU LOSE!' : 'YOU WIN!', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Courier New';
        ctx.fillText('Refresh to play again', canvas.width / 2, canvas.height / 2 + 50);
        ctx.textAlign = 'left';
    }
}

// Collision detection
function checkPunchCollision(attacker, defender) {
    if (!attacker.punching || attacker.punchFrame > 10) return false;
    
    const punchReach = 60;
    let punchX = attacker.facingRight ? 
        attacker.x + attacker.width : 
        attacker.x - punchReach;
    
    return (
        punchX < defender.x + defender.width &&
        punchX + punchReach > defender.x &&
        attacker.y < defender.y + defender.height &&
        attacker.y + attacker.height > defender.y
    );
}

// AI Logic
function updateAI() {
    opponent.aiTimer++;
    
    // Simple AI behavior
    if (opponent.aiTimer % 60 === 0) {
        // Random movement
        const moveX = (Math.random() - 0.5) * 10;
        const moveY = (Math.random() - 0.5) * 10;
        opponent.x += moveX;
        opponent.y += moveY;
    }
    
    // Try to punch if close to player
    const distance = Math.abs(player.x - opponent.x);
    if (distance < 150 && opponent.aiTimer % 90 === 0 && !opponent.punching) {
        opponent.punching = true;
        opponent.punchFrame = 0;
        playPunchSound();
    }
    
    // Face player
    opponent.facingRight = opponent.x > player.x;
}

// Update game state
function update() {
    frame++;
    
    if (gameState !== 'PLAYING') return;
    
    // Player movement
    let moved = false;
    if (keys['ArrowLeft']) {
        player.x -= 5;
        player.facingRight = false;
        moved = true;
    }
    if (keys['ArrowRight']) {
        player.x += 5;
        player.facingRight = true;
        moved = true;
    }
    if (keys['ArrowUp']) {
        player.y -= 5;
        moved = true;
    }
    if (keys['ArrowDown']) {
        player.y += 5;
        moved = true;
    }
    
    if (moved && frame % 10 === 0) {
        playMoveSound();
    }
    
    // Keep player in bounds
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(250, Math.min(450, player.y));
    
    // Update AI
    updateAI();
    
    // Keep AI in bounds
    opponent.x = Math.max(0, Math.min(canvas.width - opponent.width, opponent.x));
    opponent.y = Math.max(250, Math.min(450, opponent.y));
    
    // Update punch animations
    if (player.punching) {
        player.punchFrame++;
        if (player.punchFrame > 15) {
            player.punching = false;
        }
        
        // Check if punch hits
        if (checkPunchCollision(player, opponent)) {
            opponent.health -= 5;
            playHitSound();
            opponent.x += player.facingRight ? 20 : -20; // Knockback
        }
    }
    
    if (opponent.punching) {
        opponent.punchFrame++;
        if (opponent.punchFrame > 15) {
            opponent.punching = false;
        }
        
        // Check if punch hits
        if (checkPunchCollision(opponent, player)) {
            player.health -= 5;
            playHitSound();
            player.x += opponent.facingRight ? 20 : -20; // Knockback
        }
    }
    
    // Check for game over
    if (player.health <= 0 || opponent.health <= 0) {
        gameState = 'GAME_OVER';
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw everything
    drawBackground();
    
    if (gameState !== 'LOADING') {
        drawBoxer(player);
        drawBoxer(opponent);
    }
    
    drawUI();
    
    // Update
    update();
    
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
