// Проверка программы (Electron), сессия 21, шаг 5.3: блок «Камера» — заготовка,
// источник, обрезка, «нет сигнала», предпросмотр с сеткой, перетаскивание, перенос шаблона.
// Запуск: TWEE=<шаблон build-22: git show b6203c6:…> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-camera.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-camera-'));
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
:: Наблюдение {"position":"100,1500","size":"100,100"}
Текст над камерой

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


/* Заготовка */
await openPassage('Наблюдение');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: cm.lineCount() - 1, ch: 0});
});
await toolbar().getByRole('button', {name: /Добавить блок/}).click();
await win.waitForTimeout(500);

const menu = await win.locator('.menu-button-menu button').evaluateAll(list => {
	const size = {w: innerWidth, h: innerHeight};

	return list.map(el => {
		const r = el.getBoundingClientRect();
		const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);

		return r.top >= 0 && r.bottom <= size.h && r.left >= 0 && r.right <= size.w && !!top && el.contains(top);
	});
});

check('меню «Добавить блок»: все пункты видны и нажимаются', menu.length >= 16 && menu.every(Boolean), JSON.stringify(menu));
await win.screenshot({path: shot('menu')});
await toolbar().getByRole('button', {name: /Добавить блок/}).click();
await win.waitForTimeout(400);
await add('Камера');
let value = await editorText();

check('команда в тексте', value.includes('<<sg-camera width 1000 height 1000 border 2>>'), value);
check('движок 20 поставлен', storyFile().includes('Версия движка: 20'));
check('форма: заголовок и источник', (await panel().getByText('Камера', {exact: true}).count()) > 0 && (await panel().getByLabel('Источник', {exact: true}).inputValue()) === 'web');
check('веб-камера: кнопки в форме нет', (await panel().getByLabel('Надпись кнопки', {exact: true}).count()) === 0);
await win.screenshot({path: shot('form')});

/* Перенос шаблона */
const moved = storyFile();

check('CAMERATEST стал блоком', passageIn(moved, 'CAMERATEST').text.trim() === '<<sg-camera width 1000 height 1000 place center border 2 color "#00cc00">>', passageIn(moved, 'CAMERATEST').text.slice(0, 200));
check('XIAOMICAM стал блоком', passageIn(moved, 'XIAOMICAM').text.trim() === '<<sg-camera source "window" width 1000 height 490 vwidth 1000 vheight 1000 shifty -270 border 2 color "#00cc00">>', passageIn(moved, 'XIAOMICAM').text.slice(0, 200));
check('запуск камеры ушёл из StoryInit', !passageIn(moved, 'StoryInit').text.includes('initWebcam'));
check('код камер ушёл из JavaScript истории', !/setup\.init(Webcam|Xiaomi)/.test(moved) && moved.includes('перенесены в блок «Камера»'));

/* Захват окна */
await select('Источник', 'window');
value = await editorText();
check('источник записан', value.includes('source "window"'), value);
check('захват окна: надпись кнопки', (await panel().getByLabel('Надпись кнопки', {exact: true}).inputValue()) === 'Подключить камеру');
check('подсказка о кнопке', (await panel().getByText(/только после нажатия кнопки/).count()) > 0);

const number = async (label, value) => {
	await unfocus();

	const field = panel().getByRole('textbox', {name: new RegExp(`^${label}`)});

	await field.fill(value);
	await field.press('Enter');
	await win.waitForTimeout(1500);
};

await number('Ширина окна', '600');
await number('Высота окна', '300');
await number('Ширина видео', '800');
await number('Высота видео', '800');
await number('Сдвиг видео вправо', '-100');
await number('Сдвиг видео вниз', '-250');
value = await editorText();
check('обрезка записана', /width 600 height 300 vwidth 800 vheight 800 shiftx -100 shifty -250/.test(value), value);
await number('Сдвиг видео вправо', '0');
check('нулевой сдвиг не пишется', !(await editorText()).includes('shiftx'), await editorText());
await number('Сдвиг видео вправо', '-100');

await fill('Надпись кнопки', 'Связь с камерой');
check('своя надпись кнопки', (await editorText()).includes('button "Связь с камерой"'));
await fill('Надпись', 'ПОМЕХИ');
check('своя надпись «нет сигнала»', (await editorText()).includes('nosignal "ПОМЕХИ"'));
await number('Шум', '60');
check('шум', (await editorText()).includes('nonoise 60'));
await win.screenshot({path: shot('form2')});

/* Предпросмотр */
await unfocus();
await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(5000);

const frame = win.frameLocator('.signaly-passage-preview iframe');
const box = () => frame.locator('.sg-camera-box');
const grid = await frame.locator('.sg-camera-grid').evaluate(el => {
	const r = el.getBoundingClientRect();
	const b = el.parentNode.getBoundingClientRect();

	return {w: r.width, h: r.height, x: r.left - b.left, y: r.top - b.top, bw: b.width, bh: b.height};
});

check('предпросмотр: серая сетка по размеру и сдвигу видео', grid.w > grid.bw && grid.x < 0 && grid.y < 0 && Math.round(grid.w / grid.h) === 1, JSON.stringify(grid));
check('предпросмотр: видео нет, камера не запрашивается', (await frame.locator('.sg-camera video').count()) === 0);
check('предпросмотр: своя кнопка', (await frame.locator('.sg-camera button').textContent()) === 'Связь с камерой');
check('предпросмотр: надпись скрыта', !(await frame.locator('.sg-camera-off').isVisible()));
await win.screenshot({path: shot('preview')});
await box().click();
await win.waitForTimeout(400);
check('предпросмотр: щелчок показывает «нет сигнала»', (await frame.locator('.sg-camera-off').isVisible()) && (await frame.locator('.sg-camera-off').textContent()) === 'ПОМЕХИ');
await win.screenshot({path: shot('off')});
await box().click();
await win.waitForTimeout(300);
check('предпросмотр: второй щелчок возвращает сетку', !(await frame.locator('.sg-camera-off').isVisible()));
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(600);

/* Место на экране и перетаскивание */
await select('Место', 'screen');
await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(5000);

const lock = win.locator('.signaly-passage-preview').getByLabel('Закрепить');

if (await lock.isChecked()) {
	await lock.uncheck();
	await win.waitForTimeout(500);
}

const spot = await win.locator('.signaly-passage-preview iframe').boundingBox();
const place = await box().boundingBox();

check('камера видна в предпросмотре', !!spot && !!place);
await win.mouse.move(place.x + place.width / 2, place.y + place.height / 2);
await win.mouse.down();
await win.mouse.move(place.x + place.width / 2 + 40, place.y + place.height / 2 + 30, {steps: 5});
await win.mouse.up();
await win.waitForTimeout(2000);
value = await editorText();
check('перетаскивание записало место', /place "?screen"?/.test(value) && /\bx (?!0\b)-?\d+/.test(value) && /\by (?!0\b)-?\d+/.test(value), value);
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(600);

/* Форма открывается щелчком по команде, надпись по умолчанию не пишется */
await fill('Надпись', 'НЕТ СИГНАЛА');
check('надпись по умолчанию не пишется', !(await editorText()).includes('nosignal'), await editorText());
await closeDialogs();
await openPassage('Наблюдение');
await win.waitForTimeout(500);
await win.locator('.CodeMirror-line').filter({hasText: 'sg-camera'}).first().click();
await win.waitForTimeout(800);
check('щелчок по команде открывает форму', (await panel().getByLabel('Источник', {exact: true}).count()) === 1);
await closeDialogs();
await win.waitForTimeout(1500);

await app.close();
fs.rmSync(home, {recursive: true, force: true});

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
