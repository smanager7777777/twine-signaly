// Проверка шага 3.5 в Chromium: события.
// Тестовая история — шаблон + пассажи-события (тег sg-event, <<sg-event …>>):
// переход, когда условие стало верным (после щелчка, сам по себе, после ввода
// кода); один раз; повтор (было ложным → стало верным); задержка (идёт в фоне,
// переживает сбой, отменяется, если условие снова ложно); важность и очередь
// (с экрана события не уводит); «Вернуться на экран, где были»; открытое окно
// закрывается; счётчик заходов на экраны (условие и «Значение»); «сотрудник
// ввёл код» (личный код спрашивается, в событии, «Условии» и «Если»);
// «Новая игра» стирает всё.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node events-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [ещё игра.html …]
// Пишет events-test.twee|html в папку с медиа; «ещё игра.html» — та же
// тестовая история, опубликованная в другом месте (обычный Twine).
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {writeCodes, defaultTexts} = require(path.join(tools, 'signaly-codes.js'));

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const entry = (code, label) => ({code, label, who: [], once: '', title: '', answer: '', goto: '', denied: '', used: '', actions: [], multiline: false, extra: []});
const codesText = writeCodes('', {
	texts: defaultTexts,
	people: [
		{id: '2', pin: '222', variable: '', extra: []},
		{id: '3', pin: '333', variable: '', extra: []}
	],
	codes: [entry('101', 'Конверт 1'), entry('102', 'Конверт 2'), entry('103', 'Конверт 3'), {...entry('500', 'Для всех'), title: 'Ответ', answer: 'Принято'}]
});
const back = '<<link "Назад">><<sg-back>><</link>>';
const initRe = /(:: StoryInit[^\n]*\n)/;
const test =
	story
		.replace(initRe, '$1<<set $evChapter to 1>>\n<<set $evRepaired to false>>\n<<set $evHot to false>>\n<<set $iff to 0>>\n')
		.replace(/\s*$/, '\n') +
	`
:: Коды [sg-codes] {"position":"0,0","size":"100,100"}
${codesText}

:: EvHome {"position":"100,0","size":"100,100"}
Дом
<<link "Глава 2">><<set $evChapter to 2>><</link>>
<<link "Починить">><<set $evRepaired to true>><</link>>
<<link "Перегрев">><<set $evHot to true>><</link>>
<<link "Остыть">><<set $evHot to false>><</link>>
<<link "Проверка">><<if setup.visits("EvRoom") gt 0 and not setup.entered("3", "102")>><<set $iff to 1>><<else>><<set $iff to 2>><</if>><</link>>
<<sg-code button "OK" table>>
<</sg-code>>

:: EvChapter2 [sg-event] {"position":"200,0","size":"100,100"}
<<sg-event $evChapter is 2 and $evRepaired>>
Событие: глава 2 ${back}

:: EvHot [sg-event] {"position":"300,0","size":"100,100"}
<<sg-event repeat delay 2 $evHot>>
Перегрев! ${back}

:: EvEnv [sg-event] {"position":"400,0","size":"100,100"}
<<sg-event priority 5 setup.entered("2", "101") and setup.entered("2", "103")>>
Конверты 1 и 3 ${back}

:: EvVisits [sg-event] {"position":"500,0","size":"100,100"}
<<sg-event setup.visits("EvRoom") gte 3>>
Третий заход ${back}

:: EvRoom {"position":"600,0","size":"100,100"}
<span class="sg-value">Заходов: <<= setup.visits("EvRoom")>></span>

:: EvHigh [sg-event] {"position":"700,0","size":"100,100"}
<<sg-event priority 2 $evChapter is 3>>
Важное ${back}

:: EvLow [sg-event] {"position":"800,0","size":"100,100"}
<<sg-event $evChapter is 3>>
Обычное ${back}

:: EvCond {"position":"900,0","size":"100,100"}
<<if setup.entered("3", "102")>>ДА<<else>>НЕТ<</if>>
`;

