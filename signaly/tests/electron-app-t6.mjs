// Проверка программы (Electron), сессия 37 (= П15): окно-сообщение события — свой заголовок и «Принято» (Т6-2 Б),
// условие на телефонах «упёрлась в предел», «Шапка и меню» — строки по главам (Т6-3 Б), порог тревоги и вид шкалы
// (Т6-4 Б), пределы общих переменных, вкладка меню с главы и кому (Т6-5 Б), режим отказа «когда» (Т6-7 Б).
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t6.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t6-'));
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
check('пакет загружен, движок 35', passageText('Приложение').includes('<<app-general>>') && storyFile().includes('Версия движка: 35'));
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

// 3. «События»: окно-сообщение со своим заголовком и «Принято»; условие на телефонах «упёрлась в предел».
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await field('Название нового события (экран)', evWin()).fill('Пробой');
await evWin().getByRole('button', {name: '+ Условие на терминале'}).click();
await win.waitForTimeout(300);
await evWin().getByLabel('Не переходить на экран — показать окно-сообщение').check();
await win.waitForTimeout(200);
check('popup: «Закрыть только кнопкой «Принято»» отмечено само', await evWin().getByLabel('Закрыть только кнопкой «Принято»').isChecked());
await field('Заголовок окна', evWin()).fill('ТРЕВОГА');
await win.waitForTimeout(200);
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await win.waitForTimeout(300);
await field('Название (для мастера)', evWin()).fill('Реактор полон');
await field('Когда', evWin()).selectOption('limit');
await win.waitForTimeout(200);
await field('Общая переменная', evWin()).selectOption('power');
await field('Предел', evWin()).selectOption('max');
await win.screenshot({path: shot('events-limit')});
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const ev = passageText('Пробой');
check('событие: <<sg-event popup title "ТРЕВОГА" ack …>>', /^<<sg-event popup title "ТРЕВОГА" ack /.test(ev), ev.slice(0, 120));
const rule = (/<<app-rule>>(.*?)<<\/app-rule>>/g.exec([...passageText('Приложение').matchAll(/<<app-rule>>.*?<<\/app-rule>>/g)].map(m => m[0]).find(x => x.includes('Реактор полон')) || '') || [])[1];
const r = rule ? JSON.parse(rule) : {};
check('правило «упёрлась в предел»: on limit, power, max', r.on === 'limit' && r.var === 'power' && r.side === 'max', rule);
check('в списке — «$power — предел»', (await evWin().innerText()).includes('$power — предел'));
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 4. «Шапка и меню»: строки главы 2, показатель-черточки по ширине с перегрузкой, порог тревоги, пределы, меню.
await openApp();
await appTab('Шапка и меню');
await appWin().getByRole('button', {name: '+ Строки для главы'}).click();
await win.waitForTimeout(200);
const hch = appWin().locator('.signaly-header-ch').first();
await field('Вторая строка', hch).fill('ГЛАВА 2 · {prof}');
await field('Заголовок окна-сводки', hch).fill('СВОДКА ГЛАВЫ 2');
await appWin().getByRole('button', {name: '+ Показатель'}).click();
await win.waitForTimeout(200);
const it1 = appWin().locator('.signaly-header-item').first();
await field('Подпись', it1).fill('РЕАКТОР');
await field('Как показывать', it1).selectOption('cells');
await win.waitForTimeout(200);
await field('Квадратиков', it1).fill('4');
await field('Квадратиков', it1).blur();
await field('Вид делений', it1).selectOption('bar');
await field('Шкала по ширине экрана', it1).check();
await field('Перегрузка', it1).check();
await appWin().getByRole('button', {name: '+ Показатель'}).click();
await win.waitForTimeout(200);
const it2 = appWin().locator('.signaly-header-item').nth(1);
await field('Из скольких', it2).fill('10');
await field('Тревога, если меньше', it2).fill('6');
await win.waitForTimeout(200);
check('порог задан — появился «Цвет тревоги»', (await it2.innerText()).includes('Цвет тревоги'));
const lim = appWin().locator('.signaly-limit-row[data-var=power]');
await field('Не меньше', lim).fill('0');
await field('Не больше', lim).fill('10');
const scanRow = appWin().locator('.signaly-menu-row[data-tab=scan]');
await field('С главы', scanRow).selectOption('2');
await win.waitForTimeout(300);
await win.screenshot({path: shot('header-p15'), fullPage: true});
await appWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const g = general();
const i1 = g.header?.items?.[0] ?? {};
const i2 = g.header?.items?.[1] ?? {};
check('шапка: строки главы 2', g.header?.chapters?.[0]?.chapter === 2 && g.header.chapters[0].sub === 'ГЛАВА 2 · {prof}' && g.header.chapters[0].infoTitle === 'СВОДКА ГЛАВЫ 2', JSON.stringify(g.header?.chapters));
check('показатель: черточки 4, по ширине, перегрузка; второй — тревога ниже 6', i1.max === 4 && i1.look === 'bar' && i1.fit === true && i1.over === true && i2.low === 6 && i2.max === 10, JSON.stringify(g.header?.items));
check('пределы: power 0…10', JSON.stringify(g.limits) === JSON.stringify([{var: 'power', min: 0, max: 10}]), JSON.stringify(g.limits));
check('меню: «Сканер» с главы 2', g.menu?.find(m => m.tab === 'scan')?.chapter === 2, JSON.stringify(g.menu));

