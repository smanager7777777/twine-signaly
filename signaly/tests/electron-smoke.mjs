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
}

await win.screenshot({path: process.env.SHOT || path.join(home, 'shot.png')});
await app.close();
console.log(results.every(Boolean) ? 'ВСЁ ХОРОШО' : 'ЕСТЬ ОШИБКИ');
process.exit(results.every(Boolean) ? 0 : 1);
