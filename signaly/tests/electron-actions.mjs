// Проверка программы (Electron), сессия 10, шаг 3.2: форма «Ссылка / кнопка» —
// щелчок по ссылке в тексте, действия (переменная, звук, окно, таймер,
// остановка таймера), порядок ▲▼, переход, ссылка ↔ кнопка, [[…]] остаётся
// разметкой, кнопка «Действие» на выделенный текст, движок 8 ставится сам,
// окна PRCDTEST шаблона → <<sg-open>>; условие «выключена» и «не равна».
// Запуск: TWEE=<шаблон build-11> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-actions.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-actions-'));
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

check('в истории движок 6 и окна PRCDTEST кодом', storyFile().includes('Версия движка: 6') && storyFile().includes("Dialog.create('Процедура 001')"));

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

// 1. Ссылка «A» на экране «Атмосфера»: щелчок открывает форму с действием «Звук».
await openPassage('Атмосфера');
let value = await cmValue();
const aAt = value.indexOf('<<link "A">>');

await cmClick(aAt + 4);
check('щелчок по ссылке открывает форму «Ссылка»', (await panel().locator('strong').textContent()) === 'Ссылка');
check('форма: надпись «A», действие «Звук»', (await panel().getByLabel('Надпись').inputValue()) === 'A' && (await panel().locator('legend').first().textContent()).includes('Звук'));
check(
	'звук понят: всё играющее, кроме :TERMINAL, плавно до 10 %',
	(await panel().getByLabel('Что звучит').inputValue()) === 'playing' &&
		(await panel().getByLabel('Кроме группы').inputValue()) === ':TERMINAL' &&
		(await panel().getByLabel('Сделать').inputValue()) === 'fade' &&
		(await panel().getByLabel('До громкости, %').inputValue()) === '10'
);
check('открыть форму — текст не меняется', (await cmValue()) === value);
await win.screenshot({path: shot('link-form')});
await blur();
await panel().getByLabel('До громкости, %').fill('20');
await panel().getByLabel('До громкости, %').press('Enter');
await win.waitForTimeout(300);
value = await cmValue();
check('громкость 20 % → fadeto 0.2', value.includes('<<link "A">><<audio ":playing:not(:TERMINAL)" fadeto 0.2>><</link>>') || value.includes('<<link "A">>\n<<audio ":playing:not(:TERMINAL)" fadeto 0.2>>\n<</link>>'), value.slice(aAt, aAt + 120));
await blur();
await panel().getByLabel('Добавить действие').selectOption('set');
await win.waitForTimeout(300);
await panel().getByLabel('Переменная').selectOption('ambientplaying');
await panel().getByLabel('Значение').fill('1');
await win.waitForTimeout(300);
await blur();
await panel().getByRole('button', {name: 'Выше'}).nth(1).click();
await win.waitForTimeout(300);
await panel().getByLabel('После действий перейти на экран').selectOption('Start');
await win.waitForTimeout(300);
await blur();
await panel().getByLabel('Ссылка или кнопка').selectOption('button');
await win.waitForTimeout(300);
value = await cmValue();
check(
	'действия по порядку, переход, кнопка',
	value.includes('<<button "A" "Start">>\n<<set $ambientplaying to 1>>\n<<audio ":playing:not(:TERMINAL)" fadeto 0.2>>\n<</button>>'),
	value.slice(aAt, aAt + 160)
);
check('остальной текст экрана не тронут', value.slice(0, aAt) === (await cmValue()).slice(0, aAt));
await panel().getByRole('button', {name: 'Готово'}).click();

