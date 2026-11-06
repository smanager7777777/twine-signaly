// Проверка программы (Electron), сессия 18, шаг 4.5: вкладка «Первое посещение»
// окна оформления, «Показать», кнопка над текстом, предпросмотр экрана; галочка
// «Только цифры» у поля кода; метка «ДЕШИФРАТОР» и фильтр в окне «Коды».
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-first.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-first-'));
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
:: Цель {"position":"100,1500","size":"100,100"}
Первая строка
Вторая строка
[[Меню]]

:: Меню {"position":"200,1500","size":"100,100"}
ДЕШИФРАТОР
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

/* Оформление: вкладка «Первое посещение» */
await toolbarBtn(/Оформление/).click();
await win.waitForTimeout(1200);

const dlg = win.locator('[role=dialog][aria-label="Оформление терминала"]');

await dlg.getByRole('tab', {name: 'Первое посещение'}).click();
await win.waitForTimeout(400);
check('вкладка: способов нет', (await dlg.getByText('Способов пока нет').count()) === 1);
await dlg.getByRole('button', {name: 'Добавить', exact: true}).click();
await win.waitForTimeout(400);
await dlg.getByLabel('Название', {exact: true}).fill('Шум');
check('новый способ — из белого шума', (await dlg.getByLabel('Как возникают элементы', {exact: true}).inputValue()) === 'noise');
await dlg.getByLabel('Ссылки и кнопки', {exact: true}).selectOption('now');
await dlg.getByLabel('Картинки и видео', {exact: true}).selectOption('glitch');
const time = dlg.getByRole('textbox', {name: /^Сколько возникает один элемент/});

await time.fill('2');
await time.press('Enter');
await win.waitForTimeout(300);
check('сила и цвет видны для шума', (await dlg.getByRole('textbox', {name: /^Сила шума и помех/}).count()) === 1 && (await dlg.getByText('Цвет шума и полос помех').count()) >= 1);
await dlg.getByRole('button', {name: 'Копировать', exact: true}).click();
await win.waitForTimeout(400);
await dlg.getByLabel('Название', {exact: true}).fill('Плавно');
await dlg.getByLabel('Как возникают элементы', {exact: true}).selectOption('fade');
await dlg.getByLabel('Ссылки и кнопки', {exact: true}).selectOption('');
await dlg.getByLabel('Картинки и видео', {exact: true}).selectOption('');
await win.waitForTimeout(300);
check('для плавного появления силы и цвета нет', (await dlg.getByRole('textbox', {name: /^Сила шума и помех/}).count()) === 0);
await dlg.locator('.signaly-kinds-item', {hasText: 'Шум'}).click();
await win.waitForTimeout(300);

// «Показать» на выбранном экране.
await dlg.locator('.signaly-appearance-preview-bar select, select').last().selectOption({label: 'Цель'}).catch(() => {});
await win.waitForTimeout(2500);

const frame = win.frameLocator('[role=dialog][aria-label="Оформление терминала"] iframe');

await dlg.getByRole('button', {name: 'Показать первое посещение'}).click();
await win.waitForTimeout(250);
check('«Показать»: в предпросмотре идёт появление', (await frame.locator('#sg-fv-canvas').count()) === 1);
await win.screenshot({path: shot('tab')});
await win.waitForTimeout(3500);
check('и заканчивается', (await frame.locator('#sg-fv-canvas').count()) === 0);
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(800);

let file = storyFile();

check('способы в таблице стилей', file.includes('--sg-first-poyavlenie-1: noise 2 0.25 0 80 #ffffff 1 - now glitch -;') && file.includes('fade 2 0.25'), /--sg-first-[^\n]*/.exec(file)?.[0]);
check('движок 17', file.includes('Версия движка: 17'));

/* Кнопка над текстом */
await openPassage('Цель');
const menu = win.getByRole('button', {name: /^Первое посещение/});

await unfocus();
await menu.click();
await win.waitForTimeout(300);
await win.locator('.menu-button-menu, [class*=menu]').getByText('Шум', {exact: true}).click();
await win.waitForTimeout(1500);
check('тег способа у экрана', /tags="[^"]*sg-first-poyavlenie-1/.test(passageIn(storyFile(), 'Цель').tag), passageIn(storyFile(), 'Цель').tag);
check('кнопка показывает способ', (await win.getByRole('button', {name: 'Первое посещение: Шум'}).count()) === 1);
check('текст экрана не меняется', text('Цель').startsWith('Первая строка'), text('Цель'));
check('у другого экрана тега нет', !/sg-first/.test(passageIn(storyFile(), 'Меню').tag));

/* Предпросмотр экрана */
await win.getByRole('button', {name: 'Предпросмотр', exact: true}).first().click();
await win.waitForTimeout(3000);
const pf = win.frameLocator('.signaly-passage-preview iframe');

