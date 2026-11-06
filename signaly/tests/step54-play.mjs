// Проверка шага 5.4 в Chromium: звук первого посещения, подсказка при наведении,
// картинка-переключатель. Кнопка камеры — в camera-play.mjs.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node step54-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <sharp> <снимки или ""> <было.html (шаблон build-23) или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, sharpPath, shots, before, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const sharp = require(sharpPath);
const here = path.dirname(new URL(import.meta.url).pathname);

// Трёхсекундная тишина: звук не кончается раньше проверки.
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

fs.writeFileSync(path.join(gameDir, 'media/audio/шум (1).wav'), wav(3));

// Имя файла в значении переменной закодировано, как его пишет программа.
const soundFile = encodeURIComponent('media/audio/шум (1).wav').replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16)}`);
const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $num to 1>>\n')
		.replace(/\s*$/, '\n') +
	`
:: S4Css [stylesheet] {"position":"0,7000","size":"100,100"}
html {
	--sg-first-loud: fade 0.3 0.1 0 80 #ffffff 1 - - - - 60 ${soundFile};
	--sg-first-late: fade 0.3 0 1 80 #ffffff 1 - - - - 100 ${soundFile};
	--sg-first-quiet: fade 0.3 0 0 80 #ffffff 1 - - - -;
}

:: S4Home {"position":"100,7000","size":"100,100"}
Домашний экран

:: S4Loud [sg-first-loud] {"position":"200,7000","size":"100,100"}
Первая
Вторая
Третья

:: S4Late [sg-first-late] {"position":"300,7000","size":"100,100"}
С паузой

:: S4Skip [sg-first-late] {"position":"400,7000","size":"100,100"}
Щелчок раньше звука

:: S4Quiet [sg-first-quiet] {"position":"500,7000","size":"100,100"}
Без звука

:: S4Leave [sg-first-loud] {"position":"600,7000","size":"100,100"}
Уходим сразу

:: S4Lamp {"position":"100,7100","size":"100,100"}
<<sg-image "media/img/testimgOFF.jpg" second "media/img/testimgON.jpg" toggle "$lamp" sound "media/audio/шум (1).wav" volume 40 width 200>>
Текст

:: S4Num {"position":"200,7100","size":"100,100"}
<<sg-image "media/img/testimgOFF.jpg" second "media/img/testimgON.jpg" toggle "$num" width 100>>

:: S4Silent {"position":"300,7100","size":"100,100"}
<<sg-image "media/img/testimgOFF.jpg" second "media/img/testimgON.jpg" toggle "$mute" width 100>>

:: S4Plain {"position":"400,7100","size":"100,100"}
<<sg-image "media/img/testimgOFF.jpg" width 100>>

:: S4Tip {"position":"100,7200","size":"100,100"}


Строка с <<hovertip "Короткая подсказка">>наведите сюда<</hovertip>> и дальше.

<<hovertip "Очень длинная подсказка, которая никак не умещается в узкую рамку и поэтому переносится на несколько строк" 150>>узкая<</hovertip>>

<<hovertip "К домашнему экрану">>[[Домой|S4Home]]<</hovertip>>
`;
const own = test + `
:: S4Own [script] {"position":"0,7300","size":"100,100"}
Macro.add('hovertip', {
	tags: null,
	handler: function () {
		$(this.output).wiki('<span class="own-tip">' + this.payload[0].contents + '</span>');
	}
});
`;

fs.writeFileSync(path.join(gameDir, 'step54-test.twee'), test);
fs.writeFileSync(path.join(gameDir, 'step54-own.twee'), own);
['step54-test', 'step54-own'].forEach(name =>
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, `${name}.twee`), path.join(gameDir, `${name}.html`)])
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
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok || !more ? '' : ' — ' + more}`);
};
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const errors = [];

// Журнал звуков: что и когда запустили, что остановили.
const spy = () => {
	const log = [];
	const play = HTMLMediaElement.prototype.play;
	const pause = HTMLMediaElement.prototype.pause;

	window.playLog = log;
	HTMLMediaElement.prototype.play = function () {
		log.push({what: 'play', src: decodeURIComponent(this.src), volume: this.volume, at: performance.now(), audio: this});
		return play.call(this);
	};
	HTMLMediaElement.prototype.pause = function () {
		log.push({what: 'pause', src: decodeURIComponent(this.src), at: performance.now()});
		return pause.call(this);
	};
};