// 2. «Действие» на выделенный текст в новом экране: окно, таймер, стоп, звук.
await win.locator('.passage-edit-contents').first().waitFor();
await openPassage('Texttests');
await cmSet('Привет', [0, 6]);
await btn(/^Действие$/).click();
await win.waitForTimeout(400);
check('«Действие»: выделенный текст стал ссылкой, форма открыта', (await cmValue()) === '<<link "Привет">><</link>>' && (await panel().locator('strong').textContent()) === 'Ссылка', await cmValue());
await blur();
await panel().getByLabel('Добавить действие').selectOption('dialog');
await win.waitForTimeout(400);
await panel().getByLabel('Заголовок окна').fill('Справка');
await panel().getByLabel('Что внутри окна').selectOption('passage');
await panel().getByLabel('Пассаж').selectOption('PRCDRESULT');
await win.waitForTimeout(300);
await blur();
await panel().getByLabel('Добавить действие').selectOption('timer');
await win.waitForTimeout(300);
await panel().getByLabel('Имя таймера').fill('Т1');
await panel().getByLabel('Что по окончании').selectOption('goto');
await panel().getByLabel('Перейти на экран', {exact: true}).selectOption('Start');
await win.waitForTimeout(300);
await blur();
await panel().getByLabel('Добавить действие').selectOption('stop');
await win.waitForTimeout(300);
await panel().getByLabel('Имя таймера').nth(1).fill('Т1');
await blur();
await panel().getByLabel('Добавить действие').selectOption('audio');
await win.waitForTimeout(300);
await panel().getByLabel('Что звучит').selectOption('group');
await panel().getByLabel('Группа').selectOption(':RADIO');
await panel().getByLabel('Сделать').selectOption('pause');
await win.waitForTimeout(400);
value = await cmValue();
check(
	'окно, таймер, остановка, звук — командами',
	value ===
		'<<link "Привет">>\n<<sg-open "Справка" passage "PRCDRESULT">><</sg-open>>\n<<sg-timer "Т1" minutes 1 seconds 0 goto "Start" passage "" hidden>>\n<<sg-timer-stop "Т1">>\n<<audio ":RADIO" pause>>\n<</link>>' ||
		value ===
			'<<link "Привет">>\n<<sg-open "Справка" passage "PRCDRESULT">><</sg-open>>\n<<sg-timer "Т1" minutes 1 seconds 0 goto "Start" hidden>>\n<<sg-timer-stop "Т1">>\n<<audio ":RADIO" pause>>\n<</link>>',
	JSON.stringify(value)
);
await win.screenshot({path: shot('actions')});
await panel().getByRole('button', {name: 'Готово'}).click();
await win.waitForTimeout(1500);

let saved = storyFile();

check('движок 19 поставлен сам (команды движка в действиях)', saved.includes('Версия движка: 19'));
check('PRCDTEST: окна <<script>> → <<sg-open>>', saved.includes('<<sg-open "Процедура 001" passage "PRCDRESULT">><</sg-open>>') && !saved.includes("Dialog.create('Процедура"));

// 3. [[…]] остаётся разметкой, пока хватает.
const markup = '[[Назад|Start]]\n';

await cmSet(markup, [0, 0]);
await win.waitForTimeout(400);
await cmClick(4);
check('щелчок по [[…]]: форма, переход Start', (await panel().getByLabel('После действий перейти на экран').inputValue()) === 'Start');
await blur();
await panel().getByLabel('Добавить действие').selectOption('set');
await win.waitForTimeout(300);
await panel().getByLabel('Переменная').selectOption('PRCD');
await panel().getByLabel('Значение').fill('2');
await win.waitForTimeout(300);
check('одно изменение переменной — [[…][…]]', (await cmValue()) === '[[Назад|Start][$PRCD to 2]]\n', await cmValue());
await blur();
await panel().getByLabel('Добавить действие').selectOption('audio');
await win.waitForTimeout(300);
check('второе действие — команда <<link>>', (await cmValue()).startsWith('<<link "Назад" "Start">>\n<<set $PRCD to 2>>\n<<audio '), await cmValue());
await panel().getByRole('button', {name: 'Готово'}).click();

// 4. Условие: «выключена» и «не равна».
await cmSet('Журнал: не найден', [0, 17]);
await btn(/^Условие$/).click();
await win.waitForTimeout(400);
await panel().getByLabel('Переменная', {exact: true}).selectOption('radioplaying');
await panel().getByLabel('Когда').selectOption('off');
await win.waitForTimeout(300);
check('условие «выключена» — not $x', (await cmValue()) === '<<if not $radioplaying>>Журнал: не найден<</if>>', await cmValue());
await panel().getByLabel('Когда').selectOption('ne');
await panel().getByLabel('Значение').fill('2');
await win.waitForTimeout(300);
check('условие «не равна» — isnot', (await cmValue()) === '<<if $radioplaying isnot 2>>Журнал: не найден<</if>>', await cmValue());
await panel().getByRole('button', {name: 'Готово'}).click();

// 5. Предпросмотр экрана со ссылкой и действиями — без ошибок.
await cmSet('<<link "Окно">><<sg-open "Справка">>Текст<</sg-open>><</link>> <<if not $radioplaying>>ВЫКЛ<</if>>', [0, 0]);
await win.waitForTimeout(1500);
await btn(/^Предпросмотр$/).click();
await win.waitForSelector('.signaly-passage-preview');
await win.waitForTimeout(4000);
const frame = await (await win.locator('.signaly-passage-preview iframe').elementHandle()).contentFrame();

await frame.click('#passages a');
await win.waitForTimeout(600);
const shown = await frame.evaluate(() => ({
	text: document.querySelector('#passages').innerText,
	dialog: document.querySelector('#ui-dialog-title')?.textContent,
	errors: document.querySelectorAll('#passages .error').length
}));
check('предпросмотр: ссылка открывает окно, условие работает', shown.dialog === 'Справка' && shown.text.includes('ВЫКЛ') && shown.errors === 0, JSON.stringify(shown));
await win.screenshot({path: shot('preview')});
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
