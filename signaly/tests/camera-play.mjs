// Проверка шага 5.3 в Chromium: блок «Камера».
// Поток камеры подменяется холстом: в безоконном Chromium настоящей камеры нет.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node camera-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <sharp> [снимки] [было.html] [ещё игра.html …]
// было.html — шаблон прошлой сборки: вид CAMERATEST и XIAOMICAM с картинкой сравнивается попиксельно.
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
const test =
	fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n').replace(/\s*$/, '\n') +
	`
:: CmHome {"position":"100,6000","size":"100,100"}
Экран без камеры

:: CmWeb {"position":"200,6000","size":"100,100"}
<<sg-camera width 400 height 300 border 3 color "#ff0000" glow 6>>
Под камерой

:: CmWin {"position":"300,6000","size":"100,100"}
Над камерой
<<sg-camera source "window" width 500 height 200 vwidth 500 vheight 500 shiftx -20 shifty -150 button "Подключить связь" border 2>>
Под кнопкой

:: CmOwn {"position":"400,6000","size":"100,100"}
<<sg-camera source "window" width 300 height 300 nosignal "ПОМЕХИ НА ЛИНИИ" nocolor "#ff8800" nonoise 0>>

:: CmNoisy {"position":"500,6000","size":"100,100"}
<<sg-camera source "window" width 300 height 200 nonoise 70>>

:: CmCenter {"position":"600,6000","size":"100,100"}
<<sg-camera width 400 height 200 place center>>

:: CmFixed {"position":"700,6000","size":"100,100"}
<<sg-camera source "window" width 200 height 100 place screen corner tr x 30 y 40>>

:: CmTwo {"position":"800,6000","size":"100,100"}
<<sg-camera width 200 height 100>>
<<sg-camera width 200 height 100>>

:: CmFirst [sg-first-noise] {"position":"900,6000","size":"100,100"}
Строка
<<sg-camera width 300 height 200>>

:: CmCss [stylesheet] {"position":"0,6000","size":"100,100"}
html { --sg-first-noise: noise 0.2 0.1 0 90 #ffffff 1 - - - -; }
`;

fs.writeFileSync(path.join(gameDir, 'camera-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'camera-test.twee'), path.join(gameDir, 'camera-test.html')]);

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

// Подмена браузерных вызовов: неподвижная картинка вместо камеры.
const fakeMedia = () => {
	const calls = {web: 0, window: 0};
	const fake = {calls, deny: false, streams: []};

	function picture() {
		const canvas = document.createElement('canvas');

		canvas.width = 640;
		canvas.height = 360;

		const c = canvas.getContext('2d');
		const grad = c.createLinearGradient(0, 0, 640, 360);

		grad.addColorStop(0, '#2040c0');
		grad.addColorStop(1, '#e0c020');
		c.fillStyle = grad;
		c.fillRect(0, 0, 640, 360);
		c.fillStyle = '#ffffff';
		c.fillRect(100, 100, 200, 100);

		const stream = canvas.captureStream(10);

		// Холст отдаёт кадр при изменении: перерисовываем то же самое.
		setInterval(() => {
			c.globalAlpha = 1;
			c.fillStyle = '#ffffff';
			c.fillRect(100, 100, 200, 100);
		}, 100);
		fake.streams.push(stream);
		return stream;
	}

	function ask(which) {
		calls[which]++;
		return fake.deny ? Promise.reject(new DOMException('нет', 'NotAllowedError')) : Promise.resolve(picture());
	}

	window.fakeMedia = fake;
	const media = navigator.mediaDevices;

	media.getUserMedia = () => ask('web');
	media.getDisplayMedia = () => ask('window');
	// Отключение камеры: дорожка кончилась.
	fake.unplug = () => {
		fake.streams.forEach(s =>
			s.getVideoTracks().forEach(t => {
				t.stop();
				t.dispatchEvent(new Event('ended'));
			})
		);
	};
};

async function open(url, deny = false, wait = true) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	await page.addInitScript(fakeMedia);
	if (deny) {
		await page.addInitScript(() => (window.fakeMedia.deny = true));
	}
	await page.goto(url);
	await page.waitForSelector('#sg-start');
	if (wait) {
		await page.click('#sg-start');
		await page.waitForSelector('.passage');
		await page.waitForTimeout(300);
		await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	}
	return page;
}

const go = async (page, name, wait = 300) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const calls = page => page.evaluate(() => window.fakeMedia.calls);
const rect = (page, sel) => page.$eval(sel, el => {
	const r = el.getBoundingClientRect();

	return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height};
});
const state = (page, nth = 0) =>
	page.evaluate(i => {
		const box = document.querySelectorAll('.sg-camera-box')[i];
		const video = box.querySelector('video');
		const off = box.querySelector('.sg-camera-off');

		return {
			stream: !!video.srcObject,
			playing: !video.paused && video.videoWidth > 0,
			off: getComputedStyle(off).display !== 'none',
			text: off.textContent
		};
	}, nth);

