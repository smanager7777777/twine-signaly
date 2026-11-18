// Проверка программы (Electron), сессия 34 (= П12, окончание этапа Т3 приложения): вкладки окна
// «Приложение» «Блоки» (дерево папок, переименование папки, «+ Блок в папку», открыть пассаж),
// «QR» (JPG в QR/ папки игры), «SSTV» (картинка → WAV с проверкой декодером, код звуком);
// профиль персонажа у сотрудника; «+ Картинка» туда, где курсор; «Проверка истории» — раздел
// «Приложение для телефонов».
// Запуск: TWEE=<шаблон> PACKS=<папка с app-test-net-pack.sgpack> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-app-t3b.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const {unzipSync, strFromU8} = require('fflate');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-t3b-'));
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
await appWin().getByRole('button', {name: 'Телефон'}).click();   // без предпросмотра — шире формы

// 2. «Блоки»: дерево, переименование папки, новый блок.
const names = () => [...storyFile().matchAll(/<tw-passagedata[^>]*name="([^"]*)"[^>]*tags="[^"]*app-block/g)].map(m => m[1]);
const before = names();

await appTab('Блоки');
await win.waitForTimeout(500);
const tree = await appText();

check('Блоки: корень со счётчиком всех блоков', tree.includes(`Все блоки (без папки) (${before.length})`), tree.slice(0, 600));
await field('Название нового блока').fill('Склад/Опись');
await appWin().getByRole('button', {name: '+ Блок в эту папку'}).click();
await win.waitForTimeout(2500);
check('«+ Блок» с «/» в названии — блок в новой папке', names().includes('Склад/Опись') && /^<<app-block "b[a-z0-9]+">>/.test(passageText('Склад/Опись')), names().join(' | '));
await appWin().locator('.signaly-app-folder', {hasText: /^📁 Склад \(1\)/}).click();
await field('Название нового блока').fill('Новый из дерева');
await appWin().getByRole('button', {name: '+ Блок в эту папку'}).click();
await win.waitForTimeout(2500);
check('«+ Блок в эту папку»: Склад/Новый из дерева', names().includes('Склад/Новый из дерева') && (await appText()).includes('📁 Склад (2)'), names().join(' | '));
await field('Новое имя папки').fill('Папка Т3');
await appWin().getByRole('button', {name: 'Переименовать папку'}).click();
await win.waitForTimeout(2500);
const after = names();

check('папка переименована целиком (имена пассажей)', after.includes('Папка Т3/Опись') && after.includes('Папка Т3/Новый из дерева') && !after.some(n => n.startsWith('Склад/')), after.join(' | '));
check('дерево: «Папка Т3 (2)», всего блоков +2', (await appText()).includes('📁 Папка Т3 (2)') && (await appText()).includes(`Все блоки (без папки) (${before.length + 2})`), (await appText()).slice(0, 500));
await win.screenshot({path: shot('blocks')});

// 3. «QR»: один код и все отмеченные — JPG в QR/ папки игры.
await appTab('QR');
await field('Код').fill('4242');
await win.waitForTimeout(500);
check('QR: картинка на холсте', (await appWin().locator('canvas.signaly-app-qr').evaluate(c => c.width)) >= 256);
await field('Цвета').selectOption({label: 'Чёрный на белом (для печати)'});
await field('Подпись под кодом').selectOption({label: 'сам код'});
await appWin().getByRole('button', {name: 'Сохранить JPG'}).click();
await win.waitForTimeout(1500);
const qrDir = path.join(game, 'QR');
const jpg = f => fs.readFileSync(path.join(qrDir, f)).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));

check('QR: QR/QR-4242.jpg — JPEG', fs.existsSync(path.join(qrDir, 'QR-4242.jpg')) && jpg('QR-4242.jpg'));
const all = await appWin().getByRole('button', {name: /^Сохранить отмеченные/}).innerText();
const n = Number((/\((\d+)\)/.exec(all) || [])[1]);

