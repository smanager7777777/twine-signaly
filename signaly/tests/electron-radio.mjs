// Проверка программы (Electron), сессия 27, шаг 7.2: окно «Радио», блоки «Радио» и «Каталог
// Атмосферы», подсказка альбома в окне «Музыка», перевод музыки шаблона при первом «Сохранить».
// TWEE=<шаблон сессии 26: git show 4b9ae32:…> MEDIA=… SHOT=… xvfb-run … node signaly/tests/electron-radio.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-radio-'));
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
:: Пустой {"position":"400,1500","size":"100,100"}
Экран
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
	await win.locator('.menu-button-menu').getByText(name, {exact: true}).click();
	await win.waitForTimeout(1500);
};
const editorText = () => win.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
const setEditor = (value, at) =>
	win.evaluate(([v, a]) => {
		const cm = document.querySelector('.CodeMirror').CodeMirror;

		cm.setValue(v);
		cm.setCursor(cm.posFromIndex(a));
		cm.focus();
	}, [value, at]);


/* Окно «Радио»: шаблон ещё на старой музыке — в окне вид, который даст перенос */
await closeDialogs();
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1500);

const rw = win.locator('[role=dialog][aria-label="Радио"]');

check('окно «Радио» открылось', (await rw.count()) === 1);
check('вид из переноса шаблона — «Сломанное»', (await rw.locator('.signaly-kinds-item').allTextContents()).join('|') === 'Сломанное', (await rw.locator('.signaly-kinds-item').allTextContents()).join('|'));
await rw.getByRole('button', {name: 'Добавить вид'}).click();
await rw.getByLabel('Название вида', {exact: true}).fill('Тест');
await rw.getByRole('textbox', {name: 'Код цвета'}).first().fill('#ff0000');
await rw.getByRole('textbox', {name: 'Код цвета'}).first().press('Enter');
await rw.getByLabel('Надпись на каркасе', {exact: true}).fill('ПРОБА');
await rw.getByLabel('Звук искры', {exact: true}).selectOption('media/audio/radiovinyl.wav');
check('типы: сломанное доступно, остальные — позже', (await rw.getByRole('radiogroup', {name: 'Тип радио'}).getByRole('radio').allTextContents()).join('|').includes('позже'));
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-ticker-preview iframe');

check('предпросмотр: радио нарисовано', (await frame.locator('.sg-radio').count()) === 1);
check('предпросмотр: цвет каркаса', (await frame.locator('.sg-r-fr').first().evaluate(el => getComputedStyle(el).stroke)) === 'rgb(255, 0, 0)');
check('предпросмотр: надпись', (await frame.locator('.sg-r-label').textContent()) === 'ПРОБА');
await win.screenshot({path: shot('window')});
await rw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);

let file = storyFile();

check('пассаж «Радио»: оба вида', /<<sg-radio-view "Сломанное"/.test(passageIn(file, 'Радио').text) && /<<sg-radio-view "Тест"[^>]*label "ПРОБА"[^>]*sparksound "media\/audio\/radiovinyl.wav"/.test(passageIn(file, 'Радио').text), passageIn(file, 'Радио').text);
check('тег sg-radio', /tags="sg-radio"/.test(passageIn(file, 'Радио').tag));
check('перенос шаблона: пассаж «Музыка»', /<<sg-folder "Радио" section radio>>/.test(passageIn(file, 'Музыка').text));
check('перенос шаблона: экран radio — блок', passageIn(file, 'radio').text.trim() === '<<sg-radio "Сломанное">>', passageIn(file, 'radio').text);
check('перенос шаблона: РАД — действие «Музыка»', passageIn(file, 'audiobuttons').text.includes('<<link "РАД">><<sg-mus toggle radio>><</link>>'));
check('движок 25', /Версия движка: 25/.test(file));
await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Блок «Радио»: щелчок по команде — форма; вид — из окна «Радио» */
await openPassage('radio');
await win.locator('.CodeMirror-line').first().click({position: {x: 40, y: 6}});
await win.waitForTimeout(800);
check('форма «Радио» по щелчку', (await panel().getByText('Вид радио').count()) > 0);
await select('Вид радио', 'Тест');
check('вид сменился в тексте', (await editorText()).trim() === '<<sg-radio "Тест">>', await editorText());
await unfocus();
await panel().getByLabel('Под поле игры', {exact: true}).uncheck();
await win.waitForTimeout(1500);
check('своя сторона квадрата', /<<sg-radio "Тест" size 1000>>/.test(await editorText()), await editorText());
await win.screenshot({path: shot('form')});

/* Переименование вида правит блоки на экранах */
await closeDialogs();
await win.waitForTimeout(1500);
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1200);
await rw.locator('.signaly-kinds-item', {hasText: /^Тест$/}).click();
check('вид стоит на 1 экране', (await rw.getByText('Вид стоит на 1 экране.').count()) === 1);
await rw.getByLabel('Название вида', {exact: true}).fill('Проба');
await rw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
file = storyFile();
check('переименование: блок на экране исправлен', /<<sg-radio "Проба" size 1000>>/.test(passageIn(file, 'radio').text), passageIn(file, 'radio').text);
await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* «Каталог Атмосферы» */
await openPassage('Пустой');
await setEditor('Экран\n', 6);
await add('Каталог Атмосферы');
check('«Добавить блок» → «Каталог Атмосферы»', (await editorText()).includes('<<sg-ambient columns 3>>'), await editorText());
check('форма «Каталог Атмосферы»', (await panel().getByText('Столбцов').count()) > 0);
await unfocus();
await panel().getByLabel('«По порядку» и «Сбросить» — кнопками', {exact: true}).check();
await win.waitForTimeout(1500);
check('галочка «кнопками»', (await editorText()).includes('<<sg-ambient columns 3 buttons>>'), await editorText());
await add('Радио');
check('«Добавить блок» → «Радио»: первый вид', (await editorText()).includes('<<sg-radio "Сломанное">>'), await editorText());
await win.screenshot({path: shot('ambient')});

/* Окно «Музыка»: подсказка альбома */
await closeDialogs();
await win.waitForTimeout(1500);
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1000);

const mw = win.locator('[role=dialog][aria-label="Музыка"]');

check('окно «Музыка» читает перенесённый каталог', (await mw.locator('.signaly-kinds-item').count()) === 4);
await mw.locator('.signaly-kinds-item').first().click();
await mw.getByLabel('Подсказка альбома', {exact: true}).fill('Спокойная классика');
await mw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
check('подсказка альбома записана', /<<sg-folder "Классика" section ambient tip "Спокойная классика">>/.test(passageIn(storyFile(), 'Музыка').text));
await win.screenshot({path: shot('music')});

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
