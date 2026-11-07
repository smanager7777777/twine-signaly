// Проверка программы (Electron), сессия 22, шаг 5.4: кнопка и форма «Подсказка»,
// перенос кода подсказки шаблона, раздел в оформлении, картинка-переключатель,
// звук первого посещения.
// Запуск: TWEE=<шаблон build-23: git show 2e57ad0:…> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-step54.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-step54-'));
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
Слово для подсказки

:: Тумблер {"position":"250,1500","size":"100,100"}
Текст над картинкой

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



/* Подсказка: кнопка на выделенном тексте */
check('до установки код подсказки в истории', storyFile().includes('/* hovertip v2.0 - Старт*/'));
await openPassage('Пульт');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setSelection({line: 0, ch: 0}, {line: 0, ch: 5});
	cm.focus();
});
await toolbar().getByRole('button', {name: 'Подсказка', exact: true}).click();
await win.waitForTimeout(1800);

let value = await editorText();

check('выделенное слово получило подсказку', value === '<<hovertip "Текст подсказки">>Слово<</hovertip>> для подсказки', value);
check('форма открылась', (await panel().getByText('Подсказка при наведении', {exact: true}).count()) > 0);

let moved = storyFile();

check('движок 26 поставлен', moved.includes('Версия движка: 26'));
check('код подсказки ушёл из JavaScript истории', !moved.includes('/* hovertip v2.0') && moved.includes('подсказка при наведении перенесена в движок'));
check('стили подсказки ушли из таблицы стилей', !/\n\.hoverBox \{/.test(moved) && moved.includes('вид подсказки — в «Оформлении терминала»'));

const areas = () => panel().locator('textarea');

await unfocus();
await areas().nth(0).fill('Сюда не "ходить"');
await win.waitForTimeout(1500);
await unfocus();
await areas().nth(1).fill('Два слова');
await win.waitForTimeout(1500);
await unfocus();

const width = panel().getByRole('textbox', {name: /^Ширина подсказки/});

await width.fill('250');
await width.press('Enter');
await win.waitForTimeout(1500);
value = await editorText();
check('форма пишет текст, ширину и слова на экране', value === '<<hovertip "Сюда не \\"ходить\\"" 250>>Два слова<</hovertip>> для подсказки', value);
await win.screenshot({path: shot('tip-form')});
await panel().getByRole('button', {name: /Закрыть/}).first().click().catch(() => {});
await win.waitForTimeout(400);
await win.locator('.CodeMirror .signaly-block-mark').first().click({position: {x: 10, y: 5}});
await win.waitForTimeout(800);
check('щелчок по команде открывает форму', (await areas().nth(0).inputValue()) === 'Сюда не "ходить"');

/* Предпросмотр */
await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-passage-preview iframe');

await frame.locator('#hoverTip1').hover();
await win.waitForTimeout(400);
check('в предпросмотре подсказка видна при наведении', (await frame.locator('#hoverTipTxt1').evaluate(b => getComputedStyle(b).visibility)) === 'visible');
await win.screenshot({path: shot('tip-preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(400);
await unfocus();
await panel().getByRole('button', {name: 'Убрать подсказку'}).click();
await win.waitForTimeout(1500);
value = await editorText();
check('«Убрать подсказку»: текст остался', value === 'Два слова для подсказки', value);
check('форма закрылась', (await panel().count()) === 0);

// Без выделения: образец.
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: 0, ch: 0});
	cm.focus();
});
await toolbar().getByRole('button', {name: 'Подсказка', exact: true}).click();
await win.waitForTimeout(1200);
value = await editorText();
check('без выделения вставляется образец', value.startsWith('<<hovertip "Текст подсказки">>текст<</hovertip>>'), value);

// Подсказка шаблона открывается, текст при этом не меняется.
await openPassage('Texttests');

const before = await editorText();

await win.locator('.CodeMirror .signaly-block-mark', {hasText: 'hovertip'}).first().click({position: {x: 10, y: 5}});
await win.waitForTimeout(800);
check('подсказка шаблона открылась в форме', (await areas().nth(0).inputValue()) === 'В меню терминала');
check('открытие формы текст не меняет', (await editorText()) === before);

/* Картинка-переключатель */
await openPassage('Тумблер');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: cm.lineCount() - 1, ch: 0});
});
await add('Картинка');
check('новая картинка без переключателя', !(await editorText()).includes('toggle'));

const toggle = panel().getByLabel('Переключатель: щелчок меняет картинку');

await unfocus();
await toggle.check();
await win.waitForTimeout(1500);
value = await editorText();
check('галочка заводит свободную переменную', value.includes('toggle "$switch1"'), value);
await win.screenshot({path: shot('toggle')});

const images = await panel().getByLabel('Вторая картинка (включено)', {exact: true}).locator('option').allTextContents();

