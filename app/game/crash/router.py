from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/games/crash", response_class=HTMLResponse)
async def crash_game_page(request: Request):
    username = request.cookies.get("session_user", "Player")
    return templates.TemplateResponse("crash.html", {"request": request, "username": username})


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    username = request.cookies.get("session_user", "Player")
    return templates.TemplateResponse("dashboard.html", {"request": request, "username": username})