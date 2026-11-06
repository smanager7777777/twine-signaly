// Проверка программы (Electron), сессия 11, шаг 3.3: окно «Горячие клавиши».
// Шаблон build-12: Shift+Z+A/B/C кодом в JavaScript истории → окно показывает
// их таблицей; новая комбинация (нажатием клавиш), «спросить», действия,
// переход; повтор комбинации не даёт сохранить; встроенная «новая игра» на
// другой клавише; «Сохранить» — пассаж «Горячие клавиши» (тег sg-keys), код
// уходит из JavaScript истории, движок 8. Форма ссылки: РАД — «Если … то …
// иначе», трек радио — «Через N секунд»; правка вложенного действия.
// Запуск: TWEE=<шаблон build-12> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-keys.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-keys-'));
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

check('в истории движок 7 и горячие клавиши кодом', storyFile().includes('Версия движка: 7') && storyFile().includes('/* ===== Горячие клавиши мастера ===== */'));

/* 1. Окно «Горячие клавиши» */
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('.route-toolbar').getByRole('button', {name: 'Горячие клавиши'}).click();
await win.waitForTimeout(800);

const dlg = win.locator('[role=dialog][aria-label="Горячие клавиши"]');
const items = async () => (await dlg.locator('.signaly-kinds-item').allTextContents()).map(s => s.trim());

check(
	'окно: встроенные и Shift+Z+A/B/C из кода шаблона',
	JSON.stringify(await items()) ===
		JSON.stringify([
			'Shift+Z+NНовая игравстроено',
			'Shift+Z+XЗакрыть экран тревогивстроено',
			'Shift+Z+AМастерское сообщение',
			'Shift+Z+BПереход на gotoPSG',
			'Shift+Z+CЗвук radiovinyl'
		]),
	JSON.stringify(await items())
);
check('пояснение о переносе и «Есть несохранённые изменения»', (await dlg.locator('.signaly-notice').count()) > 0 && (await dlg.textContent()).includes('Есть несохранённые изменения'));

await dlg.locator('.signaly-kinds-item').nth(2).click();
await win.waitForTimeout(300);

const legends = async () => (await dlg.locator('.signaly-sounds-editor legend').allTextContents()).map(s => s.trim());

check('A: окно-сообщение и звук-сигнал', JSON.stringify(await legends()) === JSON.stringify(['1. Открыть окно-сообщение', '2. Звук-сигнал']), JSON.stringify(await legends()));
check('A: звук — файл и громкость 100 %', (await dlg.getByLabel('Файл из папки игры').inputValue()) === 'media/audio/msgsoundA.wav' && (await dlg.getByLabel('Громкость, %').inputValue()) === '100');
await win.screenshot({path: shot('window')});

await dlg.locator('.signaly-kinds-item').nth(4).click();
await win.waitForTimeout(300);
check('C: «Не начинать заново, если ещё звучит»', await dlg.getByLabel('Не начинать заново, если ещё звучит').isChecked());

// Новая комбинация.
await dlg.getByRole('button', {name: 'Добавить комбинацию'}).click();
await win.waitForTimeout(300);
check('новая строка — первая свободная Shift+Z+D', (await items())[5] === 'Shift+Z+DНовая комбинация', (await items())[5]);
await dlg.getByRole('button', {name: 'Задать нажатием'}).click();
await win.waitForTimeout(200);
await win.keyboard.down('z');
await win.keyboard.down('Shift');
await win.keyboard.press('KeyQ');
await win.keyboard.up('Shift');
await win.keyboard.up('z');
await win.waitForTimeout(300);
check('комбинация задана нажатием: Shift+Z+Q', (await dlg.locator('.signaly-keys-combo-value').textContent()) === 'Shift+Z+Q');
await dlg.getByLabel('Подпись').fill('Следующая глава');
await dlg.getByLabel('Спросить перед выполнением').check();
await dlg.getByLabel('Добавить действие').selectOption('set');
await win.waitForTimeout(300);
await dlg.getByLabel('Что сделать').selectOption('add');
await win.waitForTimeout(200);
await dlg.getByLabel('Добавить действие').selectOption('if');
await win.waitForTimeout(300);
await dlg.getByLabel('Добавить сюда действие').first().selectOption('signal');
await win.waitForTimeout(300);
await dlg.getByLabel('После действий перейти на экран').selectOption('Start');
await win.waitForTimeout(300);

// Повтор комбинации — сохранить нельзя.
await dlg.getByLabel('Комбинация', {exact: true}).selectOption('Shift+Z+A');
await win.waitForTimeout(300);
check('повтор комбинации — предупреждение, «Сохранить» недоступна', (await dlg.textContent()).includes('Одна комбинация на несколько строк: Shift+Z+A') && (await dlg.getByRole('button', {name: 'Сохранить'}).isDisabled()));
await dlg.getByLabel('Комбинация', {exact: true}).selectOption('Shift+Z+Q');
await win.waitForTimeout(300);

// Встроенная «новая игра» — на Shift+Z+M; удалить её нельзя.
await dlg.locator('.signaly-kinds-item').nth(0).click();
await win.waitForTimeout(300);
check('встроенную нельзя удалить', await dlg.getByRole('button', {name: 'Удалить'}).isDisabled());
await dlg.getByLabel('Комбинация', {exact: true}).selectOption('Shift+Z+M');
await win.waitForTimeout(300);
await win.screenshot({path: shot('window-new')});
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);

