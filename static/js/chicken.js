const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 720;
canvas.height = 420;

let balance = 1000.00;
let gameState = 'IDLE'; // IDLE, PLAYING, WON, GAMEOVER
let currentLane = 0; // 0 = grass, 1 to 5 = lanes
let difficulty = 'easy';

const multipliers = [1.00, 1.44, 2.21, 3.45, 5.53, 9.09];

// Lanes: Vertical traffic columns
const lanes = [
    { x: 180, speed: 2.2, cars: [{y: 50, color: '#eab308'}, {y: 250, color: '#3b82f6'}] },
    { x: 280, speed: -2.8, cars: [{y: 100, color: '#ef4444'}, {y: 300, color: '#ffffff'}] },
    { x: 380, speed: 3.2, cars: [{y: 80, color: '#06b6d4'}, {y: 280, color: '#a855f7'}] },
    { x: 480, speed: -3.8, cars: [{y: 150, color: '#eab308'}, {y: 320, color: '#22c55e'}] },
    { x: 580, speed: 4.2, cars: [{y: 50, color: '#ef4444'}, {y: 200, color: '#ffffff'}] }
];

let chicken = { x: 60, y: 200 };

const playBtn = document.getElementById('playBtn');
const playingActionBtns = document.getElementById('playingActionBtns');
const cashoutBtn = document.getElementById('cashoutBtn');
const cashoutAmt = document.getElementById('cashoutAmt');
const goBtn = document.getElementById('goBtn');

function setBetVal(val) {
    if (gameState === 'PLAYING') return;
    document.getElementById('betMultiplierInput').value = val;
}
function setBetMin() { setBetVal(2); }
function setBetMax() { setBetVal(20); }

function setDifficulty(diff, btn) {
    if (gameState === 'PLAYING') return;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = diff;
}

function getBetAmount() {
    return parseFloat(document.getElementById('betMultiplierInput').value) || 3.00;
}

// 1. Play Button Click (Start Game)
function startPlay() {
    let bet = getBetAmount();
    if (balance < bet) {
        alert("Insufficient Balance!");
        return;
    }
    balance -= bet;
    updateBalance();
    gameState = 'PLAYING';
    currentLane = 0;
    chicken.x = 60;

    playBtn.style.display = 'none';
    playingActionBtns.style.display = 'flex';
    updateCashoutDisplay();
}

// 2. GO Button Click (Move to next lane & place barrier)
function goNextLane() {
    if (gameState === 'PLAYING' && currentLane < 5) {
        let risk = difficulty === 'easy' ? 0.05 : difficulty === 'medium' ? 0.15 : difficulty === 'hard' ? 0.25 : 0.40;
        if (currentLane >= 1 && Math.random() < risk) {
            gameState = 'GAMEOVER';
            endGame("CRASHED! PLAY AGAIN", "#ef4444");
            return;
        }

        currentLane++;
        if (currentLane === 5) {
            gameState = 'WON';
            let winAmt = (getBetAmount() * multipliers[5]).toFixed(2);
            balance += parseFloat(winAmt);
            updateBalance();
            endGame(`WON ₹${winAmt}! PLAY AGAIN`, "#22c55e");
        } else {
            updateCashoutDisplay();
        }
    }
}

// 3. CASH OUT Button Click
function cashOutGame() {
    if (gameState === 'PLAYING' && currentLane > 0) {
        let winAmt = (getBetAmount() * multipliers[currentLane]).toFixed(2);
        balance += parseFloat(winAmt);
        updateBalance();
        gameState = 'WON';
        endGame(`CASHED OUT ₹${winAmt}! PLAY AGAIN`, "#22c55e");
    }
}

function updateCashoutDisplay() {
    let amt = (getBetAmount() * multipliers[currentLane]).toFixed(1);
    cashoutAmt.innerText = amt;
}

function endGame(text, bgColor) {
    playingActionBtns.style.display = 'none';
    playBtn.style.display = 'block';
    playBtn.innerText = text;
    playBtn.style.background = bgColor;
}

function updateBalance() {
    document.getElementById('balanceDisplay').innerText = `₹${balance.toFixed(2)} Ⓢ`;
}

function update() {
    lanes.forEach((lane, index) => {
        // If barrier is placed on this lane (meaning chicken has crossed or is past this lane), stop cars!
        if (index < currentLane) return;

        let speedMult = difficulty === 'medium' ? 1.3 : difficulty === 'hard' ? 1.6 : difficulty === 'hardcore' ? 2.0 : 1.0;
        lane.cars.forEach(car => {
            car.y += lane.speed * speedMult;
            if (car.y > canvas.height + 40) car.y = -60;
            if (car.y < -60) car.y = canvas.height + 40;

            // Collision check
            if (gameState === 'PLAYING' && currentLane === index + 1) {
                if (Math.abs(chicken.y - car.y) < 30 && Math.abs(chicken.x - lane.x) < 30) {
                    gameState = 'GAMEOVER';
                    endGame("CRASHED! PLAY AGAIN", "#ef4444");
                }
            }
        });
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Left Sidewalk / Grass Area
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 120, canvas.height);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(100, 0, 20, canvas.height);

    ctx.font = '45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🌳', 60, 100);
    ctx.fillText('🌳', 60, 280);

    // 2. Asphalt Road Background
    ctx.fillStyle = '#374151';
    ctx.fillRect(120, 0, canvas.width - 120, canvas.height);

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]);
    for (let i = 1; i < 5; i++) {
        let xPos = 120 + (i * 100);
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, canvas.height);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Manhole Circles with Multipliers
    lanes.forEach((lane, index) => {
        let circleX = lane.x;
        let circleY = 340;

        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(circleX, circleY, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${multipliers[index + 1]}x`, circleX, circleY + 5);
    });

    // 4. Draw Barriers (`🚧`) on lanes that chicken has already crossed!
    for (let i = 0; i < currentLane; i++) {
        let barrierX = lanes[i].x;
        ctx.font = '35px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🚧', barrierX, 180);
    }

    // 5. Vertical Moving Cars (Stopped if barrier is active)
    lanes.forEach((lane, index) => {
        if (index < currentLane) return; // Cars don't move past barrier

        lane.cars.forEach(car => {
            ctx.fillStyle = car.color;
            ctx.fillRect(lane.x - 22, car.y, 44, 55);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(lane.x - 16, car.y + 10, 32, 16);
        });
    });

    // 6. Chicken Position (Lands directly inside the active multiplier circle)
    let targetX = currentLane === 0 ? 60 : lanes[currentLane - 1].x;
    chicken.x += (targetX - chicken.x) * 0.2;
    chicken.y = currentLane === 0 ? 200 : 310; // Moves down into the manhole circle as it progresses!

    ctx.font = '40px Arial';
    let chickenEmoji = gameState === 'GAMEOVER' ? '💥' : '🐔';
    ctx.fillText(chickenEmoji, chicken.x, chicken.y);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();