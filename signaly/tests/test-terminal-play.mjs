// Проверка сессии 40 (Т30-1 А, Т31-4 А; сессия 41 — Т32-2 А: новое наверху, экран «Т11 Номер») в Chromium: тестовая история «Тест терминала» (signaly/tests/test-terminal/test-terminal.twee)
// с настоящим центром сети (Java из signaly-app): все экраны без ошибок SugarCube, личные с терминала, код «+1 у вводящего»,
// события sgPersonal / sgPersonalWin, бегущая строка, счёт кодов с телефона. Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node test-terminal-play.mjs <playwright> <клон signaly-app>
import {createRequire} from 'module';
import {execFileSync, spawn} from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const [playwrightPath, appRepo] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-test-terminal-'));
const twee = path.join(here, 'test-terminal/test-terminal.twee');

execFileSync('node', [path.join(here, 'publish-twee.mjs'), twee, path.join(dir, 'test-terminal.html')]);

const cls = '/tmp/sg-tt-play-java';
fs.rmSync(cls, {recursive: true, force: true});
fs.mkdirSync(cls, {recursive: true});
const javaSrc = path.join(appRepo, 'android/app/src/main/java/ru/signaly/net');
execFileSync('javac', ['-encoding', 'UTF-8', '-Xlint:none', '-d', cls, ...['SgJson', 'SgWs', 'SgCenter', 'SgVad', 'SgVoiceCore', 'SgReplica'].map(n => path.join(javaSrc, n + '.java'))], {stdio: ['ignore', 'ignore', 'inherit']});
const port = 19700 + Math.floor(Math.random() * 200);
const center = spawn('java', ['-cp', cls, 'ru.signaly.net.SgCenter', String(port), ''], {stdio: ['ignore', 'pipe', 'ignore']});
await new Promise((ok, fail) => {
	center.stdout.on('data', d => String(d).includes('SIGNALY CENTER') && ok());
	center.on('exit', c => fail(new Error('центр не запустился: ' + c)));
});
function phone(hello) {
	const c = {got: [], ws: new WebSocket(`ws://127.0.0.1:${port}`)};
	c.ws.onmessage = e => c.got.push(JSON.parse(e.data));
	c.ready = new Promise(r => {
		c.ws.onopen = () => {
			c.ws.send(JSON.stringify({t: 'hello', epoch: null, since: 0, ...hello}));
			r();
		};
	});
	c.wait = async (fn, ms = 5000) => {
		const t = Date.now();
		while (Date.now() - t < ms) {
			const x = c.got.find(fn);
			if (x) return x;
			await sleep(50);
		}
		return null;
	};
	c.send = (kind, body, to = ['role:terminal']) => c.ws.send(JSON.stringify({t: 'msg', id: 'm' + Math.random(), to, kind, body}));
	return c;
}

const server = http
	.createServer((req, res) => {
		const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
		if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
		fs.createReadStream(file).pipe(res);
	})
	.listen(0);
