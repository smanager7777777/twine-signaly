// Проверка этапа 6 в Chromium: раскрытие по щелчку, кнопка-перебор, приглушение
// на время звука-сигнала, предзагрузка картинок.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node step6-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

function wav(seconds) {
	const samples = 8000 * seconds;
	const head = Buffer.alloc(44);

	head.write('RIFF', 0);
	head.writeUInt32LE(36 + samples, 4);
	head.write('WAVEfmt ', 8);
	head.writeUInt32LE(16, 16);
	head.writeUInt16LE(1, 20);
	head.writeUInt16LE(1, 22);
	head.writeUInt32LE(8000, 24);
	head.writeUInt32LE(8000, 28);
	head.writeUInt16LE(1, 32);
	head.writeUInt16LE(8, 34);
	head.write('data', 36);
	head.writeUInt32LE(samples, 40);
	return Buffer.concat([head, Buffer.alloc(samples, 128)]);
}

fs.writeFileSync(path.join(gameDir, 'media/audio/голос.wav'), wav(2));
fs.writeFileSync(path.join(gameDir, 'media/audio/голос2.wav'), wav(4));
fs.writeFileSync(path.join(gameDir, 'media/audio/музыка.wav'), wav(30));
// Картинки: только на закрытых экранах, поэтому до захода на них загружает только предзагрузка.
fs.copyFileSync(path.join(gameDir, 'media/img/testimgON.jpg'), path.join(gameDir, 'media/img/схема (1).jpg'));
fs.copyFileSync(path.join(gameDir, 'media/img/testimgON.jpg'), path.join(gameDir, 'media/img/s6second.jpg'));
fs.copyFileSync(path.join(gameDir, 'media/img/testimgON.jpg'), path.join(gameDir, 'media/img/s6first.jpg'));
fs.copyFileSync(path.join(gameDir, 'media/img/testimgON.jpg'), path.join(gameDir, 'media/img/s6html.jpg'));
fs.copyFileSync(path.join(gameDir, 'media/img/testimgON.jpg'), path.join(gameDir, 'media/img/s6css.jpg'));

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, `$1<<cacheaudio "s6music" "media/audio/музыка.wav">>
<<createaudiogroup ":S6MUSIC">><<track "s6music">><</createaudiogroup>>
<<createplaylist "s6list">><<track "s6music" volume 0.4>><</createplaylist>>
<<set $s6mode to 1>>
<<set $s6flag to false>>
<<set $s6text to "АВТО">>
<<set $s6far to 7>>
`)
		.replace(/\s*$/, '\n') +
	`
:: S6Home {"position":"100,8000","size":"100,100"}
Домашний экран

:: S6Reveal [sg-first-none] {"position":"200,8000","size":"100,100"}
До. <span id="sg-reveal1"><span class="amber"><<button "[РАСШИФРОВАТЬ]">><<replace "#sg-reveal1">>Секретные данные<</replace>><</button>></span></span> После.

<span id="sg-reveal2"><<link "[ЕЩЁ]">><<replace "#sg-reveal2">>Вторые данные <span class="glitchy" data-text="ЭКРАН">глитч</span> [[на домашний|S6Home]]<</replace>><</link>></span>

<span id="sg-reveal3"><<button "[ПЕЧАТЬ]">><<replace "#sg-reveal3">><<type 10ms>>Текст печатается<</type>><</replace>><</button>></span>

:: S6Pick {"position":"300,8000","size":"100,100"}
Режим: <<sg-pick var "$s6mode" form button kind amber>>
<<sg-opt "ВЫКЛ" 0>>
<<sg-opt "ВКЛ" 1>>
<<sg-opt "АВТО" 2>>
<</sg-pick>>

Ссылкой: <<sg-pick var "$s6text">>
<<sg-opt "РАЗ" "РАЗ">>
<<sg-opt "АВТО" "АВТО">>
<</sg-pick>>

Да-нет: <<sg-pick var "$s6flag" form button>>
<<sg-opt "НЕТ" 0>>
<<sg-opt "ДА" 1>>
<</sg-pick>>

Пустая: <<sg-pick var "$s6empty" form button>>
<<sg-opt "ПЕРВАЯ" "a">>
<<sg-opt "ВТОРАЯ" "b">>
<</sg-pick>>

Чужое значение: <<sg-pick var "$s6far" form button>>
<<sg-opt "ОДИН" 1>>
<<sg-opt "ДВА" 2>>
<</sg-pick>>

:: S6PickFirst [sg-first-fast] {"position":"400,8000","size":"100,100"}
Строка
<<sg-pick var "$s6pf" form button>>
<<sg-opt "Ф0" 0>>
<<sg-opt "Ф1" 1>>
<</sg-pick>>

:: S6PickPlace {"position":"500,8000","size":"100,100"}
<<sg-place kind amber corner tr x 5 y 200>><<sg-pick var "$s6pp" form button>>
<<sg-opt "Н0" 0>>
<<sg-opt "Н1" 1>>
<</sg-pick>><</sg-place>>

:: S6Duck {"position":"600,8000","size":"100,100"}
<<link "Играть">><<audio "s6music" volume 0.5 loop play>><</link>>

<<link "Голос">><<sg-sound "media/audio/голос.wav" volume 100 duck ":S6MUSIC" to 20>><</link>>

<<link "ГолосДлинный">><<sg-sound "media/audio/голос2.wav" volume 100 duck ":playing" to 50>><</link>>

<<link "Без">><<sg-sound "media/audio/голос.wav" volume 100>><</link>>

<<link "Громче">><<audio "s6music" fadeto 0.8>><</link>>

<<link "Список">><<playlist "s6list" play>><</link>>

<<link "СтопСписок">><<playlist "s6list" stop>><</link>>

<<link "НаЭкран">><<sg-sound "media/audio/голос.wav" volume 100 duck ":S6MUSIC" to 20>><<goto "S6Home">><</link>>

:: S6Hidden {"position":"700,8000","size":"100,100"}
[img[Подпись|media/img/схема (1).jpg]]
[img[media/img/testimgOFF.jpg]]
<<sg-image "media/img/testimgON.jpg" second "media/img/s6second.jpg" toggle "$s6z">>
<img src="media/img/s6html.jpg">
<div style="background-image: url(media/img/s6css.jpg)"></div>
[img[Переменная|$imager]]
`;
const css = `
:: S6Css [stylesheet] {"position":"0,8000","size":"100,100"}
html {
	--sg-first-fast: fade 0.3 0.1 0 80 #ffffff 1 - - - -;
}
`;

