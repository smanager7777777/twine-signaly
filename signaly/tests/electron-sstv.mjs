// Проверка программы (Electron), сессия 30: окно «Радио» — порядок видов, тип «С декодером» (Д2),
// свои цвета лампочки и декодера, помехи — ссылкой на «Музыку»; окно «Музыка» — раздел «Помехи»
// (папки по видам радио, перенос старых помех вида), «Сохранить» разбирает помехи и передачи на
// картинки SSTV (настоящий разбор WAV и MP3 в Chromium программы), пассаж «SSTV»; переименование
// вида переименовывает папку помех; «Проверить историю» — треки без копии и «Сделать копии».
// TWEE=signaly/template/27_03_2025.twee MEDIA=… SHOT=… xvfb-run … node signaly/tests/electron-sstv.mjs <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-sstv-'));
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
	fs
		.readFileSync(process.env.TWEE, 'utf8')
		.replace(/(<<sg-radio-view "Сломанное"[^\n]*>>)/, '$1\n<<sg-radio-view "Старое" type fixed frame "#c9a24a" elements "#39ff7a" label "П" jam "media/audio/radiovinyl.wav|0.8|70" jamsmin 1 jamsmax 2 incoming "ВХОДЯЩАЯ ПЕРЕДАЧА" catch 10>>')
		.replace(/\s*$/, '\n') +
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


const sstv = require(path.resolve('.signaly-tools/src/util/signaly/signaly-sstv.js'));
const sharp = require(path.join(path.dirname(process.argv[2] || 'playwright'), 'sharp'));
const waitFor = async (test, ms = 15000) => {
	for (let t = 0; t < ms && !(await test()); t += 250) {
		await win.waitForTimeout(250);
	}
	return test();
};

// Настоящие звуки SSTV (Robot 36): помеха — WAV, передача — MP3 (ffmpeg).
const S = path.join(game, 'media/audio/stest');

fs.mkdirSync(S, {recursive: true});
function sstvWav(file, color) {
	const rgba = new Uint8ClampedArray(320 * 240 * 4);

	for (let i = 0; i < 320 * 240; i++) {
		rgba.set([...color, 255], i * 4);
	}

	const rate = 11025;
	const sound = sstv.encodeSstv(sstv.sstvMode('Robot 36'), rgba, 320, 240, rate, 1);
	const buf = Buffer.alloc(44 + sound.length * 2);

	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + sound.length * 2, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(rate, 24);
	buf.writeUInt32LE(rate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(sound.length * 2, 40);
	for (let i = 0; i < sound.length; i++) {
		buf.writeInt16LE(Math.round(sound[i] * 20000), 44 + i * 2);
	}
	fs.writeFileSync(file, buf);
}
sstvWav(path.join(S, 'jam-red.wav'), [230, 20, 20]);
sstvWav(path.join(S, 'tx-blue.wav'), [20, 20, 230]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(S, 'tx-blue.wav'), '-b:a', '96k', path.join(S, 'tx-blue.mp3')]);
fs.rmSync(path.join(S, 'tx-blue.wav'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', path.join(S, 'plain.wav')]);

/* Окно «Радио»: порядок, тип «С декодером», лампочка и декодер, помехи — ссылкой */
await closeDialogs();
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1500);

const rw = win.locator('[role=dialog][aria-label="Радио"]');
const views = () => rw.locator('.signaly-kinds-list .signaly-kinds-item').allTextContents();

check('порядок видов — порядок радио в игре (пояснение)', (await rw.getByText(/Порядок видов — порядок радио в игре/).count()) === 1);
await rw.getByRole('button', {name: 'Добавить вид'}).click();
await rw.getByLabel('Название вида', {exact: true}).fill('Декодер');
await rw.getByRole('radiogroup', {name: 'Тип радио'}).getByRole('radio', {name: /С декодером, каркас Д2/}).click();
await win.waitForTimeout(300);
check('с декодером: пояснения «Реверс» и «Декодер», эфир', (await rw.locator('h3', {hasText: /^Реверс$/}).count()) === 1 && (await rw.locator('h3', {hasText: /^Декодер$/}).count()) === 1 &&
	(await rw.getByLabel('Файл белого шума', {exact: true}).count()) === 1);
check('свои цвета: лампочка (как у шкалы) и декодер', (await rw.getByLabel('Лампочка точной настройки', {exact: true}).count()) === 1 &&
	(await rw.getByLabel('Окно декодера и ДЕКОД', {exact: true}).count()) === 1 && (await rw.getByText('Сейчас — как у шкалы.').count()) === 1);

const hex = label => rw.locator('.signaly-radio-part', {has: win.getByLabel(label, {exact: true})}).getByRole('textbox', {name: 'Код цвета'});

await hex('Лампочка точной настройки').fill('#ff0000');
await hex('Лампочка точной настройки').press('Enter');
await hex('Окно декодера и ДЕКОД').fill('#00ffff');
await hex('Окно декодера и ДЕКОД').press('Enter');
check('помехи — ссылкой на окно «Музыка»', (await rw.getByText(/Помехи этого радио — в окне «Музыка», раздел «Помехи», папка «Декодер» \(сейчас: 0\)/).count()) === 1);
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-ticker-preview iframe');

check('предпросмотр: Д2 с окном декодера, ДЕКОД, катушками', (await frame.locator('.sg-radio.sg-radio-decoder .sg-r-dec canvas').count()) === 1 &&
	(await frame.locator('.sg-r-decbtn').count()) === 1 && (await frame.locator('.sg-r-reel').count()) === 2);
check('предпросмотр: свой цвет декодера', (await frame.locator('.sg-r-dec').evaluate(e => getComputedStyle(e).borderTopColor)) === 'rgb(0, 255, 255)');
await frame.locator('.sg-r-decbtn').click();
await win.waitForTimeout(300);
check('предпросмотр: ДЕКОД включается, в окне — образец', (await frame.locator('.sg-r-decbtn.sg-r-lit').count()) === 1 && (await frame.locator('.sg-r-dec-cap').textContent()) === 'ПРЕДПРОСМОТР');
await win.screenshot({path: shot('radio')});

// ▲ Выше: «Декодер» встаёт перед «Старым».
const before = await views();

await rw.getByRole('button', {name: '▲ Выше'}).click();
await win.waitForTimeout(300);

const after = await views();

check('▲ Выше меняет порядок видов', after.indexOf('Декодер') === before.indexOf('Декодер') - 1 && after.indexOf('Декодер') < after.indexOf('Старое'), after.join('|'));
await rw.getByRole('button', {name: 'Сохранить'}).click();

let radio = '';

await waitFor(async () => (radio = text('Радио')).includes('Декодер'));
check('записано: тип decoder, свои цвета, порядок', /<<sg-radio-view "Декодер" type decoder [^>]*lamp "#ff0000"[^>]*decoder "#00ffff"/.test(radio) && radio.indexOf('"Декодер"') < radio.indexOf('"Старое"'), radio);
check('движок 27', /Версия движка: 27/.test(storyFile()));
await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Окно «Музыка»: раздел «Помехи», перенос старых помех, SSTV */
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1500);