const results = [];
const check = (name, ok, more = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !more ? '' : ' — ' + more}`);
};
const browser = await chromium.launch();
const errors = [];
try {
	const p7 = phone({role: 'phone', dev: 'ph7', acc: 'aT', num: '7', name: 'Психолог Тест'});
	const p1 = phone({role: 'phone', dev: 'ph1', acc: 'aA', num: '1', name: 'Инженер Тест'});
	const master = phone({role: 'master', dev: 'm', acc: null, name: 'Мастер'});
	await Promise.all([p7.ready, p1.ready, master.ready]);
	const page = await browser.newPage({viewport: {width: 1400, height: 900}});
	page.on('pageerror', e => errors.push(e.message));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
	await page.goto(`http://localhost:${server.address().port}/test-terminal.html?center=` + encodeURIComponent(`127.0.0.1:${port}`));
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	await page.waitForFunction(() => window.SgTermNet && window.SgTermNet.on, null, {timeout: 6000});
	check('«Тест терминала»: движок 36, связь с центром', await page.evaluate(() => SugarCube.setup.signaly.engine === 36 && SgTermNet.on));
	const list = await page.evaluate(() => document.querySelector('.passage').innerText);
	check('список проверок: сначала новое, потом старое', list.indexOf('НОВОЕ В СБОРКЕ') < list.indexOf('1. Команды «кому: №7»') && list.indexOf('1. Команды «кому: №7»') < list.indexOf('СБОРКА 40') && list.indexOf('СБОРКА 40') < list.indexOf('2. Личные') && list.indexOf('2. Личные') < list.indexOf('РАНЬШЕ') && list.includes('11. С телефона'));
	const screens = await page.evaluate(() => [...document.querySelectorAll('.passage a')].map(a => a.dataset.passage).filter(Boolean));
	let bad = [];
	for (const s of screens) {
		await page.evaluate(n => SugarCube.Engine.play(n), s);
		await page.waitForTimeout(250);
		if (await page.evaluate(() => !!document.querySelector('.passage .error, .passage .error-view'))) bad.push(s);
	}
	check(`все ${screens.length} экранов проверок — без ошибок SugarCube`, screens.length === 11 && bad.length === 0, bad.join(', '));

	await page.evaluate(() => SugarCube.Engine.play('Т1 Личные'));
	await page.waitForTimeout(300);
	check('личная: начальное у №7 — 1, у №1 — 0', await page.evaluate(() => sgPersonal('hacks', '7') === 1 && sgPersonal('hacks', '1') === 0));
	await page.click('.passage a:text-is("+1 у №7 (Психолог)")');
	check('«+1 у №7» → центр: var:hacks@aT = 2, телефон №7 видит', !!(await p7.wait(o => o.t === 'state' && o.key === 'var:hacks@aT' && o.value === 2)));
	await page.waitForTimeout(1200);
	check('число на экране обновилось само (sg-value)', (await page.evaluate(() => document.querySelector('.passage').innerText)).includes('№7 Психолог: 2'));
	await page.click('.passage a:text-is("+1 у №1 (Инженер)")');
	check('«+1 у №1» — у Инженера своё: 1', !!(await p1.wait(o => o.t === 'state' && o.key === 'var:hacks@aA' && o.value === 1)));

	await page.evaluate(() => SugarCube.Engine.play('Т2 Код'));
	await page.waitForTimeout(300);
	const field = async v => {
		const f = (await page.$$('.passage input.sg-code')).pop();
		await f.fill(v);
		await f.press('Enter');
		await page.waitForTimeout(500);
	};
	await field('T1');
	await field('777');
	check('код T1 + личный код 777 → +1 у №7 (3)', !!(await master.wait(o => o.t === 'state' && o.key === 'var:hacks@aT' && o.value === 3)));
	await page.waitForTimeout(800);
	const dialogs = [];
	for (let i = 0; i < 4; i++) {
		if (await page.evaluate(() => SugarCube.Dialog.isOpen())) {
			dialogs.push(await page.evaluate(() => document.querySelector('#ui-dialog-body').innerText));
			await page.evaluate(() => SugarCube.Dialog.close());
		}
		await page.waitForTimeout(700);
	}
	const all = dialogs.join(' | ');
	check('ответ кода — значение у того, кто ввёл (3)', /Сейчас у вас: 3/.test(all), all);
	check('событие sgPersonal ≥ 3 — окно «ПСИХОЛОГ: 3 ВЗЛОМА»', all.includes('ПСИХОЛОГ: 3 ВЗЛОМА'), all);
	check('событие «за 1 мин» ≥ 2 — окно «2 ВЗЛОМА ЗА МИНУТУ»', all.includes('2 ВЗЛОМА ЗА МИНУТУ'), all);

	await page.evaluate(() => SugarCube.Engine.play('Т5 Строка'));
	await page.waitForTimeout(300);
	await page.click('.passage a:text-is("№7 — в строку, 1 проход")');
	const tk = await p7.wait(o => o.kind === 'notify' && o.body.text === 'Один проход — только №7');
	check('бегущая строка №7: ticker, 1 проход', !!tk && tk.body.ticker === true && tk.body.repeat === 1);
	await sleep(300);
	check('№1 строку для №7 не получил', !p1.got.some(o => o.kind === 'notify' && o.body.text === 'Один проход — только №7'));

	await page.evaluate(() => SugarCube.Engine.play('Т10 С телефона'));
	await page.waitForTimeout(300);
	p7.send('code', {code: 'HACK', num: '7'});
	await page.waitForFunction(() => SugarCube.setup.phone('code', 'HACK', '7') === 1, null, {timeout: 4000}).catch(() => {});
	await page.waitForTimeout(1200);
	check('код HACK с телефона №7 — счёт на экране', (await page.evaluate(() => document.querySelector('.passage').innerText)).includes('с №7: 1'));
	check('ошибок на странице нет', errors.length === 0, errors.join('; '));
} finally {
	await browser.close();
	server.close();
	center.kill();
}
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
