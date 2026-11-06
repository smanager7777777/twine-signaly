// Проверка программы (Electron), сессия 19, шаг 5.1: блок «Список состояний» —
// кнопки и плитка, состояния, таблица строк, «Добавить много строк», предпросмотр.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-list.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-list-'));
const game = path.join(home, 'Игра СИГНАЛЫ');
const shot = name => (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', `-${name}.png`);
const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};
const twee = path.join(home, '27_03_2025.twee');

fs.writeFileSync(
	twee,
	fs.readFileSync(process.env.TWEE, 'utf8').replace(/\s*$/, '\n') +
		`
:: Процедуры {"position":"100,1500","size":"100,100"}
Список

:: Системы {"position":"200,1500","size":"100,100"}
Плитка

:: Пароль {"position":"300,1500","size":"100,100"}
Экран пароля

:: Текст1 {"position":"400,1500","size":"100,100"}
Текст процедуры
`
);

const app = await electron.launch({
	executablePath: process.env.ELECTRON_BIN || require('electron'),
	args: ['--no-sandbox', 'electron-build/main/src/electron/main-process/index.js'],
	env: {...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}
});
const win = await app.firstWindow();

win.on('dialog', d => d.accept());
await win.waitForLoadState('domcontentloaded');
await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setBounds({x: 0, y: 0, width: 1600, height: 1000}));
await app.evaluate(({dialog}, dir) => {
	dialog.showOpenDialog = async () => ({canceled: false, filePaths: [dir]});
}, game);
await win.waitForTimeout(3000);

const btn = re => win.getByRole('button', {name: re});

await btn(/^Пропустить$/).click();
await win.getByRole('tab', {name: 'Библиотека'}).click();
await btn(/^Импорт$/).click();
await win.locator('input[type=file]').setInputFiles(twee);
await win.waitForTimeout(1000);
if (await btn(/Импортировать/).count()) await btn(/Импортировать/).last().click();
await win.waitForTimeout(1000);
await win.getByText('27,03,2025').first().click();
await win.getByRole('tab', {name: 'История'}).click();
await btn(/^Редактировать$/).first().click();
await win.waitForTimeout(1500);
await win.getByRole('tab', {name: 'История'}).click();
await btn(/^Подробности$/).click();
await win.waitForTimeout(500);
await btn(/Выбрать папку игры/).click();
await win.waitForTimeout(800);
await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click();
if (process.env.MEDIA) {
	fs.cpSync(path.join(process.env.MEDIA, 'media'), path.join(game, 'media'), {recursive: true});
}

const libDir = path.join(await app.evaluate(({app}) => app.getPath('documents')), 'Twine СИГНАЛЫ', 'Истории');
const storyFile = () =>
	fs
		.readFileSync(path.join(libDir, fs.readdirSync(libDir).find(f => f.startsWith('27_03_2025'))), 'utf8')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const passageIn = (file, name) => {
	const tag = new RegExp(`<tw-passagedata[^>]*name="${name}"[^>]*>`).exec(file);

	return tag ? {tag: tag[0], text: file.slice(tag.index + tag[0].length, file.indexOf('</tw-passagedata>', tag.index))} : {tag: '', text: ''};
};
const closeDialogs = async () => {
	for (const close of await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').all()) {
		await close.click().catch(() => {});
		await win.waitForTimeout(200);
	}
};
const openPassage = async name => {
	await closeDialogs();
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: new RegExp(`^${name}$`)})}).dblclick();
	await win.waitForTimeout(800);
};
const panel = () => win.locator('.signaly-block-panel');
const unfocus = () => win.evaluate(() => document.activeElement.blur());
const select = async (label, value) => {
	await unfocus();
	await panel().getByLabel(label, {exact: true}).selectOption(value);
	await win.waitForTimeout(1500);
};
const fill = async (label, value) => {
	await unfocus();
	await panel().getByLabel(label, {exact: true}).fill(value);
	await win.waitForTimeout(1500);
};
const text = name => passageIn(storyFile(), name).text;


const toolbarBtn = name => win.locator('.route-toolbar').getByRole('button', {name});


const toolbar = () => win.locator('.signaly-format-toolbar');
const add = async name => {
	await toolbar().getByRole('button', {name: /Добавить блок/}).click();
	await win.locator('.menu-button-menu').getByText(name).click();
	await win.waitForTimeout(1500);
};
const editorText = () => win.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());

await openPassage('Процедуры');
await add('Список состояний: кнопки (процедуры)');
check('заготовка: 4 состояния и 2 строки', (await panel().locator('fieldset legend').count()) >= 4 && (await panel().locator('.signaly-list-table input[aria-label="Название"]').count()) === 2);
let value = await editorText();

check('команда в тексте', /<<sg-list form button columns 2>>/.test(value) && /<<sg-state 3 label "\{номер\}\. \{название\}"[^>]*do window>>/.test(value), value);
check('движок поставлен', /signalyEngine|СИГНАЛЫ: движок терминала/.test(storyFile()));

/* Состояние */
await unfocus();
const first = panel().locator('fieldset').first();

