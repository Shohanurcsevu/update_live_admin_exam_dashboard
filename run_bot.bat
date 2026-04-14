@echo off
TITLE Rethink Pomodoro Telegram Bot
echo Starting Telegram Bot...
:loop
php scripts\telegram_bot.php
echo Bot crashed or stopped. Restarting in 5 seconds...
timeout /t 5
goto loop
