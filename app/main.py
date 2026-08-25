import asyncio
import json
import random
import sqlite3

from fastapi import FastAPI, Form, Request, WebSocket
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.game.websocket import engine, manager

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

otp_store = {}
DB_FILE = "users.db"


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                identifier TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                balance REAL DEFAULT 1000.00
            )
        """
        )
        cursor.execute(
            "SELECT * FROM users WHERE identifier = ?", ("admin",)
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (identifier, username, password, balance) VALUES (?, ?, ?, ?)",
                ("admin", "admin", "admin123", 10000.0),
            )
        conn.commit()
        cursor.close()
        conn.close()
        print("Database Initialized Successfully!")
    except sqlite3.Error as db_error:
        print(f"Database Initialization Error: {db_error}")


init_db()


@app.on_event("startup")
async def startup_event():
    try:
        asyncio.create_task(engine.start_all())
    except RuntimeError as e:
        print(f"Engine Startup Error: {e}")


@app.get("/", response_class=HTMLResponse)
async def root_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
async def login_user(identifier: str = Form(...), password: str = Form(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, password FROM users WHERE identifier = ? OR username = ?",
        (identifier, identifier),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row and row["password"] == password:
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(key="session_user", value=row["username"], httponly=True)
        return response

    return RedirectResponse(url="/?error=InvalidCredentials", status_code=303)


@app.post("/signup")
async def signup_user(
    username: str = Form(...),
    identifier: str = Form(...),
    password: str = Form(...),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return RedirectResponse(url="/?error=UsernameTaken", status_code=303)

    cursor.execute("SELECT * FROM users WHERE identifier = ?", (identifier,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return RedirectResponse(
            url="/?error=EmailAlreadyRegistered", status_code=303
        )

    cursor.close()
    conn.close()

    generated_otp = str(random.randint(1000, 9999))
    otp_store[identifier] = {
        "action": "signup",
        "username": username,
        "identifier": identifier,
        "password": password,
        "otp": generated_otp,
    }

    return RedirectResponse(
        url=f"/verify-otp?identifier={identifier}&mock_otp={generated_otp}&type=signup",
        status_code=303,
    )


@app.post("/forgot-password-request")
async def forgot_password_request(
    identifier: str = Form(...), password: str = Form(...)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT identifier FROM users WHERE identifier = ? OR username = ?",
        (identifier, identifier),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return RedirectResponse(url="/?error=UserNotFound", status_code=303)

    real_identifier = row["identifier"]
    generated_otp = str(random.randint(1000, 9999))
    otp_store[real_identifier] = {
        "action": "forgot",
        "identifier": real_identifier,
        "password": password,
        "otp": generated_otp,
    }

    return RedirectResponse(
        url=f"/verify-otp?identifier={real_identifier}&mock_otp={generated_otp}&type=forgot",
        status_code=303,
    )


@app.get("/verify-otp", response_class=HTMLResponse)
async def verify_otp_page(
    request: Request,
    identifier: str,
    mock_otp: str = "",
    type: str = "signup",
):
    return templates.TemplateResponse(
        "verify_otp.html",
        {
            "request": request,
            "identifier": identifier,
            "mock_otp": mock_otp,
            "type": type,
        },
    )


@app.post("/verify-otp-action")
async def verify_otp_action(
    identifier: str = Form(...), otp: str = Form(...), type: str = Form(...)
):
    user_data = otp_store.get(identifier)

    if user_data and user_data["otp"] == otp:
        conn = get_db_connection()
        cursor = conn.cursor()

        if type == "signup":
            cursor.execute(
                "INSERT INTO users (identifier, username, password, balance) VALUES (?, ?, ?, ?)",
                (
                    user_data["identifier"],
                    user_data["username"],
                    user_data["password"],
                    1000.0,
                ),
            )
            conn.commit()
            cursor.close()
            conn.close()
            del otp_store[identifier]

            response = RedirectResponse(url="/dashboard", status_code=303)
            response.set_cookie(key="session_user", value=user_data["username"], httponly=True)
            return response

        elif type == "forgot":
            cursor.execute(
                "UPDATE users SET password = ? WHERE identifier = ?",
                (user_data["password"], user_data["identifier"]),
            )
            conn.commit()
            cursor.close()
            conn.close()
            del otp_store[identifier]

            return RedirectResponse(
                url="/?success=PasswordReset", status_code=303
            )

    return RedirectResponse(
        url=f"/verify-otp?identifier={identifier}&error=InvalidOTP&type={type}",
        status_code=303,
    )


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
    return templates.TemplateResponse(
        "account.html", {"request": request, "username": username}
    )


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
    return templates.TemplateResponse(
        "crash.html", {"request": request, "username": username}
    )


@app.get("/games/ludo", response_class=HTMLResponse)
async def ludo_lobby_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "ludo_lobby.html", {"request": request, "username": username}
    )


@app.get("/games/ludo/play", response_class=HTMLResponse)
async def ludo_game_play_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)

    mode = request.query_params.get("mode", "2")
    amount = request.query_params.get("amount", "100")

    return templates.TemplateResponse(
        "ludo.html",
        {
            "request": request,
            "username": username,
            "mode": mode,
            "amount": amount,
        },
    )


# WebSocket Route variants to catch all proxy paths
@app.websocket("/ws/crash")
@app.websocket("/ws/crash/")
async def crash_websocket(websocket: WebSocket):
    await websocket.accept()
    mode = websocket.query_params.get("mode", "token")
    await manager.connect(websocket, mode)

    game_instance = (
        engine.token_engine if mode == "token" else engine.real_engine
    )

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
                    "is_bot": False,
                }
            elif action == "CASH_OUT":
                username = parsed.get("username", "Player")
                for bet in game_instance.active_bets.values():
                    if bet.get("username") == username and not bet.get(
                        "cashed_out"
                    ):
                        bet["cashed_out"] = True
                        bet["multiplier"] = game_instance.multiplier
                        bet["payout"] = round(
                            bet["amount"] * game_instance.multiplier, 2
                        )
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