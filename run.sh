#!/bin/bash

# Функция для очистки фоновых процессов при выходе
cleanup() {
    echo -e "\nShutting down background processes..."
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID
    fi
    if [ -n "$SSH_PID" ]; then
        kill $SSH_PID
    fi
    rm -f serveo_output.log
    echo "Cleanup complete."
    exit
}

# Устанавливаем "ловушку" на сигнал прерывания (Ctrl+C) для вызова функции очистки
trap cleanup SIGINT SIGTERM

# Активируем виртуальное окружение
echo "Activating Python virtual environment..."
source venv/bin/activate

# Запускаем локальный веб-сервер в фоновом режиме
echo "Starting local web server on port 8000..."
python3 -m http.server 8000 &
SERVER_PID=$!
echo "Web server started with PID: $SERVER_PID"

# Запускаем туннель serveo.net и перенаправляем его вывод в лог-файл
echo "Starting serveo.net tunnel..."
ssh -o "StrictHostKeyChecking=no" -o "UserKnownHostsFile=/dev/null" -R 80:localhost:8000 serveo.net > serveo_output.log 2>&1 &
SSH_PID=$!
echo "SSH tunnel started with PID: $SSH_PID"

# Ждем, пока URL появится в лог-файле
echo "Waiting for serveo.net URL..."
URL=""
# Даем 15 секунд на получение URL
for i in {1..15}; do
    if [ -f "serveo_output.log" ]; then
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.serveo\.net' serveo_output.log | head -n 1)
        if [ -n "$URL" ]; then
            break
        fi
    fi
    sleep 1
    echo -n "."
done
echo ""

# Проверяем, был ли найден URL
if [ -z "$URL" ]; then
    echo "Error: Could not retrieve URL from serveo.net after 15 seconds."
    echo "Please check the contents of serveo_output.log for more details."
    cat serveo_output.log
    cleanup
fi

echo "Found public URL: $URL"
echo "Starting Telegram bot... (Press Ctrl+C to stop)"

# Запускаем бота с полученным URL
# Этот процесс будет работать на переднем плане
python3 bot.py "$URL"

# Когда бот будет остановлен, вызовется функция очистки
cleanup 