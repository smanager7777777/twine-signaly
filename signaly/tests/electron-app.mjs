// Проверка программы (Electron), сессия 32 (этап Т2 приложения): окно «Приложение» — загрузка пакета .sgpack
// в историю (пассажи, «Коды», файлы media/app/), сборка пакета обратно, повторная загрузка с отличиями,
// окно «Коды» не теряет телефонную часть, сбои списком в «Телефонам: …».
// Запуск: TWEE=<шаблон> PACKS=<папка с test-pack.sgpack и test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-app-'));
const game = path.join(home, 'Игра СИГНАЛЫ');
const shot = name => (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', `-${name}.png`);
const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};

const app = await electron.launch({
	executablePath: process.env.ELECTRON_BIN || require('electron'),
	args: ['--no-sandbox', 'electron-build/main/src/electron/main-process/index.js'],
	env: {...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}
});
const win = await app.firstWindow();

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
await win.locator('input[type=file]').setInputFiles(process.env.TWEE);
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

const libDir = path.join(await app.evaluate(({app}) => app.getPath('documents')), 'Twine СИГНАЛЫ', 'Истории');
const storyFile = () =>
	fs
		.readFileSync(path.join(libDir, fs.readdirSync(libDir).find(f => f.startsWith('27_03_2025'))), 'utf8')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

check('в истории движок 35', storyFile().includes('Версия движка: 35'));

const openPassage = async name => {
	// Окна других пассажей — закрыть (редактор берётся первый на странице).
	while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
		await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
		await win.waitForTimeout(600);
	}
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: new RegExp(`^${name}$`)})}).dblclick();
	await win.waitForSelector('.signaly-format-toolbar');
	await win.waitForTimeout(800);
};
const cmValue = () => win.evaluate(() => document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getValue());
const cmSet = (text, sel) =>
	win.evaluate(
		([t, s]) => {
			const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
			cm.setValue(t);
			cm.getDoc().setSelection(cm.getDoc().posFromIndex(s[0]), cm.getDoc().posFromIndex(s[1]));
		},
		[text, sel]
	);
// Щелчок мышью по месту в тексте (как автор щёлкает по ссылке).
const cmClick = async index => {
	const at = await win.evaluate(i => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const pos = cm.getDoc().posFromIndex(i);

		cm.scrollIntoView(pos, 60);
		const c = cm.charCoords(pos, 'window');

		return {x: c.left + 2, y: (c.top + c.bottom) / 2};
	}, index);

	await win.mouse.click(at.x, at.y);
	await win.waitForTimeout(400);
};
const panel = () => win.locator('.signaly-block-panel');
const blur = async () => {
	await win.evaluate(() => document.activeElement && document.activeElement.blur());
	await win.waitForTimeout(400);
};


const {unzipSync, zipSync, strFromU8, strToU8} = require('fflate');
const packs = process.env.PACKS || 'src/util/signaly/__tests__/fixtures';
const packFile = name => fs.readFileSync(path.join(packs, name));
const appWin = () => win.locator('.signaly-app-window');
const openApp = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await btn(/^Приложение$/).click();
	await appWin().waitFor();
	await win.waitForTimeout(500);
};
const loadPack = async (name, buffer) => {
	await appWin().locator('input[type=file]').setInputFiles({name, mimeType: 'application/zip', buffer});
	await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
	await win.waitForTimeout(400);
};
const appText = () => appWin().innerText();
const closeApp = () => appWin().getByRole('button', {name: 'Закрыть'}).click();