fs.writeFileSync(path.join(gameDir, 'step6-test.twee'), test + css);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'step6-test.twee'), path.join(gameDir, 'step6-test.html')]);

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
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];

const spy = () => {
	const log = [];
	const play = HTMLMediaElement.prototype.play;

	window.playLog = log;
	HTMLMediaElement.prototype.play = function () {
		log.push(decodeURIComponent(this.src));
		return play.call(this);
	};
};

async function open(url, requests) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	await page.addInitScript(spy);
	page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	if (requests) {
		page.on('request', r => requests.push(decodeURIComponent(r.url())));
	}
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

const go = async (page, name, wait = 200) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const getVar = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const setVar = (page, name, value) => page.evaluate(([n, v]) => (SugarCube.State.variables[n] = v), [name, value]);
const volume = page => page.evaluate(() => SugarCube.SimpleAudio.tracks.get('s6music').audio.volume);
const own = page => page.evaluate(() => SugarCube.SimpleAudio.tracks.get('s6music').volume());
const near = (a, b, d = 0.02) => Math.abs(a - b) <= d;
// Наведение звучит и без щелчка, поэтому ищем файл именно из набора нажатия.
const clickSound = async page => {
	await page.waitForTimeout(100);
	return page.evaluate(() => {
		const files = setup_click();

		return window.playLog.some(src => files.some(file => src.endsWith(file)));

		function setup_click() {
			const data = SugarCube.setup.signalySounds;
			const name = data.kinds[''].click;

			return data.sets.find(set => set.name === name).files;
		}
	});
};

async function revealChecks(url, say) {
	const page = await start(await open(url));
	const text = () => page.locator('.passage').innerText();

	await go(page, 'S6Reveal');
	say('до щелчка видно надпись, текста нет', (await text()).includes('[РАСШИФРОВАТЬ]') && !(await text()).includes('Секретные'));

	const button = page.locator('.amber button', {hasText: 'РАСШИФРОВАТЬ'});

	await page.evaluate(() => (window.playLog.length = 0));
	await button.click();
	await page.waitForTimeout(200);
	say('щелчок открыл текст на месте', (await text()).includes('До. Секретные данные После.'), await text());
	say('надпись исчезла', !(await text()).includes('РАСШИФРОВАТЬ'));
	say('экран тот же', (await page.evaluate(() => SugarCube.State.passage)) === 'S6Reveal');
	say('щелчок звучит набором нажатия', await clickSound(page), JSON.stringify(await page.evaluate(() => window.playLog)));

	await page.locator('a', {hasText: '[ЕЩЁ]'}).click();
	await page.waitForTimeout(200);
	say('ссылкой: открылось со своей разметкой', (await page.locator('.passage .glitchy').count()) === 1);
	await page.locator('button', {hasText: 'ПЕЧАТЬ'}).click();
	await page.waitForTimeout(800);
	say('печать внутри раскрытия допечатывается', (await text()).includes('Текст печатается'), await text());
	await page.locator('a', {hasText: 'на домашний'}).click();
	await page.waitForTimeout(200);
	say('ссылка внутри раскрытого текста работает', (await page.evaluate(() => SugarCube.State.passage)) === 'S6Home');
	await go(page, 'S6Reveal');
	say('возврат на экран: снова надпись', (await text()).includes('[РАСШИФРОВАТЬ]'));
	await page.close();
}

