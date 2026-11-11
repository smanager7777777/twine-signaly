// Проверка сессии 30 в Chromium: раздел «Помехи» (по видам радио, подбор на шкале, поимка помехи,
// старая запись jam у вида), «СЛУЧАЙНО» и прогресс у всех радио, свой цвет лампочки, «РЕВЕРС
// НЕДОСТУПЕН», приглушение общего плеера звуком-сигналом, радио с декодером (Д2): ДЕКОД, набор
// картинки SSTV в такт звуку, шум при неточной настройке, строки помех, новая картинка при повторе,
// окно на весь терминал, набранное живёт между экранами, после сбоя декодер выключен.
// node sstv-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <sharp> <снимки или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, sharpPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const sharp = require(sharpPath);
const sstv = require(path.resolve('.signaly-tools/src/util/signaly/signaly-sstv.js'));
const here = path.dirname(new URL(import.meta.url).pathname);

function writeWav(file, samples, rate) {
	const n = samples.length;
	const buf = Buffer.alloc(44 + n * 2);

	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + n * 2, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(rate, 24);
	buf.writeUInt32LE(rate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) {
		buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i]))), 44 + i * 2);
	}
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, buf);
}

function tone(file, seconds, freq) {
	const rate = 8000;
	const s = new Float32Array(Math.round(rate * seconds));

	for (let i = 0; i < s.length; i++) {
		s[i] = 2000 * Math.sin((2 * Math.PI * freq * i) / rate);
	}
	writeWav(file, s, rate);
}

const A = 'media/audio/stest/';
const audioDir = path.join(gameDir, A);

for (const [name, sec, f] of [['long', 30, 330], ['t2', 30, 350], ['t3', 30, 370], ['t4', 30, 390], ['nocopy', 20, 500], ['amb', 20, 260], ['noise', 5, 0], ['beep', 2, 880]]) {
	tone(path.join(audioDir, name + '.wav'), sec, f);
}
for (let i = 1; i <= 5; i++) {
	tone(path.join(audioDir, `j${i}.wav`), 6, 200 + i * 40);
}
// Копии реверса для «Длинного» и t2…t4 (у «Без копии» её нет — «РЕВЕРС НЕДОСТУПЕН»).
for (const name of ['long', 't2', 't3', 't4']) {
	fs.mkdirSync(path.join(gameDir, 'media/audio/reverse/stest'), {recursive: true});
	fs.copyFileSync(path.join(audioDir, name + '.wav'), path.join(gameDir, `media/audio/reverse/stest/${name}.wav`));
}

// Передача с картинкой SSTV (Robot 36): слева красное, справа синее, низ — зелёный.
const W = 320;
const H = 240;
const rgba = new Uint8ClampedArray(W * H * 4);

for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const i = (y * W + x) * 4;

		rgba[i] = y >= 160 ? 20 : x < 160 ? 230 : 20;
		rgba[i + 1] = y >= 160 ? 210 : 20;
		rgba[i + 2] = y >= 160 ? 20 : x < 160 ? 20 : 230;
		rgba[i + 3] = 255;
	}
}

const rate = 11025;
const sound = sstv.encodeSstv(sstv.sstvMode('Robot 36'), rgba, W, H, rate, 1);

writeWav(path.join(audioDir, 'sstv-tx.wav'), Float32Array.from(sound, v => v * 20000), rate);

const [image] = sstv.decodeSstv(sound, rate);
const imgPath = 'media/img/sstv/stest/sstv-tx-1.png';

fs.mkdirSync(path.join(gameDir, 'media/img/sstv/stest'), {recursive: true});
await sharp(Buffer.from(image.rgba.buffer), {raw: {width: image.width, height: image.height, channels: 4}}).png().toFile(path.join(gameDir, imgPath));