await appWin().getByRole('button', {name: /^Сохранить отмеченные/}).click();
await win.waitForFunction(() => /Картинок сохранено: \d{2}/.test(document.querySelector('.signaly-app-window')?.textContent || ''), null, {timeout: 30000});
const files = fs.readdirSync(qrDir).filter(f => f.endsWith('.jpg'));

check(`QR: отмеченные (${n}) сохранены, коды входа среди них, мастерский — нет`, n > 3 && files.length >= n && files.some(f => f.startsWith('QR-111111')) && !files.some(f => f.startsWith('QR-98765432')), files.join(', ') + ' | ' + (await appWin().locator('.signaly-notice').last().innerText().catch(() => '')));
const qrText = await appText();

check('QR: группы — коды, приборы, входы, мастер', ['Коды (терминал и телефоны)', 'Коды приборов', 'Коды входа персонажей', 'Мастер (по умолчанию не отмечены)'].every(t => qrText.includes(t)), qrText.slice(0, 1200));
await win.screenshot({path: shot('qr')});

// 4. «SSTV»: картинка → звук, проверка декодером, в папку игры; код звуком.
await appTab('SSTV');
await win.waitForTimeout(800);
await field('Картинка (media/app/ и media/img/ папки игры)').selectOption('media/app/forms-test.png');
await field('Режим SSTV').selectOption('Robot 36');
await field('Метка перед картинкой (код, необязательно)').fill('7301');
await appWin().getByRole('button', {name: 'Сделать звук', exact: true}).click();
await win.waitForFunction(() => /Проверка декодером терминала|ПРОВЕРКА НЕ ПРОШЛА/.test(document.querySelector('.signaly-app-window')?.textContent || ''), null, {timeout: 60000});
const sstvText = await appText();

check('SSTV: декодер терминала прочитал звук (Robot 36)', /Проверка декодером терминала: Robot 36, \d+ строк/.test(sstvText), sstvText.slice(0, 900));
check('SSTV: метка 7301 слышна', sstvText.includes('Метка «7301» слышна'), sstvText.slice(0, 900));
await appWin().getByRole('button', {name: /^В папку игры \(media\/audio\/sstv\/\)/}).first().click();
await win.waitForTimeout(1500);
const sstvDir = path.join(game, 'media/audio/sstv');
const wavs = fs.existsSync(sstvDir) ? fs.readdirSync(sstvDir) : [];

check('SSTV: WAV в media/audio/sstv/', wavs.some(f => /forms-test Robot36 метка 7301\.wav$/.test(f)) && fs.readFileSync(path.join(sstvDir, wavs[0])).subarray(0, 4).toString() === 'RIFF', wavs.join(', '));
await field('Код').fill('4242');
await appWin().getByRole('button', {name: 'Сделать звук кода'}).click();
await win.waitForTimeout(800);
check('Код звуком: проверка — код слышен', (await appText()).includes('Проверка: код слышен.'));
await appWin().getByRole('button', {name: /^В media\/app\//}).last().click();
await win.waitForTimeout(1500);
check('Код звуком: WAV в media/app/', fs.existsSync(path.join(game, 'media/app/Код 4242.wav')));
await win.screenshot({path: shot('sstv')});
await appWin().getByRole('button', {name: 'Закрыть'}).click();
await win.waitForTimeout(800);

// 5. «Коды» → «Сотрудники»: профиль персонажа (Т3-9 А).
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Коды$/}).first().click();
await win.waitForTimeout(1200);
const codesWin = win.locator('.signaly-sounds-window');

