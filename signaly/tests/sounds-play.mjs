// Шаг 2.2: звуки в Chromium.
// 1) Шаблон до (build-8: код звуков в JavaScript истории, команды в StoryInit)
//    и после (наборы, раздел окна «Звуки») звучит одинаково: те же файлы при
//    наведении и нажатии, громкость, прерывание; те же звуки, группы, плейлисты.
// 2) Наборы: вид без звука, своя громкость и задержка, кнопка на экране
//    «без звука» и со своим набором; предпросмотр с галочкой «Без звука».
// node sounds-play.mjs <было.twee> <стало.twee> <папка с media> <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [oldTwee, newTwee, gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

const extra = `

:: SGSounds {"position":"0,0","size":"100,100"}
[[Обычная|Start]] <span class="amber">[[Янтарная|Start]]</span> <<button "Кнопка">><</button>>
<<sg-place corner tr x 5 y 5 hover none>><<link "Тихая">><</link>><</sg-place>>\\
<<sg-place corner bl x 5 y 5 hover "Особый">><<link "Особая">><</link>><</sg-place>>
`;

function publish(twee, name, more = '') {
	const file = path.join(gameDir, name + '.twee');

	fs.writeFileSync(file, fs.readFileSync(twee, 'utf8').replace(/\s*$/, '\n') + more);
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), file, path.join(gameDir, name + '.html')]);
}

