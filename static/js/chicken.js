const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 480;
canvas.height = 380;

let gameState = 'IDLE'; // IDLE, PLAYING, WON, GAMEOVER
let currentLane = 0; // 0 = grass, 1 to 5 = lanes
let difficulty = 'easy';

const multipliers = [1.00, 1.44, 2.21, 3.45, 5.53, 9.09];

// Horizontal lanes configuration matching reference
const lanes = [
    { y: 320, speed: 0, cars: [] },
    { y: 260, speed: 2.0, cars: [{x: 50, color: '#eab308'}, {x: 280, color: '#3b82f6'}] },
    { y: 200, speed: -2.5, cars: [{x: 100, color: '#ef4444'}, {x: 350, color: '#ffffff'}] },
    { y: 140, speed: 3.0, cars: [{x: 80, color: '#06b6d4'}, {x: 300, color: '#a855f7'}] },
    { y: 80, speed: -3.5, cars: [{x: 150, color: '#eab308'}, {x: 380, color: '#22c55e'}] },
    { y: 20, speed: 4.0, cars: [{x: 200, color: '#ef4444'}, {x: 400, color: '#ffffff'}] }
];

let chicken = { x: 30, y: 320 };

const actionBtn = document.getElementById('actionBtn');
const betInput = document.getElementById('betAmount');

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (gameState === 'PLAYING') return;
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        difficulty = e.target.dataset.diff;
    });
});

// Bet buttons
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

// Main Action Button logic
actionBtn.addEventListener('click', () => {
    if (gameState === 'IDLE' || gameState === 'GAMEOVER' || gameState === 'WON') {
        startGame();
    } else if (gameState === 'PLAYING') {
        stepForward();
    }
});

function startGame() {
    gameState = 'PLAYING';
    currentLane = 0;
    chicken.x = 30;
    chicken.y = lanes[0].y;
    actionBtn.innerText = "GO / NEXT LANE";
    actionBtn.style.background = "#eab308";
}

function stepForward() {
    if (currentLane < 5) {
        let risk = difficulty === 'easy' ? 0.05 : difficulty === 'medium' ? 0.15 : difficulty === 'hard' ? 0.25 : 0.40;
        if (currentLane >= 1 && Math.random() < risk) {
            gameState = 'GAMEOVER';
            actionBtn.innerText = "CRASHED! PLAY AGAIN";
            actionBtn.style.background = "#ef4444";
            return;
        }

        currentLane++;
        chicken.y = lanes[currentLane].y;

        if (currentLane === 5) {
            gameState = 'WON';
            let winAmt = (parseFloat(betInput.value) * multipliers[5]).toFixed(2);
            actionBtn.innerText = `WON ₹${winAmt}! PLAY AGAIN`;
            actionBtn.style.background = "#22c55e";
        } else {
            actionBtn.innerText = `CASH OUT / NEXT (${multipliers[currentLane]}x)`;
            actionBtn.style.background = "#22c55e";
        }
    }
}

function update() {
    lanes.forEach((lane, index) => {
        if (index === 0) return;
        let speedMult = difficulty === 'medium' ? 1.3 : difficulty === 'hard' ? 1.6 : difficulty === 'hardcore' ? 2.0 : 1.0;
        lane.cars.forEach(car => {
            car.x += lane.speed * speedMult;
            if (car.x > canvas.width + 40) car.x = -60;
            if (car.x < -60) car.x = canvas.width + 40;

            if (gameState === 'PLAYING' && currentLane === index) {
                if (Math.abs(chicken.x - car.x) < 30) {
                    gameState = 'GAMEOVER';
                    actionBtn.innerText = "CRASHED! PLAY AGAIN";
                    actionBtn.style.background = "#ef4444";
                }
            }
        });
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Left Grass Area (Sidewalk & Tree)
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 70, canvas.height);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(55, 0, 15, canvas.height);

    // Tree icon on grass
    ctx.font = '35px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🌳', 35, 70);
    ctx.fillText('🌳', 35, 190);
    ctx.fillText('🌳', 35, 310);

    // 2. Asphalt Road
    ctx.fillStyle = '#334155';
    ctx.fillRect(70, 0, canvas.width - 70, canvas.height);

    // Horizontal dashed lane lines
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (let i = 1; i < 6; i++) {
        let yPos = i * 60;
        ctx.beginPath();
        ctx.moveTo(70, yPos);
        ctx.lineTo(canvas.width, yPos);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Manhole Circles with Multipliers (Right side on lanes)
    lanes.forEach((lane, index) => {
        if (index === 0) return;
        let circleX = 300 + (index * 32);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(circleX, lane.y + 30, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${multipliers[index]}x`, circleX, lane.y + 34);
    });

    // 4. Moving Cars
    lanes.forEach((lane, index) => {
        if (index === 0) return;
        lane.cars.forEach(car => {
            ctx.fillStyle = car.color;
            ctx.fillRect(car.x, lane.y + 12, 45, 28);
            // Windshield
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(car.x + 8, lane.y + 16, 16, 10);
        });
    });

    // 5. Chicken Position Animation
    let targetX = currentLane === 0 ? 35 : 120 + (currentLane * 35);
    chicken.x += (targetX - chicken.x) * 0.2;

    ctx.font = '28px Arial';
    let chickenEmoji = gameState === 'GAMEOVER' ? '💥' : '🐔';
    ctx.fillText(chickenEmoji, chicken.x, chicken.y + 35);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();