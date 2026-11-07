// Проверка программы (Electron), сессия 15, шаг 4.2: вкладки «Виды экранов» и
// «Стили текста», раздел «Поля ввода», кнопки «Вид экрана» и «Стиль текста» над
// текстом, таблица скоростей цифр цикла. Предпросмотр, запись, повторное чтение.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-screens.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-screens-'));
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
	fs.readFileSync(process.env.TWEE, 'utf8').replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $progress to 0>>\n<<set $vip to false>>\n')
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



const openLook = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await win.locator('.route-toolbar').getByRole('button', {name: /Оформление/}).click();
	await win.waitForTimeout(1200);
	return win.locator('[role=dialog][aria-label="Оформление терминала"]');
};
const frame = () => win.frameLocator('.signaly-preview-frame iframe');
const save = async dlg => {
	await dlg.getByRole('button', {name: 'Сохранить'}).click();
	await win.waitForTimeout(1500);
};
const closeWindow = async dlg => {
	await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
	await win.waitForTimeout(500);
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
const pick = async (button, item) => {
	await win.getByRole('button', {name: button}).first().click();
	await win.waitForTimeout(200);
	await win.locator('.menu-button-menu').getByText(item, {exact: true}).click();
	await win.waitForTimeout(500);
};

let dlg = await openLook();

check('вкладки окна', (await dlg.getByRole('tab').allTextContents()).join() === 'Общее,Виды экранов,Стили текста,Первое посещение');

/* Поля ввода */
await dlg.getByText('Настраивать поля ввода здесь').waitFor({timeout: 3000});
check('поля ввода в шаблоне включены, значения из стилей автора', await dlg.getByLabel('Настраивать поля ввода здесь').isChecked());
await dlg.getByLabel('Настраивать поля ввода здесь').evaluate(el => el.scrollIntoView());
check('размер поля 25', (await dlg.locator('section', {hasText: 'Настраивать поля ввода здесь'}).getByRole('textbox', {name: /^Размер текста/}).last().inputValue()) === '25');

/* Вид экрана */
await dlg.getByRole('tab', {name: 'Виды экранов'}).click();
check('видов нет, подсказка', (await dlg.textContent()).includes('Видов пока нет'));
await dlg.getByRole('button', {name: 'Добавить', exact: true}).click();
await dlg.getByLabel('Название', {exact: true}).fill('Блокировка');
await dlg.getByLabel('Рамка', {exact: true}).selectOption('none');
await dlg.getByLabel('Размер окна', {exact: true}).selectOption('full');
await dlg.getByLabel('Свой фон окна').check();
await dlg.getByRole('textbox', {name: 'Код цвета'}).first().fill('#cc0000');
await dlg.getByRole('textbox', {name: 'Код цвета'}).first().press('Enter');
await dlg.getByLabel('Свой цвет текста').check();
await dlg.getByLabel('Свой размер текста').check();
await dlg.getByRole('button', {name: 'Снизу справа'}).click();
await win.waitForTimeout(300);
check('положение текста выбрано', (await dlg.textContent()).includes('Снизу справа'));
await win.waitForTimeout(3000);

const shown = await frame().locator('#passages').evaluate(el => {
	const r = el.getBoundingClientRect();

	return {width: r.width, border: getComputedStyle(el).borderTopWidth, bg: getComputedStyle(el).backgroundColor, tags: document.documentElement.getAttribute('data-tags')};
});

check('предпросмотр показывает вид', shown.width === 1920 && shown.border === '0px' && shown.bg === 'rgb(204, 0, 0)', JSON.stringify(shown));
check('тег вида в предпросмотре', (shown.tags ?? '').includes('sg-scr-vid-ekrana-1'), shown.tags);
await win.screenshot({path: shot('view')});
await dlg.getByRole('button', {name: 'Копировать'}).click();
check('копия вида', (await dlg.locator('.signaly-kinds-item').count()) === 2);
await dlg.getByRole('button', {name: 'Удалить'}).click();
check('копия удалена', (await dlg.locator('.signaly-kinds-item').count()) === 1);

/* Стиль текста */
await dlg.getByRole('tab', {name: 'Стили текста'}).click();
await dlg.getByRole('button', {name: 'Добавить', exact: true}).click();
await dlg.getByLabel('Название', {exact: true}).fill('Рапорт');
await dlg.getByLabel('Свой размер').check();
await dlg.getByLabel('Свой цвет', {exact: true}).check();
await win.waitForTimeout(3000);
check('образец стиля в предпросмотре', (await frame().locator('[class^="sg-ts-"]').first().textContent()) === 'Образец текста в этом стиле');
await win.screenshot({path: shot('style')});
await save(dlg);

let file = storyFile();

check('виды и стили в строке настроек', file.includes('"id":"vid-ekrana-1"') && file.includes('"id":"stil-1"'));
check('CSS вида и стиля', file.includes('html[data-tags~="sg-scr-vid-ekrana-1"] #passages') && file.includes('.sg-ts-stil-1 {'));
check('предпросмотр не попал в экраны', !/name="Start"[^>]*tags="[^"]*sg-scr/.test(file) && !file.includes('Образец текста в этом стиле'));
await closeWindow(dlg);

