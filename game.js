// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Disable image smoothing to prevent bleeding between sprite frames
ctx.imageSmoothingEnabled = false;

// Game State
let gameState = 'LOADING'; // LOADING, INTRO, PLAYING, GAME_OVER
let frame = 0;

// Intro State
const introState = {
    slideOffset: 800,
    vsScale: 0,
    flashOpacity: 0,
    timer: 0,
    phase: 'SLIDE' // SLIDE, IMPACT, WAITING
};

// KO Sequence State
const koState = {
    timer: 0,
    phase: 'FREEZE', // FREEZE, POP, FALL, DONE
    loser: null,
    flashOpacity: 0
};

// Helper: Background Removal
function removeBackground(imageSrc, callback) {
    const img = new Image();
    // img.crossOrigin = "Anonymous"; // Removing this might help local files, but canvas tainting is strict.
    
    const fallback = () => {
        const fallbackImg = new Image();
        fallbackImg.src = imageSrc;
        // Ensure we wait for it to be ready before callback, or just pass src
        // Since the caller sets src, we can just pass a dummy with src
        // Actually, the caller expects an image object or just the src. 
        // Let's pass an object with the src property.
        callback({ src: imageSrc });
    };

    img.onload = () => {
        try {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, c.width, c.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Check for white (checkerboard light)
                const isWhite = r > 240 && g > 240 && b > 240;
                
                // Check for grey (checkerboard dark)
                const isGrey = (r > 180 && r < 220) && (Math.abs(r - g) < 10 && Math.abs(r - b) < 10);
                
                if (isWhite || isGrey) {
                    data[i + 3] = 0; // Alpha 0
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            const newImg = new Image();
            newImg.onload = () => callback(newImg);
            newImg.src = c.toDataURL();
        } catch (e) {
            console.warn("Background removal failed (likely CORS), using original image.", e);
            fallback();
        }
    };
    
    img.onerror = fallback;
    
    img.src = imageSrc;
}

// Image Loading
const images = {
    fighter1Movement: new Image(),
    fighter1Prefight: new Image(),
    fighter2Movement: new Image(),
    fighter2Prefight: new Image(),
    ring: new Image(),
    crowd: new Image(),
    loaded: 0,
    total: 6
};

const checkLoaded = () => {
    images.loaded++;
    if (images.loaded === images.total) {
        gameState = 'INTRO';
    }
};

images.fighter1Movement.onload = checkLoaded;
images.fighter1Prefight.onload = checkLoaded;
images.fighter2Movement.onload = checkLoaded;
images.fighter2Prefight.onload = checkLoaded;
images.ring.onload = checkLoaded;
images.crowd.onload = checkLoaded;

// Use transparent sprites directly
images.fighter1Movement.src = 'homerboxer-fighting_t.png';
images.fighter1Prefight.src = 'homerboxer-prefight.png';

images.fighter2Movement.src = 'bartboxer-fighting_t.png';
images.fighter2Prefight.src = 'bartboxer-prefight.png';
images.ring.src = 'ringbg_t.png';
images.crowd.src = 'facesbg.png';

// Player (uses fighter1 - Homer)
// Sprite sheet: 1024x1024, 4 cols x 3 rows
const player = {
    x: 320,
    y: 240,
    width: 256, // 1024 / 4 cols
    height: 341, // 1024 / 3 rows
    // Sprite config
    spriteSheet: images.fighter1Movement,
    prefightImage: images.fighter1Prefight,
    isSprite: true,
    cols: 4,
    rows: 3,
    rowHeights: [341, 341, 342],
    frameIndex: 0,
    animTimer: 0,
    animSpeed: 10,
    animations: {
        idle: [8, 9], 
        move: [0, 1],
        moveFront: [0, 1],
        moveBack: [2, 3],
        punch: [4, 5],
        punchFront: [4, 5],
        punchBack: [6, 7],
        block: [8, 9],
        blockFront: [8, 9],
        blockBack: [10, 11],
        dodge: [8],
        hurt: [8],
        ko: [4, 8],
        win: [8, 9]
    },
    currentState: 'idle',
    moving: false,
    // Gameplay stats
    health: 100,
    punching: false,
    punchFrame: 0,
    dancing: true,
    facingRight: true,
    reverseBackFrames: true
};

// AI Opponent (uses fighter2 - Bart)
// Sprite sheet: 2048x2048, 4 cols x 3 rows
const opponent = {
    x: 380,
    y: 240,
    width: 300, // Visual size match
    height: 400, // Scaled for 3 rows
    // Sprite config
    spriteSheet: images.fighter2Movement,
    prefightImage: images.fighter2Prefight,
    isSprite: true,
    cols: 4,
    rows: 3,
    rowHeights: [683, 683, 682],
    frameIndex: 0,
    animTimer: 0,
    animSpeed: 10,
    animations: {
        idle: [8, 9], 
        move: [0, 1],
        moveFront: [0, 1],
        moveBack: [2, 3],
        punch: [4, 5],
        punchFront: [4, 5],
        punchBack: [6, 7],
        block: [8, 9],
        blockFront: [8, 9],
        blockBack: [10, 11],
        dodge: [8],
        hurt: [8],
        ko: [4, 8],
        win: [8, 9]
    },
    currentState: 'idle',
    moving: false,
    // Gameplay stats
    health: 100,
    punching: false,
    punchFrame: 0,
    dancing: true,
    facingRight: false,
    aiTimer: 0,
    reverseBackFrames: false
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
    
    // Perspective Scaling
    // Calculate vertical position as a normalized value from 0 (back) to 1 (front)
    const ringSize = 300;
    const ringCenterY = canvas.height * 0.45;
    const ringMinY = ringCenterY - ringSize / 2;
    const ringMaxY = ringCenterY + ringSize / 2;

    // Use feet position (y + height) for depth calculation
    const feetY = boxer.y + boxer.height;
    const normalizedY = (feetY - ringMinY) / (ringMaxY - ringMinY);
    const clampedY = Math.max(0, Math.min(1, normalizedY));

    // Scale from 35% (back) to 50% (front) of screen height
    const minScaleHeight = canvas.height * 0.35;
    const maxScaleHeight = canvas.height * 0.50;
    const targetHeight = minScaleHeight + (maxScaleHeight - minScaleHeight) * clampedY;

    // Determine sprite dimensions dynamically from the image if available
    let srcW = boxer.width;
    let srcH = boxer.height;
    
    // If sprite, prefer actual cell dimensions
    if (boxer.isSprite && boxer.spriteSheet && boxer.spriteSheet.complete && boxer.spriteSheet.naturalWidth > 0) {
         srcW = Math.floor(boxer.spriteSheet.naturalWidth / boxer.cols);
         srcH = Math.floor(boxer.spriteSheet.naturalHeight / boxer.rows);
    }

    // Calculate scale factor to achieve target height
    // We scale based on the source height to fit the target height
    const scale = targetHeight / srcH;
    
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    
    // Center the scaled sprite on the original hitbox center
    const centerX = boxer.x + boxer.width / 2;
    const centerY = boxer.y + boxer.height / 2;
    
    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;
    
    // Apply FRANTIC JITTER animation
    let xJitter = 0;
    let yJitter = 0;
    if (boxer.dancing) {
        xJitter = (Math.random() - 0.5) * 4;
        yJitter = (Math.random() - 0.5) * 4;
        
        if (frame % 20 === 0) playDanceSound();
    }
    
    const renderX = drawX + xJitter;
    const renderY = drawY + yJitter;
    
    // Handle sprite flipping for facing direction
    let shouldFlip = !boxer.facingRight;
    
    // Reverse flipping for specific back frames if configured
    if (boxer.reverseBackFrames && boxer.currentState && boxer.currentState.endsWith('Back')) {
        shouldFlip = !shouldFlip;
    }

    if (shouldFlip) {
        // Flip horizontally around the center of the drawn sprite
        ctx.translate(renderX + drawW / 2, renderY + drawH / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(renderX + drawW / 2), -(renderY + drawH / 2));
    }
    
    if (boxer.isSprite) {
        const img = boxer.spriteSheet;
        if (img && img.complete && img.naturalWidth > 0) {
            const col = boxer.frameIndex % boxer.cols;
            const row = Math.floor(boxer.frameIndex / boxer.cols);
            
            // Calculate actual source height for this row
            if (boxer.rowHeights) {
                srcH = boxer.rowHeights[row];
            } else {
                srcH = Math.floor(img.naturalHeight / boxer.rows);
            }

            // Calculate vertical source position
            let sY = 0;
            if (boxer.rowHeights) {
                for (let i = 0; i < row; i++) {
                    sY += boxer.rowHeights[i];
                }
            } else {
                sY = row * srcH;
            }
            
            // Calculate horizontal source position
            const sX = col * srcW;
            
            ctx.drawImage(
                img,
                Math.round(sX), Math.round(sY), srcW, srcH, // Source (pixel-perfect)
                renderX, renderY, drawW, drawH // Destination (Scaled)
            );
        }
    } else {
        // Legacy drawing for opponent
        if (boxer.image) {
            ctx.drawImage(boxer.image, renderX, renderY, drawW, drawH);
        }
        
        // Punch animation overlay (legacy only)
        if (boxer.punching && boxer.punchFrame < 10) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            const punchExtend = boxer.punchFrame * 5;
            ctx.fillRect(renderX + drawW, renderY + drawH / 3, punchExtend, 20);
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
    // 1. Draw Crowd (Faces) - Tiled & Scaled
    if (images.crowd.complete && images.crowd.naturalWidth > 0) {
        ctx.save();
        const scale = 0.5; // Make faces smaller
        ctx.scale(scale, scale);
        const pattern = ctx.createPattern(images.crowd, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
        ctx.restore();
    }
    
    // 2. Draw Ring - Middle Layer
    if (images.ring.complete && images.ring.naturalWidth > 0) {
        ctx.drawImage(images.ring, 0, 0, canvas.width, canvas.height);
    }
}

function drawIntro() {
    // Background with slight transparency
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw Player (Left Side)
    if (player.prefightImage && player.prefightImage.complete) {
        const pImg = player.prefightImage;
        const x = centerX - 250 - introState.slideOffset; // Slide from left
        ctx.save();
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 20;
        ctx.drawImage(pImg, x - pImg.width/2, centerY - pImg.height/2);
        
        // Name Tag
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 32px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('HOMER', x, centerY + 180);
        ctx.restore();
    }

    // Draw Opponent (Right Side)
    if (opponent.prefightImage && opponent.prefightImage.complete) {
        const oImg = opponent.prefightImage;
        const x = centerX + 250 + introState.slideOffset; // Slide from right
        ctx.save();
        ctx.shadowColor = '#f0f';
        ctx.shadowBlur = 20;
        ctx.drawImage(oImg, x - oImg.width/2, centerY - oImg.height/2);
        
        // Name Tag
        ctx.fillStyle = '#f0f';
        ctx.font = 'bold 32px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('BART', x, centerY + 180);
        ctx.restore();
    }
    
    // Draw VS
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(introState.vsScale, introState.vsScale);
    ctx.rotate(Math.sin(frame * 0.1) * 0.1); // Slight wobble
    
    ctx.fillStyle = '#ff0';
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 5;
    ctx.font = '900 120px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.strokeText('VS', 0, 0);
    ctx.fillText('VS', 0, 0);
    ctx.restore();
    
    // Flash Effect
    if (introState.flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${introState.flashOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Instructions (only when waiting)
    if (introState.phase === 'WAITING') {
        const alpha = 0.5 + Math.sin(frame * 0.2) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 24px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS ENTER TO FIGHT', centerX, canvas.height - 50);
    }
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
    
    // INTRO handled by drawIntro() now

    if (gameState === 'KO_SEQUENCE') {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // KO Text - show during POP, FALL, and DONE phases
        if (koState.phase === 'POP' || koState.phase === 'FALL' || koState.phase === 'DONE') {
             ctx.translate(canvas.width/2, canvas.height/2);
             let scale;
             if (koState.phase === 'POP') {
                 scale = Math.min(3, 1 + koState.timer * 0.1);
             } else {
                 scale = 3; // Keep at max scale after pop
             }
             ctx.scale(scale, scale);
             
             ctx.fillStyle = '#ff0';
             ctx.strokeStyle = '#000';
             ctx.lineWidth = 4;
             ctx.font = '900 80px Impact';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.strokeText('K.O.', 0, 0);
             ctx.fillText('K.O.', 0, 0);
        }
        ctx.restore();
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
    opponent.moving = false;
    
    // Simple AI behavior
    const moveCycle = opponent.aiTimer % 90; // Longer cycle
    
    if (moveCycle === 0) {
        // Pick random direction for this cycle
        opponent.moveDirX = (Math.random() - 0.5) * 3;
        opponent.moveDirY = (Math.random() - 0.5) * 3;
    }
    
    if (moveCycle < 30) { // Move for 30 frames
        opponent.x += (opponent.moveDirX || 0);
        opponent.y += (opponent.moveDirY || 0);
        opponent.moving = true;
    }
    
    // Try to punch if close to player
    const distance = Math.abs(player.x - opponent.x);
    if (distance < 150 && opponent.aiTimer % 120 === 0 && !opponent.punching) {
        opponent.punching = true;
        opponent.punchFrame = 0;
        playPunchSound();
    }
    
    // Face player (face right if player is to the right)
    opponent.facingRight = player.x > opponent.x;
}

// Animation Logic
function updateAnimation(entity, opponent) {
    if (!entity.isSprite) return;

    // Determine state
    let newState = 'idle';
    if (entity.punching) {
        newState = 'punch';
    } else if (entity.dodging) {
        newState = 'dodge';
    } else if (entity.blocking) {
        newState = 'block';
    } else if (entity.moving) {
        newState = 'move';
    }
    
    // Check for directional variants (Front/Back based on opponent's Y position)
    // If opponent is in foreground (higher Y), face camera (Front)
    // If opponent is in background (lower Y), face away (Back)
    const opponentInForeground = opponent && opponent.y > entity.y;
    if (opponentInForeground && entity.animations && entity.animations[newState + 'Front']) {
        newState += 'Front';
    } else if (!opponentInForeground && entity.animations && entity.animations[newState + 'Back']) {
        newState += 'Back';
    }

    // State transition
    if (newState !== entity.currentState) {
        entity.currentState = newState;
        // Start at first frame of new animation
        const anim = entity.animations[newState];
        if (anim && anim.length > 0) {
            entity.frameIndex = anim[0];
        }
        entity.animTimer = 0;
    }

    // Animation cycle
    entity.animTimer++;
    if (entity.animTimer >= entity.animSpeed) {
        entity.animTimer = 0;
        const anim = entity.animations[entity.currentState];
        if (anim && anim.length > 0) {
            // Find current index in the animation array
            let currentIdxInAnim = anim.indexOf(entity.frameIndex);
            
            // If frame not found (bug safety), start over
            if (currentIdxInAnim === -1) currentIdxInAnim = 0;
            
            let nextIdx = currentIdxInAnim + 1;
            if (nextIdx >= anim.length) {
                nextIdx = 0; // Loop
            }
            entity.frameIndex = anim[nextIdx];
        }
    }
}

// Update game state
function update() {
    frame++;
    
    if (gameState === 'INTRO') {
        if (introState.phase === 'SLIDE') {
            introState.slideOffset *= 0.85; // Slide in
            if (introState.slideOffset < 5) {
                introState.slideOffset = 0;
                introState.phase = 'IMPACT';
                introState.vsScale = 5;
                playSound(100, 0.2, 'sawtooth'); // Impact sound
            }
        } else if (introState.phase === 'IMPACT') {
            introState.vsScale = Math.max(1, introState.vsScale * 0.8);
            if (introState.vsScale <= 1.1) {
                introState.vsScale = 1;
                introState.flashOpacity = 1;
                introState.phase = 'WAITING';
            }
        } else if (introState.phase === 'WAITING') {
            introState.flashOpacity = Math.max(0, introState.flashOpacity - 0.05);
            // Pulse VS
            introState.vsScale = 1 + Math.sin(frame * 0.1) * 0.05;
        }
        return;
    }
    
    if (gameState === 'KO_SEQUENCE') {
        koState.timer++;
        
        if (koState.phase === 'FREEZE') {
            // Brief freeze frame for impact
            if (koState.timer > 30) {
                koState.phase = 'POP';
                koState.timer = 0;
                playSound(200, 0.3, 'square'); // KO sound
            }
        } else if (koState.phase === 'POP') {
            // KO text pops up and scales
            if (koState.timer > 60) {
                koState.phase = 'FALL';
                koState.timer = 0;
                // Advance to falling frame of KO animation
                if (koState.loser.animations.ko && koState.loser.animations.ko.length > 1) {
                    koState.loser.frameIndex = koState.loser.animations.ko[1];
                }
            }
        } else if (koState.phase === 'FALL') {
            // Loser falls down
            if (koState.timer > 60) {
                koState.phase = 'DONE';
                koState.timer = 0;
            }
        } else if (koState.phase === 'DONE') {
            // Transition to game over
            if (koState.timer > 30) {
                gameState = 'GAME_OVER';
            }
        }
        return;
    }
    
    if (gameState !== 'PLAYING') return;
    
    // Player State Management
    player.moving = false;
    player.blocking = false;
    
    // Dodge Logic
    if (player.dodging) {
        player.dodgeTimer--;
        if (player.dodgeTimer <= 0) {
            player.dodging = false;
        }
    } else if (!player.punching && !player.hurt) {
        // Inputs
        if (keys['Shift']) {
            if (keys['ArrowDown']) {
                // Trigger Dodge
                player.dodging = true;
                player.dodgeTimer = 30; // 0.5s
                player.currentState = 'dodge';
                player.counterReady = false; // Reset counter opportunity
                playSound(200, 0.1, 'sine'); // Whoosh sound
            } else {
                // Hold Block
                player.blocking = true;
            }
        }
        
        // Movement (Disabled if blocking)
        if (!player.blocking) {
            let moved = false;
            if (keys['ArrowLeft']) { player.x -= 5; moved = true; player.moving = true; }
            if (keys['ArrowRight']) { player.x += 5; moved = true; player.moving = true; }
            if (keys['ArrowUp']) { player.y -= 5; moved = true; player.moving = true; }
            if (keys['ArrowDown']) { player.y += 5; moved = true; player.moving = true; }
            
            if (moved && frame % 10 === 0) playMoveSound();
        }
    }
    
    // Face opponent
    player.facingRight = opponent.x > player.x;
    
    // Update Animation
    updateAnimation(player, opponent);
    updateAnimation(opponent, player);
    
    // Keep player in bounds
    const ringSize = 300; 
    const ringCenterX = canvas.width / 2;
    const ringCenterY = canvas.height * 0.45;
    const ringMinX = ringCenterX - ringSize / 2;
    const ringMaxX = ringCenterX + ringSize / 2 - player.width;
    const ringMinY = ringCenterY - ringSize / 2;
    const ringMaxY = ringCenterY + ringSize / 2;
    
    player.x = Math.max(ringMinX, Math.min(ringMaxX, player.x));
    player.y = Math.max(ringMinY, Math.min(ringMaxY, player.y));
    
    // Update AI
    updateAI();
    
    // Keep AI in bounds
    opponent.x = Math.max(ringMinX, Math.min(ringMaxX - opponent.width + player.width, opponent.x));
    opponent.y = Math.max(ringMinY, Math.min(ringMaxY, opponent.y));
    
    // Update punch animations & Damage
    if (player.punching) {
        player.punchFrame++;
        if (player.punchFrame > 15) {
            player.punching = false;
            player.hasHit = false;
        }
        
        // Player hitting Opponent
        if (!player.hasHit && checkPunchCollision(player, opponent)) {
            player.hasHit = true;
            
            if (opponent.blocking) {
                opponent.health -= 2; // Chip damage
                playHitSound(); // Dull sound?
            } else {
                // Hit!
                let dmg = 15;
                if (player.counterReady) {
                    dmg = 30; // Counter Damage
                    player.counterReady = false;
                    // Visual/Sound feedback for counter?
                    playSound(300, 0.2, 'sawtooth'); // CRUNCH
                }
                opponent.health -= dmg;
                playHitSound();
                opponent.x += player.facingRight ? 30 : -30; // Knockback
            }
        }
    }
    
    if (opponent.punching) {
        opponent.punchFrame++;
        if (opponent.punchFrame > 15) {
            opponent.punching = false;
            opponent.hasHit = false;
        }
        
        // Opponent hitting Player
        if (checkPunchCollision(opponent, player)) {
            if (player.dodging) {
                // MISS due to dodge!
                // Trigger Counter Opportunity
                if (!opponent.hasHit) { // Only trigger once per swing
                     player.counterReady = true;
                     opponent.hasHit = true; // Mark as "missed" effectively
                     playSound(400, 0.1, 'sine'); // Miss sound (High pitch)
                }
            } else if (!opponent.hasHit) {
                opponent.hasHit = true;
                if (player.blocking) {
                    player.health -= 2; // Chip
                    playHitSound();
                } else {
                    player.health -= 15; // Ouch
                    playHitSound();
                    player.x += opponent.facingRight ? 30 : -30;
                }
            }
        }
    }
    
    // Check for game over
    if (player.health <= 0 || opponent.health <= 0) {
        if (gameState !== 'KO_SEQUENCE') {
            gameState = 'KO_SEQUENCE';
            koState.timer = 0;
            koState.phase = 'FREEZE';
            koState.loser = player.health <= 0 ? player : opponent;
            
            // Set Initial KO frame (Uppercut contact)
            koState.loser.currentState = 'ko';
            // Use first frame of KO animation
            if (koState.loser.animations.ko && koState.loser.animations.ko.length > 0) {
                koState.loser.frameIndex = koState.loser.animations.ko[0]; 
            }
            
            // Impact Sound
            playSound(100, 0.2, 'square'); 
        }
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw everything
    drawBackground();
    
    if (gameState !== 'LOADING' && gameState !== 'INTRO') {
        // Draw boxers sorted by Y position of their feet (smaller Y = further back, drawn first)
        const boxers = [player, opponent].sort((a, b) => (a.y + a.height) - (b.y + b.height));
        boxers.forEach(drawBoxer);
    }
    
    if (gameState === 'INTRO') {
        drawIntro();
    } else {
        drawUI();
    }
    
    // Update
    update();
    
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
