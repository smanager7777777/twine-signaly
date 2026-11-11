// Проверка программы (Electron), сессия 17, шаг 4.4: кнопка «Статья», форма,
// новый раздел, «Убрать статью»; блок «Список статей» и его форма, предпросмотр;
// список в меню «Доступа»; раздел «Статьи» в оформлении; ответ 7А: переименование
// экрана чинит команды СИГНАЛОВ.
// Запуск: TWEE=<шаблон> MEDIA=<папка с пустышками> SHOT=<снимок.png>
//   xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/electron-articles.mjs <playwright>
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(path.resolve('package.json'));
const {_electron: electron} = require(process.argv[2] || 'playwright');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'signaly-articles-'));
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
	fs
		.readFileSync(process.env.TWEE, 'utf8')
		.replace(/\s*$/, '\n') +
		`
:: Цель {"position":"100,1500","size":"100,100"}
Текст статьи

:: Меню {"position":"200,1500","size":"100,100"}
Меню статей

:: Другая [sg-article] {"position":"300,1500","size":"100,100"}
<<sg-article title "Другая статья" section "ИНТЕРКОМ" order 2>>\\
Текст

:: Ссылки {"position":"400,1500","size":"100,100"}
<<link "Вперёд" "Старое имя">><</link>>
<<sg-timer "Часы" seconds 5 goto "Старое имя" hidden>>
<<if setup.visits("Старое имя") gt 0>>был<</if>>
[[Обычная|Старое имя]]

:: Старое имя {"position":"500,1500","size":"100,100"}
Экран

:: Ключи [sg-keys] {"position":"600,1500","size":"100,100"}
<<sg-key "Shift+Z+Q" "Туда" goto "Старое имя">><</sg-key>>
`
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
const closeDialogs = async () => {
	for (const close of await win.locator('.dialog-card-header-controls button[aria-label="Закрыть"]').all()) {
		await close.click().catch(() => {});
		await win.waitForTimeout(200);
	}
};
const openPassage = async name => {
	await closeDialogs();
	await win.locator('.passage-card').filter({has: win.locator('h2', {hasText: new RegExp(`^${name}$`)})}).dblclick();
	await win.waitForTimeout(800);
};
const panel = () => win.locator('.signaly-block-panel');
const unfocus = () => win.evaluate(() => document.activeElement.blur());
const select = async (label, value) => {
	await unfocus();
	await panel().getByLabel(label, {exact: true}).selectOption(value);
	await win.waitForTimeout(1500);
};
const fill = async (label, value) => {
	await unfocus();
	await panel().getByLabel(label, {exact: true}).fill(value);
	await win.waitForTimeout(1500);
};
const text = name => passageIn(storyFile(), name).text;

/* Кнопка «Статья» */
await openPassage('Цель');
await win.getByRole('button', {name: /^Статья$/}).click();
await win.waitForTimeout(1800);

let t = text('Цель');

check('первая строка — команда, текст остался', t === '<<sg-article>>\\\nТекст статьи', t);
check('тег sg-article', /tags="[^"]*sg-article/.test(passageIn(storyFile(), 'Цель').tag), passageIn(storyFile(), 'Цель').tag);
check('движок 27 поставлен', storyFile().includes('Версия движка: 27'));
check('подсказка с именем экрана', (await panel().getByText('Пусто — как имя экрана («Цель»)').count()) === 1);

await fill('Название в списке', 'Гибернация');
await select('Раздел', 'ИНТЕРКОМ');
await fill('Порядок', '3');
await fill('Своя надпись ссылки «Назад»', 'К списку');
t = text('Цель');
check('команда записана', t.startsWith('<<sg-article title "Гибернация" section "ИНТЕРКОМ" order 3 back "К списку">>\\\n'), t);

await unfocus();
await panel().getByLabel('Раздел', {exact: true}).selectOption({label: 'Новый раздел…'});
await win.waitForTimeout(300);
await fill('Название раздела', 'ПЕРСЕФОНА, новая');
check('новый раздел, запятая убрана', text('Цель').includes('section "ПЕРСЕФОНА  новая"'), text('Цель'));
await win.screenshot({path: shot('article')});

/* Щелчок по команде открывает форму */
await closeDialogs();
await openPassage('Цель');
await win.getByRole('button', {name: /^Статья$/}).click();
await win.waitForTimeout(800);
check('форма читает обратно', (await panel().getByLabel('Название в списке', {exact: true}).inputValue()) === 'Гибернация' && (await panel().getByLabel('Порядок', {exact: true}).inputValue()) === '3');
check('нажатие на открытую статью не дублирует команду', text('Цель').match(/<<sg-article/g).length === 1);