const mw = win.locator('[role=dialog][aria-label="Музыка"]');

check('раздел «Помехи» с папками по видам (по порядку окна «Радио»)', (await mw.locator('h3', {hasText: /^Помехи$/}).count()) === 1 &&
	(await mw.getByRole('button', {name: 'Декодер', exact: true}).count()) === 1 && (await mw.getByRole('button', {name: 'Старое', exact: true}).count()) === 1);
check('старые помехи вида перенесены, окно просит сохранить', (await mw.getByText('Помехи радио «Старое» перенесены сюда из окна «Радио». Нажмите «Сохранить».').count()) === 1 &&
	!(await mw.getByRole('button', {name: 'Сохранить'}).isDisabled()));
check('у раздела «Помехи» нет «Добавить папку»', (await mw.getByRole('button', {name: 'Добавить папку'}).count()) === 3);
await mw.getByRole('button', {name: 'Старое', exact: true}).click();
await win.waitForTimeout(300);
check('папка помех: название не правится, раздела и «Выше/Ниже» нет, трек перенесён', (await mw.locator('h3', {hasText: 'Помехи радио «Старое»'}).count()) === 1 &&
	(await mw.getByLabel('Название папки', {exact: true}).count()) === 0 && (await mw.getByLabel('Раздел', {exact: true}).count()) === 0 &&
	(await mw.getByLabel('Название трека', {exact: true}).inputValue()) === 'radiovinyl');
check('у помехи — ширина, предзвук и начальная громкость', (await mw.getByRole('textbox', {name: /^Слышно в пределах ±/}).count()) === 1 &&
	(await mw.getByLabel('Предзвук', {exact: false}).count()) >= 1);
await mw.getByRole('button', {name: 'Декодер', exact: true}).click();
await win.waitForTimeout(300);
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Красная');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/stest/jam-red.wav');
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Пустая');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/stest/plain.wav');
// Передача с картинкой — в эфир, после поимки — в первую папку радио.
await mw.getByRole('button', {name: 'Добавить папку'}).last().click();
await win.waitForTimeout(300);
await mw.getByLabel('Название папки', {exact: true}).fill('Эфир С');
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).last().fill('Синяя');
await mw.getByLabel('Файл', {exact: true}).last().selectOption('media/audio/stest/tx-blue.mp3');

const radioFolder = await mw.getByLabel('После поимки — в папку радио', {exact: true}).locator('option').nth(1).getAttribute('value');

await mw.getByLabel('После поимки — в папку радио', {exact: true}).selectOption(radioFolder);
await mw.getByRole('button', {name: 'Сохранить'}).click();

let music = '';

check('записано: папки помех «Декодер» и «Старое»', await waitFor(async () => /<<sg-folder "Декодер" section jam>>\n<<sg-track "Красная" "media\/audio\/stest\/jam-red.wav">>/.test(music = text('Музыка')) &&
	music.includes('<<sg-folder "Старое" section jam>>\n<<sg-track "radiovinyl" "media/audio/radiovinyl.wav" gain 70 width 0.8>>')), music.slice(-700));