async function pickChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'S6Pick');

	const mode = page.locator('.sg-pick .amber button');

	say('показано значение переменной', (await mode.innerText()) === 'ВКЛ', await mode.innerText());
	say('вид стоит на кнопке', (await mode.count()) === 1);
	await page.evaluate(() => (window.playLog.length = 0));
	await mode.click();
	say('щелчок: следующее значение', (await getVar(page, 's6mode')) === 2 && (await mode.innerText()) === 'АВТО');
	say('щелчок звучит набором нажатия', await clickSound(page), JSON.stringify(await page.evaluate(() => window.playLog)));
	await mode.click();
	say('после последнего — первое', (await getVar(page, 's6mode')) === 0 && (await mode.innerText()) === 'ВЫКЛ');
	await mode.click();
	say('и дальше по кругу, число остаётся числом', (await getVar(page, 's6mode')) === 1);

	const link = page.locator('.sg-pick a');

	say('ссылкой: текстовое значение', (await link.innerText()) === 'АВТО');
	await link.click();
	say('ссылкой: значение — строка', (await getVar(page, 's6text')) === 'РАЗ');

	const flag = page.locator('.sg-pick button', {hasText: /^(НЕТ|ДА)$/});

	say('да-нет понимается', (await flag.innerText()) === 'НЕТ');
	await flag.click();
	say('да-нет остаётся да-нет', (await getVar(page, 's6flag')) === true && (await flag.innerText()) === 'ДА');

	say('пустая переменная получила первое значение', (await getVar(page, 's6empty')) === 'a');

	const far = page.locator('.sg-pick button', {hasText: /^(ОДИН|ДВА)$/});

	say('чужое значение не затёрто', (await getVar(page, 's6far')) === 7 && (await far.innerText()) === 'ОДИН');
	await far.click();
	say('чужое значение: щелчок ставит первое', (await getVar(page, 's6far')) === 1, String(await getVar(page, 's6far')));

	await setVar(page, 's6mode', 0);
	await page.waitForTimeout(400);
	say('значение поменяли со стороны: надпись следует', (await mode.innerText()) === 'ВЫКЛ');

	await mode.click();
	await page.waitForTimeout(150);

	const save = await page.evaluate(() => {
		const key = Object.keys(localStorage).find(k => k.startsWith('СИГНАЛЫ/автокопия'));

		return localStorage.getItem(key);
	});

	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.sg-pick');
	await page.waitForTimeout(300);
	say(
		'значение попало в автокопию',
		(await getVar(page, 's6mode')) === 1 && (await page.locator('.sg-pick .amber button').innerText()) === 'ВКЛ',
		String(save).slice(0, 100)
	);
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());

	await go(page, 'S6PickFirst', 40);
	say('первое посещение: кнопка сначала скрыта', Number(await page.locator('.sg-pick').evaluate(el => getComputedStyle(el).opacity)) < 1);
	await page.waitForFunction(() => !document.getElementById('sg-fv-canvas'), null, {timeout: 4000}).catch(() => {});
	await page.waitForTimeout(300);

	const pf = page.locator('.sg-pick button');

	say('первое посещение: кнопка возникла', (await page.locator('.sg-pick').evaluate(el => getComputedStyle(el).opacity)) === '1');
	await pf.click();
	say('первое посещение: кнопка работает', (await pf.innerText()) === 'Ф1' && (await getVar(page, 's6pf')) === 1);

	await go(page, 'S6PickPlace', 300);

	const pp = page.locator('.sg-place .sg-pick button');

	say('внутри кнопки на экране работает', (await pp.count()) === 1);
	await pp.click();
	say('внутри кнопки на экране щелчок меняет значение', (await pp.innerText()) === 'Н1');
	await page.close();
}