/* Панель над текстом */
await openPassage('Admin');
await pick(/^Вид экрана/, 'Блокировка');
await win.waitForTimeout(1500);
check('«Вид экрана» ставит тег', /tags="[^"]*sg-scr-vid-ekrana-1/.test(passageIn(storyFile(), 'Admin').tag), passageIn(storyFile(), 'Admin').tag);
check('кнопка показывает вид', (await win.getByRole('button', {name: 'Вид экрана: Блокировка'}).count()) === 1);
await pick(/^Вид экрана/, 'Обычный экран');
await win.waitForTimeout(1500);
check('«Обычный экран» снимает тег', !/sg-scr/.test(passageIn(storyFile(), 'Admin').tag), passageIn(storyFile(), 'Admin').tag);
await pick(/^Вид экрана/, 'Блокировка');
await win.evaluate(() => {
	const cm = document.querySelector('.CodeMirror').CodeMirror;

	cm.setValue('Первое слово');
	cm.setSelection({line: 0, ch: 0}, {line: 0, ch: 6});
	cm.focus();
});
await win.waitForTimeout(300);
await pick(/^Стиль текста/, 'Рапорт');
await win.waitForTimeout(1500);
check('«Стиль текста» оборачивает выделенное', passageIn(storyFile(), 'Admin').text.includes('<span class="sg-ts-stil-1">Первое</span> слово'), passageIn(storyFile(), 'Admin').text);
check('панель показывает стиль под курсором', (await win.getByRole('button', {name: 'Стиль текста: Рапорт'}).count()) === 1);
await pick(/^Стиль текста/, 'Убрать стиль');
await win.waitForTimeout(1500);
check('стиль убирается', passageIn(storyFile(), 'Admin').text.trim() === 'Первое слово', passageIn(storyFile(), 'Admin').text);
await closeDialogs();

/* Цикл: скорости цифр */
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('.route-toolbar').getByRole('button', {name: 'Строка событий'}).click();
await win.waitForTimeout(800);
dlg = win.locator('[role=dialog][aria-label="Строка событий"]');
await dlg.getByRole('tab', {name: 'Цикл'}).click();
await dlg.getByLabel('Переменная прогресса').selectOption('progress');
await win.waitForTimeout(200);
await dlg.getByRole('button', {name: '+ Добавить'}).click();
check('задержка по умолчанию 0,5 с', (await dlg.getByRole('textbox', {name: /^Задержка между остановками/}).inputValue()) === '0.5');
check('пять строк скоростей', (await dlg.locator('.signaly-ticker-rates').count()) === 6);
await dlg.getByRole('spinbutton', {name: 'Скорость цифры 5 в начале'}).fill('30');
await dlg.getByRole('spinbutton', {name: 'Скорость цифры 1 к остановке'}).fill('7');
await dlg.getByRole('textbox', {name: /^Задержка между остановками/}).fill('1.5');
await dlg.getByRole('textbox', {name: /^Задержка между остановками/}).press('Enter');
await win.screenshot({path: shot('rates')});
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
file = storyFile();
check('скорости записаны', passageIn(file, 'Строка событий').text.includes('gap 1.5 from "20,20,20,20,30" to "7,2,2,2,2"'), passageIn(file, 'Строка событий').text);
check('движок 26', file.includes('Версия движка: 26'));
await closeWindow(dlg);

/* Перезапуск окна читает всё обратно; удаление вида снимает тег */
dlg = await openLook();
await dlg.getByRole('tab', {name: 'Виды экранов'}).click();
check('вид читается обратно', (await dlg.getByLabel('Название', {exact: true}).inputValue()) === 'Блокировка');
await dlg.getByRole('button', {name: 'Удалить'}).click();
await win.waitForTimeout(300);
await save(dlg);
check('удалённый вид снят с экранов', !/sg-scr/.test(passageIn(storyFile(), 'Admin').tag), passageIn(storyFile(), 'Admin').tag);
await closeWindow(dlg);

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
