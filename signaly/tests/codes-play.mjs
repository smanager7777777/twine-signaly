// Проверка шага 3.4 в Chromium: общая таблица кодов.
// 1) Шаблон сборки 13 (движок 8) и шаблон с движком 9: поля INPUTTEST и
//    PASSWORDTEST работают как раньше (свои коды, переход, окна, ошибка).
// 2) Новое: поле со словом table — сначала свои коды, потом таблица; код для
//    всех — одним шагом; личный код во втором поле; «неверный код», «неверный
//    личный код», «нет доступа» (общий и свой), одноразовые для всех и для
//    каждого («Пусто»), прогресс вводящего, _who и _code в ответе, переход,
//    кнопка второго поля; отметки в автокопии; «Новая игра» их стирает.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node codes-play.mjs <было.twee> <стало.twee> <папка с media> <playwright> [ещё игра.html …]
// Пишет codes-before|after|test.twee|html в папку с медиа; «ещё игра.html» —
// та же тестовая история, опубликованная в другом месте (обычный Twine).
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [beforePath, afterPath, gameDir, playwrightPath, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {writeCodes, defaultTexts} = require(path.join(tools, 'signaly-codes.js'));

const before = fs.readFileSync(beforePath, 'utf8').replace(/\r\n/g, '\n');
const after = fs.readFileSync(afterPath, 'utf8').replace(/\r\n/g, '\n');

const codesText = writeCodes('', {
	texts: defaultTexts,
	people: [
		{id: '3', pin: '417', variable: 'progress3', extra: []},
		{id: 'Иванов', pin: '101', variable: 'ivanov', extra: []},
		{id: '7', pin: '777', variable: '', extra: []}
	],
	codes: [
		{code: '100', label: 'Для всех', who: [], once: '', title: 'Принято', answer: 'Код <<= _code>>', goto: '', denied: '', used: '', actions: [{type: 'set', name: 'a', op: 'add', value: 1}], multiline: true, extra: []},
		{code: '200', label: 'Конверт', who: ['3', 'Иванов'], once: 'each', title: 'Конверт', answer: 'Сотрудник <<= _who>>, откройте конверт 3-<<= $progress3>>', goto: '', denied: '', used: '', actions: [{type: 'progress', amount: 1}], multiline: true, extra: []},
		{code: '300', label: 'Один раз', who: [], once: 'all', title: '', answer: '', goto: 'gotoPSG', denied: '', used: '', actions: [], multiline: false, extra: []},
		{code: '400', label: 'Только Иванову', who: ['Иванов'], once: '', title: 'Иванов', answer: 'Привет, <<= _who>>', goto: '', denied: 'Только Иванову', used: '', actions: [{type: 'progress', amount: 2}], multiline: true, extra: []}
	]
});
const initRe = /(:: StoryInit[^\n]*\n)/;
const test =
	after.replace(initRe, '$1<<set $a to 0>>\n<<set $progress3 to 0>>\n').replace(/\s*$/, '\n') +
	`
:: Коды [sg-codes] {"position":"0,0","size":"100,100"}
${codesText}

:: CodesTest {"position":"100,0","size":"100,100"}
a=$a
<<sg-code button "Подтвердить" table>>
<<sg-case "11111" goto "gotoPSG">>
<</sg-code>>

:: CodesOwnWrong {"position":"200,0","size":"100,100"}
<<sg-code password table>>
<<sg-wrong title "Своя ошибка">>Не то
<</sg-code>>
`;

for (const [name, text] of Object.entries({before, after, test})) {
	fs.writeFileSync(path.join(gameDir, `codes-${name}.twee`), text);
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, `codes-${name}.twee`), path.join(gameDir, `codes-${name}.html`)]);
}

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
	page = page ?? (await browser.newPage({viewport: {width: 1920, height: 1080}}));
	page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
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
	await page.waitForTimeout(300);
};
const v = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const dialog = async page =>
	(await page.$('#ui-dialog.open'))
		? {title: await page.textContent('#ui-dialog-title'), body: (await page.innerText('#ui-dialog-body')).trim()}
		: null;
