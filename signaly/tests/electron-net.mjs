// Проверка программы (Electron), сессия 31 (этап Т1 приложения): действие «Телефонам: …» в форме ссылки,
// строка условия «Пришло с телефона», предпросмотр экрана с <<sg-net>> без ошибок, движок 29 в истории.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-net.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-net-'));
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

check('в истории движок 29', storyFile().includes('Версия движка: 29'));

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

// 1. Ссылка → «Телефонам: …» → открыть блоки сотруднику №3.
await openPassage('Атмосфера');
await cmSet('<<link "Сеть">><</link>>', [0, 0]);
await win.waitForTimeout(500);
await cmClick(4);
check('форма «Ссылка» открылась', (await panel().locator('strong').textContent()) === 'Ссылка');
await panel().getByLabel('Добавить действие').selectOption('net');
await win.waitForTimeout(400);
check('новое действие — уведомление всем', (await cmValue()) === '<<link "Сеть">><<sg-net notify "ТЕРМИНАЛ" "">><</link>>', await cmValue());
await panel().getByLabel('Текст').fill('Шлюз открыт');
await blur();
check('текст уведомления', (await cmValue()).includes('<<sg-net notify "ТЕРМИНАЛ" "Шлюз открыт">>'), await cmValue());
await panel().getByLabel('Что сделать на телефонах').selectOption('open');
await panel().getByLabel('Блоки').fill('Дневник, Схема');
await blur();
await panel().getByLabel('Кому').selectOption('list');
await win.waitForTimeout(300);
await panel().getByLabel('Номера сотрудников').fill('3, 5');
await blur();
check('открыть блоки «Дневник, Схема» сотрудникам 3 и 5', (await cmValue()).includes('<<sg-net open "Дневник, Схема" "" to "3, 5">>'), await cmValue());
check('«тому, кто ввёл код» — только в кодах', (await panel().getByLabel('Кому').locator('option').allTextContents()).join('|') === 'всем|сотрудникам с номерами…');
await panel().getByLabel('Добавить действие').selectOption('net');
await win.waitForTimeout(300);
await panel().getByLabel('Что сделать на телефонах').nth(1).selectOption('countdown');
await win.waitForTimeout(300);
check('второе действие — обратный отсчёт 300 с', (await cmValue()).includes('<<sg-net countdown 300 "">>'), await cmValue());
await win.screenshot({path: shot('form')});
await panel().getByRole('button', {name: 'Готово'}).click();

// 2. Условие «Пришло с телефона».
await cmSet('<<if setup.phone("code", "4242") gt 0>>ДА<</if>>', [0, 0]);
await win.waitForTimeout(500);
await cmClick(5);
check('условие: «Пришло с телефона»', (await panel().getByLabel('Что проверять').inputValue()) === 'phone');
check('условие: код 4242', (await panel().getByLabel('Код или фраза').inputValue()) === '4242');
await panel().getByLabel('Когда').selectOption('ge');
await panel().getByLabel('Сколько раз').fill('2');
await blur();
check('«пришло не меньше 2 раз» — gte 2', (await cmValue()) === '<<if setup.phone("code", "4242") gte 2>>ДА<</if>>', await cmValue());
await panel().getByLabel('Что пришло').selectOption('event');
await panel().getByLabel('Имя события').fill('шлюз');
await blur();
check('событие «шлюз»', (await cmValue()) === '<<if setup.phone("event", "шлюз") gte 2>>ДА<</if>>', await cmValue());
await win.screenshot({path: shot('cond')});
await panel().getByRole('button', {name: 'Готово'}).click();

// 3. Предпросмотр: <<sg-net>> и setup.phone без ошибок, без огонька сети.
await cmSet('<<link "Сеть">><<sg-net notify "А" "Б">><</link>> <<if setup.phone("code", "1") is 0>>НЕТ<</if>>', [0, 0]);
await win.waitForTimeout(1500);
await btn(/^Предпросмотр$/).click();
await win.waitForSelector('.signaly-passage-preview');
await win.waitForTimeout(4000);
const frame = await (await win.locator('.signaly-passage-preview iframe').elementHandle()).contentFrame();

await frame.click('#passages a');
await win.waitForTimeout(600);
const shown = await frame.evaluate(() => ({
	text: document.querySelector('#passages').innerText,
	errors: document.querySelectorAll('#passages .error').length,
	net: !!window.SgTermNet
}));
check('предпросмотр: ссылка с «Телефонам: …» и условие — без ошибок, сети нет', shown.text.includes('НЕТ') && shown.errors === 0 && !shown.net, JSON.stringify(shown));
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
