// Проверка шага 7.2 в Chromium: радио <<sg-radio>> (виды — пассаж sg-radio), «Каталог
// Атмосферы» <<sg-ambient>>, прогресс треков, «Случайно», сброс; музыка шаблона на общем плеере.
// node radio-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
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

wav(path.join(audioDir, 'mt1.wav'), 2, 330);
wav(path.join(audioDir, 'mt2.wav'), 2, 440);
wav(path.join(audioDir, 'mt3.wav'), 40, 550);
wav(path.join(audioDir, 'mt4.wav'), 40, 660);
wav(path.join(audioDir, 'needle.wav'), 6, 880);
wav(path.join(audioDir, 'spark.wav'), 0.3, 990);

// Шаг 7.2: в шаблоне свой пассаж «Музыка» — у проверки свой каталог.

// Шаблон уже переведён на общий плеер: свой каталог и свой вид радио — вместо шаблонных.
const template = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const many = Array.from({length: 30}, (_, i) => `<<sg-track "Запись ${String(i + 1).padStart(2, '0')}" "media/audio/mtest/mt4.wav">><</sg-track>>`).join('\n');
const test =
	template
		.replace(/^:: Музыка \[sg-music\][^]*?(?=^:: )/m, '')
		.replace(/(<<sg-radio-view "Сломанное"[^\n]*>>)/, '$1\n<<sg-radio-view "Тест" type broken frame "#ff0000" elements "#00ffff" label "ПРОБА" sparks 100 sparksound "media/audio/mtest/spark.wav" sparkvolume 50>>')
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $open to 0>>\n')
		.replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,9300","size":"100,100"}
<<sg-music volume 30 spin 0.3 auto>>
<<sg-folder "Альбом" section ambient tip "Подсказка альбома">>
<<sg-track "Первый" "media/audio/mtest/mt1.wav">><</sg-track>>
<<sg-track "Второй" "media/audio/mtest/mt2.wav">><</sg-track>>
<<sg-track "Скрытый" "media/audio/mtest/mt3.wav">>$open is 1<</sg-track>>
<<sg-folder "Пусто" section ambient>>
<<sg-track "Нет" "media/audio/mtest/mt3.wav">>$open is 1<</sg-track>>
<<sg-folder "Эфир" section radio>>
<<sg-track "Голос" "media/audio/mtest/mt4.wav" pre "media/audio/mtest/needle.wav" wait 1 tail 1>><</sg-track>>
<<sg-track "Длинный" "media/audio/mtest/mt3.wav">><</sg-track>>
<<sg-track "Тайный" "media/audio/mtest/mt3.wav">>$open is 1<</sg-track>>
<<sg-folder "Плёнки" section radio>>
${many}
<<sg-folder "Закрыто" section radio>>
<<sg-track "Х" "media/audio/mtest/mt3.wav">>$open is 1<</sg-track>>

:: RHome {"position":"200,9300","size":"100,100"}
Дом
<<link "Открыть">><<set $open to 1>><</link>> <<link "Включить Атмосферу">><<sg-mus play section ambient>><</link>>

:: RRadio {"position":"300,9300","size":"100,100"}
<<sg-radio "Тест">>

