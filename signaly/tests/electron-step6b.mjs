// Проверка программы (Electron), сессия 24, этап 6, порция 2: галочка «Запомнить
// открытое» у раскрытия; блок «Значение» ставит движок и обновляется сам.
// Запуск: TWEE=<шаблон build-25: git show 8b80f1a:…> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-step6b.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-step6b-'));
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
Текст над значением

:: StoryInit-вторая {"position":"400,1500","size":"100,100"}
Пустой экран

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




check('в истории движок 20', storyFile().includes('Версия движка: 20'));

/* «Значение» ставит движок: обновляет значение он */
await openPassage('Тумблер');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setCursor({line: 0, ch: 19});
	cm.focus();
});
await add('Значение переменной');
await win.waitForTimeout(800);
await unfocus();
await fill('Подпись', 'Глава');
await win.waitForTimeout(800);
await win.screenshot({path: shot('value-form')});

const hint = await panel().innerText();

check('в форме сказано, что значение обновляется само', hint.includes('обновляется само'), hint);

let value = await editorText();

check('блок записан обычной командой', /<span class="sg-value">Глава: <<= \$\w*>><\/span>/.test(value), value);
await win.waitForTimeout(1500);
check('движок 25 поставлен сам', storyFile().includes('Версия движка: 25'));

/* Запомнить открытое */
await openPassage('Пульт');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setSelection({line: 0, ch: 0}, {line: 0, ch: 16});
	cm.focus();
});
await toolbar().getByRole('button', {name: 'Эффект', exact: true}).click();
await win.locator('.menu-button-menu').getByText('Раскрытие по щелчку').click();
await win.waitForTimeout(1800);
value = await editorText();

const plain = '<span id="sg-reveal1"><<button "[РАСШИФРОВАТЬ]">><<replace "#sg-reveal1">>Секретные данные<</replace>><</button>></span> и ссылка [[Дальше|Тумблер]]';

check('без галочки раскрытие прежнее', value === plain, value);
await select('Вид', 'amber');
await unfocus();
await panel().getByText('Запомнить открытое').click();
await win.waitForTimeout(1500);
value = await editorText();

const kept = '<<sg-reveal "sg-reveal1" "[РАСШИФРОВАТЬ]" kind "amber">>Секретные данные<</sg-reveal>> и ссылка [[Дальше|Тумблер]]';

check('галочка пишет команду движка', value === kept, value);
await win.waitForTimeout(600);
await win.screenshot({path: shot('keep-form')});

const form = await panel().innerText();

check('подсказка меняется', form.includes('до новой игры'), form);
check('форма осталась открытой', (await panel().getByLabel('Надпись', {exact: true}).inputValue()) === '[РАСШИФРОВАТЬ]');
await fill('Надпись', '[ОТКРЫТЬ "ДАННЫЕ"]');
value = await editorText();
check('надпись пишется', value.startsWith('<<sg-reveal "sg-reveal1" "[ОТКРЫТЬ \\"ДАННЫЕ\\"]" kind "amber">>'), value);
await select('Показывать', 'link');
value = await editorText();
check('ссылкой', value.startsWith('<<sg-reveal "sg-reveal1" "[ОТКРЫТЬ \\"ДАННЫЕ\\"]" link kind "amber">>'), value);
await select('Показывать', 'button');
await unfocus();
await panel().locator('textarea').fill('Другой текст');
await win.waitForTimeout(1500);
value = await editorText();
check('текст правится в форме', value.includes('>>Другой текст<</sg-reveal>>'), value);
await panel().getByRole('button', {name: /Закрыть/}).first().click().catch(() => {});
await win.waitForTimeout(400);
await win.locator('.CodeMirror .signaly-block-mark').first().click({position: {x: 10, y: 5}});
await win.waitForTimeout(800);
check('щелчок по команде открывает форму раскрытия', (await panel().getByLabel('Надпись', {exact: true}).inputValue()) === '[ОТКРЫТЬ "ДАННЫЕ"]');
check('галочка прочитана', await panel().getByLabel('Запомнить открытое').isChecked());

await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-passage-preview iframe');

await frame.locator('.amber button', {hasText: 'ОТКРЫТЬ'}).click();
await win.waitForTimeout(400);
check('в предпросмотре щелчок открывает текст', (await frame.locator('.passage').innerText()).includes('Другой текст'));
await win.screenshot({path: shot('keep-preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).first().click();
await win.waitForTimeout(500);

await unfocus();
await panel().getByText('Запомнить открытое').click();
await win.waitForTimeout(1500);
value = await editorText();
check('снятая галочка возвращает обычное раскрытие', value.startsWith('<span id="sg-reveal1"><span class="amber"><<button "[ОТКРЫТЬ \\"ДАННЫЕ\\"]">><<replace "#sg-reveal1">>Другой текст<</replace>><</button>></span></span>'), value);

await panel().getByRole('button', {name: /Закрыть/}).first().click().catch(() => {});
await win.waitForTimeout(400);

/* Значение в предпросмотре */
await openPassage('Тумблер');
await win.getByRole('button', {name: 'Предпросмотр'}).first().click();
await win.waitForTimeout(2500);

const preview = win.frames().find(f => f !== win.mainFrame() && f.parentFrame() === win.mainFrame());

await preview.evaluate(() => {
	const name = document.querySelector('.sg-value-now').getAttribute('data-sg-code').replace(/^.*\./, '');

	SugarCube.State.variables[name] = 'новое';
});
await win.waitForTimeout(500);
check('в предпросмотре значение тоже обновляется', (await frame.locator('.sg-value').innerText()).includes('новое'), await frame.locator('.passage').innerText());

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
