// Проверка программы (Electron), сессия 12, шаг 3.4: окно «Коды».
// Шаблон build-13 (движок 8): кнопка «Коды» на вкладке «История», вкладки
// «Коды», «Сотрудники», «Тексты ошибок»; сотрудники (повтор личного кода не
// даёт сохранить), код с правами, «для каждого», прогресс вводящего, ответ с
// «кто ввёл», код для всех; «Сохранить» — пассаж «Коды» (тег sg-codes), движок
// 9; повторно — таблица из пассажа. Форма поля кода: галочка «Проверять по
// общей таблице кодов» → слово table, окно показывает экран с таким полем.
// Запуск: TWEE=<шаблон build-13> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-codes.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-codes-'));
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

check('в истории движок 8', storyFile().includes('Версия движка: 8'));

const openCodes = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await win.locator('.route-toolbar').getByRole('button', {name: 'Коды'}).click();
	await win.waitForTimeout(800);
};

await openCodes();

const dlg = win.locator('[role=dialog][aria-label="Коды"]');
const items = async () => (await dlg.locator('.signaly-kinds-item').allTextContents()).map(s => s.trim());
const tab = name => dlg.getByRole('tab', {name});

check('окно «Коды»: три вкладки, кодов нет', (await tab('Коды').count()) === 1 && (await tab('Сотрудники').count()) === 1 && (await tab('Тексты ошибок').count()) === 1 && (await items()).length === 0);
check('подсказка: ни одно поле ещё не проверяет по таблице', (await dlg.textContent()).includes('Пока ни одно поле кода не проверяет по таблице'));

// Сотрудники.
await tab('Сотрудники').click();
await dlg.getByRole('button', {name: 'Добавить сотрудника'}).click();
await win.waitForTimeout(200);
await dlg.getByLabel('Личный код').fill('417');
await dlg.getByLabel('Номер или имя').fill('3');
await dlg.getByLabel('Переменная прогресса').fill('progress3');
await dlg.getByRole('button', {name: 'Добавить сотрудника'}).click();
await win.waitForTimeout(200);
await dlg.getByLabel('Личный код').fill('417');
await win.waitForTimeout(200);
check('повтор личного кода — предупреждение, «Сохранить» недоступна', (await dlg.textContent()).includes('Повторяются личные коды: 417') && (await dlg.getByRole('button', {name: 'Сохранить'}).isDisabled()));
await dlg.getByLabel('Личный код').fill('101');
await dlg.getByLabel('Номер или имя').fill('Иванов');
await dlg.getByLabel('Переменная прогресса').fill('ivanov');
await win.waitForTimeout(200);
check('сотрудники в списке', (await items()).join('|') === '4173$progress3|101Иванов$ivanov', (await items()).join('|'));
check('новая переменная — пояснение', (await dlg.textContent()).includes('Переменной $ivanov нет в окне «Переменные»'));

// Коды.
await tab('Коды').click();
await dlg.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(200);
await dlg.getByLabel('Код', {exact: true}).fill('100');
await dlg.getByLabel('Подпись').fill('Для всех');
check('код для всех — «одним шагом»', (await dlg.textContent()).includes('Код вводится одним шагом'));
await dlg.getByLabel('Заголовок окна').fill('Принято');
await dlg.getByRole('button', {name: 'Вставить: введённый код'}).click();

await dlg.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(200);
await dlg.getByLabel('Код', {exact: true}).fill('200');
await dlg.getByLabel('Подпись').fill('Конверт');
await dlg.getByLabel('Кто может ввести').selectOption('some');
await win.waitForTimeout(200);
await dlg.getByLabel('Иванов').check();
await dlg.getByLabel('Одноразовый').selectOption('each');
await win.waitForTimeout(200);
check('код с правами — «спросит личный код»', (await dlg.textContent()).includes('Терминал спросит личный код во втором поле'));
check('в списке действий есть «Прогресс вводящего +N»', (await dlg.getByLabel('Добавить действие').locator('option', {hasText: 'Прогресс вводящего +N'}).count()) === 1);
await dlg.getByLabel('Добавить действие').selectOption('progress');
await win.waitForTimeout(200);
await dlg.getByLabel('Заголовок окна').fill('Конверт');
await dlg.getByLabel('Текст ответа').fill('Сотрудник');
await dlg.getByRole('button', {name: 'Вставить: кто ввёл'}).click();
await win.waitForTimeout(200);
check('ответ: вставка «кто ввёл»', (await dlg.getByLabel('Текст ответа').inputValue()) === 'Сотрудник <<= _who>>');
await dlg.getByLabel('Свой текст «Код уже использован»').fill('Уже открыт');
check('список кодов', (await items()).join('|') === '100Для всех|200Конвертраз у каждого', (await items()).join('|'));

