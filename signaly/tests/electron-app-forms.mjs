// Проверка программы (Electron), сессия 33 (этап Т3 приложения): формы вместо JSON —
// кнопка «Блок приложения» над текстом пассажа, вкладка «На телефоне» и поля телефона у
// сотрудников в окне «Коды», вкладки окна «Приложение» (Общее, Главы и стили, Приборы, Сеть и
// события, Голос), предпросмотр телефона (плеер signaly-app в iframe), сборка пакета после правок
// и повторная загрузка собранного — «совпадает».
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-forms.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-forms-'));
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

	return {general, chapters: list('app-chapter'), glitches: list('app-glitch'), rules: list('app-rule'), apps: list('app-device')};
};
const phoneOf = (codesText, code) => {
	const m = new RegExp(`<<sg-entry "${code}"[^>]*>[\\s\\S]*?<<sg-phone>>(.*)`).exec(codesText);

	return m ? JSON.parse(m[1]) : undefined;
};

const packs = process.env.PACKS || 'src/util/signaly/__tests__/fixtures';
const appWin = () => win.locator('.signaly-app-window');
const appText = () => appWin().innerText();
const openApp = async () => {
	await win.getByRole('tab', {name: 'История'}).click();
	await win.locator('button.icon-button', {hasText: /^Приложение$/}).first().click();
	await appWin().waitFor();
	await win.waitForTimeout(500);
};
const appTab = name => appWin().getByRole('tab', {name, exact: true}).click();
const appSave = async () => {
	await appWin().getByRole('button', {name: 'Сохранить'}).click();
	await win.waitForTimeout(2500);
};
const field = (label, scope = appWin()) => scope.getByLabel(label, {exact: true});

// 1. Пакет в историю.
await openApp();
await appWin().locator('input[type=file]').setInputFiles({name: 'СЕТЬ-ТЕСТ-v4.sgpack', mimeType: 'application/zip', buffer: fs.readFileSync(path.join(packs, 'app-test-net-pack.sgpack'))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
await appWin().getByRole('button', {name: 'Загрузить в историю'}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Загружено'), null, {timeout: 15000});
await win.waitForTimeout(2500);
check('пакет загружен', passageText('Приложение').includes('<<app-general>>'));

// 2. Предпросмотр телефона: плеер в iframe, вход персонажем.
const phone = win.frameLocator('.signaly-phone-frame iframe');

await win.waitForTimeout(2000);
check('предпросмотр: плеер загрузил пакет (экран входа)', /ПРЕДПРОСМОТР/.test(await phone.locator('body').innerText({timeout: 15000})), await phone.locator('body').innerText());
await field('Персонаж').selectOption({label: '№1 Инженер Тест'});
await win.waitForTimeout(2500);
check('предпросмотр: вошёл Инженер Тест', (await phone.locator('body').innerText()).includes('ИНЖЕНЕР ТЕСТ') || (await phone.locator('body').innerText()).includes('Инженер Тест'), await phone.locator('body').innerText());
await win.screenshot({path: shot('preview')});

// 3. Общее: название пакета.
await appTab('Общее');
await field('Название (видно на экране входа)').fill('СЕТЬ-ФОРМЫ');
await field('Имя мастера в чатах').fill('Капитан');
check('несохранённое: «Загрузить» и «Собрать» недоступны', await appWin().getByRole('button', {name: /Собрать пакет/}).isDisabled());
await appSave();
check('Общее → в пассаже «Приложение»: название и имя мастера', settingsOf().general.title === 'СЕТЬ-ФОРМЫ' && settingsOf().general.chat.master === 'Капитан', JSON.stringify(settingsOf().general).slice(0, 400));

// 4. Главы и стили: новая глава.
await appTab('Главы и стили');
await appWin().getByRole('button', {name: '+ Глава'}).click();
await field('Название').fill('Глава три');
await field('Цвет главы для всех').selectOption({label: 'Красный'});
await field('«Расшифровка» сообщений в чатах, секунд').fill('7');
await appSave();
const ch = settingsOf().chapters;
check('Главы: третья глава с кодом, цветом для всех и «расшифровкой»', ch.length === 3 && ch[2].name === 'Глава три' && ch[2].force === 'red' && ch[2].decode === 7 && /^\d{5}$/.test(ch[2].code), JSON.stringify(ch[2]));

// 5. Сеть и события: сбой и правило с действием.
await appTab('Сеть и события');
await appWin().getByRole('tab', {name: /^Сбои и состояния/}).click();
await appWin().getByRole('button', {name: '+ Добавить'}).click();
await field('Название (видно игроку на полосе сверху; его же выбирает терминал)').fill('Сбой формы');
await appWin().getByRole('checkbox', {name: 'темнота'}).check();
await appWin().getByRole('tab', {name: /^Правила/}).click();
await appWin().getByRole('button', {name: '+ Добавить'}).click();
await field('Название события').fill('forms_event');
await field('Добавить действие телефона').selectOption({label: 'Сбой / состояние'});
await win.waitForTimeout(300);
await appWin().locator('.signaly-phone-actions fieldset').last().getByLabel('Сбой / состояние', {exact: true}).selectOption({label: 'Сбой формы'});
await appSave();
const st = settingsOf();
const fg = st.glitches.find(g => g.name === 'Сбой формы');
const rule = st.rules.find(r => r.event === 'forms_event');
check('Сбои: новый сбой с эффектом «темнота»', !!fg && fg.fx.includes('dark'), JSON.stringify(st.glitches));
check('Правила: событие forms_event → сбой «Сбой формы» всем', !!rule && rule.actions[0]?.type === 'glitch' && rule.actions[0].glitch === fg?.id && Array.isArray(rule.actions[0].to), JSON.stringify(rule));
await win.screenshot({path: shot('events')});

// 6. Приборы: код прибора.
await appTab('Приборы');
await appWin().locator('.signaly-kinds-item', {hasText: 'Градусник'}).click();
await appWin().getByRole('button', {name: '+ Код прибора'}).click();
await appSave();
const devId = settingsOf().apps.find(a => a.name === 'Градусник').id;
const devCodes = [...passageText('Коды').matchAll(/<<sg-phone>>(.*)/g)].map(m => JSON.parse(m[1])).filter(d => d.app === devId);
check('Приборы: новый код прибора в «Кодах» (только телефон)', devCodes.length >= 2, devCodes.length);

// 7. Голос: режим микрофона персонажа.
await appTab('Голос');
await field('Связист Тест: микрофон').selectOption('always');
await appSave();
check('Голос: у Связиста «всегда в фоне» и функция «Голос»', /"name":"Связист Тест"[^']*"voiceMode":"always"/.test(passageText('Коды')) || (() => {
	const m = /<<sg-person "\d+" pin "" phone '(\{[^']*Связист Тест[^']*\})'>>/.exec(passageText('Коды'));
	const d = m && JSON.parse(m[1].replace(/\\\\/g, '\\'));

	return !!d && d.voiceMode === 'always' && d.modules.includes('voice');
})(), passageText('Коды').slice(0, 800));
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(800);

// 8. Окно «Коды»: телефонная часть кода и персонаж у нового сотрудника.
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Коды$/}).first().click();
await win.waitForTimeout(1200);
const codesWin = win.locator('.signaly-sounds-window');

