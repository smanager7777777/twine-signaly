// Проверка программы (Electron), сессия 28, шаг 7.3: окно «Музыка» — вложенные папки, громкость
// файла, раздел «Эфир»; окно «Радио» — отремонтированное радио, белый шум, помехи, поимка.
// TWEE=signaly/template/27_03_2025.twee MEDIA=… SHOT=… xvfb-run … node signaly/tests/electron-air.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-air-'));
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
:: Пустой {"position":"400,1500","size":"100,100"}
Экран
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
	await win.locator('.menu-button-menu').getByText(name, {exact: true}).click();
	await win.waitForTimeout(1500);
};
const editorText = () => win.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
const setEditor = (value, at) =>
	win.evaluate(([v, a]) => {
		const cm = document.querySelector('.CodeMirror').CodeMirror;

		cm.setValue(v);
		cm.setCursor(cm.posFromIndex(a));
		cm.focus();
	}, [value, at]);



const range = (dialog, label, value) => dialog.getByRole('textbox', {name: new RegExp('^' + label)}).fill(String(value)).then(() => dialog.getByRole('textbox', {name: new RegExp('^' + label)}).press('Enter'));

/* Окно «Музыка»: вложенная папка, громкость файла, раздел «Эфир» */
await closeDialogs();
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1500);

const mw = win.locator('[role=dialog][aria-label="Музыка"]');

check('окно «Музыка»: три раздела', (await mw.locator('h3').allTextContents()).join('|').includes('Эфир'), (await mw.locator('h3').allTextContents()).join('|'));
await mw.getByRole('button', {name: 'Радио', exact: true}).click();
await mw.getByRole('button', {name: 'Вложенная папка'}).click();
await win.waitForTimeout(300);
await mw.getByLabel('Название папки', {exact: true}).fill('Дневники');
await win.waitForTimeout(300);
check('вложенная папка — в списке под своей, с отступом', (await mw.locator('.signaly-kinds-item', {hasText: 'Дневники'}).evaluate(el => el.textContent.startsWith('└') && parseFloat(el.style.paddingLeft) > 1)));
check('у вложенной папки нет выбора раздела', (await mw.getByLabel('Раздел', {exact: true}).count()) === 0);
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).fill('Запись 1');
await mw.getByLabel('Файл', {exact: true}).selectOption('media/audio/radiovinyl.wav');
await range(mw, 'Громкость файла', 60);

// Раздел «Эфир»: новая папка и передача.
const addButtons = mw.getByRole('button', {name: 'Добавить папку'});

await addButtons.last().click();
await win.waitForTimeout(300);
await mw.getByRole('button', {name: 'Добавить трек'}).click();
await mw.getByLabel('Название трека', {exact: true}).fill('Перехват');
await mw.getByLabel('Файл', {exact: true}).selectOption('media/audio/radiovinyl.wav');
check('у передачи: «После поимки», ширина, нет предзвука', (await mw.getByLabel('После поимки — в папку радио', {exact: true}).count()) === 1 && (await mw.getByLabel('Предзвук').count()) === 0);
await mw.getByLabel('После поимки — в папку радио', {exact: true}).selectOption('Радио/Дневники');
await range(mw, 'Слышно в пределах', 0.8);
await mw.getByLabel('Своё сообщение в строке', {exact: true}).fill('SOS');

// Переименование вложенной папки правит и передачу.
await mw.getByRole('button', {name: 'Радио/Дневники'}).click();
await mw.getByLabel('Название папки', {exact: true}).fill('Записи');
await win.waitForTimeout(300);
await win.screenshot({path: shot('music')});
await mw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);

let music = text('Музыка');

