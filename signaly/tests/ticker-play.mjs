// Проверка шага 4.1 в Chromium: строка событий и цикл на главном экране.
// node ticker-play.mjs <шаблон.twee> <папка с media> <playwright> [ещё игра.html …]
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// Пишет ticker-test.twee|html в папку с медиа; «ещё игра.html» — та же тестовая
// история, опубликованная в другом месте (обычный Twine).
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
const {defaultCycle, defaultLine, newNews, writeTicker} = require(path.join(tools, 'signaly-ticker.js'));

const news = (name, text, more) => ({...newNews([]), name, text, ...more});
const long = 'Очень длинное сообщение бегущей строки '.repeat(6).trim();
const tickerText = writeTicker('', {
	line: {...defaultLine('TkHome'), height: 50, size: 24, speed: 400, pause: 1, hold: 1, change: 0.4},
	cycle: {...defaultCycle, variable: 'tkProgress', spin: 2, rate: 30, sound: 'media/audio/click3.wav', volume: 50, rows: [{progress: 0, value: '00012'}, {progress: 2, value: '00037'}, {progress: 3, value: '01845'}, {progress: 4, value: '01902'}]},
	news: [
		news('Первое общее', 'Общее один', {general: true}),
		news('Второе общее', 'Общее два', {general: true, expr: '$tkSecond'}),
		news('Личное', 'Личное <<= $tkN>>', {expr: '$tkPersonal', minutes: 0.05, color: '#ff0000', bold: true}),
		news('Три раза', 'Счётное', {expr: '$tkCount', times: 2}),
		news('Длинное', long, {expr: '$tkLong'}),
		news('Мигает', 'Мигание', {expr: '$tkBlink', effect: 'blink', italic: true})
	]
});
const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $tkProgress to 0>>\n<<set $tkN to 5>>\n')
		.replace('"start": "Start"', '"start": "TkHome"')
		.replace(/\s*$/, '\n') +
	`
:: Строка событий [sg-ticker] {"position":"0,0","size":"100,100"}
${tickerText}

:: TkHome {"position":"100,0","size":"100,100"}
Главный экран
<<sg-place corner tr x 5 y 2>><<link "РАД">><</link>><</sg-place>>
[[TkOther]]

:: TkOther {"position":"200,0","size":"100,100"}
Другой экран
<<sg-place corner tr x 5 y 2>><<link "РАД">><</link>><</sg-place>>
[[TkHome]]
`;
const twee = path.join(gameDir, 'ticker-test.twee');
const html = path.join(gameDir, 'ticker-test.html');

fs.writeFileSync(twee, test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), twee, html], {stdio: 'pipe'});

const mime = {'.html': 'text/html; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png'};
const serve = dir =>
	new Promise(resolve => {
		const server = http.createServer((req, res) => {
			const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));

			fs.readFile(file, (err, data) => {
				if (err) {
					res.writeHead(404);
					res.end();
				} else {
					res.writeHead(200, {'content-type': mime[path.extname(file)] ?? 'application/octet-stream'});
					res.end(data);
				}
			});
		});

		server.listen(0, () => resolve({server, base: `http://127.0.0.1:${server.address().port}/`}));
	});

let fails = 0;
let total = 0;
const check = (name, ok, more) => {
	total++;
	if (!ok) {
		fails++;
	}
	console.log(`${ok ? 'OK ' : 'ОШИБКА '} ${name}${!ok && more !== undefined ? ` — ${more}` : ''}`);
};

const browser = await chromium.launch();

