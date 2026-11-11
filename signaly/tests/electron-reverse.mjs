// Проверка программы (Electron), сессия 29: окно «Радио» — свои цвета частей, крупный предпросмотр,
// тип «С реверсом» (каркас В2); развёрнутые копии треков при «Сохранить» (настоящий разворот
// WAV и MP3 в Chromium программы), «Файл задом наперёд» у трека, копии не в списках файлов.
// TWEE=signaly/template/27_03_2025.twee MEDIA=… SHOT=… xvfb-run … node signaly/tests/electron-reverse.mjs <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-rev-'));
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



const range = (dialog, label, value) => dialog.getByRole('textbox', {name: new RegExp('^' + label)}).fill(String(value)).then(() => dialog.getByRole('textbox', {name: new RegExp('^' + label)}).press('Enter'));


// Настоящие звуки: WAV 44,1 кГц с нарастающими отсчётами (разворот проверяется точно) и MP3 3 с.
const R = path.join(game, 'media/audio/rtest');
const rampN = 44100;

fs.mkdirSync(R, {recursive: true});
{
	const buf = Buffer.alloc(44 + rampN * 2);

	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + rampN * 2, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(44100, 24);
	buf.writeUInt32LE(88200, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(rampN * 2, 40);
	for (let i = 0; i < rampN; i++) {
		buf.writeInt16LE(Math.round(-16000 + (32000 * i) / rampN), 44 + i * 2);
	}
	fs.writeFileSync(path.join(R, 'ramp.wav'), buf);
}
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '2', path.join(R, 'song.mp3')]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', path.join(R, 'own.wav')]);

const reverseFile = rel => path.join(game, 'media/audio/reverse', rel);
const waitFor = async (test, ms = 15000) => {
	for (let t = 0; t < ms && !(await test()); t += 250) {
		await win.waitForTimeout(250);
	}
	return test();
};
const readWav = file => {
	const b = fs.readFileSync(file);

	return {channels: b.readUInt16LE(22), rate: b.readUInt32LE(24), bits: b.readUInt16LE(34), frames: b.readUInt32LE(40) / (2 * b.readUInt16LE(22)), b};
};

/* Окно «Радио»: тип «С реверсом», свои цвета, крупный предпросмотр */
await closeDialogs();
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1500);

const rw = win.locator('[role=dialog][aria-label="Радио"]');

await rw.getByRole('button', {name: 'Добавить вид'}).click();
await rw.getByLabel('Название вида', {exact: true}).fill('Кассета');
check('тип «С реверсом» можно выбрать', !(await rw.getByRole('radiogroup', {name: 'Тип радио'}).getByRole('radio', {name: /С реверсом/}).textContent()).includes('позже'));
await rw.getByRole('radiogroup', {name: 'Тип радио'}).getByRole('radio', {name: /С реверсом/}).click();
await win.waitForTimeout(300);
check('с реверсом: пояснение «Реверс» и настройки эфира', (await rw.locator('h3', {hasText: /^Реверс$/}).count()) === 1 && (await rw.getByLabel('Файл белого шума', {exact: true}).count()) === 1);
check('пять своих цветов, пока «как у элементов»', (await rw.getByLabel('Кнопки', {exact: true}).count()) === 1 && (await rw.getByLabel('Выключатель (выход)', {exact: true}).count()) === 1 &&
	(await rw.getByLabel('Шкала поиска, частота, прогресс', {exact: true}).count()) === 1 && (await rw.getByLabel('Каталог', {exact: true}).count()) === 1 &&
	(await rw.getByLabel('Внутренний каркас', {exact: true}).count()) === 1 && (await rw.getByText('Сейчас — как у элементов.').count()) === 4);

const hex = label => rw.locator('.signaly-radio-part', {has: win.getByLabel(label, {exact: true})}).getByRole('textbox', {name: 'Код цвета'});

await hex('Кнопки').fill('#ff0000');
await hex('Кнопки').press('Enter');
await hex('Внутренний каркас').fill('#ffffff');
await hex('Внутренний каркас').press('Enter');
await win.waitForTimeout(300);
check('свой цвет задан — кнопка «Как у элементов»', (await rw.getByRole('button', {name: 'Как у элементов'}).count()) === 1 && (await rw.getByRole('button', {name: 'Как у каркаса'}).count()) === 1);
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-ticker-preview iframe');
const pf = await rw.locator('.signaly-preview-frame').boundingBox();
const area = await rw.locator('.signaly-ticker-preview .signaly-preview-box').boundingBox();

check('предпросмотр: радио с реверсом, катушки и РЕВЕРС', (await frame.locator('.sg-radio.sg-radio-reverse .sg-r-reel').count()) === 2 && (await frame.locator('.sg-r-revbtn').count()) === 1);
check('предпросмотр крупный: радио на всё место справа', pf && area && Math.abs(pf.width - pf.height) < 6 && pf.width >= Math.min(area.width, area.height) - 6 && pf.width > 500, JSON.stringify({pf, area}));
check('предпросмотр: свои цвета видны', (await frame.locator('.sg-r-play').evaluate(e => getComputedStyle(e).borderTopColor)) === 'rgb(255, 0, 0)' &&
	(await frame.locator('.sg-r-thin').first().evaluate(e => getComputedStyle(e).stroke)) === 'rgb(255, 255, 255)');