check('записано: вложенная папка за своей', /<<sg-folder "Радио" section radio>>[^]*<<sg-folder "Радио\/Записи" section radio>>/.test(music), music.slice(-600));
check('записано: громкость файла', music.includes('<<sg-track "Запись 1" "media/audio/radiovinyl.wav" gain 60>>'));
check('записано: передача ведёт в переименованную папку', /section air>>\n<<sg-track "Перехват" "media\/audio\/radiovinyl.wav" to "Радио\/Записи" width 0.8 text "SOS">>/.test(music), music.slice(-400));
check('движок 26', /Версия движка: 26/.test(storyFile()));
await mw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);
await toolbarBtn(/^Музыка$/).click();
await win.waitForTimeout(1200);
check('открыто заново: дерево то же', (await mw.locator('.signaly-kinds-item', {hasText: 'Записи'}).textContent()).startsWith('└'));
// Вторая верхняя папка радио, потом «Радио» ниже неё — вместе с вложенной.
await addButtons.nth(1).click();
await win.waitForTimeout(300);
await mw.getByRole('button', {name: 'Радио', exact: true}).click();
await mw.locator('.signaly-button', {hasText: /^Ниже$/}).click();
await win.waitForTimeout(300);

const order = await mw.locator('.signaly-kinds-item').evaluateAll(els => els.map(el => el.getAttribute('aria-label')));

check('«Ниже» переносит папку вместе с вложенной', order.indexOf('Радио/Записи') === order.indexOf('Радио') + 1 && /^Папка/.test(order[order.indexOf('Радио') - 1]), order.join('|'));
await mw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Окно «Радио»: отремонтированное радио, эфир */
await toolbarBtn(/^Радио$/).click();
await win.waitForTimeout(1500);

const rw = win.locator('[role=dialog][aria-label="Радио"]');

await rw.getByRole('button', {name: 'Добавить вид'}).click();
await rw.getByLabel('Название вида', {exact: true}).fill('Эфир');
await rw.getByRole('radiogroup', {name: 'Тип радио'}).getByRole('radio', {name: /Отремонтированное/}).click();
await win.waitForTimeout(300);
check('отремонтированное: настройки эфира, искр нет', (await rw.getByLabel('Файл белого шума', {exact: true}).count()) === 1 && (await rw.getByLabel('Звук искры').count()) === 0);
await rw.getByLabel('Сообщение о передаче', {exact: true}).fill('ПРИЁМ');
await range(rw, 'Удерживать точную настройку', 5);
await rw.getByLabel('Файл белого шума', {exact: true}).selectOption('media/audio/radiovinyl.wav');
await rw.getByLabel('Где звучит, МГц', {exact: true}).fill('88-95, 101-108');
await rw.getByRole('button', {name: 'Добавить помеху'}).click();
await rw.getByRole('button', {name: 'Добавить помеху'}).click();
await range(rw, 'до', 2);
await range(rw, 'Сколько помех выпадает', 3);
await win.waitForTimeout(300);
check('«от» больше «до» — «Сохранить» недоступна', await rw.getByRole('button', {name: 'Сохранить'}).isDisabled());
await range(rw, 'Сколько помех выпадает', 1);
await win.waitForTimeout(2500);

const frame = win.frameLocator('.signaly-ticker-preview iframe');

check('предпросмотр: отремонтированное радио со шкалой', (await frame.locator('.sg-radio.sg-radio-fixed .sg-r-scale').count()) === 1);
check('предпросмотр: частота 98.0', (await frame.locator('.sg-r-freq').textContent()) === '98.0');
check('предпросмотр: в каталоге вложенная папка', (await frame.locator('.sg-r-line .sg-r-name').allTextContents()).includes('Радио'));
await win.screenshot({path: shot('radio')});
await rw.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);

const radio = text('Радио');

check(
	'записано: вид с эфиром',
	/<<sg-radio-view "Эфир" type fixed [^>]*noise "media\/audio\/radiovinyl.wav" noisevolume 60 noiseranges "88-95, 101-108" jam "[^"|]+\|1\|80; [^"|]+\|1\|80" jamsmin 1 jamsmax 2 incoming "ПРИЁМ" catch 5>>/.test(radio),
	radio
);

await rw.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* Блок «Радио» на экране — отремонтированный вид */
await openPassage('Пустой');
await setEditor('Экран\n', 6);
await add('Радио');
await select('Вид радио', 'Эфир');
check('блок «Радио» с видом «Эфир»', (await editorText()).includes('<<sg-radio "Эфир">>'), await editorText());

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `\n${results.length - failed}/${results.length} проверок пройдено` : '\nВСЁ ХОРОШО');
process.exit(failed ? 1 : 0);