const file = storyFile();
const keysAt = file.indexOf('name="Горячие клавиши"');
const keysTag = /<tw-passagedata[^>]*name="Горячие клавиши"[^>]*>/.exec(file)?.[0] ?? '';
const keysText = keysAt === -1 ? '' : file.slice(file.indexOf('>', keysAt) + 1, file.indexOf('</tw-passagedata>', keysAt));

check('пассаж «Горячие клавиши» с тегом sg-keys', /tags="sg-keys"/.test(keysTag), keysTag);
check('код горячих клавиш ушёл из JavaScript истории, движок 21', !file.includes('/* ===== Горячие клавиши мастера ===== */') && file.includes('перенесены в пассаж «Горячие клавиши»') && file.includes('Версия движка: 21'));
check(
	'в пассаже: A, B, C как в шаблоне',
	keysText.includes('<<sg-key "Shift+Z+A" "Мастерское сообщение">>\n<<sg-open "Мастерское сообщение" passage "showPSGinfo">><</sg-open>>\n<<sg-sound "media/audio/msgsoundA.wav" volume 100>>\n<</sg-key>>') &&
		keysText.includes('<<sg-key "Shift+Z+B" "Переход на gotoPSG" goto "gotoPSG">>') &&
		keysText.includes('<<sg-sound "media/audio/radiovinyl.wav" volume 100 keep>>'),
	keysText
);
check('в пассаже: новая игра — Shift+Z+M', keysText.includes('<<sg-key "Shift+Z+M" "Новая игра" builtin newgame>><</sg-key>>'));
{
	const q = keysText.slice(keysText.indexOf('<<sg-key "Shift+Z+Q"'));

	check(
		'в пассаже: Shift+Z+Q — спросить, действия, «если», переход',
		q.startsWith('<<sg-key "Shift+Z+Q" "Следующая глава" goto "Start" ask>>\n<<set $') &&
			/^<<set \$\w+ \+= 1>>\n<<if \$\w+>>\n<<sg-sound "media\/audio\/[^"]+" volume 100>>\n<<\/if>>\n<<\/sg-key>>/.test(q.slice(q.indexOf('\n') + 1)),
		q
	);
}
check('«Сохранено»', (await dlg.textContent()).includes('Сохранено'));
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);
check('пассаж виден на карте', (await win.locator('.passage-card h2', {hasText: /^Горячие клавиши$/}).count()) === 1);

// Окно снова — таблица из пассажа.
await win.locator('.route-toolbar').getByRole('button', {name: 'Горячие клавиши'}).click();
await win.waitForTimeout(800);
check(
	'повторно: таблица из пассажа, без пояснения о переносе',
	(await items()).join('|') === 'Shift+Z+MНовая игравстроено|Shift+Z+XЗакрыть экран тревогивстроено|Shift+Z+AМастерское сообщение|Shift+Z+BПереход на gotoPSG|Shift+Z+CЗвук radiovinyl|Shift+Z+QСледующая глава' &&
		(await dlg.locator('.signaly-notice').count()) === 0 &&
		(await dlg.textContent()).includes('Сохранено'),
	(await items()).join('|')
);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);

/* 2. Форма ссылки: «Если», «Через N секунд» */
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
	const at = await win.evaluate(i => {
		const cm = document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror;
		const pos = cm.getDoc().posFromIndex(i);

		cm.scrollIntoView(pos, 60);
		const c = cm.charCoords(pos, 'window');

		return {x: c.left + 2, y: (c.top + c.bottom) / 2};
	}, index);

	await win.mouse.click(at.x, at.y);
	await win.waitForTimeout(400);
};
const panel = () => win.locator('.signaly-block-panel');
const blur = async () => {
	await win.evaluate(() => document.activeElement && document.activeElement.blur());
	await win.waitForTimeout(400);
};

await openPassage('audiobuttons');
let value = await cmValue();

await cmClick(value.indexOf('<<link "РАД">>') + 4);

const panelLegends = async () => (await panel().locator('legend').allTextContents()).map(s => s.trim());

check('РАД: «Если … то … иначе», внутри — свои действия', (await panelLegends()).join('|') === '1. Если … то … иначе|Условие 1|1. Изменить переменную|2. Звук|1. Изменить переменную|2. Изменить переменную|3. Звук|4. Звук', (await panelLegends()).join('|'));
check('РАД: условие понято ($radioplaying равна 1)', (await panel().getByLabel('Переменная').first().inputValue()) === 'radioplaying' && (await panel().getByLabel('Значение').first().inputValue()) === '1');
check('РАД: открыть форму — текст не меняется', (await cmValue()) === value);
await win.screenshot({path: shot('if')});

await openPassage('radio');
value = await cmValue();

const track = value.indexOf('<<link "Трек 1 radioRegentropfen">>');

await cmClick(track + 4);
check('трек радио: «Через N секунд» (8)', (await panelLegends()).includes('6. Через N секунд') && (await panel().getByLabel('Через сколько секунд').inputValue()) === '8', (await panelLegends()).join('|'));
check('трек радио: открыть форму — текст не меняется', (await cmValue()) === value);
await blur();
await panel().getByLabel('Через сколько секунд').fill('9');
await win.waitForTimeout(400);
value = await cmValue();
check('правка: <<timed 9s>>, остальное как было', value.includes('<<timed 9s>><<audio "radioRegentropfen" volume 0.1 play>><</timed>>') && value.includes('<<timed 8s>><<audio "radioSchubert_serenade" volume 0.1 play>><</timed>>'), value.slice(track, track + 300));
await win.screenshot({path: shot('delay')});

await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
