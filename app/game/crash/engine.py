import asyncio
import logging
import random

logger = logging.getLogger("uvicorn")


class CrashGameInstance:

    def __init__(self, mode, broadcast_callback):
        self.mode = mode
        self.state = "IDLE"
        self.multiplier = 1.00
        self.target_crash = 2.00
        self.history = [1.25, 2.10, 1.05, 3.40, 1.50]
        self.active_bets = {}
        self.broadcast_callback = broadcast_callback
        self.round_id = 0
        self.forced_crash = None

    def configure_round(self):
        self.round_id += 1

        if self.forced_crash is not None:
            self.target_crash = float(self.forced_crash)
            self.forced_crash = None
        else:
            r = random.random()
            if r < 0.08:
                self.target_crash = 1.00
            else:
                raw_crash = 0.98 / (1.0 - random.random())
                self.target_crash = round(max(1.01, min(raw_crash, 25.00)), 2)

        self.multiplier = 1.00
        self.state = "IDLE"
        self.active_bets.clear()

        bot_names = [
            "Rahul_99",
            "AmanX",
            "Priya_Vip",
            "Rohit_Bet",
            "Sahil_K",
            "Deepak_99",
            "Vikram_77",
            "Neha_Win",
            "Karan_X",
        ]
        selected_bots = random.sample(
            bot_names, random.randint(4, min(7, len(bot_names)))
        )
        for bot in selected_bots:
            bot_uid = f"bot_{self.mode}_{random.randint(1000,9999)}"
            # Random large and varying bet amounts for bots
            bet_amt = random.choice([50, 100, 150, 200, 300, 500, 1000])
            bot_cashout_target = round(random.uniform(1.2, 8.0), 2)
            self.active_bets[bot_uid] = {
                "username": bot,
                "amount": bet_amt,
                "cashed_out": False,
                "payout": 0.0,
                "target_cashout": bot_cashout_target,
                "is_bot": True,
            }

    async def run_loop(self):
        while True:
            try:
                self.configure_round()

                # 1. IDLE STATE
                self.state = "IDLE"
                await self.broadcast_callback(
                    self.mode,
                    {
                        "type": "ROUND_READY",
                        "round_id": self.round_id,
                        "multiplier": 1.00,
                        "bets": self.active_bets,
                        "history": self.history[-50:],
                    },
                )
                await asyncio.sleep(3.0)

                # 2. RUNNING STATE
                self.state = "RUNNING"
                start_time = asyncio.get_event_loop().time()
                await self.broadcast_callback(
                    self.mode,
                    {
                        "type": "ROUND_STARTED",
                        "round_id": self.round_id,
                        "bets": self.active_bets,
                        "history": self.history[-50:],
                    },
                )

                while self.state == "RUNNING":
                    await asyncio.sleep(0.1)
                    elapsed = (
                        asyncio.get_event_loop().time() - start_time
                    )
                    self.multiplier = round(1.00 + (elapsed ** 1.3) * 0.12, 2)

                    for data in self.active_bets.values():
                        if (
                            data.get("is_bot")
                            and not data["cashed_out"]
                            and self.multiplier >= data["target_cashout"]
                        ):
                            data["cashed_out"] = True
                            data["payout"] = round(
                                data["amount"] * data["target_cashout"], 2
                            )
                            data["multiplier"] = data["target_cashout"]

                    if self.multiplier >= self.target_crash:
                        self.multiplier = self.target_crash
                        self.state = "CRASHED"
                        break

                    await self.broadcast_callback(
                        self.mode,
                        {
                            "type": "TICK",
                            "multiplier": self.multiplier,
                            "active_bets": self.active_bets,
                            "history": self.history[-50:],
                        },
                    )

                # 3. CRASHED STATE
                self.history.append(self.multiplier)
                if len(self.history) > 50:
                    self.history.pop(0)

                await self.broadcast_callback(
                    self.mode,
                    {
                        "type": "ROUND_CRASHED",
                        "multiplier": self.multiplier,
                        "results": self.active_bets,
                        "history": self.history[-50:],
                    },
                )

                await asyncio.sleep(3.0)
            except (asyncio.CancelledError, RuntimeError) as err:
                logger.error(f"Error in {self.mode} loop: {err}")
                await asyncio.sleep(1.0)


class CrashGameEngine:

    def __init__(self, broadcast_callback):
        self.token_engine = CrashGameInstance("token", broadcast_callback)
        self.real_engine = CrashGameInstance("real", broadcast_callback)

    async def start_all(self):
        await asyncio.gather(
            self.token_engine.run_loop(), self.real_engine.run_loop()
        )