await first.getByLabel('Надпись', {exact: true}).fill('{номер}: нет данных');
await win.waitForTimeout(1200);
await unfocus();
await panel().locator('fieldset').nth(1).getByLabel('Что при нажатии', {exact: true}).selectOption('goto');
await win.waitForTimeout(800);
await unfocus();
await panel().locator('fieldset').nth(1).getByLabel('Экран', {exact: true}).selectOption('Пароль');
await win.waitForTimeout(1200);
value = await editorText();
check('надпись и переход записаны', /label "\{номер\}: нет данных"/.test(value) && /<<sg-state 1 [^>]*goto "Пароль">>/.test(value), value);

/* Действие состояния */
await unfocus();
const actions = panel().locator('fieldset').first();
await actions.getByLabel('Добавить действие', {exact: true}).selectOption({label: 'Вернуться на экран, где были'});
await win.waitForTimeout(1200);
value = await editorText();
check('действие записано внутри состояния', /<<sg-state 0 [^\n]*>><<sg-back>>/.test(value), value);

/* Строки */
const names = panel().locator('.signaly-list-table input[aria-label="Название"]');

await unfocus();
await names.first().fill('Гибернация');
await win.waitForTimeout(1000);
await unfocus();
await panel().locator('.signaly-list-table input[aria-label="Экран"]').first().fill('Текст1');
await win.waitForTimeout(1000);
await unfocus();
await panel().locator('.signaly-list-table input[aria-label="Ключевая"]').first().check();
await win.waitForTimeout(1000);
await unfocus();
await panel().locator('.signaly-list-table input[aria-label="Экран"]').nth(1).fill('НетТакого');
await win.waitForTimeout(1000);
check('нет такого экрана — красная рамка', (await panel().locator('.signaly-list-missing').count()) === 1);
await panel().locator('.signaly-list-table input[aria-label="Экран"]').nth(1).fill('');
await win.waitForTimeout(1000);
value = await editorText();
check('строка записана', /<<sg-row "001" "Гибернация" var "\$prcd1" passage "Текст1" key>>/.test(value), value);

/* Много строк */
await unfocus();
const fillBox = panel().locator('fieldset', {hasText: 'Добавить много строк'});
const count = fillBox.getByRole('textbox', {name: /^Сколько строк/});

await count.fill('97');
await count.press('Enter');
await win.waitForTimeout(400);
const firstNo = fillBox.getByRole('textbox', {name: /^С какого номера/});

await firstNo.fill('3');
await firstNo.press('Enter');
await win.waitForTimeout(400);
await fillBox.getByRole('button', {name: /Добавить 97 строк/}).click();
await win.waitForTimeout(2500);
value = await editorText();
check('99 строк одной кнопкой', (value.match(/<<sg-row /g) || []).length === 99, String((value.match(/<<sg-row /g) || []).length));
check('номера, переменные, экраны по образцу', /<<sg-row "099" "Процедура 099" var "\$prcd99" passage "PRCD099">>/.test(value), value.slice(-300));
check('таблица показывает 99 строк', (await names.count()) === 99, String(await names.count()));
await win.screenshot({path: shot('form')});

/* Щелчок по команде открывает форму снова */
await win.locator('.signaly-block-panel button[aria-label="Закрыть"]').first().click().catch(() => {});
await win.waitForTimeout(500);
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor(cm.posFromIndex(cm.getValue().indexOf('<<sg-row "050"') + 5));
});
await win.waitForTimeout(300);
const mark = await win.locator('.CodeMirror .signaly-block-mark').first();

await mark.click().catch(() => {});
await win.waitForTimeout(1000);
check('щелчок по блоку открывает форму', (await panel().count()) === 1 && (await panel().getByText('Состояния', {exact: true}).count()) >= 1);

/* Предпросмотр: все состояния сразу */
await win.getByRole('button', {name: 'Предпросмотр'}).click();
await win.waitForTimeout(3500);
const frame = win.frameLocator('.signaly-passage-preview iframe');

check('предпросмотр: 99 кнопок', (await frame.locator('.sg-list-item').count()) === 99, String(await frame.locator('.sg-list-item').count()));
check('предпросмотр: разные состояния', (await frame.locator('.sg-list-item').nth(0).textContent()).includes('нет данных') && (await frame.locator('.sg-list-item').nth(1).textContent()).includes('Нужен пароль'));
await win.screenshot({path: shot('preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(600);

/* Плитка */
await openPassage('Системы');
await add('Список состояний: плитка (системы)');
value = await editorText();
check('плитка: форма записана', /<<sg-list form tile columns 4>>/.test(value) && /label "Норма"/.test(value), value);
check('подпись статуса для плитки', (await panel().getByLabel('Статус на плитке', {exact: true}).count()) === 4);
await win.getByRole('button', {name: 'Предпросмотр'}).click();
await win.waitForTimeout(3500);
const tiles = win.frameLocator('.signaly-passage-preview iframe');

check('предпросмотр: плитки', (await tiles.locator('.sg-tile').count()) === 2 && (await tiles.locator('.sg-tile-status').first().textContent()) === 'Отказ');
await win.screenshot({path: shot('tiles')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(600);
await closeDialogs();
await win.waitForTimeout(1500);

/* Запись в историю, переименование экрана */
let file = passageIn(storyFile(), 'Процедуры').text;

check('список в файле истории', (file.match(/<<sg-row /g) || []).length === 99 && file.includes('goto "Пароль"'), file.slice(0, 300));
check('движок 18', storyFile().includes('Версия движка: 18'));

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
