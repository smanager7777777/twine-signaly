# СИГНАЛЫ (сессия 33): плеер приложения для предпросмотра телефона в окне «Приложение».
# Копирует собранный плеер из клона signaly-app (MIT; сборка — `npm ci --ignore-scripts && node tools/build.mjs`)
# в public/signaly-app/player.html (программа открывает его в iframe с name="sg-preview").
# python3 signaly/tools/sync-app-player.py ../signaly-app
import os, re, sys
src = open(sys.argv[1] + '/dist/www/index.html', encoding='utf-8').read()
version = (re.search(r'<meta name="generator" content="([^"]+)"', src) or [None, '?'])[1]
os.makedirs('public/signaly-app', exist_ok=True)
open('public/signaly-app/player.html', 'w', encoding='utf-8').write(src)
open('public/signaly-app/README.txt', 'w', encoding='utf-8').write(
    'Плеер приложения СИГНАЛЫ для предпросмотра телефона в окне «Приложение» Twine СИГНАЛЫ.\n'
    'Источник: https://github.com/smanager7777777/signaly-app (лицензия MIT), ' + version + '.\n'
    'Обновить: python3 signaly/tools/sync-app-player.py <клон signaly-app> (после node tools/build.mjs).\n')
print('ok public/signaly-app/player.html', len(src) // 1024, 'КБ', version)