async function run(url, say) {
	/* Веб-камера */
	let page = await open(url);
	let n = await calls(page);

	say('веб-камера подключается при запуске, один раз', n.web === 1 && n.window === 0, JSON.stringify(n));
	await go(page, 'CmHome');
	await go(page, 'CmWeb', 600);
	let s = await state(page);

	say('веб-камера показывает картинку, надписи нет', s.stream && s.playing && !s.off, JSON.stringify(s));
	const web = await rect(page, '.sg-camera-box');

	say('размер окна вместе с рамкой', web.width === 406 && web.height === 306, JSON.stringify(web));
	const look = await page.$eval('.sg-camera-box', el => {
		const c = getComputedStyle(el);

		return `${c.borderTopWidth} ${c.borderTopColor} ${c.boxShadow}`;
	});

	say('рамка и свечение', /^3px rgb\(255, 0, 0\) rgb\(255, 0, 0\)/.test(look), look);
	const line = await rect(page, '.passage');

	say('блок стоит в тексте слева', Math.abs(web.left - line.left) < 2, `${web.left} ${line.left}`);
	const under = await page.evaluate(() => {
		const range = document.createRange();
		const node = [...document.querySelector('.passage').childNodes].filter(x => x.nodeType === 3 && /Под камерой/.test(x.textContent))[0];

		range.selectNode(node);
		return range.getBoundingClientRect().top;
	});

	say('текст идёт под блоком', under >= web.bottom, `${under} ${web.bottom}`);
	await go(page, 'CmHome');
	await go(page, 'CmWeb', 500);
	await go(page, 'CmTwo', 500);
	n = await calls(page);
	s = await state(page, 1);
	say('смена экрана не теряет подключение, новых запросов нет', n.web === 1 && s.playing, JSON.stringify(n));
	await page.evaluate(() => window.fakeMedia.unplug());
	await page.waitForTimeout(300);
	s = await state(page);
	say('камера отключилась — «НЕТ СИГНАЛА»', s.off && !s.stream && /НЕТ СИГНАЛА/.test(s.text), JSON.stringify(s));
	await page.evaluate(() => navigator.mediaDevices.dispatchEvent(new Event('devicechange')));
	await page.waitForTimeout(500);
	s = await state(page);
	n = await calls(page);
	say('камеру вставили обратно — подключается сама', n.web === 2 && s.playing && !s.off, JSON.stringify([n, s]));

	/* Захват окна */
	await go(page, 'CmHome');
	await go(page, 'CmWin', 500);
	n = await calls(page);
	s = await state(page);
	say('захват окна сам не подключается', n.window === 0 && s.off, JSON.stringify(n));
	const off = await rect(page, '.sg-camera-off');
	const frame = await rect(page, '.sg-camera-box');

	say('надпись закрывает всё окно', off.width === 500 && off.height === 200 && frame.width === 504, JSON.stringify([off, frame]));
	const a1 = await page.$eval('.sg-camera-off canvas', c => c.toDataURL());

	await page.waitForTimeout(200);
	const a2 = await page.$eval('.sg-camera-off canvas', c => c.toDataURL());

	say('шум движется', a1 !== a2);
	const opacity = await page.$eval('.sg-camera-off canvas', c => getComputedStyle(c).opacity);

	say('шум по умолчанию 30 %', opacity === '0.3', opacity);
	if (shots) {
		await page.screenshot({path: path.join(shots, 'camera-off.png')});
	}
	const button = await page.locator('.sg-camera button').textContent();

	say('своя надпись кнопки', button === 'Подключить связь', button);
	const video = await rect(page, '.sg-camera video');

	say('обрезка: видео 500×500 сдвинуто на −20, −150', video.width === 500 && video.height === 500 && video.left === frame.left + 2 - 20 && video.top === frame.top + 2 - 150, JSON.stringify([video, frame]));
	await page.click('.sg-camera button');
	await page.waitForTimeout(500);
	n = await calls(page);
	s = await state(page);
	say('кнопка подключает захват окна', n.window === 1 && s.playing && !s.off, JSON.stringify([n, s]));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'camera-on.png')});
	}
	await page.click('.sg-camera button');
	await page.waitForTimeout(200);
	n = await calls(page);
	say('повторное нажатие ничего не спрашивает', n.window === 1, JSON.stringify(n));
	await go(page, 'CmHome');
	await go(page, 'CmWin', 500);
	s = await state(page);
	n = await calls(page);
	say('захват окна переживает смену экрана', n.window === 1 && s.playing && !s.off, JSON.stringify([n, s]));
	await page.evaluate(() => window.fakeMedia.unplug());
	await page.waitForTimeout(300);
	s = await state(page);
	say('окно закрыли — «НЕТ СИГНАЛА»', s.off && !s.stream, JSON.stringify(s));
	await page.evaluate(() => (window.fakeMedia.deny = true));
	await page.click('.sg-camera button');
	await page.waitForTimeout(300);
	s = await state(page);
	say('отказ в окне браузера — надпись остаётся', s.off, JSON.stringify(s));
	await page.evaluate(() => (window.fakeMedia.deny = false));
	await page.click('.sg-camera button');
	await page.waitForTimeout(500);
	s = await state(page);
	n = await calls(page);
	say('после отказа кнопка снова подключает', n.window === 3 && s.playing, JSON.stringify([n, s]));

	/* Надпись и шум */
	await page.close();
	page = await open(url);
	await go(page, 'CmOwn', 400);
	s = await state(page);
	const own = await page.$eval('.sg-camera-off', el => ({color: getComputedStyle(el).color, canvas: !!el.querySelector('canvas')}));

	say('своя надпись и цвет', s.text === 'ПОМЕХИ НА ЛИНИИ' && own.color === 'rgb(255, 136, 0)', JSON.stringify(own));
	say('шум 0 — холста нет', !own.canvas);
	await go(page, 'CmNoisy', 400);
	const strong = await page.$eval('.sg-camera-off canvas', c => getComputedStyle(c).opacity);

	say('своя сила шума', strong === '0.7', strong);

	/* Место */
	await go(page, 'CmCenter', 500);
	const mid = await rect(page, '.sg-camera-box');
	const hole = await rect(page, '#passages');

	say('по центру', Math.abs((mid.left + mid.right) / 2 - (hole.left + hole.right) / 2) < 2, JSON.stringify([mid, hole]));
	await go(page, 'CmFixed', 400);
	const fixed = await page.$eval('.sg-camera', el => getComputedStyle(el).position);
	const spot = await rect(page, '.sg-camera');
	const pass = await rect(page, '#passages');

	say('от угла окна, вместе с кнопкой', fixed === 'fixed' && Math.abs(pass.right - spot.right - 30) < 3 && Math.abs(spot.top - pass.top - 40) < 3, JSON.stringify([spot, pass]));
	say('кнопка внутри блока', (await page.locator('.sg-camera button').count()) === 1);

	/* Первое посещение */
	await go(page, 'CmFirst', 100);
	const hidden = await page.$eval('.sg-camera', el => getComputedStyle(el).opacity);

	await page.waitForTimeout(1000);
	const shown = await page.$eval('.sg-camera', el => getComputedStyle(el).opacity);

	s = await state(page);
	say('первое посещение: камера возникает, картинка идёт', Number(hidden) < 1 && shown === '1' && s.playing, `${hidden} ${shown} ${JSON.stringify(s)}`);

	/* Отказ при запуске */
	await page.close();
	page = await open(url, true);
	await go(page, 'CmWeb', 400);
	s = await state(page);
	say('отказ веб-камере — надпись, экран работает', s.off, JSON.stringify(s));
	n = await calls(page);
	say('на экране с камерой спрашивает снова', n.web === 2, JSON.stringify(n));
	await page.close();

	/* Шаблон */
	page = await open(url);
	await go(page, 'CAMERATEST', 600);
	s = await state(page);
	say('CAMERATEST: картинка', s.playing && !s.off, JSON.stringify(s));
	await go(page, 'XIAOMICAM', 400);
	s = await state(page);
	say('XIAOMICAM: до кнопки надпись', s.off, JSON.stringify(s));
	await page.getByRole('button', {name: 'Подключить камеру'}).click();
	await page.waitForTimeout(500);
	s = await state(page);
	say('XIAOMICAM: кнопка «Подключить камеру» работает', s.playing && !s.off, JSON.stringify(s));
	await page.close();
}

// Вид CAMERATEST и XIAOMICAM с картинкой: до переноса и после.
async function compare(old, now) {
	const shot = async (url, screen) => {
		const page = await open(url);

		await go(page, screen, 500);
		if (screen === 'XIAOMICAM') {
			await page.getByRole('button', {name: 'Подключить камеру'}).click();
		}
		await page.waitForTimeout(800);

		const png = await page.screenshot({animations: 'disabled', caret: 'hide'});

		await page.close();
		return png;
	};

	for (const screen of ['CAMERATEST', 'XIAOMICAM']) {
		const [a, b] = await Promise.all([shot(old, screen), shot(now, screen)]);
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
			fs.writeFileSync(path.join(shots, `camera-${screen}-old.png`), a);
			fs.writeFileSync(path.join(shots, `camera-${screen}-new.png`), b);
		}
		check(`${screen}: вид с картинкой совпадает с прошлой сборкой`, diff === 0, `отличий ${diff}`);
	}
}

for (const [url, prefix] of [
	[base + 'camera-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	await run(url, (name, ok, more) => check(prefix + name, ok, more));
}
if (before) {
	await compare(base + path.relative(gameDir, path.resolve(before)), base + 'camera-test.html');
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));
await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
