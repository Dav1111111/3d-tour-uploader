#!/bin/bash

# --- ngrok tunnel launcher for Telegram 3D-tour bot ---
# Требования: установлен ngrok (brew install --cask ngrok), настроен authtoken (`ngrok config add-authtoken <TOKEN>`) и готово виртуальное окружение venv

cleanup() {
  echo -e "\nShutting down background processes…"
  [[ -n "$SERVER_PID" ]] && kill $SERVER_PID 2>/dev/null
  [[ -n "$NGROK_PID" ]] && kill $NGROK_PID 2>/dev/null
  rm -f ngrok.log
  echo "Cleanup complete."
  exit
}

trap cleanup SIGINT SIGTERM

# Проверяем, установлен ли ngrok
if ! command -v ngrok &>/dev/null; then
  echo "Error: ngrok CLI not found. Install via 'brew install --cask ngrok' и выполните 'ngrok config add-authtoken <TOKEN>'."
  exit 1
fi

# Активируем виртуальное окружение
echo "Activating Python virtual environment…"
source venv/bin/activate || { echo "Cannot activate venv"; exit 1; }

# Убеждаемся, что порт 8000 свободен
if lsof -i :8000 >/dev/null 2>&1; then
  echo "Error: port 8000 is already in use. Stop the process occupying it и запустите снова."; exit 1;
fi

# Проверяем, не запущена ли другая копия бота
if pgrep -f "python.*bot.py" >/dev/null 2>&1; then
  echo "Error: another instance of bot.py is already running. Stop it first."; exit 1;
fi

# Запускаем локальный HTTP-сервер
echo "Starting local web server on port 8000…"
python3 -m http.server 8000 &
SERVER_PID=$!
echo "Web server PID: $SERVER_PID"

# Запускаем ngrok
echo "Starting ngrok tunnel…"
# --log=stdout позволяет писать логи в stdout, чтобы мы могли перенаправить их в файл для дебага
ngrok http 8000 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!
echo "ngrok PID: $NGROK_PID"

# Ждём появления URL через локальный API ngrok (порт 4040)
URL=""
echo -n "Waiting for ngrok tunnel URL"
for i in {1..40}; do
  URL=$(curl --silent http://localhost:4040/api/tunnels 2>/dev/null | \
        grep -Eo '"public_url":"https://[^"]+"' | head -n 1 | sed -E 's/"public_url":"(https:[^"]+)"/\1/')
  [[ -n "$URL" ]] && break
  sleep 1; echo -n "."
done
echo ""

if [[ -z "$URL" ]]; then
  echo "Error: could not obtain ngrok URL. Log follows:" && cat ngrok.log
  cleanup
fi

echo "Public URL: $URL"

# Запускаем бота, передавая URL
python3 bot.py "$URL"

cleanup 