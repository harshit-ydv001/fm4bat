import asyncio
import json
import sqlite3

from fastapi import FastAPI, Form, Request, WebSocket
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.game.crash.router import router as crash_router
from app.game.websocket import engine, manager

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(crash_router)

templates = Jinja2Templates(directory="templates")

# Initialize SQLite Database for Permanent User Storage
def init_db():
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            identifier TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT
        )
    """)
    cursor.execute("INSERT OR IGNORE INTO users (identifier, username, password) VALUES (?, ?, ?)", 
                   ("admin", "admin", "admin123"))
    conn.commit()
    conn.close()

init_db()


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(engine.start_all())


@app.get("/", response_class=HTMLResponse)
async def root_login(request: Request):
    username = request.cookies.get("session_user")
    if username:
        return RedirectResponse(url="/dashboard", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
async def login_user(identifier: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT username, password FROM users WHERE identifier = ? OR username = ?", (identifier, identifier))
    row = cursor.fetchone()
    conn.close()

    if row and row[1] == password:
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(key="session_user", value=row[0])
        return response
        
    return RedirectResponse(url="/?error=InvalidCredentials", status_code=303)


@app.post("/signup")
async def signup_user(
    username: str = Form(...),
    identifier: str = Form(...),
    password: str = Form(...),
):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()

    # Check if username already exists
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return RedirectResponse(url="/?error=UsernameTaken", status_code=303)

    # Check if identifier already exists
    cursor.execute("SELECT * FROM users WHERE identifier = ?", (identifier,))
    if cursor.fetchone():
        conn.close()
        return RedirectResponse(url="/?error=EmailAlreadyRegistered", status_code=303)

    cursor.execute("INSERT INTO users (identifier, username, password) VALUES (?, ?, ?)", (identifier, username, password))
    conn.commit()
    conn.close()

    response = RedirectResponse(url="/dashboard", status_code=303)
    response.set_cookie(key="session_user", value=username)
    return response


@app.post("/forgot-password")
async def forgot_password(identifier: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()

    cursor.execute("SELECT identifier FROM users WHERE identifier = ? OR username = ?", (identifier, identifier))
    row = cursor.fetchone()

    if row:
        cursor.execute("UPDATE users SET password = ? WHERE identifier = ?", (password, row[0]))
        conn.commit()
        conn.close()
        return RedirectResponse(url="/?success=PasswordReset", status_code=303)

    conn.close()
    return RedirectResponse(url="/?error=UserNotFound", status_code=303)


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "username": username}
    )


@app.get("/account", response_class=HTMLResponse)
async def account_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse("account.html", {"request": request, "username": username})


@app.get("/logout")
async def logout_user():
    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie(key="session_user")
    return response


@app.get("/games/crash", response_class=HTMLResponse)
async def crash_game_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse("crash.html", {"request": request, "username": username})


@app.websocket("/ws/crash")
async def crash_websocket(websocket: WebSocket):
    mode = websocket.query_params.get("mode", "token")
    await manager.connect(websocket, mode)
    
    game_instance = engine.token_engine if mode == "token" else engine.real_engine

    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            action = parsed.get("action")

            if action == "PLACE_BET":
                amount = parsed.get("amount")
                username = parsed.get("username", "Player")
                user_key = f"user_{id(websocket)}"
                game_instance.active_bets[user_key] = {
                    "username": username,
                    "amount": float(amount),
                    "cashed_out": False,
                    "payout": 0.0,
                    "is_bot": False
                }
            elif action == "CASH_OUT":
                username = parsed.get("username", "Player")
                for bet in game_instance.active_bets.values():
                    if bet.get("username") == username and not bet.get("cashed_out"):
                        bet["cashed_out"] = True
                        bet["multiplier"] = game_instance.multiplier
                        bet["payout"] = round(bet["amount"] * game_instance.multiplier, 2)
                        break
            elif action == "SWITCH_MODE":
                new_mode = parsed.get("mode", "token")
                manager.set_mode(websocket, new_mode)
            elif action == "SET_CRASH":
                target = parsed.get("target")
                if mode == "token":
                    engine.token_engine.forced_crash = target
                else:
                    engine.real_engine.forced_crash = target
    except (asyncio.CancelledError, RuntimeError):
        manager.disconnect(websocket)