await select('Вторая картинка (включено)', images[images.length - 1]);
await select('Файл', images[1]);
await unfocus();
await panel().getByLabel('Переменная', {exact: true}).fill('lamp');
await win.waitForTimeout(1500);

const sounds = await panel().getByLabel('Звук щелчка', {exact: true}).locator('option').allTextContents();

await select('Звук щелчка', sounds[1]);

const level = panel().getByRole('textbox', {name: /^Громкость звука/});

await unfocus();
await level.fill('70');
await level.press('Enter');
await win.waitForTimeout(1500);
value = await editorText();
check(
	'форма пишет вторую картинку, переменную, звук и громкость',
	value.includes(`second "${images[images.length - 1]}"`) && value.includes('toggle "$lamp"') && value.includes(`sound "${sounds[1]}"`) && value.includes('volume 70'),
	value
);

await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);

const shown = () => frame.locator('.passage img').first().getAttribute('src');
const first = await shown();

await frame.locator('.passage img').first().click({force: true});
await win.waitForTimeout(500);
check('в предпросмотре щелчок меняет картинку', (await shown()) !== first, await shown());
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(400);

await unfocus();
await toggle.uncheck();
await win.waitForTimeout(1500);
value = await editorText();
check('галочка снята: слова убраны', !/toggle|second|sound|volume/.test(value), value);

/* Оформление: подсказка и звук первого посещения */
await closeDialogs();
await win.getByRole('tab', {name: 'История'}).click();
await toolbarBtn(/Оформление/).click();
await win.waitForTimeout(1200);

const dlg = win.locator('[role=dialog][aria-label="Оформление терминала"]');

check('раздел «Подсказка при наведении»', (await dlg.getByRole('heading', {name: 'Подсказка при наведении'}).count()) === 1);
await dlg.locator('section', {hasText: 'Подсказка при наведении'}).scrollIntoViewIfNeeded();

const tipSection = dlg.locator('section', {hasText: 'Показать или убрать образец подсказки'});
const tipColor = async (index, code) => {
	const field = tipSection.getByRole('textbox', {name: 'Код цвета'}).nth(index);

	await field.fill(code);
	await field.press('Enter');
};

await tipColor(0, '#112233');
await tipColor(2, '#ff0000');

const radius = tipSection.getByRole('textbox', {name: /^Скругление углов/});

await radius.fill('12');
await radius.press('Enter');
await win.waitForTimeout(1200);

const look = win.frameLocator('[role=dialog][aria-label="Оформление терминала"] iframe');

await tipSection.getByRole('button', {name: 'Показать или убрать образец подсказки'}).click();
await win.waitForTimeout(500);
check('образец подсказки в предпросмотре', (await look.locator('#sg-tip-demo .hoverBox').count()) === 1);

const seen = await look.locator('#sg-tip-demo .hoverBox').evaluate(b => {
	const c = getComputedStyle(b);

	return [c.backgroundColor, c.borderTopColor, c.borderTopLeftRadius, c.visibility].join(' ');
});

check('образец меняется сразу', seen === 'rgb(17, 34, 51) rgb(255, 0, 0) 12px visible', seen);
await win.screenshot({path: shot('tip-sample')});
await tipSection.getByRole('button', {name: 'Показать или убрать образец подсказки'}).click();
await win.waitForTimeout(400);
check('второе нажатие убирает образец', (await look.locator('#sg-tip-demo').count()) === 0);

await dlg.getByRole('tab', {name: 'Первое посещение'}).click();
await win.waitForTimeout(400);
await dlg.getByRole('button', {name: 'Добавить', exact: true}).click();
await win.waitForTimeout(400);
check('у нового способа звука нет, громкости не видно', (await dlg.getByRole('textbox', {name: /^Громкость/}).count()) === 0);

const files = await dlg.getByLabel('Файл', {exact: true}).locator('option').evaluateAll(list => list.map(o => o.value));

await dlg.getByLabel('Файл', {exact: true}).selectOption(files[1]);
await win.waitForTimeout(300);

const volume = dlg.getByRole('textbox', {name: /^Громкость/});

await volume.fill('35');
await volume.press('Enter');
await win.waitForTimeout(300);
await win.screenshot({path: shot('first-sound')});
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(800);

const saved = storyFile();

check('вид подсказки в таблице стилей', saved.includes('--sg-tip-bg: #112233;') && saved.includes('--sg-tip-border-color: #ff0000;') && saved.includes('--sg-tip-radius: 12px;'));
const line = /--sg-first-[a-z0-9-]+: (noise [^;]*);/.exec(saved)?.[1] ?? '';
const words = line.split(' ');

check('звук способа в таблице стилей', words[11] === '35' && decodeURIComponent(words[12]) === files[1] && !/[ ()]/.test(words[12]), line);

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
