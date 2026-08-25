const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas dimensions setup
canvas.width = 400;
canvas.height = 350;

let gameState = 'IDLE'; // IDLE, PLAYING, GAMEOVER, WON
let currentLane = 0; // 0 is start, 1 to 5 are lanes
let betAmount = 1.00;
let currentMultiplier = 1.00;
let difficulty = 'easy';

const multipliers = [1.00, 1.10, 1.25, 1.50, 1.80, 2.20];

// Lanes configuration (y positions)
const lanes = [
    { y: 300, cars: [], speed: 0 }, // Start platform
    { y: 250, cars: [], speed: 2 },
    { y: 200, cars: [], speed: -3 },
    { y: 150, cars: [], speed: 2.5 },
    { y: 100, cars: [], speed: -3.5 },
    { y: 50, cars: [], speed: 4 }  // Finish line
];

// Initialize cars based on difficulty
function setupDifficulty() {
    let speedMultiplier = 1;
    if (difficulty === 'medium') speedMultiplier = 1.3;
    if (difficulty === 'hard') speedMultiplier = 1.7;
    if (difficulty === 'hardcore') speedMultiplier = 2.2;

    lanes.forEach((lane, index) => {
        if (index === 0 || index === 5) return;
        lane.cars = [
            { x: 50, width: 40, color: '#ef4444' },
            { x: 220, width: 40, color: '#eab308' }
        ];
        lane.currentSpeed = lane.speed * speedMultiplier;
    });
}

// Chicken object
let chicken = {
    x: 180,
    y: 300,
    size: 20
};

// Set difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (gameState === 'PLAYING') return;
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        difficulty = e.target.dataset.diff;
        setupDifficulty();
    });
});

// Bet amount controls
const betInput = document.getElementById('betAmount');
document.getElementById('decreaseBet').addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    let val = parseFloat(betInput.value) || 1;
    if (val > 1) {
        betInput.value = (val - 1).toFixed(2);
    }
});
document.getElementById('increaseBet').addEventListener('click', () => {
    if (gameState === 'PLAYING') return;
    let val = parseFloat(betInput.value) || 1;
    betInput.value = (val + 1).toFixed(2);
});

// Action Button Logic
const actionBtn = document.getElementById('actionBtn');
actionBtn.addEventListener('click', () => {
    if (gameState === 'IDLE' || gameState === 'GAMEOVER' || gameState === 'WON') {
        startGame();
    } else if (gameState === 'PLAYING') {
        moveChickenForward();
    }
});

function startGame() {
    betAmount = parseFloat(betInput.value) || 1.00;
    gameState = 'PLAYING';
    currentLane = 0;
    currentMultiplier = multipliers[0];
    chicken.x = 180;
    chicken.y = lanes[0].y;
    setupDifficulty();
    actionBtn.innerText = "TAP TO CROSS LANE";
    actionBtn.style.background = "#eab308";
}

function moveChickenForward() {
    if (currentLane < 5) {
        currentLane++;
        chicken.y = lanes[currentLane].y;
        currentMultiplier = multipliers[currentLane];

        if (currentLane === 5) {
            // Won the game!
            gameState = 'WON';
            let winnings = (betAmount * currentMultiplier).toFixed(2);
            actionBtn.innerText = `COLLECTED ₹${winnings}! PLAY AGAIN`;
            actionBtn.style.background = "#22c55e";
        } else {
            actionBtn.innerText = `COLLECT / NEXT (${currentMultiplier}x)`;
        }
    }
}

// Game Loop
function update() {
    if (gameState === 'PLAYING') {
        // Move cars
        lanes.forEach((lane, index) => {
            if (index === 0 || index === 5) return;
            lane.cars.forEach(car => {
                car.x += lane.currentSpeed;
                if (car.x > canvas.width) car.x = -car.width;
                if (car.x < -car.width) car.x = canvas.width;

                // Collision Detection with Chicken in current lane
                if (currentLane === index) {
                    if (chicken.x < car.x + car.width &&
                        chicken.x + chicken.size > car.x &&
                        chicken.y < lane.y + 25 &&
                        chicken.y + chicken.size > lane.y) {
                        // Crash!
                        gameState = 'GAMEOVER';
                        actionBtn.innerText = "CRASHED! PLAY AGAIN";
                        actionBtn.style.background = "#ef4444";
                    }
                }
            });
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Lanes & Roads
    lanes.forEach((lane, index) => {
        if (index > 0 && index < 5) {
            ctx.fillStyle = '#374151';
            ctx.fillRect(0, lane.y, canvas.width, 30);

            // Draw Cars
            lane.cars.forEach(car => {
                ctx.fillStyle = car.color;
                ctx.fillRect(car.x, lane.y + 5, car.width, 20);
            });
        }
    });

    // Draw Multiplier info on lanes
    lanes.forEach((lane, index) => {
        if (index > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '12px Arial';
            ctx.fillText(`${multipliers[index]}x`, 10, lane.y + 20);
        }
    });

    // Draw Chicken
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(chicken.x + 10, chicken.y + 10, 10, 0, Math.PI * 2);
    ctx.fill();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

setupDifficulty();
loop();