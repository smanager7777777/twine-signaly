// Проверка программы (Electron): имя, отдельная библиотека, папка игры.
// Запуск: xvfb-run node signaly/tests/electron-smoke.mjs <путь к playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-home-'));
const game = path.join(home, 'СИГНАЛЫ');
const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`);
};

const app = await electron.launch({
	executablePath: process.env.ELECTRON_BIN || require('electron'),
	args: ['--no-sandbox', 'electron-build/main/src/electron/main-process/index.js'],
	env: {...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(4000);

check('имя программы', (await app.evaluate(({app}) => app.getName())) === 'Twine СИГНАЛЫ');
const userData = await app.evaluate(({app}) => app.getPath('userData'));
check('свои настройки', userData.endsWith('Twine СИГНАЛЫ'), userData);
const docs = await app.evaluate(({app}) => app.getPath('documents'));
const lib = path.join(docs, 'Twine СИГНАЛЫ', 'Истории');
check('своя библиотека', fs.existsSync(lib), lib);
check('обычная библиотека Twine не создана', !fs.existsSync(path.join(docs, 'Twine')));
check('интерфейс по-русски', (await win.content()).includes('Пропустить'));

// Окно выбора папки подменяем: «выбрана» папка game.
await app.evaluate(({dialog}, dir) => {
	dialog.showOpenDialog = async () => ({canceled: false, filePaths: [dir]});
}, game);
const chosen = await win.evaluate(() => window.twineElectron.signalyChooseGameFolder());
check('выбор папки игры', chosen === game, chosen);

const written = await win.evaluate(
	dir => window.twineElectron.signalyWriteGameFile(dir, '_играть.html', '<p>тест</p>', false),
	game
);
check('запись игры в папку', fs.readFileSync(path.join(game, '_играть.html'), 'utf8') === '<p>тест</p>', written);

let rejected = false;
try {
	await win.evaluate(dir => window.twineElectron.signalyWriteGameFile(dir, '../x.html', 'x', false), game);
} catch (e) {
	rejected = true;
}
check('запись вне папки игры запрещена', rejected && !fs.existsSync(path.join(home, 'x.html')));

// Полный путь автора в программе: импорт шаблона, папка игры, «Играть»,
// «Опубликовать в папку игры».
const twee = process.env.TWEE;
if (twee) {
	const opened = [];
	await app.evaluate(({shell}) => {
		globalThis.__opened = [];
		shell.openPath = async p => {
			globalThis.__opened.push(p);
			return '';
		};
	});
	const game2 = path.join(home, 'Игра СИГНАЛЫ');
	await app.evaluate(({dialog}, dir) => {
		dialog.showOpenDialog = async () => ({canceled: false, filePaths: [dir]});
	}, game2);
	const btn = re => win.getByRole('button', {name: re});
	await btn(/^Пропустить$/).click();
	await win.getByRole('tab', {name: 'Библиотека'}).click();
	await btn(/^Импорт$/).click();
	await win.locator('input[type=file]').setInputFiles(twee);
	await win.waitForTimeout(1000);
	const confirm = btn(/Импортировать/);
	if (await confirm.count()) await confirm.last().click();
	await win.waitForTimeout(1000);
	await win.getByText('27,03,2025').first().click();
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/^Редактировать$/).first().click();
	await win.waitForTimeout(1500);
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/^Подробности$/).click();
	await win.waitForTimeout(500);
	check('подробности: папка игры не выбрана', (await win.locator('.signaly-game-folder').textContent()).includes('не выбрана'));
	await btn(/Выбрать папку игры/).click();
	await win.waitForTimeout(500);
	check('подробности: папка игры выбрана', (await win.locator('.signaly-game-folder').textContent()).includes(game2));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-details.png')});
	await win.getByRole('tab', {name: 'Сборка'}).click();
	await btn(/^Играть$/).click();
	await win.waitForTimeout(1500);
	const playFile = path.join(game2, '_играть.html');
	check('«Играть» пишет игру в папку игры', fs.existsSync(playFile) && fs.readFileSync(playFile, 'utf8').includes('tw-storydata'));
	await btn(/^Тестировать$/).click();
	await win.waitForTimeout(1500);
	const testFile = path.join(game2, '_тест.html');
	check('«Тест» пишет игру в папку игры (режим отладки)', fs.existsSync(testFile) && fs.readFileSync(testFile, 'utf8').includes('options="debug"'));
	await btn(/Опубликовать в папку игры/).click();
	await win.waitForTimeout(1500);
	const pubFile = path.join(game2, '27_03_2025.html');
	check('«Опубликовать в папку игры»', fs.existsSync(pubFile), pubFile);
	check('сообщение «Игра записана»', (await win.content()).includes('Игра записана'));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-published.png')});
	const openedPaths = await app.evaluate(() => globalThis.__opened);
	check('игра открывается из папки игры', openedPaths.includes(playFile) && openedPaths.includes(testFile), openedPaths.join(', '));
	const lib2 = fs.readdirSync(lib);
	check('история сохранена в своей библиотеке', lib2.some(f => f.startsWith('27_03_2025')), lib2.join(', '));
	if (process.env.OUT) {
		fs.copyFileSync(pubFile, path.join(process.env.OUT, 'game-electron.html'));
	}
	// Шаг 1.2: окно «Оформление терминала». В папку игры кладём медиа (MEDIA —
	// папка с пустышками), чтобы предпросмотр видел картинки и шрифты.
	if (process.env.MEDIA) {
		fs.cpSync(path.join(process.env.MEDIA, 'media'), path.join(game2, 'media'), {recursive: true});
	}
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/Оформление терминала/).click();
	await win.waitForSelector('.signaly-appearance-window');
	check('окно оформления открылось', await win.locator('.signaly-appearance-window').isVisible());
	check('настройки перенесены из таблицы стилей', (await win.locator('.signaly-notice').first().textContent()).includes('body, #passages, @keyframes flicker'));
	const frame = () => win.frameLocator('.signaly-preview-frame iframe');
	const frameEval = async fn => {
		const handle = await win.locator('.signaly-preview-frame iframe').elementHandle();
		const f = await handle.contentFrame();
		return f.evaluate(fn);
	};
	await frame().locator('#passages .passage').waitFor({timeout: 20000});
	await win.waitForTimeout(1500);
	check('предпросмотр: настоящий SugarCube, экран Start', (await frameEval(() => SugarCube.State.passage)) === 'Start');
	check('предпросмотр: картинки из папки игры', await frameEval(() => [...document.querySelectorAll('#passages img')].some(i => i.complete && i.naturalWidth > 0)));
	check('предпросмотр: стартовый экран не мешает', (await frameEval(() => document.querySelector('#sg-start'))) === null);
	check('предпросмотр: вид как в игре (рамка 1050)', (await frameEval(() => document.querySelector('#passages').getBoundingClientRect().width)) === 1050);
	const hex = win.getByLabel('Код цвета').nth(1);
	await hex.fill('#ffbf00');
	await hex.press('Enter');
	await win.waitForTimeout(300);
	check('цвет текста меняется в предпросмотре сразу', (await frameEval(() => getComputedStyle(document.body).color)) === 'rgb(255, 191, 0)');
	const fontOptions = await win.getByLabel('Шрифт').locator('option').allTextContents();
	check('шрифты: системные и из media/fonts', fontOptions.includes('Consolas') && fontOptions.some(o => o.includes('DSEG7Classic-Regular.woff2')), fontOptions.join(', '));
	const soundOptions = await win.getByLabel('Звук запуска').locator('option').allTextContents();
	check('звуки из media/audio', soundOptions.includes('startscreentape.mp3'), String(soundOptions.length));
	await win.getByLabel('Звук запуска').selectOption('media/audio/startscreentape.mp3');
	await win.getByRole('slider', {name: 'Шум'}).fill('25');
	await win.waitForTimeout(300);
	check('эффекты видны в предпросмотре', (await frameEval(() => getComputedStyle(document.body, '::after').opacity)) === '0.25');
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-appearance.png')});
	await win.getByLabel('Экран:').selectOption({label: 'Стартовый экран'});
	await frame().locator('#sg-start').waitFor({timeout: 20000});
	await win.waitForTimeout(500);
	check('предпросмотр стартового экрана', await frameEval(() => getComputedStyle(document.querySelector('#sg-start'), '::after').content === '"Нажмите, чтобы запустить систему"'));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-start.png')});
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();
	check('окно закрыто', (await win.locator('.signaly-appearance-window').count()) === 0);
	const storyFile = fs.readdirSync(lib).find(f => f.startsWith('27_03_2025'));
	const saved = fs.readFileSync(path.join(lib, storyFile), 'utf8');
	check('блок оформления и движок сохранены в истории', saved.includes('СИГНАЛЫ: оформление терминала') && saved.includes('СИГНАЛЫ: движок терминала') && saved.includes('--sg-text: #ffbf00;'));
	await win.getByRole('tab', {name: 'Сборка'}).click();
	await btn(/Опубликовать в папку игры/).click();
	await win.waitForTimeout(1500);
	const published = fs.readFileSync(pubFile, 'utf8');
	check('готовая игра — с движком и оформлением', published.includes('LoadScreen.lock()') && published.includes('--sg-start-sound: &quot;media/audio/startscreentape.mp3&quot;') || published.includes('--sg-start-sound: "media/audio/startscreentape.mp3"'));
	if (process.env.OUT) {
		fs.copyFileSync(pubFile, path.join(process.env.OUT, 'game-electron-1.2.html'));
	}
}

await win.screenshot({path: process.env.SHOT || path.join(home, 'shot.png')});
await app.close();
console.log(results.every(Boolean) ? 'ВСЁ ХОРОШО' : 'ЕСТЬ ОШИБКИ');
process.exit(results.every(Boolean) ? 0 : 1);