const closeDialog = async page => {
	await page.evaluate(() => SugarCube.Dialog.isOpen() && SugarCube.Dialog.close());
	await page.waitForTimeout(250);
};
/** Ввести в поле (первое — код, второе — личный код) и нажать Enter. */
async function enter(page, value, which = 0) {
	const field = (await page.$$('.passage input.sg-code'))[which];

	await field.fill(value);
	await field.press('Enter');
	await page.waitForTimeout(350);
}
const pinShown = async page => (await page.$$('.passage input.sg-code')).length === 2;

/* 1. Шаблон: поля кода как раньше */
const runs = [];

for (const file of ['codes-before.html', 'codes-after.html']) {
	const page = await open(base + file);
	const run = {};

	await go(page, 'INPUTTEST');
	await enter(page, '22222');
	run.info = await dialog(page);
	await closeDialog(page);
	await enter(page, '33333');
	run.pre = await dialog(page);
	await closeDialog(page);
	await enter(page, 'xyz');
	run.wrong = await dialog(page);
	await closeDialog(page);
	run.fields = (await page.$$('.passage input.sg-code')).length;
	await enter(page, '11111');
	run.goto = await passage(page);
	await go(page, 'PASSWORDTEST');
	await enter(page, '1');
	run.pwWrong = await dialog(page);
	await closeDialog(page);
	run.pwType = await page.getAttribute('.passage input.sg-code', 'type');
	runs.push(run);
	await page.close();
}

const [old, now] = runs;

check('шаблон: поля кода — те же окна и переход', JSON.stringify(old) === JSON.stringify(now) && now.goto === 'gotoPSG' && now.wrong?.body === 'Неверный код: xyz' && now.fields === 1, `${JSON.stringify(old)} ${JSON.stringify(now)}`);

