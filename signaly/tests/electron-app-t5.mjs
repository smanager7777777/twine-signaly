// Проверка программы (Electron), сессия 36 (= П14): событие терминала «окно-сообщение» (popup, ответ Т4-8 Б),
// у кода телефона — «когда» по общим переменным (Т4-5 А), вкладка «Шапка и меню» окна «Приложение» (Т4-6 Б)
// с предпросмотром телефона, галочка «Телефон сам ищет центр» (П-62).
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t5.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t5-'));
const game = path.join(home, 'Игра СИГНАЛЫ');
const shot = name => (process.env.SHOT || path.join(home, 'shot.png')).replace('.png', `-${name}.png`);
const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : String(extra).slice(0, 1500)}`);
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
win.on('dialog', d => d.accept());
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

const libDir = path.join(await app.evaluate(({app}) => app.getPath('documents')), 'Twine СИГНАЛЫ', 'Истории');
const storyFile = () =>
	fs
		.readFileSync(path.join(libDir, fs.readdirSync(libDir).find(f => f.startsWith('27_03_2025'))), 'utf8')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const passageText = name => (new RegExp(`<tw-passagedata[^>]*name="${name}"[^>]*>([\\s\\S]*?)</tw-passagedata>`).exec(storyFile()) || [])[1] || '';
const general = () => JSON.parse((/<<app-general>>(.*?)<<\/app-general>>/.exec(passageText('Приложение')) || [])[1] || '{}');
const phoneOf = (text, code) => {
	const m = new RegExp(`<<sg-entry "${code}"[^>]*>>[\\s\\S]*?<<sg-phone>>(.*)`).exec(text);
	return m ? JSON.parse(m[1]) : undefined;
};

const packs = process.env.PACKS || 'src/util/signaly/__tests__/fixtures';
const appWin = () => win.locator('.signaly-app-window').first();
const evWin = () => win.locator('.signaly-events-window');
const openApp = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await win.locator('button.icon-button', {hasText: /^Приложение$/}).first().click();
	await win.locator('.signaly-app-window').first().waitFor();
	await win.waitForTimeout(500);
};
const field = (label, scope = appWin()) => scope.getByLabel(label, {exact: true});
const appTab = async name => {
	await appWin().getByRole('tab', {name, exact: true}).click();
	await win.waitForTimeout(300);
};

// 1. Пакет сети в историю.
await openApp();
await appWin().locator('input[type=file]').setInputFiles({name: 'СЕТЬ-ТЕСТ-v4.sgpack', mimeType: 'application/zip', buffer: fs.readFileSync(path.join(packs, 'app-test-net-pack.sgpack'))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
await appWin().getByRole('button', {name: 'Загрузить в историю'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
await win.waitForTimeout(2500);
check('пакет загружен, движок 34', passageText('Приложение').includes('<<app-general>>') && storyFile().includes('Версия движка: 34'));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(600);

// 2. Общая переменная power = 5.
await btn(/^Переменные$/).click();
await win.waitForSelector('.signaly-sounds-window');
const varWin = win.locator('.signaly-sounds-window');
await varWin.getByRole('button', {name: 'Добавить переменную'}).click();
await varWin.getByLabel('Имя (латиницей)').fill('power');
await varWin.getByLabel('Подпись по-русски').fill('Энергия');
await varWin.getByLabel('Начальное значение').fill('5');
await varWin.getByLabel('Общая с телефонами').check();
await varWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await varWin.getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 3. «События»: событие терминала «окно-сообщение» (Т4-8 Б).
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await field('Название нового события (экран)', evWin()).fill('Внимание экипажу');
await evWin().getByRole('button', {name: '+ Условие на терминале'}).click();
await win.waitForTimeout(300);
await evWin().getByLabel('Не переходить на экран — показать окно-сообщение').check();
await win.waitForTimeout(200);
check('popup: подсказка про окно-сообщение', (await evWin().innerText()).includes('поверх экрана — окно-сообщение'));
await evWin().getByLabel('Не переходить на экран — только действия').check();
check('stay и popup — одно из двух', !(await evWin().getByLabel('Не переходить на экран — показать окно-сообщение').isChecked()));
await evWin().getByLabel('Не переходить на экран — показать окно-сообщение').check();
check('…и обратно', !(await evWin().getByLabel('Не переходить на экран — только действия').isChecked()));
await win.screenshot({path: shot('events-popup')});
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const ev = passageText('Внимание экипажу');
check('событие: первая строка <<sg-event popup …>>', /^<<sg-event popup /.test(ev), ev);
check('в списке — 💬 «Внимание экипажу»', (await evWin().innerText()).includes('💬 Внимание экипажу'));
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 4. «Приложение» → «Общее»: «телефон сам ищет центр» — включено.
await openApp();
await appTab('Общее');
const autoBox = field('Телефон сам ищет центр после входа (без QR «СЕТЬ»)');
check('«Общее»: «Телефон сам ищет центр» — по умолчанию включено', await autoBox.isChecked());

// 5. «Шапка и меню» (Т4-6 Б).
await appTab('Шапка и меню');
await field('Первая строка').fill('{name}');
await field('Вторая строка').fill('ЭНЕРГИЯ {{power}}');
await appWin().getByRole('button', {name: '+ Показатель'}).click();
await win.waitForTimeout(200);
const item = appWin().locator('.signaly-header-item').first();
await field('Подпись', item).fill('РЕАКТОР');
await field('Как показывать', item).selectOption('cells');
await win.waitForTimeout(200);
await field('Квадратиков', item).fill('10');
await field('Квадратиков', item).blur();
await appWin().getByRole('button', {name: '+ Раздел'}).click();
await win.waitForTimeout(200);
const sec = appWin().locator('.signaly-header-sec').first();
await field('Заголовок раздела', sec).fill('Состояние корабля');
await field('Текст', sec).fill('Реактор: {{power}} из 10.');
await field('Заголовок окна (пусто — СВОДКА)').fill('БОРТОВАЯ СВОДКА');
await field('Название на телефоне', appWin().locator('.signaly-menu-row[data-tab=code]')).fill('ВВОД');
await field('Скрыть', appWin().locator('.signaly-menu-row[data-tab=scan]')).check();
await appWin().locator('.signaly-menu-row[data-tab=code]').getByRole('button', {name: '↑'}).click();
await win.waitForTimeout(300);
await win.screenshot({path: shot('header-tab')});
await appWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const g = general();
check(
	'«Приложение»: header — строки, показатель (квадратики 10), раздел, заголовок окна',
	g.header?.title === '{name}' && g.header?.sub === 'ЭНЕРГИЯ {{power}}' && g.header?.items?.[0]?.var === 'power' && g.header?.items?.[0]?.show === 'cells' && g.header?.items?.[0]?.max === 10 &&
		g.header?.items?.[0]?.label === 'РЕАКТОР' && g.header?.info?.[0]?.text === 'Реактор: {{power}} из 10.' && g.header?.infoTitle === 'БОРТОВАЯ СВОДКА',
	JSON.stringify(g.header)
);
check('menu: «Код» первым как «ВВОД», «Сканер» скрыт', g.menu?.[0]?.tab === 'code' && g.menu?.[0]?.label === 'ВВОД' && g.menu?.find(m => m.tab === 'scan')?.hidden === true, JSON.stringify(g.menu));

// 6. Предпросмотр телефона: шапка и меню.
const phone = win.frameLocator('.signaly-phone-frame iframe');
await field('Персонаж').selectOption({label: '№1 Инженер Тест'});
await win.waitForTimeout(2500);
check('предпросмотр: первая строка {name}, вторая — {{power}} = 5', (await phone.locator('#bar-name').innerText()).includes('Инженер Тест') && (await phone.locator('#bar-prof').innerText()).includes('ЭНЕРГИЯ 5'), await phone.locator('#bar').innerText());
check('предпросмотр: 5 горящих квадратиков из 10', (await phone.locator('#bar-vars .cells i').count()) === 10 && (await phone.locator('#bar-vars .cells i.on').count()) === 5);
const tabs = await phone.locator('#tabs button:not([hidden])').allInnerTexts();
check('предпросмотр: меню — ВВОД первым, без «Сканера»', tabs[0] === 'ВВОД' && !tabs.includes('СКАНЕР'), tabs.join(' '));
await phone.locator('#bar-name').click();
await win.waitForTimeout(500);
check('предпросмотр: нажатие на шапку — «БОРТОВАЯ СВОДКА» с разделом', (await phone.locator('#dlg.on').innerText()).includes('Реактор: 5 из 10'), await phone.locator('body').innerText());
await win.screenshot({path: shot('header-preview')});
await appWin().getByRole('button', {name: 'Закрыть'}).click().catch(() => {});
await win.waitForTimeout(600);

// 7. Код телефона AMP1: «когда энергия ≥ 8» (Т4-5 А).
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Коды$/}).first().click();
await win.waitForTimeout(1200);
const codesWin = win.locator('.signaly-sounds-window');
await codesWin.locator('.signaly-kinds-item', {hasText: 'AMP1'}).click();
await win.waitForTimeout(300);
await codesWin.getByRole('button', {name: '+ Условие'}).click();
await win.waitForTimeout(200);
const wrow = codesWin.locator('.signaly-when-row').first();
await field('Условие', wrow).selectOption('>=');
await field('Значение', wrow).fill('8');
await field('Ответ, если условие не выполнено', codesWin).fill('Мало энергии: {{power}}');
check('подсказка ответа: «Можно {{имя}}»', (await codesWin.innerText()).includes('Можно {{имя}} — значение общей переменной'));
await win.screenshot({path: shot('code-when')});
await codesWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const amp = phoneOf(passageText('Коды'), 'AMP1');
check('AMP1: when power ≥ 8 и ответ «нет доступа»', JSON.stringify(amp?.when) === JSON.stringify([{var: 'power', op: '>=', value: '8'}]) && amp?.whenText === 'Мало энергии: {{power}}', JSON.stringify(amp));
await win.keyboard.press('Escape');
await win.waitForTimeout(500);

// 8. Пакет: шапка, меню, условие — на месте.
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(300);
}
await openApp();
await appWin().getByRole('button', {name: 'Опубликовать пакет (.sgpack)'}).click();
await win.waitForTimeout(3000);
if (await appWin().getByRole('button', {name: 'Собрать всё равно'}).count()) {
	console.log('проверка: ' + (await appWin().locator('.signaly-app-publish').innerText()).slice(0, 600));
	await appWin().getByRole('button', {name: 'Собрать всё равно'}).click();
}
await win.waitForFunction(() => /\.sgpack/.test(document.querySelector('.signaly-app-message')?.textContent || ''), null, {timeout: 20000});
const built = fs.readdirSync(game).find(f => f.endsWith('.sgpack'));
const pack = JSON.parse(strFromU8(unzipSync(fs.readFileSync(path.join(game, built)))['game.json']));
check(
	'в пакете: header, menu и when у AMP1',
	pack.header?.items?.[0]?.max === 10 && pack.menu?.[0]?.label === 'ВВОД' && pack.codes.find(c => c.code === 'AMP1')?.when?.[0]?.value === '8',
	JSON.stringify({h: pack.header, m: pack.menu})
);

await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