await win.screenshot({path: shot('radio')});
await rw.getByRole('button', {name: 'Как у каркаса'}).click();
await win.waitForTimeout(300);
await rw.getByRole('button', {name: 'Сохранить'}).click();

let radio = '';

await waitFor(async () => (radio = text('Радио')).includes('Кассета'));
check('записано: вид с реверсом и своим цветом кнопок, внутренний — как у каркаса', /<<sg-radio-view "Кассета" type reverse [^>]*buttons "#ff0000"/.test(radio) && !/"Кассета"[^\n]*inner/.test(radio), radio);
check('движок 27', /Версия движка: 27/.test(storyFile()));

// Шаблон: треки радио развёрнуты (пустышки 0,3 с).
const tplCopy = reverseFile('radioRegentropfen.wav');

check('«Сохранить» в окне «Радио»: копии треков радио шаблона', await waitFor(() => fs.existsSync(tplCopy) && fs.existsSync(reverseFile('radioraindrop.wav'))), tplCopy);
check('в шапке — сколько развёрнуто', await waitFor(async () => /Развёрнут/.test(await rw.locator('.signaly-reverse-status').textContent().catch(() => ''))), await rw.locator('.signaly-reverse-status').textContent().catch(() => ''));

const firstTime = fs.statSync(tplCopy).mtimeMs;

await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Окно «Музыка»: «Файл задом наперёд», копии при «Сохранить» */
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1500);

const mw = win.locator('[role=dialog][aria-label="Музыка"]');

await mw.getByRole('button', {name: 'Добавить папку'}).nth(1).click();
await win.waitForTimeout(300);
await mw.getByLabel('Название папки', {exact: true}).fill('Кассеты');
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Рампа');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/rtest/ramp.wav');
check('у трека радио — «Файл задом наперёд», по умолчанию — программа', (await mw.getByLabel('Файл задом наперёд', {exact: true}).last().inputValue()) === '');

const options = await mw.getByLabel('Файл', {exact: true}).last().locator('option').allTextContents();

check('развёрнутых копий нет в списке файлов', !options.some(o => o.includes('/reverse/')) && options.includes('media/audio/rtest/song.mp3'), options.join('|'));
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Песня');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/rtest/song.mp3');
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Своё');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/rtest/ramp.wav');
await mw.getByLabel('Файл задом наперёд', {exact: true}).last().selectOption('media/audio/rtest/own.wav');
await mw.locator('.signaly-kinds-list').first().locator('.signaly-kinds-item').first().click();
await win.waitForTimeout(300);
check('у треков Атмосферы поля нет', (await mw.getByLabel('Файл задом наперёд', {exact: true}).count()) === 0);
await mw.getByRole('button', {name: 'Сохранить'}).click();

const ramp = reverseFile('rtest/ramp.wav');
const song = reverseFile('rtest/song.wav');

check('копии WAV и MP3 сделаны', await waitFor(() => fs.existsSync(ramp) && fs.existsSync(song), 30000));
await win.waitForTimeout(500);

let music = text('Музыка');

check('записано: свой файл задом наперёд у трека', music.includes('<<sg-track "Своё" "media/audio/rtest/ramp.wav" reverse "media/audio/rtest/own.wav">>'), music.slice(-500));

// Сессия 30, ответ 3Б: копии — моно 22 050 Гц. Рампа шла вверх — развёрнутая идёт вниз.
const w = readWav(ramp);
let down = w.channels === 1 && w.rate === 22050 && w.bits === 16 && Math.abs(w.frames - rampN / 2) <= 2;

for (let i = 200; down && i + 997 < w.frames - 200; i += 997) {
	down = w.b.readInt16LE(44 + i * 2) > w.b.readInt16LE(44 + (i + 997) * 2);
}
check('WAV развёрнут: моно 22 050 Гц, отсчёты идут в обратную сторону', down && w.b.readInt16LE(44 + 400) > 14000 && w.b.readInt16LE(44 + (w.frames - 200) * 2) < -14000,
	JSON.stringify({channels: w.channels, rate: w.rate, frames: w.frames}));

const s = readWav(song);

check('MP3 развёрнут: моно 22 050 Гц, около 3 с', s.channels === 1 && s.rate === 22050 && Math.abs(s.frames / 22050 - 3) < 0.1, JSON.stringify({channels: s.channels, rate: s.rate, sec: s.frames / 22050}));
check('для трека со своим файлом копии нет (файл «ramp» один на два трека)', !fs.existsSync(reverseFile('rtest/own.wav')));
check('копия шаблона не переделана заново (не старше трека)', fs.statSync(tplCopy).mtimeMs === firstTime);
await win.screenshot({path: shot('music')});
await mw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Блок «Радио» на экране — вид с реверсом */
await openPassage('Пустой');
await setEditor('Экран\n', 6);
await add('Радио');
await select('Вид радио', 'Кассета');
check('блок «Радио» с видом «Кассета»', (await editorText()).includes('<<sg-radio "Кассета">>'), await editorText());

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `\n${results.length - failed}/${results.length} проверок пройдено` : '\nВСЁ ХОРОШО');
process.exit(failed ? 1 : 0);