:: RAmb {"position":"400,9300","size":"100,100"}
<<sg-ambient columns 2>>
`;

fs.writeFileSync(path.join(gameDir, 'radio-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'radio-test.twee'), path.join(gameDir, 'radio-test.html'), 'start=RHome']);
fs.writeFileSync(path.join(gameDir, 'radio-tpl.twee'), template);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'radio-tpl.twee'), path.join(gameDir, 'radio-tpl.html')]);

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


const lines = page => page.locator('.sg-radio .sg-r-line .sg-r-name').allTextContents();
const line = (page, name) => page.locator('.sg-radio .sg-r-line', {has: page.locator('.sg-r-name', {hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)})}).first();
const rbtn = (page, cls) => page.locator('.sg-radio .' + cls).first();
const mq = page => page.locator('.sg-radio .sg-r-mq-text').textContent();
const digits = page => page.locator('.sg-radio .sg-r-digits').textContent();

async function radioChecks(url, say) {
	const page = await start(await open(url));
	const requests = [];

	page.on('request', r => requests.push(r.url()));
	await go(page, 'RHome');
	await go(page, 'RRadio', 600);

	const box = await page.locator('.sg-radio').boundingBox();
	const field = await page.evaluate(() => {
		const el = document.getElementById('passages');
		const cs = getComputedStyle(el);

		return Math.min(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
	});

	say('радио квадратное, под поле игры', Math.abs(box.width - box.height) < 1 && Math.abs(box.width - field) < 8, `${box.width}×${box.height}, поле ${field}`);
	say('цвета вида: каркас и элементы', await page.evaluate(() => {
		const r = document.querySelector('.sg-radio');

		return getComputedStyle(r.querySelector('.sg-r-fr')).stroke === 'rgb(255, 0, 0)' && getComputedStyle(r.querySelector('.sg-r-mq')).borderTopColor === 'rgb(0, 255, 255)';
	}));
	say('надпись на каркасе', (await page.locator('.sg-radio .sg-r-label').textContent()) === 'ПРОБА');
	say('каталог: папки раздела «Радио», пустая по условию скрыта', JSON.stringify(await lines(page)) === JSON.stringify(['Эфир', 'Плёнки']), JSON.stringify(await lines(page)));
	say('путь — корень', (await page.locator('.sg-radio .sg-r-path').textContent()).trim() === 'КАТАЛОГ  /');
	say('бегущая строка — тишина', (await mq(page)).includes('ТИШИНА'));
	await line(page, 'Эфир').click();
	await page.waitForTimeout(100);
	say('переход в папку: «◄ ..» первой строкой, скрытый трек не виден', JSON.stringify(await lines(page)) === JSON.stringify(['..', 'Голос', 'Длинный']), JSON.stringify(await lines(page)));
	say('путь — /Эфир/', (await page.locator('.sg-radio .sg-r-path').textContent()).includes('/Эфир/'));
	await line(page, '..').click();
	await page.waitForTimeout(100);
	say('«◄ ..» — на уровень выше', JSON.stringify(await lines(page)) === JSON.stringify(['Эфир', 'Плёнки']));

	// Много треков: прокрутка внутри своей рамки, радио не растёт.
	await line(page, 'Плёнки').click();
	await page.waitForTimeout(150);

	const scroll = await page.locator('.sg-radio .sg-r-list').evaluate(el => ({sh: el.scrollHeight, ch: el.clientHeight}));
	const after = await page.locator('.sg-radio').boundingBox();
	const cat = await page.locator('.sg-radio .sg-r-cat').boundingBox();

	say('31 строка в папке, список прокручивается внутри', (await lines(page)).length === 31 && scroll.sh > scroll.ch, JSON.stringify(scroll));
	say('каталог не раскрывается поверх радио', after.height === box.height && cat.y + cat.height <= box.y + box.height + 1, JSON.stringify(cat));
	await page.locator('.sg-radio .sg-r-list').hover();
	await page.mouse.wheel(0, 600);
	await page.waitForTimeout(300);
	say('колесо прокручивает список', (await page.locator('.sg-radio .sg-r-list').evaluate(el => el.scrollTop)) > 0);
	await line(page, '..').click();
	await line(page, 'Эфир').click();
	await line(page, 'Голос').click();
	await page.waitForTimeout(400);

	let s = await m(page);

	say('трек из каталога: сначала предзвук', s.pre.endsWith('needle.wav') && !s.playing, JSON.stringify(s));
	await page.waitForTimeout(1000);
	s = await m(page);
	say('через 1 с — трек', s.playing && file(s) === 'mt4.wav');
	say('строка «что играет»', (await mq(page)).includes('Голос') && (await mq(page)).includes('Эфир'), await mq(page));
	say('строка отмечает трек ▶', (await page.locator('.sg-radio .sg-r-cur .sg-r-mark').textContent()) === '▶');
	say('▶ горит', await rbtn(page, 'sg-r-play').evaluate(el => el.classList.contains('sg-r-lit')));
	await page.waitForTimeout(600);
	say('окошко — громкость 30', (await digits(page)) === '30', await digits(page));
	await rbtn(page, 'sg-r-pause').click();
	await page.waitForTimeout(500);
	s = await m(page);

	const place = s.state.pos['Эфир/Голос'];

	say('❚❚: пауза, место запомнено', !s.playing && place > 0.5, String(place));
	say('на паузе окошко 00, ❚❚ горит', (await digits(page)) === '00' && (await rbtn(page, 'sg-r-pause').evaluate(el => el.classList.contains('sg-r-lit'))));
	say('строка — пауза', (await mq(page)).includes('ПАУЗА'));
	await rbtn(page, 'sg-r-play').click();
	await page.waitForTimeout(1300);
	await rbtn(page, 'sg-r-pause').click();
	s = await m(page);
	say('▶: тот же трек с того же места (предзвук снова)', s.state.cur === 'Эфир/Голос' && s.state.pos['Эфир/Голос'] > place, `${place} → ${s.state.pos['Эфир/Голос']}`);
	await rbtn(page, 'sg-r-play').click();
	await page.waitForTimeout(1300);
	await page.locator('.sg-radio .sg-r-btn', {hasText: '+'}).click();
	await page.waitForTimeout(100);
	say('«+» — громче на 5', (await m(page)).state.vol === 35);
	await page.locator('.sg-radio .sg-r-btn', {hasText: '−'}).click();
	await page.locator('.sg-radio .sg-r-btn', {hasText: '−'}).click();
	await page.waitForTimeout(100);
	say('«−» — тише', (await m(page)).state.vol === 25);
	await rbtn(page, 'sg-r-stop').click();
	await page.waitForTimeout(100);
	s = await m(page);
	say('■: стоп, место — с начала', !s.playing && s.state.pos['Эфир/Голос'] === 0);
	await rbtn(page, 'sg-r-auto').click();
	say('«АВТО» выключается', (await m(page)).state.auto === false && !(await rbtn(page, 'sg-r-auto').evaluate(el => el.classList.contains('sg-r-lit'))));
	await rbtn(page, 'sg-r-auto').click();
	say('«АВТО» включается', (await m(page)).state.auto === true);

	// Искры: частота 100 — за несколько секунд хотя бы одна, со звуком искры.
	const sparked = await page.evaluate(() => new Promise(res => {
		const seen = {spark: false, jit: false};
		const t = setInterval(() => {
			seen.spark = seen.spark || !!document.querySelector('.sg-radio .sg-r-spark.sg-r-on');
			seen.jit = seen.jit || !!document.querySelector('.sg-radio .sg-r-seg.sg-r-jit');
		}, 30);

		setTimeout(() => (clearInterval(t), res(seen)), 4000);
	}));

	say('искры вспыхивают, линия каркаса дрожит', sparked.spark && sparked.jit, JSON.stringify(sparked));
	say('звук искры', requests.some(u => u.endsWith('spark.wav')));

	// Трек появился по условию — виден в каталоге без перехода.
	await go(page, 'RHome');
	await link(page, 'Открыть');
	await go(page, 'RRadio', 600);
	say('каталог открыт там, где играло радио; трек по условию появился', JSON.stringify(await lines(page)) === JSON.stringify(['..', 'Голос', 'Длинный', 'Тайный']), JSON.stringify(await lines(page)));
	await line(page, '..').click();
	say('папка по условию появилась', (await lines(page)).includes('Закрыто'));
	await line(page, 'Эфир').click();
	await line(page, 'Длинный').click();
	await page.waitForTimeout(300);

	// Выключатель — на экран, откуда пришли; музыка играет дальше.
	await page.locator('.sg-radio .sg-r-power').click();
	await page.waitForTimeout(700);
	s = await m(page);
	say('выключатель: выход на прошлый экран', (await page.evaluate(() => SugarCube.State.passage)) === 'RHome');
	say('музыка не останавливается', s.playing && s.state.cur === 'Эфир/Длинный');

	// После сбоя радио помнит, откуда пришли.
	await go(page, 'RRadio', 600);
	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForTimeout(900);
	say('после сбоя — снова радио', (await page.evaluate(() => SugarCube.State.passage)) === 'RRadio');
	say('после сбоя музыка молчит', !(await m(page)).playing);
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	await page.locator('.sg-radio .sg-r-power').click();
	await page.waitForTimeout(700);
	say('после сбоя выключатель ведёт туда же', (await page.evaluate(() => SugarCube.State.passage)) === 'RHome');
	if (shots) {
		await go(page, 'RRadio', 800);
		await page.waitForTimeout(400);
		await page.screenshot({path: path.join(shots, 'radio-test.png')});
	}
	await page.context().close();
}

const amb = page => page.locator('.sg-amb');
const tiles = page => page.locator('.sg-amb .sg-amb-tile .sg-tile-name').allTextContents();
const status = (page, i = 0) => page.locator('.sg-amb .sg-amb-tile .sg-tile-status').nth(i).textContent();

async function ambientChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'RAmb', 500);
	say('альбомы плиткой: папка без видимых треков скрыта', JSON.stringify(await tiles(page)) === JSON.stringify(['Альбом']), JSON.stringify(await tiles(page)));
	say('«прослушано 0 из 2»', (await status(page)) === 'Прослушано: 0 из 2', await status(page));
	say('столбцы', (await page.locator('.sg-amb-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)) === 2);
	await page.locator('.sg-amb .sg-amb-tile').first().hover();
	await page.waitForTimeout(400);
	say('подсказка альбома при наведении', await page.locator('.sg-amb .hoverBox', {hasText: 'Подсказка альбома'}).isVisible());
	await page.locator('.sg-amb .sg-amb-tile').first().click();
	await page.waitForTimeout(400);

	let s = await m(page);

	say('щелчок по альбому — играет первый трек', s.playing && file(s) === 'mt1.wav');
	say('открылся список треков, первой строкой «◄ ..»', (await page.locator('.sg-amb .sg-amb-album a').first().textContent()) === '◄ ..');
	say('трек отмечен ▶', (await page.locator('.sg-amb .sg-amb-here .sg-amb-mark').textContent()) === '▶');
	say('строка Атмосферы — что играет', (await page.locator('.sg-amb-now').textContent()).includes('Первый'));
	await page.waitForTimeout(2400);
	s = await m(page);
	say('доиграл — «прослушан» ✓, «АВТО» — следующий', s.state.done['Альбом/Первый'] === 1 && file(s) === 'mt2.wav');
	say('в списке ✓', (await page.locator('.sg-amb .sg-amb-track').first().locator('.sg-amb-mark').textContent()) === '✓');
	say('«прослушано 1 из 2»', (await page.locator('.sg-amb-title').textContent()).includes('1 из 2'));
	await page.locator('.sg-amb .sg-amb-up').click();
	await page.waitForTimeout(200);
	say('«◄ ..» — к альбомам', (await status(page)) === 'Прослушано: 1 из 2', await status(page).catch(() => ''));
	await page.locator('.sg-amb-bar a', {hasText: 'По порядку'}).click();
	await page.waitForTimeout(150);
	say('«По порядку» → «Случайно»', (await m(page)).state.shuffle === true && (await page.locator('.sg-amb-bar a').first().textContent()) === 'Случайно');
	await page.waitForTimeout(2200);
	s = await m(page);
	say('«Случайно»: следующий — не тот же (в папке 2 трека)', file(s) === 'mt1.wav', file(s));
	await page.locator('.sg-amb-bar a', {hasText: 'Сбросить прогресс'}).click();
	say('сброс со второго нажатия', (await page.locator('.sg-amb-bar a').nth(1).textContent()) === 'Нажмите ещё раз' && Object.keys((await m(page)).state.done).length === 2);
	await page.locator('.sg-amb-bar a').nth(1).click();
	await page.waitForTimeout(300);
	s = await m(page);
	say('общий сброс стёр отметки, место паузы осталось', Object.keys(s.state.done).length === 0 && s.playing, JSON.stringify(s.state.done));
	await page.waitForTimeout(2200);
	await page.locator('.sg-amb .sg-amb-tile').first().click();
	await page.waitForTimeout(200);
	await page.locator('.sg-amb-head a', {hasText: 'Сбросить альбом'}).click();
	await page.locator('.sg-amb-head a', {hasText: 'Нажмите ещё раз'}).click();
	say('сброс альбома', Object.keys((await m(page)).state.done).length === 0);
	await link(page, '◄ ..').catch(() => {});
	await page.evaluate(() => SugarCube.setup.signaly.music());
	await go(page, 'RHome');
	await link(page, 'Включить Атмосферу');
	say('«Включить раздел»: играет — не трогает', (await m(page)).playing);
	if (shots) {
		await go(page, 'RAmb', 500);
		await page.screenshot({path: path.join(shots, 'ambient-test.png')});
	}
	await page.context().close();
}

// Шаблон: РАД, АТМ, A–E, «Атмосфера», экран radio — на общем плеере.
async function templateChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'Start', 500);
	say('шаблон: в начале игры тишина', !(await m(page)).state.playing);
	await page.locator('.sg-place a', {hasText: /^АТМ$/}).click();
	await page.waitForTimeout(400);

	let s = await m(page);

	// Файлы шаблона в проверке — короткие пустышки: «АВТО» быстро переходит к следующему.
	say('АТМ — Атмосфера (альбом «Классика»)', /^Классика\//.test(s.state.cur), JSON.stringify(s.state.cur));
	await page.locator('.sg-place a', {hasText: /^A$/}).click();
	say('A — громкость 10', (await m(page)).state.vol === 10);
	await page.locator('.sg-place a', {hasText: /^E$/}).click();
	say('E — громкость 99', (await m(page)).state.vol === 99);
	await page.locator('.sg-place a', {hasText: /^РАД$/}).click();
	await page.waitForTimeout(300);
	s = await m(page);
	say('РАД — радио с иглой radiovinyl', s.state.cur === 'Радио/Трек 1 radioRegentropfen' && s.pre.endsWith('radiovinyl.wav'), JSON.stringify(s));
	await page.locator('.sg-place a', {hasText: /^РАД$/}).click();
	say('РАД ещё раз — пауза', !(await m(page)).state.playing);
	await go(page, 'Атмосфера', 300);
	await go(page, 'Start', 500);
	s = await m(page);
	say('Start: Атмосфера дальше, если ничего не играет', s.state.playing && /^Классика\//.test(s.state.cur), JSON.stringify(s.state.cur));
	await go(page, 'radio', 500);
	say('экран radio — сломанное радио', (await page.locator('.sg-radio.sg-radio-broken').count()) === 1);
	say('в каталоге радио — папка «Радио»', JSON.stringify(await lines(page)) === JSON.stringify(['Радио']), JSON.stringify(await lines(page)));
	await go(page, 'Атмосфера', 500);
	say('«Атмосфера»: открыт играющий альбом', (await page.locator('.sg-amb-title').textContent()).startsWith('Классика'));
	await page.locator('.sg-amb .sg-amb-up').click();
	await page.waitForTimeout(200);
	say('«Атмосфера»: три альбома', (await tiles(page)).length === 3, JSON.stringify(await tiles(page)));
	await link(page, 'ПАУЗА');
	say('«Атмосфера»: ПАУЗА', !(await m(page)).state.playing);
	await link(page, 'ВКЛ', 400);
	s = await m(page);
	say('«Атмосфера»: ВКЛ — снова Атмосфера', s.state.playing && /^Классика\//.test(s.state.cur));

	const before = (await m(page)).state.cur;

	await link(page, 'Далее', 0);
	say('«Атмосфера»: Далее — следующий', (await m(page)).state.cur !== before, before);
	say('старых переменных нет', await page.evaluate(() => !('radioplaying' in SugarCube.State.variables) && !('playingtrack' in SugarCube.State.variables)));
	if (shots) {
		await go(page, 'radio', 800);
		await page.screenshot({path: path.join(shots, 'radio-template.png')});
		await go(page, 'Атмосфера', 500);
		await page.screenshot({path: path.join(shots, 'ambient-template.png')});
	}
	await page.context().close();
}

for (const [url, tpl, prefix] of [
	[base + 'radio-test.html', base + 'radio-tpl.html', ''],
	...extra.map(f => [base + path.relative(gameDir, path.resolve(f)), '', `[${path.basename(f)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await radioChecks(url, say);
	await ambientChecks(url, say);
	if (tpl) {
		await templateChecks(tpl, say);
	}
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
