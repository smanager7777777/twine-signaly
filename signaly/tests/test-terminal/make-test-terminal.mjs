// «Тест терминала» (Т30-1 А, Т31-4 А): тестовая история для проверки терминала с пакетом телефонов test-net-pack
// (как заметка тестировщика приложения, но для Twine). Пакет загружается в историю так же, как окно «Приложение»;
// сверху — экраны проверок (сначала новое в сборке). Движок и оформление ставит migrate-twee.
// Обновлять каждую сборку движка: список проверок — CHECKS ниже, номер сборки — BUILD.
// Запуск (из корня репозитория): npx tsc -p signaly/tools/tsconfig.json
//   node signaly/tests/test-terminal/make-test-terminal.mjs [пакет.sgpack] → signaly/tests/test-terminal/test-terminal.twee
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../..');
const tools = path.join(root, '.signaly-tools/src/util/signaly');
const {readSgpack, gameToStory} = require(path.join(tools, 'signaly-app.js'));
const {readCodes, writeCodes} = require(path.join(tools, 'signaly-codes.js'));
const {signalyEngineVersion} = require(path.join(tools, 'signaly-engine.js'));

const BUILD = 'сессия 41 (движок ' + signalyEngineVersion + ')';
const packPath = process.argv[2] || path.join(root, 'src/util/signaly/__tests__/fixtures/app-test-net-pack-p20.sgpack');
const out = path.join(here, 'test-terminal.twee');
const pack = readSgpack(new Uint8Array(fs.readFileSync(packPath)));
const r = gameToStory([], pack.game, Object.keys(pack.files));

// Личные коды: №N — NNN (№7 Психолог Тест — 777), чтобы проверять «у того, кто ввёл код».
const table = readCodes(r.codesText);
table.people = table.people.map(p => ({...p, pin: p.pin || p.id.repeat(3), raw: undefined}));
const entry = (code, label, actions, answer, title = 'ТЕСТ') => ({
	code, label, decoder: false, who: [], once: '', title, answer, goto: '', denied: '', used: '', when: '', lock: '',
	actions: actions.map(code => ({type: 'code', code})), multiline: false, extra: []
});
table.codes.push(
	entry('T1', 'Тест: +1 взлом у вводящего', ['<<sg-personal-add "hacks" 1>>'], '+1 взлом у того, кто ввёл код. Сейчас у вас: <<= sgPersonal("hacks", _who)>>'),
	entry('T0', 'Тест: взломы 0 у вводящего', ['<<sg-personal-set "hacks" 0>>'], 'Взломы у того, кто ввёл код, — 0.'),
	entry('T5', 'Тест: +5 у №7 (без личного кода)', ['<<sg-personal-add "hacks" 5 "7">>'], '+5 взломов у №7.')
);
const codesText = writeCodes(r.codesText, table);

const back = '\n\n[[← К списку проверок|Начало]]';
const value = expr => `<span class="sg-value"><<= ${expr}>></span>`;
const people = table.people.filter(p => p.phone).map(p => ({num: p.id, name: (JSON.parse(p.phone).name || '').replace(/ Тест$/, '')}));
const personalRows = people
	.map(p => `№${p.num} ${p.name}: ${value(`sgPersonal("hacks", "${p.num}")`)} · за 1 мин: ${value(`sgPersonalWin("hacks", "${p.num}", 1)`)}`)
	.join('\n');

