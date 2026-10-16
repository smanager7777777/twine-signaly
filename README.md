# Twine СИГНАЛЫ

Переделанный [Twine 2.12.1](https://github.com/klembot/twinejs) для игрового терминала ролевой игры «СИГНАЛЫ» (SugarCube 2.37.3). Всё, что делает программа, сохраняется внутри самой истории, поэтому история открывается и играется в обычном Twine.

## Что изменено (шаг 1.1)
- Своё имя «Twine СИГНАЛЫ», свои настройки (`%APPDATA%\Twine СИГНАЛЫ`) и своя библиотека (`Документы\Twine СИГНАЛЫ\Истории`) — не мешает обычному Twine.
- Интерфейс по-русски, формат новых историй — SugarCube 2.37.3.
- «Папка игры» в подробностях истории. «Играть» и «Тестировать» записывают игру в папку игры (`_играть.html`, `_тест.html`) и открывают в Chrome, поэтому пути `media/…` работают сразу. «Опубликовать в папку игры» записывает готовую игру туда же.
- Убрана проверка обновлений обычного Twine.

Весь код «Twine СИГНАЛЫ» помечен словом «СИГНАЛЫ»; новые файлы начинаются с `signaly`.

## Папки
- `signaly/template/` — исправленный шаблон `27_03_2025.twee`, список медиафайлов `MEDIA.md`, список исправлений `FIXES.md`.
- `signaly/tests/` — проверки: программа (Electron), шаблон в Chromium, сравнение .twee.

## Сборка
Программа для Windows собирается в GitHub Actions (`.github/workflows/build-windows.yml`) при каждом обновлении ветки `main`; готовый архив — в разделе **Releases**.

Вручную: `npm ci --ignore-scripts`, `npx tsc && npx vite build`, скопировать `dist/web` в `electron-build/renderer`, `npm run build:electron-main`, `npx electron-builder --config electron-builder.config.js --windows --x64`.

## Лицензия
GPL-3.0, как у Twine (`LICENSE`). Исходный README Twine — `README.twine.md`.
