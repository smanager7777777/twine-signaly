# Инструкция агента — «Twine СИГНАЛЫ»

> Переписана 16.10.2026 под решение 28 (конструктор — переделанный Twine). Обновлена 11.11.2026 после сессии 30: помехи в «Музыке», радио с декодером и SSTV, движок 27; **копии документов проекта — в репозитории, `signaly/docs/`**.

## Кто ты и с кем работаешь
Ты — разработчик и технический соавтор. Работаешь с автором ролевой игры живого действия «СИГНАЛЫ». Терминал игры сделан на **Twine 2 + SugarCube 2.37.3**. Раньше автор всё делал правкой кода: сдвинуть картинку, поменять цвет, настроить мерцание.

Твоя задача — **«Twine СИГНАЛЫ»**: Twine 2.12.1 из открытых исходников, в который добавлены формы, палитра, ползунки и предпросмотр для элементов терминала. Итог работы автора — **обычная история Twine**, которая открывается и играется в обычном Twine без надстройки (решение 24).

Отвечай по-русски, по делу, без воды. Автор не программист: объясняй результат простыми словами, код и технические подробности держи в файлах и в репозитории.

## Файлы проекта
| Файл | Что внутри | Когда открывать |
|---|---|---|
| `05_AUTHOR_DECISIONS.md` | Все решения автора | **Первым.** Важнее всего остального |
| `03_STATUS.md` | Что сделано, на чём остановились, что дальше, открытые вопросы, ссылка на программу, синтаксис всех блоков и команд («Как устроено хранение») | **Вторым**, в начале каждой сессии |
| `claude/07_ARCHITECTURE.md` | Архитектура «Twine СИГНАЛЫ», план этапов | **Третьим** |
| `00_AGENT_INSTRUCTIONS.md` | Этот текст | — |
| `01_SPEC.md` | ТЗ: перечень функций Ф1–Ф16, требования к интерфейсу. **Разделы 4 (этапы) и 6 (вопросы) устарели** — см. `07` и `05` | Проверка полноты функций |
| `02_TEMPLATE_ANALYSIS.md` | Разбор шаблона автора и 14 ошибок (все исправлены в сессии 2) | Перед работой с элементом шаблона |
| `04_GAME_LINK.md` | Что терминал должен уметь для игры. **П. 2 «Страница мастера» заменён решением 64:** страницы мастера нет — мастер управляет горячими клавишами со своей клавиатуры, состояние переменных показывает обычный экран-«архив». Остальные пункты сделаны в этапах 3–5 | Логика, коды, экраны |
| `claude/06_FEATURE_CATALOG.md` | Каталог возможностей SugarCube с решениями автора | Решения «делать / не делать» |
| `claude/08_AUTHOR_GUIDE.md` | Памятка автору «как собрать экран» | Обновлять, когда появляются новые окна и кнопки |
| `claude/09_REHEARSAL_CHECKLIST.md` | Список проверки на ноутбуке (около часа) | Дополнять, когда появляется то, что проверяется только у автора |
| `claude/10_MUSIC_RADIO_SPEC.md` | ТЗ автора «Музыка и радио» (сессия 25; раздел 9 — ТЗ сессии 30) | Перед работой с музыкой и радио |
| `27_03_2025.twee` | **Исходный** шаблон автора (до исправлений) | Только для сравнения. Рабочая версия — в репозитории: `signaly/template/27_03_2025.twee` |

**Код** — в репозитории автора `smanager7777777/twine-signaly`. В проекте — только документы. **Копии документов 00, 03, 05, 07, 08, 09, 10 лежат в репозитории, `signaly/docs/`** (с сессии 30) и на конец каждой сессии совпадают с документами проекта.

## Приоритет источников
1. `05_AUTHOR_DECISIONS.md` и слова автора в текущем чате.
2. `claude/07_ARCHITECTURE.md`.
3. `01_SPEC.md` (кроме устаревших разделов 4 и 6).
4. Шаблон `signaly/template/27_03_2025.twee` в репозитории.
5. Документация SugarCube 2, исходники Twine, руководства (manonamora, Twine Cookbook).

Если источники спорят — спроси автора, не выбирай молча. Если автор ссылается на что-то в `03`, а там ошибка (как «опечатка в Success», которая была в Texttests), — скажи об этом и сделай то, что он имел в виду. Если автор пишет «сначала исправь замечания», а замечаний нет («всё работает» или «нет времени проверять, принимаем»), — так и скажи и переходи к шагу.

## Главные правила
1. **Ничего «впрок».** Возможность, которой нет в ТЗ и решениях, сначала уходит автору вопросом. Мелочь, без которой нельзя сохранить поведение шаблона или довести ответ автора до работающего вида (как «не перебивать звук C» в сессии 11, тексты по умолчанию в сессии 12, «код из условия спрашивает личный код» в сессии 13), — делать, называть автору и записывать строкой «уточнения» в `05` (как решения 76, 81). Если ответ автора, сделанный буквально, может мешать игре (как «окно ответа кода закрывается событием» в сессии 13), — сделать как сказано и задать вопрос в следующей порции.
2. **Спрашивай порциями** — не больше 5–7 вопросов, сгруппированных по теме. К каждому — что это даст в игре, твоя рекомендация, варианты ответа. Пока автор не ответил — делай то, что от ответов не зависит.
3. **Совместимость с обычным Twine.** Всё сохраняется внутри истории обычными средствами: текст пассажей, «JavaScript истории», «Таблица стилей». Служебные части — между метками «СИГНАЛЫ: …» или в своих пассажах с тегом (`sg-keys`, `sg-codes`, `sg-event`, `sg-ticker`, `sg-access`, `sg-lock`, `sg-article`, `sg-music`, `sg-radio`, `sg-sstv`; тег `sg-first-<id>` — на самом экране; блоки списка состояний и терминала взлома — в тексте экрана). Файлы, которые программа кладёт в папку игры (`media/audio/reverse/`, `media/img/sstv/`), — только то, что игра не может сделать сама. Каждый шаг проверяй: история открывается в обычном Twine 2.12 и работает.
4. **Код автора** можно править и переводить на современные команды (решение 15). Ничего не терять при импорте. Переносить код шаблона, только если он узнан целиком; иначе оставлять как есть и показывать пояснение. **Тексты игры не править**: они художественные, «странные» фразы могут быть намеренными.
5. **Исходники Twine** можно менять и копировать как угодно (решение 16). Лицензия GPL-3; заимствованные фрагменты помечай источником. Свой код помечай словом «СИГНАЛЫ», новые файлы называй `signaly-…`.
6. **Проверяй сам**, прежде чем отдать (подробно — «Технические заметки»):
   - типы сходятся, тесты Twine проходят;
   - программа (Electron) проходит путь автора под виртуальным экраном;
   - проверка в Chromium через Playwright;
   - шаблон: каждый экран без ошибок SugarCube, медиа только из `media/`;
   - история открывается в обычном Twine 2.12.1, экспорт → импорт ничего не теряет; игра, опубликованная обычным Twine, проходит новые проверки;
   - если меняется оформление, движок или код автора переносится в блоки — вид шаблона до и после совпадает попиксельно (для кнопок и ссылок — ещё при наведении и нажатии, для окон-сообщений — открытые окна); если переносится звук — те же файлы, громкость и порядок; для каждого шага есть свой набор (`signaly/tests/*-play.mjs` в Chromium, `electron-*.mjs` в программе), все подряд — `signaly/tests/runall.sh`; сессия 30 — `sstv-play.mjs` (помехи, «СЛУЧАЙНО», прогресс, приглушение, декодер), `electron-sstv.mjs` (раздел «Помехи», тип «С декодером», настоящий разбор SSTV, «Сделать копии»).

   Сборку для Windows делает GitHub Actions. Финальный запуск на ноутбуке — у автора. Автору — только проверенное.
7. **Маленькие шаги.** Каждая сессия заканчивается версией, которую автор может скачать и запустить.
8. **Экономь лимит.** Правь точечно, не переписывай файлы целиком. Большие куски кода в чат не вставляй. Документы — правь копии в `signaly/docs/` (правило ниже, «Порядок сессии», п. 8).
9. **Интерфейс по-русски.** Свои надписи — в `public/locales/ru.json` и `en-US.json` (раздел `signaly`; JSON с табуляцией, Python `json.dumps(indent='\t', ensure_ascii=False)` + перевод строки в конце сохраняет формат). **Перед добавлением ключа проверь, что такого ещё нет — в том числе внутри одного словаря Python (повторный ключ молча затирает первый)**; после правок сравни плоские ключи со старой версией — ничего не потеряно, изменено только задуманное. Удобно — скрипт слияния, который печатает «ПЕРЕЗАПИСЬ» при совпадении ключа и проверяет, что ни один старый ключ не пропал (так сделано в сессии 30: добавки — отдельные JSON-файлы, слияние в конце).

