// Проверка программы (Electron), сессия 9: папка игры помнится после
// перезапуска (решение 65), ссылка ↔ кнопка в меню «Вид» (решение 66), окно
// «Переменные», «Условие», «Состояния», «Значение переменной» (шаг 3.1).
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-logic.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-logic-'));
const game = path.join(home, 'Игра СИГНАЛЫ');
const shot = name => (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', `-${name}.png`);
const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};

async function launch() {
	const app = await electron.launch({
		executablePath: process.env.ELECTRON_BIN || require('electron'),
		args: ['--no-sandbox', 'electron-build/main/src/electron/main-process/index.js'],
		env: {...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}
	});
	const win = await app.firstWindow();

	await win.waitForLoadState('domcontentloaded');
	await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setBounds({x: 0, y: 0, width: 1600, height: 1000}));
	await app.evaluate(({dialog}, dir) => {
		dialog.showOpenDialog = async () => ({canceled: false, filePaths: [dir]});
	}, game);
	await win.waitForTimeout(3000);
	return {app, win};
}

const btnOf = win => re => win.getByRole('button', {name: re});

async function openStory(win) {
	await win.getByRole('tab', {name: 'Библиотека'}).click();
	await win.getByText('27,03,2025').first().click();
	await win.getByRole('tab', {name: 'История'}).click();
	await btnOf(win)(/^Редактировать$/).first().click();
	await win.waitForTimeout(1500);
}

// 1. Импорт шаблона, выбор папки игры.
let {app, win} = await launch();
let btn = btnOf(win);

await btn(/^Пропустить$/).click();
await win.getByRole('tab', {name: 'Библиотека'}).click();
await btn(/^Импорт$/).click();
await win.locator('input[type=file]').setInputFiles(process.env.TWEE);
await win.waitForTimeout(1000);
if (await btn(/Импортировать/).count()) await btn(/Импортировать/).last().click();
await win.waitForTimeout(1000);
await openStory(win);
await win.getByRole('tab', {name: 'История'}).click();
await btn(/^Подробности$/).click();
await win.waitForTimeout(500);
await btn(/Выбрать папку игры/).click();
await win.waitForTimeout(800);
check('папка игры выбрана', (await win.locator('.signaly-game-folder').textContent()).includes(game));
await app.close();

// 2. Перезапуск программы: папка игры та же (раньше — «не выбрана»).
({app, win} = await launch());
btn = btnOf(win);
await openStory(win);
await win.getByRole('tab', {name: 'История'}).click();
await btn(/^Подробности$/).click();
await win.waitForTimeout(500);
const folderText = await win.locator('.signaly-game-folder').textContent();
check('после перезапуска программы папка игры помнится', folderText.includes(game), folderText);
const prefs = JSON.parse(fs.readFileSync(path.join(home, '.config', 'Twine СИГНАЛЫ', 'prefs.json'), 'utf8'));
check('папка записана по IFID истории', Object.keys(prefs.gameFolders).some(k => /^[0-9A-F-]{36}$/i.test(k)), JSON.stringify(prefs.gameFolders));
await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click();
if (process.env.MEDIA) {
	fs.cpSync(path.join(process.env.MEDIA, 'media'), path.join(game, 'media'), {recursive: true});
}

// 3. Окно «Переменные».
await win.getByRole('tab', {name: 'История'}).click();
await btn(/^Переменные$/).click();
await win.waitForSelector('.signaly-sounds-window');
const varWin = win.locator('.signaly-sounds-window');
const listed = await varWin.locator('.signaly-kinds-item').allTextContents();
check('переменные шаблона в списке', listed.some(t => t.startsWith('$buttoner')) && listed.some(t => t.startsWith('$visitCount')), listed.join(' | '));
check('найденные в тексте без значения предлагаются', (await varWin.getByRole('button', {name: '+ $PRCD'}).count()) === 1);
await varWin.getByRole('button', {name: 'Добавить переменную'}).click();
await varWin.getByLabel('Имя (латиницей)').fill('chapter');
await varWin.getByLabel('Подпись по-русски').fill('Глава');
await varWin.getByLabel('Начальное значение').fill('2');
await varWin.getByRole('button', {name: 'Добавить переменную'}).click();
await varWin.getByLabel('Имя (латиницей)').fill('flightlog1');
await varWin.getByLabel('Подпись по-русски').fill('Журнал полёта');
await varWin.getByLabel('Тип').selectOption('bool');
await varWin.getByLabel('В начале игры — «да»').check();
await varWin.getByRole('button', {name: '+ $PRCD'}).click();
await varWin.getByLabel('Подпись по-русски').fill('Процедура');
check('у найденной переменной тип угадан по тексту (число)', (await varWin.getByLabel('Тип').inputValue()) === 'number');
await varWin.getByRole('button', {name: 'Найдено'}).count();
await win.screenshot({path: shot('variables')});
await varWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
const libDir = path.join(await app.evaluate(({app}) => app.getPath('documents')), 'Twine СИГНАЛЫ', 'Истории');
const storyFile = () => fs.readFileSync(path.join(libDir, fs.readdirSync(libDir).find(f => f.startsWith('27_03_2025'))), 'utf8');
const saved = storyFile();
check(
	'StoryInit: раздел переменных с подписями',
	saved.includes('СИГНАЛЫ: переменные') &&
		saved.includes('&lt;&lt;set $chapter to 2&gt;&gt; /* Глава */') &&
		saved.includes('&lt;&lt;set $flightlog1 to true&gt;&gt; /* Журнал полёта */') &&
		saved.includes('&lt;&lt;set $PRCD to 0&gt;&gt; /* Процедура */'),
	saved.slice(saved.indexOf('СИГНАЛЫ: переменные') - 20, saved.indexOf('конец переменных') + 20)
);
await varWin.getByRole('button', {name: 'Закрыть'}).click();

