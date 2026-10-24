// Проверка шага 3.2 в Chromium: действия ссылок и кнопок.
// 1) PRCDTEST шаблона: окна <<script>>Dialog.create…<</script>> → <<sg-open>> —
//    то же окно (заголовок, текст, вид — попиксельно) и та же переменная.
// 2) Новые действия: переменные (задать / прибавить / убавить / переключить),
//    звук (громкость, по кругу, плавно, пауза группы), окно-сообщение (текст,
//    пассаж, «только кнопкой», «само через N с»), таймер (запуск, остановка,
//    переход по окончании), [[…][…]], кнопка с переходом, условия «выключена»
//    и «не равна».
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node actions-play.mjs <было.twee> <стало.twee> <папка с media> <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [beforePath, afterPath, gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {writeLink, writeAction} = require(path.join(tools, 'signaly-actions.js'));

const before = fs.readFileSync(beforePath, 'utf8').replace(/\r\n/g, '\n');
const after = fs.readFileSync(afterPath, 'utf8').replace(/\r\n/g, '\n');
const link = (label, actions, more = {}) =>
	writeLink({markup: false, form: 'link', label, passage: '', actions, multiline: false, ...more});
const initRe = /(:: StoryInit[^\n]*\n)/;
const test =
	after.replace(initRe, '$1<<set $n to 0>>\n<<set $f to false>>\n') .replace(/\s*$/, '\n') +
	`
:: ActionsTest {"position":"0,0","size":"100,100"}
<<if not $f>>ВЫКЛ<</if>> <<if $n isnot 6>>НЕ6<</if>> n=$n
${link('переменные', [
	{type: 'set', name: 'n', op: 'to', value: 5},
	{type: 'set', name: 'n', op: 'add', value: 2},
	{type: 'set', name: 'n', op: 'sub', value: 1},
	{type: 'set', name: 'f', op: 'toggle'}
], {passage: 'ActionsTest'})}
${link('звук', [
	{type: 'audio', who: {kind: 'track', id: 'loopcomputer'}, act: 'play', volume: 0.3, loop: true},
	{type: 'audio', who: {kind: 'track', id: 'radioMoonlight'}, act: 'play', volume: 1, loop: true}
])}
${link('тише', [{type: 'audio', who: {kind: 'playing', except: ':TERMINAL'}, act: 'fade', level: 0.1, over: 1}])}
${link('пауза', [{type: 'audio', who: {kind: 'group', id: ':TERMINAL'}, act: 'pause'}])}
${link('окно', [{type: 'dialog', title: 'Окно', passage: '', text: 'Привет $n', close: 'ok', ok: 'Принято'}])}
${link('окно2', [{type: 'dialog', title: 'Из пассажа', passage: 'ActionsInfo', text: '', close: 'time', seconds: 1}])}
${link('таймер', [{type: 'timer', values: {name: 'T1', seconds: 2, goto: 'ActionsDone'}, extra: []}])}
${link('стоп', [{type: 'stop', name: 'T1'}])}
${writeLink({markup: true, form: 'link', label: 'разметка', passage: 'ActionsTest', actions: [{type: 'set', name: 'n', op: 'to', value: 10}], multiline: false})}
${writeLink({markup: false, form: 'button', label: 'кнопка', passage: 'ActionsTest', actions: [{type: 'set', name: 'n', op: 'to', value: 6}], multiline: false})}

:: ActionsInfo {"position":"0,0","size":"100,100"}
Справка из пассажа

:: ActionsDone {"position":"0,0","size":"100,100"}
ТАЙМЕР ВЫШЕЛ
`;

const files = {before, after, test};

for (const [name, text] of Object.entries(files)) {
	fs.writeFileSync(path.join(gameDir, `actions-${name}.twee`), text);
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, `actions-${name}.twee`), path.join(gameDir, `actions-${name}.html`)]);
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

async function open(file) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(`${file}: ${e.message}`));
	await page.goto(base + file);
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(300);
	// Без полного экрана — снимки одинакового размера.
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	return page;
}

const go = (page, name) => page.evaluate(n => SugarCube.Engine.play(n), name);
const v = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const click = async (page, text) => {
	await page.click(`.passage :is(a, button):text-is("${text}")`);
	await page.waitForTimeout(300);
};

/* 1. PRCDTEST до и после переноса */
const shots = [];

for (const file of ['actions-before.html', 'actions-after.html']) {
	const page = await open(file);

	await go(page, 'PRCDTEST');
	await page.waitForTimeout(400);
	await click(page, '002');
	await page.waitForSelector('#ui-dialog.open');
	await page.waitForTimeout(600);
	shots.push({
		prcd: await v(page, 'PRCD'),
		title: await page.textContent('#ui-dialog-title'),
		body: await page.innerText('#ui-dialog-body'),
		png: await page.screenshot({animations: 'disabled'})
	});
	await page.close();
}
const prcdText = after.slice(after.indexOf(':: PRCDTEST'), after.indexOf('\n:: ', after.indexOf(':: PRCDTEST')));

