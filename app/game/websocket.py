import json

from fastapi import WebSocket

from app.game.crash.engine import CrashGameEngine


class ConnectionManager:

    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, mode: str):
        await websocket.accept()
        self.active_connections[websocket] = mode

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    def set_mode(self, websocket: WebSocket, mode: str):
        self.active_connections[websocket] = mode

    async def broadcast_mode_data(self, mode: str, message: dict):
        data = json.dumps(message)
        for ws, client_mode in list(self.active_connections.items()):
            if client_mode == mode:
                try:
                    await ws.send_text(data)
                except (RuntimeError, ConnectionError):
                    self.disconnect(ws)


manager = ConnectionManager()


async def broadcast_to_clients(mode: str, message: dict):
    await manager.broadcast_mode_data(mode, message)


engine = CrashGameEngine(broadcast_to_clients)