// Проверка программы (Electron), сессия 20, шаг 5.2: блок «Терминал взлома»,
// кнопка «Создать недостающие экраны», перенос «Хактеста». TWEE — шаблон build-21.
// Было: блок «Список состояний» —
// кнопки и плитка, состояния, таблица строк, «Добавить много строк», предпросмотр.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-hack.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-hack-'));
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
		`
:: Взлом {"position":"100,1500","size":"100,100"}
Экран взлома

:: Успех {"position":"200,1500","size":"100,100"}
Текст

:: Процедуры {"position":"300,1500","size":"100,100"}
Список
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
	await win.locator('.menu-button-menu').getByText(name).click();
	await win.waitForTimeout(1500);
};
const editorText = () => win.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());


/* Заготовка */
await openPassage('Взлом');
await add('Терминал взлома');
let value = await editorText();

check('команда в тексте', /<<sg-hack words "ОТСЕК/.test(value) && value.includes('<</sg-hack>>') && /columns 2/.test(value), value);
check('движок 24 поставлен', storyFile().includes('Версия движка: 24'));
check('квадратики и глитч в заготовке', /triesshow boxes/.test(value) && /usedglitch/.test(value), value);
await win.screenshot({path: shot('form')});

/* Слова */
await unfocus();
await panel().locator('textarea').first().fill('СТОЛ ДОМА\nПАРИЯ КУХНЯ СОННЯ ЧЕХИЯ ОТСЕК');
await win.waitForTimeout(1500);
value = await editorText();
check('слова записаны', value.includes('ПАРИЯ'), value);
check('форма считает длины', await panel().getByText('4 букв — 2, 5 букв — 5').count() > 0);
check('форма предупреждает о редкой длине', await panel().getByText(/Длина 4: слов меньше/).count() > 0);
await fill('Ключевое слово', 'ПАРИЯ');
check('ключевое слово', (await editorText()).includes('key "ПАРИЯ"'));
await fill('Ключевое слово', '');
check('пустое ключевое слово не пишется', !(await editorText()).includes('key '));

/* Столбцы и размер */
const number = async (label, value) => {
	await unfocus();

	const field = panel().getByRole('textbox', {name: new RegExp(`^${label}`)});

	await field.fill(value);
	await field.press('Enter');
	await win.waitForTimeout(1500);
};

await number('Столбцов', '3');
await number('Символов в строке', '40');
check('столбцы и символы', /columns 3/.test(await editorText()) && /cols 40/.test(await editorText()));
check('форма предупреждает: поле шире окна', await panel().getByText(/Поле шире окна/).count() > 0);
await number('Символов в строке', '20');
await number('Столбцов', '2');
check('предупреждение ушло', (await panel().getByText(/Поле шире окна/).count()) === 0);

/* Подсказка, попытки, ошибка */
await select('Где подсказка', 'left');
await select('Как показывать попытки', 'both');
await select('Эффект на экране', 'ripple');
await select('Крупная надпись', 'over');
value = await editorText();
check('места и реакция', /hint left/.test(value) && /triesshow both/.test(value) && /missfx ripple/.test(value) && /missplace over/.test(value), value);

/* Надпись по умолчанию не пишется */
await fill('Текст подсказки', '{совпало} из {всего}');
check('своя подсказка', (await editorText()).includes('hinttext "{совпало} из {всего}"'));
await fill('Текст подсказки', '{совпало}/{всего} ВЕРНО');
check('надпись по умолчанию не пишется', !(await editorText()).includes('hinttext'));
await panel().getByLabel('Текст вместо поля', {exact: true}).first().fill('Открыто / Пароль {слово}');
await win.waitForTimeout(1500);
check('две строки надписи', (await editorText()).includes('wintext "Открыто\\nПароль {слово}"'), await editorText());

/* Действия и переходы */
await select('После успеха перейти на экран', 'Успех');
check('экран успеха', (await editorText()).includes('win "Успех"'), await editorText());
await unfocus();
await panel().getByLabel('Добавить действие').first().selectOption({index: 1});
await win.waitForTimeout(1500);
check('действие при неверном слове', (await editorText()).includes('<<sg-hack-miss>>'), await editorText());
await win.screenshot({path: shot('form2')});

/* Предпросмотр */
await unfocus();
await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(3000);

const frame = win.frameLocator('.signaly-passage-preview iframe');

check('предпросмотр: поле взлома', (await frame.locator('.sg-hack-word').count()) === 5, String(await frame.locator('.sg-hack-word').count()));
check('предпросмотр: два столбца', (await frame.locator('.sg-hack-field > div').count()) === 2);
await frame.locator('.sg-hack-word').first().click();
await win.waitForTimeout(300);
check('предпросмотр: щелчок работает', (await frame.locator('.sg-hack-used, .sg-hack-final').count()) === 1);
await win.screenshot({path: shot('preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(600);

/* Недостающие экраны */
await openPassage('Процедуры');
await add('Список состояний: кнопки (процедуры)');
await number('Сколько строк', '12');
await panel().getByRole('button', {name: /^Добавить 12/}).click();
await win.waitForTimeout(1500);
await win.screenshot({path: shot('list')});
await panel().getByRole('button', {name: /Создать недостающие экраны \(11\)/}).click();
await win.waitForTimeout(2500);
await unfocus();
await closeDialogs();
await win.waitForTimeout(2000);

const file = storyFile();
const made = [...file.matchAll(/<tw-passagedata[^>]*name="PRCD(\d+)"/g)].length;

// PRCD001 уже есть в шаблоне.
check('созданы все экраны строк', ['003', '014'].every(n => file.includes(`name="PRCD${n}"`)) && made >= 12, String(made));
check('экраны разошлись сеткой', new Set([...file.matchAll(/name="PRCD\d+"[^>]*position="([\d.,]+)"/g)].map(m => m[1])).size === made);
await win.screenshot({path: shot('map')});

/* Перенос шаблона */
check('«Хактест» стал блоком', /<<sg-hack words "ЧЕХИЯ/.test(passageIn(file, 'Хактест').text) && !passageIn(file, 'Хактест').text.includes('<<script>>'), passageIn(file, 'Хактест').text.slice(0, 200));
check('блок взлома сохранён', passageIn(file, 'Взлом').text.includes('win "Успех"'));

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
