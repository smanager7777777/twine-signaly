// Проверка программы (Electron), сессия 40 (= П21): формы новых полей приложения П20 (app/05 П-79) — «у каждого своя»
// в окне «Переменные» (Т31-1 А), шапка (размер, «не больше N», долги П19), события у уведомлений и бегущая строка,
// правило по личной «за N мин» и «тому, у кого сработало», «После ввода» и тестировщик; движок 36.
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack-p20.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t9.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t9-'));
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

// 1. Пакет П20 в историю: личная $hacks — строка <<sg-personal>> в StoryInit.
await openApp();
await appWin().locator('input[type=file]').setInputFiles({name: 'СЕТЬ-ТЕСТ-v20.sgpack', mimeType: 'application/zip', buffer: fs.readFileSync(path.join(packs, 'app-test-net-pack-p20.sgpack'))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
await appWin().getByRole('button', {name: 'Загрузить в историю'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
await win.waitForTimeout(2500);
check('пакет загружен, движок 36', passageText('Приложение').includes('<<app-general>>') && storyFile().includes('Версия движка: 36'));
check('StoryInit: <<sg-personal "hacks" by …>> (у каждого своя)', passageText('StoryInit').includes(`<<sg-personal "hacks" by '{"aT":1}' max '{"aT":5}'>>`), passageText('StoryInit').slice(0, 800));

// 2. «Шапка и меню»: размер и «не больше N показателей» (долги П19), «-» во второй строке — в подсказке.
await appTab('Шапка и меню');
await field('Размер шапки').selectOption('compact');
await field('В шапке не больше N показателей').fill('2');
await field('В шапке не больше N показателей').blur();
check('подсказка второй строки: «-» — без второй строки', (await appWin().innerText()).includes('«-» — без второй строки'));
check('у показателя — «За N минут»', (await appWin().getByLabel('За N минут', {exact: true}).count()) > 0);
await win.screenshot({path: shot('header')});

// 3. «События» → «Уведомления»: поля события и бегущая строка.
await appTab('Сеть и события');
await appWin().getByRole('button', {name: /^Новости/}).first().click();
await win.waitForTimeout(300);
check('у «Новости»: в бегущую строку, картинка ev.png', (await field('В бегущую строку').isChecked()) && (await field('Картинка').inputValue()) === 'ev.png');
await field('Проходов строки').fill('3');
await field('Проходов строки').blur();
check('настройки бегущей строки: реклама «Реклама 1», «Реклама 2» отмечены', (await field('Реклама 1').isChecked()) && (await field('Реклама 2').isChecked()));
await field('Последних событий по кругу').fill('4');
await field('Последних событий по кругу').blur();
await win.screenshot({path: shot('notices')});
await appWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const g = general();
check('шапка: size compact, maxItems 2', g.header?.size === 'compact' && g.header?.maxItems === 2, JSON.stringify(g.header).slice(0, 400));
check('бегущая строка: k 4, реклама та же', g.ticker?.k === 4 && JSON.stringify(g.ticker?.ads) === '["n4","n5"]', JSON.stringify(g.ticker));
const notices = [...passageText('Приложение').matchAll(/<<app-notice>>(.*?)<<\/app-notice>>/g)].map(m => JSON.parse(m[1].replace(/&lt;/g, '<')));
check('«Новости»: проходов 3', (notices.find(n => n.id === 'n2') || {}).repeat === 3, JSON.stringify(notices.find(n => n.id === 'n2')));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(600);

// 4. «Переменные»: у каждого своя — таблица «персонаж — начальное — максимум».
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Переменные$/}).first().click();
const vw = () => win.getByRole('dialog', {name: 'Переменные'});
await vw().waitFor();
await vw().getByRole('button', {name: /\$hacks/}).first().click();
await win.waitForTimeout(300);
check('$hacks: «у каждого своя» отмечено', await vw().getByLabel('У каждого своя (личная)', {exact: true}).isChecked());
const maxT = vw().getByLabel(/^Максимум — №7/);
check('таблица: максимум у №7 Психолог Тест — 5', (await maxT.inputValue()) === '5');
await vw().getByLabel(/^Начальное — №1/).fill('3');
await maxT.fill('6');
await win.screenshot({path: shot('variables')});
await vw().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);
check('StoryInit: by {aT:1, aA:3}, max {aT:6}', passageText('StoryInit').includes(`<<sg-personal "hacks" by '{"aT":1,"aA":3}' max '{"aT":6}'>>`), (/<<sg-personal[^\n]*/.exec(passageText('StoryInit')) || [''])[0]);
await vw().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 5. «События» → условие на телефонах по личной: «за N мин», «тому, у кого сработало».
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await win.waitForTimeout(300);
await field('Название (для мастера)', evWin()).fill('Частые взломы');
await field('Когда', evWin()).selectOption('var');
await win.waitForTimeout(200);
await field('Общая переменная', evWin()).selectOption('hacks');
await field('Условие', evWin()).selectOption('>=');
await field('Значение', evWin()).fill('3');
await field('За N минут', evWin()).fill('2');
await field('За N минут', evWin()).blur();
check('у личной — «Чья личная»', (await field('Чья личная', evWin()).count()) === 1);
await evWin().locator('select').filter({hasText: 'Убрать из бегущей строки'}).last().selectOption('notify');
await win.waitForTimeout(300);
await field('Кому', evWin()).last().selectOption('hit');
await win.screenshot({path: shot('rule')});
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const rules = () => [...passageText('Приложение').matchAll(/<<app-rule>>(.*?)<<\/app-rule>>/g)].map(m => JSON.parse(m[1].replace(/&lt;/g, '<')));
const hr = rules().find(x => x.name === 'Частые взломы') || {};
check('правило: var hacks >= 3 за 2 мин, уведомление «тому, у кого сработало»', hr.on === 'var' && hr.var === 'hacks' && hr.win === 2 && hr.actions?.[0]?.type === 'notify' && hr.actions[0].to === 'hit', JSON.stringify(hr));
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 6. «Коды»: «После ввода» у кода NOWB — «сразу»; тестировщик у №7.
check('код NOWB: после ввода — сразу (now) сохранено из пакета', phoneOf(passageText('Коды'), 'NOWB')?.after === 'now');
check('персонаж №7: тестировщик', /<<sg-person "7"[^\n]*"tester":true/.test(passageText('Коды')));

await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