/* 2. Новое */
async function newChecks(url, label) {
	const page = await open(url);
	const say = (name, ok, more) => check(`${label}${name}`, ok, more);
	let d;

	await go(page, 'CodesTest');
	await enter(page, '11111');
	say('свои коды поля — первыми (11111 → gotoPSG)', (await passage(page)) === 'gotoPSG');

	await go(page, 'CodesTest');
	await enter(page, '100');
	d = await dialog(page);
	say('код для всех — одним шагом: действие и ответ с _code', d?.title === 'Принято' && d.body === 'Код 100' && (await v(page, 'a')) === 1 && !(await pinShown(page)), JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '999');
	d = await dialog(page);
	say('нет в таблице — «Неверный код» (общий)', d?.title === 'Ошибка' && d.body === 'Неверный код', JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '200');
	const prompt = await page.innerText('.passage .sg-code-pin');
	say('код с правами — второе поле «Введите личный код»', (await pinShown(page)) && prompt.includes('Введите личный код') && !(await dialog(page)), prompt);
	say('второе поле — в фокусе, с кнопкой', await page.evaluate(() => document.activeElement === document.querySelectorAll('.passage input.sg-code')[1] && !!document.querySelector('.passage .sg-code-pin button')));
	await enter(page, '999', 1);
	d = await dialog(page);
	say('чужой личный код — «Неверный личный код», второе поле убрано', d?.body === 'Неверный личный код' && !(await pinShown(page)), JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '200');
	await enter(page, '777', 1);
	d = await dialog(page);
	say('код не для этого сотрудника — «Нет доступа» (общий)', d?.title === 'Ошибка' && d.body === 'Нет доступа', JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '400');
	await enter(page, '417', 1);
	d = await dialog(page);
	say('код не для этого сотрудника — свой текст «Нет доступа»', d?.body === 'Только Иванову' && (await v(page, 'progress3')) === 0, JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '200');
	await enter(page, '417', 1);
	d = await dialog(page);
	say('ввёл сотрудник 3: прогресс +1 и «Сотрудник 3, откройте конверт 3-1»', d?.body === 'Сотрудник 3, откройте конверт 3-1' && (await v(page, 'progress3')) === 1, JSON.stringify(d));
	await closeDialog(page);

	await enter(page, '200');
	await enter(page, '417', 1);
	d = await dialog(page);
	say('одноразовый для каждого: повторно — «Пусто»', d?.body === 'Пусто' && (await v(page, 'progress3')) === 1, JSON.stringify(d));
	await closeDialog(page);

	// Иванов вводит тот же код: для него — первый раз. Через кнопку второго поля.
	await enter(page, '200');
	await (await page.$$('.passage input.sg-code'))[1].fill('101');
	await page.click('.passage .sg-code-pin button');
	await page.waitForTimeout(350);
	d = await dialog(page);
	say('для другого сотрудника — работает (кнопка второго поля), прогресс — его', d?.body === 'Сотрудник Иванов, откройте конверт 3-1' && (await v(page, 'ivanov')) === 1 && (await v(page, 'progress3')) === 1, `${JSON.stringify(d)} ${await v(page, 'ivanov')}`);
	await closeDialog(page);

	await enter(page, '400');
	await enter(page, '417', 1);
	d = await dialog(page);
	say('права: «Нет доступа» для 3, Иванову — можно', d?.body === 'Только Иванову', JSON.stringify(d));
	await closeDialog(page);
	await enter(page, '400');
	await enter(page, '101', 1);
	d = await dialog(page);
	say('Иванов: ответ и прогресс +2', d?.title === 'Иванов' && d.body === 'Привет, Иванов' && (await v(page, 'ivanov')) === 3, `${JSON.stringify(d)} ${await v(page, 'ivanov')}`);
	await closeDialog(page);

	await enter(page, '300');
	say('одноразовый для всех: переход без личного кода', (await passage(page)) === 'gotoPSG');
	await go(page, 'CodesTest');
	await enter(page, '300');
	d = await dialog(page);
	say('одноразовый для всех: повторно — «Пусто» сразу', d?.body === 'Пусто' && !(await pinShown(page)) && (await passage(page)) === 'CodesTest', JSON.stringify(d));
	await closeDialog(page);

	const used = await v(page, 'sgUsed');

	say('отметки в $sgUsed', JSON.stringify(used) === JSON.stringify({'200|3': true, '200|Иванов': true, 300: true}), JSON.stringify(used));

	await go(page, 'CodesOwnWrong');
	await enter(page, '555');
	d = await dialog(page);
	say('своё сообщение поля об ошибке — вместо общего', d?.title === 'Своя ошибка' && d.body === 'Не то', JSON.stringify(d));
	await closeDialog(page);
	await enter(page, '200');
	say('второе поле — звёздочки, как у поля', (await page.getAttribute('.passage .sg-code-pin input', 'type')) === 'password');

	await go(page, 'Коды');
	say('экран «Коды» сам по себе ничего не выводит и без ошибок', (await page.innerText('.passage')).trim() === '' && (await page.$$('.passage .error')).length === 0);

	// Сбой: страница перезагружена — отметки и прогресс на месте.
	await go(page, 'CodesTest');
	await page.waitForTimeout(300);
	await open(url, page);
	say('после сбоя: отметки и прогресс восстановлены', JSON.stringify(await v(page, 'sgUsed')) === JSON.stringify(used) && (await v(page, 'progress3')) === 1 && (await passage(page)) === 'CodesTest', JSON.stringify(await v(page, 'sgUsed')));
	await enter(page, '300');
	d = await dialog(page);
	say('после сбоя одноразовый код по-прежнему «Пусто»', d?.body === 'Пусто', JSON.stringify(d));
	await closeDialog(page);

	// Новая игра стирает отметки.
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
	await page.waitForTimeout(300);
	say('«Новая игра» стирает отметки и прогресс', (await v(page, 'sgUsed')) === undefined && (await v(page, 'progress3')) === 0, JSON.stringify(await v(page, 'sgUsed')));
	await go(page, 'CodesTest');
	await enter(page, '300');
	say('после новой игры одноразовый код снова работает', (await passage(page)) === 'gotoPSG');
	await page.close();
}

await newChecks(base + 'codes-test.html', '');
for (const file of extra) {
	await newChecks(base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
