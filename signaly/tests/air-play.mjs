// Проверка шага 7.3 в Chromium: отремонтированное радио (каркас Р2) — шкала частот, игла,
// −/+ раз в секунду, ПОИСК, белый шум и помехи, слышимость по ширине, поимка передачи;
// вложенные папки каталога, громкость файла, сообщение «ВХОДЯЩАЯ ПЕРЕДАЧА».
// node air-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

// Звуки нужной длины: тихий тон, 8 кГц, моно.
function wav(file, seconds, freq) {
	const rate = 8000;
	const n = Math.round(rate * seconds);
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
		buf.writeInt16LE(Math.round(2000 * Math.sin((2 * Math.PI * freq * i) / rate)), 44 + i * 2);
	}
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, buf);
}


// Белый шум: случайные отсчёты.
function noiseWav(file, seconds) {
	wav(file, seconds, 0);

	const buf = fs.readFileSync(file);

	for (let i = 44; i + 1 < buf.length; i += 2) {
		buf.writeInt16LE(Math.round((Math.random() - 0.5) * 3000), i);
	}
	fs.writeFileSync(file, buf);
}

const audioDir = path.join(gameDir, 'media/audio/atest');

wav(path.join(audioDir, 'a1.wav'), 40, 330);
wav(path.join(audioDir, 'a2.wav'), 40, 440);
wav(path.join(audioDir, 'tx.wav'), 40, 520);
wav(path.join(audioDir, 'mo.wav'), 5, 600);
noiseWav(path.join(audioDir, 'noise.wav'), 5);
for (let i = 1; i <= 4; i++) {
	wav(path.join(audioDir, `j${i}.wav`), 5, 700 + i * 50);
}

const A = 'media/audio/atest/';
const template = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const jams = [1, 2, 3, 4].map(i => `${A}j${i}.wav|1|80`).join('; ');
const test =
	template
		.replace(/^:: Музыка \[sg-music\][^]*?(?=^:: )/m, '')
		.replace(
			/(<<sg-radio-view "Сломанное"[^\n]*>>)/,
			`$1\n<<sg-radio-view "Ремонт" type fixed frame "#ff0000" elements "#00ffff" label "ОРБИТА-3М" noise "${A}noise.wav" noisevolume 60 ` +
				`noiseranges "88-100" jam "${jams}" jamsmin 2 jamsmax 3 incoming "ВХОДЯЩАЯ ПЕРЕДАЧА" catch 2>>`
		)
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $open to 0>>\n')
		.replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,9500","size":"100,100"}
<<sg-music volume 50 spin 0.3 auto>>
<<sg-folder "Дневники" section radio>>
<<sg-track "Запись 1" "${A}a1.wav" gain 40>><</sg-track>>
<<sg-folder "Дневники/Капитан" section radio>>
<<sg-track "Лог 1" "${A}a2.wav">><</sg-track>>
<<sg-folder "Глава 1" section radio>>
<<sg-track "Песня" "${A}a2.wav">><</sg-track>>
<<sg-folder "Альбом" section ambient>>
<<sg-track "Фон" "${A}a2.wav">><</sg-track>>
<<sg-folder "Эфир" section air>>
<<sg-track "Перехват" "${A}tx.wav" to "Дневники/Капитан" width 1 text "СИГНАЛ SOS">>$open is 1<</sg-track>>
<<sg-track "Морзе" "${A}mo.wav">><</sg-track>>

:: AHome {"position":"200,9500","size":"100,100"}
Дом

