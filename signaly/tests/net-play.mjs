// Проверка сессии 31 (этап Т1 приложения) в Chromium: терминал ↔ настоящий центр сети (Java из signaly-app) ↔ «телефоны».
// Тестовая история — шаблон + таблица кодов (сотрудник 3 с личным кодом) + экран с действиями «Телефонам: …»
// + события «Пришло с телефона» (код, фраза, событие; с любого и с телефона №3; не меньше 2 раз).
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node net-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <клон signaly-app>
import {createRequire} from 'module';
import {execFileSync, spawn} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, appRepo] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {writeCodes, defaultTexts} = require(path.join(tools, 'signaly-codes.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ----- центр сети: чистая Java из signaly-app ----- */
const cls = '/tmp/sg-net-play-java';
fs.rmSync(cls, {recursive: true, force: true});
fs.mkdirSync(cls, {recursive: true});
const javaSrc = path.join(appRepo, 'android/app/src/main/java/ru/signaly/net');
execFileSync('javac', ['-encoding', 'UTF-8', '-Xlint:none', '-d', cls, ...['SgJson', 'SgWs', 'SgCenter', 'SgVad', 'SgVoiceCore'].map(n => path.join(javaSrc, n + '.java'))], {stdio: ['ignore', 'ignore', 'inherit']});
const port = 19400 + Math.floor(Math.random() * 300);
async function startCenter() {
	const p = spawn('java', ['-cp', cls, 'ru.signaly.net.SgCenter', String(port), ''], {stdio: ['ignore', 'pipe', 'ignore']});
	await new Promise((ok, fail) => {
		p.stdout.on('data', d => String(d).includes('SIGNALY CENTER') && ok());
		p.on('exit', c => fail(new Error('центр не запустился: ' + c)));
	});
	return p;
}
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

/* ----- тестовая история ----- */
const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const entry = (code, label, actions) => ({code, label, who: [], once: '', title: '', answer: '', goto: '', denied: '', used: '', actions, multiline: false, extra: []});
const codesText = writeCodes('', {
	texts: defaultTexts,
	people: [{id: '3', pin: '333', variable: '', extra: []}],
	codes: [
		entry('777', 'Лично', [{type: 'code', code: '<<sg-net notify "КОД" "Вы ввели 777" to self>>'}]),
		entry('778', 'Сбой вводящему', [{type: 'code', code: '<<sg-net glitch "Тьма" to self>>'}])
	]
});
const test =
	story.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $netVar to 0>>\n<<set $netAlbum to "">>\n<<set $power to 5>>\n<<sg-shared "power">>\n').replace(/\s*$/, '\n') +
	`
:: Коды [sg-codes] {"position":"0,0","size":"100,100"}
${codesText}

:: NetHome {"position":"100,0","size":"100,100"}
Сеть
<<link "Всем">><<sg-net notify "ТЕРМИНАЛ" "Шлюз открыт">><</link>>
<<link "Третьему">><<sg-net open "Дневник, Схема" "НОВЫЕ ДАННЫЕ" to "3">><</link>>
<<link "Тревога">><<sg-net alarm "ТРЕВОГА" "Пробой">><</link>>
<<link "Отбой">><<sg-net alarm off>><</link>>
<<link "Глава">><<sg-net chapter 2>><</link>>
<<link "Отсчёт">><<sg-net countdown 300 "ДО ВЗРЫВА">><</link>>
<<link "Функция">><<sg-net module "chat" broken to "3">><</link>>
<<link "Событие">><<sg-net event "breach">><</link>>
<<link "Самому">><<sg-net notify "А" "Б" to self>><</link>>
<<link "Энергия +1">><<set $power += 1>><</link>>
<<sg-code button "OK" table>>
<</sg-code>>

:: NetHeard [sg-event] {"position":"200,0","size":"100,100"}
<<sg-event setup.phone("code", "сигнал терминалу") gt 0>>
УСЛЫШАНО <<link "Назад">><<sg-back>><</link>>

:: NetThree [sg-event] {"position":"300,0","size":"100,100"}
<<sg-event setup.phone("code", "4242", "3") gte 2>>
ДВАЖДЫ С ТРЕТЬЕГО <<link "Назад">><<sg-back>><</link>>

:: NetLow [sg-event] {"position":"500,0","size":"100,100"}
<<sg-event repeat stay $power lte 0>>
<<sg-event-do>><<sg-net notify "РЕАКТОР" "Энергия кончилась">><<set $power to 3>><</sg-event-do>>
НЕ ПОКАЗЫВАЕТСЯ

:: NetFull [sg-event] {"position":"600,0","size":"100,100"}
<<sg-event $power gte 10>>
<<sg-event-do>><<sg-net notify "ЭНЕРГИЯ" "Полный заряд">><</sg-event-do>>
ПОЛНЫЙ ЗАРЯД <<link "Назад">><<sg-back>><</link>>

:: NetEvent [sg-event] {"position":"400,0","size":"100,100"}
<<sg-event setup.phone("event", "Шлюз") gt 0>>
СОБЫТИЕ С ТЕЛЕФОНА <<link "Назад">><<sg-back>><</link>>
`;
fs.writeFileSync(path.join(gameDir, 'net-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'net-test.twee'), path.join(gameDir, 'net-test.html')]);

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

let center = await startCenter();
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];
try {
	const p3 = phone({role: 'phone', dev: 'ph3', acc: 'a3', num: '3', name: 'Капитан'});
	const p5 = phone({role: 'phone', dev: 'ph5', acc: 'a5', num: '5', name: 'Медик'});
	const master = phone({role: 'master', dev: 'm', acc: null, name: 'Мастер'});
	await Promise.all([p3.ready, p5.ready, master.ready]);

	const page = await browser.newPage({viewport: {width: 1600, height: 900}});
	page.on('pageerror', e => errors.push(e.message));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
	await page.goto(base + 'net-test.html?center=' + encodeURIComponent(`127.0.0.1:${port}`));
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	await page.waitForFunction(() => window.SgTermNet && window.SgTermNet.on, null, {timeout: 6000});
	check('движок 32: терминал подключился к центру', await page.evaluate(() => SugarCube.setup.signaly.engine === 32 && SgTermNet.on));
	check('мастер видит терминал в сети', !!(await master.wait(o => o.t === 'peers' && o.peers.some(p => p.role === 'terminal' && p.online))));
	check('огонёк в углу виден (в истории есть сеть)', await page.evaluate(() => [...document.body.children].some(e => e.title && /^Сеть/.test(e.title))));

	await page.evaluate(() => SugarCube.Engine.play('NetHome'));
	await page.waitForTimeout(400);
	const link = async text => {
		await page.click(`.passage a:text-is("${text}")`);
		await page.waitForTimeout(300);
	};
	await link('Всем');
	check('«Телефонам: уведомление» всем', !!(await p3.wait(o => o.kind === 'notify' && o.body.text === 'Шлюз открыт')) && !!(await p5.wait(o => o.kind === 'notify' && o.body.text === 'Шлюз открыт')));
	await link('Третьему');
	const op = await p3.wait(o => o.kind === 'open');
	check('открыть блоки сотруднику №3 (названия через запятую)', op && op.body.blocks.join('|') === 'Дневник|Схема' && op.body.title === 'НОВЫЕ ДАННЫЕ');
	await sleep(300);
	check('№5 блоки не получил', !p5.got.some(o => o.kind === 'open'));
	await link('Тревога');
	check('авария на телефонах', !!(await p5.wait(o => o.t === 'state' && o.key === 'alarm' && o.value.on && o.value.title === 'ТРЕВОГА')));
	await link('Отбой');
	check('отбой аварии', !!(await p5.wait(o => o.t === 'state' && o.key === 'alarm' && o.value.on === false)));
	await link('Глава');
	check('глава 2 для всех', !!(await p5.wait(o => o.t === 'state' && o.key === 'chapter' && o.value.n === 2)));
	await link('Отсчёт');
	check('обратный отсчёт 300 с', !!(await p5.wait(o => o.t === 'state' && o.key === 'countdown' && o.value.on && o.value.until - Date.now() > 290000)));
	await link('Функция');
	check('функция «Связь» сломана у №3', !!(await p3.wait(o => o.kind === 'module' && o.body.id === 'chat' && o.body.on === 'broken')));
	await link('Событие');
	check('событие терминала — мастеру (правила центра)', !!(await master.wait(o => o.kind === 'event' && o.body.name === 'breach' && o.from.role === 'terminal')));
	const before = p3.got.length + p5.got.length;
	await link('Самому');
	await sleep(500);
	check('«тому, кто ввёл код» вне кода — никому не уходит', p3.got.length + p5.got.length === before);

	// код таблицы с личным кодом: «тому, кто ввёл код»
	const field = async v => {
		const f = (await page.$$('.passage input.sg-code')).pop();
		await f.fill(v);
		await f.press('Enter');
		await page.waitForTimeout(400);
	};
	await field('777');
	await field('333');
	check('код 777 сотрудником №3 — уведомление только ему', !!(await p3.wait(o => o.kind === 'notify' && o.body.text === 'Вы ввели 777')));
	await sleep(300);
	check('№5 уведомление «Вы ввели» не получил', !p5.got.some(o => o.kind === 'notify' && o.body.text === 'Вы ввели 777'));
	await page.evaluate(() => SugarCube.Dialog.isOpen() && SugarCube.Dialog.close());
	await page.evaluate(() => SugarCube.Engine.play('NetHome'));
	await page.waitForTimeout(300);

	// с телефона: фраза для терминала, код дважды с №3, событие; переменная с пульта; итог голосования
	p5.send('code', {code: '', phrase: 'Сигнал терминалу', voice: true, num: '5'});
	await page.waitForFunction(() => SugarCube.State.passage === 'NetHeard', null, {timeout: 5000}).catch(() => {});
	check('пришла фраза с телефона → событие «УСЛЫШАНО»', (await page.evaluate(() => SugarCube.State.passage)) === 'NetHeard');
	check('счёт: с любого и с №5', await page.evaluate(() => SugarCube.setup.phone('code', 'сигнал терминалу') === 1 && SugarCube.setup.phone('code', 'СИГНАЛ ТЕРМИНАЛУ', '5') === 1 && SugarCube.setup.phone('code', 'сигнал терминалу', '3') === 0));
	await page.click('.passage a:text-is("Назад")');
	await page.waitForTimeout(300);
	p3.send('code', {code: '4242', num: '3'});
	await sleep(800);
	check('код 4242 с №3 один раз — событие «не меньше 2» ждёт', (await page.evaluate(() => SugarCube.State.passage)) === 'NetHome');
	p5.send('code', {code: '4242', num: '5'});
	await sleep(800);
	check('код с другого телефона не считается за №3', (await page.evaluate(() => SugarCube.State.passage)) === 'NetHome');
	p3.send('code', {code: '4242'});
	await page.waitForFunction(() => SugarCube.State.passage === 'NetThree', null, {timeout: 5000}).catch(() => {});
	check('второй раз с №3 (номер — из «от кого» центра) → событие', (await page.evaluate(() => SugarCube.State.passage)) === 'NetThree');
	await page.click('.passage a:text-is("Назад")');
	await page.waitForTimeout(300);
	p5.send('event', {name: 'шлюз'});
	await page.waitForFunction(() => SugarCube.State.passage === 'NetEvent', null, {timeout: 5000}).catch(() => {});
	check('событие с телефона → «СОБЫТИЕ С ТЕЛЕФОНА»', (await page.evaluate(() => SugarCube.State.passage)) === 'NetEvent');
	master.send('term', {set: {netVar: 7}});
	await page.waitForFunction(() => SugarCube.State.variables.netVar === 7, null, {timeout: 4000}).catch(() => {});
	check('переменная с пульта мастера → $netVar = 7', (await page.evaluate(() => SugarCube.State.variables.netVar)) === 7);
	master.ws.send(JSON.stringify({t: 'set', key: 'v:vote1:a3', value: 1}));
	master.ws.send(JSON.stringify({t: 'set', key: 'v:vote1:a5', value: 1}));
	await sleep(300);
	master.send('vote-close', {id: 'vote1', term: 'netAlbum', options: ['Альбом А', 'Альбом Б']});
	await page.waitForFunction(() => SugarCube.State.variables.netAlbum === 'Альбом Б', null, {timeout: 4000}).catch(() => {});
	check('итог голосования → $netAlbum = «Альбом Б»', (await page.evaluate(() => SugarCube.State.variables.netAlbum)) === 'Альбом Б');

	// Сессия 35 (Т4-3, Т4-4): общая переменная $power — у центра «var:power»; событие stay с действиями
	check('общая переменная: при связи терминал прислал начальное 5', !!(await master.wait(o => o.t === 'state' && o.key === 'var:power' && o.value === 5)));
	await page.evaluate(() => SugarCube.Engine.play('NetHome'));
	await page.waitForTimeout(300);
	await link('Энергия +1');
	check('терминал: $power += 1 → центр и телефоны: 6', !!(await p5.wait(o => o.t === 'state' && o.key === 'var:power' && o.value === 6)));
	p5.ws.send(JSON.stringify({t: 'set', key: 'var:power', add: -6, base: 5}));
	check('телефон «−6» → $power = 0 у терминала, событие stay: «Телефонам» и $power = 3', !!(await p3.wait(o => o.kind === 'notify' && o.body.title === 'РЕАКТОР')) && !!(await master.wait(o => o.t === 'state' && o.key === 'var:power' && o.value === 3)));
	check('событие stay — терминал остался на своём экране', (await page.evaluate(() => SugarCube.State.passage)) === 'NetHome' && (await page.evaluate(() => SugarCube.State.variables.power)) === 3);
	master.ws.send(JSON.stringify({t: 'set', key: 'var:power', value: 10}));
	await page.waitForFunction(() => SugarCube.State.passage === 'NetFull', null, {timeout: 5000}).catch(() => {});
	check('пульт: $power = 10 → событие с экраном, действие «Телефонам» до перехода', (await page.evaluate(() => SugarCube.State.passage)) === 'NetFull' && !!(await p5.wait(o => o.kind === 'notify' && o.body.title === 'ЭНЕРГИЯ')));
	check('экран события: строки <<sg-event-do>> не видно', !(await page.evaluate(() => document.querySelector('.passage').innerText)).includes('sg-event-do') && (await page.evaluate(() => document.querySelector('.passage').innerText)).includes('ПОЛНЫЙ ЗАРЯД'));
	await page.click('.passage a:text-is("Назад")');
	await page.waitForTimeout(300);

	// перезагрузка: старое не повторяется, счёт — в автокопии
	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForFunction(() => window.SgTermNet && window.SgTermNet.on, null, {timeout: 6000});
	await sleep(800);
	check('после перезагрузки счёт тот же (автокопия), старые сообщения не посчитаны снова', await page.evaluate(() => SugarCube.setup.phone('code', '4242', '3') === 2 && SugarCube.setup.phone('event', 'шлюз') === 1));
	master.ws.send(JSON.stringify({t: 'set', key: 'var:power', value: 8}));
	await page.waitForFunction(() => SugarCube.State.variables.power === 8, null, {timeout: 4000}).catch(() => {});
	check('после перезагрузки общая переменная — значение центра (8)', (await page.evaluate(() => SugarCube.State.variables.power)) === 8);

	// без связи — очередь, огонёк красный, потом уходит
	center.kill();
	await sleep(600);
	await page.evaluate(() => SugarCube.Engine.play('NetHome'));
	await page.waitForTimeout(300);
	await link('Всем');
	check('без связи: сообщение ждёт, огонёк красный', await page.evaluate(() => SgTermNet.queued() === 1 && [...document.body.children].some(e => e.title && /ждут отправки: 1/.test(e.title) && e.style.background.includes('255, 51, 51'))));
	await link('Энергия +1');
	center = await startCenter();
	const p7 = phone({role: 'phone', dev: 'ph7', acc: 'a7', num: '7', name: 'Пилот'});
	await p7.ready;
	check('связь вернулась — ушло', !!(await p7.wait(o => o.kind === 'notify' && o.body.text === 'Шлюз открыт', 10000)));
	check('изменение общей переменной без связи ($power 9) ушло центру при новой связи', !!(await p7.wait(o => o.t === 'state' && o.key === 'var:power' && o.value === 9, 6000)));

	await page.keyboard.press('Control+Shift+KeyN');
	await sleep(200);
	check('Ctrl+Shift+N — окно «Сеть»', await page.evaluate(() => document.body.innerText.includes('СЕТЬ ТЕРМИНАЛА')));
	check('ошибок на странице нет', errors.length === 0, errors.join('; '));

	// Сессия 32 (замечание автора): QR «СЕТЬ» камерой ноутбука — в Chrome для Windows нет BarcodeDetector,
	// камера гасла сразу; теперь в движке jsQR. Поддельная камера показывает QR с адресом центра.
	const qr = require(path.join(appRepo, 'node_modules/qrcode-generator'))(0, 'M');
	qr.addData(`SGNET:ws://127.0.0.1:${port}`);
	qr.make();
	const n = qr.getModuleCount(), cell = 8, quiet = 4, side = (n + quiet * 2) * cell, w = 640, h = 480;
	const pix = Buffer.alloc(w * h * 3, 255);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		if (!qr.isDark(y, x)) continue;
		for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
			const px = (w - side) / 2 + (x + quiet) * cell + dx, py = (h - side) / 2 + (y + quiet) * cell + dy;
			pix.fill(0, (py * w + px) * 3, (py * w + px) * 3 + 3);
		}
	}
	fs.writeFileSync('/tmp/sg-net-qr.ppm', Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), pix]));
	execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', '/tmp/sg-net-qr.ppm', '-t', '3', '-r', '10', '-pix_fmt', 'yuv420p', '/tmp/sg-net-qr.y4m']);
	const camBrowser = await chromium.launch({args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=/tmp/sg-net-qr.y4m']});
	try {
		const cam = await camBrowser.newPage({viewport: {width: 1600, height: 900}});
		const camErrors = [];

		cam.on('pageerror', e => camErrors.push(e.message));
		await cam.goto(base + 'net-test.html');
		await cam.waitForSelector('#sg-start');
		await cam.click('#sg-start');
		await cam.waitForSelector('.passage');
		await cam.evaluate(() => document.fullscreenElement && document.exitFullscreen());
		check('jsQR в движке, BarcodeDetector не нужен', await cam.evaluate(() => typeof window.jsQR === 'function'));
		await cam.evaluate(() => { delete window.BarcodeDetector; });
		await cam.keyboard.press('Control+Shift+KeyN');
		await sleep(200);
		await cam.getByRole('button', {name: 'QR КАМЕРОЙ'}).click();
		await sleep(1200);
		check('камера не гаснет сразу (идёт поиск QR или уже подключено)', await cam.evaluate(() => SgTermNet.on || [...document.querySelectorAll('video')].some(v => v.style.display === 'block' && v.srcObject)));
		await cam.waitForFunction(() => window.SgTermNet && window.SgTermNet.on, null, {timeout: 8000}).catch(() => {});
		check('QR «СЕТЬ» камерой ноутбука → подключено к центру', await cam.evaluate(() => SgTermNet.on && /127\.0\.0\.1/.test(SgTermNet.url)), await cam.evaluate(() => SgTermNet.url));
		check('камера после QR выключена, ошибок нет', (await cam.evaluate(() => [...document.querySelectorAll('video')].every(v => v.style.display === 'none'))) && camErrors.length === 0, camErrors.join('; '));
	} finally {
		await camBrowser.close();
	}
} finally {
	await browser.close();
	server.close();
	try {
		center.kill();
	} catch (e) {}
}
console.log(results.every(Boolean) ? `ВСЁ ХОРОШО (${results.length})` : `ОШИБКИ: ${results.filter(r => !r).length} из ${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
