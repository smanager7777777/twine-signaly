// Проверка программы (Electron), сессия 14, шаг 4.1: окно «Строка событий».
// Вкладки «Сообщения», «Строка», «Цикл»; добавить, копировать, ▲, сортировка;
// порядок показа; таблица цикла; предпросмотр и «Показать смену цикла»;
// «Сохранить» — пассаж с тегом sg-ticker, движок 15.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-ticker.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-ticker-'));
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


const open = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await win.locator('.route-toolbar').getByRole('button', {name: 'Строка событий'}).click();
	await win.waitForTimeout(800);
	return win.locator('[role=dialog][aria-label="Строка событий"]');
};
const frame = () => win.frameLocator('.signaly-preview-frame iframe');
let dlg = await open();

check('окно открывается, вкладки', (await dlg.getByRole('tab').allTextContents()).join() === 'Сообщения,Строка,Цикл');
check('сообщений нет, подсказка', (await dlg.textContent()).includes('Сообщений пока нет'));

/* Сообщения */
await dlg.getByRole('button', {name: 'Добавить', exact: true}).click();
await dlg.getByLabel('Название', {exact: true}).fill('Общее');
await dlg.getByLabel('Текст', {exact: true}).fill('Корабль идёт по курсу');
await dlg.getByLabel('Общее', {exact: true}).check();
await dlg.getByRole('button', {name: 'Копировать'}).click();
await win.waitForTimeout(200);
check('копия с новым названием и выбрана', (await dlg.getByLabel('Название', {exact: true}).inputValue()) === 'Общее (копия)');
await dlg.getByLabel('Название', {exact: true}).fill('ВИП');
await dlg.getByLabel('Текст', {exact: true}).fill('Сообщение для ВИП');
await dlg.getByLabel('Общее', {exact: true}).uncheck();
await dlg.getByLabel('Показывать', {exact: true}).selectOption('cond');
await win.waitForTimeout(200);
check('условие — те же строки, что в «Условии»', (await dlg.textContent()).includes('Что проверять'));
await dlg.getByLabel('Минут после включения').fill('10');
await dlg.getByLabel('Сколько раз показать').fill('3');
await dlg.getByLabel('Приоритет').fill('2');
await dlg.getByLabel('Свой цвет').check();
await dlg.getByLabel('Жирный').check();
await dlg.getByLabel('Эффект').selectOption('blink');
await dlg.getByRole('button', {name: 'Выше'}).click();
await win.waitForTimeout(200);
check('▲ двигает сообщение вверх', (await dlg.locator('.signaly-kinds-item').first().textContent()).startsWith('ВИП'));
await dlg.getByRole('button', {name: 'По названию'}).click();
await win.waitForTimeout(200);
check('сортировка по названию', (await dlg.locator('.signaly-kinds-item').allTextContents()).map(s => s.replace('общее', '')).join() === 'ВИП,Общее');

/* Строка */
await dlg.getByRole('tab', {name: 'Строка'}).click();
check('главный экран по умолчанию — стартовый', (await dlg.getByLabel('Главный экран').inputValue()) === 'Start');
await dlg.getByLabel('Как сменяются').selectOption('scroll');
await dlg.getByRole('button', {name: 'Выше'}).nth(1).click();
await win.waitForTimeout(200);
check('порядок показа меняется', (await dlg.locator('.signaly-ticker-order').first().textContent()).includes('Общие'));

/* Цикл */
await dlg.getByRole('tab', {name: 'Цикл'}).click();
await dlg.getByLabel('Переменная прогресса').selectOption('progress');
await win.waitForTimeout(200);
await dlg.getByRole('button', {name: '+ Добавить'}).click();
await dlg.getByRole('button', {name: '+ Добавить'}).click();
await dlg.getByRole('spinbutton', {name: 'Прогресс'}).nth(1).fill('7');
await dlg.getByRole('textbox', {name: 'Цикл'}).nth(1).fill('004a87');
await win.waitForTimeout(200);
check('в цикле только цифры, не больше 5', (await dlg.getByRole('textbox', {name: 'Цикл'}).nth(1).inputValue()) === '00487');
await dlg.getByRole('spinbutton', {name: 'Прогресс'}).nth(1).fill('0');
await win.waitForTimeout(200);
check('повтор прогресса — «Сохранить» недоступна', await dlg.getByRole('button', {name: 'Сохранить'}).isDisabled());
await dlg.getByRole('spinbutton', {name: 'Прогресс'}).nth(1).fill('7');
await dlg.getByLabel('Звук', {exact: true}).selectOption({index: 1});
check('первая цифра останавливается через 10 с', (await dlg.getByRole('textbox', {name: /первая цифра/}).inputValue()) === '10');

/* Предпросмотр */
await win.waitForTimeout(3500);
check('предпросмотр: строка на главном экране', (await frame().locator('#sg-ticker').count()) === 1);
check('предпросмотр: цикл 00001', (await frame().locator('.sg-tk-num').textContent()) === '00001');
await dlg.getByRole('button', {name: 'Показать смену цикла'}).click();
await win.waitForTimeout(600);
check('«Показать смену цикла» — цифры меняются', (await frame().locator('.sg-tk-num').textContent()) !== '00001');
await win.screenshot({path: shot('ticker')});

await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);

const file = storyFile();
const item = passageIn(file, 'Строка событий');

check('пассаж с тегом sg-ticker', /tags="sg-ticker"/.test(item.tag), item.tag);
check('движок 15', file.includes('Версия движка: 15'));
check('строка, цикл, сообщения — в тексте пассажа', item.text.includes('<<sg-ticker screen "Start"') && item.text.includes('mode scroll') && item.text.includes('<<sg-cycle var "$progress" spin 10 gap 0.5 from "20,20,20,20,20" to "2,2,2,2,2" sound') && item.text.includes('<<sg-cycle-at 7 "00487">>') && item.text.includes('<<sg-news "Общее" general>><<sg-text>>Корабль идёт по курсу<</sg-news>>'), item.text);
check('условие и настройки ВИП', /<<sg-news "ВИП" priority 2 minutes 10 times 3 color "#ff0000" bold effect blink>>\$\w+<<sg-text>>Сообщение для ВИП/.test(item.text), item.text);

await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(500);
dlg = await open();
check('окно снова читает настройки', (await dlg.locator('.signaly-kinds-item').count()) === 2 && (await dlg.getByLabel('Название', {exact: true}).inputValue()) === 'ВИП');
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