check('у вида «Старое» старой записи помех больше нет', await waitFor(async () => !/"Старое"[^\n]*jam "/.test(text('Радио')) && /"Старое"[^\n]*jamsmin 1 jamsmax 2/.test(text('Радио')), 8000), text('Радио'));

const red = path.join(game, 'media/img/sstv/stest/jam-red-1.png');
const blue = path.join(game, 'media/img/sstv/stest/tx-blue-1.png');

check('«Сохранить» разобрал помеху и передачу: картинки SSTV в папке игры', await waitFor(() => fs.existsSync(red) && fs.existsSync(blue), 90000), fs.readdirSync(path.join(game, 'media/img')).join('|'));

let sstvText = '';

check('пассаж «SSTV»: режим, начало, длина строки; у звука без картинки — none', await waitFor(async () => {
	sstvText = text('SSTV');
	return /<<sg-sstv "media\/audio\/stest\/jam-red.wav" stamp "\d+-\d+" img "media\/img\/sstv\/stest\/jam-red-1.png" mode "Robot 36" at [\d.]+ line 0\.1[45]\d* rows 240 per 1 width 320 height 240>>/.test(sstvText) &&
		sstvText.includes('mode "Robot 36"') && sstvText.includes('tx-blue-1.png') && /<<sg-sstv "media\/audio\/stest\/plain.wav" stamp "[^"]+" none>>/.test(sstvText);
}, 90000), sstvText);
check('пассаж «SSTV» с тегом sg-sstv', /tags="sg-sstv"/.test(passageIn(storyFile(), 'SSTV').tag));

const px = async (file, x, y) => {
	const {data, info} = await sharp(file).raw().toBuffer({resolveWithObject: true});

	return Array.from(data.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
};
const r1 = await px(red, 100, 100);
const b1 = await px(blue, 100, 100);

check('картинки — то, что передано: красная и синяя (из MP3)', r1[0] > 170 && r1[2] < 90 && b1[2] > 170 && b1[0] < 90, JSON.stringify([r1, b1]));
check('в шапке — сколько картинок', await waitFor(async () => /Картинок SSTV: 2/.test(await mw.locator('.signaly-sstv-status').textContent().catch(() => ''))), await mw.locator('.signaly-sstv-status').textContent().catch(() => ''));
check('копии реверса — и у помех (моно 22 кГц)', await waitFor(() => fs.existsSync(path.join(game, 'media/audio/reverse/stest/jam-red.wav')), 30000));

// Ещё раз «Сохранить» без изменений файла — заново не разбирается.
const redTime = fs.statSync(red).mtimeMs;

await mw.getByLabel('Название трека', {exact: true}).last().fill('Синяя передача');
await mw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(4000);
check('файл не менялся — картинка не переделана', fs.statSync(red).mtimeMs === redTime);
await win.screenshot({path: shot('music')});
await mw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Переименование вида — папка помех тоже */
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1500);
await rw.getByRole('button', {name: 'Старое', exact: true}).click();
await rw.getByLabel('Название вида', {exact: true}).fill('Старое 2');
check('помехи вида — из папки «Музыки» (сейчас: 1)', (await rw.getByText(/папка «Старое 2» \(сейчас: 1\)/).count()) === 1);
await rw.getByRole('button', {name: 'Сохранить'}).click();
check('переименование вида переименовало папку помех', await waitFor(async () => text('Музыка').includes('<<sg-folder "Старое 2" section jam>>') && !text('Музыка').includes('"Старое" section jam')), text('Музыка').slice(-500));
await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* «Проверить историю»: трек без копии и «Сделать копии» */
const copy = path.join(game, 'media/audio/reverse/stest/jam-red.wav');

fs.rmSync(copy);
await toolbarBtn(/^Проверить историю$/).click();
await win.waitForTimeout(1500);

const cw = win.locator('[role=dialog][aria-label="Проверка истории"]');

check('«Проверить историю»: трек без развёрнутой копии', await waitFor(async () => (await cw.locator('.signaly-check-copies li', {hasText: 'media/audio/stest/jam-red.wav'}).count()) === 1), await cw.textContent());
await win.screenshot({path: shot('check')});
await cw.getByRole('button', {name: 'Сделать копии'}).click();
check('«Сделать копии» — копия на месте, список пуст', await waitFor(async () => fs.existsSync(copy) && (await cw.locator('.signaly-check-copies').count()) === 0, 20000));
await cw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(300);

/* Звук-сигнал: «Что приглушить» — и «Музыка и радио» */
await openPassage('Пустой');
await setEditor('Экран <<link "Сигнал">><<sg-sound "media/audio/radiovinyl.wav" volume 100 duck ":music" to 30>><</link>>\n', 12);
await win.locator('.CodeMirror-line').first().click({position: {x: 140, y: 6}});
await win.waitForTimeout(800);
check('приглушить «Музыку и радио» — понятно форме', (await panel().getByLabel('Что приглушить', {exact: true}).inputValue()) === ':music', await panel().textContent().catch(() => ''));

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `\n${results.length - failed}/${results.length} проверок пройдено` : '\nВСЁ ХОРОШО');
process.exit(failed ? 1 : 0);
