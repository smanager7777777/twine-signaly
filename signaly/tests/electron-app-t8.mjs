// Проверка программы (Electron), сессия 39 (= П17): «События» — правило «на самом телефоне» в фоне: «не в приложении дольше N с»
// и «когда работает» (Т8-6 Б); «Приложение» → «Приборы» — скрытый прибор (Т8-5 А); движок 36 (сетевой модуль с запасным центром).
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t8.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t8-'));
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
check('пакет загружен, движок 36', passageText('Приложение').includes('<<app-general>>') && storyFile().includes('Версия движка: 36'));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(600);

// 2. «События» → условие на телефонах: «не в приложении дольше 20 с», только при включённом экране → вспышка.
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await win.waitForTimeout(300);
await field('Название (для мастера)', evWin()).fill('Отвлёкся');
await field('Когда', evWin()).selectOption('phone');
await win.waitForTimeout(200);
await field('Что случилось', evWin()).selectOption('away');
await field('Дольше, с', evWin()).fill('20');
await field('Дольше, с', evWin()).blur();
await field('Когда работает', evWin()).selectOption('on');
await evWin().locator('select').filter({hasText: 'Вспышка (фонарик)'}).last().selectOption('torch');
await win.waitForTimeout(300);
await win.screenshot({path: shot('events-away')});
check('в списке — «📱 экран включён, но игрок не в приложении…»', (await evWin().innerText()).includes('📱 экран включён, но игрок не в приложении'));
check('подсказка: следит служба Android', (await evWin().innerText()).includes('Следит служба Android'));
check('«Выполняет: сам телефон»', (await evWin().innerText()).includes('Выполняет: сам телефон'));
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const rules = () => [...passageText('Приложение').matchAll(/<<app-rule>>(.*?)<<\/app-rule>>/g)].map(m => JSON.parse(m[1].replace(/&lt;/g, '<')));
const arule = rules().find(x => x.name === 'Отвлёкся') || {};
check('правило: on phone, away, 20 с, только при включённом экране, вспышка', arule.on === 'phone' && arule.sensor === 'away' && arule.seconds === 20 && arule.screen === 'on' && arule.actions?.[0]?.type === 'torch', JSON.stringify(arule));
await field('Когда работает', evWin()).selectOption('');
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);
check('«всегда» — поле не пишется', !('screen' in (rules().find(x => x.name === 'Отвлёкся') || {screen: 1})) || (rules().find(x => x.name === 'Отвлёкся') || {}).screen === '', JSON.stringify(rules().find(x => x.name === 'Отвлёкся')));
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 3. «Приложение» → «Приборы»: скрытый прибор (Т8-5 А).
await openApp();
await appTab('Приборы');
await appWin().getByLabel('Скрытый: открывается только кодом (сразу на экране), после выхода не виден').check();
await win.waitForTimeout(200);
await win.screenshot({path: shot('apps-hidden')});
await appWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const devs = [...passageText('Приложение').matchAll(/<<app-device>>(.*?)<<\/app-device>>/g)].map(m => JSON.parse(m[1].replace(/&lt;/g, '<')));
check('прибор отмечен скрытым (hidden) в пассаже «Приложение»', devs.length > 0 && devs[0].hidden === true, JSON.stringify(devs[0]));
// 4. Предпросмотр: плеер приложения П17 (скрытые блоки и программы знает).
check('плеер предпросмотра — П17', fs.readFileSync('public/signaly-app/player.html', 'utf8').includes('openSecret') && fs.readFileSync('public/signaly-app/player.html', 'utf8').includes('phoneConfig'));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