// 5. Предпросмотр: перегрузка, тревога, меню и строки по главам.
const phone = win.frameLocator('.signaly-phone-frame iframe');
await field('Персонаж').selectOption({label: '№1 Инженер Тест'});
await win.waitForTimeout(2500);
check('предпросмотр: 5 > 4 — перегрузка (первая черточка сбоит), по ширине', (await phone.locator('#bar-vars .hv-bar.hv-fit.hv-over .cells i.ov').count()) === 1);
check('предпросмотр: 5/10 ниже 6 — тревога', (await phone.locator('#bar-vars .hv.hv-low').count()) === 1);
const tabs1 = await phone.locator('#tabs button:not([hidden])').allInnerTexts();
check('предпросмотр, глава 1: «Сканера» нет', !tabs1.includes('СКАНЕР'), tabs1.join(' '));
await win.screenshot({path: shot('preview-ch1')});
await field('Глава').selectOption('2');
await win.waitForTimeout(2500);
const tabs2 = await phone.locator('#tabs button:not([hidden])').allInnerTexts();
check('предпросмотр, глава 2: «Сканер» есть, вторая строка главы', tabs2.includes('СКАНЕР') && (await phone.locator('#bar-prof').innerText()).includes('ГЛАВА 2'), tabs2.join(' ') + ' / ' + (await phone.locator('#bar-prof').innerText()));
await win.screenshot({path: shot('preview-ch2')});
await appWin().getByRole('button', {name: 'Закрыть'}).click().catch(() => {});
await win.waitForTimeout(600);

// 6. Код AMP1: «когда» и режим отказа.
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
await field('Если условие не выполнено', codesWin).selectOption('wrong');
await win.waitForTimeout(200);
check('режим «как неверный код» — поля ответа нет', (await field('Ответ, если условие не выполнено', codesWin).count()) === 0);
await field('Если условие не выполнено', codesWin).selectOption('inactive');
await win.waitForTimeout(200);
await win.screenshot({path: shot('code-when-mode')});
await codesWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const amp = phoneOf(passageText('Коды'), 'AMP1');
check('AMP1: whenMode inactive', amp?.whenMode === 'inactive' && amp?.when?.[0]?.value === '8', JSON.stringify(amp));
await win.keyboard.press('Escape');
await win.waitForTimeout(500);

// 7. Пакет.
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
	'в пакете: пределы, правило limit, шапка главы, меню, whenMode',
	pack.limits?.[0]?.max === 10 && pack.rules.some(x => x.on === 'limit' && x.var === 'power') && pack.header?.chapters?.[0]?.chapter === 2 &&
		pack.menu.find(m => m.tab === 'scan')?.chapter === 2 && pack.codes.find(c => c.code === 'AMP1')?.whenMode === 'inactive',
	JSON.stringify({l: pack.limits, h: pack.header?.chapters})
);

await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
