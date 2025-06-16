#!/bin/bash

# --- Cloudflare-based launcher for 3D-tour Telegram bot ---
# Требования: установлен cloudflared (`brew install cloudflared`) и настроено виртуальное окружение venv

cleanup() {
  echo -e "\nShutting down background processes…"
  [[ -n "$SERVER_PID" ]] && kill $SERVER_PID 2>/dev/null
  [[ -n "$CF_PID" ]] && kill $CF_PID 2>/dev/null
  rm -f cloudflared_output.log
  echo "Cleanup complete."
  exit
}

trap cleanup SIGINT SIGTERM

# Проверяем наличие cloudflared
if ! command -v cloudflared &>/dev/null; then
  echo "Error: cloudflared is not installed. Install via 'brew install cloudflared' and retry."
  exit 1
fi

# Активируем venv
echo "Activating Python virtual environment…"
source venv/bin/activate || { echo "Cannot activate venv"; exit 1; }

# Проверяем, свободен ли порт 8000
if lsof -i :8000 >/dev/null 2>&1; then
  echo "Error: port 8000 is already in use. Stop the process that occupies it и запустите снова.";
  exit 1;
fi

# Проверяем, не запущена ли другая копия бота
if pgrep -f "python.*bot.py" >/dev/null 2>&1; then
  echo "Error: another instance of bot.py is already running. Stop it first.";
  exit 1;
fi

# Запускаем локальный сервер
echo "Starting local web server on port 8000…"
python3 -m http.server 8000 &
SERVER_PID=$!
echo "Web server PID: $SERVER_PID"

# Запускаем Cloudflare Tunnel
echo "Starting Cloudflare tunnel…"
cloudflared tunnel --url http://localhost:8000 --no-autoupdate > cloudflared_output.log 2>&1 &
CF_PID=$!
echo "Cloudflared PID: $CF_PID"

# Ожидаем появления URL
echo -n "Waiting for tunnel URL"
URL=""
for i in {1..40}; do
  if [[ -f cloudflared_output.log ]]; then
    URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' cloudflared_output.log | head -n 1)
    [[ -n "$URL" ]] && break
  fi
  sleep 1; echo -n "."
done

echo ""
if [[ -z "$URL" ]]; then
  echo "Error: could not obtain Cloudflare URL. Log follows:" && cat cloudflared_output.log
  cleanup
fi

echo "Public URL: $URL"

# Запускаем бота
python3 bot.py "$URL"

cleanup 

lsof -i :8000          # нет ли «залипшего» сервера
pgrep -fl cloudflared  # работает ли туннельный процесс 