check('PRCDTEST: <<script>> заменён на <<sg-open>>', !prcdText.includes('Dialog.create') && after.includes('<<sg-open "Процедура 002" passage "PRCDRESULT">><</sg-open>>'));
check('PRCDTEST: та же переменная $PRCD = 2', shots[0].prcd === 2 && shots[1].prcd === 2, `${shots[0].prcd} ${shots[1].prcd}`);
check('PRCDTEST: тот же заголовок и текст окна', shots[0].title === shots[1].title && shots[0].body === shots[1].body && shots[1].title === 'Процедура 002', `${shots[0].title}|${shots[1].title}|${shots[0].body}|${shots[1].body}`);

let samePixels = shots[0].png.equals(shots[1].png);

if (!samePixels) {
	try {
		const sharp = require('/opt/npm-tools/node_modules/sharp');
		const [a, b] = await Promise.all(shots.map(s => sharp(s.png).raw().toBuffer()));

		samePixels = a.equals(b);
	} catch (e) {
		console.log('sharp недоступен:', e.message);
	}
}
check('PRCDTEST: открытое окно совпадает попиксельно', samePixels);

/* 2. Новые действия */
const page = await open('actions-test.html');

await go(page, 'ActionsTest');
await page.waitForTimeout(300);

const text = () => page.innerText('.passage');

check('условия «выключена» и «не равна» — показаны', /ВЫКЛ/.test(await text()) && /НЕ6/.test(await text()), await text());
await click(page, 'переменные');
check('переменные: задать 5, +2, −1 → 6; переключить → да', (await v(page, 'n')) === 6 && (await v(page, 'f')) === true, `${await v(page, 'n')} ${await v(page, 'f')}`);
check('после действий — переход на экран (условия скрылись)', !/ВЫКЛ|НЕ6/.test(await text()) && /n=6/.test(await text()), await text());

await click(page, 'звук');
await page.waitForTimeout(300);

const track = id =>
	page.evaluate(i => {
		const t = SugarCube.SimpleAudio.tracks.get(i);

		return {volume: t.volume(), loop: t.loop(), playing: t.isPlaying()};
	}, id);
let loop = await track('loopcomputer');

check('звук: файл включён, громкость 30 %, по кругу', loop.playing && Math.abs(loop.volume - 0.3) < 0.001 && loop.loop, JSON.stringify(loop));
await click(page, 'тише');
await page.waitForTimeout(1600);

const moon = await track('radioMoonlight');

loop = await track('loopcomputer');
check('звук: «всё играющее, кроме :TERMINAL» плавно к 10 %', Math.abs(moon.volume - 0.1) < 0.02 && Math.abs(loop.volume - 0.3) < 0.001, `${JSON.stringify(moon)} ${JSON.stringify(loop)}`);
await click(page, 'пауза');
loop = await track('loopcomputer');
check('звук: пауза группы :TERMINAL', !loop.playing && (await track('radioMoonlight')).playing, JSON.stringify(loop));

await click(page, 'окно');
await page.waitForSelector('#ui-dialog.open');

const dlg = await page.evaluate(() => ({
	title: document.querySelector('#ui-dialog-title').textContent,
	body: document.querySelector('#ui-dialog-body').innerText,
	ok: document.querySelector('#ui-dialog-body .sg-dialog-ok button')?.textContent
}));

check('окно: заголовок, текст с переменной, кнопка «Принято»', dlg.title === 'Окно' && /Привет 6/.test(dlg.body) && dlg.ok === 'Принято', JSON.stringify(dlg));
await page.click('#ui-dialog-body .sg-dialog-ok button');
await page.waitForTimeout(300);
check('окно закрывается кнопкой', !(await page.$('#ui-dialog.open')));

await click(page, 'окно2');
await page.waitForSelector('#ui-dialog.open');
check('окно из пассажа', /Справка из пассажа/.test(await page.innerText('#ui-dialog-body')) && (await page.textContent('#ui-dialog-title')) === 'Из пассажа');
await page.waitForTimeout(1500);
check('окно закрылось само через 1 с', !(await page.$('#ui-dialog.open')));

await click(page, 'таймер');
check('таймер запущен (в $sgTimers, без табло)', !!(await page.evaluate(() => SugarCube.State.variables.sgTimers.T1)) && !(await page.$('.sg-timer')));
await click(page, 'стоп');
check('таймер остановлен', !(await page.evaluate(() => SugarCube.State.variables.sgTimers.T1)));
await page.waitForTimeout(2300);
check('остановленный таймер не переходит', (await page.evaluate(() => SugarCube.State.passage)) === 'ActionsTest');
await click(page, 'таймер');
await page.waitForTimeout(2600);
check('таймер по окончании переходит на экран', (await page.evaluate(() => SugarCube.State.passage)) === 'ActionsDone' && /ТАЙМЕР ВЫШЕЛ/.test(await text()));

await go(page, 'ActionsTest');
await page.waitForTimeout(300);
await click(page, 'разметка');
check('[[…][$n to 10]]: значение и переход', (await v(page, 'n')) === 10 && (await page.evaluate(() => SugarCube.State.passage)) === 'ActionsTest');
check('кнопка — это <button>', !!(await page.$('.passage button:text-is("кнопка")')));
await click(page, 'кнопка');
check('кнопка: действие и переход', (await v(page, 'n')) === 6 && /n=6/.test(await text()));
check('без ошибок SugarCube на экране', (await page.$$('.passage .error')).length === 0);
check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