await codesWin.getByRole('tab', {name: /Сотрудники/}).click();
await codesWin.locator('.signaly-kinds-item', {hasText: /Инженер Тест/}).first().click();
await win.waitForTimeout(300);
await codesWin.getByRole('button', {name: '+ Текст'}).click();
await field('Текст', codesWin.locator('.signaly-app-profile')).fill('# Инженер\nДопуск: **отсек 3**');
await codesWin.locator('.signaly-app-profile').getByRole('button', {name: '+ Картинка'}).click();
await field('Подпись', codesWin.locator('.signaly-app-profile')).fill('Фото на пропуск');
await win.screenshot({path: shot('profile')});
await codesWin.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(2500);
const eng = (() => {
	const m = /<<sg-person "1"[^>]*phone '(\{.*?\})'>>/.exec(passageText('Коды'));

	return m ? JSON.parse(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')) : undefined;
})();

check('профиль: текст и картинка из media/app/ у персонажа №1', eng?.items?.length === 2 && eng.items[0].text.startsWith('# Инженер') && eng.items[1].type === 'image' && /\.(png|jpg)$/.test(eng.items[1].file) && eng.items[1].caption === 'Фото на пропуск', JSON.stringify(eng?.items));
await win.keyboard.press('Escape');
await win.waitForTimeout(500);

// 6. «+ Картинка» туда, где курсор (Т3-10 А).
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}
await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: /^Blocktest$/})}).dblclick();
await win.waitForSelector('.signaly-format-toolbar');
await win.waitForTimeout(800);
const cm = (js, arg) => win.evaluate(([j, a]) => new Function('cm', 'a', j)(document.querySelector('.passage-edit-contents .CodeMirror').CodeMirror, a), [js, arg]);
const lines = (await cm('return cm.getValue()')).split('\n');

await cm('cm.focus(); cm.setCursor({line: 1, ch: 0})');
await win.locator('.signaly-format-toolbar').getByRole('button', {name: 'Блок приложения'}).click();
await win.waitForTimeout(800);
const panel = win.locator('.signaly-block-panel');

await panel.getByRole('button', {name: '+ Картинка'}).click();
await win.waitForTimeout(800);
const now = (await cm('return cm.getValue()')).split('\n');

// Курсор был в начале второй строки; сверху добавилась первая строка блока — картинка перед той же строкой.
check('строка картинки встала у курсора, а не в конец', /^<<app-block /.test(now[0]) && now[1] === lines[0] && /^<<app-img "media\/app\//.test(now[2]) && now[3] === lines[1] && now.length === lines.length + 2, now.slice(0, 4).join(' ⏎ ') + ' … ' + now.slice(-2).join(' ⏎ '));
await panel.getByRole('button', {name: 'Готово'}).click().catch(() => {});
await win.waitForTimeout(2000);
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}

// 7. «Блоки» → блок открывает пассаж (окно закрывается).
await openApp();
await appTab('Блоки');
await appWin().locator('.signaly-app-folder', {hasText: /^📁 Папка Т3 \(/}).click();
await appWin().locator('.signaly-app-block-row', {hasText: 'Новый из дерева'}).click();
await win.waitForTimeout(1500);
check('щелчок по блоку: окно «Приложение» закрыто, пассаж открыт', (await appWin().count()) === 0 && (await win.locator('.dialog-card', {hasText: 'Новый из дерева'}).count()) > 0);
while ((await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').count()) > 0) {
	await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').first().click({timeout: 3000}).catch(() => {});
	await win.waitForTimeout(600);
}

// 8. «Проверить историю» — раздел «Приложение для телефонов».
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('button.icon-button', {hasText: /^Проверить историю$/}).first().click();
await win.waitForFunction(() => !/Проверяю…/.test(document.querySelector('.signaly-check-window')?.textContent || 'Проверяю…'), null, {timeout: 20000});
const chk = await win.locator('.signaly-check-window').innerText();

check('проверка: раздел «Приложение для телефонов» — новый закрытый блок без кода', /Приложение для телефонов \(\d+\)/.test(chk) && chk.includes('⚠ Блок «Новый из дерева» закрыт, но ни один код его не открывает'), chk.slice(0, 1500));
await win.screenshot({path: shot('check')});
await win.keyboard.press('Escape');
await app.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