/* Проверки: [пассаж, заголовок в списке, текст экрана]. Сначала — новое в сборке. */
const CHECKS = [
	['new'],
	['Т11 Номер', 'Команды «кому: №7» и «Глава 1» (исправлено)',
		'Замечания к build-44: всё, что адресовано номеру сотрудника («to "7"»), до телефона не доходило — телефон узнаёт только свой id персонажа, а не номер. Теперь терминал добавляет к номеру id (персонажей знает центр). «Глава 1» после «Глава 2» телефоны пропускали — теперь глава с терминала, как с пульта, меняется и назад.\n\n' +
		'<<link "Только №7">><<sg-net notify "ТЕРМИНАЛ" "Только Психологу" to "7">><</link>> · <<link "№7 — в строку, 1 проход">><<sg-net notify "ТЕРМИНАЛ" "Один проход — только №7" ticker repeat 1 to "7">><</link>>\n' +
		'<<link "Сбой экрана у №7">><<sg-net glitch "Сбой экрана" to "7">><</link>> · <<link "Снять сбои">><<sg-net fix "">><</link>>\n' +
		'<<link "Глава 2">><<sg-net chapter 2>><</link>> · <<link "Глава 1">><<sg-net chapter 1>><</link>>\n\n' +
		'Должно быть: уведомление, строка и сбой — только на 555555 (Психолог, №7), на 111111 — нет; «Глава 2», потом «Глава 1» — у всех телефонов снова глава 1.'],
	['prev'],
	['Т1 Личные', '1. Личные переменные «у каждого своя» с терминала',
		`Личная $hacks («Взломы»): у каждого персонажа своё значение (центр — «var:hacks@id»). Начальное у №7 — 1, максимум у №7 — 5 (окно «Переменные»).\n\n${personalRows}\n\n` +
		'<<link "+1 у №7 (Психолог)">><<sg-personal-add "hacks" 1 "7">><</link>> · <<link "−1 у №7">><<sg-personal-add "hacks" -1 "7">><</link>> · ' +
		'<<link "+1 у №1 (Инженер)">><<sg-personal-add "hacks" 1 "1">><</link>> · <<link "+1 у всех">><<sg-personal-add "hacks" 1 "all">><</link>> · ' +
		'<<link "Записать 0 у всех">><<sg-personal-set "hacks" 0 "all">><</link>>\n\n' +
		'Должно быть: на телефоне 555555 (Психолог, тестировщик) в шапке растут «ВЗЛОМЫ» (не выше 5) и «ЗА 1 МИН»; у Инженера (111111) — своё значение; на пульте мастера «ИГРА» → «ЛИЧНЫЕ ПЕРЕМЕННЫЕ» — те же числа. Числа здесь обновляются сами.'],
	['Т2 Код', '2. Код терминала «+1 у того, кто ввёл» (личный код)',
		'Введите код T1 — терминал спросит личный код (№7 — 777, №1 — 111). +1 взлом у того, чей личный код. T0 — записать 0 у вводящего, T5 — +5 у №7 без личного кода.\n\n<<sg-code button "ВВОД" table>>\n<</sg-code>>\n\n' +
		`Сейчас: ${personalRows.split('\n').slice(-1)[0]}\n\nДолжно быть: после T1 с кодом 777 у Психолога +1 (телефон 555555, шапка), у других — без изменений.`],
	['Т3 Условия', '3. Условия sgPersonal и «за N минут» (окно «События»)',
		'Два события терминала (окно «События», условие «Личная переменная сотрудника»):\n— «ПСИХОЛОГ: 3 ВЗЛОМА» — когда у №7 взломов не меньше 3 (sgPersonal("hacks", "7") gte 3), один раз;\n— «2 ВЗЛОМА ЗА МИНУТУ» — когда у №7 за 1 минуту прибавилось не меньше 2 (sgPersonalWin("hacks", "7", 1) gte 2), снова — после остывания.\n\n' +
		'<<link "+1 у №7">><<sg-personal-add "hacks" 1 "7">><</link>> · <<link "Записать 0 у №7">><<sg-personal-set "hacks" 0 "7">><</link>>\n\n' +
		`№7: ${value('sgPersonal("hacks", "7")')} · за 1 мин: ${value('sgPersonalWin("hacks", "7", 1)')}\n\nДолжно быть: два быстрых «+1» — окно «2 ВЗЛОМА ЗА МИНУТУ»; при 3 — окно «ПСИХОЛОГ: 3 ВЗЛОМА». На телефоне 555555 — авария «ПЕРЕГРЕВ» от правила центра (3 взлома за минуту), COOL — снять.`],
	['Т4 Без связи', '4. Прибавка без связи',
		'Ctrl+Shift+N → «ОТКЛЮЧИТЬ» (огонёк в углу станет серым/красным). Нажмите «+1 у №7» два раза — число здесь растёт сразу, в окне «Сеть» — «ждут отправки: 2». Подключите снова (адрес центра) — на телефоне 555555 «ВЗЛОМЫ» +2.\n\n' +
		`<<link "+1 у №7">><<sg-personal-add "hacks" 1 "7">><</link>>\n\n№7: ${value('sgPersonal("hacks", "7")')}`],
	['Т5 Строка', '5. Бегущая строка с терминала (галочка «в бегущую строку»)',
		'<<link "Всем — в строку">><<sg-net notify "ТЕРМИНАЛ" "Тест бегущей строки — всем" ticker>><</link>>\n' +
		'<<link "№7 — в строку, 1 проход">><<sg-net notify "ТЕРМИНАЛ" "Один проход — только №7" ticker repeat 1 to "7">><</link>>\n' +
		'<<link "Всем — обычным окном">><<sg-net notify "ТЕРМИНАЛ" "Обычное уведомление">><</link>>\n\n' +
		'Должно быть: первые два — строкой под шапкой (нажатие — текст целиком), второе — один проход и только у 555555; третье — окном. Убрать строку — код NEWS0 на телефоне.'],
	['Т6 Формы', '6. Формы Twine (проверить в программе)',
		'В программе «Twine СИГНАЛЫ» с этой историей (импорт test-terminal.twee):\n' +
		'— «Переменные» → $hacks: «У каждого своя (личная)», таблица «Персонаж — Начальное — Максимум».\n' +
		'— «Приложение» → «Шапка и меню»: «Размер шапки», «В шапке не больше N показателей», во второй строке «-» — без второй строки; у показателя — «За N минут».\n' +
		'— «Приложение» → «Сеть и события» → «Уведомления»: картинка, mp3, «Играть сразу», «В бегущую строку», проходы, «Уходит из строки», «Сохранять», папка; ниже — «Бегущая строка» (скорость, цвет, K, реклама).\n' +
		'— «События» → условие на телефонах «общая переменная» с $hacks: «За N минут», «Чья личная», в действиях «Кому» — «Тому, у кого сработало»; действие «Убрать из бегущей строки»; у «Аварии» — «Только этому телефону».\n' +
		'— «Коды» → код телефона: «После ввода», у условия «когда» — «За N минут» и «Чья личная»; персонаж — «Тестировщик».\n' +
		'— Ссылка или код терминала → действие «Личная переменная»; «Телефонам: уведомление» → «В бегущую строку»; условие → «Личная переменная сотрудника».'],
	['old'],
	['Т7 Уведомления', '7. Связь с центром и уведомления',
		`Связь: ${value('window.SgTermNet && SgTermNet.on ? "есть — " + SgTermNet.url : "нет (Ctrl+Shift+N)"')}\n\n` +
		'<<link "Уведомление всем">><<sg-net notify "ТЕРМИНАЛ" "Проверка связи">><</link>> · <<link "Только №7">><<sg-net notify "ТЕРМИНАЛ" "Только Психологу" to "7">><</link>>\n\n' +
		'Должно быть: огонёк в углу зелёный; уведомление на всех телефонах; второе — только на 555555.'],
	['Т8 Общие', '8. Общие переменные (терминал и телефоны)',
		`Энергия $power: ${value('$power')} · Шлюз $open: ${value('$open')} · Нагрев $heat: ${value('$heat')}\n\n` +
		'<<link "Энергия +1">><<set $power += 1>><</link>> · <<link "Энергия −1">><<set $power -= 1>><</link>> · <<link "Шлюз открыть/закрыть">><<set $open to !$open>><</link>>\n\n' +
		'Должно быть: в шапке телефонов «ЭНЕРГИЯ» и «ШЛЮЗ» меняются; код POW+ на телефоне — здесь +1.'],
	['Т9 Команды', '9. Сбой, глава, авария, событие правил',
		'<<link "Сбой экрана у №7">><<sg-net glitch "Сбой экрана" to "7">><</link>> · <<link "Снять сбои">><<sg-net fix "">><</link>>\n' +
		'<<link "Глава 2">><<sg-net chapter 2>><</link>> · <<link "Глава 1">><<sg-net chapter 1>><</link>>\n' +
		'<<link "Авария">><<sg-net alarm "ТРЕВОГА" "Тест аварии">><</link>> · <<link "Отбой">><<sg-net alarm off>><</link>>\n' +
		'<<link "Событие «breach» (правило «Пробой»)">><<sg-net event "breach">><</link>>\n\n' +
		'Должно быть: сбой только у 555555; глава меняется у всех; авария с сиреной и отбой; событие — правило центра «Пробой».'],
	['Т10 С телефона', '10. С телефона на терминал',
		`Код HACK с телефонов: ${value('setup.phone("code", "HACK")')} раз · с №7: ${value('setup.phone("code", "HACK", "7")')} · фраза «сигнал терминалу»: ${value('setup.phone("code", "сигнал терминалу")')}\n\n` +
		'Должно быть: код HACK на телефоне — счёт растёт; фраза «сигнал терминалу» голосом — окно «УСЛЫШАНО С ТЕЛЕФОНА».']
];