async function duckChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'S6Duck');
	await page.locator('a', {hasText: /^Играть$/}).click();
	await page.waitForTimeout(300);
	say('музыка играет с громкостью 50 %', near(await volume(page), 0.5), String(await volume(page)));
	await page.locator('a', {hasText: /^Голос$/}).click();
	await page.waitForTimeout(800);
	say('пока звучит голос, музыка тише: 20 % от 50', near(await volume(page), 0.1), String(await volume(page)));
	say('своя громкость дорожки не тронута', near(await own(page), 0.5), String(await own(page)));

	await page.locator('a', {hasText: /^Громче$/}).click();
	await page.waitForTimeout(800);

	const mid = await volume(page);

	await page.waitForFunction(() => SugarCube.SimpleAudio.tracks.get('s6music').volume() > 0.6, null, {timeout: 6000}).catch(() => {});
	say('громкость можно менять и во время приглушения', mid < 0.4, String(mid));
	await page.waitForFunction(() => SugarCube.SimpleAudio.tracks.get('s6music').audio.volume > 0.45, null, {timeout: 8000}).catch(() => {});
	await page.waitForTimeout(6000);
	say('по окончании — громкость, выставленная мастером', near(await volume(page), await own(page)) && (await own(page)) > 0.7, `${await volume(page)} / ${await own(page)}`);

	await page.evaluate(() => SugarCube.SimpleAudio.tracks.get('s6music').volume(0.5));
	await page.locator('a', {hasText: /^Без$/}).click();
	await page.waitForTimeout(800);
	say('без галочки музыка не приглушается', near(await volume(page), 0.5), String(await volume(page)));
	await page.waitForTimeout(1500);

	await page.locator('a', {hasText: /^ГолосДлинный$/}).click();
	await page.locator('a', {hasText: /^Голос$/}).click();
	await page.waitForTimeout(800);
	say('два голоса сразу: действует самый тихий уровень', near(await volume(page), 0.1), String(await volume(page)));
	await page.waitForTimeout(2100);
	say('первый кончился, второй держит свой уровень', near(await volume(page), 0.25, 0.03), String(await volume(page)));
	await page.waitForTimeout(2000);
	say('оба кончились — громкость вернулась', near(await volume(page), 0.5), String(await volume(page)));

	await page.evaluate(() => SugarCube.SimpleAudio.tracks.get('s6music').stop());
	await page.locator('a', {hasText: /^Список$/}).click();
	await page.waitForTimeout(400);

	const listed = await volume(page);

	await page.locator('a', {hasText: /^Голос$/}).click();
	await page.waitForTimeout(800);
	say('музыка из плейлиста тоже приглушается', near(await volume(page), listed * 0.2), `${listed} → ${await volume(page)}`);
	await page.waitForTimeout(1900);
	say('плейлист: громкость вернулась', near(await volume(page), listed), `${listed} → ${await volume(page)}`);
	await page.locator('a', {hasText: /^СтопСписок$/}).click();
	await page.waitForTimeout(100);
	await page.evaluate(() => {
		const t = SugarCube.SimpleAudio.tracks.get('s6music');

		t.volume(0.5);
		t.loop(true);
		t.play();
	});
	await page.waitForTimeout(200);

	await page.locator('a', {hasText: /^НаЭкран$/}).click();
	await page.waitForTimeout(800);
	say('смена экрана приглушение не обрывает', near(await volume(page), 0.1), String(await volume(page)));
	await page.waitForTimeout(2000);
	say('и громкость возвращается на другом экране', near(await volume(page), 0.5), String(await volume(page)));
	await page.close();
}

async function preloadChecks(url, say) {
	const requests = [];
	const page = await open(url, requests);

	await page.waitForTimeout(500);

	const has = name => requests.some(r => r.endsWith(name));

	say('до щелчка загружена картинка с пробелом и скобкой', has('media/img/схема (1).jpg'));
	say('[img[…]] без подписи', has('media/img/testimgOFF.jpg'));
	say('первая и вторая картинка блока', has('media/img/testimgON.jpg') && has('media/img/s6second.jpg'));
	say('<img src>', has('media/img/s6html.jpg'));
	say('url(…) в тексте экрана', has('media/img/s6css.jpg'));
	say('картинка KR2', has('media/img/radio.jpg'));
	say('видео не загружаются', !requests.some(r => /media\/video\/.*\.mp4$/.test(r)), requests.filter(r => /mp4/.test(r)).join());
	say('путь с переменной не загружается', !requests.some(r => /\$imager/.test(r)));
	say('запрос каждой картинки один', requests.filter(r => r.endsWith('s6html.jpg')).length === 1);
	await start(page);
	await page.close();
}

for (const [url, prefix] of [
	[base + 'step6-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await revealChecks(url, say);
	await pickChecks(url, say);
	await duckChecks(url, say);
	await preloadChecks(url, say);
}

if (shots) {
	const page = await start(await open(base + 'step6-test.html'));

	await go(page, 'S6Pick');
	await page.screenshot({path: path.join(shots, 'step6-pick.png')});
	await go(page, 'S6Reveal');
	await page.screenshot({path: path.join(shots, 'step6-reveal.png')});
	await page.close();
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
