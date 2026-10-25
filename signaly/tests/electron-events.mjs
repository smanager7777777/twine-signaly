// Проверка программы (Electron), сессия 13, шаг 3.5: события.
// Шаблон build-14 (движок 9) + пассаж «Коды» (сотрудник 2, код 101).
// Кнопка «Событие» на панели над текстом: первая строка <<sg-event …>>, тег
// sg-event, форма (строки условия — заходы на экран и «сотрудник ввёл код»,
// «Повторять», задержка, важность), щелчок по команде открывает форму,
// «Убрать событие»; движок 10. Действие «Вернуться на экран, где были»;
// «Значение» — число заходов; «Условие» — заходы; окно «Коды» — код из
// условия спрашивает личный код.
// Запуск: TWEE=<шаблон build-14> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-events.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-events-'));
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
		'\n:: Коды [sg-codes] {"position":"0,1200","size":"100,100"}\n<<sg-person "2" pin "222">>\n<<sg-entry "101" "Конверт 1">>\n<<sg-answer>>\n<</sg-entry>>\n'
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

check('в истории движок 9', storyFile().includes('Версия движка: 9'));

const closeDialogs = async () => {
	while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
		await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
		await win.waitForTimeout(600);
	}
};
const openPassage = async name => {
	await closeDialogs();
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: new RegExp(`^${name}$`)})}).dblclick();
	await win.waitForSelector('.signaly-format-toolbar');
	await win.waitForTimeout(800);
};
const cm = (fn, arg) => win.evaluate(([f, a]) => new Function('cm', 'a', f)(document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror, a), [fn, arg]);
const cmValue = () => cm('return cm.getValue()');
const cmClick = async index => {
	const pos = await cm(
		'const p = cm.getDoc().posFromIndex(a); cm.scrollIntoView(p, 60); const c = cm.charCoords(p, "window"); return {x: c.left + 2, y: (c.top + c.bottom) / 2};',
		index
	);

	await win.mouse.click(pos.x, pos.y);
	await win.waitForTimeout(400);
};
const blur = async () => {
	await win.evaluate(() => document.activeElement && document.activeElement.blur());
	await win.waitForTimeout(300);
};
const panel = () => win.locator('.signaly-block-panel');
const toolbar = () => win.locator('.signaly-format-toolbar');
// Теги в окне пассажа свёрнуты («Tags (1)») — смотрим в файл истории.
const tags = async () => {
	await win.waitForTimeout(1500);
	return passageIn(storyFile(), 'Admin').tag;
};

/* 1. Событие */
await openPassage('Admin');
await toolbar().getByRole('button', {name: 'Событие'}).click();
await win.waitForTimeout(800);

let value = await cmValue();

check('«Событие»: первая строка <<sg-event $…>>', /^<<sg-event \$\w+>>/.test(value), value.slice(0, 80));
check('форма «Событие» открыта', (await panel().getAttribute('aria-label')) === 'Событие');
check('тег sg-event у пассажа', /tags="sg-event"/.test(await tags()), await tags());

const what = () => panel().getByLabel('Что проверять');

check('«Что проверять»: переменная, заходы, сотрудник ввёл код', (await what().first().locator('option').allTextContents()).join('|') === 'Переменная|Заходы на экран|Сотрудник ввёл код');
await blur();
await what().first().selectOption('visits');
await win.waitForTimeout(300);
await panel().getByLabel('Экран').selectOption('Start');
await panel().getByLabel('Когда').first().selectOption('ge');
await win.waitForTimeout(300);
await panel().getByLabel('Сколько раз').fill('3');
await panel().getByRole('button', {name: 'Добавить условие'}).click();
await win.waitForTimeout(300);
await what().nth(1).selectOption('entered');
await win.waitForTimeout(300);
check('сотрудники и коды — из окна «Коды»', (await panel().getByLabel('Сотрудник').locator('option').allTextContents()).join('|') === '2' && (await panel().getByLabel('Код', {exact: true}).locator('option').allTextContents()).join('|') === '101 — Конверт 1');
await panel().getByLabel('Повторять — когда условие снова станет верным').check();
await panel().getByLabel('Через сколько секунд после того, как условие стало верным').fill('2');
await panel().getByLabel('Важность').fill('1');
await win.waitForTimeout(600);
value = await cmValue();

const head = '<<sg-event repeat delay 2 priority 1 setup.visits("Start") gte 3 and setup.entered("2", "101")>>';

check('в тексте: повтор, задержка, важность, заходы, код сотрудника', value.startsWith(head + '\n'), value.slice(0, 140));
await win.screenshot({path: shot('event')});