async function open(url, page) {
	if (!page) {
		page = await browser.newPage({viewport: {width: 1920, height: 1080}});
		await page.addInitScript(spy);
		page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
		page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	}
	await page.goto(url);
	await page.waitForSelector('#sg-start');
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
const noise = page =>
	page.evaluate(() =>
		window.playLog
			.filter(e => e.src.includes('шум (1)'))
			.map(({audio, ...rest}) => ({...rest, paused: audio ? audio.paused : undefined, time: audio ? audio.currentTime : undefined}))
	);
const clearLog = page => page.evaluate(() => (window.playLog.length = 0));
const count = async page => (await noise(page)).filter(e => e.what === 'play').length;

async function soundChecks(url, say) {
	const page = await open(url);

	await go(page, 'S4Home');
	await clearLog(page);

	const t0 = await page.evaluate(() => performance.now());

	await go(page, 'S4Loud', 150);
	let log = await noise(page);

	say('звук начинается вместе с эффектом', log.length === 1 && log[0].what === 'play' && log[0].at - t0 < 400, JSON.stringify(log));
	say('громкость способа', log[0]?.volume === 0.6, JSON.stringify(log));
	await page.waitForFunction(() => !document.getElementById('sg-fv-canvas'), null, {timeout: 4000});
	await page.waitForTimeout(400);
	log = await noise(page);
	say('эффект кончился, файл ещё звучит', log.length === 1 && log[0].paused === false && log[0].time > 0.4, JSON.stringify(log));
	await go(page, 'S4Home', 100);
	await go(page, 'S4Loud', 500);
	say('второй заход без звука', (await count(page)) === 1, JSON.stringify(await noise(page)));

	await clearLog(page);
	await go(page, 'S4Quiet', 600);
	say('способ без файла молчит', (await count(page)) === 0);

	await clearLog(page);

	const t1 = await page.evaluate(() => performance.now());

	await go(page, 'S4Late', 400);
	say('пауза перед первым элементом: звука ещё нет', (await count(page)) === 0);
	await page.waitForTimeout(900);
	log = await noise(page);
	say('звук с первым элементом', log.length === 1 && log[0].at - t1 >= 950 && log[0].at - t1 < 1500, JSON.stringify(log));

	await page.waitForTimeout(200);
	await clearLog(page);
	await go(page, 'S4Skip', 200);
	await page.mouse.click(960, 540);
	await page.waitForTimeout(1300);
	say('щелчок до первого элемента: звука нет', (await count(page)) === 0, JSON.stringify(await noise(page)));

	await clearLog(page);
	await go(page, 'S4Leave', 120);
	await go(page, 'S4Home', 300);
	log = await noise(page);
	say('уход с экрана звук не обрывает', log.length === 1 && log[0].paused === false, JSON.stringify(log));
	await page.close();

	// Щелчок посреди эффекта: всё сразу, звук идёт дальше.
	const second = await open(url);

	await clearLog(second);
	await go(second, 'S4Loud', 150);
	await second.mouse.click(960, 540);
	await second.waitForTimeout(300);
	log = await noise(second);
	say('щелчок показывает всё, звук идёт дальше', log.length === 1 && log[0].paused === false && !(await second.evaluate(() => !!document.getElementById('sg-fv-canvas'))), JSON.stringify(log));
	await second.close();
}

async function tipChecks(url, say, shot) {
	const page = await open(url);

	await go(page, 'S4Tip', 300);
	say('подсказка спрятана', await page.$eval('.hoverBox', b => getComputedStyle(b).visibility === 'hidden'));
	await page.hover('#hoverTip1');
	await page.waitForTimeout(150);

	const place = await page.evaluate(() => {
		const host = document.getElementById('hoverTip1').getBoundingClientRect();
		const box = document.getElementById('hoverTipTxt1').getBoundingClientRect();

		return {visible: getComputedStyle(document.getElementById('hoverTipTxt1')).visibility, gap: Math.round(host.top - box.bottom), center: Math.abs(host.left + host.width / 2 - box.left - box.width / 2)};
	});

	say('при наведении видна, стоит над текстом по центру', place.visible === 'visible' && place.gap >= 4 && place.gap <= 8 && place.center < 2, JSON.stringify(place));

	const look = await page.$eval('.hoverBox', b => {
		const c = getComputedStyle(b);
		const tail = getComputedStyle(b, '::after');

		return [c.backgroundColor, c.color, c.borderTopWidth, c.borderTopColor, c.borderTopLeftRadius, c.maxWidth, tail.borderTopColor].join(' ');
	});

	say('вид по умолчанию — как в стилях автора', look === 'rgb(0, 0, 0) rgb(0, 204, 0) 2px rgb(0, 204, 0) 6px 333px rgb(0, 204, 0)', look);

	const line = await page.$eval('.hoverTip', b => {
		const c = getComputedStyle(b);

		return [c.borderBottomStyle, c.borderBottomWidth, c.borderBottomColor, c.borderTopWidth].join(' ');
	});

	say('точки под текстом — как в стилях автора', line === 'dotted 2px rgb(0, 204, 0) 0px', line);
	await page.hover('#hoverTip2');
	await page.waitForTimeout(150);

	const narrow = await page.$eval('#hoverTipTxt2', b => b.getBoundingClientRect().width);

	// Ширина — без отступов и рамки, как в стилях автора: 150 + 20 + 4.
	say('своя ширина', narrow === 174, String(narrow));
	if (shot && shots) {
		await page.screenshot({path: path.join(shots, 'tip-narrow.png')});
	}

	// Вид из «Оформления терминала»: переменные блока оформления.
	await page.addStyleTag({
		content: 'html { --sg-tip-bg: #112233; --sg-tip-color: #ffff00; --sg-tip-border: 5px; --sg-tip-border-color: #ff0000; --sg-tip-radius: 0px; --sg-tip-width: 500px; --sg-tip-size: 40px; --sg-tip-font: serif; --sg-tip-line: 4px; --sg-tip-line-color: #0000ff; }'
	});
	await page.hover('#hoverTip1');
	await page.waitForTimeout(150);

	const mine = await page.$eval('.hoverBox', b => {
		const c = getComputedStyle(b);
		const tail = getComputedStyle(b, '::after');

		return [c.backgroundColor, c.color, c.borderTopWidth, c.borderTopColor, c.borderTopLeftRadius, c.maxWidth, c.fontSize, c.fontFamily, tail.borderTopColor].join(' ');
	});

	say('настройки меняют вид рамки', mine === 'rgb(17, 34, 51) rgb(255, 255, 0) 5px rgb(255, 0, 0) 0px 500px 40px serif rgb(255, 0, 0)', mine);

	const mineLine = await page.$eval('.hoverTip', b => {
		const c = getComputedStyle(b);

		return [c.borderBottomWidth, c.borderBottomColor].join(' ');
	});

	say('настройки меняют точки под текстом', mineLine === '4px rgb(0, 0, 255)', mineLine);
	if (shot && shots) {
		await page.screenshot({path: path.join(shots, 'tip-own.png')});
	}
	await page.click('#hoverTip3 a');
	await page.waitForTimeout(300);
	say('ссылка внутри подсказки работает', (await page.evaluate(() => SugarCube.State.passage)) === 'S4Home');
	await go(page, 'S4Tip', 300);
	await page.hover('#hoverTip1');
	say('новый показ экрана: подсказки снова на местах', await page.$eval('#hoverTipTxt1', b => getComputedStyle(b).visibility === 'visible'));

	// Подсказка у самого края не вылезает за экран.
	await page.evaluate(() => {
		const host = document.getElementById('hoverTip2');

		host.style.position = 'fixed';
		host.style.left = '2px';
		host.style.top = '1px';
		window.UpdateHoverTipTxt();
	});
	await page.hover('#hoverTip2');
	await page.waitForTimeout(150);

	const edge = await page.$eval('#hoverTipTxt2', b => {
		const r = b.getBoundingClientRect();

		return {top: r.top, left: r.left};
	});

	say('у края экрана подсказка внутри экрана', edge.top >= 0 && edge.left >= 0, JSON.stringify(edge));
	await page.close();
}

async function toggleChecks(url, say) {
	const page = await open(url);
	const src = async () => decodeURIComponent(await page.$eval('.passage img', i => i.src));

	await go(page, 'S4Lamp', 300);
	say('нет значения — первая картинка', (await src()).endsWith('testimgOFF.jpg'), await src());
	say('курсор — рука', await page.$eval('.passage img', i => getComputedStyle(i).cursor === 'pointer'));
	await clearLog(page);
	await page.click('.passage img');
	await page.waitForTimeout(150);
	say('щелчок: вторая картинка, переменная включена', (await src()).endsWith('testimgON.jpg') && (await getVar(page, 'lamp')) === true, await src());

	const log = await noise(page);

	say('щелчок: звук с громкостью блока', log.length === 1 && log[0].volume === 0.4, JSON.stringify(log));
	await page.click('.passage img');
	await page.waitForTimeout(150);
	say('второй щелчок: обратно', (await src()).endsWith('testimgOFF.jpg') && (await getVar(page, 'lamp')) === false);
	await page.click('.passage img');
	await page.waitForTimeout(150);

	// Значение меняет не только щелчок.
	await page.evaluate(() => (SugarCube.State.variables.lamp = false));
	await page.waitForTimeout(400);
	say('переменную поменяли со стороны: картинка следует', (await src()).endsWith('testimgOFF.jpg'), await src());
	await page.evaluate(() => (SugarCube.State.variables.lamp = true));
	await page.waitForTimeout(400);
	say('и обратно', (await src()).endsWith('testimgON.jpg'), await src());
	await go(page, 'S4Home');
	await go(page, 'S4Lamp', 300);
	say('новый показ экрана: состояние то же', (await src()).endsWith('testimgON.jpg'), await src());

	await go(page, 'S4Num', 300);
	say('число 1 — включено', (await src()).endsWith('testimgON.jpg'), await src());
	await page.click('.passage img');
	await page.waitForTimeout(150);
	say('число остаётся числом: 0', (await getVar(page, 'num')) === 0, String(await getVar(page, 'num')));
	await page.click('.passage img');
	await page.waitForTimeout(150);
	say('число остаётся числом: 1', (await getVar(page, 'num')) === 1, String(await getVar(page, 'num')));

	await go(page, 'S4Silent', 300);
	await clearLog(page);
	await page.click('.passage img');
	await page.waitForTimeout(150);
	say('без файла щелчок молчит', (await count(page)) === 0);
	await page.waitForTimeout(100);

	// Автокопия: положение переключателя переживает сбой.
	await open(url, page);
	await page.waitForTimeout(300);
	say('сбой: тот же экран, то же положение', (await page.evaluate(() => SugarCube.State.passage)) === 'S4Silent' && (await src()).endsWith('testimgON.jpg'), await src());

	await go(page, 'S4Plain', 300);
	say('обычная картинка щелчка не ждёт', await page.$eval('.passage img', i => getComputedStyle(i).cursor !== 'pointer' && !i.classList.contains('sg-toggle')));
	await page.close();
}

for (const [url, prefix] of [
	[base + 'step54-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await soundChecks(url, say);
	await tipChecks(url, say, !prefix);
	await toggleChecks(url, say);
}

// Код подсказки не узнан и остался в истории: работает он сам, ошибки нет.
{
	const url = base + 'step54-own.html';
	const page = await open(url);

	await go(page, 'S4Tip', 300);
	check('свой код подсказки главнее движка, ошибок нет', (await page.locator('.own-tip').count()) === 3 && (await page.locator('.hoverBox').count()) === 0);
	await page.close();
}

// Подсказки шаблона: вид при наведении совпадает с прошлой сборкой.
async function compare(old, now) {
	const shot = async (url, id) => {
		const page = await open(url);

		await go(page, 'Texttests', 2500);
		await page.hover(id);
		await page.waitForTimeout(300);

		const png = await page.screenshot({animations: 'disabled', caret: 'hide'});

		await page.close();
		return png;
	};

	for (const id of ['#hoverTip1', '#hoverTip2']) {
		const [a, b] = await Promise.all([shot(old, id), shot(now, id)]);
		const [x, y] = await Promise.all([a, b].map(png => sharp(png).raw().toBuffer()));
		let diff = x.length === y.length ? 0 : -1;

		if (diff === 0) {
			for (let i = 0; i < x.length; i++) {
				if (Math.abs(x[i] - y[i]) > 2) {
					diff++;
				}
			}
		}
		if (shots) {
			fs.writeFileSync(path.join(shots, `tip-${id.slice(1)}-old.png`), a);
			fs.writeFileSync(path.join(shots, `tip-${id.slice(1)}-new.png`), b);
		}
		check(`подсказка ${id} шаблона совпадает с прошлой сборкой`, diff === 0, `отличий ${diff}`);
	}
}

if (before) {
	await compare(base + path.relative(gameDir, path.resolve(before)), base + 'step54-test.html');
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
