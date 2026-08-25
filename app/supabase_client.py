import os

from supabase import Client, create_client

SUPABASE_URL = os.getenv(
    "SUPABASE_URL", "https://kpnboggkawkyjzlxxpxi.supabase.co"
)
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_raQhbEjm6ujDdxHCkU1wQA_zv_VqYyg")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)