publish(oldTwee, 'sounds-old');
publish(newTwee, 'sounds-new', extra);
// Предпросмотр программы: как previewHtml (режим и галочка «Без звука»).
fs.writeFileSync(
	path.join(gameDir, 'sounds-preview.html'),
	fs
		.readFileSync(path.join(gameDir, 'sounds-new.html'), 'utf8')
		.replace(/<head[^>]*>/i, m => m + '<script>window.SIGNALY_PREVIEW = "passage"; window.SIGNALY_UI_SOUND = false;</script>')
);

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
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${more ? ' — ' + more : ''}`);
};

const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];

// Каждый play() записывается: файл, громкость, время; pause() — тоже.
const spy = () => {
	window.sgPlays = [];
	const play = HTMLMediaElement.prototype.play;
	const pause = HTMLMediaElement.prototype.pause;
	HTMLMediaElement.prototype.play = function () {
		window.sgPlays.push({src: decodeURIComponent(this.currentSrc || this.src || ''), volume: Math.round(this.volume * 1000) / 1000, muted: this.muted, t: performance.now()});
		return play.apply(this, arguments).catch(() => {});
	};
	HTMLMediaElement.prototype.pause = function () {
		window.sgPlays.push({pause: decodeURIComponent(this.currentSrc || this.src || ''), t: performance.now()});
		return pause.apply(this, arguments);
	};
};

async function open(name, start = true) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
	page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
	await page.addInitScript(spy);
	await page.goto(base + name + '.html');
	if (start) {
		await page.waitForSelector('#sg-start');
		await page.click('#sg-start');
	}
	await page.waitForSelector('.passage');
	await page.waitForTimeout(500);
	return page;
}

const plays = page => page.evaluate(() => window.sgPlays.filter(p => p.src && !/startscreentape|loopcomputer/.test(p.src)));
const clear = page => page.evaluate(() => (window.sgPlays = []));

// Что зарегистрировано в SimpleAudio.
const audioState = page =>
	page.evaluate(() => {
		const init = document.querySelector('tw-passagedata[name="StoryInit"]').textContent;
		const ids = [...init.matchAll(/<<cacheaudio\s+"([^"]+)"/g)].map(m => m[1]);
		const groups = [...init.matchAll(/<<createaudiogroup\s+"([^"]+)"/g)].map(m => m[1]);
		const lists = [...init.matchAll(/<<createplaylist\s+"([^"]+)"/g)].map(m => m[1]);
		const A = SugarCube.SimpleAudio;
		const src = t => (t && t.audio ? [...t.audio.querySelectorAll('source')].map(s => s.getAttribute('src')).concat(t.audio.getAttribute('src') || []).join('|') : String(t));
		return {
			tracks: ids.map(id => [id, src(A.tracks.get(id))]),
			groups: groups.map(id => [id, JSON.stringify(A.groups.get(id))]),
			lists: lists.map(id => [id, A.lists.get(id).tracks.map(x => [src(x.track), x.volume, !!x.own])])
		};
	});

/* 1. Было и стало */
const pages = {old: await open('sounds-old'), new: await open('sounds-new')};
const state = {old: await audioState(pages.old), new: await audioState(pages.new)};

check('StoryInit: те же звуки, группы и плейлисты', JSON.stringify(state.old) === JSON.stringify(state.new) && state.new.tracks.length === 17 && state.new.lists.length === 3, `${state.new.tracks.length} звуков, ${state.new.groups.length} группы, ${state.new.lists.length} плейлиста`);

const behaviour = {};

for (const which of ['old', 'new']) {
	const page = pages[which];
	const links = await page.$$('.passage a');
	await clear(page);
	await links[0].hover();
	await page.waitForTimeout(80);
	await page.mouse.move(5, 5);
	await page.waitForTimeout(50);
	await links[1].hover();
	await page.waitForTimeout(80);
	const hovered = await plays(page);
	const paused = await page.evaluate(() => window.sgPlays.filter(p => p.pause && /hover/.test(p.pause)).length);
	await clear(page);
	await page.mouse.move(5, 5);
	await page.waitForTimeout(50);
	await links[1].click();
	await page.waitForTimeout(150);
	const clicked = (await plays(page)).filter(p => /click/.test(p.src));
	behaviour[which] = {hovered, paused, clicked};
}

for (const which of ['old', 'new']) {
	const b = behaviour[which];
	check(
		`${which === 'old' ? 'было' : 'стало'}: наведение — случайный hover1–6, 5 %; второе прерывает первое; нажатие — click1–3, 5 %`,
		b.hovered.length === 2 && b.hovered.every(p => /media\/audio\/hover[1-6]\.wav$/.test(p.src) && p.volume === 0.05) && b.paused >= 1 && b.clicked.length === 1 && /media\/audio\/click[1-3]\.wav$/.test(b.clicked[0].src) && b.clicked[0].volume === 0.05,
		JSON.stringify({h: b.hovered.map(p => p.src.replace(/.*\//, '') + '@' + p.volume), paused: b.paused, c: b.clicked.map(p => p.src.replace(/.*\//, '') + '@' + p.volume)})
	);
}

// Случайный выбор: за 30 наведений встречаются разные файлы.
{
	const page = pages.new;
	await page.evaluate(() => SugarCube.Engine.play('Start'));
	await page.waitForTimeout(300);
	const link = await page.$('.passage a');
	await clear(page);
	for (let i = 0; i < 30; i++) {
		await page.mouse.move(5, 5);
		await link.hover();
	}
	await page.waitForTimeout(100);
	const files = new Set((await plays(page)).map(p => p.src));
	check('случайный файл из набора (за 30 наведений — разные)', files.size >= 3, [...files].map(f => f.replace(/.*\//, '')).join(' '));
}

/* 2. Наборы, виды, кнопки на экране */
{
	const page = pages.new;
	await page.evaluate(() => {
		const s = SugarCube.setup.signalySounds;
		s.sets.push({name: 'Особый', files: ['media/audio/radiovinyl.wav'], volume: 40, delay: 300});
		s.kinds.amber = {hover: ''};
		SugarCube.Engine.play('SGSounds');
	});
	await page.waitForTimeout(400);
	const hoverOn = async selector => {
		await page.mouse.move(5, 500);
		await page.waitForTimeout(50);
		await clear(page);
		await page.hover(selector);
		await page.waitForTimeout(60);
		return plays(page);
	};
	const amber = await hoverOn('.amber a');
	check('вид «без звука» — тихо', amber.length === 0, JSON.stringify(amber));
	const plain = await hoverOn('.passage > a, .passage a.link-internal');
	check('вид без своего набора — как «Обычный»', plain.length === 1 && /hover/.test(plain[0].src), JSON.stringify(plain.map(p => p.src)));
	const button = await hoverOn('.passage button');
	check('кнопка тоже звучит', button.length === 1 && /hover/.test(button[0].src));
	const quiet = await hoverOn('.sg-place[data-sg-hover=""] a');
	check('кнопка на экране «без звука»', quiet.length === 0, JSON.stringify(quiet));
	const special = await hoverOn('.sg-place[data-sg-hover="Особый"] a');
	await page.waitForTimeout(400);
	const later = await plays(page);
	check('кнопка на экране со своим набором: громкость 40 %, задержка 300 мс', special.length === 0 && later.length === 1 && /radiovinyl/.test(later[0].src) && later[0].volume === 0.4, JSON.stringify(later.map(p => p.src.replace(/.*\//, '') + '@' + p.volume)));
}

/* 3. Предпросмотр: «Без звука» и обратно */
{
	const page = await open('sounds-preview', false);
	await page.evaluate(() => SugarCube.Engine.play('SGSounds'));
	await page.waitForTimeout(300);
	await clear(page);
	await page.hover('.passage button');
	await page.waitForTimeout(80);
	const muted = await plays(page);
	await page.mouse.move(5, 500);
	await page.evaluate(() => (window.SIGNALY_UI_SOUND = true));
	await clear(page);
	await page.hover('.passage button');
	await page.waitForTimeout(80);
	const loud = await plays(page);
	check('предпросмотр: с галочкой «Без звука» тихо, без неё звучит', muted.length === 0 && loud.length === 1 && /hover/.test(loud[0].src), JSON.stringify([muted.length, loud.map(p => p.src)]));
}

const sugarErrors = await pages.new.$$eval('.error-view, .error', els => els.map(e => e.textContent));
check('без ошибок SugarCube', sugarErrors.length === 0, sugarErrors.join(' | '));
check('ошибок страницы нет', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