/* Список статей */
await openPassage('Меню');
await win.locator('.signaly-format-toolbar').getByRole('button', {name: /Добавить блок/}).click();
await win.locator('.menu-button-menu').getByText('Список статей').click();
await win.waitForTimeout(1800);
check('блок вставлен', text('Меню').includes('<<sg-articles columns 1 headings>>'), text('Меню'));
check('форма блока: счёт статей', (await panel().getByText('Сейчас в списке 2 статьи').count()) === 1, await panel().innerText());
await unfocus();
await panel().getByLabel('Все разделы', {exact: true}).uncheck();
await win.waitForTimeout(1500);
check('разделы на выбор', (await panel().getByLabel('ИНТЕРКОМ', {exact: true}).count()) === 1 && text('Меню').includes('sections '), text('Меню'));
await unfocus();
await panel().getByLabel('ИНТЕРКОМ', {exact: true}).check();
await win.waitForTimeout(1500);
await select('Статьи показывать', 'button');
await select('Вид', 'amber');
const cols = panel().getByRole('textbox', {name: /^Столбцов/});

await unfocus();
await cols.fill('2');
await cols.press('Enter');
await win.waitForTimeout(1500);
t = text('Меню');
check('форма записана', /<<sg-articles sections "[^"]*ИНТЕРКОМ[^"]*" columns 2 headings form button kind amber>>|form button/.test(t) && t.includes('kind amber') && t.includes('columns 2'), t);
await win.screenshot({path: shot('list')});

await closeDialogs();
await openPassage('Меню');
await win.getByRole('button', {name: 'Предпросмотр'}).click();
await win.waitForTimeout(3000);

const frame = win.frameLocator('.signaly-passage-preview iframe');
const buttons = await frame.locator('.sg-art-item button').allTextContents();

check('предпросмотр показывает список настоящим SugarCube', buttons.includes('Другая статья') && (await frame.locator('.sg-art-heading').count()) > 0, JSON.stringify(buttons));
await win.screenshot({path: shot('preview')});
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(400);
await openPassage('Другая');
await win.getByRole('button', {name: 'Предпросмотр'}).click();
await win.waitForTimeout(3000);
check('предпросмотр статьи: внизу «Назад»', (await frame.locator('.sg-art-back a').allTextContents()).join() === 'Назад');
await win.locator('.signaly-passage-preview').getByRole('button', {name: /Закрыть/}).click();
await win.waitForTimeout(400);

/* «Доступ» статьи видит список */
await closeDialogs();
await openPassage('Другая');
await win.getByRole('button', {name: /^Доступ/}).click();
await win.waitForTimeout(1800);

const rows = (await panel().locator('.signaly-field-label, label').allInnerTexts()).join('|');

check('статья из списка — в меню «Что ведёт на этот экран»', rows.includes('Кнопка «Другая статья» на экране Меню'), rows);
await select('Кнопка «Другая статья» на экране Меню', 'off');
check('правило источника записано', text('Другая').includes('<<sg-rule link "Другая статья" from "Меню" do off>>'), text('Другая'));

/* Убрать статью */
await closeDialogs();
await openPassage('Цель');
await win.getByRole('button', {name: /^Статья$/}).click();
await win.waitForTimeout(800);
await unfocus();
await panel().getByRole('button', {name: 'Убрать статью'}).click();
await win.waitForTimeout(1800);
check('«Убрать статью» возвращает текст и снимает тег', text('Цель').trim() === 'Текст статьи' && !/sg-article/.test(passageIn(storyFile(), 'Цель').tag), text('Цель'));
await closeDialogs();

/* Оформление */
await win.getByRole('tab', {name: 'История'}).click();
await win.locator('.route-toolbar').getByRole('button', {name: /Оформление/}).click();
await win.waitForTimeout(1200);

const dlg = win.locator('[role=dialog][aria-label="Оформление терминала"]');

await dlg.getByLabel('Надпись ссылки «Назад»', {exact: true}).fill('Выход');
await dlg.getByLabel('«Назад» кнопкой', {exact: true}).check();
await dlg.getByRole('button', {name: 'Сохранить'}).click();
await win.waitForTimeout(1500);
await dlg.getByRole('button', {name: 'Закрыть', exact: true}).click();
await win.waitForTimeout(800);
check('надпись и кнопка записаны в таблицу стилей', storyFile().includes('--sg-article-back: "Выход";') && storyFile().includes('--sg-article-button: 1;'));

/* Переименование */
await openPassage('Старое имя');
await win.locator('.dialog-card, [class*=dialog]').getByRole('button', {name: /Переименовать/}).first().click();
await win.waitForTimeout(500);
await win.locator('.card-button-card input, input[type=text]').last().fill('Новое имя');
await win.keyboard.press('Enter');
await win.waitForTimeout(2000);
await closeDialogs();

const links = text('Ссылки');
const keys = text('Ключи');

check('Twine: [[…]]', links.includes('[[Обычная|Новое имя]]'), links);
check('<<link>>', links.includes('<<link "Вперёд" "Новое имя">>'), links);
check('goto таймера', links.includes('goto "Новое имя" hidden'), links);
check('условие заходов', links.includes('setup.visits("Новое имя")'), links);
check('горячая клавиша', keys.includes('goto "Новое имя"'), keys);
check('старого имени не осталось', !links.includes('Старое имя') && !keys.includes('Старое имя'));

await app.close();
const failed = results.filter(ok => !ok).length;

console.log(failed ? `Ошибок: ${failed} из ${results.length}` : `ВСЁ ХОРОШО: ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