async function run(url, prefix) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
	const page = await context.newPage();
	const errors = [];

	page.on('pageerror', e => errors.push(String(e)));
	await page.addInitScript(() => {
		window.sgPlayed = [];
		const play = HTMLMediaElement.prototype.play;

		HTMLMediaElement.prototype.play = function () {
			window.sgPlayed.push(this.src);
			return play.apply(this, arguments);
		};
	});

	const open = async () => {
		await page.goto(url);
		await page.waitForSelector('#sg-start');
		await page.click('#sg-start');
		await page.waitForSelector('.passage');
		await page.waitForTimeout(400);
	};
	const set = (name, value) => page.evaluate(([n, x]) => (SugarCube.State.variables[n] = x), [name, value]);
	const go = async name => {
		await page.evaluate(n => SugarCube.Engine.play(n), name);
		await page.waitForTimeout(300);
	};
	const msg = () => page.evaluate(() => [...document.querySelectorAll('.sg-tk-msg')].map(e => e.textContent).join('|'));
	const cycle = () => page.evaluate(() => document.querySelector('.sg-tk-num')?.textContent);
	const waitMsg = async (text, ms = 6000) => {
		const end = Date.now() + ms;

		while (Date.now() < end) {
			if ((await msg()) === text) {
				return true;
			}
			await page.waitForTimeout(30);
		}
		return false;
	};
	const seen = async (ms, every = 30) => {
		const list = new Set();
		const end = Date.now() + ms;

		while (Date.now() < end) {
			list.add(await msg());
			await page.waitForTimeout(every);
		}
		return list;
	};

	await open();

	/* Строка и рамка */
	const box = await page.evaluate(() => {
		const r = e => e.getBoundingClientRect();
		const q = s => document.querySelector(s);
		const p = getComputedStyle(q('#passages'));
		const l = getComputedStyle(q('.sg-tk-cycle'));
		const place = r(q('.sg-place'));
		const cycleBox = r(q('.sg-tk-cycle'));

		return {
			line: r(q('.sg-tk-line')).height,
			right: Math.round(r(q('#passages')).right - cycleBox.right),
			top: Math.round(cycleBox.top - r(q('#passages')).top),
			size: getComputedStyle(q('#sg-ticker')).fontSize,
			same: p.borderTopColor === l.borderTopColor && p.borderTopWidth === l.borderTopWidth,
			under: place.top >= cycleBox.bottom,
			first: q('#passages').firstElementChild.id,
			textBelow: r(q('.passage')).top >= cycleBox.bottom
		};
	});

	say('строка на главном экране, высота 50, размер 24', box.first === 'sg-ticker' && box.line === 50 && box.size === '24px', JSON.stringify(box));
	say('цикл в правом верхнем углу, в такой же рамке', box.same && box.right < 12 && box.top < 12, JSON.stringify(box));
	say('кнопка на экране и текст — под строкой', box.under && box.textBelow, JSON.stringify(box));
	say('цикл по прогрессу: 0 → 00012', (await cycle()) === '00012', await cycle());
	say('«Цикл» в рамке', (await page.innerText('.sg-tk-cycle')).replace(/\s/g, '') === 'Цикл00012');
	say('без условия — включено сразу', await waitMsg('Общее один'));

	/* Строка только на главном экране */
	await go('TkOther');
	const otherTop = await page.evaluate(() => document.querySelector('.sg-place').getBoundingClientRect().top);

	say('на другом экране строки нет, кнопка на своём месте', !(await page.$('#sg-ticker')) && otherTop < 30, otherTop);
	await go('TkHome');
	say('на главном — снова есть', !!(await page.$('#sg-ticker')));
	await page.evaluate(() => SugarCube.Engine.play('TkHome'));
	await page.waitForTimeout(200);
	say('повторный показ главного экрана — одна строка', (await page.$$('#sg-ticker')).length === 1);

	/* Общие: новое сменяет старое */
	await set('tkSecond', true);
	say('новое общее сменяет старое', await waitMsg('Общее два'));
	say('старое общее больше не показывается', !(await seen(2000)).has('Общее один'));
	await set('tkSecond', false);
	say('условие ложно — снова первое общее', await waitMsg('Общее один'));

	/* Новое — первым, вид, срок в минутах (3 секунды) */
	await set('tkPersonal', true);
	say('новое сообщение показывается следующим', await waitMsg('Личное 5', 3000));
	const look = await page.evaluate(() => {
		const s = getComputedStyle(document.querySelector('.sg-tk-msg > span'));

		return s.color + s.fontWeight;
	});

	say('цвет и жирный', look === 'rgb(255, 0, 0)700', look);
	const both = await seen(2500);

	say('сообщения сменяют друг друга', both.has('Общее один') && both.has('Личное 5'), [...both].join(' / '));
	await page.waitForTimeout(1500);
	say('срок вышел — сообщение ушло', !(await seen(1800)).has('Личное 5'));
	const marks = await page.evaluate(() => SugarCube.State.variables.sgTicker.msgs['Личное']);

	say('отметка времени и показов в $sgTicker', marks.at > 0 && marks.shown > 0, JSON.stringify(marks));

	/* Срок считается и на другом экране */
	await set('tkPersonal', false);
	await page.waitForTimeout(400);
	await go('TkOther');
	await set('tkPersonal', true);
	await page.waitForTimeout(400);
	const atOther = await page.evaluate(() => SugarCube.State.variables.sgTicker.msgs['Личное']);

	say('условие проверяется и на другом экране', !!atOther && !atOther.shown, JSON.stringify(atOther));
	await set('tkPersonal', false);
	await go('TkHome');

	/* Число показов */
	await set('tkCount', true);
	const end = Date.now() + 9000;
	let counted = 0;

	while (Date.now() < end) {
		counted = await page.evaluate(() => SugarCube.State.variables.sgTicker.msgs['Три раза']?.shown ?? 0);
		await page.waitForTimeout(100);
	}
	say('показано заданное число раз', counted === 2, counted);
	say('больше не показывается', !(await seen(1500)).has('Счётное'));
	await set('tkCount', false);

	/* Длинный текст прокручивается */
	await set('tkLong', true);
	say('длинный текст появился', await waitMsg(long, 4000));
	await page.waitForTimeout(500);
	const standing = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sg-tk-msg')).transform).m41);

	await page.waitForTimeout(1200);
	const moving = await page.evaluate(() => {
		const e = document.querySelector('.sg-tk-msg');

		return e ? new DOMMatrix(getComputedStyle(e).transform).m41 : null;
	});

	say('сначала стоит, потом едет', standing === 0 && moving < -100, `${standing} → ${moving}`);
	await set('tkLong', false);

	/* Эффект */
	await set('tkBlink', true);
	say('мигание и курсив', (await waitMsg('Мигание', 5000)) && (await page.evaluate(() => {
		const s = document.querySelector('.sg-tk-msg > span');

		return s.className === 'sg-blink' && getComputedStyle(s).fontStyle === 'italic';
	})));
	await set('tkBlink', false);

	/* Смена цикла */
	await page.evaluate(() => (window.sgPlayed.length = 0));
	await go('TkOther');
	await set('tkProgress', 2);
	await page.waitForTimeout(400);
	const played = await page.evaluate(() => window.sgPlayed.filter(s => s.includes('click3')).length);

	say('звук — в момент смены, на другом экране', played === 1, played);
	say('$sgTicker: цикл новый, увиденный старый', await page.evaluate(() => {
		const s = SugarCube.State.variables.sgTicker;

		return s.cycle === '00037' && s.seen === '00012';
	}));
	await go('TkHome');
	const frames = [];
	const started = Date.now();

	while (Date.now() - started < 1700) {
		frames.push(await cycle());
		await page.waitForTimeout(20);
	}
	say('при входе цифры меняются хаотично', new Set(frames).size > 6, new Set(frames).size);
	say('меняются только два правых разряда', frames.every(f => f.startsWith('000')), frames.find(f => !f.startsWith('000')));
	const changesEarly = frames.slice(0, 30).filter((f, i, a) => i && f !== a[i - 1]).length;
	const changesLate = frames.slice(-30).filter((f, i, a) => i && f !== a[i - 1]).length;

	say('постепенно замедляются', changesLate < changesEarly, `${changesEarly} → ${changesLate}`);
	await page.waitForTimeout(700);
	say('останавливаются на заданном значении', (await cycle()) === '00037', await cycle());
	say('увиденный цикл записан', await page.evaluate(() => SugarCube.State.variables.sgTicker.seen === '00037'));

	await set('tkProgress', 3);
	await page.waitForTimeout(350);
	await set('tkProgress', 4);
	await page.waitForTimeout(600);
	const mid = await cycle();

	await page.waitForTimeout(2200);
	say('игроки на главном экране: смена сразу; 01845 → 01902 — три правых', (await cycle()) === '01902' && mid.startsWith('0'), `${mid} → ${await cycle()}`);

	await set('tkProgress', 1);
	await page.waitForTimeout(2600);
	say('нет своей строки — берётся ближайшая меньшая', (await cycle()) === '00012', await cycle());

	/* Прогресс прибавился, игроки ушли посреди смены */
	await set('tkProgress', 2);
	await page.waitForTimeout(500);
	await go('TkOther');
	say('ушли посреди смены — цикл ещё не увиден', await page.evaluate(() => SugarCube.State.variables.sgTicker.seen === '00012'));
	await go('TkHome');
	await page.waitForTimeout(500);
	say('вернулись — смена заново', (await cycle()) !== '00037' || (await page.evaluate(() => SugarCube.State.variables.sgTicker.seen !== '00037')));
	await page.waitForTimeout(2300);
	say('и закончилась', (await cycle()) === '00037', await cycle());

	/* Сбой и «Новая игра» */
	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(500);
	say('после сбоя цикл тот же, смены нет', (await cycle()) === '00037' && (await page.evaluate(() => SugarCube.State.variables.sgTicker.seen)) === '00037');
	say('после сбоя показы не обнулились', await page.evaluate(() => SugarCube.State.variables.sgTicker.msgs['Первое общее'].shown > 0));
	await page.evaluate(() => {
		SugarCube.State.variables.tkProgress = 3;
	});
	await page.waitForTimeout(400);
	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(700);
	say('сбой посреди смены — цифры снова меняются', await page.evaluate(() => SugarCube.State.variables.sgTicker.seen === '00037'));
	await page.waitForTimeout(2300);
	say('и останавливаются на новом значении', (await cycle()) === '01845', await cycle());

	await page.keyboard.down('KeyZ');
	await page.keyboard.press('Shift+KeyN');
	await page.keyboard.up('KeyZ');
	await page.waitForTimeout(300);
	await page.evaluate(() => document.querySelector('.sg-key-yes, #ui-dialog-body button')?.click());
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(500);
	say('«Новая игра» — всё сначала', (await cycle()) === '00012' && (await page.evaluate(() => SugarCube.State.variables.tkProgress === 0)), await cycle());
	say('ошибок нет', errors.length === 0, errors.join('; '));
	await context.close();
}

const {server, base} = await serve(gameDir);

await run(`${base}ticker-test.html`, '');
for (const file of extra) {
	const name = path.basename(file);

	if (path.resolve(file) !== path.join(path.resolve(gameDir), name)) {
		fs.copyFileSync(file, path.join(gameDir, name));
	}
	await run(`${base}${name}`, `${name}: `);
}
server.close();
await browser.close();
console.log(fails ? `Ошибок: ${fails} из ${total}` : `ВСЁ ХОРОШО: ${total}/${total}`);
process.exit(fails ? 1 : 0);