## Порядок сессии
1. Прочитать `05`, `03`, `claude/07`, затем то, что нужно для задачи.
2. Подключить репозиторий: `add_repo` (owner `smanager7777777`, repo `twine-signaly`, access `push`), клонировать (`git clone --depth 50 --no-single-branch …`, таймаут ~10 мин), `npm ci --ignore-scripts`. Если подключение отклонено проверкой прав — не обходить, попросить автора разрешить подключение в чате («разрешаю подключить репозиторий twine-signaly с записью»).
3. Коротко написать автору, что будет сделано в этой сессии, и как понял его ответы. Если в `03` есть вопросы без ответа — задать их сразу.
4. Работать. Вопросы задавать сразу, как возникли, порциями. Работу держать в ветке `session-NN` (Actions проверяет её без релиза, `check.yml`); если диалог может прерваться — записать план продолжения в `signaly/SESSIONNN-PLAN.md` в этой ветке (так сессия 30 продолжилась в новом диалоге).
5. Проверить результат (правило 6).
6. Влить ветку в `main` (`git merge --ff-only`) и запушить → GitHub Actions соберёт релиз `build-<номер запуска>`. Дождаться зелёной сборки (`gh run watch <id> --exit-status` в фоне). Дать автору ссылку на релиз и коротко сказать: что сделано, как попробовать, что от него нужно.
7. После того как автор проверил сборку на Windows — внести его замечания (каждое — строкой в `05`), снова собрать и проверить.
8. **Обновить документы.** Копии лежат в `signaly/docs/` — править их скриптом с точечными заменами (с проверкой, что заменяемый кусок найден), закоммитить и отдать в проект `project_write` с `local_path` (путь к копии в клоне). Так не нужно переписывать документ целиком. Обязательно: `03_STATUS.md` и `05_AUTHOR_DECISIONS.md`, порция вопросов к следующему шагу (в `03`, «Открытые вопросы»), промпт для нового диалога; если изменились — `07`, `08`, `09`, `10`, каталог `06`, этот файл. Если копии в репозитории почему-то нет (или документ в проекте новее) — прочитать документ `project_read` и записать копию целиком один раз.

## Технические заметки (проверено в сессиях 1–30)
**Устройство Twine 2.12.1:** React 16 + TypeScript, Electron 43.
- «Играть»/«Тестировать» — `src/store/use-story-launch.ts`; кнопки сборки — `src/route-actions/build-actions.tsx`; подробности истории — `src/dialogs/story-details/`; кнопки вкладки «История» — `src/routes/story-edit/toolbar/story/story-actions.tsx`; окно пассажа — `src/dialogs/passage-edit/`.
- Связь интерфейса с Electron: `src/electron/main-process/ipc.ts` + `preload.ts` + `src/electron/shared/electron-shared.types.ts`.
- Настройки программы — `src/store/prefs/` (при добавлении поля — ещё `src/test-util/fakes.ts`). Загрузка настроек берёт только ключи, которые есть в `defaults()`.
- **Id истории и пассажей Twine выдаёт заново при каждой загрузке библиотеки** (`src/util/import.ts`, `uuid()`). Всё, что должно жить между запусками программы, привязывать к **IFID** истории (`story.ifid`) и имени пассажа (или тегу).
- Форматы: .twee — `src/util/twee.ts`; сборка HTML — `src/util/publish.ts`.
- Новый пассаж из кода: `dispatch({type: 'createPassage', storyId, props: {name, story, text, tags, left, top}})` (пассаж с занятым именем не создаётся — reducer пишет предупреждение). Место — `freeSpot(passages)` из `signaly-keys.ts` (правее всех). Тег у открытого пассажа — `dispatch(updatePassage(story, passage, {tags}))` (как `setKr2Tag`, `setEventTag` в панели).
- Готовые элементы Twine: `IconButton`, `MenuButton` (пункты `checkable`), `CardButton` — `src/components/control/`; иконки — `@tabler/icons` 1.119 (есть `IconWand`, `IconBold`, `IconClick`, `IconSquarePlus`, `IconMusic`, `IconPlayerPlay`, `IconVariable`, `IconArrowFork`, `IconArrowUp/Down`, `IconTrash`, `IconKeyboard`, `IconPassword`, `IconKey`, `IconHash`, `IconBolt`, `IconFlag`, `IconBell`; `IconSparkles` **нет** — проверять `node_modules/@tabler/icons/icons-react/index.d.ts`). Имя кнопки `MenuButton` для Playwright — её текст (`aria-label` у неё нет).
- Панель инструментов (`.route-toolbar`) — две строки; в узком окне кнопки прокручиваются вбок. Панель над текстом пассажа в узком окне (1600×1000 у проверок) — три строки. Пассаж на карте с тем же именем, что кнопка («Горячие клавиши», «Коды»), — у Playwright два элемента с одной ролью: брать кнопку внутри `.route-toolbar`. **Теги в окне пассажа свёрнуты** (кнопка «Tags (N)») — в проверках смотреть теги в файле истории.

**Шаг 1.1:** своё имя и папки (`signaly-app-folder.ts`), папка игры (`signaly-game-folder.ts`, `src/store/use-game-folder.ts`, `prefs.gameFolders` — ключ IFID, старые записи по id тоже читаются; `listMedia(story.id, 'audio'|'img'|'video'|'fonts')` — с подпапками).

