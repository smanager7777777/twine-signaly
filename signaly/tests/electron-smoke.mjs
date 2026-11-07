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
// Окно побольше — как на мониторе автора (экран Xvfb — 1600×1000).
await app.evaluate(({BrowserWindow}) => {
	const w = BrowserWindow.getAllWindows()[0];
	w.setBounds({x: 0, y: 0, width: 1600, height: 1000});
});
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
// Шаг 7.2: экран radio изменён — перенос музыки шаблона не срабатывает, окно «Звуки» видит StoryInit шаблона.
const twee = process.env.TWEE && path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-smoke-twee-')), path.basename(process.env.TWEE));

if (twee) {
	fs.writeFileSync(twee, fs.readFileSync(process.env.TWEE, 'utf8').replace(/(\n:: radio [^\n]*\n)/, '$1Своё радио\n'));
}
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
	check('эффекты видны в предпросмотре', (await frameEval(() => getComputedStyle(document.querySelector('#sg-fx'), '::after').opacity)) === '0.25');
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-appearance.png')});
	await win.getByLabel('Экран:').selectOption({label: 'Стартовый экран'});
	await frame().locator('#sg-start').waitFor({timeout: 20000});
	await win.waitForTimeout(500);
	check('предпросмотр стартового экрана', await frameEval(() => getComputedStyle(document.querySelector('#sg-start'), '::after').content === '"Нажмите, чтобы запустить систему"'));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-start.png')});
	// Выбор экрана в списке переключает предпросмотр (ошибка build-4).
	await win.getByLabel('Экран:').selectOption({label: 'radio'});
	await win.waitForTimeout(500);
	await frame().locator('#passages .passage').waitFor({timeout: 20000});
	await win.waitForTimeout(1500);
	check('выбор экрана в списке переключает предпросмотр', (await frameEval(() => SugarCube.State.passage)) === 'radio');
	await win.getByLabel('Экран:').selectOption({label: 'Texttests'});
	await win.waitForTimeout(3000);
	check('и на другой экран тоже', (await frameEval(() => SugarCube.State.passage)) === 'Texttests');
	// Тёмная тема Twine: текст окна светлый.
	await win.evaluate(() => (document.body.dataset.appTheme = 'dark'));
	await win.waitForTimeout(300);
	const dark = await win.evaluate(() => {
		const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return 0.299 * r + 0.587 * g + 0.114 * b; };
		const label = getComputedStyle(document.querySelector('.signaly-field-label')).color;
		const bg = getComputedStyle(document.querySelector('.signaly-appearance-window')).backgroundColor;
		const input = getComputedStyle(document.querySelector('.signaly-color-hex')).color;
		return {label: lum(label), bg: lum(bg), input: lum(input)};
	});
	check('тёмная тема: светлый текст на тёмном фоне', dark.label > 180 && dark.bg < 80 && dark.input > 180, JSON.stringify(dark));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-dark.png')});
	await win.evaluate(() => (document.body.dataset.appTheme = 'light'));
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();
	check('окно закрыто', (await win.locator('.signaly-appearance-window').count()) === 0);
	const storyFile = fs.readdirSync(lib).find(f => f.startsWith('27_03_2025'));
	const saved = fs.readFileSync(path.join(lib, storyFile), 'utf8');
	check('блок оформления и движок сохранены в истории', saved.includes('СИГНАЛЫ: оформление терминала') && saved.includes('СИГНАЛЫ: движок терминала') && saved.includes('--sg-text: #ffbf00;'));
	{
		// Шаг 2.3: при «Сохранить» таймеры и иллюминатор шаблона стали блоками.
		const t = saved.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
		check('шаг 2.3: таймер, скрытый таймер и иллюминатор шаблона — блоки, код таймера убран',
			!t.includes('setup.timerText = function') && t.includes('<<sg-timer "Clocks" minutes 0 seconds 5 goto "Start">>') &&
			t.includes('<<sg-timer "Clocks" start running>>') && t.includes('<<sg-timer "TERRAFORM_FAIL" seconds 30 goto "TERRAFORM" hidden>>') &&
			(t.match(/<<sg-chain width 1000 height 1000 goto "Start">>/g) || []).length === 3 && !t.includes("getElementById('vid1')"));
	}
	await win.getByRole('tab', {name: 'Сборка'}).click();
	await btn(/Опубликовать в папку игры/).click();
	await win.waitForTimeout(1500);
	const published = fs.readFileSync(pubFile, 'utf8');
	check('готовая игра — с движком и оформлением', published.includes('LoadScreen.lock()') && published.includes('--sg-start-sound: &quot;media/audio/startscreentape.mp3&quot;') || published.includes('--sg-start-sound: "media/audio/startscreentape.mp3"'));
	if (process.env.OUT) {
		fs.copyFileSync(pubFile, path.join(process.env.OUT, 'game-electron-1.2.html'));
	}

	// Предпросмотр в окне оформления — во всю высоту (замечание автора к build-5).
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/Оформление терминала/).click();
	await frame().locator('#passages .passage').waitFor({timeout: 20000});
	await win.waitForTimeout(800);
	const sizes = await win.evaluate(() => {
		const box = document.querySelector('.signaly-appearance-preview').getBoundingClientRect();
		const fr = document.querySelector('.signaly-preview-frame').getBoundingClientRect();
		return {box: box.height, frame: fr.height, width: fr.width, boxWidth: box.width};
	});
	check('предпросмотр оформления занимает всё место', sizes.frame > sizes.box * 0.75 || sizes.width > sizes.boxWidth * 0.9, JSON.stringify(sizes));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-appearance2.png')});
	await btn(/^Закрыть$/).last().click();

	// Шаг 1.3: окно «Виды кнопок и ссылок».
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/Виды кнопок и ссылок/).click();
	await win.waitForSelector('.signaly-kinds-window');
	check('окно видов открылось', await win.locator('.signaly-kinds-window').isVisible());
	check('стили кнопок перенесены', (await win.locator('.signaly-notice').first().textContent()).includes('Обычный, Красный большой, Жёлтый маленький, Янтарный, Фиолетовый'));
	await frame().locator('.sg-demo-table').waitFor({timeout: 20000});
	await win.waitForTimeout(800);
	const demo = await frameEval(() => {
		const cell = document.querySelectorAll('.sg-demo-table tr')[4];
		const [normal, hover] = [cell.children[1], cell.children[2]].map(td => getComputedStyle(td.querySelector('a')).backgroundColor);
		return {name: cell.children[0].textContent, normal, hover, passage: SugarCube.State.passage};
	});
	check('образцы: янтарный обычный и при наведении', demo.name === 'Янтарный' && demo.normal === 'rgb(0, 0, 0)' && demo.hover === 'rgb(255, 191, 0)', JSON.stringify(demo));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-kinds.png')});
	await win.locator('.signaly-kinds-item', {hasText: 'Янтарный'}).click();
	const kindHex = win.getByLabel('Код цвета').first();
	await kindHex.fill('#ff8800');
	await kindHex.press('Enter');
	await win.waitForTimeout(400);
	check('цвет вида меняется в предпросмотре сразу', (await frameEval(() => getComputedStyle(document.querySelector('.amber a')).color)) === 'rgb(255, 136, 0)');
	await win.getByPlaceholder('Название нового вида').fill('Синий');
	await btn(/^Добавить вид$/).click();
	await win.waitForTimeout(2500);
	check('новый вид: класс латиницей, в образцах', (await frameEval(() => !!document.querySelector('.sg-demo-table .siniy a'))), '');
	// С сессии 6 вкладки «Кнопки на экране» нет: место — у самого элемента.
	check('окно видов: вкладки «Кнопки на экране» нет', (await win.getByRole('tab', {name: 'Кнопки на экране'}).count()) === 0);
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();
	const saved2 = fs.readFileSync(path.join(lib, fs.readdirSync(lib).find(f => f.startsWith('27_03_2025'))), 'utf8');
	check('блок видов сохранён в истории', saved2.includes('СИГНАЛЫ: виды кнопок и ссылок') && saved2.includes('.siniy a {') && !/^a \{\n    color: #00cc00;/m.test(saved2));

	// Панель форматирования над текстом пассажа и предпросмотр рядом.
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: /^Texttests$/})}).dblclick();
	await win.waitForSelector('.signaly-format-toolbar');
	await win.waitForTimeout(800);
	const cmSelect = text => win.evaluate(t => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const from = t.indexOf('‹');
		const to = t.indexOf('›') - 1;
		cm.setValue(t.replace(/[‹›]/g, ''));
		cm.getDoc().setSelection(cm.getDoc().posFromIndex(from), cm.getDoc().posFromIndex(to));
	}, text);
	const cmValue = () => win.evaluate(() => document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getValue());
	await cmSelect('Проверка ‹жирного› текста\n[[Назад|Start]]');
	await btn(/^Жирный$/).click();
	check('панель: жирный', (await cmValue()).startsWith("Проверка ''жирного'' текста"), await cmValue());
	await win.evaluate(() => {
		const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
		const v = doc.getValue();
		doc.setSelection(doc.posFromIndex(v.indexOf('[[')), doc.posFromIndex(v.length));
	});
	await btn(/^Вид( ·|$)/).click();
	await win.locator('.menu-button-menu').getByText('Янтарный', {exact: true}).click();
	await win.waitForTimeout(300);
	check('панель: вид ссылки', (await cmValue()).endsWith('<span class="amber">[[Назад|Start]]</span>'), await cmValue());
	const toolbarNames = await win.locator('.signaly-format-toolbar button').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent).join(' | '));
	check('панель показывает вид под курсором', toolbarNames.includes('Вид: Янтарный'), toolbarNames);
	// Кнопка на экране (сессия 6) — блок: без выделения вставляется ссылка-образец.
	await win.evaluate(() => {
		const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
		doc.setCursor(doc.posFromIndex(doc.getValue().length));
	});
	await btn(/^Добавить блок$/).click();
	await win.locator('.menu-button-menu').getByText('Кнопка на экране (выделенная ссылка или кнопка)', {exact: true}).click();
	await win.waitForTimeout(400);
	check('кнопка на экране: блок вставлен, форма открыта', (await cmValue()).endsWith('<<sg-place corner tr x 20 y 20>><<link "Кнопка">><</link>><</sg-place>>') && (await win.locator('.signaly-block-panel strong').textContent()) === 'Кнопка на экране', (await cmValue()).slice(-90));
	await win.locator('.signaly-block-panel').getByLabel('Вид кнопки').selectOption('amber');
	for (const [label, value] of [['Отступ от края по горизонтали, px', '100'], ['Отступ от края по вертикали, px', '600']]) {
		const field = win.locator('.signaly-block-panel').getByLabel(label);
		await field.fill(value);
		await field.press('Enter');
		await win.waitForTimeout(300);
	}
	check('кнопка на экране: форма пишет вид и место', (await cmValue()).endsWith('<<sg-place kind amber corner tr x 100 y 600>><<link "Кнопка">><</link>><</sg-place>>'), (await cmValue()).slice(-90));
	// Шаг 2.2: свой звук у кнопки на экране (наборы — из кода звуков шаблона).
	await win.locator('.signaly-block-panel').getByLabel('Звук наведения').selectOption('none');
	await win.locator('.signaly-block-panel').getByLabel('Звук нажатия').selectOption('Нажатие');
	await win.waitForTimeout(300);
	check('кнопка на экране: свой звук (без звука / набор)', (await cmValue()).includes('<<sg-place kind amber corner tr x 100 y 600 hover none click "Нажатие">>'), (await cmValue()).slice(-110));
	await win.locator('.signaly-block-panel').getByLabel('Звук наведения').selectOption('');
	await win.locator('.signaly-block-panel').getByLabel('Звук нажатия').selectOption('');
	await win.waitForTimeout(300);
	await win.locator('.signaly-block-panel').getByRole('button', {name: 'Готово'}).click();
	await btn(/^Предпросмотр$/).click();
	await win.waitForSelector('.signaly-passage-preview');
	const pframe = async fn => {
		const handle = await win.locator('.signaly-passage-preview iframe').elementHandle();
		return (await handle.contentFrame()).evaluate(fn);
	};
	await win.waitForTimeout(4000);
	const shownPassage = await pframe(() => SugarCube.State.passage);
	check('предпросмотр пассажа: этот экран', shownPassage === 'Texttests', shownPassage);
	check('предпросмотр: галочка «Без звука», звуки наведения включены', (await win.locator('.signaly-passage-preview').getByLabel('Без звука').count()) === 1 && (await pframe(() => window.SIGNALY_UI_SOUND === true && !!SugarCube.setup.signalySounds)));
	const testPlace = await pframe(() => {
		const p = document.querySelector('#passages').getBoundingClientRect();
		const el = document.querySelector('.sg-place');
		const r = el.getBoundingClientRect();
		return {right: p.right - r.right, top: r.top - p.top, fixed: getComputedStyle(el).position, color: getComputedStyle(el.querySelector('a')).color};
	});
	check('кнопка на экране стоит на своём месте, вид янтарный', testPlace.right === 100 && testPlace.top === 600 && testPlace.fixed === 'fixed' && testPlace.color === 'rgb(255, 136, 0)', JSON.stringify(testPlace));
	check('предпросмотр пассажа: свежий текст', await pframe(() => !!document.querySelector('#passages .amber a') && document.querySelector('#passages strong').textContent === 'жирного'));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-passage.png')});

	// Шаг 1.4: «Добавить блок», форма блока, щелчок по команде, перетаскивание.
	const closeDialogs = async () => {
		const closers = win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]');
		const preview = win.locator('.signaly-passage-preview').getByRole('button', {name: 'Закрыть'});
		if (await preview.count()) {
			await preview.click();
		}
		while (await closers.count()) {
			await closers.first().click();
			await win.waitForTimeout(500);
		}
	};
	const panel = () => win.locator('.signaly-block-panel');
	const addBlock = async name => {
		await btn(/^Добавить блок$/).click();
		await win.locator('.menu-button-menu').getByText(name, {exact: true}).click();
		await win.waitForTimeout(400);
	};
	const toEnd = () =>
		win.evaluate(() => {
			const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
			doc.setCursor(doc.posFromIndex(doc.getValue().length));
		});
	await toEnd();
	await addBlock('Картинка');
	check('блок: картинка вставлена', (await cmValue()).includes('<<sg-image "" width 400>>'), (await cmValue()).slice(-60));
	check('блок: форма открылась', (await panel().locator('strong').textContent()) === 'Картинка');
	await panel().getByLabel('Файл', {exact: true}).selectOption('media/img/radio.jpg');
	await panel().getByLabel('Место', {exact: true}).selectOption('screen');
	await panel().getByLabel('От какого угла окна терминала').selectOption('tr');
	const xNum = panel().getByLabel('Отступ от края по горизонтали, px');
	await xNum.fill('10');
	await xNum.press('Enter');
	await win.waitForTimeout(300);
	check('форма переписывает команду', (await cmValue()).includes('<<sg-image "media/img/radio.jpg" width 400 place screen corner tr>>'.replace('tr>>', 'tr x 10>>')), (await cmValue()).slice(-90));
	await win.waitForTimeout(5000);
	const imgBox = await pframe(() => {
		const img = document.querySelector('#passages img[data-sg-src]');
		if (!img) return null;
		const r = img.getBoundingClientRect();
		return {x: r.left, y: r.top, w: r.width, h: r.height, right: document.querySelector('#passages').getBoundingClientRect().right - r.right};
	});
	check('предпросмотр: картинка на своём месте', imgBox && Math.abs(imgBox.right - 10) < 1, JSON.stringify(imgBox));
	const frameBox = await win.locator('.signaly-passage-preview iframe').boundingBox();
	const scale = frameBox.width / 1920;
	const at = (x, y) => [frameBox.x + x * scale, frameBox.y + y * scale];
	const dragBy = async (fx, fy, dx, dy) => {
		const [sx, sy] = at(fx, fy);
		await win.mouse.move(sx, sy);
		await win.mouse.down();
		await win.mouse.move(sx + dx / 2, sy + dy / 2, {steps: 4});
		await win.mouse.move(sx + dx, sy + dy, {steps: 4});
		await win.mouse.up();
		await win.waitForTimeout(1500);
	};
	await dragBy(imgBox.x + 20, imgBox.y + 20, -60, 40);
	const dragged = /<<sg-image "media\/img\/radio.jpg" width 400 place screen corner tr x (-?\d+) y (-?\d+)>>/.exec(await cmValue());
	const expectX = 10 + Math.round(60 / scale);
	const expectY = Math.round(40 / scale);
	check('перетаскивание мышью меняет место в команде', dragged && Math.abs(Number(dragged[1]) - expectX) <= 2 && Math.abs(Number(dragged[2]) - expectY) <= 2, `${dragged && dragged.slice(1)} ждали ${expectX} ${expectY}`);
	await win.waitForTimeout(4000);
	const imgBox2 = await pframe(() => {
		const r = document.querySelector('#passages img[data-sg-src]').getBoundingClientRect();
		return {x: r.left, y: r.top, w: r.width, h: r.height};
	});
	await dragBy(imgBox2.x + imgBox2.w - 4, imgBox2.y + imgBox2.h - 4, 50, 0);
	const resized = /<<sg-image "media\/img\/radio.jpg" width (\d+)/.exec(await cmValue());
	check('ширина за уголок', resized && Math.abs(Number(resized[1]) - (400 + Math.round(50 / scale))) <= 2, resized && resized[1]);
	await win.waitForTimeout(4000);
	const placeBox = await pframe(() => {
		const r = document.querySelector('.sg-place').getBoundingClientRect();
		return {x: r.left + r.width / 2, y: r.top + r.height / 2};
	});
	await dragBy(placeBox.x, placeBox.y, -40, 0);
	const placeMoved = /<<sg-place kind amber corner tr x (\d+) y 600>>/.exec(await cmValue());
	check('кнопку на экране двигают мышью в предпросмотре', placeMoved && Math.abs(Number(placeMoved[1]) - (100 + Math.round(40 / scale))) <= 2, placeMoved && placeMoved[1]);
	await win.waitForTimeout(4000);
	await win.locator('.signaly-passage-preview').getByLabel('Закрепить').check();
	const beforeLock = await cmValue();
	const imgBox3 = await pframe(() => {
		const r = document.querySelector('#passages img[data-sg-src]').getBoundingClientRect();
		return {x: r.left, y: r.top};
	});
	await dragBy(imgBox3.x + 20, imgBox3.y + 20, -80, 30);
	check('«Закрепить»: мышью не сдвинуть', (await cmValue()) === beforeLock);
	await win.locator('.signaly-passage-preview').getByLabel('Закрепить').uncheck();

	// Щелчок по команде в тексте открывает её форму.
	await panel().getByRole('button', {name: 'Готово'}).click();
	check('форма закрылась', (await panel().count()) === 0);
	const cmPoint = await win.evaluate(() => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const doc = cm.getDoc();
		const c = cm.charCoords(doc.posFromIndex(doc.getValue().indexOf('<<sg-image') + 4), 'window');
		return {x: c.left + 2, y: (c.top + c.bottom) / 2};
	});
	await win.mouse.click(cmPoint.x, cmPoint.y);
	await win.waitForTimeout(400);
	check('щелчок по команде открывает форму', (await panel().count()) === 1 && (await panel().locator('strong').textContent()) === 'Картинка');

	await toEnd();
	await addBlock('Поле кода');
	check('поле кода вставлено, форма открыта', (await cmValue()).includes('<<sg-code button "Подтвердить" gap 1>>') && (await panel().locator('strong').textContent()) === 'Поле кода');
	await panel().getByLabel('Код', {exact: true}).first().fill('777');
	await win.waitForTimeout(300);
	check('поле кода: свой код в таблице', (await cmValue()).includes('<<sg-case "777" title "Код принят">>Доступ разрешён'), (await cmValue()).slice(-200));
	await toEnd();
	await addBlock('Экран тревоги');
	await panel().getByLabel('Как закрывается').selectOption('master');
	await win.waitForTimeout(300);
	check('экран тревоги: вставлен, закрытие мастером', (await cmValue()).includes('<<sg-alarm bg "#cc0000" color "#000000" size 70 close master>>ТРЕВОГА<</sg-alarm>>'));
	await toEnd();
	// Сессия 26 (решение 126, ответ 1А): «Окно-сообщение» убрано из «Добавить блок» —
	// окно открывает ссылка с действием «Открыть окно».
	await toEnd();
	await btn(/^Добавить блок$/).click();
	await win.waitForTimeout(300);
	check('«Окно-сообщение» больше нет в «Добавить блок»', (await win.locator('.menu-button-menu').getByText('Окно-сообщение', {exact: true}).count()) === 0);
	await win.locator('.menu-button-menu').getByText('Видео', {exact: true}).click();
	await win.waitForTimeout(400);
	check('видео: вставлено', (await cmValue()).includes('<<sg-video "" width 1000 autoplay loop muted>>') && (await panel().locator('strong').textContent()) === 'Видео');
	// Шаг 2.3: таймер и цепочка видео.
	await toEnd();
	await addBlock('Таймер');
	check('таймер: вставлен, форма открыта', (await cmValue()).includes('<<sg-timer "Таймер" minutes 5 seconds 0>>') && (await panel().locator('strong').textContent()) === 'Таймер', (await cmValue()).slice(-60));
	await panel().getByLabel('Что по окончании').selectOption('dialog');
	await win.waitForTimeout(300);
	await panel().getByLabel('Формат').selectOption('hms');
	await win.waitForTimeout(300);
	check('таймер: окно-сообщение по окончании, формат ЧЧ:ММ:СС', (await cmValue()).includes('<<sg-timer "Таймер" minutes 5 seconds 0 title "Время вышло" text "Время вышло." format hms>>'), (await cmValue()).slice(-110));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-timer.png')});
	check('таймер: в форме вид табло (шрифт DSEG7 по умолчанию)', (await panel().getByLabel('Шрифт').inputValue()) === 'media/fonts/DSEG7Classic-Regular.woff2');
	// Пока в редакторе курсор, щелчок по форме сохраняет текст пассажа, и окно
	// «Подробности» над ним может вырасти на строку (дата изменения) — форма
	// сдвигается между нажатием и отпусканием. Сначала убираем фокус.
	await win.evaluate(() => document.activeElement && document.activeElement.blur());
	await win.waitForTimeout(400);
	await panel().getByLabel('Не показывать табло').check();
	await win.waitForTimeout(300);
	check('таймер: скрытый — без настроек табло', (await cmValue()).includes('format hms hidden>>') && (await panel().getByLabel('Шрифт').count()) === 0);
	await toEnd();
	await addBlock('Цепочка видео (иллюминатор)');
	check('цепочка видео: вставлена с двумя шагами', (await cmValue()).endsWith('<<sg-chain width 1000 height 1000>>\n<<sg-step "" next click loop muted>>\n<<sg-step "" next end>>\n<</sg-chain>>') && (await panel().locator('strong').textContent()) === 'Цепочка видео', (await cmValue()).slice(-140));
	// Сначала снять фокус с редактора: сохранение текста меняет дату в окне
	// «Подробности» над пассажем, и форма сдвигается (см. «Не показывать табло»).
	await win.evaluate(() => document.activeElement && document.activeElement.blur());
	await win.waitForTimeout(400);
	await panel().getByRole('button', {name: 'Добавить шаг'}).click();
	await win.waitForTimeout(300);
	await panel().getByLabel('Цепочка заканчивается').selectOption('time');
	await win.waitForTimeout(300);
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-chain.png')});
	check('цепочка видео: третий шаг «через N секунд»', (await cmValue()).endsWith('<<sg-step "" next end>>\n<<sg-step "" next time>>\n<</sg-chain>>'), (await cmValue()).slice(-90));
	// Эффекты текста (шаг 2.1): кнопка «Эффект» на выделенный текст.
	const appendSelected = text =>
		win.evaluate(t => {
			const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
			const end = doc.getValue().length;
			doc.replaceRange('\n' + t, doc.posFromIndex(end));
			const from = doc.getValue().length - t.length;
			doc.setSelection(doc.posFromIndex(from), doc.posFromIndex(doc.getValue().length));
		}, text);
	const addEffect = async name => {
		await btn(/^Эффект$/).click();
		await win.locator('.menu-button-menu').getByText(name, {exact: true}).click();
		await win.waitForTimeout(500);
	};
	await appendSelected('Печать здесь');
	await win.waitForTimeout(1300);
	await addEffect('Печать по буквам');
	check('эффект: печать вставлена, форма открыта', (await cmValue()).endsWith('<<type 40ms>>Печать здесь<</type>>') && (await panel().locator('strong').textContent()) === 'Печать по буквам', (await cmValue()).slice(-60));
	const speed = panel().getByLabel('Скорость печати, мс на букву');
	await speed.fill('80');
	await speed.press('Enter');
	await panel().getByLabel('Курсор').selectOption('none');
	await win.waitForTimeout(300);
	check('эффект: форма меняет скорость и курсор', (await cmValue()).endsWith('<<type 80ms none>>Печать здесь<</type>>'), (await cmValue()).slice(-60));
	await appendSelected('Мысль');
	await win.waitForTimeout(1300);
	await addEffect('Глитч');
	await panel().getByLabel('Подменный текст').fill('КУПИ');
	await win.waitForTimeout(300);
	check('эффект: глитч с подменным текстом', (await cmValue()).endsWith('<span class="glitchy" data-text="КУПИ">Мысль</span>'), (await cmValue()).slice(-60));
	await toEnd();
	await addEffect('Появление строк по очереди');
	check('эффект: появление строк по очереди', (await cmValue()).endsWith('<<timed 1s>>Первая строка\n<<next>>Вторая строка\n<<next>>Третья строка<</timed>>') && (await panel().locator('strong').textContent()) === 'Появление', (await cmValue()).slice(-90));
	// Сессия 7: несколько эффектов на один текст и «после эффектов выше».
	const selectLast = text =>
		win.evaluate(t => {
			const doc = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getDoc();
			const at = doc.getValue().lastIndexOf(t);
			doc.setSelection(doc.posFromIndex(at), doc.posFromIndex(at + t.length));
		}, text);
	await appendSelected('Слой');
	await win.waitForTimeout(1300);
	await addEffect('Печать по буквам');
	await panel().getByLabel('Когда начинать').selectOption('after');
	await win.waitForTimeout(300);
	check('эффект: печать «после эффектов выше»', (await cmValue()).endsWith('<<type 40ms after>>Слой<</type>>'), (await cmValue()).slice(-60));
	await selectLast('Слой');
	await addEffect('Глитч');
	check('эффект: глитч на напечатанный текст — внутрь печати', (await cmValue()).endsWith('<<type 40ms after>><span class="glitchy" data-text="Слой">Слой</span><</type>>'), (await cmValue()).slice(-90));
	await panel().getByLabel('Когда включить').selectOption('open');
	await win.waitForTimeout(300);
	check('эффект: глитч включается через N секунд', (await cmValue()).includes('data-sg-start="2s">Слой'), (await cmValue()).slice(-90));
	await selectLast('Слой');
	await addEffect('Появление через N секунд');
	check('эффект: появление — снаружи печати', (await cmValue()).endsWith('<<timed 3s>><<type 40ms after>><span class="glitchy" data-text="Слой" data-sg-start="2s">Слой</span><</type>><</timed>>'), (await cmValue()).slice(-120));
	check('форма: подсказка про несколько эффектов', (await panel().textContent()).includes('Ещё один эффект на этот же текст'));
	await panel().getByRole('button', {name: 'Готово'}).click();
	const typePoint = await win.evaluate(() => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const doc = cm.getDoc();
		const c = cm.charCoords(doc.posFromIndex(doc.getValue().indexOf('<<type 80ms') + 3), 'window');
		return {x: c.left + 2, y: (c.top + c.bottom) / 2};
	});
	await win.mouse.click(typePoint.x, typePoint.y);
	await win.waitForTimeout(400);
	check('щелчок по команде эффекта открывает форму', (await panel().count()) === 1 && (await panel().locator('strong').textContent()) === 'Печать по буквам');
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-blocks.png')});
	await win.waitForTimeout(5000);
	const blockErrors = await pframe(() => [...document.querySelectorAll('.error-view, .error')].map(e => e.textContent));
	check('предпросмотр: все блоки без ошибок', blockErrors.length === 0, blockErrors.join(' | '));

	// Окно KR2: форма со статусами и ссылкой на окно.
	await closeDialogs();
	await win.waitForTimeout(500);
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: /^Космические рейнджеры$/})}).dblclick();
	await win.waitForSelector('.signaly-format-toolbar');
	await win.waitForTimeout(800);
	await addBlock('Окно KR2 (этот экран)');
	check('KR2: форма, тег стоит', (await panel().locator('strong').textContent()) === 'Окно KR2' && (await panel().getByLabel('Этот экран — окно KR2').isChecked()));
	// Сессия 26 (решение 126, ответ 2А): строки статусов — обычный текст, в форме их нет.
	check('KR2: картинка из текста, строк статусов в форме нет', (await panel().getByLabel('Картинка', {exact: true}).inputValue()) === 'media/img/radio.jpg' && (await panel().getByLabel('Текст строки').count()) === 0);
	const colsNum = panel().getByLabel('Ширина левой части (текст и навигация), %');
	await colsNum.fill('50');
	await colsNum.press('Enter');
	await win.waitForTimeout(300);
	await win.evaluate(() => {
		const cm = document.querySelector('.CodeMirror').CodeMirror;

		cm.setValue(cm.getValue().replace('<<kr2vars>>Здоровье: $health', '<<kr2vars>>Здоровье: $health\n<<link "Подробно">><<sg-open "" passage "showPSGinfo">><</sg-open>><</link>>'));
	});
	await win.waitForTimeout(1500);
	const kr2Text = await cmValue();
	check('KR2: доли записаны, статус-ссылка — обычный текст', kr2Text.includes('<<kr2layout 50 65>>') && kr2Text.includes('<<link "Подробно">>'), kr2Text.slice(0, 220));
	await btn(/^Предпросмотр$/).click();
	await win.waitForTimeout(6000);
	const kr2Shown = await pframe(() => ({
		passage: SugarCube.State.passage,
		cols: getComputedStyle(document.querySelector('#passages')).gridTemplateColumns,
		link: !!document.querySelector('#kr2-vars a')
	}));
	check('KR2 в предпросмотре: доли и ссылка в статусах', kr2Shown.passage === 'Космические рейнджеры' && kr2Shown.link && /^(\d+(\.\d+)?)px \1px$/.test(kr2Shown.cols), JSON.stringify(kr2Shown));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-kr2.png')});
	await closeDialogs();
	await win.waitForTimeout(1500);

	// Окна-сообщения в «Оформлении терминала».
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/Оформление терминала/).click();
	await frame().locator('#passages .passage').waitFor({timeout: 20000});
	await win.waitForTimeout(1000);
	await win.getByLabel('Своё оформление окон-сообщений').check();
	await win.waitForTimeout(300);
	check('окна-сообщения: поля из правил .ui-dialog', (await win.getByLabel('Свечение рамки', {exact: true}).inputValue()) === '10' && (await win.locator('section', {hasText: 'Своё оформление окон-сообщений'}).getByLabel('Размер текста, px').last().inputValue()) === '25');
	await btn(/Показать образец окна/).click();
	await win.waitForTimeout(800);
	const dlg = await frameEval(() => ({open: SugarCube.Dialog.isOpen(), border: getComputedStyle(document.getElementById('ui-dialog')).borderTopColor, shadow: getComputedStyle(document.getElementById('ui-dialog')).boxShadow}));
	check('окна-сообщения: образец в предпросмотре', dlg.open && dlg.border === 'rgb(0, 204, 0)' && dlg.shadow.includes('10px'), JSON.stringify(dlg));
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-dialogs.png')});
	check('эффекты текста: галочки печати включены', (await win.getByLabel('Печать: щелчок допечатывает сразу').isChecked()) && (await win.getByLabel('Печать: на уже виденном экране — сразу весь текст').isChecked()));
	check('глитч: значения из стилей автора', (await win.getByLabel('Сдвиг полос, px').inputValue()) === '5' && (await win.getByLabel('Скорость: один цикл за, с').inputValue()) === '2');
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();

	const saved3 = fs.readFileSync(path.join(lib, fs.readdirSync(lib).find(f => f.startsWith('27_03_2025'))), 'utf8');
	check('история: движок 26, KR2 в движке, оформление окон и эффектов', saved3.includes('Версия движка: 26') && saved3.includes('код окна KR2 перенесён в движок') && saved3.includes('#ui-dialog {') && saved3.includes('--sg-type-click: 1;') && saved3.includes('html .glitchy::after') && (saved3.includes('&lt;&lt;kr2layout 50 65&gt;&gt;') || saved3.includes('<<kr2layout 50 65>>')));
	check('история: звуки шаблона стали наборами, кода звуков нет', saved3.includes('setup.signalySounds') && saved3.includes('звуки наведения и нажатия перенесены в наборы') && !saved3.includes('var hoverSounds'));

	// Шаг 2.2: окно «Виды кнопок и ссылок» → «Звуки».
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/Виды кнопок и ссылок/).click();
	await win.waitForSelector('.signaly-kinds-window');
	await win.locator('.signaly-kinds-item').filter({hasText: 'Янтарный'}).click();
	await win.locator('.signaly-kinds-window').getByRole('tab', {name: 'Звуки'}).click();
	const kindHover = win.locator('.signaly-kinds-window').getByLabel('Звук наведения');
	check('вид: звук «как у Обычного» по умолчанию', (await kindHover.inputValue()) === '__base__');
	await kindHover.selectOption('');
	check('окно видов: галочка «Без звука» у предпросмотра', (await win.locator('.signaly-kinds-window').getByLabel('Без звука').count()) === 1);
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();
	await win.waitForTimeout(500);

	// Окно «Звуки»: наборы из шаблона, файлы StoryInit, новая группа.
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/^Звуки$/).click();
	await win.waitForSelector('.signaly-sounds-window');
	const items = () => win.locator('.signaly-sounds-window .signaly-kinds-item').allTextContents();
	check('окно «Звуки»: наборы «Наведение» и «Нажатие»', JSON.stringify(await items()) === JSON.stringify(['Наведение', 'Нажатие']), JSON.stringify(await items()));
	check('набор: 6 файлов, 5 %, без задержки', (await win.locator('.signaly-sounds-editor select').count()) === 6 && (await win.locator('.signaly-sounds-editor').getByLabel('Громкость, %').inputValue()) === '5' && (await win.locator('.signaly-sounds-editor').getByLabel('Задержка, мс').inputValue()) === '0');
	check('набор: звучит у видов (Обычный, без звука у amber не считается)', (await win.locator('.signaly-sounds-editor').textContent()).includes('Звучит у видов: Обычный'));
	await win.locator('.signaly-sounds-window').getByRole('tab', {name: 'Файлы'}).click();
	check('окно «Звуки»: 17 файлов из StoryInit', (await items()).length === 17, String((await items()).length));
	await win.locator('.signaly-sounds-window').getByRole('tab', {name: 'Группы'}).click();
	await btn(/^Добавить группу$/).click();
	await win.locator('.signaly-sounds-editor').getByLabel('Звуки группы', {exact: false}).count();
	await win.locator('.signaly-sounds-editor label').filter({hasText: /^ ?msgsoundA$/}).locator('input').check();
	await win.locator('.signaly-sounds-window').getByRole('tab', {name: 'Плейлисты'}).click();
	check('окно «Звуки»: 3 плейлиста', (await items()).length === 3);
	await win.screenshot({path: (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', '-sounds.png')});
	await btn(/^Сохранить$/).click();
	await win.waitForTimeout(1500);
	await btn(/^Закрыть$/).last().click();
	await win.waitForTimeout(500);
	const saved4 = fs.readFileSync(path.join(lib, fs.readdirSync(lib).find(f => f.startsWith('27_03_2025'))), 'utf8').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
	check('история: вид «Янтарный» без звука наведения', /"amber":\s*\{\s*"hover":\s*""\s*\}/.test(saved4));
	check('история: StoryInit — раздел окна «Звуки» с новой группой', saved4.includes('СИГНАЛЫ: звуки — правьте в окне «Звуки»') && saved4.includes('<<createaudiogroup ":ГРУППА">>\n<<track "msgsoundA">>\n<</createaudiogroup>>'), saved4.slice(saved4.indexOf('СИГНАЛЫ: звуки — правьте'), saved4.indexOf('СИГНАЛЫ: звуки — правьте') + 200));
}

await win.screenshot({path: process.env.SHOT || path.join(home, 'shot.png')});
await app.close();
console.log(results.every(Boolean) ? 'ВСЁ ХОРОШО' : 'ЕСТЬ ОШИБКИ');
process.exit(results.every(Boolean) ? 0 : 1);