const template = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const air = `noise "${A}noise.wav" noisevolume 60 noiseranges "88-100" incoming "ВХОДЯЩАЯ ПЕРЕДАЧА" catch 2`;
const test =
	template
		.replace(/^:: Музыка \[sg-music\][^]*?(?=^:: )/m, '')
		.replace(/^(:: StoryInit[^\n]*\n)/m, '$1<<set $picture to true>>\n')
		.replace(
			/(<<sg-radio-view "Сломанное"[^\n]*>>)/,
			`$1\n<<sg-radio-view "Первое" type fixed frame "#c9a24a" elements "#39ff7a" label "П1" jamsmin 2 jamsmax 2 ${air}>>\n` +
				`<<sg-radio-view "Второе" type fixed frame "#c9a24a" elements "#39ff7a" label "П2" jamsmin 3 jamsmax 3 ${air}>>\n` +
				`<<sg-radio-view "Декодер" type decoder frame "#c9a24a" elements "#39ff7a" label "ОРБИТА-Д" lamp "#ff0000" decoder "#00ffff" jamsmin 0 jamsmax 0 ${air}>>\n` +
				`<<sg-radio-view "Старое" type fixed frame "#c9a24a" elements "#39ff7a" label "П3" jam "${A}j5.wav|1|80" jamsmin 1 jamsmax 1 ${air}>>`
		)
		.replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,9900","size":"100,100"}
<<sg-music volume 50 spin 0.3>>
<<sg-folder "Записи" section radio>>
<<sg-track "Длинный" "${A}long.wav">><</sg-track>>
<<sg-track "Второй" "${A}t2.wav">><</sg-track>>
<<sg-track "Третий" "${A}t3.wav">><</sg-track>>
<<sg-track "Четвёртый" "${A}t4.wav">><</sg-track>>
<<sg-track "Без копии" "${A}nocopy.wav">><</sg-track>>
<<sg-folder "Фон" section ambient>>
<<sg-track "Гул" "${A}amb.wav">><</sg-track>>
<<sg-folder "Эфир" section air>>
<<sg-track "Картинка" "${A}sstv-tx.wav" to "Записи" width 1>>$picture<</sg-track>>
<<sg-folder "Первое" section jam>>
<<sg-track "j1" "${A}j1.wav" width 0.6>><</sg-track>>
<<sg-track "j2" "${A}j2.wav">><</sg-track>>
<<sg-folder "Второе" section jam>>
<<sg-track "j3" "${A}j3.wav">><</sg-track>>
<<sg-track "j4" "${A}j4.wav">><</sg-track>>

:: SSTV [sg-sstv] {"position":"200,9900","size":"100,100"}
<<sg-sstv "${A}sstv-tx.wav" stamp "1-1" img "${imgPath}" mode "${image.mode}" at ${image.at} line ${image.line} rows ${image.rows} per ${image.per} width ${image.width} height ${image.height}>>

:: SHome {"position":"300,9900","size":"100,100"}
Дом
<<link "Сигнал" >><<sg-sound "${A}beep.wav" volume 50 duck ":music" to 30>><</link>>

:: SFirst {"position":"400,9900","size":"100,100"}
<<sg-radio "Первое">>

:: SSecond {"position":"500,9900","size":"100,100"}
<<sg-radio "Второе">>

:: SOld {"position":"600,9900","size":"100,100"}
<<sg-radio "Старое">>

