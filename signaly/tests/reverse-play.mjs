// Проверка сессии 29 в Chromium: замечания к build-31 (лампочка точной настройки, поимка при
// малой громкости, свои цвета частей радио, каталог показывает пойманный трек) и шаг 7.4 —
// радио с реверсом (каркас В2): зажатый РЕВЕРС, место едет назад, свой файл с посланием,
// полоса прогресса (и на паузе), катушки.
// node reverse-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

// Звуки нужной длины: тихий тон, 8 кГц, моно. Возвращает отсчёты.
function wav(file, seconds, freq) {
	const rate = 8000;
	const n = Math.round(rate * seconds);
	const samples = new Int16Array(n);

	for (let i = 0; i < n; i++) {
		samples[i] = Math.round(2000 * Math.sin((2 * Math.PI * freq * i) / rate) * (0.3 + (0.7 * i) / n));
	}
	writeWav(file, samples, rate);
	return samples;
}

function writeWav(file, samples, rate = 8000) {
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
		buf.writeInt16LE(samples[i], 44 + i * 2);
	}
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, buf);
}

const R = 'media/audio/rtest/';
const audioDir = path.join(gameDir, R);
const long = wav(path.join(audioDir, 'long.wav'), 30, 330);

// Развёрнутая копия — как её делает программа (media/audio/reverse/<путь>.wav).
writeWav(path.join(gameDir, 'media/audio/reverse/rtest/long.wav'), Int16Array.from(long).reverse());
wav(path.join(audioDir, 'msg-track.wav'), 20, 440);
wav(path.join(audioDir, 'msg-back.wav'), 10, 220);
wav(path.join(audioDir, 'nocopy.wav'), 20, 500);
wav(path.join(audioDir, 'pre.wav'), 3, 900);
wav(path.join(audioDir, 'tx.wav'), 40, 520);
wav(path.join(audioDir, 'amb.wav'), 20, 260);
wav(path.join(audioDir, 'noise.wav'), 5, 0);
for (let i = 1; i <= 30; i++) {
	wav(path.join(audioDir, `f${i}.wav`), 3, 300 + i * 10);
}

const template = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const filler = Array.from({length: 30}, (_, i) => `<<sg-track "Файл ${String(i + 1).padStart(2, '0')}" "${R}f${i + 1}.wav">><</sg-track>>`).join('\n');
const test =
	template
		.replace(/^:: Музыка \[sg-music\][^]*?(?=^:: )/m, '')
		.replace(
			/(<<sg-radio-view "Сломанное"[^\n]*>>)/,
			`$1\n<<sg-radio-view "Цвета" type fixed frame "#ff8800" elements "#00ffff" label "ЦВЕТА" buttons "#ff0000" power "#0000ff" scale "#ffff00" catalog "#ff00ff" inner "#ffffff" ` +
				`noise "${R}noise.wav" noisevolume 60 noiseranges "88-100" jamsmin 0 jamsmax 0 incoming "ВХОДЯЩАЯ ПЕРЕДАЧА" catch 2>>\n` +
				`<<sg-radio-view "Реверс" type reverse frame "#c9a24a" elements "#39ff7a" label "ОРБИТА-РЕВЕРС" jamsmin 0 jamsmax 0 incoming "ВХОДЯЩАЯ ПЕРЕДАЧА" catch 2>>`
		)
		.replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,9700","size":"100,100"}
<<sg-music volume 10 spin 0.3>>
<<sg-folder "Записи" section radio>>
<<sg-track "Длинный" "${R}long.wav" pre "${R}pre.wav" wait 1 tail 1>><</sg-track>>
<<sg-track "Послание" "${R}msg-track.wav" reverse "${R}msg-back.wav">><</sg-track>>
<<sg-track "Без копии" "${R}nocopy.wav">><</sg-track>>
<<sg-folder "Архив" section radio>>
${filler}
<<sg-folder "Фон" section ambient>>
<<sg-track "Гул" "${R}amb.wav">><</sg-track>>
<<sg-folder "Эфир" section air>>
<<sg-track "Перехват" "${R}tx.wav" to "Архив" width 1>><</sg-track>>