// Повтор кода — сохранить нельзя.
await dlg.getByLabel('Код', {exact: true}).fill('100');
await win.waitForTimeout(200);
check('повтор кода — предупреждение, «Сохранить» недоступна', (await dlg.textContent()).includes('Повторяются коды: 100') && (await dlg.getByRole('button', {name: 'Сохранить'}).isDisabled()));
await dlg.getByLabel('Код', {exact: true}).fill('200');
await win.waitForTimeout(200);
await win.screenshot({path: shot('codes')});

await tab('Тексты ошибок').click();
await win.waitForTimeout(200);
check('тексты ошибок по умолчанию', (await dlg.getByLabel('Неверный код', {exact: true}).inputValue()) === 'Неверный код' && (await dlg.getByLabel('Код уже использован').inputValue()) === 'Пусто' && (await dlg.getByLabel('Подсказка второго поля').inputValue()) === 'Введите личный код');
await dlg.getByLabel('Нет доступа').fill('Доступ запрещён');
await win.screenshot({path: shot('texts')});

await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);

const file = storyFile();
const at = file.indexOf('name="Коды"');
const tag = /<tw-passagedata[^>]*name="Коды"[^>]*>/.exec(file)?.[0] ?? '';
const text = at === -1 ? '' : file.slice(file.indexOf('>', at) + 1, file.indexOf('</tw-passagedata>', at));

check('пассаж «Коды» с тегом sg-codes', /tags="sg-codes"/.test(tag), tag);
check('движок 14', file.includes('Версия движка: 14'));
check(
	'в пассаже: тексты, сотрудники, коды',
	text.includes('<<sg-replies title "Ошибка" wrong "Неверный код" denied "Доступ запрещён" badpin "Неверный личный код" used "Пусто" ask "Введите личный код">>') &&
		text.includes('<<sg-person "3" pin "417" var "$progress3">>\n<<sg-person "Иванов" pin "101" var "$ivanov">>') &&
		text.includes('<<sg-entry "100" "Для всех" title "Принято">>\n<<sg-answer>><<= _code>>\n<</sg-entry>>') &&
		text.includes('<<sg-entry "200" "Конверт" who "3, Иванов" once each title "Конверт" used "Уже открыт">>\n<<sg-progress 1>>\n<<sg-answer>>Сотрудник <<= _who>>\n<</sg-entry>>'),
	text
);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);
check('пассаж виден на карте', (await win.locator('.passage-card h2', {hasText: /^Коды$/}).count()) === 1);

await openCodes();
check('повторно: таблица из пассажа', (await items()).join('|') === '100Для всех|200Конвертраз у каждого' && (await dlg.textContent()).includes('Сохранено'), (await items()).join('|'));
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Форма поля кода: галочка «Проверять по общей таблице кодов» */
const openPassage = async name => {
	while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
		await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
		await win.waitForTimeout(600);
	}
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: new RegExp(`^${name}$`)})}).dblclick();
	await win.waitForSelector('.signaly-format-toolbar');
	await win.waitForTimeout(800);
};
const cmValue = () => win.evaluate(() => document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getValue());
const cmClick = async index => {
	const pos = await win.evaluate(i => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const p = cm.getDoc().posFromIndex(i);

		cm.scrollIntoView(p, 60);
		const c = cm.charCoords(p, 'window');

		return {x: c.left + 2, y: (c.top + c.bottom) / 2};
	}, index);

	await win.mouse.click(pos.x, pos.y);
	await win.waitForTimeout(400);
};
const panel = () => win.locator('.signaly-block-panel');

await openPassage('INPUTTEST');

let value = await cmValue();

await cmClick(value.indexOf('<<sg-code') + 4);
check('форма поля кода: галочка «Проверять по общей таблице кодов»', (await panel().getByLabel('Проверять по общей таблице кодов').count()) === 1 && !(await panel().getByLabel('Проверять по общей таблице кодов').isChecked()));
await win.evaluate(() => document.activeElement && document.activeElement.blur());
await win.waitForTimeout(400);
await panel().getByLabel('Проверять по общей таблице кодов').check();
await win.waitForTimeout(600);
value = await cmValue();
check('в тексте: <<sg-code var "$inputCode" button "Подтвердить" table>>', value.includes('<<sg-code var "$inputCode" button "Подтвердить" table>>\n<<sg-case "11111" goto "gotoPSG">>'), value.slice(value.indexOf('<<sg-code'), value.indexOf('<<sg-code') + 120));
await win.screenshot({path: shot('field')});
await win.waitForTimeout(1500);
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}

await openCodes();
check('окно показывает экран с таким полем', (await dlg.textContent()).includes('По таблице проверяют поля кода на экранах: INPUTTEST'));
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
