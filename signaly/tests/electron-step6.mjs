// Проверка программы (Electron), сессия 23, этап 6: «Раскрытие по щелчку», блок
// «Кнопка-перебор», галочка «Приглушить на время файла» у звука-сигнала.
// Запуск: TWEE=<шаблон build-24: git show b633a9d:…> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-step6.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-step6-'));
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
:: Пульт {"position":"100,1500","size":"100,100"}
Секретные данные и ссылка [[Дальше|Тумблер]]

:: Тумблер {"position":"250,1500","size":"100,100"}
Текст над кнопкой

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




/* Раскрытие по щелчку */
await openPassage('Пульт');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setSelection({line: 0, ch: 0}, {line: 0, ch: 16});
	cm.focus();
});
await toolbar().getByRole('button', {name: 'Эффект', exact: true}).click();
await win.locator('.menu-button-menu').getByText('Раскрытие по щелчку').click();
await win.waitForTimeout(1800);

let value = await editorText();
const plain = '<span id="sg-reveal1"><<button "[РАСШИФРОВАТЬ]">><<replace "#sg-reveal1">>Секретные данные<</replace>><</button>></span> и ссылка [[Дальше|Тумблер]]';

check('выделенный текст стал текстом раскрытия', value === plain, value);
check('форма открылась', (await panel().getByLabel('Надпись', {exact: true}).inputValue()) === '[РАСШИФРОВАТЬ]');
await fill('Надпись', '[ОТКРЫТЬ "ДАННЫЕ"]');
value = await editorText();
check('надпись пишется в команду', value.includes('<<button "[ОТКРЫТЬ \\"ДАННЫЕ\\"]">>'), value);
await select('Вид', 'amber');
value = await editorText();
check('вид ставится обёрткой', value.startsWith('<span id="sg-reveal1"><span class="amber"><<button'), value);
await select('Показывать', 'link');
value = await editorText();
check('кнопка меняется на ссылку', value.includes('<<link "[ОТКРЫТЬ') && value.includes('<</link></span>'.replace('<</link>', '<</link>>')), value);
await unfocus();
await panel().locator('textarea').fill('Другой текст');
await win.waitForTimeout(1500);
value = await editorText();
check('текст раскрытия правится в форме', value.includes('<<replace "#sg-reveal1">>Другой текст<</replace>>'), value);
await win.screenshot({path: shot('reveal-form')});
await select('Показывать', 'button');
await panel().getByRole('button', {name: /Закрыть/}).first().click().catch(() => {});
await win.waitForTimeout(400);
await win.locator('.CodeMirror .signaly-block-mark').first().click({position: {x: 10, y: 5}});
await win.waitForTimeout(800);
check('щелчок по команде открывает форму раскрытия, а не ссылки', (await panel().getByLabel('Надпись', {exact: true}).inputValue()) === '[ОТКРЫТЬ "ДАННЫЕ"]' && (await panel().getByLabel('Показывать', {exact: true}).count()) === 1);

await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);

let frame = win.frameLocator('.signaly-passage-preview iframe');

await frame.locator('button', {hasText: 'ОТКРЫТЬ'}).click();
await win.waitForTimeout(400);
check('в предпросмотре щелчок открывает текст', (await frame.locator('.passage').innerText()).includes('Другой текст'));
await win.screenshot({path: shot('reveal-preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).first().click();
await win.waitForTimeout(500);

/* Кнопка-перебор */
await openPassage('Тумблер');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: 0, ch: 17});
	cm.focus();
});
await toolbar().getByRole('button', {name: /Добавить блок/}).click();
await win.screenshot({path: shot('menu')});
await win.locator('.menu-button-menu').getByText('Кнопка-перебор').click();
await win.waitForTimeout(1800);
value = await editorText();
check(
	'блок вставлен с заготовкой',
	value.includes('<<sg-pick var "$switch1" form button>>\n<<sg-opt "ВЫКЛ" 0>>\n<<sg-opt "ВКЛ" 1>>\n<<sg-opt "АВТО" 2>>\n<</sg-pick>>'),
	value
);
check('форма блока открылась', (await panel().getByText('Кнопка-перебор', {exact: true}).count()) > 0);