check('в предпросмотре экран открывается без эффекта', (await pf.locator('#sg-fv-canvas').count()) === 0 && (await pf.locator('.passage').innerText()).includes('Первая строка'));
await win.locator('.signaly-passage-preview').getByRole('button', {name: 'Показать первое посещение'}).click();
await win.waitForTimeout(250);
check('кнопка предпросмотра проигрывает появление', (await pf.locator('#sg-fv-canvas').count()) === 1);
await win.waitForTimeout(3000);
await win.locator('.signaly-passage-preview').getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

await menu.click();
await win.waitForTimeout(300);
await win.locator('.menu-button-menu, [class*=menu]').getByText('Как обычно', {exact: true}).click();
await win.waitForTimeout(1500);
check('«Как обычно» снимает тег', !/sg-first/.test(passageIn(storyFile(), 'Цель').tag));
await menu.click();
await win.waitForTimeout(300);
await win.locator('.menu-button-menu, [class*=menu]').getByText('Плавно', {exact: true}).click();
await win.waitForTimeout(1500);

/* Поле кода: галочка «Только цифры» */
await openPassage('Меню');
await unfocus();
await win.getByRole('button', {name: 'Добавить блок'}).click();
await win.waitForTimeout(300);
await win.locator('.menu-button-menu, [class*=menu]').getByText('Поле кода', {exact: true}).click();
await win.waitForTimeout(1500);
await unfocus();
await panel().getByLabel('Проверять по общей таблице кодов').check();
await win.waitForTimeout(1500);
await unfocus();
await panel().getByLabel('Только цифры').check();
await win.waitForTimeout(1800);
check('поле кода: слова table и digits', /<<sg-code[^>]*\btable\b[^>]*\bdigits\b/.test(text('Меню')), text('Меню'));
await win.screenshot({path: shot('field')});
await closeDialogs();

/* Окно «Коды»: метка и фильтр */
await win.getByRole('tab', {name: 'История'}).click();
await toolbarBtn('Коды').click();
await win.waitForTimeout(800);
const codes = win.locator('[role=dialog][aria-label="Коды"]');
const list = () => codes.locator('.signaly-kinds-item').allInnerTexts();

await codes.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(300);
await codes.getByLabel('Код', {exact: true}).fill('777');
await codes.getByLabel('Метка «ДЕШИФРАТОР»').check();
await codes.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(300);
await codes.getByLabel('Код', {exact: true}).fill('205');
await codes.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(300);
await codes.getByLabel('Код', {exact: true}).fill('12a');
await codes.getByLabel('Метка «ДЕШИФРАТОР»').check();
await win.waitForTimeout(300);
check('код не из цифр — предупреждение', (await codes.getByText('В коде есть не только цифры').count()) === 1);
await codes.getByLabel('Код', {exact: true}).fill('333');
await win.waitForTimeout(300);
check('в списке видна метка', (await list()).filter(x => x.includes('ДЕШИФРАТОР')).length === 2, (await list()).join('|'));
await codes.getByLabel('Показывать', {exact: true}).selectOption('decoder');
await win.waitForTimeout(300);
check('фильтр: только с меткой', (await list()).length === 2 && (await list()).every(x => x.includes('ДЕШИФРАТОР')), (await list()).join('|'));
await codes.getByRole('button', {name: 'Добавить код'}).click();
await win.waitForTimeout(300);
check('новый код при фильтре сразу с меткой', await codes.getByLabel('Метка «ДЕШИФРАТОР»').isChecked());
await codes.getByLabel('Код', {exact: true}).fill('444');
await codes.getByLabel('Когда можно ввести', {exact: true}).selectOption('cond');
await win.waitForTimeout(300);
check('условие кода: строки условия и пассаж блокировки', (await codes.getByLabel('Если ещё рано — пассаж блокировки', {exact: true}).count()) === 1);
await codes.getByLabel('Если ещё рано — пассаж блокировки', {exact: true}).selectOption('Цель');
await win.waitForTimeout(300);
await codes.getByLabel('Показывать', {exact: true}).selectOption('other');
await win.waitForTimeout(300);
check('фильтр: без метки — выбран код из списка', (await list()).length === 1 && (await codes.getByLabel('Код', {exact: true}).inputValue()) === '205', (await list()).join('|'));
await win.screenshot({path: shot('codes')});
await codes.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await codes.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(800);
check('метка записана словом decoder', /<<sg-entry "777" "" decoder/.test(text('Коды')) && /<<sg-entry "205" "">>/.test(text('Коды')), text('Коды'));
check('условие кода записано', /<<sg-entry "444" "" decoder lock "Цель">>\s*<<sg-when>>\$\w+/.test(text('Коды')), text('Коды'));

/* Удаление способа снимает тег */
await toolbarBtn(/Оформление/).click();
await win.waitForTimeout(1200);
await dlg.getByRole('tab', {name: 'Первое посещение'}).click();
await win.waitForTimeout(400);
await dlg.locator('.signaly-kinds-item', {hasText: 'Плавно'}).click();
await win.waitForTimeout(300);
await dlg.getByRole('button', {name: 'Удалить', exact: true}).click();
await win.waitForTimeout(500);
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(800);
check('удалённый способ снят с экрана', !/sg-first/.test(passageIn(storyFile(), 'Цель').tag), passageIn(storyFile(), 'Цель').tag);

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