await codesWin.locator('.signaly-kinds-item', {hasText: 'AMP1'}).click();
await win.waitForTimeout(300);
check('код AMP1 (только телефон): форма телефона — ограничения', (await codesWin.innerText()).includes('Ограничения выдачи — нужна сеть'), await codesWin.innerText());
await field('Ответ (текст в окне после ввода)', codesWin).fill('Ампула <проверка>');
await codesWin.getByRole('button', {name: 'Добавить код'}).click().catch(async () => codesWin.getByRole('button', {name: /Добавить/}).first().click());
await win.waitForTimeout(300);
await field('Код', codesWin).fill('5151');
await field('Где срабатывает код', codesWin).selectOption({label: 'на терминале и на телефонах'});
await win.waitForTimeout(300);
await codesWin.getByRole('tab', {name: 'На телефоне'}).click();
await field('Добавить действие телефона', codesWin).selectOption({label: 'Уведомление'});
await win.waitForTimeout(300);
await field('Текст (если без шаблона)', codesWin).fill('Код 5151 на телефоне');
await codesWin.getByRole('tab', {name: 'На терминале'}).click();
await win.waitForTimeout(300);
check('код «оба»: вкладка «На терминале» — поля терминала', (await codesWin.innerText()).includes('Кто может ввести') || (await codesWin.innerText()).includes('Ответ'), '');
await win.screenshot({path: shot('codes-both')});
await codesWin.getByRole('tab', {name: /Сотрудники/}).click();
await codesWin.getByRole('button', {name: /Добавить/}).first().click();
await win.waitForTimeout(300);
await codesWin.getByRole('checkbox', {name: 'Персонаж приложения на телефоне'}).check();
await field('Имя (в шапке приложения)', codesWin).fill('Новый Тест');
await field('Голос: с главы', codesWin).selectOption('2');
await win.screenshot({path: shot('person')});
await codesWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const codesText = passageText('Коды');

