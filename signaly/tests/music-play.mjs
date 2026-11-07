// Проверка шага 7.1 в Chromium: каталог «Музыка», общий плеер (<<sg-mus>>), блок
// «Громкость» (<<sg-volume>>), «Музыка экрана» (<<sg-screen-music>>); порция 2 —
// перебор картинками; цифры цикла шрифтом DSEG7.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node music-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
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

const audioDir = path.join(gameDir, 'media/audio/mtest');

wav(path.join(audioDir, 'mt1.wav'), 2.5, 330);
wav(path.join(audioDir, 'mt2.wav'), 2.5, 440);
wav(path.join(audioDir, 'mt3.wav'), 40, 550);
wav(path.join(audioDir, 'mt4.wav'), 40, 660);
wav(path.join(audioDir, 'needle.wav'), 6, 880);

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story.replace(/(:: StoryInit[^\n]*\n)/, `$1<<set $prog to 0>>\n`).replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,9300","size":"100,100"}
<<sg-music volume 30 spin 0.5 auto>>
<<sg-folder "Альбом" section ambient>>
<<sg-track "Первый" "media/audio/mtest/mt1.wav">><</sg-track>>
<<sg-track "Второй" "media/audio/mtest/mt2.wav">>$open is 1<</sg-track>>
<<sg-track "Третий" "media/audio/mtest/mt3.wav" start 50>><</sg-track>>
<<sg-folder "Эфир" section radio>>
<<sg-track "Голос" "media/audio/mtest/mt4.wav" pre "media/audio/mtest/needle.wav" wait 1 tail 1>><</sg-track>>

:: MHome {"position":"200,9300","size":"100,100"}
Пульт
<<sg-volume step 5 size 30>>
<<link "АТМ">><<sg-mus toggle ambient>><</link>> <<link "РАД">><<sg-mus toggle radio>><</link>>
<<link "Пауза">><<sg-mus pause>><</link>> <<link "Дальше">><<sg-mus resume>><</link>> <<link "Стоп">><<sg-mus stop>><</link>>
<<link "Следующий">><<sg-mus next>><</link>> <<link "A">><<sg-mus volume 10>><</link>> <<link "Альбом">><<sg-mus play folder "Альбом">><</link>>
<<link "АВТО">><<sg-mus auto toggle>><</link>>

:: MScreen {"position":"300,9300","size":"100,100"}
<<sg-screen-music delay 1 now fade fade 1 play folder "Эфир" after 0.5 rise 0.5>>\\
Экран со сменой музыки

:: MAmb {"position":"400,9300","size":"100,100"}
<<sg-screen-music play ambient>>\\
Главный

:: MPick {"position":"500,9300","size":"100,100"}
<<sg-pick var "$lamp" form image width 120>>
<<sg-opt "Выкл" 0 img "media/img/testimgOFF.jpg">>
<<sg-opt "Вкл" 1 img "media/img/testimgON.jpg">>
<</sg-pick>>

:: Строка [sg-ticker] {"position":"600,9300","size":"100,100"}
<<sg-ticker screen "MCycle">>
<<sg-cycle var "$prog" spin 1 gap 0.2 from "20,20,20,20,20" to "2,2,2,2,2">>
<<sg-cycle-at 0 "00012">>