// 4. Ссылка ↔ кнопка, условие, состояния, значение — в новом экране.
await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: /^Texttests$/})}).dblclick();
await win.waitForSelector('.signaly-format-toolbar');
await win.waitForTimeout(800);
const cmSet = (text, sel) =>
	win.evaluate(
		([t, s]) => {
			const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
			cm.setValue(t);
			cm.getDoc().setSelection(cm.getDoc().posFromIndex(s[0]), cm.getDoc().posFromIndex(s[1]));
		},
		[text, sel]
	);
const cmCursor = at =>
	win.evaluate(i => {
		const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
		doc.setCursor(doc.posFromIndex(i < 0 ? doc.getValue().length + i + 1 : i));
	}, at);
const cmValue = () => win.evaluate(() => document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getValue());
const menu = async (button, item) => {
	await btn(button).click();
	await win.locator('.menu-button-menu').getByText(item, {exact: true}).click();
	await win.waitForTimeout(400);
};
const panel = () => win.locator('.signaly-block-panel');

const linkText = '<span class="red-big">[[Назад|Start]]</span>\n';
await cmSet(linkText, [30, 30]);
await win.waitForTimeout(300);
const kindLabel = await btn(/^Вид(:|$)/).textContent();
check('меню «Вид» показывает: красный, ссылка', /Красн.*· ссылка/.test(kindLabel ?? ''), kindLabel);
await menu(/^Вид(:|$)/, 'Сделать кнопкой');
check('ссылка стала кнопкой того же вида', (await cmValue()) === '<span class="red-big"><<button "Назад" "Start">><</button>></span>\n', await cmValue());
await cmCursor(30);
await win.waitForTimeout(300);
check('меню «Вид»: кнопка', /· кнопка/.test((await btn(/^Вид(:|$)/).textContent()) ?? ''));
await menu(/^Вид(:|$)/, 'Сделать ссылкой');
check('кнопка снова ссылка [[…]]', (await cmValue()) === linkText, await cmValue());

// Условие на выделенный текст.
await cmSet(linkText + 'Секретный текст', [linkText.length, linkText.length + 15]);
await btn(/^Условие$/).click();
await win.waitForTimeout(400);
check('условие: выделение обёрнуто, форма открыта', (await cmValue()).endsWith('<<if $inputCode>>Секретный текст<</if>>') && (await panel().locator('strong').textContent()) === 'Условие', await cmValue());
await panel().getByLabel('Переменная', {exact: true}).selectOption('chapter');
await win.waitForTimeout(300);
await panel().getByLabel('Когда').selectOption('gt');
await win.waitForTimeout(300);
await panel().getByLabel('Значение').fill('1');
await win.waitForTimeout(300);
await panel().getByRole('button', {name: 'Добавить условие'}).click();
await win.waitForTimeout(300);
await panel().getByLabel('Переменная', {exact: true}).nth(1).selectOption('flightlog1');
await panel().getByLabel('Показывать, когда выполнены').selectOption('and');
await panel().getByLabel('Иначе показывать другой текст').check();
await win.waitForTimeout(300);
check('условие: форма пишет <<if … and …>> и «иначе»', (await cmValue()).endsWith('<<if $chapter gt 1 and $flightlog1>>Секретный текст<<else>>Другой текст<</if>>'), await cmValue());
await win.screenshot({path: shot('condition')});
await panel().getByRole('button', {name: 'Готово'}).click();