let list = `ТЕСТ ТЕРМИНАЛА — сборка: ${BUILD}\nПакет телефонов: test-net-pack из релиза signaly-app (П20). Центр — мастерский телефон; терминал: Ctrl+Shift+N → адрес центра или «QR камерой».\n\n`;
const screens = [];
let x = 200;
let num = 0;

CHECKS.forEach(c => {
	if (c[0] === 'new') {
		list += 'НОВОЕ В СБОРКЕ:\n';
	} else if (c[0] === 'prev') {
		list += '\nСБОРКА 40 (подтвердить):\n';
	} else if (c[0] === 'old') {
		list += '\nРАНЬШЕ (подтвердить):\n';
	} else {
		// номера — по порядку в списке (Т32-2 А: новое наверху, старое ниже)
		const title = ++num + '. ' + c[1].replace(/^\d+\. /, '');
		list += `[[${title}|${c[0]}]]\n`;
		screens.push(`:: ${c[0]} {"position":"${x},200","size":"100,100"}\n${c[1].replace(/^\d+\. /, '').toUpperCase()}\n\n${c[2]}${back}\n`);
		x += 125;
	}
});

const events = [
	[':: Событие 3 взлома [sg-event] {"position":"200,400","size":"100,100"}', '<<sg-event popup title "ТЕРМИНАЛ" sgPersonal("hacks", "7") gte 3>>', 'ПСИХОЛОГ: 3 ВЗЛОМА (условие sgPersonal).'],
	[':: Событие 2 за минуту [sg-event] {"position":"325,400","size":"100,100"}', '<<sg-event popup repeat title "ТЕРМИНАЛ" sgPersonalWin("hacks", "7", 1) gte 2>>', '2 ВЗЛОМА ЗА МИНУТУ (условие sgPersonalWin, «за 1 мин»).'],
	[':: Событие с телефона [sg-event] {"position":"450,400","size":"100,100"}', '<<sg-event popup title "ТЕРМИНАЛ" setup.phone("code", "сигнал терминалу") gt 0>>', 'УСЛЫШАНО С ТЕЛЕФОНА: «сигнал терминалу».']
];