:: SDec {"position":"700,9900","size":"100,100"}
<<sg-radio "Декодер">>
`;

fs.writeFileSync(path.join(gameDir, 'sstv-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'sstv-test.twee'), path.join(gameDir, 'sstv-test.html'), 'start=SHome']);

const types = {html: 'text/html; charset=utf-8', jpg: 'image/jpeg', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2'};
const server = http
	.createServer((req, res) => {
		const file = path.join(gameDir, decodeURIComponent(req.url.split('?')[0]));

		if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404);
			res.end();
			return;
		}

		const stat = fs.statSync(file);
		const type = types[path.extname(file).slice(1)] || 'application/octet-stream';
		const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');

		if (range) {
			const from = Number(range[1]);
			const to = range[2] ? Number(range[2]) : stat.size - 1;

			res.writeHead(206, {'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${from}-${to}/${stat.size}`, 'Content-Length': to - from + 1});
			fs.createReadStream(file, {start: from, end: to}).pipe(res);
			return;
		}
		res.writeHead(200, {'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size});
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

async function open(url) {
	const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
	const page = await context.newPage();

	page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	await page.goto(url);
	await page.waitForSelector('#sg-start');
	return page;
}

async function start(page) {
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(300);
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	return page;
}

const go = async (page, name, wait = 400) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const m = page => page.evaluate(() => SugarCube.setup.signaly.music());
const airOf = page => page.evaluate(() => SugarCube.setup.signaly.air());
const dec = page => page.evaluate(() => {
	const d = SugarCube.setup.signaly.dec();

	return {...d, red: d.pixel(60, 10), blue: d.pixel(260, 10), green: d.pixel(160, 200)};
});
const line = (page, name) =>
	page.locator('.sg-radio .sg-r-line', {has: page.locator('.sg-r-name', {hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)})}).first();
const mq = page => page.locator('.sg-radio .sg-r-mq-text').textContent();
const near = (a, b, d = 0.3) => typeof a === 'number' && Math.abs(a - b) < d;
const tune = async (page, f, wait = 350) => {
	await page.evaluate(x => {
		SugarCube.State.variables.sgMusic.freq = x;
	}, f);
	await page.waitForTimeout(wait);
};
const style = (page, sel, prop) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
const jamIds = a => a.items[0].srcs.filter(s => s.kind === 'jam').map(s => s.id).sort();

async function layout(page, say, name) {
	const box = await page.locator('.sg-radio').boundingBox();
	const parts = await page.locator('.sg-radio > :not(svg)').evaluateAll(els => els.map(e => {
		const r = e.getBoundingClientRect();

		return {cls: e.className, x: r.left, y: r.top, w: r.width, h: r.height};
	}));
	const overlap = parts.filter((p, i) => parts.some((q, j) => j !== i && p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1));

	say(`${name}: части не налезают друг на друга и в квадрате`, !overlap.length && Math.abs(box.width - box.height) < 1 &&
		parts.every(p => p.x >= box.x - 1 && p.y >= box.y - 1 && p.x + p.w <= box.x + box.width + 1 && p.y + p.h <= box.y + box.height + 1),
		JSON.stringify(overlap.map(p => p.cls)));
	say(`${name}: полоса прогресса и «СЛУЧАЙНО»`, (await page.locator('.sg-radio .sg-r-prog').count()) === 1 && (await page.locator('.sg-radio .sg-r-shuffle').count()) === 1);
}

async function jamChecks(page, say) {
	await go(page, 'SFirst', 600);
	await layout(page, say, 'отремонтированное Р2');

	let a = await airOf(page);

	say('Первое: на шкале обе его помехи', JSON.stringify(jamIds(a)) === JSON.stringify(['jam:Первое/j1', 'jam:Первое/j2']), JSON.stringify(jamIds(a)));
	say('лампочка — цвет шкалы (своего нет)', (await style(page, '.sg-radio .sg-r-lamp', 'stroke')) === 'rgb(57, 255, 122)');

	// Ловим помеху j1, как передачу.
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.evaluate(() => SugarCube.setup.signaly.airPlace('media/audio/stest/j1.wav', 1000));
	await tune(page, 1000, 400);
	a = await airOf(page);
	say('точно на помехе — удержание идёт (помехи ловятся)', !!a.items[0].hold && a.items[0].hold.name === 'jam:Первое/j1', JSON.stringify(a.items[0].hold));
	await page.waitForTimeout(2400);

	let s = await m(page);

	say('помеха поймана и звучит как трек каталога', s.state.caught['jam:Первое/j1'] === 1 && s.state.cur === 'jam:Первое/j1' && s.playing);
	say('каталог — в папке «Помехи», в ней j1', (await page.locator('.sg-radio .sg-r-path').textContent()).includes('/Помехи/') && (await line(page, 'j1').count()) === 1);
	await line(page, '..').click();
	await page.waitForTimeout(200);
	say('папка «Помехи» — в корне каталога радио', (await line(page, 'Помехи').count()) === 1 && (await line(page, 'Записи').count()) === 1);

	// Снова на экран: одна пойманная этого радио и одна ещё не пойманная.
	await go(page, 'SHome');
	await go(page, 'SFirst', 600);
	a = await airOf(page);
	say('снова Первое: пойманная j1 и не пойманная j2', JSON.stringify(jamIds(a)) === JSON.stringify(['jam:Первое/j1', 'jam:Первое/j2']), JSON.stringify(jamIds(a)));

	// Второе — 3 помехи: свои и ещё не пойманная j2 радио выше; пойманная j1 чужая — не выпадает.
	await go(page, 'SSecond', 600);
	a = await airOf(page);
	say('Второе: свои j3, j4 и не пойманная j2 Первого; j1 нет', JSON.stringify(jamIds(a)) === JSON.stringify(['jam:Второе/j3', 'jam:Второе/j4', 'jam:Первое/j2']), JSON.stringify(jamIds(a)));

	// Старая запись jam у вида — помехи из неё.
	const ids = (await m(page)).table.ids;

	say('старая запись помех у вида понимается (jam:Старое/j5)', ids.includes('jam:Старое/j5'));
	await go(page, 'SOld', 600);
	a = await airOf(page);
	say('Старое: одна помеха из своей и не пойманных выше', jamIds(a).length === 1 && ['jam:Старое/j5', 'jam:Первое/j2', 'jam:Второе/j3', 'jam:Второе/j4'].includes(jamIds(a)[0]), JSON.stringify(jamIds(a)));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'sstv-fixed.png')});
	}
}

