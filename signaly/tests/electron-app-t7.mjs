// Проверка программы (Electron), сессия 38 (= П16): «События» — правило «на самом телефоне» (основа 2); «Шапка и меню» — слои перезаполнения шкалы (предел — деления × слои),
// нажатие на части шапки (Т6-8 Б: имя, глава, показатель), окно главы; предпросмотр телефона — слои и нажатия.
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t7.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t7-'));
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

// 2а. «События» → условие на телефонах «на самом телефоне» (основа 2): экраном вниз дольше 3 с → вспышка.
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await win.waitForTimeout(300);
await field('Название (для мастера)', evWin()).fill('Экраном вниз');
await field('Когда', evWin()).selectOption('phone');
await win.waitForTimeout(200);
await field('Что случилось', evWin()).selectOption('facedown');
await field('Дольше, с', evWin()).fill('3');
await field('Дольше, с', evWin()).blur();
await evWin().locator('select').filter({hasText: 'Вспышка (фонарик)'}).last().selectOption('torch');
await win.waitForTimeout(300);
await win.screenshot({path: shot('events-phone')});
check('в списке — «📱 положили экраном вниз»', (await evWin().innerText()).includes('📱 положили экраном вниз'));
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const prule = [...passageText('Приложение').matchAll(/<<app-rule>>(.*?)<<\/app-rule>>/g)].map(m => JSON.parse(m[1].replace(/&lt;/g, '<'))).find(x => x.name === 'Экраном вниз') || {};
check('правило: on phone, facedown, 3 с, вспышка этому телефону', prule.on === 'phone' && prule.sensor === 'facedown' && prule.seconds === 3 && prule.actions?.[0]?.type === 'torch' && prule.actions[0].to === 'self' && prule.actions[0].n === 3, JSON.stringify(prule));
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);
// 3. «Шапка и меню»: шкала 2 деления, 3 слоя (обычный, цвет, сбой); нажатия; окно главы 1.
await openApp();
await appTab('Шапка и меню');
await appWin().getByRole('button', {name: '+ Строки для главы'}).click();
await win.waitForTimeout(200);
const hch = appWin().locator('.signaly-header-ch').first();
await field('С главы', hch).selectOption('1');
await field('Окно по нажатию на главу', hch).fill('ОКНО ГЛАВЫ: энергия {{power}}');
await appWin().getByRole('button', {name: '+ Показатель'}).click();
await win.waitForTimeout(200);
const it1 = appWin().locator('.signaly-header-item').first();
await field('Подпись', it1).fill('ЗАРЯД');
await field('Как показывать', it1).selectOption('cells');
await win.waitForTimeout(200);
await field('Квадратиков', it1).fill('2');
await field('Квадратиков', it1).blur();
await win.waitForTimeout(200);
check('без слоёв — есть «Перегрузка»', (await field('Перегрузка', it1).count()) === 1);
await it1.getByRole('button', {name: '+ Слой'}).click();
await win.waitForTimeout(200);
await it1.getByRole('button', {name: '+ Слой'}).click();
await win.waitForTimeout(200);
check('два нажатия «+ Слой» — три слоя (обычный, свой цвет, сбой)', (await it1.locator('.signaly-header-layer').count()) === 3 && (await field('Слой 3 (5…6)', it1).inputValue()) === 'glitch');
check('со слоями «Перегрузки» нет, предел по слоям 6', (await field('Перегрузка', it1).count()) === 0 && (await it1.innerText()).includes('Предел по слоям: 6'));
await field('По нажатию на показатель', it1).selectOption('text');
await win.waitForTimeout(200);
await field('Заголовок окна', it1).fill('РЕАКТОР');
await field('Текст окна', it1).fill('Заряд {{power}} из 6.');
await field('По нажатию на имя', appWin()).selectOption('none');
await win.waitForTimeout(300);
await win.screenshot({path: shot('header-p16'), fullPage: true});
await appWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const g = general();
const i1 = g.header?.items?.[0] ?? {};
check('в истории: слои, нажатие на показатель и на имя, окно главы',
	JSON.stringify((i1.layers || []).map(x => x.fx)) === '["fill","color","glitch"]' && i1.layers[1].color === '#ffaa00' && i1.tap?.kind === 'text' && i1.tap.title === 'РЕАКТОР' &&
		g.header?.taps?.who?.kind === 'none' && g.header?.chapters?.[0]?.about === 'ОКНО ГЛАВЫ: энергия {{power}}', JSON.stringify(g.header));
// 4. Предпросмотр: 5 при шкале 2 × 3 слоя — третий слой, одно деление сбоит; нажатия.
const phone = win.frameLocator('.signaly-phone-frame iframe');
await field('Персонаж').selectOption({label: '№1 Инженер Тест'});
await win.waitForTimeout(2500);
const bar = phone.locator('#bar-vars .hv.hv-layers');
check('предпросмотр: третий слой, одно деление сбоит, другое — второго слоя (свой цвет)',
	(await bar.getAttribute('data-layer')) === '3' && (await bar.locator('.cells i.ov').count()) === 1 && (await bar.locator('.cells i[data-l="2"]').count()) === 1);
await bar.click();
await win.waitForTimeout(400);
check('нажатие на показатель — своё окно', (await phone.locator('#dlg.on .dlg-title').innerText()) === 'РЕАКТОР' && (await phone.locator('#dlg.on .dlg-text').innerText()).includes('Заряд 5 из 6'));
await phone.locator('#dlg .dlg-btns .btn').last().click();
await win.waitForTimeout(300);
await phone.locator('#bar-name').click();
await win.waitForTimeout(400);
check('нажатие на имя — ничего (выбрано «ничего»)', (await phone.locator('#dlg.on').count()) === 0);
await phone.locator('#bar-chap').click();
await win.waitForTimeout(400);
check('нажатие на главу — окно главы с {{power}}', (await phone.locator('#dlg.on .dlg-text').innerText()).includes('ОКНО ГЛАВЫ: энергия 5'), await phone.locator('#dlg.on').innerText().catch(() => ''));
await win.screenshot({path: shot('preview-p16')});
await phone.locator('#dlg .dlg-btns .btn').last().click().catch(() => {});
// 5. Пакет.
await openApp().catch(() => {});
await appWin().getByRole('button', {name: 'Опубликовать пакет (.sgpack)'}).click();
await win.waitForTimeout(3000);
if (await appWin().getByRole('button', {name: 'Собрать всё равно'}).count()) {
	console.log('проверка: ' + (await appWin().locator('.signaly-app-publish').innerText()).slice(0, 600));
	await appWin().getByRole('button', {name: 'Собрать всё равно'}).click();
}
await win.waitForFunction(() => /\.sgpack/.test(document.querySelector('.signaly-app-message')?.textContent || ''), null, {timeout: 20000});
const built = fs.readdirSync(game).find(f => f.endsWith('.sgpack'));
const pack = JSON.parse(strFromU8(unzipSync(fs.readFileSync(path.join(game, built)))['game.json']));
check('в пакете: слои, нажатия, окно главы, правило «на телефоне»', pack.rules.some(x => x.on === 'phone' && x.sensor === 'facedown') && pack.header?.items?.[0]?.layers?.length === 3 && pack.header?.taps?.who?.kind === 'none' && pack.header?.chapters?.[0]?.about?.startsWith('ОКНО ГЛАВЫ'), JSON.stringify(pack.header));
await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