// 1. Пустая история → загрузить test-pack.
await openApp();
check('окно «Приложение»: данных нет', (await appText()).includes('Данных приложения в истории нет'), await appText());
await loadPack('ТЕСТ-v2.sgpack', packFile('app-test-pack.sgpack'));
check('пакет прочитан: 2 персонажа, 4 блока, 3 кода', /2 персонажей, 4 блоков, 3 кодов телефона/.test(await appText()), await appText());
check('первая загрузка — без отличий', (await appText()).includes('В истории приложения ещё нет'));
await appWin().getByRole('button', {name: 'Загрузить в историю'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
check('загружено, номер дан персонажу без номера', /Медик Тест → 1/.test(await appText()), await appText());
check('файлы — в media/app/ папки игры', fs.existsSync(path.join(game, 'media/app/plan.png')) && fs.readFileSync(path.join(game, 'media/app/signal.mp3')).equals(Buffer.from(unzipSync(packFile('app-test-pack.sgpack'))['media/signal.mp3'])));
await win.screenshot({path: shot('loaded')});
await win.waitForTimeout(2500);

let story = storyFile();
check('в истории: пассаж «Приложение» (app-settings) и блоки app-block', story.includes('name="Приложение"') && story.includes('tags="app-settings"') && (story.match(/tags="app-block"/g) || []).length === 4, '');
check('блок в папке: «Схемы/Отсек 1/План отсека» с картинкой media/app/plan.png', story.includes('name="Схемы/Отсек 1/План отсека"') && story.includes('<<app-img "media/app/plan.png"'));
check('персонажи — сотрудники «Кодов» с данными телефона', (story.match(/<<sg-person "\d+" pin "" phone '/g) || []).length === 2);
check('коды телефона — в «Кодах» с where phone', (story.match(/where phone>>/g) || []).length === 3);
check('в истории движок 35', story.includes('Версия движка: 35'));
check('цвет тега app-block на карте — синий', story.includes('<tw-tag name="app-block" color="blue">'), (story.match(/<tw-tag[^>]*>/g) || []).join(' '));

// 2. Собрать пакет — тот же пакет, версия +1.
await btn(/^Опубликовать пакет/).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Собран пакет'), null, {timeout: 20000});
check('«Опубликовать»: сначала проверка истории, ошибок нет', (await appText()).includes('Проверка истории: ошибок нет'), await appText());
const builtPath = path.join(game, 'ТЕСТ-v3.sgpack');
check('пакет собран в папку игры: ТЕСТ-v3.sgpack', fs.existsSync(builtPath), await appText());
const built = unzipSync(fs.readFileSync(builtPath));
const g = JSON.parse(strFromU8(built['game.json']));
const orig = JSON.parse(strFromU8(unzipSync(packFile('app-test-pack.sgpack'))['game.json']));
check('в пакете: версия 3, блоки, коды, персонажи, файлы', g.version === 3 && g.blocks.length === 4 && g.codes.length === 3 && g.accounts.length === 2 && !!built['media/plan.png'] && !!built['media/signal.mp3']);
check('коды и тексты блоков — как в исходном пакете', JSON.stringify(g.codes.map(c => [c.code, c.answer])) === JSON.stringify(orig.codes.map(c => [c.code, c.answer])) && g.blocks[0].items[0].text === orig.blocks[0].items[0].text);
await win.waitForTimeout(800);

// 3. Тот же пакет ещё раз — «совпадает».
await loadPack('ТЕСТ-v3.sgpack', fs.readFileSync(builtPath));
check('повторная загрузка собранного: «совпадает»', (await appText()).includes('Пакет совпадает'), await appText());
await appWin().getByRole('button', {name: 'Отмена'}).click();

// 4. Пакет, изменённый в старом редакторе: отличия и «Заменить».
const changed = JSON.parse(JSON.stringify(g));
changed.blocks[0].title = 'Разбитое устройство';
changed.blocks.splice(2, 1);
changed.glitches = [{id: 'g1', name: 'Сбой экрана', kind: 'visual', fx: ['noise'], seconds: 0, fix: 'shake'}, {id: 'g2', name: 'Сбой системы', kind: 'visual', fx: ['dark'], seconds: 0, fix: 'code'}];
const zipped = zipSync({'game.json': strToU8(JSON.stringify(changed)), 'media/plan.png': built['media/plan.png']});
await loadPack('ТЕСТ-v4.sgpack', Buffer.from(zipped));
const diffText = await appText();
check('отличия: блок убран, блок изменён, сбои добавлены', diffText.includes('Что поменяется') && /Блоки:.*уберётся: Журнал планшета/.test(diffText) && /изменится: Находки\/Разбитое устройство/.test(diffText) && /Сбои:.*добавится: Сбой экрана, Сбой системы/.test(diffText), diffText);
await win.screenshot({path: shot('diff')});
await appWin().getByRole('button', {name: 'Заменить данными пакета'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
await closeApp();
await win.waitForTimeout(2500);
story = storyFile();
check('после замены: блок переименован, лишний убран', story.includes('name="Находки/Разбитое устройство"') && !story.includes('name="Находки/Повреждённое устройство"') && !story.includes('name="Журнал планшета"'));

// 5. Окно «Коды»: сохранить — телефонная часть на месте.
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Коды$/}).first().click();
await win.waitForTimeout(1200);
const codesWin = win.locator('[role=dialog]').filter({hasText: 'Сотрудники'}).first();
check('окно «Коды»: коды телефона отмечены', (await win.locator('text=📱 телефон').count()) >= 3);
await win.getByRole('tab', {name: /Сотрудники/}).click().catch(() => {});
await win.waitForTimeout(300);
await win.locator('.signaly-keys-list button, .signaly-keys-item').first().click().catch(() => {});
const pinField = win.getByLabel('Личный код');
if (await pinField.count()) {
	await pinField.first().fill('555');
}
await btn(/^Сохранить$/).first().click();
await win.waitForTimeout(2500);
story = storyFile();
const codesText = (/<tw-passagedata[^>]*name="Коды"[^>]*>([\s\S]*?)<\/tw-passagedata>/.exec(story) || [])[1] || '';
check('окно «Коды» сохранило: данные телефона и коды на месте', (codesText.match(/ phone '\{/g) || []).length === 2 && (codesText.match(/<<sg-phone>>/g) || []).length === 3, codesText.slice(0, 600));
await win.keyboard.press('Escape');
await win.waitForTimeout(500);
void codesWin;

// 6. «Телефонам: сбой» — сбои списком из приложения.
await openPassage('Атмосфера');
await cmSet('<<link "Сеть">><</link>>', [0, 0]);
await win.waitForTimeout(500);
await cmClick(4);
await panel().getByLabel('Добавить действие').selectOption('net');
await win.waitForTimeout(400);
await panel().getByLabel('Что сделать на телефонах').selectOption('glitch');
await win.waitForTimeout(400);
const opts = await panel().getByLabel('Сбой').locator('option').allTextContents();
check('сбой — списком из данных приложения', opts.join('|') === 'Сбой экрана|Сбой системы', opts.join('|'));
await panel().getByLabel('Сбой').selectOption('Сбой системы');
await blur();
check('в ссылке — <<sg-net glitch "Сбой системы">>', (await cmValue()).includes('<<sg-net glitch "Сбой системы">>'), await cmValue());
await win.screenshot({path: shot('glitch')});
await panel().getByRole('button', {name: 'Готово'}).click();
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