async function shuffleChecks(page, say) {
	await go(page, 'SFirst', 600);
	await page.evaluate(() => {
		const st = SugarCube.State.variables.sgMusic;

		st.scan = false;
	});
	if (await line(page, '..').count()) {
		await line(page, '..').click();
		await page.waitForTimeout(150);
	}
	await line(page, 'Записи').click();
	await page.waitForTimeout(150);
	await line(page, 'Длинный').click();
	await page.waitForTimeout(500);
	await page.locator('.sg-radio .sg-r-shuffle').click();
	await page.waitForTimeout(200);

	const s = await m(page);

	say('«СЛУЧАЙНО» горит, у Атмосферы своё не включилось', s.state.rshuffle === true && !s.state.shuffle && (await page.locator('.sg-radio .sg-r-shuffle.sg-r-lit').count()) === 1);

	const order = ['Записи/Длинный', 'Записи/Второй', 'Записи/Третий', 'Записи/Четвёртый', 'Записи/Без копии'];
	let jumps = 0;
	let repeats = 0;

	for (let i = 0; i < 8; i++) {
		const before = (await m(page)).state.cur;

		await page.evaluate(() => {
			const a = document.createElement('div');

			SugarCube.Wikifier.wikifyEval('<<sg-mus next>>');
			a.remove();
		});
		await page.waitForTimeout(80);

		const after = (await m(page)).state.cur;

		repeats += after === before ? 1 : 0;
		jumps += order.indexOf(after) !== (order.indexOf(before) + 1) % order.length ? 1 : 0;
	}
	say('со «СЛУЧАЙНО» следующий трек — случайный, не тот же', jumps > 0 && repeats === 0, JSON.stringify({jumps, repeats}));

	// Прогресс на отремонтированном радио: щелчок на середине — 15 с.
	await line(page, 'Длинный').click();
	await page.waitForTimeout(600);

	const prog = await page.locator('.sg-radio .sg-r-prog-line').boundingBox();

	await page.mouse.click(prog.x + prog.width * 0.5, prog.y + prog.height / 2);
	await page.waitForTimeout(300);

	const r = await page.evaluate(() => SugarCube.setup.signaly.rev());

	say('прогресс у отремонтированного радио: середина — 15 с', near(r.pos, 15, 0.6), String(r.pos));
	await page.locator('.sg-radio .sg-r-shuffle').click();

	// Сломанное радио шаблона — тоже с прогрессом и «СЛУЧАЙНО».
	await go(page, 'radio', 600);
	await layout(page, say, 'сломанное С2 (шаблон)');
	if (shots) {
		await page.screenshot({path: path.join(shots, 'sstv-broken.png')});
	}
}

async function duckChecks(page, say) {
	await go(page, 'SFirst', 500);
	await line(page, 'Длинный').click().catch(() => {});
	await page.waitForTimeout(400);
	await go(page, 'SHome', 300);

	const before = (await m(page)).volume;

	await page.locator('.passage a', {hasText: 'Сигнал'}).click();
	await page.waitForTimeout(900);

	const during = (await m(page)).volume;

	await page.waitForTimeout(2200);

	const after = (await m(page)).volume;

	say('звук-сигнал «приглушить музыку» глушит общий плеер до 30 % и возвращает', near(during, before * 0.3, 0.02) && near(after, before, 0.01), JSON.stringify({before, during, after}));
}

