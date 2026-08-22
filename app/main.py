import asyncio
import json

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

# Simulated User Database: { identifier (email/phone): {"username": str, "password": str} }
USERS_DB = {"admin": {"username": "admin", "password": "admin123"}}


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
    user_data = None
    
    if identifier in USERS_DB:
        user_data = USERS_DB[identifier]
    else:
        for details in USERS_DB.values():
            if details["username"] == identifier:
                user_data = details
                break

    if user_data and user_data["password"] == password:
        response = RedirectResponse(url="/dashboard", status_code=303)
        response.set_cookie(key="session_user", value=user_data["username"])
        return response
        
    return RedirectResponse(url="/?error=InvalidCredentials", status_code=303)


@app.post("/signup")
async def signup_user(
    username: str = Form(...),
    identifier: str = Form(...),
    password: str = Form(...),
):
    username_exists = any(u["username"] == username for u in USERS_DB.values())
    if identifier in USERS_DB or username_exists:
        return RedirectResponse(
            url="/?error=UserAlreadyExists", status_code=303
        )

    USERS_DB[identifier] = {"username": username, "password": password}

    response = RedirectResponse(url="/dashboard", status_code=303)
    response.set_cookie(key="session_user", value=username)
    return response


@app.post("/forgot-password")
async def forgot_password(identifier: str = Form(...), password: str = Form(...)):
    # Check if user exists by email/phone or username
    user_key = None
    if identifier in USERS_DB:
        user_key = identifier
    else:
        for key, details in USERS_DB.items():
            if details["username"] == identifier:
                user_key = key
                break

    if user_key:
        # Update password
        USERS_DB[user_key]["password"] = password
        response = RedirectResponse(url="/?success=PasswordReset", status_code=303)
        return response

    return RedirectResponse(url="/?error=UserNotFound", status_code=303)


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    username = request.cookies.get("session_user")
    if not username:
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "username": username}
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
    return templates.TemplateResponse("crash.html", {"request": request})


@app.websocket("/ws/crash")
async def crash_websocket(websocket: WebSocket):
    mode = websocket.query_params.get("mode", "token")
    await manager.connect(websocket, mode)
    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            action = parsed.get("action")

            if action == "SWITCH_MODE":
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