const passage = (name, tags, text, pos) => `:: ${name}${tags.length ? ` [${tags.join(' ')}]` : ''} {"position":"${pos}","size":"100,100"}\n${text.replace(/\s+$/, '')}\n`;
const twee = [
	':: StoryTitle\nТест терминала\n',
	`:: StoryData\n${JSON.stringify({ifid: 'B3F0C5E2-7A41-4C8E-9D2B-5A1E3C7F4D20', format: 'SugarCube', 'format-version': '2.37.3', start: 'Начало', 'tag-colors': {'app-block': 'blue', 'app-settings': 'purple'}, zoom: 1}, null, 2)}\n`,
	':: StoryScript [script]\n',
	':: StoryStylesheet [stylesheet]\nbody { background: #000; }\n',
	passage('StoryInit', [], r.initText ?? '', '0,0'),
	passage('Начало', [], list, '0,200'),
	passage('Приложение', ['app-settings'], r.settingsText, '0,400'),
	passage('Коды', ['sg-codes'], codesText, '0,550'),
	...r.blocks.map((b, i) => passage(b.name, ['app-block'], b.text, `${700 + (i % 6) * 125},550`)),
	...screens,
	...events.map(([h, ev, t]) => `${h}\n${ev}\n${t}\n`)
].join('\n\n');

fs.writeFileSync(out, twee);
execFileSync('node', [path.join(root, '.signaly-tools/signaly/tools/migrate-twee.js'), out, out], {stdio: 'inherit'});
console.log('ok', out);
