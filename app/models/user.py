from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    phone_number = Column(String(20), unique=True, nullable=True)
    token_balance = Column(Float, default=1000.0, nullable=False)  # Free startup tokens
    games_played = Column(Integer, default=0, nullable=False)
    best_multiplier = Column(Float, default=1.00, nullable=False)
    role = Column(String(20), default="player", nullable=False)  # player, admin
    created_at = Column(DateTime, default=datetime.utcnow)

class GameRoundHistory(Base):
    __tablename__ = "game_round_history"

    id = Column(Integer, primary_key=True, index=True)
    game_name = Column(String(50), default="crash", nullable=False)
    crash_multiplier = Column(Float, nullable=False)
    total_players = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)