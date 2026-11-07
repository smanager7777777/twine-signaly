// Проверка программы (Electron), сессия 25: окно «Проверка истории» (ответ 2А),
// блок «Вставить экран» (ответ 4А).
// Запуск: TWEE=signaly/template/27_03_2025.twee MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-step25.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-step25-'));
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
:: Проверка {"position":"100,1500","size":"100,100"}
Текст [[Нет такого экрана]] <<sg-image "media/img/нет-файла.jpg">> $ghostVar <<sg-image "media/img/radio.jpg">>

:: Кусок {"position":"250,1500","size":"100,100"}
Общий кусок

:: Пустой {"position":"400,1500","size":"100,100"}
Строка

:: Коды [sg-codes] {"position":"550,1500","size":"100,100"}
<<sg-entry "999" "Пустышка">><</sg-entry>>
<<sg-entry "111" "С ответом">><<sg-answer>>Ответ<</sg-entry>>

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





/* Проверка истории (ответ 2А) */
await closeDialogs();
await toolbarBtn('Проверить историю').click();
await win.waitForTimeout(1500);

const report = await win.locator('.signaly-check-window').innerText();

console.log(report.replace(/\n+/g, ' | ').slice(0, 1500));
check('окно «Проверка истории» открылось', report.includes('Проверка истории'));
check('несуществующий экран найден', report.includes('Переход на несуществующий экран') && report.includes('Нет такого экрана'));
check('файла нет в папке игры', report.includes('Файла нет в папке игры') && report.includes('media/img/нет-файла.jpg'));
check('существующий файл не попал в список', !report.includes('media/img/radio.jpg'));
check('примеры путей в комментариях движка не попали', !report.includes('media/audio/x.wav'));
check('переменная без начального значения', report.includes('$ghostVar'));
check('код без действия, ответа и перехода', report.includes('Код ничего не делает') && report.includes('999') && !/Коды: 111/.test(report));
await win.screenshot({path: shot('check')});
await win.locator('.signaly-check-window .signaly-check-link', {hasText: /^Проверка$/}).first().click();
await win.waitForTimeout(1000);
check('щелчок по имени открыл экран, окно проверки закрылось', (await win.locator('.signaly-check-window').count()) === 0 && (await win.locator('.dialog-card h2', {hasText: /^Проверка$/}).count()) > 0);

/* Вставить экран (ответ 4А) */
await openPassage('Start');
await win.locator('.CodeMirror-line', {hasText: 'include'}).first().click({position: {x: 40, y: 8}});
await win.waitForTimeout(800);

let form = await panel().innerText();

check('щелчок по <<include>> открывает форму «Вставить экран»', form.includes('Вставить экран'), form);
check('в форме выбран вставленный экран', (await panel().getByLabel('Какой экран вставить', {exact: true}).inputValue()) === 'audiobuttons');
check('форма пишет, на скольких экранах он вставлен', /вставлен на 1 экране/.test(form), form);
await win.screenshot({path: shot('include-form')});
await unfocus();
await panel().getByRole('button', {name: 'Открыть вставленный экран'}).click();
await win.waitForTimeout(1000);
check('кнопка открыла вставленный экран', (await win.locator('.dialog-card h2', {hasText: /^audiobuttons$/}).count()) > 0);

await openPassage('Пустой');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: 0, ch: 6});
	cm.focus();
});
await add('Вставить экран');
await select('Какой экран вставить', 'Кусок');

const inserted = await win.evaluate(() => [...document.querySelectorAll('.CodeMirror')].map(e => e.CodeMirror.getValue()).join('\n----\n'));

check('блок записан обычной командой SugarCube', inserted.includes('<<include "Кусок">>'), inserted);
await win.waitForTimeout(1500);
check('в истории сохранено', text('Пустой').includes('<<include "Кусок">>'));
await win.screenshot({path: shot('include-new')});

const failed = results.filter(ok => !ok).length;

console.log(failed ? `ОШИБОК: ${failed}` : 'ВСЁ ХОРОШО');
console.log(`${results.length - failed}/${results.length}`);
await app.close();
process.exit(failed ? 1 : 0);
