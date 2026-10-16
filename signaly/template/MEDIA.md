# Медиафайлы шаблона 27_03_2025 — что куда положить

Все картинки, звуки, видео и шрифты лежат в папке игры, в подпапке `media`. Тогда игра находит их и при «Играть»/«Тестировать» в «Twine СИГНАЛЫ», и в готовой игре, и на другом компьютере.

```
Папка игры (например, D:\СИГНАЛЫ)
  27_03_2025.html      ← готовая игра («Опубликовать в папку игры»)
  _играть.html          ← служебные файлы: пишет программа при «Играть»
  _тест.html            ←   и «Тестировать», можно не трогать
  media\
    img\     картинки
    audio\   звуки и музыка (с подпапками musics\classic, musics\new, musics\третья)
    video\   видео
    fonts\   шрифты
```

**Где взять файлы.** Возьмите их там, где они лежат сейчас (часть была в `Документы\Twine\Scratch`), и разложите по таблице. Имена файлов — **точно как в таблице**, с теми же большими и маленькими буквами.

Всего файлов: 61. Список проверен: при прохождении всех экранов шаблона игра просит ровно эти файлы.

## Картинки — `media/img`

| Куда положить | Где используется |
|---|---|
| `media/img/A1_frame_correct.png` | ремонт схем (TERRAFORM_*) |
| `media/img/A2_frame_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/A3_frame_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/A4_frame_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/B1_hydro_correct.png` | ремонт схем (TERRAFORM_*) |
| `media/img/B2_hydro_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/B3_hydro_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/B4_hydro_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/C1_elec_correct.png` | ремонт схем (TERRAFORM_*) |
| `media/img/C2_elec_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/C3_elec_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/C4_elec_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/D1_pneum_correct.png` | ремонт схем (TERRAFORM_*) |
| `media/img/D2_pneum_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/D3_pneum_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/D4_pneum_wrong.png` | ремонт схем (TERRAFORM_*) |
| `media/img/radio.jpg` | окно KR2 «Космические рейнджеры» |
| `media/img/radioblack.jpg` | картинка радиоприёмника (radio) |
| `media/img/radiobottom.jpg` | картинка радиоприёмника (radio) |
| `media/img/radiobottomleft.jpg` | картинка радиоприёмника (radio) |
| `media/img/radiobottomright.jpg` | картинка радиоприёмника (radio) |
| `media/img/radioleft.jpg` | картинка радиоприёмника (radio) |
| `media/img/radiomiddle.jpg` | картинка радиоприёмника (radio) |
| `media/img/radioright.jpg` | картинка радиоприёмника (radio) |
| `media/img/radiotop.jpg` | картинка радиоприёмника (radio) |
| `media/img/schematics/schematic_RRU-80_v3.png` | TERRAFORM_SUCCESS |
| `media/img/testimgOFF.jpg` | переключатель ВКЛ/ВЫКЛ (Start, Texttests) |
| `media/img/testimgON.jpg` | переключатель ВКЛ/ВЫКЛ (Start, Texttests) |

## Звуки и музыка — `media/audio`

| Куда положить | Где используется |
|---|---|
| `media/audio/click1.wav` | звук нажатия на ссылку/кнопку |
| `media/audio/click2.wav` | звук нажатия |
| `media/audio/click3.wav` | звук нажатия; Shift+Z+B |
| `media/audio/hover1.wav` | звук наведения на ссылку/кнопку |
| `media/audio/hover2.wav` | звук наведения на ссылку/кнопку |
| `media/audio/hover3.wav` | звук наведения на ссылку/кнопку |
| `media/audio/hover4.wav` | звук наведения на ссылку/кнопку |
| `media/audio/hover5.wav` | звук наведения на ссылку/кнопку |
| `media/audio/hover6.wav` | звук наведения на ссылку/кнопку |
| `media/audio/loopcomputer.wav` | гул компьютера (audiobuttons) |
| `media/audio/msgsoundA.wav` | Shift+Z+A (сообщение мастера) |
| `media/audio/musics/classic/MALLOC.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/classic/PEOPLE.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/classic/gaal.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/new/Gaal_Pirate.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/new/Human_Pirate.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/new/Maloc_Pirate.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/третья/Beyond_reach.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/третья/WEAPON.mp3` | плейлисты (Атмосфера) |
| `media/audio/musics/третья/fight.mp3` | плейлисты (Атмосфера) |
| `media/audio/radioMoonlight.wav` | атмосфера |
| `media/audio/radioRegentropfen.wav` | радио, трек 1 |
| `media/audio/radioSchubert_serenade.wav` | радио, трек 2 |
| `media/audio/radioraindrop.wav` | радио, трек 3 |
| `media/audio/radiovinyl.wav` | винил перед треком радио; Shift+Z+C |
| `media/audio/startscreentape.mp3` | звук плёнки при старте |

## Видео — `media/video`

| Куда положить | Где используется |
|---|---|
| `media/video/1awake.mp4` | Redvideo |
| `media/video/DESERT_RAIN.mp4` | иллюминатор (Videotest2, WINDOWDESSERT, WINDOWSSHUTTERS) |
| `media/video/SHUTTERS.mp4` | иллюминатор (Videotest2, WINDOWDESSERT, WINDOWSSHUTTERS) |
| `media/video/SHUTTERS_DESSERT_OPEN_SOUND.mp4` | иллюминатор (Videotest2, WINDOWDESSERT, WINDOWSSHUTTERS) |
| `media/video/SHUTTERS_DESSET_CLOSE_SOUND.mp4` | иллюминатор (Videotest2, WINDOWDESSERT, WINDOWSSHUTTERS) |
| `media/video/fullvideo.mp4` | Videotest, Blackvideo |

## Шрифты — `media/fonts`

| Куда положить | Где используется |
|---|---|
| `media/fonts/DSEG7Classic-Regular.woff2` | шрифт таймера (Clocks) |

## Не нужны

- `CATimage.jpg`, `CATimage1.jpg` — упоминаются только в черновике `drafts`, игра их не использует.