const moved = storyFile();

check('движок 21 поставлен', moved.includes('Версия движка: 21'));

await fill('Переменная', '$mode');
await select('Вид', 'amber');
await unfocus();
await panel().getByRole('button', {name: 'Добавить значение'}).click();
await win.waitForTimeout(1500);
await unfocus();
await panel().getByLabel('Надпись', {exact: true}).last().fill('РЕЗЕРВ');
await win.waitForTimeout(1500);
await unfocus();
await panel().getByRole('button', {name: 'Выше'}).last().click();
await win.waitForTimeout(1500);
value = await editorText();
check(
	'форма пишет переменную, вид и значения',
	value.includes('<<sg-pick var "$mode" form button kind amber>>\n<<sg-opt "ВЫКЛ" 0>>\n<<sg-opt "ВКЛ" 1>>\n<<sg-opt "РЕЗЕРВ" 3>>\n<<sg-opt "АВТО" 2>>\n<</sg-pick>>'),
	value
);
await win.screenshot({path: shot('pick-form')});
await unfocus();
await panel().getByLabel('Значение', {exact: true}).nth(1).fill('авто');
await win.waitForTimeout(1500);
await panel().getByLabel('Значение', {exact: true}).nth(1).fill('1');
await win.waitForTimeout(1500);
value = await editorText();
check('число остаётся числом', value.includes('<<sg-opt "ВКЛ" 1>>'), value);

await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);
frame = win.frameLocator('.signaly-passage-preview iframe');

const pick = frame.locator('.sg-pick button');

check('в предпросмотре кнопка видна', (await pick.innerText()) === 'ВЫКЛ');
await pick.click();
await win.waitForTimeout(300);
check('в предпросмотре щелчок даёт следующее значение', (await pick.innerText()) === 'ВКЛ');
await win.screenshot({path: shot('pick-preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).first().click();
await win.waitForTimeout(500);

await closeDialogs();
check('значения сохранились в истории', text('Тумблер').includes('<<sg-opt "РЕЗЕРВ" 3>>'));

/* Приглушение у звука-сигнала: через ссылку */
await openPassage('Пульт');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setValue('[[Дальше|Тумблер]]');
	cm.setCursor({line: 0, ch: 3});
	cm.focus();
});
await win.waitForTimeout(1500);
await win.locator('.CodeMirror-line').first().click({position: {x: 30, y: 5}});
await win.waitForTimeout(800);
await unfocus();
await panel().getByLabel('Добавить действие').selectOption('signal');
await win.waitForTimeout(1500);
await unfocus();
await panel().getByText('Приглушить на время файла').click();
await win.waitForTimeout(1500);
value = await editorText();
check('галочка пишет группу и 30 %', /<<sg-sound "[^"]*" volume 100 duck ":TERMINAL" to 30>>/.test(value), value);
await select('Что приглушить', ':AMBIENT');
await unfocus();

const duck = panel().getByRole('textbox', {name: /^Громкость на это время/});

await duck.fill('15');
await duck.press('Enter');
await win.waitForTimeout(1500);
value = await editorText();
check('группа и уровень пишутся', /duck ":AMBIENT" to 15>>/.test(value), value);
await win.screenshot({path: shot('duck-form')});
await select('Что приглушить', ':playing');
value = await editorText();
check('«Всё, что играет»', /duck ":playing" to 15>>/.test(value), value);
await panel().getByRole('button', {name: /Закрыть/}).first().click().catch(() => {});
await win.waitForTimeout(400);
await win.locator('.CodeMirror-line').first().click({position: {x: 30, y: 5}});
await win.waitForTimeout(800);
check('форма снова читает галочку', (await panel().getByLabel('Что приглушить', {exact: true}).inputValue()) === ':playing');
await unfocus();
await panel().getByText('Приглушить на время файла').click();
await win.waitForTimeout(1500);
value = await editorText();
check('снятая галочка убирает слова', /<<sg-sound "[^"]*" volume 100>>/.test(value), value);

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