:: ARadio {"position":"300,9500","size":"100,100"}
<<sg-radio "Ремонт">>
`;

fs.writeFileSync(path.join(gameDir, 'air-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'air-test.twee'), path.join(gameDir, 'air-test.html'), 'start=AHome']);

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

		// Перемотка звука (место паузы) требует ответа на Range.
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
const lines = page => page.locator('.sg-radio .sg-r-line .sg-r-name').allTextContents();
const line = (page, name) => page.locator('.sg-radio .sg-r-line', {has: page.locator('.sg-r-name', {hasText: new RegExp(`^${name}$`)})}).first();
const mq = page => page.locator('.sg-radio .sg-r-mq-text').textContent();
const freqShown = page => page.locator('.sg-radio .sg-r-freq').textContent();
const tune = async (page, f, wait = 350) => {
	await page.evaluate(x => {
		SugarCube.State.variables.sgMusic.freq = x;
	}, f);
	await page.waitForTimeout(wait);
};
const vols = async page => {
	const a = (await air(page)).items[0];
	const out = {noise: a.noise};

	for (const s of a.srcs) {
		out[s.name.split('/').pop()] = s.vol;
	}
	return out;
};
const near = (a, b, d = 0.02) => Math.abs(a - b) < d;

async function airChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'ARadio', 600);

	const box = await page.locator('.sg-radio').boundingBox();

	say('отремонтированное радио: квадрат, каркас Р2', (await page.locator('.sg-radio.sg-radio-fixed').count()) === 1 && Math.abs(box.width - box.height) < 1);
	say('шкала, игла, ПОИСК, окно частоты 98.0', (await page.locator('.sg-radio .sg-r-scale .sg-r-needle').count()) === 1 && (await freqShown(page)) === '98.0', await freqShown(page));
	say('надпись ОРБИТА-3М, искр нет', (await page.locator('.sg-radio .sg-r-label').textContent()) === 'ОРБИТА-3М' && (await page.locator('.sg-radio .sg-r-spark').count()) === 0);
	say('частота цифрами DSEG7', /sg-timer-font/.test(await page.locator('.sg-radio .sg-r-freq').evaluate(el => el.style.fontFamily)));

	// Вложенные папки (ответ 1Б).
	say('каталог: верхние папки', JSON.stringify(await lines(page)) === JSON.stringify(['Дневники', 'Глава 1']), JSON.stringify(await lines(page)));
	await line(page, 'Дневники').click();
	await page.waitForTimeout(100);
	say('в папке: «..», вложенная папка, потом трек', JSON.stringify(await lines(page)) === JSON.stringify(['..', 'Капитан', 'Запись 1']), JSON.stringify(await lines(page)));
	await line(page, 'Капитан').click();
	await page.waitForTimeout(100);
	say('во вложенной папке: путь /Дневники/Капитан/', (await page.locator('.sg-radio .sg-r-path').textContent()).includes('/Дневники/Капитан/') && JSON.stringify(await lines(page)) === JSON.stringify(['..', 'Лог 1']));
	await line(page, '..').click();
	await page.waitForTimeout(100);
	say('«..» — в папку выше, не в корень', JSON.stringify(await lines(page)) === JSON.stringify(['..', 'Капитан', 'Запись 1']));

	// Громкость файла (ответ 2А).
	await line(page, 'Запись 1').click();
	await page.waitForTimeout(400);

	let s = await m(page);

	say('громкость файла 40 %: 50/99 × 0,4', s.playing && near(s.volume, (50 / 99) * 0.4, 0.01), String(s.volume));
	say('строка: что играет, сообщения нет — передача закрыта условием', !(await mq(page)).includes('ВХОДЯЩАЯ') && (await mq(page)).includes('Запись 1'));

	// Передача появилась по условию: своё сообщение (ответ 5А).
	await page.evaluate(() => {
		SugarCube.State.variables.open = 1;
	});
	await page.waitForTimeout(400);
	say('передача появилась: строка — своё сообщение и что играет', (await mq(page)).includes('СИГНАЛ SOS') && (await mq(page)).includes('Запись 1'), await mq(page));

	// ПОИСК (ответ 7А).
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.waitForTimeout(400);
	s = await m(page);
	say('ПОИСК: музыка каталога на паузе', !s.playing && s.state.scan === true);
	say('ПОИСК: шкала подсвечена, кнопка горит', await page.evaluate(() => document.querySelector('.sg-r-scale').classList.contains('sg-r-scan') && document.querySelector('.sg-r-scanbtn').classList.contains('sg-r-lit')));

	let a = (await air(page)).items[0];
	const jamCount = a.srcs.filter(x => x.kind === 'jam').length;

	say('помех выпало от 2 до 3', jamCount >= 2 && jamCount <= 3, String(jamCount));
	say('в эфире обе передачи, помеха «Морзе» тоже', a.srcs.some(x => x.name === 'Эфир/Перехват') && a.srcs.some(x => x.name === 'Эфир/Морзе'));
	say('точки не ближе 0,6 МГц', a.srcs.every((x, i) => a.srcs.every((y, j) => i === j || Math.abs(x.c - y.c) >= 6)), JSON.stringify(a.srcs.map(x => x.c)));

	// Расставить точки для проверки громкостей.
	const jamNames = a.srcs.filter(x => x.kind === 'jam').map(x => x.name);

	await page.evaluate(([j1, j2, j3]) => {
		const place = SugarCube.setup.signaly.airPlace;

		place(j1, 900);
		place(j2, 905);
		if (j3) {
			place(j3, 1070);
		}
		place('Эфир/Морзе', 1030);
		place('Эфир/Перехват', 1050);
	}, jamNames);
	await tune(page, 980);

	const master = 50 / 99;
	let v = await vols(page);

	say('98.0: только белый шум (диапазон 88–100)', near(v.noise, master * 0.6) && Object.entries(v).every(([k, x]) => k === 'noise' || x === 0), JSON.stringify(v));
	await tune(page, 1020);
	v = await vols(page);
	say('102.0: шума нет (вне диапазона), «Морзе» в 1 МГц из 1,5 — треть', v.noise === 0 && near(v['Морзе'], master * (1 / 3), 0.01), JSON.stringify(v));
	await tune(page, 902);
	v = await vols(page);

	const [j1, j2] = jamNames.map(n => n.split('/').pop());

	say('90.2: две помехи слышны вместе, ближняя громче, шум тише', v[j1] > v[j2] && v[j2] > 0 && v.noise > 0 && v.noise < master * 0.6 * 0.5, JSON.stringify(v));
	await tune(page, 901);
	v = await vols(page);
	say('90.1 (в ±0,1 от точки): только ближняя помеха', near(v[j1], master * 0.8) && v[j2] === 0 && v.noise === 0, JSON.stringify(v));

	// Ширина передачи (ответ 6): 1 МГц у «Перехвата».
	await tune(page, 1062);
	v = await vols(page);
	say('«Перехват» шириной 1 МГц не слышно за 1,2 МГц', v['Перехват'] === 0, JSON.stringify(v));

	// −/+ раз в секунду (ответ 6А).
	await tune(page, 980, 100);
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '+'}).click();
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '+'}).click();
	await page.waitForTimeout(150);
	say('+ дважды подряд — только на 0,1', (await air(page)).freq === 981 && (await freqShown(page)) === '98.1', await freqShown(page));
	say('кнопки ждут секунду', await page.evaluate(() => document.querySelector('.sg-r-fbtn').classList.contains('sg-r-wait')));
	await page.waitForTimeout(1000);
	await page.locator('.sg-radio .sg-r-fbtn', {hasText: '−'}).click();
	await page.waitForTimeout(150);
	say('через секунду — снова работает', (await air(page)).freq === 980);

	// Игла тянется мышью.
	const sc = await page.locator('.sg-radio .sg-r-scale').boundingBox();

	await page.mouse.move(sc.x + sc.width * 0.5, sc.y + sc.height / 2);
	await page.mouse.down();
	await page.mouse.move(sc.x + sc.width * 0.95, sc.y + sc.height / 2, {steps: 5});
	await page.mouse.move(sc.x + sc.width + 300, sc.y + sc.height / 2, {steps: 3});
	await page.mouse.up();
	await page.waitForTimeout(150);
	say('игла: тянется мышью, за краем — 108.0', (await air(page)).freq === 1080 && (await freqShown(page)) === '108.0', await freqShown(page));
	await page.mouse.click(sc.x + (sc.width * 18) / 588 + 1, sc.y + sc.height / 2);
	await page.waitForTimeout(150);
	say('щелчок по шкале — игла туда (88.0)', (await air(page)).freq === 880, String((await air(page)).freq));

	// Помеха на точной настройке не ловится.
	await tune(page, 1030, 2600);
	s = await m(page);
	say('«Морзе» (помеха) не попадает в каталог', !s.state.caught['Эфир/Морзе'] && (await air(page)).items[0].hold === null);

	// Поимка (ответ 4А): 2 с на точной настройке.
	await tune(page, 1050, 1000);
	a = (await air(page)).items[0];
	say('точная настройка: идёт удержание', a.hold && a.hold.name === 'Эфир/Перехват' && a.srcs.find(x => x.name === 'Эфир/Перехват').vol > 0.4, JSON.stringify(a.hold));
	await tune(page, 1051, 300);
	say('сбили настройку — удержание сброшено', (await air(page)).items[0].hold === null);
	await tune(page, 1050, 2600);
	s = await m(page);
	say('поймана: в каталоге, играет дальше, поиск выключен', s.state.caught['Эфир/Перехват'] === 1 && s.state.cur === 'Эфир/Перехват' && s.playing && s.state.scan === false, JSON.stringify(s.state));
	say('сначала на 10 тише: 40/99', near(s.volume, 40 / 99, 0.01), String(s.volume));
	a = (await air(page)).items[0];
	say('эфир замолчал', a.noise === 0 && a.srcs.every(x => x.vol === 0), JSON.stringify(a));
	await page.waitForTimeout(300);
	say('каталог открыт в её папке, трек отмечен ▶', (await page.locator('.sg-radio .sg-r-path').textContent()).includes('/Дневники/Капитан/') &&
		(await page.locator('.sg-radio .sg-r-cur .sg-r-name').textContent()) === 'Перехват');
	say('строка: сообщения больше нет, играет «Перехват»', !(await mq(page)).includes('SOS') && (await mq(page)).includes('Перехват'), await mq(page));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'air-caught.png')});
	}
	await page.waitForTimeout(10000);
	s = await m(page);
	say('через 10 с — плавно громче', s.volume > 41 / 99, String(s.volume));
	await page.waitForTimeout(3200);
	s = await m(page);
	say('и до общей громкости 50', near(s.volume, master, 0.01), String(s.volume));

	// Поиск переживает уход с экрана; включённый трек выключает поиск.
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await page.waitForTimeout(400);
	say('пойманная передача из эфира ушла', !(await air(page)).items[0].srcs.some(x => x.name === 'Эфир/Перехват'));
	if (shots) {
		await tune(page, 1003, 300);
		await page.screenshot({path: path.join(shots, 'air-scan.png')});
	}
	await go(page, 'AHome', 400);
	say('ушли с экрана — эфир молчит, поиск помнится', (await air(page)).items.length === 0 && (await m(page)).state.scan === true);
	await go(page, 'ARadio', 700);
	await tune(page, 980);
	say('вернулись — эфир снова звучит', (await vols(page)).noise > 0.2);
	await line(page, '..').click();
	await page.waitForTimeout(100);
	await line(page, 'Запись 1').click();
	await page.waitForTimeout(400);
	s = await m(page);
	say('трек из каталога выключает поиск', s.playing && s.state.scan === false && (await vols(page)).noise === 0);

	// Сбой: поиск выключен, частота и пойманное — помнятся.
	await page.locator('.sg-radio .sg-r-scanbtn').click();
	await tune(page, 1003, 600);
	await page.reload();
	await page.waitForSelector('#sg-start');
	await start(page);
	await page.waitForTimeout(400);
	s = await m(page);
	say('после сбоя: поиск выключен, частота 100.3, пойманное в каталоге', s.state.scan === false && s.state.freq === 1003 && s.state.caught['Эфир/Перехват'] === 1 &&
		(await freqShown(page)) === '100.3', JSON.stringify({scan: s.state.scan, freq: s.state.freq}));
	await page.context().close();
}

for (const [url, prefix] of [[base + 'air-test.html', ''], ...extra.map(f => [base + path.relative(gameDir, path.resolve(f)), `[${path.basename(f)}] `])]) {
	await airChecks(url, (name, ok, more) => check(prefix + name, ok, more));
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
