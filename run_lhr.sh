#!/bin/bash

# --- localhost.run tunnel launcher for Telegram 3D tour bot ---
# Требования: установлен openssh (ssh) и настроено venv

cleanup() {
  echo -e "\nShutting down background processes…"
  [[ -n "$SERVER_PID" ]] && kill $SERVER_PID 2>/dev/null
  [[ -n "$LHR_PID" ]] && kill $LHR_PID 2>/dev/null
  rm -f lhr_output.log
  echo "Cleanup complete."
  exit
}

trap cleanup SIGINT SIGTERM

# Проверяем свободен ли порт 8000
if lsof -i :8000 >/dev/null 2>&1; then
  echo "Error: port 8000 is already in use. Stop the process and try again."; exit 1;
fi

# Проверяем, не запущен ли бот
if pgrep -f "python.*bot.py" >/dev/null 2>&1; then
  echo "Error: another instance of bot.py is already running. Stop it first."; exit 1;
fi

# Активируем виртуальное окружение
echo "Activating Python virtual environment…"
source venv/bin/activate || { echo "Cannot activate venv"; exit 1; }

# Запускаем локальный HTTP‒сервер
echo "Starting local web server on port 8000…"
python3 -m http.server 8000 &
SERVER_PID=$!
echo "Web server PID: $SERVER_PID"

# Запускаем SSH-туннель localhost.run
echo "Starting localhost.run tunnel…"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -R 80:localhost:8000 nokey@localhost.run > lhr_output.log 2>&1 &
LHR_PID=$!
echo "SSH PID: $LHR_PID"

# Ожидаем URL
echo -n "Waiting for tunnel URL"
URL=""
for i in {1..30}; do
  if [[ -f lhr_output.log ]]; then
    URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.lhr\.life' lhr_output.log | head -n 1)
    [[ -n "$URL" ]] && break
  fi
  sleep 1; echo -n "."
done
echo ""

if [[ -z "$URL" ]]; then
  echo "Error: could not obtain URL from localhost.run. Log:" && cat lhr_output.log
  cleanup
fi

echo "Public URL: $URL"

# Запускаем бота
python3 bot.py "$URL"

cleanup 