:: RHome {"position":"200,9700","size":"100,100"}
Дом

:: RColors {"position":"300,9700","size":"100,100"}
<<sg-radio "Цвета">>

:: RReverse {"position":"400,9700","size":"100,100"}
<<sg-radio "Реверс">>
`;

fs.writeFileSync(path.join(gameDir, 'reverse-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'reverse-test.twee'), path.join(gameDir, 'reverse-test.html'), 'start=RHome']);

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

const go = async (page, name, wait = 300) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const m = page => page.evaluate(() => SugarCube.setup.signaly.music());
const air = page => page.evaluate(() => SugarCube.setup.signaly.air());
const rev = page => page.evaluate(() => SugarCube.setup.signaly.rev());
const line = (page, name) => page.locator('.sg-radio .sg-r-line', {has: page.locator('.sg-r-name', {hasText: new RegExp(`^${name}$`)})}).first();
const mq = page => page.locator('.sg-radio .sg-r-mq-text').textContent();
const near = (a, b, d = 0.3) => typeof a === 'number' && Math.abs(a - b) < d;
const tune = async (page, f, wait = 350) => {
	await page.evaluate(x => {
		SugarCube.State.variables.sgMusic.freq = x;
	}, f);
	await page.waitForTimeout(wait);
};
const style = (page, sel, prop) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);

async function colorChecks(page, say) {
	await go(page, 'RColors', 600);
	say('свой цвет кнопок (красный)', (await style(page, '.sg-radio .sg-r-play', 'borderTopColor')) === 'rgb(255, 0, 0)', await style(page, '.sg-radio .sg-r-play', 'borderTopColor'));
	say('ПОИСК и −/+ частоты — тоже цвет кнопок', (await style(page, '.sg-radio .sg-r-scanbtn', 'color')) === 'rgb(255, 0, 0)' && (await style(page, '.sg-radio .sg-r-fbtn', 'color')) === 'rgb(255, 0, 0)');
	say('свой цвет выключателя (синий)', (await style(page, '.sg-radio .sg-r-switch', 'borderTopColor')) === 'rgb(0, 0, 255)');
	say('свой цвет шкалы и частоты (жёлтый)', (await style(page, '.sg-radio .sg-r-scale', 'borderTopColor')) === 'rgb(255, 255, 0)' &&
		(await style(page, '.sg-radio .sg-r-tick', 'stroke')) === 'rgb(255, 255, 0)' && (await style(page, '.sg-radio .sg-r-freq', 'color')) === 'rgb(255, 255, 0)');
	say('свой цвет каталога (лиловый)', (await style(page, '.sg-radio .sg-r-cat', 'borderTopColor')) === 'rgb(255, 0, 255)' && (await style(page, '.sg-radio .sg-r-line', 'color')) === 'rgb(255, 0, 255)');
	say('внутренний каркас (белый), внешний — свой (оранжевый)', (await style(page, '.sg-radio .sg-r-thin', 'stroke')) === 'rgb(255, 255, 255)' &&
		(await style(page, '.sg-radio .sg-r-fr', 'stroke')) === 'rgb(255, 136, 0)');
	say('строка и громкость — цвет элементов', (await style(page, '.sg-radio .sg-r-mq', 'color')) === 'rgb(0, 255, 255)' && (await style(page, '.sg-radio .sg-r-digits', 'color')) === 'rgb(0, 255, 255)');
	if (shots) {
		await page.screenshot({path: path.join(shots, 'reverse-colors.png')});
	}
}

async function lampChecks(page, say) {
	// Лампочка: на точную частоту кнопками — горит; иглой — нет (а поимка идёт).
	await go(page, 'RReverse', 600);
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.waitForTimeout(300);
	await page.evaluate(() => SugarCube.setup.signaly.airPlace('Эфир/Перехват', 1050));
	await tune(page, 1048, 400);
	say('лампочка есть и не горит', (await page.locator('.sg-radio .sg-r-lamp').count()) === 1 && !(await air(page)).items[0].lamp);
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '+'}).click();
	await page.waitForTimeout(1100);
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '+'}).click();
	await page.waitForTimeout(300);

	let a = (await air(page)).items[0];

	say('кнопками на 105.0 — лампочка горит', (await air(page)).freq === 1050 && a.lamp && (await page.locator('.sg-radio .sg-r-lamp.sg-r-lamp-on').count()) === 1, JSON.stringify({freq: (await air(page)).freq, lamp: a.lamp}));
	await page.waitForTimeout(1100);
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '+'}).click();
	await page.waitForTimeout(300);
	say('сошли кнопкой на 105.1 — погасла', !(await air(page)).items[0].lamp);

	const sc = await page.locator('.sg-radio .sg-r-scale').boundingBox();
	const dial = await page.locator('.sg-radio .sg-r-dial').boundingBox();

	// Щелчок иглой ровно в 105.0: x = 18 + (1050 − 880) / 200 × 552 из 588.
	await page.mouse.click(dial.x + (dial.width * (18 + (170 / 200) * 552)) / 588, sc.y + sc.height / 2);
	await page.waitForTimeout(400);
	a = (await air(page)).items[0];
	say('иглой точно на 105.0 — лампочка не горит, удержание идёт', (await air(page)).freq === 1050 && !a.lamp && a.hold && a.hold.name === 'Эфир/Перехват', JSON.stringify({freq: (await air(page)).freq, a}));
	await page.waitForTimeout(2300);

	// Поимка при громкости 10 (как в шаблоне): не тишина, а половина.
	const s = await m(page);

	say('поймана при громкости 10 — звучит (5 из 99), не тишина', s.state.caught['Эфир/Перехват'] === 1 && s.playing && near(s.volume, 5 / 99, 0.005), String(s.volume));
	say('лампочка погасла, поиск выключен', !(await page.locator('.sg-radio .sg-r-lamp.sg-r-lamp-on').count()) && s.state.scan === false);
	await page.waitForTimeout(300);

	const cur = await page.locator('.sg-radio .sg-r-cur').boundingBox();
	const list = await page.locator('.sg-radio .sg-r-list').boundingBox();

	say('каталог в папке «Архив», пойманный трек (31-й) виден без прокрутки руками',
		(await page.locator('.sg-radio .sg-r-path').textContent()).includes('/Архив/') && cur && cur.y >= list.y - 1 && cur.y + cur.height <= list.y + list.height + 1,
		JSON.stringify({cur, list}));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'reverse-caught.png')});
	}
}

async function reverseChecks(page, say) {
	await go(page, 'RReverse', 600);

	const box = await page.locator('.sg-radio').boundingBox();

	say('радио с реверсом: квадрат, каркас В2', (await page.locator('.sg-radio.sg-radio-reverse.sg-radio-fixed').count()) === 1 && Math.abs(box.width - box.height) < 1);
	say('катушки, прогресс, РЕВЕРС, шкала эфира', (await page.locator('.sg-radio .sg-r-reel').count()) === 2 && (await page.locator('.sg-radio .sg-r-prog').count()) === 1 &&
		(await page.locator('.sg-radio .sg-r-revbtn').count()) === 1 && (await page.locator('.sg-radio .sg-r-scale').count()) === 1);
	say('надпись ОРБИТА-РЕВЕРС, цифр времени на прогрессе нет', (await page.locator('.sg-radio .sg-r-label').textContent()) === 'ОРБИТА-РЕВЕРС' && !/\d/.test(await page.locator('.sg-radio .sg-r-prog').textContent()));

	// Части не залезают друг на друга и не выходят за квадрат.
	const parts = await page.locator('.sg-radio > :not(svg)').evaluateAll(els => els.map(e => {
		const r = e.getBoundingClientRect();

		return {cls: e.className, x: r.left, y: r.top, w: r.width, h: r.height};
	}));
	const overlap = parts.some((p, i) => parts.some((q, j) => j > i && p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1));

	say('части каркаса В2 не налезают друг на друга и в квадрате', !overlap && parts.every(p => p.x >= box.x - 1 && p.y >= box.y - 1 && p.x + p.w <= box.x + box.width + 1 && p.y + p.h <= box.y + box.height + 1),
		JSON.stringify(parts.map(p => p.cls)));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'reverse-radio.png')});
	}

	if (await line(page, '..').count()) {
		await line(page, '..').click();
		await page.waitForTimeout(150);
	}
	await line(page, 'Записи').click();
	await page.waitForTimeout(150);
	await line(page, 'Длинный').click();
	await page.waitForTimeout(2600);

	let r = await rev(page);

	say('трек играет после предзвука, длина 30 с известна', (await m(page)).playing && near(r.dur, 30, 0.2), JSON.stringify(r));

	// Прогресс: щелчок на середине — 15 с.
	const prog = await page.locator('.sg-radio .sg-r-prog-line').boundingBox();

	await page.mouse.click(prog.x + prog.width * 0.5, prog.y + prog.height / 2);
	await page.waitForTimeout(300);
	r = await rev(page);
	say('щелчок по прогрессу — на середину (15 с)', near(r.pos, 15, 0.5), String(r.pos));

	const fill = await page.locator('.sg-radio .sg-r-prog-fill').evaluate(e => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width);

	say('полоса заполнена наполовину', near(fill, 0.5, 0.05), String(fill));

	// Катушки крутятся, пока играет.
	const a1 = (await rev(page)).reels[0];

	await page.waitForTimeout(500);

	const a2 = (await rev(page)).reels[0];

	say('катушки крутятся вперёд', a2 !== a1 && ((a2 - a1 + 360) % 360) < 180, `${a1} → ${a2}`);

	// Зажали РЕВЕРС.
	const rb = await page.locator('.sg-radio .sg-r-revbtn').boundingBox();

	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);

	const p0 = (await rev(page)).pos;

	await page.mouse.down();
	await page.waitForTimeout(600);
	r = await rev(page);
	say('РЕВЕРС зажат: звучит развёрнутая копия', r.rev && r.revPlaying && r.src.endsWith('media/audio/reverse/rtest/long.wav') && !(await m(page)).playing, JSON.stringify(r));
	say('в развёрнутом файле — с места 30 − (где был трек)', near(r.revTime, 30 - p0 + 0.6, 0.5), `${p0} → ${r.revTime}`);
	say('строка: «◀◀ РЕВЕРС»', (await mq(page)).includes('РЕВЕРС: Длинный'), await mq(page));
	say('кнопка светится, катушки крутятся назад', await page.locator('.sg-radio .sg-r-revbtn').evaluate(e => e.classList.contains('sg-r-lit')) &&
		await (async () => {
			const b1 = (await rev(page)).reels[0];

			await page.waitForTimeout(400);

			const b2 = (await rev(page)).reels[0];

			return ((b1 - b2 + 360) % 360) > 0 && ((b1 - b2 + 360) % 360) < 180;
		})());
	await page.waitForTimeout(1000);
	r = await rev(page);
	say('место едет назад: за 2 с — на 2 с раньше', near(r.pos, p0 - 2, 0.6), `${p0} → ${r.pos}`);

	const p1 = r.pos;

	await page.mouse.up();
	await page.waitForTimeout(400);
	r = await rev(page);

	let s = await m(page);

	say('отпустили — трек вперёд с нового места, без предзвука', !r.rev && s.playing && near(r.pos, p1 + 0.4, 0.5) && !s.pre, JSON.stringify({p1, r, pre: s.pre}));

	// Пауза: прогресс работает и на паузе.
	await page.locator('.sg-radio .sg-r-pause').click();
	await page.waitForTimeout(200);
	await page.mouse.click(prog.x + prog.width * 0.25, prog.y + prog.height / 2);
	await page.waitForTimeout(300);
	s = await m(page);
	say('на паузе щелчок по прогрессу запоминает место (7,5 с)', !s.playing && near(s.state.pos['Записи/Длинный'], 7.5, 0.5), String(s.state.pos['Записи/Длинный']));

	const c1 = (await rev(page)).reels[0];

	await page.waitForTimeout(400);
	say('на паузе катушки стоят', (await rev(page)).reels[0] === c1);
	await page.locator('.sg-radio .sg-r-play').click();
	await page.waitForTimeout(1800);
	r = await rev(page);
	say('▶ — предзвук, затем трек с этого места', near(r.pos, 8.3, 0.6) && (await m(page)).playing, String(r.pos));

	// До начала — тишина, пока держат; отпустили — с начала.
	await page.mouse.click(prog.x + prog.width * 0.03, prog.y + prog.height / 2);
	await page.waitForTimeout(300);
	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(2500);
	r = await rev(page);
	say('дошли до начала — тишина, пока держат', r.rev && !r.revPlaying && near(r.pos, 0, 0.05), JSON.stringify(r));
	await page.mouse.up();
	await page.waitForTimeout(400);
	r = await rev(page);
	say('отпустили — с начала', !r.rev && (await m(page)).playing && r.pos < 0.8, String(r.pos));

	// Свой файл с посланием (ответ 2А): другой длины — по доле.
	await line(page, 'Послание').click();
	await page.waitForTimeout(700);
	await page.mouse.click(prog.x + prog.width * 0.5, prog.y + prog.height / 2);
	await page.waitForTimeout(300);
	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(500);
	r = await rev(page);
	say('свой файл задом наперёд: звучит он, с места по доле длины (10 → 5 из 10 с)', r.src.endsWith('rtest/msg-back.wav') && near(r.revTime, 5.4, 0.5), JSON.stringify(r));
	await page.waitForTimeout(1000);
	await page.mouse.up();
	await page.waitForTimeout(400);
	r = await rev(page);
	say('и назад едет в два раза быстрее (20 с прямого на 10 с послания)', near(r.pos, 7, 1), String(r.pos));

	// Нет копии — реверс молчит, трек играет дальше с того же места.
	await line(page, 'Без копии').click();
	await page.waitForTimeout(700);
	await page.mouse.click(prog.x + prog.width * 0.5, prog.y + prog.height / 2);
	await page.waitForTimeout(300);
	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(800);
	r = await rev(page);
	say('нет развёрнутого файла: тишина, пока держат', r.rev && !r.ok && !r.revPlaying);
	await page.mouse.up();
	await page.waitForTimeout(400);
	r = await rev(page);
	say('отпустили — трек дальше с того же места', !r.rev && (await m(page)).playing && near(r.pos, 10.4, 0.8), String(r.pos));

	// Атмосфера: РЕВЕРС ничего не делает.
	await page.evaluate(() => SugarCube.Wikifier.wikifyEval('<<sg-mus play track "Фон/Гул">>'));
	await page.waitForTimeout(500);
	await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(400);
	r = await rev(page);
	say('трек Атмосферы не разворачивается — играет дальше', !r.rev && (await m(page)).playing);
	await page.mouse.up();

	// Сбой: развёрнутое не помнится, место — помнится.
	await line(page, 'Длинный').click().catch(() => {});
	await page.waitForTimeout(300);
	await page.reload();
	await page.waitForSelector('#sg-start');
	await start(page);
	await page.waitForTimeout(400);
	say('после сбоя радио с реверсом на месте, ошибок нет', (await page.locator('.sg-radio.sg-radio-reverse').count()) === 1 && !(await rev(page)).rev);
}

for (const [url, prefix] of [[base + 'reverse-test.html', ''], ...extra.map(f => [base + path.relative(gameDir, path.resolve(f)), `[${path.basename(f)}] `])]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const page = await start(await open(url));

	await colorChecks(page, say);
	await lampChecks(page, say);
	await reverseChecks(page, say);
	await page.context().close();
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
