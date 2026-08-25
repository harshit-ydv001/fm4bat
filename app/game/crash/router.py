import asyncio
import json

from fastapi import APIRouter, Request, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.game.websocket import engine, manager

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/games/crash", response_class=HTMLResponse)
async def crash_game_page(request: Request):
    username = request.cookies.get("session_user", "Player")
    return templates.TemplateResponse(
        "crash.html", {"request": request, "username": username}
    )


@router.websocket("/ws/crash")
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