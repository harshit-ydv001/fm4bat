import asyncio
import json
import random

from fastapi import FastAPI, Form, Request, WebSocket
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.game.websocket import engine, manager
from app.supabase_client import supabase

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

otp_store = {}


def init_supabase_table():
    try:
        supabase.table("users").select("*").limit(1).execute()
        print("Supabase Database Connected Successfully!")
    except Exception as e:  # noqa: BLE001
        print(f"Supabase Connection Note: {e}")


init_supabase_table()


@app.on_event("startup")
async def startup_event():
    try:
        asyncio.create_task(engine.start_all())
        print("Crash Game Engine Started Successfully!")
    except RuntimeError as e:
        print(f"Engine Startup Error: {e}")


@app.get("/", response_class=HTMLResponse)
async def root_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
async def login_user(identifier: str = Form(...), password: str = Form(...)):
    try:
        response = (
            supabase.table("users")
            .select("*")
            .or_(f"identifier.eq.{identifier},username.eq.{identifier}")
            .execute()
        )
        users = response.data

        if users and users[0]["password"] == password:
            response_redirect = RedirectResponse(
                url="/dashboard", status_code=303
            )
            response_redirect.set_cookie(
                key="session_user", value=users[0]["username"], httponly=True
            )
            return response_redirect
    except Exception as e:  # noqa: BLE001
        print(f"Login Error: {e}")

    return RedirectResponse(url="/?error=InvalidCredentials", status_code=303)


@app.post("/signup")
async def signup_user(
    username: str = Form(...),
    identifier: str = Form(...),
    password: str = Form(...),
):
    try:
        existing_user = (
            supabase.table("users")
            .select("*")
            .eq("username", username)
            .execute()
        )
        if existing_user.data:
            return RedirectResponse(url="/?error=UsernameTaken", status_code=303)

        existing_id = (
            supabase.table("users")
            .select("*")
            .eq("identifier", identifier)
            .execute()
        )
        if existing_id.data:
            return RedirectResponse(
                url="/?error=EmailAlreadyRegistered", status_code=303
            )
    except Exception as e:  # noqa: BLE001
        print(f"Signup Check Error: {e}")

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
    try:
        response = (
            supabase.table("users")
            .select("*")
            .or_(f"identifier.eq.{identifier},username.eq.{identifier}")
            .execute()
        )
        users = response.data
        if not users:
            return RedirectResponse(url="/?error=UserNotFound", status_code=303)

        real_identifier = users[0]["identifier"]
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
    except Exception as e:  # noqa: BLE001
        print(f"Forgot Password Error: {e}")
        return RedirectResponse(url="/?error=UserNotFound", status_code=303)


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
        try:
            if type == "signup":
                supabase.table("users").insert(
                    {
                        "identifier": user_data["identifier"],
                        "username": user_data["username"],
                        "password": user_data["password"],
                        "balance": 1000.0,
                    }
                ).execute()

                del otp_store[identifier]

                response = RedirectResponse(url="/dashboard", status_code=303)
                response.set_cookie(
                    key="session_user",
                    value=user_data["username"],
                    httponly=True,
                )
                return response

            elif type == "forgot":
                supabase.table("users").update(
                    {"password": user_data["password"]}
                ).eq("identifier", user_data["identifier"]).execute()

                del otp_store[identifier]

                return RedirectResponse(
                    url="/?success=PasswordReset", status_code=303
                )
        except Exception as e:  # noqa: BLE001
            print(f"OTP Action Database Error: {e}")

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


@app.websocket("/ws/crash")
@app.websocket("/ws/crash/")
async def crash_websocket(websocket: WebSocket):
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