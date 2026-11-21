// Проверка сессии 41 (замечания автора к build-44) в Chromium: «Тест терминала» с настоящим центром (Java из signaly-app)
// и НАСТОЯЩИМИ телефонами — приложение игрока signaly-app (dist/www) с пакетом test-net-pack П20, вход 555555 (№7 Психолог)
// и 111111 (№1 Инженер). Номер сотрудника проверка не задаёт: телефон сам говорит центру то, что есть в пакете, и сам решает,
// что сообщение ему (как на APK). Ловит то, что пропускали «телефоны»-заглушки: команды «кому: №7» и «Глава 1» после «Глава 2».
// Сессия 42 (= П23): телефон с APK П23 сам узнаёт «num:<свой номер>» (без «acc:»); окно «за N мин» из условий терминала
// (termWins пакета, «Опубликовать пакет») — центр считает, терминал читает (sgPersonalWin).
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json; в клоне signaly-app — npm ci --ignore-scripts и node tools/build.mjs.
// node real-phone-play.mjs <playwright> <клон signaly-app>
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
const root = path.resolve(here, '../..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-real-phone-'));
const www = path.join(appRepo, 'dist/www');
if (!fs.existsSync(path.join(www, 'index.html'))) throw new Error('нет ' + www + '/index.html — в клоне signaly-app: node tools/build.mjs');
const pack = fs.readFileSync(path.join(root, 'src/util/signaly/__tests__/fixtures/app-test-net-pack-p20.sgpack'));

execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(here, 'test-terminal/test-terminal.twee'), path.join(dir, 'test-terminal.html')]);

const cls = '/tmp/sg-real-phone-java';
fs.rmSync(cls, {recursive: true, force: true});
fs.mkdirSync(cls, {recursive: true});
const javaSrc = path.join(appRepo, 'android/app/src/main/java/ru/signaly/net');
execFileSync('javac', ['-encoding', 'UTF-8', '-Xlint:none', '-d', cls, ...['SgJson', 'SgWs', 'SgCenter', 'SgVad', 'SgVoiceCore', 'SgReplica'].map(n => path.join(javaSrc, n + '.java'))], {stdio: ['ignore', 'ignore', 'inherit']});
const port = 19900 + Math.floor(Math.random() * 90);
const center = spawn('java', ['-cp', cls, 'ru.signaly.net.SgCenter', String(port), ''], {stdio: ['ignore', 'pipe', 'ignore']});
await new Promise((ok, fail) => {
	center.stdout.on('data', d => String(d).includes('SIGNALY CENTER') && ok());
	center.on('exit', c => fail(new Error('центр не запустился: ' + c)));
});

const serve = base =>
	http
		.createServer((req, res) => {
			let f = decodeURIComponent(req.url.split('?')[0]);
			if (f === '/') f = '/index.html';
			const file = path.join(base, f);
			if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
				res.writeHead(404);
				res.end();
				return;
			}
			res.writeHead(200, {'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'});
			fs.createReadStream(file).pipe(res);
		})
		.listen(0);
