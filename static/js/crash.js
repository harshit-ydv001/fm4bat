let ws;
let balance = 1000.00;
let realBalance = 0.00;
let currentWager = 0;
let isPlaying = false;
let hasCashedOut = false;
let roundInProgress = false;
let currentMode = 'token';

function connectWebSocket() {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Fixed clean WebSocket URL for robust routing on Render
    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/crash?mode=${currentMode}`);

    ws.onopen = function() {
        console.log("WebSocket Connected Successfully!");
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const display = document.getElementById("multiplier-display");
        const status = document.getElementById("game-status");
        const plane = document.getElementById("plane");
        const actionBtn = document.getElementById("btn-action");

        if (data.history) {
            updateHistoryBar(data.history);
        }

        if (data.type === "ROUND_READY") {
            roundInProgress = false;
            status.innerText = "WAITING FOR TAKE OFF";
            status.style.color = "#fbbf24";
            display.innerText = "1.00x";
            display.style.color = "#34d399";
            if(plane) plane.style.transform = `translate(0px, 0px) rotate(0deg)`;
            
            if (!isPlaying && actionBtn) {
                actionBtn.innerText = "PLACE BET";
                actionBtn.style.background = "#059669";
                actionBtn.style.cursor = "pointer";
                actionBtn.disabled = false;
            }
        } 
        else if (data.type === "ROUND_STARTED") {
            roundInProgress = true;
            status.innerText = "FLIGHT IN PROGRESS ✈️";
            status.style.color = "#34d399";
            if(plane) plane.style.transform = `translate(0px, 0px) rotate(0deg)`;
            
            if (isPlaying && !hasCashedOut && actionBtn) {
                actionBtn.innerText = "CASH OUT";
                actionBtn.style.background = "#f59e0b";
                actionBtn.style.cursor = "pointer";
                actionBtn.disabled = false;
            } else if (actionBtn) {
                actionBtn.innerText = "WAIT FOR NEXT ROUND";
                actionBtn.style.background = "#1f2937";
                actionBtn.style.cursor = "not-allowed";
                actionBtn.disabled = true;
            }
        } 
        else if (data.type === "TICK") {
            if(display) display.innerText = data.multiplier.toFixed(2) + "x";
            status.innerText = "MULTIPLIER RISING 🚀";
            status.style.color = "#34d399";
            
            let xPos = Math.min((data.multiplier - 1) * 70, 260);
            let yPos = Math.min((data.multiplier - 1) * 50, 160);
            if(plane) plane.style.transform = `translate(${xPos}px, -${yPos}px) rotate(-15deg)`;

            if (isPlaying && !hasCashedOut && actionBtn) {
                actionBtn.innerText = `CASH OUT (${(currentWager * data.multiplier).toFixed(2)})`;
                actionBtn.style.background = "#f59e0b";
                actionBtn.disabled = false;
            }
        } 
        else if (data.type === "ROUND_CRASHED") {
            roundInProgress = false;
            if(display) {
                display.innerText = data.multiplier.toFixed(2) + "x (CRASHED)";
                display.style.color = "#f87171";
            }
            status.innerText = "ROUND CRASHED 💥";
            status.style.color = "#f87171";
            if(plane) plane.style.transform = `translate(300px, 40px) rotate(45deg)`;

            isPlaying = false;
            hasCashedOut = false;
            if(actionBtn) {
                actionBtn.innerText = "PLACE BET";
                actionBtn.style.background = "#059669";
                actionBtn.style.cursor = "pointer";
                actionBtn.disabled = false;
            }
        }

        if (data.bets || data.active_bets) {
            updateLiveBetsUI(data.bets || data.active_bets);
        }
    };

    ws.onerror = function(error) {
        console.error("WebSocket Error:", error);
    };

    ws.onclose = function() {
        console.log("WebSocket Closed. Reconnecting in 1.5s...");
        setTimeout(function() {
            connectWebSocket();
        }, 1500);
    };
}

function handleWagerAction() {
    const amountInput = document.getElementById("bet-amount");
    const actionBtn = document.getElementById("btn-action");
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
        alert("Please enter a valid bet amount!");
        return;
    }

    if (currentMode === 'token') {
        if (amount > balance) { alert("Insufficient Token Balance!"); return; }
    } else {
        if (amount > realBalance) { alert("Insufficient Real Money Balance!"); return; }
    }

    if (!roundInProgress && !isPlaying) {
        currentWager = amount;
        if (currentMode === 'token') balance -= amount;
        else realBalance -= amount;
        updateBalanceDisplay();

        isPlaying = true;
        hasCashedOut = false;
        
        actionBtn.innerText = "BET PLACED (WAITING...)";
        actionBtn.style.background = "#374151";
        actionBtn.disabled = true;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "PLACE_BET", amount: amount, mode: currentMode }));
        }
    } 
    else if (roundInProgress && isPlaying && !hasCashedOut) {
        hasCashedOut = true;
        let winAmount = currentWager * parseFloat(document.getElementById("multiplier-display").innerText);
        
        if (currentMode === 'token') balance += winAmount;
        else realBalance += winAmount;
        updateBalanceDisplay();

        actionBtn.innerText = `CASHED OUT (${winAmount.toFixed(2)})`;
        actionBtn.style.background = "#10b981";
        actionBtn.disabled = true;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "CASH_OUT", mode: currentMode }));
        }
    }
}

// Secret Shortcut: Ctrl + Shift + Q to fix next crash
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && (event.key === 'Q' || event.key === 'q')) {
        event.preventDefault();
        let val = prompt("Enter custom crash multiplier for next round (e.g., 3.50):");
        if (val !== null && !isNaN(val) && parseFloat(val) >= 1.00) {
            let target = parseFloat(val);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "SET_CRASH", target: target, mode: currentMode }));
                alert(`Next round crash set to ${target.toFixed(2)}x for ${currentMode.toUpperCase()} mode!`);
            }
        }
    }
});

function updateBalanceDisplay() {
    const balanceEl = document.getElementById('token-balance');
    if (!balanceEl) return;
    if (currentMode === 'token') {
        balanceEl.innerText = balance.toFixed(2);
    } else {
        balanceEl.innerText = realBalance.toFixed(2);
    }
}

function updateHistoryBar(historyArr) {
    const bar = document.getElementById("history-bar");
    if (!bar) return;
    bar.innerHTML = "";

    let reversedHistory = [...historyArr].reverse();

    reversedHistory.slice(0, 20).forEach(val => {
        let pill = document.createElement("span");
        pill.className = "history-pill " + (val < 2.00 ? "pill-red" : "pill-green");
        pill.innerText = val.toFixed(2) + "x";
        bar.appendChild(pill);
    });
}

function updateLiveBetsUI(betsObj) {
    const listContainer = document.getElementById("live-bets-list");
    const countEl = document.getElementById("player-count");
    if (!listContainer || !countEl) return;
    
    listContainer.innerHTML = "";
    let keys = Object.keys(betsObj);
    countEl.innerText = keys.length;

    keys.forEach(uid => {
        let bet = betsObj[uid];
        let row = document.createElement("div");
        row.className = "bet-row";
        let statusText = bet.cashed_out ? `<span class="cashed-tag">${bet.multiplier.toFixed(2)}x</span>` : `<span>${bet.amount}</span>`;
        row.innerHTML = `<strong>${bet.username}</strong> ${statusText}`;
        listContainer.appendChild(row);
    });
}

function switchGameMode(mode) {
    currentMode = mode;
    isPlaying = false;
    hasCashedOut = false;
    roundInProgress = false;
    
    const tokenBtn = document.getElementById('btn-token-mode');
    const realBtn = document.getElementById('btn-real-mode');
    const balanceLabel = document.getElementById('balance-label');
    const currencySymbol = document.getElementById('currency-symbol');
    const wagerLabel = document.getElementById('wager-label');

    if (mode === 'token') {
        if(tokenBtn) tokenBtn.className = "mode-btn active-token";
        if(realBtn) realBtn.className = "mode-btn";
        if(balanceLabel) balanceLabel.innerText = "Token Balance:";
        if(currencySymbol) currencySymbol.innerText = "🪙";
        if(wagerLabel) wagerLabel.innerText = "Bet Amount (Tokens)";
    } else {
        if(realBtn) realBtn.className = "mode-btn active-real";
        if(tokenBtn) tokenBtn.className = "mode-btn";
        if(balanceLabel) balanceLabel.innerText = "Real Money Balance:";
        if(currencySymbol) currencySymbol.innerText = "₹";
        if(wagerLabel) wagerLabel.innerText = "Bet Amount (₹ INR)";
    }
    updateBalanceDisplay();

    if (ws) ws.close();
    connectWebSocket();
}

function setBet(val) { document.getElementById("bet-amount").value = val; }
function openAddMoneyModal() { document.getElementById('add-money-modal').style.display = 'flex'; }
function closeAddMoneyModal() { document.getElementById('add-money-modal').style.display = 'none'; }

function submitDepositRequest() {
    const amt = parseFloat(document.getElementById('deposit-amount').value);
    if (!amt) return;
    realBalance += amt;
    if (currentMode === 'real') updateBalanceDisplay();
    alert(`Deposit of ₹${amt} successful!`);
    closeAddMoneyModal();
}

connectWebSocket();