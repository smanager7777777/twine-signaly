// Проверка программы (Electron), сессия 26: окно «Музыка», действие «Музыка»,
// «Музыка экрана», блок «Громкость»; порция 2 — старое «Окно-сообщение» открывается
// формой ссылки, форма KR2 без строк статусов, перебор картинками; шрифт цифр цикла.
// TWEE=signaly/template/27_03_2025.twee MEDIA=… SHOT=… xvfb-run … node signaly/tests/electron-music.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-music-'));
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
<<link "АТМ">><</link>>
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

/* Окно «Музыка» */
await closeDialogs();
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1000);

const mw = win.locator('[role=dialog][aria-label="Музыка"]');

check('окно «Музыка» открылось', (await mw.count()) === 1);
await mw.getByRole('button', {name: 'Добавить папку'}).first().click();
await mw.getByLabel('Название папки', {exact: true}).fill('Классика');
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).fill('Галл');
await mw.getByLabel('Файл', {exact: true}).selectOption('media/audio/musics/classic/gaal.mp3');
await mw.getByLabel('Предзвук', {exact: true}).check();
await mw.getByLabel('Файл предзвука', {exact: true}).selectOption('media/audio/radiovinyl.wav');
await mw.getByLabel('Начальная громкость', {exact: true}).check();
await mw.getByRole('button', {name: 'Добавить папку'}).last().click();
await mw.getByLabel('Название папки', {exact: true}).fill('Эфир');
check('папка радио в своём разделе', (await mw.getByLabel('Раздел', {exact: true}).inputValue()) === 'radio');
await win.screenshot({path: shot('window')});
await mw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);

let file = storyFile();
const music = passageIn(file, 'Музыка');

check('пассаж «Музыка» с тегом sg-music', /tags="[^"]*sg-music/.test(music.tag), music.tag);
check(
	'каталог записан',
	music.text.includes('<<sg-music volume 30 spin 0.8 auto>>') &&
		music.text.includes('<<sg-folder "Классика" section ambient>>') &&
		music.text.includes('<<sg-track "Галл" "media/audio/musics/classic/gaal.mp3" pre "media/audio/radiovinyl.wav" wait 3 tail 2 start 30>><</sg-track>>') &&
		music.text.includes('<<sg-folder "Эфир" section radio>>'),
	music.text
);
check('движок 23', file.includes('Версия движка: 23'));
await mw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Действие «Музыка» у ссылки */
await openPassage('Пустой');
await win.locator('.CodeMirror-line', {hasText: 'АТМ'}).first().click({position: {x: 30, y: 8}});
await win.waitForTimeout(800);
await unfocus();
await panel().getByLabel('Добавить действие', {exact: true}).selectOption('music');
await win.waitForTimeout(1200);
check('действие «Музыка»: по умолчанию — включить или пауза Атмосферы', (await editorText()).includes('<<link "АТМ">><<sg-mus toggle ambient>><</link>>'), await editorText());
await unfocus();
await panel().getByLabel('Что сделать', {exact: true}).selectOption('folder');
await win.waitForTimeout(500);
await unfocus();
await panel().getByLabel('Папка', {exact: true}).selectOption('Классика');
await win.waitForTimeout(1200);
check('папка из каталога в списке и записана', (await editorText()).includes('<<sg-mus play folder "Классика">>'), await editorText());
await win.screenshot({path: shot('action')});

/* Музыка экрана */
await unfocus();
await toolbar().getByRole('button', {name: 'Музыка экрана'}).click();
await win.waitForTimeout(1200);
check('кнопка «Музыка экрана» ставит первую строку', (await editorText()).startsWith('<<sg-screen-music now fade fade 3>>\\\n'), await editorText());
await unfocus();
await panel().getByLabel('Что включить', {exact: true}).selectOption('folder');
await win.waitForTimeout(500);
await unfocus();
await panel().getByLabel('Папка', {exact: true}).selectOption('Эфир');
await win.waitForTimeout(1200);
check('форма пишет папку', (await editorText()).startsWith('<<sg-screen-music now fade fade 3 play folder "Эфир">>'), await editorText());
await win.screenshot({path: shot('screen-music')});

