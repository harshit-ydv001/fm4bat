const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 720;
canvas.height = 420;

let balance = 1000.00;
let gameState = 'IDLE'; // IDLE, PLAYING, WON, GAMEOVER
let currentLane = 0; // 0 = grass, 1 to 5 = lanes
let difficulty = 'easy';

const multipliers = [1.00, 1.44, 2.21, 3.45, 5.53, 9.09];

// Lanes: Vertical traffic
const lanes = [
    { x: 180, speed: 2.0, cars: [{y: 50, color: '#eab308'}, {y: 250, color: '#3b82f6'}] },
    { x: 280, speed: -2.5, cars: [{y: 100, color: '#ef4444'}, {y: 300, color: '#ffffff'}] },
    { x: 380, speed: 3.0, cars: [{y: 80, color: '#06b6d4'}, {y: 280, color: '#a855f7'}] },
    { x: 480, speed: -3.5, cars: [{y: 150, color: '#eab308'}, {y: 320, color: '#22c55e'}] },
    { x: 580, speed: 4.0, cars: [{y: 50, color: '#ef4444'}, {y: 200, color: '#ffffff'}] }
];

let chicken = { x: 50, y: 200 };

const actionBtn = document.getElementById('actionBtn');
const betInput = document.getElementById('betAmount');

// Create Cashout & GO buttons dynamically if not present inside controls-section
const controlsSection = document.querySelector('.controls-section');
let actionContainer = document.getElementById('gameActionContainer');

if (!actionContainer) {
    actionContainer = document.createElement('div');
    actionContainer.id = 'gameActionContainer';
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '10px';
    actionContainer.innerHTML = `
        <button id="cashoutBtn" style="display:none; flex:1; background:#eab308; color:#000; border:none; padding:15px; font-size:16px; font-weight:900; border-radius:8px; cursor:pointer;">CASH OUT</button>
        <button id="goBtn" style="display:none; flex:1; background:#22c55e; color:#fff; border:none; padding:15px; font-size:16px; font-weight:900; border-radius:8px; cursor:pointer;">GO</button>
    `;
    controlsSection.appendChild(actionContainer);
}

const cashoutBtn = document.getElementById('cashoutBtn');
const goBtn = document.getElementById('goBtn');

// Difficulty selector
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (gameState === 'PLAYING') return;
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        difficulty = e.target.dataset.diff;
    });
});

// Bet controls
document.getElementById('decreaseBet').addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    let val = parseFloat(betInput.value) || 1;
    if (val > 1) betInput.value = (val - 1).toFixed(2);
});
document.getElementById('increaseBet').addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    let val = parseFloat(betInput.value) || 1;
    betInput.value = (val + 1).toFixed(2);
});

// Play Button Click (Starts Game)
actionBtn.addEventListener('click', () => {
    let bet = parseFloat(betInput.value) || 1.00;
    if (balance < bet) {
        alert("Insufficient Balance!");
        return;
    }
    balance -= bet;
    updateBalance();
    gameState = 'PLAYING';
    currentLane = 0;
    chicken.x = 50;

    actionBtn.style.display = 'none';
    cashoutBtn.style.display = 'block';
    goBtn.style.display = 'block';
    updateCashoutText();
});

// GO Button Click (Continue to next lane)
goBtn.addEventListener('click', () => {
    if (gameState === 'PLAYING' && currentLane < 5) {
        let risk = difficulty === 'easy' ? 0.05 : difficulty === 'medium' ? 0.15 : difficulty === 'hard' ? 0.25 : 0.40;
        if (currentLane >= 1 && Math.random() < risk) {
            gameState = 'GAMEOVER';
            endGameUI("CRASHED! PLAY AGAIN", "#ef4444");
            return;
        }

        currentLane++;
        if (currentLane === 5) {
            gameState = 'WON';
            let winAmt = (parseFloat(betInput.value) * multipliers[5]).toFixed(2);
            balance += parseFloat(winAmt);
            updateBalance();
            endGameUI(`WON ₹${winAmt}! PLAY AGAIN`, "#22c55e");
        } else {
            updateCashoutText();
        }
    }
});

// CASH OUT Button Click (Secure win and exit)
cashoutBtn.addEventListener('click', () => {
    if (gameState === 'PLAYING' && currentLane > 0) {
        let winAmt = (parseFloat(betInput.value) * multipliers[currentLane]).toFixed(2);
        balance += parseFloat(winAmt);
        updateBalance();
        gameState = 'WON';
        endGameUI(`CASHED OUT ₹${winAmt}! PLAY AGAIN`, "#22c55e");
    }
});

function updateCashoutText() {
    let currentWin = (parseFloat(betInput.value) * multipliers[currentLane]).toFixed(2);
    cashoutBtn.innerText = `CASH OUT ₹${currentWin}`;
}

function endGameUI(text, bgColor) {
    cashoutBtn.style.display = 'none';
    goBtn.style.display = 'none';
    actionBtn.style.display = 'block';
    actionBtn.innerText = text;
    actionBtn.style.background = bgColor;
}

function updateBalance() {
    const headerBal = document.querySelector('.game-header span:last-child');
    if (headerBal) headerBal.innerText = `Balance: ₹${balance.toFixed(2)}`;
}

function update() {
    lanes.forEach((lane, index) => {
        let speedMult = difficulty === 'medium' ? 1.3 : difficulty === 'hard' ? 1.6 : difficulty === 'hardcore' ? 2.0 : 1.0;
        lane.cars.forEach(car => {
            car.y += lane.speed * speedMult;
            if (car.y > canvas.height + 40) car.y = -60;
            if (car.y < -60) car.y = canvas.height + 40;

            if (gameState === 'PLAYING' && currentLane === index + 1) {
                if (Math.abs(chicken.y - car.y) < 30 && Math.abs(chicken.x - lane.x) < 30) {
                    gameState = 'GAMEOVER';
                    endGameUI("CRASHED! PLAY AGAIN", "#ef4444");
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

    // 4. Vertical Moving Cars
    lanes.forEach((lane) => {
        lane.cars.forEach(car => {
            ctx.fillStyle = car.color;
            ctx.fillRect(lane.x - 22, car.y, 44, 55);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(lane.x - 16, car.y + 10, 32, 16);
        });
    });

    // 5. Chicken Position
    let targetX = currentLane === 0 ? 60 : lanes[currentLane - 1].x;
    chicken.x += (targetX - chicken.x) * 0.2;
    chicken.y = 200;

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