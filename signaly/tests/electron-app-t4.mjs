// Проверка программы (Electron), сессия 35 (= П13, этап Т4 приложения): окно «Переменные» — галочка
// «Общая с телефонами» (<<sg-shared>> в StoryInit); окно «События» — условие на телефонах (правило
// центра «общая переменная») и на терминале (stay и действия <<sg-event-do>>); «Приложение» → «Правила»
// только списком; «Опубликовать пакет» — проверка истории, «Собрать всё равно»; общие переменные в пакете.
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t4.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t4-'));
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
// Окна подтверждения (удалить, закрыть без сохранения) — «да».
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

// Картинка в media/app/ — для строки картинки блока (в тестовом пакете сети картинок нет).
fs.mkdirSync(path.join(game, 'media/app'), {recursive: true});
fs.writeFileSync(path.join(game, 'media/app/forms-test.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

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
const settingsOf = () => {
	const text = passageText('Приложение');
	const general = JSON.parse((/<<app-general>>(.*?)<<\/app-general>>/.exec(text) || [])[1] || '{}');
	const list = macro => [...text.matchAll(new RegExp(`<<${macro}>>(.*?)<</${macro}>>`, 'g'))].map(m => JSON.parse(m[1]));

	return {general, rules: list('app-rule')};
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
const field = (label, scope) => scope.getByLabel(label, {exact: true});

// 1. Пакет сети в историю.
await openApp();
await appWin().locator('input[type=file]').setInputFiles({name: 'СЕТЬ-ТЕСТ-v4.sgpack', mimeType: 'application/zip', buffer: fs.readFileSync(path.join(packs, 'app-test-net-pack.sgpack'))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
await appWin().getByRole('button', {name: 'Загрузить в историю'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
await win.waitForTimeout(2500);
check('пакет загружен, движок 33', passageText('Приложение').includes('<<app-general>>') && storyFile().includes('Версия движка: 33'));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(600);

// 2. «Переменные»: общая с телефонами.
await btn(/^Переменные$/).click();
await win.waitForSelector('.signaly-sounds-window');
const varWin = win.locator('.signaly-sounds-window');
await varWin.getByRole('button', {name: 'Добавить переменную'}).click();
await varWin.getByLabel('Имя (латиницей)').fill('power');
await varWin.getByLabel('Подпись по-русски').fill('Энергия');
await varWin.getByLabel('Начальное значение').fill('5');
await varWin.getByLabel('Общая с телефонами').check();
check('в списке — «общая»', (await varWin.locator('.signaly-kinds-item', {hasText: 'Энергия ($power)'}).innerText()).includes('общая'));
await win.screenshot({path: shot('variables')});
await varWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
const init = passageText('StoryInit');
check('StoryInit: <<set $power to 5>> и <<sg-shared "power">>', init.includes('<<set $power to 5>> /* Энергия */') && init.includes('<<sg-shared "power">>'), init.slice(0, 800));
await varWin.getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 3. «События»: правило центра «общая переменная ≥ 8» и событие терминала «только действия».
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
const evText = await evWin().innerText();
check('окно «События»: две группы — терминал и телефоны', evText.includes('Условие на терминале (') && evText.includes('Условие на телефонах ('), evText.slice(0, 600));
const rulesBefore = settingsOf().rules.length;
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await win.waitForTimeout(300);
check('правило: «Выполняет: центр сети»', (await evWin().innerText()).includes('Выполняет: центр сети (телефон мастера)'));
await field('Название (для мастера)', evWin()).fill('Энергия в норме');
await field('Когда', evWin()).selectOption('var');
await field('Общая переменная', evWin()).selectOption('power');
await field('Условие', evWin()).selectOption('>=');
await field('Значение', evWin()).fill('8');
await evWin().getByLabel('Добавить действие телефона').selectOption('notify');
await win.waitForTimeout(300);
await field('Заголовок (если без шаблона)', evWin()).fill('ЭНЕРГИЯ {{power}}').catch(() => {});
await win.screenshot({path: shot('events-rule')});
await field('Название нового события (экран)', evWin()).fill('Реактор пуст');
await evWin().getByRole('button', {name: '+ Условие на терминале'}).click();
await win.waitForTimeout(300);
check('событие: «Выполняет: терминал»', (await evWin().innerText()).includes('Выполняет: терминал (Twine)'));
await evWin().getByLabel('Не переходить на экран — только действия').check();
await evWin().getByLabel('Добавить действие').last().selectOption('net');
await win.waitForTimeout(300);
await win.screenshot({path: shot('events-term')});
check('пока не сохранено — в истории ничего нет', settingsOf().rules.length === rulesBefore && !passageText('Реактор пуст'));
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const rule = settingsOf().rules.find(r => r.name === 'Энергия в норме');
check('правило записано: on var, power ≥ 8, действие', rule && rule.on === 'var' && rule.var === 'power' && rule.op === '>=' && rule.value === '8' && rule.actions.length === 1 && rule.actions[0].type === 'notify', JSON.stringify(rule));
const ev = passageText('Реактор пуст');
check('событие терминала: пассаж, stay, <<sg-event-do>> с «Телефонам»', /^<<sg-event stay /.test(ev) && /<<sg-event-do>>[\s\S]*<<sg-net notify "ТЕРМИНАЛ"/.test(ev) && /<tw-passagedata[^>]*name="Реактор пуст"[^>]*tags="sg-event"/.test(storyFile()), ev);
check('в списке — ⚡ «Реактор пуст» и 📱 «Энергия в норме»', (await evWin().innerText()).includes('⚡ Реактор пуст') && (await evWin().innerText()).includes('📱 Энергия в норме'));
// ошибка для проверки перед публикацией: правило без переменной
await evWin().getByRole('button', {name: '+ Условие на телефонах'}).click();
await field('Название (для мастера)', evWin()).fill('Без переменной');
await field('Когда', evWin()).selectOption('var');
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(500);

// 4. «Приложение»: правила только списком; «Опубликовать пакет» — проверка.
await openApp();
await appWin().getByRole('tab', {name: 'Сеть и события', exact: true}).click();
await appWin().getByRole('tab', {name: /^Правила/}).click();
await win.waitForTimeout(300);
const rulesText = await appWin().innerText();
check('«Сеть и события» → «Правила»: список и ссылка на окно «События»', rulesText.includes('Энергия в норме · $power не меньше 8') && rulesText.includes('правятся в окне «События»'), rulesText.slice(0, 1500));
await appWin().getByRole('button', {name: 'Опубликовать пакет (.sgpack)'}).click();
await appWin().locator('.signaly-app-publish').waitFor({timeout: 15000});
const pub = await appWin().locator('.signaly-app-publish').innerText();
check('публикация: ошибка — список, пакет не собран', pub.includes('Пакет не собран') && pub.includes('Правило «Без переменной»: общей переменной «» нет') && !fs.readdirSync(game).some(f => f.endsWith('.sgpack')), pub);
await win.screenshot({path: shot('publish-errors')});
await appWin().getByRole('button', {name: 'Собрать всё равно'}).click();
await win.waitForFunction(() => /\.sgpack/.test(document.querySelector('.signaly-app-message')?.textContent || ''), null, {timeout: 20000});
const built = fs.readdirSync(game).find(f => f.endsWith('.sgpack'));
const pack = JSON.parse(strFromU8(unzipSync(fs.readFileSync(path.join(game, built)))['game.json']));
check('«Собрать всё равно»: пакет в папке игры, в сообщении — сколько ошибок', !!built && (await appWin().locator('.signaly-app-message').innerText()).includes('хотя проверка нашла ошибки (1)'), built);
check('в пакете: shared power = 5 («Энергия») и правило var', JSON.stringify(pack.shared) === JSON.stringify([{name: 'power', label: 'Энергия', value: 5}]) && pack.rules.some(r => r.on === 'var' && r.var === 'power'), JSON.stringify(pack.shared));
await appWin().getByRole('button', {name: 'Закрыть'}).click();

// 5. Ошибку убрали — публикуется сразу.
await win.locator('button.icon-button', {hasText: /^События$/}).first().click();
await evWin().waitFor();
await evWin().locator('.signaly-kinds-item', {hasText: 'Без переменной'}).click();
await evWin().getByRole('button', {name: 'Удалить правило'}).click();
await evWin().getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2000);
await evWin().getByRole('button', {name: 'Закрыть'}).click();
await openApp();
await appWin().getByRole('button', {name: 'Опубликовать пакет (.sgpack)'}).click();
await win.waitForFunction(() => /\.sgpack/.test(document.querySelector('.signaly-app-message')?.textContent || ''), null, {timeout: 20000});
const msg = await appWin().locator('.signaly-app-message').innerText();
check('без ошибок: «Проверка истории: …» и пакет собран', /Проверка истории: (ошибок нет|ошибок и предупреждений нет)/.test(msg) && !(await appWin().locator('.signaly-app-publish').count()), msg);
await win.screenshot({path: shot('publish-ok')});

// 6. Пакет с другим начальным значением — StoryInit берёт его (загрузка в историю).
const changed = {...pack, shared: [{name: 'power', label: 'Энергия', value: 9}, {name: 'oxygen', label: 'Кислород', value: 21}]};
const {zipSync, strToU8} = require('fflate');
await appWin().locator('input[type=file]').setInputFiles({name: 'v-next.sgpack', mimeType: 'application/zip', buffer: Buffer.from(zipSync({'game.json': strToU8(JSON.stringify(changed))}))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
const diff = await appWin().locator('.signaly-app-pending').innerText();
check('отличия: «Общие переменные» — добавлено $oxygen, изменено $power', diff.includes('Общие переменные:') && diff.includes('$oxygen') && diff.includes('$power'), diff);
await appWin().getByRole('button', {name: 'Заменить'}).click();
await win.waitForTimeout(2500);
const init2 = passageText('StoryInit');
check('StoryInit: $power = 9, $oxygen = 21, обе общие', init2.includes('<<set $power to 9>>') && init2.includes('<<set $oxygen to 21>>') && init2.includes('<<sg-shared "power" "oxygen">>'), init2.slice(0, 900));

await app.close();
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