const termServer = serve(dir);
const appServer = serve(www);
const results = [];
const check = (name, ok, more = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !more ? '' : ' — ' + more}`);
};
const waitFor = async (fn, ms = 5000) => {
	const t = Date.now() + ms;
	while (Date.now() < t) {
		if (await fn()) return true;
		await sleep(150);
	}
	return false;
};
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];
async function realPhone(name, login) {
	const ctx = await browser.newContext({viewport: {width: 400, height: 800}, hasTouch: true});
	const p = await ctx.newPage();
	p.on('pageerror', e => errors.push(name + ': ' + e.message));
	await p.goto(`http://127.0.0.1:${appServer.address().port}/`);
	await p.locator('#scr-boot.on').waitFor();
	await p.setInputFiles('#file', {name: 'test-net-pack.sgpack', mimeType: 'application/zip', buffer: pack});
	await p.locator('#scr-login.on').waitFor();
	await p.evaluate(c => window.sgPlayer.enter(c, 'pad'), 'SGNET:ws://127.0.0.1:' + port);
	await closeDlg(p);
	await p.evaluate(c => window.sgPlayer.enter(c, 'pad'), login);
	await p.locator('#scr-main.on').waitFor();
	await closeDlg(p);
	// что телефон показал (уведомления и события) — чтобы не зависеть от очереди окон
	await p.evaluate(() => {
		const P = window.sgPlayer.P;
		window.__shown = [];
		for (const k of ['event', 'notice']) {
			const f = P[k];
			if (typeof f === 'function') P[k] = function (b, t) { window.__shown.push(typeof b === 'object' && b ? b.text : t); return f.apply(this, arguments); };
		}
	});
	return p;
}
async function closeDlg(p) {
	for (let i = 0; i < 12 && (await p.locator('#dlg.on').count()); i++) {
		await p.locator('#dlg .dlg-btns .btn').last().click().catch(() => {});
		await sleep(120);
	}
}
const shown = (p, text) => p.evaluate(t => window.__shown.some(x => String(x || '').includes(t)) || document.body.innerText.includes(t), text);
try {
	const p7 = await realPhone('555555', '555555');
	const p1 = await realPhone('111111', '111111');
	check('телефоны (приложение игрока, пакет П20) вошли и на связи', await waitFor(async () => (await p7.locator('#bar-net.up').count()) && (await p1.locator('#bar-net.up').count())));
	const page = await browser.newPage({viewport: {width: 1400, height: 900}});
	page.on('pageerror', e => errors.push('терминал: ' + e.message));
	await page.goto(`http://localhost:${termServer.address().port}/test-terminal.html?center=` + encodeURIComponent(`127.0.0.1:${port}`));
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	await page.waitForFunction(() => window.SgTermNet && window.SgTermNet.on, null, {timeout: 6000});
	await page.waitForFunction(() => (SgTermNet.state.accs || []).length > 0, null, {timeout: 6000}).catch(() => {});
	const go = async (screen, link) => {
		await page.evaluate(n => SugarCube.Engine.play(n), screen);
		await page.waitForTimeout(250);
		await page.click(`.passage a:text-is("${link}")`);
	};

	await go('Т7 Уведомления', 'Уведомление всем');
	check('«Уведомление всем» — у №7 и №1', (await waitFor(() => shown(p7, 'Проверка связи'))) && (await waitFor(() => shown(p1, 'Проверка связи'))));
	await go('Т7 Уведомления', 'Только №7');
	check('«Только №7» — пришло Психологу (555555)', await waitFor(() => shown(p7, 'Только Психологу')));
	check('«Только №7» — Инженеру (111111) не пришло', !(await shown(p1, 'Только Психологу')));

	await go('Т5 Строка', '№7 — в строку, 1 проход');
	const tick7 = await waitFor(() => p7.evaluate(() => (window.sgPlayer.P.tickerList ? window.sgPlayer.P.tickerList() : []).some(x => x.text === 'Один проход — только №7')));
	check('«№7 — в строку, 1 проход» — строка у Психолога', tick7);
	check('строки для №7 у Инженера нет', !(await p1.evaluate(() => (window.sgPlayer.P.tickerList ? window.sgPlayer.P.tickerList() : []).some(x => x.text === 'Один проход — только №7'))));
	await go('Т5 Строка', 'Всем — в строку');
	check('«Всем — в строку» — строка у обоих', (await waitFor(() => p7.evaluate(() => window.sgPlayer.P.tickerList().some(x => /всем/.test(x.text))))) && (await waitFor(() => p1.evaluate(() => window.sgPlayer.P.tickerList().some(x => /всем/.test(x.text))))));

	await go('Т9 Команды', 'Сбой экрана у №7');
	const gl = () => (window.sgPlayer.P.activeGlitches ? window.sgPlayer.P.activeGlitches() : []).map(g => g.name || g.id || g).join(',');
	check('«Сбой экрана у №7» — сбой у Психолога', await waitFor(async () => (await p7.evaluate(gl)) !== ''), await p7.evaluate(gl));
	check('сбоя у Инженера нет', (await p1.evaluate(gl)) === '', await p1.evaluate(gl));
	await go('Т9 Команды', 'Снять сбои');
	check('«Снять сбои» — сбоя нет', await waitFor(async () => (await p7.evaluate(gl)) === ''));
	await closeDlg(p7);
	await closeDlg(p1);
	await go('Т9 Команды', 'Глава 2');
	check('«Глава 2» — у обоих глава 2', (await waitFor(() => p7.evaluate(() => window.sgPlayer.state().chapter === 2))) && (await waitFor(() => p1.evaluate(() => window.sgPlayer.state().chapter === 2))));
	await sleep(400);
	await go('Т9 Команды', 'Глава 1');
	check('«Глава 1» после второй — у обоих снова глава 1', (await waitFor(() => p7.evaluate(() => window.sgPlayer.state().chapter === 1))) && (await waitFor(() => p1.evaluate(() => window.sgPlayer.state().chapter === 1))));
	// без таблицы кодов в истории — по персонажам центра («accs» из правил мастерского телефона, как в игре)
	const rules = await p7.evaluate(() => window.SG.centerRules(window.sgPlayer.game()));
	const master = new WebSocket(`ws://127.0.0.1:${port}`);
	await new Promise(r => (master.onopen = r));
	master.send(JSON.stringify({t: 'hello', role: 'master', dev: 'm-test', acc: null, name: 'Мастер', epoch: null, since: 0}));
	await sleep(300);
	master.send(JSON.stringify({t: 'rules', ver: 'real-phone-' + Date.now(), list: rules}));
	const accs = await page.waitForFunction(() => (SgTermNet.state.accs || []).some(a => a.num === '7'), null, {timeout: 5000}).then(() => true, () => false);
	await page.evaluate(() => {
		window.SgAccHint = undefined;
		SgTermNet.notify('ТЕРМИНАЛ', 'По персонажам центра — №7', ['7']);
	});
	check('без таблицы кодов: по «accs» центра «кому: №7» — у Психолога, не у Инженера', accs && (await waitFor(() => shown(p7, 'По персонажам центра'))) && !(await shown(p1, 'По персонажам центра')));
	// Сессия 42 (= П23): адрес только «num:7», без «acc:» (как сообщение терминала старее движка 36) — телефон узнаёт свой номер сам
	master.send(JSON.stringify({t: 'msg', id: 'num-only-' + Date.now(), to: ['num:7'], kind: 'notify', body: {title: 'НОМЕР', text: 'Только num:7 — без acc'}}));
	check('П23: «num:7» без «acc:» — у Психолога (телефон узнал свой номер)', await waitFor(() => shown(p7, 'Только num:7')));
	check('П23: «num:7» — у Инженера нет', !(await shown(p1, 'Только num:7')));
	// Т32-1 А: окно «за 7 мин» из условий терминала — в правила центра (termWins пакета), центр шлёт win:…, терминал читает
	const rulesW = await p7.evaluate(() => window.SG.centerRules(Object.assign({}, window.sgPlayer.game(), {termWins: [{var: 'hacks', min: 7, acc: ''}]})));
	const id7 = await page.evaluate(() => (SgTermNet.state.accs || []).find(a => a.num === '7').id);
	check('Т32-1: в правилах центра окно терминала «hacks за 7 мин» у №7', rulesW.some(r => r.on === 'win' && r.key === 'var:hacks@' + id7 && r.min === 7));
	master.send(JSON.stringify({t: 'rules', ver: 'real-phone-w-' + Date.now(), list: rulesW}));
	await sleep(400);
	await page.evaluate(() => SgTermNet.personalAdd('hacks', '7', 2));
	const w7 = await page.waitForFunction(k => SgTermNet.state[k] === 2, 'win:hacks@' + id7 + ':7', {timeout: 6000}).then(() => true, () => false);
	check('Т32-1: центр посчитал «за 7 мин» = 2, терминал: sgPersonalWin("hacks", "7", 7) = 2', w7 && (await page.evaluate(() => window.sgPersonalWin('hacks', '7', 7))) === 2);
	master.close();
	check('ошибок на страницах нет', errors.length === 0, errors.join('; '));
} finally {
	await browser.close();
	termServer.close();
	appServer.close();
	center.kill();
}
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