fs.writeFileSync(path.join(gameDir, 'events-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'events-test.twee'), path.join(gameDir, 'events-test.html')]);

const types = {html: 'text/html; charset=utf-8', jpg: 'image/jpeg', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2'};
const server = http
	.createServer((req, res) => {
		const file = path.join(gameDir, decodeURIComponent(req.url.split('?')[0]));
		if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream'});
		fs.createReadStream(file).pipe(res);
	})
	.listen(0);
const base = `http://localhost:${server.address().port}/`;
const results = [];
const check = (name, ok, more = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !more ? '' : ' — ' + more}`);
};
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];

async function open(url, page) {
	if (!page) {
		page = await browser.newPage({viewport: {width: 1920, height: 1080}});
		page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
		page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	}
	await page.goto(url);
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(300);
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	return page;
}

const go = async (page, name) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(400);
};
const v = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const link = async (page, text) => {
	await page.click(`.passage a:text-is("${text}")`);
	await page.waitForTimeout(400);
};
async function enter(page, value, which = 0) {
	const field = (await page.$$('.passage input.sg-code'))[which];

	await field.fill(value);
	await field.press('Enter');
	await page.waitForTimeout(400);
}
const pinShown = async page => (await page.$$('.passage input.sg-code')).length === 2;

async function newChecks(url, prefix) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const page = await open(url);

	await go(page, 'EvHome');
	say('условие ложно — терминал остаётся на экране', (await passage(page)) === 'EvHome');
	await link(page, 'Глава 2');
	say('одно из двух условий — ещё ничего', (await passage(page)) === 'EvHome');

	// Окно открыто, переменная меняется не щелчком — проверка сама по себе.
	await page.evaluate(() => {
		SugarCube.Dialog.create('Окно');
		SugarCube.Dialog.append('текст');
		SugarCube.Dialog.open();
	});
	await page.evaluate(() => (SugarCube.State.variables.evRepaired = true));
	await page.waitForTimeout(500);
	say('условие стало верным — переход на событие, окно закрыто', (await passage(page)) === 'EvChapter2' && !(await page.evaluate(() => SugarCube.Dialog.isOpen())));
	say('откуда пришли — $sgEventFrom', (await v(page, 'sgEventFrom')) === 'EvHome');
	say('строка <<sg-event>> на экране ничего не выводит', (await page.innerText('.passage')).trim() === 'Событие: глава 2 Назад');
	await link(page, 'Назад');
	await page.waitForTimeout(400);
	say('«Вернуться на экран, где были» — обратно на EvHome, событие один раз', (await passage(page)) === 'EvHome');
	await page.evaluate(() => {
		SugarCube.State.variables.evChapter = 1;
	});
	await page.waitForTimeout(300);
	await link(page, 'Глава 2');
	await page.waitForTimeout(300);
	say('один раз: условие снова верно — не повторяется', (await passage(page)) === 'EvHome' && (await v(page, 'sgEvents')).EvChapter2.done === 1);

	// Повтор и задержка.
	await link(page, 'Перегрев');
	await page.waitForTimeout(900);
	say('задержка 2 с: через 1 с ещё на месте', (await passage(page)) === 'EvHome');
	await page.waitForTimeout(1200);
	say('через 2 с — событие', (await passage(page)) === 'EvHot');
	await link(page, 'Назад');
	await page.waitForTimeout(2500);
	say('условие осталось верным — не повторяется', (await passage(page)) === 'EvHome');
	await link(page, 'Остыть');
	await link(page, 'Перегрев');
	await page.waitForTimeout(2400);
	say('повтор: было ложным, стало верным — снова через 2 с', (await passage(page)) === 'EvHot');
	await link(page, 'Назад');
	await link(page, 'Остыть');
	await link(page, 'Перегрев');
	await page.waitForTimeout(700);
	await link(page, 'Остыть');
	await page.waitForTimeout(2000);
	say('условие снова ложно до конца отсчёта — отсчёт отменён', (await passage(page)) === 'EvHome');

	// Задержка переживает сбой.
	await link(page, 'Перегрев');
	await page.waitForTimeout(700);
	await open(url, page);
	const due = (await v(page, 'sgEvents')).EvHot?.due;
	say('после сбоя: тот же экран, отсчёт продолжается', (await passage(page)) === 'EvHome' && typeof due === 'number', JSON.stringify(await v(page, 'sgEvents')));
	await page.waitForTimeout(Math.max(0, due - (await page.evaluate(() => Date.now()))) + 500);
	say('после сбоя событие пришло по времени окончания', (await passage(page)) === 'EvHot');
	await link(page, 'Назад');
	await link(page, 'Остыть');

	// Коды сотрудников.
	await enter(page, '101');
	say('код из условия «сотрудник ввёл код» спрашивает личный код', await pinShown(page));
	await enter(page, '222', 1);
	await enter(page, '102');
	await enter(page, '222', 1);
	say('$sgEntered помнит коды сотрудника', JSON.stringify(await v(page, 'sgEntered')) === JSON.stringify({2: ['101', '102']}), JSON.stringify(await v(page, 'sgEntered')));
	say('конверты 1 и 2 — события нет', (await passage(page)) === 'EvHome');
	await enter(page, '500');
	say('код без условий — одним шагом, ответ', !(await pinShown(page)) && (await page.innerText('#ui-dialog-body')).trim() === 'Принято');
	await page.evaluate(() => SugarCube.Dialog.close());
	await enter(page, '103');
	await enter(page, '222', 1);
	say('конверты 1 и 3 — событие', (await passage(page)) === 'EvEnv');
	await link(page, 'Назад');

	// «Условие» на экране и «Если» у действия.
	await go(page, 'EvCond');
	say('«Условие» на экране: сотрудник 3 не вводил 102 — «иначе»', (await page.innerText('.passage')).trim() === 'НЕТ');
	await go(page, 'EvHome');
	await enter(page, '102');
	await enter(page, '333', 1);
	await go(page, 'EvCond');
	say('ввёл — показывается текст условия', (await page.innerText('.passage')).trim() === 'ДА');
	await go(page, 'EvHome');
	await link(page, 'Проверка');
	say('«Если» у действия: заходов в EvRoom 0 — «иначе»', (await v(page, 'iff')) === 2);

	// Заходы на экраны.
	await go(page, 'EvRoom');
	say('«Значение»: число заходов', (await page.innerText('.passage .sg-value')).trim() === 'Заходов: 1');
	await go(page, 'EvHome');
	await go(page, 'EvRoom');
	say('второй заход — 2', (await page.innerText('.passage .sg-value')).trim() === 'Заходов: 2' && (await passage(page)) === 'EvRoom');
	await go(page, 'EvHome');
	await go(page, 'EvRoom');
	await page.waitForTimeout(300);
	say('третий заход — событие «заходил не меньше 3 раз»', (await passage(page)) === 'EvVisits' && (await v(page, 'sgEventFrom')) === 'EvRoom');
	await link(page, 'Назад');
	say('«Вернуться» — на EvRoom (четвёртый заход)', (await passage(page)) === 'EvRoom' && (await page.evaluate(() => SugarCube.setup.visits('EvRoom'))) === 4);
	await go(page, 'EvHome');

	// Важность и очередь.
	await page.evaluate(() => (SugarCube.State.variables.evChapter = 3));
	await page.waitForTimeout(500);
	say('два события сразу — первым более важное', (await passage(page)) === 'EvHigh');
	await page.waitForTimeout(800);
	say('с экрана события терминал не уводит', (await passage(page)) === 'EvHigh' && (await v(page, 'sgEvents')).EvLow?.ready === 1);
	await link(page, 'Назад');
	await page.waitForTimeout(400);
	say('ушли с экрана события — следующее', (await passage(page)) === 'EvLow' && (await v(page, 'sgEventFrom')) === 'EvHome');
	await link(page, 'Назад');
	say('«Вернуться» — на экран до событий', (await passage(page)) === 'EvHome');
	await page.waitForTimeout(600);
	say('больше событий нет', (await passage(page)) === 'EvHome');

	// Сбой: отметки на месте.
	const marks = JSON.stringify(await v(page, 'sgEvents'));
	const visits = JSON.stringify(await v(page, 'sgVisits'));

	await open(url, page);
	await page.waitForTimeout(600);
	say('после сбоя: отметки и заходы те же, событие не повторяется', JSON.stringify(await v(page, 'sgEvents')) === marks && JSON.stringify(await v(page, 'sgVisits')) === visits && (await passage(page)) === 'EvHome', `${JSON.stringify(await v(page, 'sgVisits'))} / ${visits}`);

	// Новая игра стирает всё.
	await page.keyboard.down('z');
	await page.keyboard.down('Shift');
	await page.keyboard.press('KeyN');
	await page.keyboard.up('Shift');
	await page.keyboard.up('z');
	await page.waitForTimeout(300);
	await page.click('#ui-dialog-body .sg-new-game-yes');
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(400);
	say('«Новая игра» стирает отметки, заходы, коды', Object.keys((await v(page, 'sgEvents')) ?? {}).length === 0 && (await v(page, 'sgEntered')) === undefined && (await page.evaluate(() => SugarCube.setup.visits('EvRoom'))) === 0);
	await go(page, 'EvHome');
	await link(page, 'Глава 2');
	await link(page, 'Починить');
	await page.waitForTimeout(300);
	say('после новой игры событие снова срабатывает', (await passage(page)) === 'EvChapter2');
	await page.close();
}

await newChecks(base + 'events-test.html', '');
for (const file of extra) {
	await newChecks(base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