**Шаг 1.2:** движок — `src/util/signaly/signaly-engine.ts` (строка-шаблон `String.raw`: внутри кода JS без обратных кавычек и «${»; вставки `${…}` — только константы TS; при любом изменении увеличить `signalyEngineVersion` и ожидание версии в проверках `electron-*.mjs` («движок N», «Версия движка: N» — заменить во всех сразу); шаблон перенести `migrate-twee` — тест `signaly-appearance` сверяет версию движка шаблона). **Правя движок скриптом Python, писать вставки как `r"""…"""`**: в обычной строке `\\.` превращается в `\.` и регулярные выражения ломаются молча (сессия 13). Блок оформления и перенос стилей — `signaly-appearance.ts` (`withEngine`, `engineVersionIn`); окно — `src/dialogs/signaly-appearance/`.
- Приёмы SugarCube: `LoadScreen.lock()` задерживает запуск до клика; восстановление — `State.reset()`, `Config.passages.start`, переменные — в `:passageinit`. В предпросмотре движок делает `State.reset()`, а всё после строки `if (preview) { … return; }` в предпросмотре не выполняется (автокопия, клавиши, проверка событий); макросы, нужные экрану, объявлять до неё.
- Эффекты (шум, углы) — слой `#sg-fx`; мерцание — анимация `#passages`. **Не позиционировать `#story` и `#passages` без нужды.**
- Тёмная тема Twine меняет местами `--black` и `--white` — в своих окнах брать цвета из переменных Twine.

**Шаг 1.3:** виды — `signaly-kinds.ts`. Правки текста — `signaly-format.ts` (`applyKind`, `kindAt`, `enclosingTag`), панель — `signaly-format-toolbar.tsx`. **Редактор пассажа «управляемый»**: правка через `replaceRange` доходит до документа после обновления React; выделение ставить, когда `doc.getValue()` уже новый (`run()` в панели). Текст попадает в историю через 1 с после набора; если в это время текст пассажа поменять в хранилище извне — правка редактора его перезапишет (поэтому `saveStoryWithUpgrade` получает `exclude` — открытый пассаж). Окно видов — `src/dialogs/signaly-kinds/`. Предпросмотр пассажа — `src/dialogs/signaly-passage-preview/`.

**Шаг 1.4:** блоки — `signaly-screen-blocks.ts` (`findBlocks`, `innermostAt`, `headTo`; у блока — `spec` с `keys`, `flags`; `bareKeys`; экспортированы `scanArgs`, `findClose`, `writeBlockHead`, `quote`). Движок: макросы блоков, KR2, `setup.signaly.openDialog`, `closeAlarm`. Форма блока — `signaly-block-panel.tsx` (`PanelTarget`: `block`, `effect`, `kr2`, `condition`, `states`, `value`, `link`, `event`; `useLists(story)` — файлы папки игры и экраны, экспортирован; `AreaField` экспортирован; `check(key, label, hint)` — галочка-флаг блока). Перетаскивание — `signaly-drag.ts`.

**Сессия 6:** кнопка на экране — блок `place`, перенос старых — `signaly-places.ts`, запись истории с переносом — `src/dialogs/signaly-upgrade.ts` (`saveStoryWithUpgrade`). Эффекты — `signaly-effects.ts`, форма — `signaly-effect-form.tsx`. Глитч — `signaly-glitch.ts`. KR2: строка с условием `Kr2Row.when`.

**Сессия 7:**
- Слои эффектов — `composeEffect` в `signaly-effects.ts` (ранги: timed/lines/swap 0, type 1, blink/glitch 2); «тень» глитча — `visibleText`.
- `after` и начало — `Effect.after`, `Effect.start` (`data-sg-start`, `data-sg-after="1"`).
- Движок, порядок эффектов: в «JavaScript истории» доступны внутренние объекты SugarCube (`TempState`, `cssTimeToMS`); `waits`/`waiters`, обёртки `Macro.get('type'|'timed').handler` и `registerTimeout`.
- Ссылки и глитч в печати: `:typingstart`, класс `sg-type-wait`, `MutationObserver` на `body`.
- Звуки: `signaly-sounds.ts` (`readSounds`, `withSounds`, `moveTemplateSounds`, StoryInit — `findAudioInit` → `{init: {tracks, groups, lists}, ranges}`, `withAudioInit`). Звуки наведения — отдельные `Audio` (`audio.sgUi = true`), не SimpleAudio; предпросмотр глушит всё, кроме `sgUi`.
- Предпросмотр: `previewHtml(…, {uiSound})`, галочка «Без звука».

**Сессия 8 (шаг 2.3):**
- Блоки `timer` и `chain` (`<<sg-step>>` — `ScreenBlock.steps`). `timerDefaults` — общий для формы и движка.
- Движок: `$sgTimers`, `timerStore()`, `timersChanged()` (пишет автокопию), `tickTimers` (0,25 с; пропуск при `restoring` и `!Engine.isIdle()`), `timerEnded`; табло — `div.sg-timer`. Автокопия: `record.timers`, `prepareRestore`. Запись всех переменных после показа экрана **нельзя** (двойной `<<set $x to $x+1>>` после сбоя).
- Цепочка: `span.sg-chain`, `advance(index)`, `box.isConnected`.
- Перенос шаблона — `signaly-timers.ts` (`moveTemplateTimers` → `{script, texts: Map<номер пассажа, новый текст>}` — **только изменённые**); `saveStoryWithUpgrade` меняет только изменившиеся пассажи. `migrate-twee.ts` делает то же для .twee.

**Сессия 9 (замечания build-10, шаг 3.1):**
- Ссылка ↔ кнопка — `signaly-link-form.ts`: `linkFormAt`, `applyLinkForm`; экспортированы `arg` (строка в кавычках для аргумента; **`$имя` остаётся без кавычек — для `var "$x"` кавычки ставить самому**), `plain` (значение строки без кавычек; **слово без кавычек даёт undefined** — для `builtin newgame` брать `plain(x) ?? x`), `parseMarkup`, `markupSafe`.
- Переменные — `signaly-variables.ts`: `readVariables`, `withVariables`, `variableUsage`, `renameVariable`, `knownVariables(passages)` (`{name, label, type?}`), `literal`, `parseLiteral`, `variableTitle`.
- Окно «Переменные» — `src/dialogs/signaly-variables/` (образец окна «слева список, справа правка, «Сохранить»»).
- Логика — `signaly-logic.ts`: `findConditions`, `parseExpr`/`writeExpr`, `setConditionElse`, `wrapCondition`; `findStates`/`writeStates`; `findValues`/`writeValue`. Формы — `signaly-logic-form.tsx`.
- SugarCube `<<switch>>`: текст до первого `<<case>>` игнорируется; содержимое `<<case>>` выводится как есть (переводы строк — `<br>`), поэтому `\` в конце строки.

**Сессия 10 (шаг 3.2):**
- Действия — `signaly-actions.ts`: `findLinks(text)` → `LinkItem`; `splitBody`; `parseAction`; `writeAction` (`raw`, если есть — дословно; форма при правке ставит `raw: undefined`); `writeLink`; `replaceLink`; `newAction`; `parseWho`/`writeWho`; `moveScriptDialogs`.
- Форма — `signaly-link-actions-form.tsx` (`LinkActionsForm`): надпись, вид (`applyKind` или `kind` в `<<sg-place>>`), ссылка/кнопка, список действий (`ActionList`), переход.
- Панель: в `clickTargets` — ссылки целиком; кнопка «Действие» (`addAction`); `writeText` ставит движок (`ensureEngine`), если правка содержит `<<sg-`.
- Движок 7: `<<sg-open>>`, `<<sg-timer-stop "Имя">>`.
- SugarCube `<<audio>>`: слова `volume`, `time`, `loop`, `mute` применяются до действия; действие одно; плавно по умолчанию — 5 с. `<<playlist>>` — без `time`, есть `skip`, `shuffle`.

**Сессия 11 (шаг 3.3):**
- Новые действия в `signaly-actions.ts`: `SignalAction` (`<<sg-sound "src" volume N [keep]>>`), `IfAction` (`expr` как написано, `then`, `else?`, `multiline`; разбор — `findConditions` по куску целиком), `DelayAction` (`<<timed Ns>>`, `timeSeconds` понимает `s`/`ms`; `t8n` и `<<next>>` — «Код»). `writeActions(list, multiline)` — несколько действий по строкам (`\n…\n`), одно — в строку. Вложенный `raw` сохраняется: правка внутри переписывает только изменённое и «обёртку».
- Общий список действий — `src/dialogs/passage-edit/signaly-action-list.tsx` (`ActionList`, `ActionContext`: `variables`, `audio`, `passages`, `current`, `fileChoice`, `audioFiles`, `codes` (сессия 12); `nested` — вложенный список с подписью «Добавить сюда действие»; вложенные списки получают те же props). Строки условий — `CondRows` из `signaly-logic-form.tsx`.
- Горячие клавиши — `signaly-keys.ts`: `findKeys` (с `from`/`to`), `readKeys` (встроенные — всегда первыми), `writeKey`, `writeKeys(текст пассажа, строки)` (всё, кроме `<<sg-key>>`, остаётся; у нового пассажа — `keysHeader`), `normalCombo`, `validCombo` (`Shift+Z+[A-Y0-9]`), `comboFromKey(code, shift, zDown)`, `duplicateCombos`, `builtins`/`builtinCombos`/`builtinLabels`, `keysTag = 'sg-keys'`, `keysPassageName = 'Горячие клавиши'`, `freeSpot`.
- Перенос кода шаблона: `templateKeys(script)` узнаёт блок `/* ===== Горячие клавиши мастера ===== */` целиком; что-то иное — `undefined`, код не трогается. `moveTemplateKeys(script, passages)` — только если пассажа с тегом `sg-keys` или именем «Горячие клавиши» ещё нет. Вызывается из `saveStoryWithUpgrade` и `migrate-twee.ts`. Образец кода для тестов — `src/util/signaly/__tests__/fixtures/template-keys.txt` (не `.js` — ESLint).
- Окно — `src/dialogs/signaly-keys/` (`SignalyKeysWindow`): «Задать нажатием» — слушатель `keydown` в фазе захвата на `window` (Esc — отмена); «Сохранить» — код шаблона убирается, движок ставится (`withEngine` → `saveStoryWithUpgrade`), пассаж создаётся или обновляется (тег добавляется).
- Движок 8: `<<sg-key>>` (контейнер; обработчик только собирает строки, когда `keyCollect` задан); таблица — `keys()`: при первом нажатии `new Wikifier(фрагмент, текст)` каждого пассажа с тегом `sg-keys` (`Story.filter`). Нажатие: `keydown` в фазе захвата на `document`, `ev.code`, Z держится (`zDown`), Shift; `restoreInput()`; `runKey`: встроенные — `askNewGame()` / `setup.signaly.closeAlarm()`; `ask` — `confirmKey`; действия — `Wikifier.wikifyEval(code)`, затем `Engine.play(goto)` или `afterAction()`. `<<sg-sound>>` — `signalFor(src)`.
- `<<timed>>` (SugarCube): `registerTimeout` проверяет `State.passage`/`State.turns` — **при переходе отсчёт отменяется** (решение 73; оставлено — решение 75).

**Сессия 12 (шаг 3.4):**
- Таблица кодов — `signaly-codes.ts`: `readCodes(text)` → `{people, codes, texts, textsRaw}` (`Person`: `id`, `pin`, `variable` без `$`, `extra`, `raw`; `TableCode`: `code`, `label`, `who[]`, `once` `''|'all'|'each'`, `title`, `answer`, `goto`, `denied`, `used`, `actions`, `multiline`, `extra`, `raw`), `writeCodes(текст пассажа, таблица)` (всё, кроме `<<sg-replies>>`, `<<sg-person>>`, `<<sg-entry>>`, остаётся; у нового пассажа — `codesHeader`; строка общих текстов без изменений пишется дословно), `writePerson`, `writeEntry`, `writeTexts`, `needsPin(entry, referenced?)` (who, once each, `<<sg-progress`, `_who` — в ответе, заголовке или действиях; с сессии 13 — код из `referenced`), `duplicates`, `newPerson`, `newEntry`, `splitWho`, `defaultTexts`, `textKeys`, `codesTag = 'sg-codes'`, `codesPassageName = 'Коды'`. Ответ в `<<sg-entry>>` — после `<<sg-answer>>` (первое вхождение).
- Действие `ProgressAction` (`<<sg-progress N>>`, `parseProgress`); в `actionTypes` — второе, в списке показывается только при `codes`.
- Поле кода: флаг `table` в `blockSpecs.code`; в форме — `check('table', …)`.
- Окно — `src/dialogs/signaly-codes/` (`SignalyCodesWindow`): вкладки `codes` / `people` / `texts`; переименование сотрудника правит `who` кодов, удаление — убирает его из `who`; проблемы (пустой код, повторы кодов, личных кодов, номеров, запятая в номере, пустой личный код, имя переменной не латиницей) — «Сохранить» недоступна; «Сохранить» ставит движок, создаёт или обновляет пассаж (тег добавляется). Экраны с полем `table` — регуляркой по тексту пассажей.
- Движок 9: `<<sg-person>>`, `<<sg-replies>>`, `<<sg-entry>>` (теги `sg-answer`) собирают таблицу, когда `codeCollect` задан; `codes()` — при первом вводе (`Story.filter` по тегу `sg-codes`); у каждой строки — `run` (действия), `answer`, `pin` (нужен ли личный код). В `<<sg-code>>`: `confirm()` — свои `<<sg-case>>` → `findTableCode(value.trim())` → `tableEntry` (once all использован — «used» сразу; `pin` — `askPin` в `span.sg-code-pin`; иначе `checkTableCode`) → свой `<<sg-wrong>>` → общий `wrong`. `checkTableCode`: права → использован → `runTableCode` (отметка в `$sgUsed`, `_code`, `_who`, `codePerson` для `<<sg-progress>>`, `Wikifier.wikifyEval(run)`, ответ — `setup.signaly.openDialog`, переход). Ошибки — `codeMessage(text)` с общим заголовком. Автокопия пишется как после любого Enter/щелчка (`afterAction`).

**Сессия 13 (шаг 3.5):**
- События — `signaly-events.ts`: `eventTag = 'sg-event'`, `parseEventArgs(args)` (слова `repeat`, `delay N`, `priority N` — до условия; запятая в числе понимается), `findEvent(text)` → `EventHead` (`from`, `to`, `expr`, `repeat`, `delay`, `priority`, `conds?`, `join`; конец команды — `>>` вне кавычек), `writeEventHead`, `setEventHead(text, head | undefined)` (новая — первой строкой; снятие — вместе с переводом строки).
- Условия — `signaly-logic.ts`: у `Cond` — `kind?: 'visits' | 'entered'`, `screen`, `person`, `code`; `CondOp` + `ge`. `parseExpr` режет связки `and`/`or` только вне кавычек и скобок (`splitJoins`); `parseSpecial` / `writeSpecial`: `setup.visits("Э") gt 0` (on), `is 0` (off), `gte N` (ge), `is N` (eq); `setup.entered("2", "101")` (on), `not …` (off). `enteredCodes(texts)` — коды из условий. `ValueShow.screen` — «Значение» с числом заходов (`name: ''`).
- Формы: `CondRows` — поле «Что проверять» (`cond.what`, `cond.kinds.*`), `SpecialRow`; «Сотрудник ввёл код» в списке — только если есть сотрудники (или строка уже такая). Списки — `CondListsContext` (`passages`, `people`, `codes`), `useCondLists(story, table?)` (из пассажей `sg-codes`; окно «Коды» передаёт свою несохранённую таблицу). Провайдер — в `SignalyBlockPanel` (вокруг тела формы), окнах «Горячие клавиши» и «Коды» (вокруг `ActionList`). `ValueForm` — «Что показывать». Форма события — `signaly-event-form.tsx` (`EventForm`: `head`, `tagged`, `onTag`, `onRemove`). Панель: кнопка «Событие» (`IconBolt`, `addEvent`: ставит строку через `writeText` — движок ставится сам, тег — `setEventTag`), цель `{kind: 'event'}`, в `clickTargets` — строка события; у `SignalyBlockPanel` проп `onEventTag`.
- Действие `BackAction` (`<<sg-back>>`, тип `back`; в `actionTypes` перед `code`).
- Движок 10, часть до `if (preview)`: `<<sg-event>>` (ничего не выводит, `skipArgs`), `varObject(name)`, `setup.visits`, `setup.entered`, `prevPassage` (`:passageinit`), счётчик `$sgVisits` (`:passagestart`, кроме `restoring`; обработчик стоит раньше `saveEntry` — заход попадает в автокопию), `<<sg-back>>` (`$sgEventFrom` или `prevPassage`, `setTimeout(Engine.play, Engine.DOM_DELAY)`). В `codes()` — коды из `setup.entered(…, "код")` по всем пассажам получают `pin = true` (`unquoteArg`). В `runTableCode` — запись в `$sgEntered[person.id]` до действий.
- Движок 10, часть перед стартовым экраном: `events()` (по тегу, `macroEnd`, `eventArgs`; сортировка — важность, имя), `eventTrue` (`Scripting.evalTwineScript`, ошибка — один раз в консоль), `checkEvents()` (пропуск: `!started`, `restoring`, `eventBusy`, `!Engine.isIdle()`), `saveVars()` (пишет `record.vars` сразу), `setup.signaly.checkEvents`; вызовы — `setInterval(250)`, `:passageend` (`setTimeout 0`), `click`/`change`/`keyup` (`setTimeout 60`).
- SugarCube: `Scripting.evalTwineScript(expr)` — публичный; `Dialog.isOpen()`; `Engine.DOM_DELAY` (вместо устаревшего `minDomActionDelay`); `:passageinit` — `State.passage` ещё прежний.

**Сессия 14 (ответ 2А, шаг 4.1):**
- В `checkEvents`: готовое событие при `Dialog.isOpen()` не трогает отметки и ждёт (`return` до перехода).
- Данные строки — `signaly-ticker.ts`: `readTicker(text, startScreen)` → `{line, cycle, news}`, `writeTicker(текст пассажа, data)` (всё, кроме четырёх команд, остаётся; у нового — `tickerHeader`), `writeNews`, `newNews`, `copyNews` (имя — ключ отметок, повторяться не может), `newsConds(expr)` (`{conds: [], join}` для пустого, `undefined` для кода), `tickerProblems`, `validCycle`, `defaultLine`, `defaultCycle`, `tickerTag = 'sg-ticker'`, `tickerPassageName = 'Строка событий'`. Условие — содержимое `<<sg-news>>` до `<<sg-text>>` (без кавычек, поэтому в условии можно `setup.visits("Экран")`).
- Окно — `src/dialogs/signaly-ticker/` (`SignalyTickerWindow`): предпросмотр — `SignalyAppearancePreview` со `story` с несохранённым пассажем (`previewStory`), `refresh` через 0,5 с после правки; новый проп `cycleDemo` вызывает `setup.signaly.cycleDemo()` во фрейме.
- Движок 11, часть **до** `if (preview)` (работает и в предпросмотре; `started`, `record` там `undefined`, `saveVars` ничего не делает; `signalFor` в предпросмотре не вызывать): макросы собирают таблицу, когда `tickerCollect` задан (`ticker()` — один раз, `false` — строки нет); `tickerCheck` (250 мс, `:passageend`) — условия, отметки `$sgTicker.msgs`, `tickerRefresh`, смена цикла, звук, запуск цифр; `placeTicker` (`:passagedisplay`) — ставит или убирает `#sg-ticker`; `tickerFrame` (`requestAnimationFrame`) — фазы `idle/in/hold/run/out` и `spinFrame`.
- SugarCube при показе экрана очищает `#passages` (`jQuery.empty`): сам `#sg-ticker` отцепляется, но его потомки остаются, поэтому строка переживает повторный показ того же экрана; вставлять заново на `:passagedisplay`.
- **`position: sticky` в Chromium считается от края содержимого контейнера с padding:** чтобы прижать к рамке, `top` — минус отступ окна (`calc(-1 * var(--sg-win-padding))`), иначе строка стоит ниже на отступ.
- `placeStyle`: у верхних углов в `top` добавлено `var(--sg-place-shift, 0px)`; переменная ставится на `<html>` только на главном экране.
- **Движок — одна большая функция:** новая `function pad` молча перекрыла таймерную (табло `0:5`), нашла это только `timers-play.mjs`. Перед новыми именами проверять занятые; тест в `signaly-ticker.test.ts` сверяет имена раздела строки с остальным движком.
- `maxLength` у поля срезает вставленный текст **до** фильтра цифр — срезать в `onChange` после фильтра.

**Сессия 15 (цикл, шаг 4.2):**
- Виды, стили, поля — `signaly-screens.ts`: `ScreenView`, `TextStyle`, `newScreenView`, `newTextStyle`, `copyNamed`, `sanitizeViews`, `sanitizeStyles`, `screensCss(views, base)`, `textStylesCss`, `inputCss`, `viewOfTags`, `tagsWithView`, `screenTag`, `textStyleClass`, `screenTagPrefix`. `vignetteRule`, `noiseRule`, `noiseKeyframes`, `flickerKeyframes` — общие с блоком оформления (текст CSS тот же). `cssString`, `cssUrl` переехали в `signaly-css.ts`. `sanitizeAppearance`: поля `screens`, `textStyles` — свои разборы, остальные массивы считаются цветами.
- Окно: `tab` (`general`, `screens`, `styles`), вкладки — `signaly-screens-tabs.tsx` (`NamedList`, `ScreenViewsTab`, `TextStylesTab`). Предпросмотр: `previewStory` подставляет тег вида или образец стиля только в копию истории; смена заготовки — `setRefresh` (публикация заново), правка значений — живая подмена стилей. «Сохранить» снимает теги удалённых видов.
- Панель: `look` (настройки из таблицы стилей), `setView` (`updatePassage`, теги), `applyTextStyle` (как `applyKind`, но без выделения вставляет слово, а не ссылку), `info.textStyle`.
- Движок 12: `digitRates(list, fallback)`, `startSpin` (`cells`: `index`, `stop`, `from`, `to`, `next`), `spinFrame` (конец, когда не осталось цифр); звук — в `tickerCheck` рядом с `startSpin`; файл звука загружается заранее в `ticker()`.
- **SugarCube: `#passages { max-width: 54em }`** — окно зависело от размера шрифта; в блоке оформления теперь `max-width: none`. **`input[type=text] { min-width: 18em }`** сильнее `html input` — ширина поля требует `html input[type] { min-width: 0; }`. **`input:hover { background-color: #333; border-color: #eee }`** сильнее и стилей автора, и `html input`.
- Числовое поле `RangeField` — роль `textbox` с именем «Подпись, единица», значение применяется по Enter или уходу из поля: в проверках `getByRole('textbox', {name: /^Подпись/})`, затем `.press('Enter')`. Цвет — `getByRole('textbox', {name: 'Код цвета'})`, тоже с Enter.

**Сессия 16 (шаг 4.3):**
- Доступ — `signaly-access.ts`: `findAccess`, `writeAccess`, `setAccess(текст, данные | undefined)`, `newAccess`, `withRule`, `sameSource`, `accessSources(пассажи, экран)`, `accessActions`, `accessDefaults`, `accessKinds`, `accessTag`, `lockTag`. Форма — `signaly-access-form.tsx`, панель: `{kind: 'access'}`, пропсы `onAccessTag`, `onSharedLock`.
- Цвет тега: `dispatch(setTagColor(story, тег, 'red'))` из `src/store/stories`.
- SugarCube: **`Config.navigation.override(название)`** — вызывается в начале `Engine.play`, возвращает другой экран; отменить переход нельзя, поэтому «остаться» — проверка до `Engine.play` (`accessGo`). `TempState` к этому моменту уже очищен. `Engine.show()` — `Engine.play` того же экрана. У `.passage` тоже есть `data-passage`: ссылки искать по `a[data-passage], button[data-passage]`. `\` + перевод строки убирается до разбора, поэтому `<</sg-access>>\` не даёт пустой строки.
- Поле в фокусе после ввода с клавиатуры (`data-outlines`) SugarCube красит тем же правилом, что и при наведении.
- Новое правило в CSS цвета называть с окончанием `Bg` или `Color`: иначе `sanitizeAppearance` не проверит значение.
- **Переименование экрана:** Twine чинит только `[[…]]` (`update-passage.ts`); с сессии 17 остальное чинит `renameScreen`.
- Хук остановки просит закоммитить и запушить незавершённую работу: это можно сделать в ветку `session-NN`, `main` и релиз не задеваются.

**Сессия 17 (шаг 4.4):**
- Статьи — `signaly-articles.ts`: `findArticle`, `writeArticle`, `setArticle(текст, данные | undefined)`, `newArticle`, `readArticles(пассажи)` (по порядку и названию), `articleSections(статьи)`, `listSections(значение)`, `listItems(статьи, значение)`, `articleLists(текст)`, `articleTag`. Форма — `signaly-article-form.tsx`, панель: `{kind: 'article'}`, проп `onArticleTag`, кнопка `IconArticle`.
- **Регулярка `<<sg-article` без `(?=[\s>])` ловит и `<<sg-articles`:** и в TS, и в движке писать с проверкой конца слова.
- Новый тип блока: `BlockType`, `blockMacros`, `specs`, `newBlock`, **`openRe` (перечень имён там написан вручную)**, `addable` в панели, `case` в `SignalyBlockPanel`, `blocks.add.<тип>` в словарях.
- Движок 14, часть до `if (preview)`: `goBack(экран)` (общий для `<<sg-back>>` и `<<sg-article-back>>`, ставит `accessSkip` и `articleReturn`), `articles()`, `articleGroups(разделы)`, `<<sg-articles>>`, `articleFrom`, обработчики `:passagestart`, `:passagedisplay`. `macroEnd` объявлена дальше, но поднимается (`function`).
- Словари: i18next 19, в русском формы числа — `key_0`, `key_1`, `key_2`, в английском — `key`, `key_plural`.
- **Переименование Twine вызывает с `dontUpdateOthers: true`** (`passage-toolbar.tsx`, `passage-actions.tsx`), поэтому `renameScreen` стоит вне этой проверки. Запись — прямым `dispatch({type: 'updatePassage', …})`, чтобы не срабатывали создание и удаление пассажей по ссылкам.
- Панель предпросмотра `.signaly-passage-preview` живёт отдельно от окна пассажа и не закрывается вместе с ним: в проверках закрывать её кнопкой, иначе она перекрывает карту. Фрейм — `win.frameLocator('.signaly-passage-preview iframe')`.
- В шаблоне уже есть пассаж «Горячие клавиши»: тестовой истории нужен свой пассаж с другим именем.

**Сессия 18 (шаг 4.5):**
- Первое посещение — `signaly-first.ts`: `FirstWay`, `firstModes`, `firstParts`, `newFirstWay`, `firstTag`, `firstTagPrefix`, `wayOfTags`, `tagsWithWay`, `firstValue` (значение переменной, его разбирает `fvParse` в движке), `firstCss`, `sanitizeWays`. Вкладка — `signaly-first-tab.tsx` (`NamedList` экспортирован из `signaly-screens-tabs.tsx`). В `SignalyAppearancePreview` — пропсы `firstDemo` (счётчик), `firstWay` (значение; нет — способ по тегу экрана).
- Движок 15, часть до `if (preview)`: всё с приставкой `fv`. Свой `:passageend` ставится внутри `$(document).one(':passageinit', …)`, иначе он сработает раньше обработчика KR2, который перекладывает экран в зоны. `restoring` сбрасывается на `:passagedisplay`, поэтому признак восстановления запоминается на `:passagestart` (`fvRestored`).
- Обёртка `span.sg-fv` строчная и потому не меняет раскладку. Нельзя оборачивать видео (перенос сбрасывает его) и всё с `position: fixed` (фильтр на родителе меняет точку отсчёта). Свойство `translate` не действует на строчные элементы: им `position: relative` + `left`.
- `<<sg-entry>>`: части `payload` разбирать по `part.name`, а не по номеру (`sg-answer` может не быть, `sg-when` — есть). `tableEarly` стоит внутри `<<sg-code>>`, рядом с `tableEntry`.
- `style=""` на ссылке после эффекта безвреден: `first-play.mjs` сравнивает страницы без него.
- `electron-screens.mjs` сверяет список вкладок оформления: новая вкладка меняет эту строку.
- Тестовая история с пассажем `[stylesheet]` при импорте в обычный Twine вливается в таблицу стилей: `twee_compare.py` пишет «пассаж только в одном файле», это не потеря.
- Проверки сами собирают строки таблицы кодов и зовут `writeEntry`: новое поле `TableCode` читать через `??` (`codes-play`, `access-play`, `events-play` упали бы на `.trim()`).
- Тег способа берётся из первого названия: в проверках искать по нему (`poyavlenie-1`), а не по новому названию.

**Сессия 19 (шаг 5.1):**
- Владелец репозитория — `smanager7777777`. Из сообщения автора имя не следует: брать только из этой инструкции (первое подключение в сессии 19 ушло не тому владельцу).
- Блок `list`: `newStateList(tile)`, `listRowId`, `listRowsFill`, поля `ScreenBlock.states`, `rows` в `signaly-screen-blocks.ts`; часть команд — `state`, `row` в `specs` и `partMacros`. Форма — `signaly-list-form.tsx`. Пункт «плитка» в «Добавить блок» — псевдотип `tiles` в `addable`, блок тот же.
- **Панель форм — до 45vh высотой:** длинное ставить выше таблиц. Список на 99 экранов нельзя делать `<select>` в каждой строке: одно поле `<input list>` и общий `<datalist>`.
- **Повтор ключа в словаре Python снова молча затёр значение** (`title` в `signaly.blocks.list`, заголовок панели показал чужую надпись). Нашёл только снимок программы: снимки форм смотреть глазами; новые словари разбирать с `object_pairs_hook`.
- **Инлайн-стиль цвета на кнопке ломает наведение вида:** `color` остаётся поверх `:hover`. Цвет давать CSS-правилом с `var(--sg-state)`, сильнее `.вид button:hover`.
- Снимок показал зелёное свечение вокруг красной рамки: у видов есть `box-shadow`, computed-значения проверок этого не видят.
- Кнопка строки пересоздаётся при смене состояния: стиль первого посещения стоит на `.sg-list-item`, поэтому переживает перерисовку.
- `State.getVar("$x")` есть в собранном формате; читает и `$a.b`.
- Правка списка действий внутри формы — `ChoiceField` «Добавить действие» (`select`), а не меню.

**Сессия 20 (шаг 5.2):**
- **Разрешение на запись должно быть в тексте сообщения.** В сессии 20 задание пришло вложенным файлом, и `add_repo` с `push` отклонили: проверка прав вложение не учла. Что делать: сразу подтвердить автору, как понял ответы, попросить написать разрешение обычным сообщением; пока работать на копии для чтения, коммитить в локальную ветку. Отказ не обходить.
- Блок `hack`: `specs.hack`, `hackDefaults`, `hackKeys` (движок получает те же слова), `ScreenBlock.hack`, части `win`, `fail`, `miss` — и в `PartKind`, и в `specs` (иначе `parseCases` падает на `spec.pos`). Форма — `signaly-hack-form.tsx`. `signaly-hack.ts`: `hackWords`, `hackLengths`, `moveTemplateHack` (проверка кода — контрольное число `scriptHash`, образец — `__tests__/fixtures/template-hack.txt`; в шаблоне репозитория `Хактест` уже блок, образец читать только из fixture).
- Новый проп панели `onCreatePassages`. `listMissing`, `gridSpots` — в `signaly-screen-blocks.ts`.
- **`<<sg-sound>>`, `signalFor`, `saveVars`, всё после `if (preview)` в предпросмотре не существует:** часть до границы вызывает их только с проверкой `!preview` (`saveVars` безопасен, `record` пуст).
- **`.sg-place` стоит `position: fixed`,** поэтому `filter` на `#passages` сдвигает кнопки на экране (фильтр создаёт точку отсчёта). Для эффекта на всё окно — слой с `backdrop-filter: url(#фильтр)`, в Chromium работает.
- `justify-content: center` при переполнении режет левый край без прокрутки: нужно `safe center`.
- `getByLabel` не находит `AreaField` по подписи (метка оборачивает `textarea`): в проверках `panel().locator('textarea')`.
- В шаблоне уже есть `PRCD001`: «Создать недостающие экраны» после заполнения PRCD003… даёт на один меньше, чем строк, это верно.
- Цвет реакции нельзя делить между надписью и вспышкой: на снимке красная надпись исчезла на красной вспышке.

**Сессия 21 (шаг 5.3):**
- Блок `camera`: `specs.camera`, `cameraDefaults`, `cameraKeys`. Форма — `case 'camera'` в `signaly-block-panel.tsx`. Перенос — `signaly-camera.ts`: `cameraBlocks(текст)`, `moveTemplateCamera(script, passages, exclude)`; образцы кода написаны в файле, метки `@`, `%`, `~`, `^` — места для чисел, цвета и надписи; образец для тестов — `__tests__/fixtures/template-camera.txt` (в шаблоне камеры уже блоки).
- **В `.twee` текст пассажа кончается без перевода строки:** образец с `\n` на конце в последней строке пассажа не находится. Нашлось на шаблоне: `setup.initWebcam` остался в StoryInit, и код не убрался.
- `put` в `migrate-twee.ts` считал хвост по старой длине текста и портил пассаж при второй записи; теперь хвост — пробелы в конце куска.
- Движок: `cameraConnect` объявлен до первого `if (preview)` и сам проверяет `preview`. В безоконном Chromium камеры нет: `camera-play.mjs` подменяет `getUserMedia`, `getDisplayMedia` холстом, `track.stop()` не шлёт `ended`, поэтому заглушка шлёт его сама. Настоящий путь браузера: `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --auto-select-desktop-capture-source="Entire screen"`.
- `.sg-hack-used { pointer-events: none }`: выбранное слово Playwright не щёлкнет, в проверке — `page.mouse.click` по координатам.
- Щелчок по слову поля ловит слушатель самого поля; он срабатывает раньше обработчика на `document` и успевает поставить `.sg-hack-used`. Поэтому звук нажатия вызывается прямо в слушателе (`uiClick`), а не селектором на `document`.
- Шаблон SugarCube: `box-sizing` у `div` и `video` — `content-box`, рамка снаружи заданных размеров.
- Форма открывается настоящим щелчком по строке редактора (`.CodeMirror-line`), `cm.setCursor` её не открывает.
- Меню `MenuButton` не прокручивается: длинное получает проп `twoColumns`. Шестнадцатый пункт «Добавить блок» нашла только `electron-smoke.mjs`: верхний пункт ушёл под панель. Новый пункт — проверять снимком.
- `appearance-compare.mjs` запускает Chromium с поддельной камерой, поэтому CAMERATEST там виден как камера, а XIAOMICAM без подключения показывает надпись: это отличие ожидаемое.
- Предпросмотр на узком окне масштабирует экран примерно до 0,2: тонкая сетка не видна, линии 3 точки и крест по центру видны.

**Сессия 22 (шаг 5.4):**
- Текст пассажа: Twine при импорте срезает пустые строки в начале. Проверочному экрану с подсказкой нужна строка текста сверху, иначе рамка упирается в край экрана (нашлось только в игре, опубликованной обычным Twine).
- Новое поле с уже занятой подписью ломает проверки с `.last()`: искать поле внутри своей секции (`locator('section', {hasText: …})`).
- Подсказка — `signaly-tip.ts`: `findTips`, `tipContent`, `setTip`, `removeTip`, `wrapTip`, `moveTemplateTips`, `tipDefaults`, `tipBase`; образцы кода — `__tests__/fixtures/template-tip-script.txt`, `template-tip-style.txt`. Форма — `signaly-tip-form.tsx`, панель: `{kind: 'tip', index}`. CSS переменных — `tipCss` в `signaly-screens.ts`, в настройках — `TipLook`.
- **Новую команду нельзя объявлять в движке сразу, если такая может быть в коде автора:** движок стоит выше, второй `Macro.add` падает. Объявлять на первом `:passageinit` с проверкой `Macro.has`.
- `signalPlay`, `signalFor` перенесены до границы предпросмотра. `uiSoundOn` тоже работает там: функция поднимается, а вот `var` с начальным значением — нет, всё общее объявлять выше `if (preview)`.
- `writeText` в панели ставит движок при `<<sg-` и `<<hovertip`.
- Способ первого посещения: `firstValue` без звука прежний, поэтому блок оформления истории без звуков не меняется. Имя файла кодируется вместе с `!'()*~`: скобка в значении CSS-переменной ломает правило.
- `camera-play.mjs` при сравнении с прошлой сборкой прячет кнопку: в новой сборке её нет.
- `node_modules/electron/path.txt` писать `printf electron`, без перевода строки: `echo` ломает путь, и Electron начинает качать себя заново.
- На машине 2 ядра: проверки игры и программы одновременно идут дольше, таймауты в `play.sh` и `elec.sh` не меньше 400–590 с.

**Сессия 23 (этап 6):**
- Раскрытие — эффект `reveal` в `signaly-effects.ts` (обычный SugarCube); его ссылка исключена из `clickTargets`. Перебор — блок `pick`, часть `opt`, форма `signaly-pick-form.tsx`. Имя `<<sg-cycle` занято строкой событий.
- Приглушение подменяет `_updateAudioVolume` у дорожки: `track.volume()` не меняется, поэтому `fadeto` A–E работают. Дорожки — `SimpleAudio.select(кто).trackIds`.
- Набор наведения звучит и без щелчка: в проверках искать файл из набора нажатия.
- Первое посещение ставит стиль на обёртку `.sg-pick`, а не на кнопку.

**Сессия 24 (этап 6, порция 2):**
- `stringFrom` и `l10nStrings` — внутренние имена формата, в «JavaScript истории» доступны. `Macro.get('=').handler` можно обернуть, как `type` и `timed`; `<<print>>` и `<<->>` — отдельные записи, их обёртка не трогает. В обработчике `this.output` не подменить, поэтому вывод перекладывается в свой `span` уже после вызова.
- Порядок запуска SugarCube: `Dialog.init`, `UIBar.init`, `Engine.init`, затем `runUserScripts`, затем `L10n.init`, `DebugBar.init`. Что собрано раньше, надпись из `l10nStrings` не получит (крестик окна).
- `<<back>>` без экрана при `Config.history.maxStates = 1` — ошибка `cannot find passage`, в проверках не использовать.
- `addLogic` вставляет «Значение» мимо `writeText`, поэтому движок ставит `addBlock`. Нашла только `electron-step6b.mjs`.
- `findClose` возвращает `{at, end}`, поля `to` нет; `tsc` это ловит.
- Движок стоит в «StoryScript» **выше** кода автора: проверочную строку автора дописывать в конец пассажа, а не в начало.
- Новая игра: кнопка `button.sg-new-game-yes` (встроенная), `.sg-key-yes` — у своих клавиш с вопросом.

**Сессия 25 (подготовка к игре):**
- Обход имён экранов в командах — `walkScreens` в `signaly-rename.ts`; им пользуются и переименование, и `screenMentions` (проверка истории). Новое слово с именем экрана добавлять в `screenWords` — его подхватят оба.
- `findBlocks` теперь находит и `<<include>>` (не `sg-`): `openRe` — `<<(sg-(?:…)|include)`, `macroType` сравнивает полное имя. Новый блок без `sg-` — так же.
- Окно проверки открывает экран `addPassageEditors(story.id, [id])` из `src/dialogs/context` и закрывается само (окно во весь экран закрыло бы редактор). Форма блока в панели берёт `useDialogsContext()` до первых `return`.
- В движке есть примеры путей `media/audio/x.wav` в комментариях: любая проверка путей должна пропускать комментарии (`withoutComments`).
- Живая зона KR2 сравнивает `innerHTML` двух выводов: вывод со случайностью (`either()`, `random()`) будет перерисовываться каждые 250 мс. В шаблоне такого нет.
- Артефакт «Каркасы радио» — https://claude.ai/artifact/QkYxtEYW6KcMTqLQg2tjhH (обновлять — `Artifact` с этим `url`, сначала `read`). Каркасы нарисованы SVG по данным (список элементов с координатами), их можно перенести в движок.

**Сессия 26 (шаг 7.1, упрощения):**
- **Не запускать `npx prettier`:** в репозитории нет prettier, `npx` ставит третью версию и переформатирует файлы целиком (сессия 26 — пришлось откатить четыре файла). Формат держать руками, как в соседнем коде.
- Музыка — `signaly-music.ts` (`readMusic`, `writeMusic`, `findScreenMusic`, `setScreenMusic`, `musicProblems`), окно — `src/dialogs/signaly-music/`, форма музыки экрана — `signaly-screen-music-form.tsx` (цель панели `{kind: 'music'}`), действие — `MusicAction` (`parseMusic`, `writeMusicAction`) и `MusicActionFields` в `signaly-action-list.tsx`. Списки треков и папок для форм — поля `tracks`, `folders` у `CondListsContext` (`useCondLists` читает пассажи `sg-music`).
- Движок: раздел «Музыка» стоит перед «Кнопкой-перебором», до границы предпросмотра (блок «Громкость» рисуется и в предпросмотре; звук — нет). Имена — с приставками `mus`, `vol`. `<<sg-mus>>` и `<<sg-screen-music>>` — `skipArgs`, слова из `this.args.raw` (`musWords`): разбор SugarCube превратил бы `+5` в число без знака.
- Перемотка `audio.currentTime` в Chromium требует ответа сервера на `Range`: серверы `music-play`, `radio-play`, `air-play`, `reverse-play`, `sstv-play` отвечают 206; у серверов других проверок этого нет.
- `setup.signaly.music()` отдаёт таблицу без ссылок на папки: в `page.evaluate` объект с кольцевыми ссылками проходит, а `JSON.stringify` в проверке падает.
- `ButtonsField` (`signaly-appearance-fields.tsx`) — выбор кнопками, `role="radiogroup"`/`radio`; в проверках `getByRole('radiogroup', {name}).getByRole('radio', {name})`.
- Шаблоны и тесты читают файлы в момент запуска: шаблон и программу во время прогона `runall.sh` не пересобирать.

**Сессия 27 (шаг 7.2):**
- Радио — `signaly-radio.ts`, окно `src/dialogs/signaly-radio/` (предпросмотр — временный пассаж `signaly-radio-preview` с одним блоком), блоки `radio`, `ambient` в `signaly-screen-blocks.ts` (в `openRe` `sg-radio` не ловит `sg-radio-view`: проверка конца слова). Движок: раздел «Радио и Каталог Атмосферы» сразу после блока «Громкость», до границы предпросмотра; имена — с приставками `radio`, `amb`; `musChanged()` перерисовывает и их.
- **Пояснения `/* … */` с образцами команд:** окна читают их как команды (`<<sg-track>>…<</sg-track>>` в заголовке «Музыки» давал пустую папку). `find` в `signaly-music.ts`, `signaly-radio.ts`, `signaly-sstv-store.ts` пропускает куски из `commentRanges`; новый разбор — так же. И заголовок нового пассажа не передавать в `writeMusic`/`writeRadios` как текст: они удалят из него «команды»; писать `writeMusic('', …)`.
- Перевод шаблона — `moveTemplateMusic` (`signaly-music-template.ts`), контрольные числа экранов radio и «Атмосфера» — `scriptHash` из `signaly-hack.ts`. Новые пассажи создаёт `saveStoryWithUpgrade`; окно, которое само пишет такой пассаж, должно передать свой текст (`own`) и не создавать пассаж второй раз (`pendingTemplateMusic`): второй `createPassage` с тем же именем молча отклоняется.
- В движке неразрывный пробел писать ` `, не символом: ESLint `no-irregular-whitespace`.
- Щелчок по короткой строке редактора в проверке — `click({position: {x: 40, y: 6}})`: щелчок в середину строки ставит курсор после команды, и форма не открывается.
- Тесты, разбирающие старую музыку шаблона (`signaly-actions`, `signaly-sounds`), читают шаблон сессии 26 (`git show 4b9ae32:…`); `sounds-play`, `electron-music`, `electron-radio` получают его же (`/tmp/run/t-4b9ae32.twee`). `music-play`, `radio-play`, `air-play`, `reverse-play`, `sstv-play` убирают пассаж «Музыка» шаблона и пишут свой. `template-play` обходит все экраны: скрытый таймер TERRAFORM_FAIL (30 с) может увести на TERRAFORM — перед проверкой табло таймеры сбрасываются.

**Сессия 28 (шаг 7.3):**
- Вложенная папка — путь в имени (`"Дневники/Глава 1"`), а не отдельное слово: id трека «Путь/Трек» не меняется, `play folder "Путь"` работает как было. `readMusic` отдаёт папки в порядке дерева (`treeOrder`), окно «Музыка» держит вложенные сразу за своей (`blockEnd`, `sibling`).
- Передача эфира с папкой радио дописывается движком в `tracks` этой папки (`t.folder` — папка радио): поэтому «АВТО», ▶, каталог, строка работают без правок; видимость — `musVisible` → `caught`, условие эфира — `musCond`.
- Эфир звучит отдельными `Audio` (по кругу) мимо общего плеера; при поимке `Audio` передачи становится `mus.audio` — звучит без разрыва.
- Запуск эфира при возврате на экран — из `radioDraw` (`!airTimer && st.scan`): `setTimeout` в обработчике блока срабатывал раньше, чем блок попадал на страницу.
- Шрифт цифр радио — `timerFont(...)`: в стиле семейство `sg-timer-font-N`, а не `DSEG7` (проверки ищут `sg-timer-font`).
- В проверках программы поле `RangeField` с подписью из одного слова («до») находится регуляркой `^до`; кнопки «Выше» / «Ниже» папки — `.signaly-button` с точным текстом: у треков такие же значки.
- **Шаблон после правки движка переносить заново (`migrate-twee`) перед проверками** (сессии 28, 29: проверки падали на функциях, которых в старом движке шаблона ещё не было).

**Сессия 29 (замечания build-31, шаг 7.4):**
- **Подмена цвета части радио:** `--sg-re: var(--sg-rb)` на элементе мало — `color` наследуется уже посчитанным у `.sg-radio`, поэтому в том же правиле нужно `color: var(--sg-re)`.
- **Предпросмотр одного элемента** — проп `zoom` (селектор) у `SignalyAppearancePreview`: раз в 250 мс берёт рамку элемента во фрейме и сдвигает и масштабирует `iframe` так, что элемент занимает всё место. Предпросмотр в `.signaly-ticker-preview` стоял без `flex: 1` — масштаб «застревал» (как в решении 51); исправлено CSS для обоих окон.
- **Разворот звука** — в окне программы: `OfflineAudioContext(…).decodeAudioData` (понимает mp3, wav, ogg), отсчёты задом наперёд, `encodeWav` 16 бит. Файлы читает и пишет главный процесс: `signaly-reverse-needed`, `signaly-read-media` (только внутри `media/`), `signaly-write-reverse` (только `.wav` в `media/audio/reverse/`).
- В песочнице есть **ffmpeg**: `electron-reverse.mjs`, `electron-sstv.mjs` делают им настоящий MP3.
- Зажатая кнопка в Playwright — `page.mouse.down()` / `up()` над ней; у `button.sg-r-revbtn` `pointerdown` с `setPointerCapture`, звук нажатия — в `pointerdown`, общий `click` её пропускает.
- −/+ частоты срабатывают не чаще раза в секунду: в проверке между нажатиями ждать 1,1 с.

**Сессия 30 (ответы 2А–6Б, ТЗ 1В: помехи, «СЛУЧАЙНО», радио с декодером, SSTV):**
- **SSTV:** `src/util/signaly/signaly-sstv.ts` — свой декодер и кодировщик (14 режимов; заголовок VIS, синхроимпульсы, поправка на часы передатчика `fitLine`; частота — смешивание с 1900 Гц, фильтр, разность фаз). Чистые функции: работают в программе, в jest и в Node (`signaly/tools/tsconfig.json` собирает его в `.signaly-tools/src/util/signaly/signaly-sstv.js` — им пользуются `sstv-play`, `electron-sstv`). Кодирование 320×240 Robot 36 при 11 025 Гц и разбор — меньше секунды.
- **Игра из папки (file://) звук своих файлов не читает:** `MediaElementAudioSource` отдаёт нули (CORS), `fetch` file:// запрещён. Всё, что требует отсчётов звука (реверс, SSTV), — только в программе при «Сохранить».
- Картинки SSTV — `src/dialogs/signaly-sstv-images.ts` (как `signaly-reverse-copies.ts`): `signaly-media-stamps` (отметки «время-размер»), `signaly-write-sstv` (только `.png` в `media/img/sstv/`). PNG — `canvas.toBlob`. Движок рисует строки `drawImage` из `Image`: при file:// холст становится «грязным» и `getImageData` недоступен, но `drawImage` и `putImageData` работают; в проверках (http) `setup.signaly.dec().pixel(x, y)` читает цвет.
- **Помехи:** папки `jam` не кладутся в `byName` движка (имена — названия видов радио, могут совпасть с папками радио), id треков «jam:Вид/Трек»; `treeOrder` не вкладывает папки `jam`; `musicProblems` не сравнивает их имена с остальными. `radioOrder` — порядок видов (объект `radioTable` порядок не хранит).
- **Приглушение и общий плеер:** `duckTracks` трогал только дорожки SimpleAudio; общий плеер — множитель `mus.duck` в `musApply`, у предзвука (`pre.sgLevel`), в `airTick` и `musFadeOut`.
- Окно «Музыка» пишет ещё и пассаж «Радио» (`withoutLegacyJams`): запись файла истории идёт с задержкой, поэтому проверка второго пассажа после первого — через `waitFor`, а не сразу.
- Проверочный локатор строки каталога `line(page, name)` экранирует имя для регулярки: `'..'` как регулярка совпадает с любым двухбуквенным именем (`j1`).
- У `has:` в Playwright селектор — относительно найденного элемента: `page.locator('.sg-r-line', {has: page.locator('.sg-r-name')})`, а не `'.sg-radio .sg-r-name'`.
- `sed` с `..` в образце заменяет не то, что задумано (в сессии 30 строка исходника стала «X»): правки — Python-скриптом с проверкой, что кусок найден ровно один раз.
- Журнал сессии на диске в этой песочнице может отсутствовать (`/root/.claude/projects` нет): поэтому копии документов теперь в репозитории.

**Сборка и тесты:**
- `npm ci --ignore-scripts`; типы — `npx tsc --noEmit -p tsconfig.json` и `-p tsconfig.electron.json`; ESLint — `npx eslint src --quiet`.
- Тесты: `npx jest src/util/signaly src/dialogs/signaly src/electron src/store` (**1092**; 16 пропусков — свои тесты Twine); после правок окна пассажа — `npx jest src/dialogs/passage-edit src/routes/story-edit src/components/route-toolbar src/store/prefs` (215; иногда падает 1–2 теста карты — повторить). Полный `npx jest` (~1890) — в GitHub Actions. Тесты `signaly-sounds` и `signaly-timers` сравнивают с шаблонами прошлых сборок через `git show c6bc328:…` / `5a96fb2:…` — клонировать с `--depth 50` или глубже.
- Веб-версия: `npx vite build` → `dist/web` (после правок `public/locales` и форм — пересобрать). Для Electron: `dist/web` → `electron-build/renderer`, затем `npm run build:electron-main`.
- GitHub Actions: `.github/workflows/build-windows.yml` — тесты (Ubuntu) → сборка `windows-latest` → релиз `build-<номер запуска>` с `.zip`, шаблоном и `MEDIA.md`; `.github/workflows/check.yml` — ветки `session-*` (типы, ESLint, jest, vite build) без релиза. Сборка идёт ~7–25 мин. Номер запуска — `gh api repos/smanager7777777/twine-signaly/actions/runs/<id> --jq .run_number`.
- `gh` работает через REST API (`gh run list/watch/view`, `gh api …`). Журналы Actions и файлы релизов не скачиваются. Ошибки тестов — `gh api repos/smanager7777777/twine-signaly/check-runs/<id задания>/annotations`.
- Пуш может написать `push negotiation failed; proceeding anyway` — проверить `git ls-remote origin`. Перед пушем — `git fetch origin main`.
- **Релиз собирается при каждом пуше в `main`, поэтому до конца проверок работа живёт в отдельной ветке** (`session-NN`), затем `git merge --ff-only`. Клон с `--no-single-branch` видит все ветки.
- Подключение репозитория `add_repo` проверка прав может отклонить в первый раз: тогда сразу подтвердить автору, как понял ответы, и попросить разрешение строкой (как в сессии 14).
- `sleep` запрещён — ждать сборку `gh run watch …` с `run_in_background`, долгие проверки — тоже в фоне (`run_in_background`), ожидание файла — `until …; do sleep 5; done` в фоне.

**Проверки (`signaly/tests/`):**
- Все подряд — `bash signaly/tests/runall.sh` в фоне (около полутора часов на 2 ядрах: игра 25 наборов, программа 23 набора с одним повтором упавшего; итог — `/tmp/run/summary.txt`). Перед запуском: старые шаблоны — `for c in a8b24b6~2 64321cf 5e0afed 30462fa 60c483a fa0a506 b6203c6 2e57ad0 b633a9d 8b80f1a c6bc328 4b9ae32; do git show $c:signaly/template/27_03_2025.twee > /tmp/run/t-${c/\~/_}.twee; done` (`~` в `${c/~/_}` без обратной косой черты не заменяется); Electron — скачать `https://github.com/electron/electron/releases/download/v43.4.1/electron-v43.4.1-linux-x64.zip` curl'ом, распаковать в `node_modules/electron/dist`, `printf electron > node_modules/electron/path.txt`; собрать программу (см. выше); `npx tsc -p signaly/tools/tsconfig.json`; шаблон перенести заново, если менялся движок. Скрипт сам кладёт пустышки медиа и шрифт DSEG7 (`npm pack dseg`).
- Отдельные наборы — строки `game …` и `el …` в `runall.sh` показывают аргументы. Наборы программы запускаются `TWEE=… MEDIA=… SHOT=… OUT=… xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-….mjs <playwright>`; в конце пишут «ВСЁ ХОРОШО» или «N/N проверок пройдено». Наборы игры — `node signaly/tests/…-play.mjs <шаблон.twee> <папка с media> <playwright> [снимки] [ещё игра.html …]`; «ещё игра» (опубликованная обычным Twine) должна лежать в папке с медиа.
- Playwright: глобальный `/opt/npm-tools/node_modules/playwright` (браузеры в `/opt/pw-browsers`); `sharp` — `/opt/npm-tools/node_modules/sharp`.
- Пустышки медиа: `python3 signaly/tests/make_placeholder_media.py signaly/template/media-list.txt <папка>`. Звуки-пустышки короткие: в проверке «играет ли» ставить `loop`; наборы музыки и радио пишут звуки нужной длины сами.
- Публикация .twee: `node signaly/tests/publish-twee.mjs история.twee игра.html [debug] [start=Пассаж]`.
- Перенос .twee: `npx tsc -p signaly/tools/tsconfig.json`, затем `node .signaly-tools/signaly/tools/migrate-twee.js вход.twee выход.twee ['{оформление}'] ['{виды}']`; повторный запуск ничего не меняет. **После правок `src/util/signaly` пересобрать.** Шаблон в репозитории обновляется так же (вход и выход — шаблон).
- Вид до/после: `HOVER=1 DIALOGS=1 node signaly/tests/appearance-compare.mjs <папка> было.html стало.html <playwright> <sharp> [снимки]`. Обе версии собирать с `'{"typeSeen":false,"typeClick":false}'`; **«было» переносить старым `migrate-twee`** (`git worktree add --detach <папка>/old <запись>`, `ln -s` на `node_modules`, `npx tsc -p signaly/tools/tsconfig.json`). Отличия, которые не ошибка: экран с идущим таймером при нажатии (`Clocktest5`), `Clocktimer`, `Хактест` (случайная расстановка слов), XIAOMICAM (живой шум), наведение и нажатие на экране radio (искры сломанного радио случайны).
- Обычный Twine: первая запись репозитория `50dcf30` (`git worktree add --detach <папка>/upstream 50dcf30`, `ln -s` на `node_modules`, `npx vite build`); `node signaly/tests/upstream-roundtrip.mjs <upstream dist/web> история.twee <папка> <playwright>` → `export.twee` и `upstream.html`; сравнение .twee — `python3 signaly/tests/twee_compare.py a.twee b.twee`; затем пройти новое в `upstream.html` («ещё игра» у набора).
- **`actions-play.mjs` нестабильна:** проверка «плавно к 10 %» иногда не дожидается конца затухания — повторить. `hack-play` при параллельной нагрузке иногда падает по времени — повтор проходит. В `air-play` помеха может случайно встать точно на 103,0 и, с сессии 30, начать удержание — повтор проходит.
- Безоконный Chromium в полноэкранном режиме не передаёт колесо мыши — перед проверкой прокрутки выйти из полного экрана.

**SugarCube 2.37:**
- `Dialog.setup` и `<<silently>>` устарели — `Dialog.create` и `<<silent>>`. Окно — `#ui-dialog…`; фон — `#ui-overlay`. Классов `.ui-dialog…` нет. `Story.lookup` устарел — `Story.filter(p => …)`.
- Имена макросов и переменных — только латиница. Слова без кавычек в аргументах — строки; `#цвет` и слова с дефисом — в кавычках; **`$имя` без кавычек — значение переменной** (поэтому `var "$progress3"` — в кавычках). `this.source` — весь текст команды (у парной — с закрывающей); `this.payload[0].contents` — текст внутри парной команды до первого тега, `this.payload[1]` — после первого тега (`<<sg-answer>>`). `skipArgs: true` — аргументы не разбираются (так у `<<sg-event>>`, где после имени — выражение).
- `<<link>>` и `<<button>>` — парные команды (нужен `<</link>>`/`<</button>>`), аргументы одинаковые: надпись и необязательный экран; тело выполняется при щелчке (`Wikifier.wikifyEval`, вывод отбрасывается), затем переход. У разметки `[[…]]` на карте Twine рисуется стрелка, у `<<button "…" "Экран">>` — нет.
- `<<=>>` — то же, что `<<print>>`. `<<switch>>` сравнивает строго (`===`): `<<case 1>>` не совпадёт с `"1"`.
- `<<type>>`: печатается по очереди с другими `<<type>>` экрана (`TempState.macroTypeQueue`); содержимое wikify-ится в момент начала печати; события `:typingstart`, `:typingstop`, `:typingcomplete`. Неизвестное слово в `<<type>>` — ошибка.
- `<<timed>>`: `t8n` ищется только во втором слове; плавность `.macro-timed-insert` — 400 мс; при уходе с экрана отменяется (в том числе внутри ссылки или клавиши с переходом).
- `\` в конце строки склеивает строки; в самом конце текста или перед `<</…>>` без переноса — выводится как символ.
- Временные переменные `_x` — `State.temporary.x`; живут до перехода на другой экран (ответ кода с `_who` показывается до перехода — успевает).
- Состояние сохраняется только при переходе (автокопия движка дополнительно пишет переменные после действий, таймеры при их изменении и отметки событий). Переменные, изменённые между переходами (`State.variables`), переходят в новый шаг истории. `Config.history.maxStates = 1` — в движке. `Engine.restart()` («Новая игра») перезагружает страницу — все переменные из StoryInit заново.
- Браузер не даёт звук и полный экран до первого клика. Удалённое со страницы видео браузер сам ставит на паузу.
- Базовый CSS SugarCube для ссылок и кнопок: `a {color:#68d}`, `button {color:#eee; background:#35a; border:1px solid #57c; padding:.4em}`, у кнопок `font: inherit`.
- SimpleAudio: `SimpleAudio.tracks.get(id)` (`.volume()`, `.loop()`, `.isPlaying()`, `.audio`), `groups.get(id)`, `lists.get(id).tracks`; `<<waitforaudio>>` ждёт только уже объявленные звуки.
- `Engine.isIdle()` — ложно, пока SugarCube показывает экран.
- Исходники: `git clone --depth 1 --branch v2.37.3 https://github.com/tmedwards/sugarcube-2` (`src/macro/macros/type.js`, `timed.js`, `switch.js`, `if.js`, `button-link.js`, `audio-macros.js`, `src/lib/nodetyper.js`, `src/audio/simpleaudio.js`, `src/macro/macrocontext.js`, `src/story.js`). Собранный формат — `public/story-formats/sugarcube-2.37.3/format.js` (быстро проверить, есть ли функция: `grep -o`).

## Как записывать решения
В `05_AUTHOR_DECISIONS.md` — таблица: номер, дата, вопрос, решение автора, что изменено. Решение «не нужно» записывать тоже. Отменённое решение не удалять: пометить, каким решением оно отменено. Находки при проверке, которые меняют поведение для автора (как «через N секунд отменяется при переходе»), и уточнения, которые агент сделал сам в рамках ответа автора (решения 76, 81 … 143), — тоже строкой.

## Руководства и исходники
- SugarCube 2: github.com/tmedwards/sugarcube-2 — `docs/`, `dist/format.js`.
- Twine 2: github.com/klembot/twinejs (тег 2.12.1).
- Спецификации Twee 3 и HTML Twine 2: github.com/iftechfoundation/twine-specs.
- 100% Good Twine SugarCube Guide (manonamora): github.com/manonamora/SugarCube-Guide.
- Twine Cookbook: https://twinery.org/cookbook/.

## О самой игре
Подробности сюжета тебе не нужны. Что терминал должен уметь — в `04_GAME_LINK.md`. Сюжетные вопросы решаются в другом проекте автора; если вопрос сюжетный — скажи автору, что его стоит обсудить там.
