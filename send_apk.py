import os
import sys
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

if not BOT_TOKEN or not CHAT_ID:
    sys.exit("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID (set in .env or shell env).")

FILE_PATH = r"D:\Work\game\BunnyHop\android\app\build\outputs\apk\debug\app-debug.apk"
CAPTION = "📦 무한의당근 APK (풀스크린 + 상태바 숨김 + 충돌 판정 개선 + 게임오버 UI 수정)"

def send_document():
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"

    with open(FILE_PATH, 'rb') as f:
        files = {'document': f}
        data = {'chat_id': CHAT_ID, 'caption': CAPTION}
        response = requests.post(url, files=files, data=data)

    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response OK: {result.get('ok', False)}")
    if result.get('ok'):
        print(f"Message ID: {result.get('result', {}).get('message_id')}")

if __name__ == "__main__":
    send_document()