async function decoderChecks(page, say) {
	await go(page, 'SDec', 700);
	await layout(page, say, 'с декодером Д2');
	say('Д2: окно декодера, ДЕКОД, РЕВЕРС, катушки, шкала', (await page.locator('.sg-radio.sg-radio-decoder .sg-r-dec canvas').count()) === 1 &&
		(await page.locator('.sg-radio .sg-r-decbtn').count()) === 1 && (await page.locator('.sg-radio .sg-r-revbtn').count()) === 1 &&
		(await page.locator('.sg-radio .sg-r-reel').count()) === 2 && (await page.locator('.sg-radio .sg-r-scale').count()) === 1);
	say('свой цвет лампочки (красный) и декодера (голубой)', (await style(page, '.sg-radio .sg-r-lamp', 'stroke')) === 'rgb(255, 0, 0)' &&
		(await style(page, '.sg-radio .sg-r-dec', 'borderTopColor')) === 'rgb(0, 255, 255)' && (await style(page, '.sg-radio .sg-r-decbtn', 'color')) === 'rgb(0, 255, 255)');
	say('декодер выключен', (await page.locator('.sg-radio .sg-r-dec-cap').textContent()) === 'ДЕКОДЕР ВЫКЛЮЧЕН' && !(await dec(page)).on);

	// РЕВЕРС у трека без копии — строка пишет «РЕВЕРС НЕДОСТУПЕН».
	if (await line(page, '..').count()) {
		await line(page, '..').click();
		await page.waitForTimeout(150);
	}
	await line(page, 'Записи').click();
	await page.waitForTimeout(150);
	await line(page, 'Без копии').click();
	await page.waitForTimeout(600);

	const rb = await page.locator('.sg-radio .sg-r-revbtn').boundingBox();

	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(800);
	say('нет копии — пока держат, «◀◀ РЕВЕРС НЕДОСТУПЕН»', (await mq(page)).includes('РЕВЕРС НЕДОСТУПЕН'), await mq(page));
	await page.mouse.up();
	await page.waitForTimeout(300);
	say('отпустили — строка снова «сейчас играет»', (await mq(page)).includes('СЕЙЧАС ИГРАЕТ'), await mq(page));
	await page.locator('.sg-radio .sg-r-pause').click();

	// ДЕКОД, поиск, точно на передаче с картинкой.
	await page.locator('.sg-radio .sg-r-decbtn').click();
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.waitForTimeout(200);
	await page.evaluate(() => SugarCube.setup.signaly.airPlace('Эфир/Картинка', 1000));
	await tune(page, 1000, 100);
	await page.waitForTimeout(1500);

	let d = await dec(page);

	say('ДЕКОД горит, до первой строки — ждёт', d.on && (await page.locator('.sg-radio .sg-r-decbtn.sg-r-lit').count()) === 1, JSON.stringify(d));
	// Удержание 2 с ловит передачу; ловим, чтобы место трека шло дальше, — и смотрим набор.
	await page.waitForTimeout(3500);
	d = await dec(page);

	const s = await m(page);

	say('передача с картинкой поймана, декодер читает её дальше', s.state.caught['Эфир/Картинка'] === 1 && d.state === 'image' && d.mode === 'Robot 36', JSON.stringify(d));
	say('строки идут в такт звуку (≈(место − начало) / 0,15 с)', d.drawn > 10 && d.drawn < 60, String(d.drawn));
	say('набранные строки — картинка: слева красное, справа синее', d.red && d.red[0] > 170 && d.red[2] < 90 && d.blue && d.blue[2] > 170 && d.blue[0] < 90, JSON.stringify([d.red, d.blue]));
	say('подпись — режим и доля', /^ROBOT 36 {2}· {2}\d+%$/.test(await page.locator('.sg-radio .sg-r-dec-cap').textContent()), await page.locator('.sg-radio .sg-r-dec-cap').textContent());

	// Перемотка почти в конец — набирается быстро, низ зелёный.
	await page.evaluate(() => {
		const a = SugarCube.setup.signaly;

		a.music();
	});
	const prog = await page.locator('.sg-radio .sg-r-prog-line').boundingBox();

	await page.mouse.click(prog.x + prog.width * 0.95, prog.y + prog.height / 2);
	await page.waitForTimeout(600);
	d = await dec(page);
	say('перемотка вперёд — картинка набрана до низа (зелёное)', d.drawn >= 220 && d.green && d.green[1] > 150 && d.green[0] < 90, JSON.stringify({drawn: d.drawn, green: d.green}));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'sstv-decoder.png')});
	}

	// На весь терминал и обратно.
	const small = await page.locator('.sg-radio .sg-r-dec').boundingBox();

	await page.locator('.sg-radio .sg-r-dec').click();
	await page.waitForTimeout(300);

	const big = await page.locator('.sg-radio .sg-r-dec').boundingBox();
	const term = await page.locator('#passages').boundingBox();

	say('щелчок по окну — на весь терминал', near(big.width, term.width, 2) && near(big.height, term.height, 2) && near(big.x, term.x, 2), JSON.stringify({big, term}));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'sstv-full.png')});
	}
	await page.locator('.sg-radio .sg-r-dec').click();
	await page.waitForTimeout(300);

	const back = await page.locator('.sg-radio .sg-r-dec').boundingBox();

	say('ещё щелчок — обратно', near(back.width, small.width, 1) && near(back.x, small.x, 1));

	// Трек сначала (доиграл или перемотали) — новая картинка.
	await page.mouse.click(prog.x + 1, prog.y + prog.height / 2);
	if (!(await m(page)).playing) {
		await page.locator('.sg-radio .sg-r-play').click();
	}
	await page.waitForTimeout(500);
	d = await dec(page);
	say('трек с начала — экран чистый, ждёт заголовок картинки', d.drawn === 0 && d.state === 'idle' && d.red && d.red[0] < 30, JSON.stringify(d));
	await page.waitForTimeout(3000);
	d = await dec(page);
	say('и набирает картинку заново', d.key.endsWith('#0') && d.drawn > 3 && d.drawn < 30, JSON.stringify(d));

	const drawn = d.drawn;

	// Ушли с экрана и вернулись — набранное на месте.
	await page.locator('.sg-radio .sg-r-pause').click();
	await page.waitForTimeout(200);
	d = await dec(page);
	await go(page, 'SHome');
	await go(page, 'SDec', 600);

	const d2 = await dec(page);

	say('ушли и вернулись — набранное на месте, на паузе набор стоит', d2.drawn === d.drawn && d2.key === d.key && d.drawn >= drawn, JSON.stringify({d, d2}));

	// Неточно на 0,3 МГц — строки с шумом пропорционально (ширина 1 МГц → 0,3).
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.waitForTimeout(200);
	await page.evaluate(() => SugarCube.setup.signaly.airPlace('Эфир/Картинка', 1000));

	const caught = (await m(page)).state.caught['Эфир/Картинка'];

	say('пойманная передача из эфира ушла (шума не с чем проверять — ставлю её снова)', caught === 1);
	await page.evaluate(() => {
		delete SugarCube.State.variables.sgMusic.caught['Эфир/Картинка'];
	});
	await go(page, 'SHome');
	await go(page, 'SDec', 600);
	if (!(await m(page)).state.scan) {
		await page.locator('.sg-radio .sg-r-scanbtn').click();
	}
	await page.evaluate(() => SugarCube.setup.signaly.airPlace('Эфир/Картинка', 1000));
	await tune(page, 1003, 2500);
	d = await dec(page);
	say('неточно на 0,3 МГц — набор с шумом 0,3', d.state === 'image' && near(d.noise, 0.3, 0.05), JSON.stringify(d));

	// Далеко от передачи, звучит шум — строки помех.
	await tune(page, 900, 1500);
	d = await dec(page);
	say('звучит не SSTV — строки помех, «НЕТ СИНХРОНИЗАЦИИ»', d.state === 'garbage' && d.gy > 3 && (await page.locator('.sg-radio .sg-r-dec-cap').textContent()) === 'НЕТ СИНХРОНИЗАЦИИ', JSON.stringify(d));

	// Сбой: декодер выключен.
	await page.reload();
	await page.waitForSelector('#sg-start');
	await start(page);
	await page.waitForTimeout(500);
	say('после сбоя декодер выключен, радио Д2 на месте', !(await dec(page)).on && (await page.locator('.sg-radio.sg-radio-decoder').count()) === 1);
}

for (const [url, prefix] of [[base + 'sstv-test.html', ''], ...extra.map(f => [base + path.relative(gameDir, path.resolve(f)), `[${path.basename(f)}] `])]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const page = await start(await open(url));

	await jamChecks(page, say);
	await shuffleChecks(page, say);
	await duckChecks(page, say);
	await decoderChecks(page, say);
	await page.context().close();
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