/* Блок «Громкость» */
await setEditor((await editorText()) + '\n', (await editorText()).length + 1);
await add('Громкость');
check('блок «Громкость» вставлен', (await editorText()).includes('<<sg-volume step 5 size 40>>'), await editorText());
await win.waitForTimeout(1500);
check('в истории сохранено', text('Пустой').includes('<<sg-volume step 5 size 40>>'));

/* Перебор картинками */
await setEditor((await editorText()) + '\n', (await editorText()).length + 1);
await add('Кнопка-перебор');
await select('Показывать', 'image');
check('перебор картинками: ширина и картинка у значения', (await panel().getByLabel('Ширина картинки', {exact: true}).count()) === 1 && (await panel().getByLabel('Картинка', {exact: true}).count()) >= 2);
await unfocus();
await panel().getByLabel('Картинка', {exact: true}).first().selectOption('media/img/testimgOFF.jpg');
await win.waitForTimeout(1500);
check('слово form image и картинка записаны', /<<sg-pick [^>]*form image/.test(await editorText()) && (await editorText()).includes('img "media/img/testimgOFF.jpg"'), await editorText());
await win.screenshot({path: shot('pick')});

/* Старое «Окно-сообщение» — форма ссылки */
await toolbar().getByRole('button', {name: /Добавить блок/}).click();
check('в «Добавить блок» нет «Окно-сообщение»', (await win.locator('.menu-button-menu').getByText('Окно-сообщение', {exact: true}).count()) === 0);
await win.keyboard.press('Escape');
await openPassage('Start');
await win.locator('.CodeMirror-line', {hasText: 'Краснаякнопка'}).first().click({position: {x: 320, y: 8}});
await win.waitForTimeout(800);

let form = await panel().innerText();

check('щелчок по старому блоку — форма «Ссылка / кнопка» с «Открыть окно»', /Ссылка|кнопка/i.test(form) && form.includes('Открыть окно'), form.slice(0, 400));
check('текст не изменился', text('Start').includes('<<sg-dialog "Краснаякнопка" title "Кнопка со стилем" button>>Предустановленное инфо.<</sg-dialog>>'));
await win.screenshot({path: shot('dialog')});

/* Форма KR2 без строк статусов */
await openPassage('Космические рейнджеры');
await win.locator('.CodeMirror-line', {hasText: 'kr2image'}).first().click({position: {x: 30, y: 8}});
await win.waitForTimeout(800);
form = await panel().innerText();
check('форма KR2: картинка и доли зон есть, строк статусов нет', form.includes('Картинка') && !form.includes('Добавить строку') && form.includes('кнопками над текстом'), form.slice(0, 600));

/* Шрифт цифр цикла */
await closeDialogs();
await toolbarBtn(/Строка событий/).click();
await win.waitForTimeout(1200);

const tw = win.locator('[role=dialog][aria-label="Строка событий"]');

await tw.getByRole('tab', {name: 'Цикл'}).click();
await win.waitForTimeout(300);
await tw.getByLabel('Переменная прогресса', {exact: false}).first().selectOption({index: 1}).catch(() => {});
await win.waitForTimeout(300);
check('вкладка «Цикл»: шрифт цифр — DSEG7', (await tw.getByLabel('Шрифт цифр', {exact: true}).inputValue()) === 'media/fonts/DSEG7Classic-Regular.woff2');
await win.screenshot({path: shot('cycle')});

const failed = results.filter(ok => !ok).length;

console.log(failed ? `ОШИБОК: ${failed}` : 'ВСЁ ХОРОШО');
console.log(`${results.length - failed}/${results.length}`);
await app.close();
process.exit(failed ? 1 : 0);