// Щелчок по <<if>> открывает форму.
const v1 = await cmValue();
await win.locator('.signaly-block-mark').filter({hasText: '<<if'}).first().click();
await win.waitForTimeout(300);
check('щелчок по <<if>> открывает форму условия', (await panel().locator('strong').textContent()) === 'Условие');
await panel().getByRole('button', {name: 'Готово'}).click();

// Состояния.
await cmCursor(-1);
await menu(/^Добавить блок$/, 'Состояния (по значению переменной)');
check('состояния: блок вставлен, форма открыта', (await cmValue()).startsWith(v1) && (await panel().locator('strong').textContent()) === 'Состояния');
await panel().getByLabel('Переменная', {exact: true}).selectOption('PRCD');
await panel().getByLabel('Вид кнопок и ссылок').first().selectOption('red-big');
await panel().getByLabel('Что показывать (текст, ссылка, кнопка)').first().fill('Данные повреждены');
await panel().getByLabel('Что показывать (текст, ссылка, кнопка)').nth(1).fill('Нужен пароль');
await panel().getByLabel('В остальных случаях').check();
await win.waitForTimeout(400);
const statesOut = (await cmValue()).slice(v1.length);
check(
	'состояния: <<switch>> с видом и «в остальных случаях»',
	statesOut === '<<switch $PRCD>>\n<<case 0>><span class="red-big">Данные повреждены</span>\\\n<<case 1>>Нужен пароль\\\n<<default>>Текст\\\n<</switch>>',
	JSON.stringify(statesOut)
);
await win.screenshot({path: shot('states')});
await panel().getByRole('button', {name: 'Готово'}).click();

// Значение переменной.
const v2 = await cmValue();
await cmCursor(-1);
await win.evaluate(() => {
	const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
	cm.replaceRange('\n', cm.getDoc().posFromIndex(cm.getValue().length));
});
await win.waitForTimeout(1200);
await cmCursor(-1);
await menu(/^Добавить блок$/, 'Значение переменной');
await panel().getByLabel('Переменная', {exact: true}).selectOption('chapter');
await panel().getByLabel('Показывать «из N» (3 из 5)').check();
await win.waitForTimeout(300);
check('значение: «Глава: N из 5»', (await cmValue()).endsWith('<span class="sg-value">Глава: <<= $chapter>> из 5</span>'), (await cmValue()).slice(-80));
await win.screenshot({path: shot('value')});
await panel().getByRole('button', {name: 'Готово'}).click();
await cmCursor(-1);
await win.evaluate(() => {
	const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
	cm.replaceRange('<br>', cm.getDoc().posFromIndex(cm.getValue().length));
});
await win.waitForTimeout(1200);
await cmCursor(-1);
await menu(/^Добавить блок$/, 'Значение переменной');
await panel().getByLabel('Переменная', {exact: true}).selectOption('flightlog1');
await panel().getByLabel('Слово, когда «да»').fill('найден');
await panel().getByLabel('Слово, когда «нет»').fill('не найден');
await win.waitForTimeout(300);
check('значение да-нет словами', (await cmValue()).endsWith('<span class="sg-value">Журнал полёта: <<= $flightlog1 ? "найден" : "не найден">></span>'), (await cmValue()).slice(-90));
await panel().getByRole('button', {name: 'Готово'}).click();
check('всё остальное в тексте не тронуто', (await cmValue()).startsWith(v2));
await win.waitForTimeout(1500);

// Предпросмотр пассажа: настоящий SugarCube с переменными из StoryInit.
await btn(/^Предпросмотр$/).click();
await win.waitForSelector('.signaly-passage-preview');
await win.waitForTimeout(4000);
const pframe = async fn => {
	const handle = await win.locator('.signaly-passage-preview iframe').elementHandle();
	return (await handle.contentFrame()).evaluate(fn);
};
const shown = await pframe(() => ({
	text: document.querySelector('#passages').innerText,
	red: !!document.querySelector('#passages .red-big'),
	button: !!document.querySelector('#passages .red-big button'),
	errors: document.querySelectorAll('#passages .error').length
}));
check(
	'предпросмотр: условие, состояние, значения как в игре',
	shown.text.includes('Секретный текст') &&
		!shown.text.includes('Другой текст') &&
		shown.text.includes('Данные повреждены') &&
		shown.text.includes('Глава: 2 из 5') &&
		shown.text.includes('Журнал полёта: найден') &&
		shown.red &&
		!shown.button &&
		shown.errors === 0,
	JSON.stringify(shown)
);
await win.screenshot({path: shot('preview')});
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