:: MCycle {"position":"700,9300","size":"100,100"}
Цикл
`;

fs.writeFileSync(path.join(gameDir, 'music-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'music-test.twee'), path.join(gameDir, 'music-test.html'), 'start=MHome']);

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
const link = async (page, name, wait = 250) => {
	await page.locator('.passage a', {hasText: new RegExp(`^${name}$`)}).first().click();
	await page.waitForTimeout(wait);
};
const shown = page => page.locator('.sg-vol-box').textContent();
const file = s => (s.src || '').split('/').pop();

async function playerChecks(url, say) {
	const page = await start(await open(url));
	let s = await m(page);

	say('в каталоге 2 папки, 4 трека', s.table.folders.length === 2 && s.table.ids.length === 4);
	say('ничего не играет — окошко 00', (await shown(page)) === '00', await shown(page));
	say('окошко — шрифт DSEG7', /sg-timer-font/.test(await page.locator('.sg-vol-box').evaluate(el => el.style.fontFamily)));
	await link(page, 'АТМ', 0);
	const seen = await page.evaluate(() => new Promise(res => {
		const out = new Set();
		const t = setInterval(() => out.add(document.querySelector('.sg-vol-box').textContent), 20);

		setTimeout(() => (clearInterval(t), res([...out])), 300);
	}));
	s = await m(page);
	say('АТМ: первый видимый трек Атмосферы', s.playing && file(s) === 'mt1.wav', JSON.stringify(s));
	say('цифры крутятся после включения', seen.length >= 3, seen.join(' '));
	await page.waitForTimeout(700);
	say('окошко показывает громкость 30', (await shown(page)) === '30', await shown(page));
	say('громкость звука 30/99', Math.abs(s.volume - 30 / 99) < 0.01, String(s.volume));
	await page.waitForTimeout(2800);
	s = await m(page);
	say('«АВТО»: кончился трек — следующий видимый той же папки (второй скрыт условием)', s.playing && file(s) === 'mt3.wav', file(s));
	say('начальная громкость трека при первом включении — 50', s.state.vol === 50 && Math.abs(s.volume - 50 / 99) < 0.01, JSON.stringify(s.state));
	await page.waitForTimeout(1200);
	await link(page, 'Пауза');
	s = await m(page);
	const place = s.state.pos['Альбом/Третий'];

	say('пауза: не играет, место запомнено', !s.playing && !s.state.playing && place > 0.8, String(place));
	await page.waitForTimeout(800);
	say('на паузе окошко 00', (await shown(page)) === '00', await shown(page));
	await link(page, 'Дальше', 600);
	s = await m(page);
	say('продолжить: тот же трек', s.playing && file(s) === 'mt3.wav');
	await page.waitForTimeout(300);
	await link(page, 'Пауза');
	s = await m(page);
	say('продолжил с того же места', s.state.pos['Альбом/Третий'] >= place + 0.3, `${place} → ${s.state.pos['Альбом/Третий']}`);
	await link(page, 'АТМ');
	await link(page, 'РАД', 300);
	s = await m(page);
	say('РАД: предзвук звучит первым, трек ещё нет', file({src: s.pre}) === 'needle.wav' && !s.playing && s.state.cur === 'Эфир/Голос', JSON.stringify(s));
	say('Атмосфера встала на паузу, место запомнено', s.state.pos['Альбом/Третий'] > place);
	await page.waitForTimeout(1100);
	s = await m(page);
	say('через 1 с трек вступил, предзвук ещё звучит', s.playing && file(s) === 'mt4.wav' && s.pre !== '', JSON.stringify(s));
	await page.waitForTimeout(1200);
	s = await m(page);
	say('ещё через 1 с предзвук замолк', s.pre === '');
	await link(page, 'АТМ', 300);
	s = await m(page);
	say('АТМ: радио на паузе, Атмосфера — последний трек', s.playing && file(s) === 'mt3.wav' && s.state.pos['Эфир/Голос'] > 0.5);
	await link(page, 'A', 600);
	s = await m(page);
	say('кнопка A: громкость 10', s.state.vol === 10 && Math.abs(s.volume - 10 / 99) < 0.01 && (await shown(page)) === '10', await shown(page));
	await page.locator('.sg-volume button').last().click();
	await page.waitForTimeout(700);
	say('«+» блока: 15', (await m(page)).state.vol === 15 && (await shown(page)) === '15', await shown(page));
	for (let i = 0; i < 4; i++) {
		await page.locator('.sg-volume button').first().click();
	}
	await page.waitForTimeout(700);
	say('«−» не ниже 00', (await m(page)).state.vol === 0);
	await page.evaluate(() => SugarCube.State.variables.sgMusic.vol = 30);
	await link(page, 'Стоп');
	s = await m(page);
	say('стоп: в начало', !s.state.playing && s.state.pos['Альбом/Третий'] === 0);
	await page.evaluate(() => (SugarCube.State.variables.open = 1));
	await link(page, 'Альбом', 300);
	s = await m(page);
	say('папка: первый трек', file(s) === 'mt1.wav');
	await link(page, 'Следующий', 300);
	s = await m(page);
	say('условие стало верным — трек появился в каталоге', file(s) === 'mt2.wav', file(s));
	await link(page, 'АВТО');
	say('АВТО выключено', (await m(page)).state.auto === false);
	await page.waitForTimeout(2800);
	s = await m(page);
	say('без АВТО трек кончился — тишина, окошко 00', !s.state.playing && !s.playing);

	// Музыка экрана.
	await link(page, 'Альбом', 300);
	await go(page, 'MScreen', 500);
	s = await m(page);
	say('музыка экрана: до срока ничего не меняется', s.playing && file(s) === 'mt1.wav');
	await go(page, 'MHome', 1300);
	s = await m(page);
	say('ушли раньше срока — отсчёт отменён', s.playing && file(s) === 'mt1.wav');
	await go(page, 'MScreen', 1300);
	s = await m(page);
	say('через 1 с — затухание, текущая на паузе', !s.state.playing || s.state.cur === 'Эфир/Голос');
	await page.waitForTimeout(1500);
	s = await m(page);
	say('новая — папка «Эфир» (с предзвуком)', s.state.cur === 'Эфир/Голос' && s.playing, JSON.stringify(s.state));
	await go(page, 'MHome', 300);
	s = await m(page);
	say('ушли с экрана — новая играет дальше', s.playing && file(s) === 'mt4.wav');
	await go(page, 'MAmb', 400);
	s = await m(page);
	say('«Атмосферу, если ничего не играет»: радио играет — не трогать', file(s) === 'mt4.wav');
	await link(page, 'Пауза').catch(() => {});
	await go(page, 'MHome', 200);
	await link(page, 'Пауза');
	await go(page, 'MAmb', 400);
	s = await m(page);
	say('«Атмосферу, если ничего не играет»: тишина — Атмосфера с последнего трека', s.playing && s.state.cur.startsWith('Альбом/'), JSON.stringify(s.state));

	// Сбой: музыку включает мастер (решение 37).
	await go(page, 'MHome', 300);
	await page.reload();
	await page.waitForSelector('#sg-start');
	await start(page);
	s = await m(page);
	say('после сбоя: громкость и место те же, музыка молчит', !s.playing && !s.state.playing && s.state.vol === 30 && s.state.cur.startsWith('Альбом/'), JSON.stringify(s.state));
	say('после сбоя окошко 00', (await shown(page)) === '00');

	// Перебор картинками.
	await go(page, 'MPick');
	const img = page.locator('.sg-pick img');

	say('перебор картинками: первая картинка', /testimgOFF/.test(await img.getAttribute('src')));
	await img.click();
	await page.waitForTimeout(200);
	say('щелчок — вторая картинка и значение 1', /testimgON/.test(await img.getAttribute('src')) && (await page.evaluate(() => SugarCube.State.variables.lamp)) === 1);
	await page.evaluate(() => (SugarCube.State.variables.lamp = 0));
	await page.waitForTimeout(400);
	say('переменную поменяли со стороны — картинка следом', /testimgOFF/.test(await img.getAttribute('src')));

	// Цифры цикла.
	await go(page, 'MCycle', 800);
	const font = await page.locator('.sg-tk-num').evaluate(el => el.style.fontFamily);

	say('цифры цикла — шрифт DSEG7', /sg-timer-font/.test(font), font);
	say('шрифт загружен', await page.evaluate(f => document.fonts.check('20px ' + f), font.split(',')[0]));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'music-cycle.png'), clip: {x: 400, y: 0, width: 1500, height: 200}});
		await go(page, 'MHome', 300);
		await link(page, 'АТМ', 900);
		await page.screenshot({path: path.join(shots, 'music-volume.png'), clip: {x: 400, y: 0, width: 1100, height: 400}});
	}
	await page.context().close();
}

const templateDialog = async (url, say) => {
	const page = await start(await open(url));

	await go(page, 'Start');
	await page.locator('.passage button', {hasText: 'Краснаякнопка'}).click();
	await page.waitForTimeout(300);
	say('старый блок «Окно-сообщение» шаблона работает', (await page.locator('#ui-dialog-body').innerText().catch(() => '')).includes('Предустановленное инфо'));
	await page.context().close();
};

for (const [url, prefix] of [
	[base + 'music-test.html', ''],
	...extra.map(f => [base + path.relative(gameDir, path.resolve(f)), `[${path.basename(f)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await playerChecks(url, say);
	await templateDialog(url, say);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
