import asyncio
import logging
import os
import sys

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

# Устанавливаем уровень логирования
logging.basicConfig(level=logging.INFO)

# Получаем токен бота из переменных окружения
bot_token = os.getenv("BOT_TOKEN")
if not bot_token:
    raise ValueError("Не найден BOT_TOKEN в .env файле")

# Инициализируем бота и диспетчер
bot = Bot(token=bot_token)
dp = Dispatcher()

# URL вашего веб-приложения больше не прописывается здесь жестко.
# Он будет считываться из аргументов командной строки.
if len(sys.argv) < 2:
    logging.critical("Ошибка: Не указан URL веб-приложения!")
    logging.critical("Пример запуска: python bot.py https://your-url.serveo.net")
    sys.exit(1)

WEB_APP_URL = sys.argv[1]
logging.info(f"Используется URL веб-приложения: {WEB_APP_URL}")


@dp.message(Command("start"))
async def send_welcome(message: Message):
    """
    Этот обработчик будет отвечать на команду /start
    и отправлять кнопку для открытия веб-приложения.
    """
    builder = InlineKeyboardBuilder()
    builder.button(
        text="📸 Открыть 3D-просмотрщик",
        web_app=WebAppInfo(url=WEB_APP_URL)
    )
    
    await message.answer(
        "Добро пожаловать в 3D Панорамный Просмотрщик!\n\n"
        "Нажмите кнопку ниже, чтобы открыть приложение и начать загрузку панорам.",
        reply_markup=builder.as_markup()
    )


async def main():
    """Основная функция для запуска бота."""
    # Пропускаем накопившиеся апдейты
    await bot.delete_webhook(drop_pending_updates=True)
    # Запускаем поллинг
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main()) 