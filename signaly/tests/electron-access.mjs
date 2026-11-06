// Проверка программы (Electron), сессия 16, шаг 4.3: кнопка «Доступ», форма,
// список того, что ведёт на экран, поведение источников, общий пассаж
// блокировки, тег и цвет на карте, команда в тексте, «Убрать доступ»; ответ 7А:
// цвета поля ввода при наведении в окне оформления.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-access.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-access-'));
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
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $acOpen to false>>\n')
		.replace(/\s*$/, '\n') +
		`
:: Цель {"position":"100,1500","size":"100,100"}
Экран

:: Вход {"position":"200,1500","size":"100,100"}
[[Вперёд|Цель]]
<<button "Кнопка" "Цель">><</button>>
<<sg-timer "Часы" seconds 5 goto "Цель" hidden>>

:: Рано {"position":"300,1500","size":"100,100"}
Ещё слишком рано

:: Рано2 {"position":"400,1500","size":"100,100"}
Совсем рано

:: Коды [sg-codes] {"position":"500,1500","size":"100,100"}
<<sg-entry "205" "Конверт" goto "Цель">><</sg-entry>>
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
const text = () => passageIn(storyFile(), 'Цель').text;

/* Ответ 7А */
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('.route-toolbar').getByRole('button', {name: /Оформление/}).click();
await win.waitForTimeout(1200);
let dlg = win.locator('[role=dialog][aria-label="Оформление терминала"]');

check('поля при наведении: две новые строки в разделе', (await dlg.getByText('Цвет фона при наведении').count()) === 1 && (await dlg.getByText('Цвет рамки при наведении').count()) === 1);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Кнопка «Доступ» */
await openPassage('Цель');
await win.getByRole('button', {name: /^Доступ$/}).click();
await win.waitForTimeout(1800);
let t = text();

check('первая строка — команда, текст экрана остался', t.startsWith('<<sg-access>>$') && t.includes('<</sg-access>>\\\nЭкран'), t);
check('тег sg-access', /tags="[^"]*sg-access/.test(passageIn(storyFile(), 'Цель').tag), passageIn(storyFile(), 'Цель').tag);
check('цвет тега на карте', storyFile().includes('<tw-tag name="sg-access" color="red"'), storyFile().match(/<tw-tag[^>]*>/g));
check('форма открылась', (await panel().getByText('Экран открыт, когда').count()) === 1);
check('движок 19 поставлен', storyFile().includes('Версия движка: 19'));
check('кнопка показывает условие', (await win.getByRole('button', {name: /^Доступ: \$/}).count()) === 1);

/* Что ведёт на экран */
const rows = (await panel().locator('.signaly-field-label, label').allInnerTexts()).join('|');

check('в списке — ссылка, кнопка, код, таймер', ['Ссылка «Вперёд» на экране Вход', 'Кнопка «Кнопка» на экране Вход', '205 — Конверт', 'Таймер «Часы»'].every(s => rows.includes(s)), rows);
check('группы и значения по умолчанию', (await panel().getByLabel('Ссылки и кнопки', {exact: true}).inputValue()) === 'hide' && (await panel().getByLabel('Пароли и коды', {exact: true}).inputValue()) === 'block' && (await panel().getByLabel('Клавиши мастера', {exact: true}).inputValue()) === 'pass' && (await panel().getByLabel('Таймеры, тревога, цепочка видео', {exact: true}).inputValue()) === 'pass');

check('предупреждение: нет пассажа блокировки', (await panel().getByText('Пассаж блокировки не выбран').count()) === 1);
await select('Общий пассаж блокировки', 'Рано');
check('общий пассаж — тег sg-lock и цвет', /tags="[^"]*sg-lock/.test(passageIn(storyFile(), 'Рано').tag) && storyFile().includes('<tw-tag name="sg-lock" color="orange"'), passageIn(storyFile(), 'Рано').tag);
check('предупреждение ушло', (await panel().getByText('Пассаж блокировки не выбран').count()) === 0);
await select('Ссылки и кнопки', 'off');
check('поведение группы записано', text().includes('<<sg-access links off>>'), text());
await select('Ссылка «Вперёд» на экране Вход', 'block');
await select('Куда вести: Вперёд', 'Рано2');
check('поведение отдельной ссылки и свой пассаж', text().includes('<<sg-rule link "Вперёд" from "Вход" do block to "Рано2">>'), text());
await select('205 — Конверт', 'wrong');
check('поведение кода', text().includes('<<sg-rule code "205" do wrong>>'), text());
await select('Таймер «Часы»', 'stay');
check('поведение таймера', text().includes('<<sg-rule auto "timer:Часы" do stay>>'), text());
await select('Пассаж блокировки этого экрана', 'Рано2');
check('свой пассаж экрана', text().includes('lock "Рано2"'), text());
await win.screenshot({path: shot('access')});

/* Щелчок по команде в тексте открывает форму снова */
await closeDialogs();
await openPassage('Цель');
await win.waitForTimeout(500);
await win.getByRole('button', {name: /^Доступ/}).click();
await win.waitForTimeout(800);
check('форма читает всё обратно', (await panel().getByLabel('Ссылки и кнопки', {exact: true}).inputValue()) === 'off' && (await panel().getByLabel('205 — Конверт', {exact: true}).inputValue()) === 'wrong' && (await panel().getByLabel('Куда вести: Вперёд', {exact: true}).inputValue()) === 'Рано2' && (await panel().getByLabel('Общий пассаж блокировки', {exact: true}).inputValue()) === 'Рано');
await select('Ссылка «Вперёд» на экране Вход', '');
check('«как у всех» снимает правило', !text().includes('Вперёд'), text());
check('текст экрана не задет', text().endsWith('\\\nЭкран'), text());

/* Убрать */
await unfocus();
await panel().getByRole('button', {name: 'Убрать доступ'}).click();
await win.waitForTimeout(1800);
check('«Убрать доступ» возвращает текст и снимает тег', text().trim() === 'Экран' && !/sg-access/.test(passageIn(storyFile(), 'Цель').tag), text());
await closeDialogs();

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