check('AMP1: новый ответ в <<sg-phone>> (знаки < > — через \\u)', phoneOf(codesText, 'AMP1')?.answer === 'Ампула <проверка>' && !/Ампула <проверка>/.test(codesText), (/AMP1.*/.exec(codesText) || [''])[0]);
check('код 5151 «оба»: where both и уведомление на телефоне', /<<sg-entry "5151"[^>]*where both>>/.test(codesText) && phoneOf(codesText, '5151')?.actions?.[0]?.type === 'notify', (/<<sg-entry "5151"[\s\S]{0,400}/.exec(codesText) || [''])[0]);
check('новый сотрудник — персонаж приложения с кодом входа', /<<sg-person "5" pin "" var "\$progress5" phone '\{[^']*"name":"Новый Тест"[^']*"login":"\d{6}"/.test(codesText) || /<<sg-person "5"[^>]*Новый Тест/.test(codesText), (/<<sg-person "5".*/.exec(codesText) || [''])[0]);
await win.keyboard.press('Escape');
await win.waitForTimeout(500);

// 9. Кнопка «Блок приложения» над текстом пассажа.
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}
await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: /^Blocktest$/})}).dblclick();
await win.waitForSelector('.signaly-format-toolbar');
await win.waitForTimeout(800);
await win.locator('.signaly-format-toolbar').getByRole('button', {name: 'Блок приложения'}).click();
await win.waitForTimeout(800);
const panel = win.locator('.signaly-block-panel');
const cmValue = () => win.evaluate(() => document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror.getValue());

check('форма блока открылась', (await panel.innerText()).includes('Кому виден'), await panel.innerText().catch(() => ''));
await panel.getByRole('checkbox', {name: 'Открыт сразу (без кода)'}).check();
await panel.getByRole('checkbox', {name: '№1 Инженер Тест'}).check();
await field('С какой главы виден', panel).selectOption('2');
await panel.getByRole('button', {name: '+ Картинка'}).click();
await win.waitForTimeout(800);
const value = await cmValue();

check('первая строка блока: who, chapter, start', /^<<app-block "b[a-z0-9]+" who "1" chapter 2 start>>\n/.test(value), value.slice(0, 200));
check('строка картинки из media/app', /<<app-img "media\/app\/[^"]+\.(png|jpg)" "">>/.test(value), value.slice(-200));
await win.screenshot({path: shot('block')});
await panel.getByRole('button', {name: 'Готово'}).click().catch(() => {});
await win.waitForTimeout(2500);
check('у пассажа тег app-block', /<tw-passagedata[^>]*name="Blocktest"[^>]*tags="[^"]*app-block/.test(storyFile()), (/<tw-passagedata[^>]*name="Blocktest"[^>]*>/.exec(storyFile()) || [''])[0]);

// 10. Собрать пакет — всё, что правили формами, в пакете; повторная загрузка — «совпадает».
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}
await openApp();
await appTab('Пакет');
await appWin().getByRole('button', {name: /^Собрать пакет/}).click();
await win.waitForFunction(() => document.querySelector('.signaly-app-message')?.textContent.includes('Собран пакет'), null, {timeout: 15000});
const built = fs.readdirSync(game).filter(f => f.endsWith('.sgpack')).sort().pop();
const zip = unzipSync(fs.readFileSync(path.join(game, built)));
const g = JSON.parse(strFromU8(zip['game.json']));

check('пакет: название, глава 3, сбой, правило', g.title === 'СЕТЬ-ФОРМЫ' && g.chapters.length === 3 && g.glitches.some(x => x.name === 'Сбой формы') && g.rules.some(r => r.event === 'forms_event'), built);
check('пакет: коды 5151 и AMP1, новый персонаж, блок Blocktest', g.codes.some(c => c.code === '5151' && c.actions[0]?.type === 'notify') && g.codes.find(c => c.code === 'AMP1')?.answer === 'Ампула <проверка>' && g.accounts.some(a => a.name === 'Новый Тест' && a.num === '5') && g.blocks.some(b => b.title === 'Blocktest' && b.start && b.chapter === 2), JSON.stringify(g.blocks.map(b => b.title)));
await appWin().locator('input[type=file]').setInputFiles({name: built, mimeType: 'application/zip', buffer: fs.readFileSync(path.join(game, built))});
await appWin().locator('.signaly-app-pending').waitFor({timeout: 15000});
check('повторная загрузка собранного: «совпадает»', (await appText()).includes('Пакет совпадает'), await appText());
await appWin().getByRole('button', {name: 'Отмена'}).click();
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