await panel().getByRole('button', {name: 'Готово'}).click().catch(() => {});
await win.waitForTimeout(400);
check('форма закрыта', (await panel().count()) === 0);
await cmClick(5);
check('щелчок по команде события открывает форму', (await panel().getAttribute('aria-label')) === 'Событие' && (await panel().getByLabel('Важность').inputValue()) === '1');

await blur();
await panel().getByRole('button', {name: 'Убрать событие'}).click();
await win.waitForTimeout(800);
value = await cmValue();
check('«Убрать событие»: команда и тег убраны', !value.includes('<<sg-event') && !/sg-event/.test(await tags()), `${value.slice(0, 60)} ${await tags()}`);

await toolbar().getByRole('button', {name: 'Событие'}).click();
await win.waitForTimeout(600);
await blur();
await what().first().selectOption('visits');
await win.waitForTimeout(300);
await panel().getByLabel('Экран').selectOption('Start');
await win.waitForTimeout(600);

/* 2. Действие «Вернуться на экран, где были» */
await cm('cm.setValue(cm.getValue() + "\\nНазад"); const n = cm.getValue().length; cm.setSelection(cm.posFromIndex(n - 5), cm.posFromIndex(n));');
await win.waitForTimeout(400);
await toolbar().getByRole('button', {name: 'Действие'}).click();
await win.waitForTimeout(600);
await blur();
check('в списке действий есть «Вернуться на экран, где были»', (await panel().getByLabel('Добавить действие').locator('option', {hasText: 'Вернуться на экран, где были'}).count()) === 1);
await panel().getByLabel('Добавить действие').selectOption('back');
await win.waitForTimeout(600);
value = await cmValue();
check('в тексте: <<link "Назад">><<sg-back>><</link>>', value.includes('<<link "Назад">><<sg-back>><</link>>'), value.slice(-80));

/* 3. «Значение» — число заходов; «Условие» — заходы */
await cm('cm.setValue(cm.getValue() + "\\n"); cm.setCursor(cm.posFromIndex(cm.getValue().length));');
await win.waitForTimeout(300);
await toolbar().getByRole('button', {name: 'Добавить блок'}).click();
await win.locator('.menu-button-menu').getByText('Значение переменной').click();
await win.waitForTimeout(600);
await blur();
await panel().getByLabel('Что показывать').selectOption('visits');
await win.waitForTimeout(300);
await panel().getByLabel('Экран').selectOption('Start');
await panel().getByLabel('Подпись').fill('Заходов');
await win.waitForTimeout(600);
value = await cmValue();
check('«Значение»: число заходов на экран', value.includes('<span class="sg-value">Заходов: <<= setup.visits("Start")>></span>'), value.slice(-100));

await cm('cm.setValue(cm.getValue() + "\\nТекст"); const n = cm.getValue().length; cm.setSelection(cm.posFromIndex(n - 5), cm.posFromIndex(n));');
await win.waitForTimeout(400);
await toolbar().getByRole('button', {name: 'Условие'}).click();
await win.waitForTimeout(600);
await blur();
await what().first().selectOption('visits');
await win.waitForTimeout(300);
await panel().getByLabel('Экран').selectOption('Start');
await panel().getByLabel('Когда').first().selectOption('off');
await win.waitForTimeout(600);
value = await cmValue();
check('«Условие»: не был на экране', value.includes('<<if setup.visits("Start") is 0>>Текст<</if>>'), value.slice(-80));
await win.waitForTimeout(1500);
await closeDialogs();
await win.waitForTimeout(1000);

const file = storyFile();
const admin = passageIn(file, 'Admin');

check('движок 10', file.includes('Версия движка: 10'));
check('в истории: пассаж Admin с тегом sg-event и командой первой строкой', /tags="sg-event"/.test(admin.tag) && admin.text.startsWith('<<sg-event setup.visits("Start") gt 0'), `${admin.tag} ${admin.text.slice(0, 80)}`);

/* 4. Окно «Коды»: код из условия спрашивает личный код */
await openPassage('Admin');
await cm('cm.setValue(cm.getValue() + "\\n<<if setup.entered(\\"2\\", \\"101\\")>>да<</if>>");');
await win.waitForTimeout(2500);
await closeDialogs();
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('.route-toolbar').getByRole('button', {name: 'Коды'}).click();
await win.waitForTimeout(800);

const dlg = win.locator('[role=dialog][aria-label="Коды"]');

check('окно «Коды»: код из условия — «спросит личный код»', (await dlg.textContent()).includes('этот код есть в условии «сотрудник ввёл код»'));
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
