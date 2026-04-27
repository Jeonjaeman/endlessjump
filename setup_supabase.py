import os
import sys
import requests
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not ANON_KEY:
    sys.exit("Missing SUPABASE_URL or SUPABASE_ANON_KEY (set in .env or shell env).")

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def rpc(func_name, params={}):
    url = f"{SUPABASE_URL}/rest/v1/rpc/{func_name}"
    resp = requests.post(url, headers=headers, json=params)
    print(f"[RPC {func_name}] {resp.status_code}: {resp.text[:300]}")
    return resp

# 1. Create profiles table
print("\n=== 1. Creating profiles table ===")
url = f"{SUPABASE_URL}/rest/v1/profiles"
resp = requests.post(url, headers=headers, json={
    "id": "00000000-0000-0000-0000-000000000001",
    "nickname": "test",
    "country_code": "KR"
})
print(f"[CREATE profiles] {resp.status_code}: {resp.text[:300]}")

# 2. Create scores table
print("\n=== 2. Creating scores table ===")
url = f"{SUPABASE_URL}/rest/v1/scores"
resp = requests.post(url, headers=headers, json={
    "user_id": "00000000-0000-0000-0000-000000000001",
    "score": 100,
    "height": 500
})
print(f"[CREATE scores] {resp.status_code}: {resp.text[:300]}")

# 3. Test get_ranking (might fail if function doesn't exist)
print("\n=== 3. Testing get_ranking RPC ===")
rpc("get_ranking", {"p_user_id": "00000000-0000-0000-0000-000000000001", "p_mode": "all"})

# 4. Check profiles table
print("\n=== 4. Checking profiles ===")
url = f"{SUPABASE_URL}/rest/v1/profiles?select=*"
resp = requests.get(url, headers=headers)
print(f"[SELECT profiles] {resp.status_code}: {resp.text[:500]}")

# 5. Check scores table
print("\n=== 5. Checking scores ===")
url = f"{SUPABASE_URL}/rest/v1/scores?select=*"
resp = requests.get(url, headers=headers)
print(f"[SELECT scores] {resp.status_code}: {resp.text[:500]}")
