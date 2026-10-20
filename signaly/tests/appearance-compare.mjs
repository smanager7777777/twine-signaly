// Вид игры до и после переноса настроек в блок оформления должен совпадать.
// Каждый пассаж открывается в обеих версиях, снимки сравниваются попиксельно
// (мерцание на время снимка останавливается). HOVER=1 — ещё наведение и нажатие
// на первые ссылки и кнопки каждого экрана.
// node appearance-compare.mjs <папка игры> <было.html> <стало.html> <playwright> <sharp> [папка снимков]
import {createRequire} from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [gameDir, oldName, newName, playwrightPath, sharpPath, shotsDir = '/tmp/signaly-compare'] =
	process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const sharp = require(sharpPath);
fs.mkdirSync(shotsDir, {recursive: true});

const types = {html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2'};
const server = http
	.createServer((req, res) => {
		const file = path.join(gameDir, decodeURIComponent(req.url.split('?')[0]));
		if (!file.startsWith(path.resolve(gameDir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream'});
		fs.createReadStream(file).pipe(res);
	})
	.listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({
	args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});

async function open(name) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
	// Одинаковые «случайные» числа в обеих версиях (хактест).
	await page.addInitScript(() => {
		let seed = 12345;
		Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	});
	await page.goto(base + encodeURIComponent(name));
	await page.waitForTimeout(500);
	if (await page.$('#sg-start')) {
		await page.click('#sg-start');
	}
	await page.waitForFunction(() => window.SugarCube && SugarCube.State && SugarCube.State.passage, null, {timeout: 20000});
	await page.waitForTimeout(800);
	return page;
}

const oldPage = await open(oldName);
const newPage = await open(newName);
const names = await oldPage.evaluate(() =>
	SugarCube.Story.filter(p => !p.tags.some(t => ['widget', 'StoryInit', 'script', 'stylesheet'].includes(t)) && p.name !== 'StoryInit').map(p => p.name)
);

async function shot(page, name, wait = 1500) {
	if (name) {
		await page.evaluate(n => {
			SugarCube.Dialog.close();
			SugarCube.Engine.play(n);
		}, name);
	}
	await page.waitForTimeout(wait);
	// Видео и камера меняются во времени — останавливаем на первом кадре.
	await page.evaluate(() =>
		Promise.all(
			[...document.querySelectorAll('video')].map(v => {
				v.pause();
				if (v.srcObject) {
					v.srcObject = null;
					return Promise.resolve();
				}
				if (!v.currentSrc || v.currentTime === 0) return Promise.resolve();
				return new Promise(r => {
					v.addEventListener('seeked', r, {once: true});
					v.currentTime = 0;
					setTimeout(r, 1000);
				});
			})
		)
	);
	// Курсор мигает в полях ввода — убираем фокус.
	await page.evaluate(() => document.activeElement && document.activeElement.blur());
	return page.screenshot({animations: 'disabled', caret: 'hide'});
}

async function raw(png) {
	return sharp(png).raw().toBuffer({resolveWithObject: true});
}

async function compare(a, b) {
	const [ra, rb] = await Promise.all([raw(a), raw(b)]);
	let diff = 0;
	for (let i = 0; i < ra.data.length; i += ra.info.channels) {
		if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) diff++;
	}
	return diff;
}

let failed = 0;
for (const name of names) {
	let [a, b] = await Promise.all([shot(oldPage, name), shot(newPage, name)]);
	let diff = await compare(a, b);
	if (diff > 0) {
		// Текст с печатью по буквам — ждём, пока допечатается, и снимаем снова.
		for (const wait of [6000, 12000]) {
			[a, b] = await Promise.all([shot(oldPage, null, wait), shot(newPage, null, wait)]);
			diff = await compare(a, b);
			if (diff === 0) break;
		}
	}
	const safe = name.replace(/[^\wа-яё-]/gi, '_');
	if (diff > 0) {
		failed++;
		fs.writeFileSync(path.join(shotsDir, `${safe}-было.png`), a);
		fs.writeFileSync(path.join(shotsDir, `${safe}-стало.png`), b);
	}
	console.log(`${diff === 0 ? 'OK  ' : 'DIFF'} ${name}${diff ? ` — ${diff} пикс.` : ''}`);
	if (process.env.HOVER && diff === 0) {
		failed += await compareStates(name, safe);
	}
	if (process.env.DIALOGS && diff === 0) {
		failed += await compareDialogs(name, safe);
	}
}

// Окна-сообщения (DIALOGS=1): щелчок по каждой ссылке и кнопке экрана, которая
// никуда не ведёт; если открылось окно — сравниваются снимки с окном.
async function clickNth(page, index) {
	return page.evaluate(i => {
		const els = [...document.querySelectorAll('#passages a:not([data-passage]), #passages button')].filter(e => {
			const r = e.getBoundingClientRect();
			return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
		});
		const e = els[i];
		if (!e) return false;
		e.click();
		return true;
	}, index);
}

async function compareDialogs(name, safe) {
	let bad = 0;
	for (let i = 0; i < 12; i++) {
		const [ca, cb] = [await clickNth(oldPage, i), await clickNth(newPage, i)];
		if (!ca || !cb) {
			if (ca !== cb) {
				console.log(`DIFF ${name} — элемент ${i + 1} есть не в обеих версиях`);
				bad++;
			}
			break;
		}
		await Promise.all([oldPage.waitForTimeout(500), newPage.waitForTimeout(500)]);
		const open = await Promise.all([oldPage, newPage].map(p => p.evaluate(() => SugarCube.Dialog.isOpen())));
		if (open[0] || open[1]) {
			const [a, b] = await Promise.all([oldPage, newPage].map(p => p.screenshot({animations: 'disabled', caret: 'hide'})));
			const diff = open[0] === open[1] ? await compare(a, b) : -1;
			if (diff !== 0) {
				bad++;
				fs.writeFileSync(path.join(shotsDir, `${safe}-окно${i + 1}-было.png`), a);
				fs.writeFileSync(path.join(shotsDir, `${safe}-окно${i + 1}-стало.png`), b);
			}
			console.log(`${diff === 0 ? 'OK  ' : 'DIFF'} ${name}, окно от элемента ${i + 1}${diff ? ` — ${diff < 0 ? 'открылось не в обеих' : diff + ' пикс.'}` : ''}`);
		}
		// Вернуть экран в исходное состояние.
		await Promise.all([oldPage, newPage].map(p => p.evaluate(n => {
			SugarCube.Dialog.close();
			SugarCube.Engine.play(n);
		}, name)));
		await Promise.all([oldPage.waitForTimeout(800), newPage.waitForTimeout(800)]);
	}
	return bad;
}

// Наведение и нажатие (HOVER=1): первые ссылки и кнопки экрана, в обеих версиях.
async function stateShot(page, index, press) {
	const box = await page.evaluate(i => {
		const els = [...document.querySelectorAll('#passages a, #passages button')].filter(e => {
			const r = e.getBoundingClientRect();
			return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
		});
		const e = els[i];
		if (!e) return null;
		const r = e.getBoundingClientRect();
		return {x: r.left + r.width / 2, y: r.top + r.height / 2};
	}, index);
	if (!box) return null;
	await page.mouse.move(box.x, box.y);
	if (press) await page.mouse.down();
	await page.waitForTimeout(50);
	const png = await page.screenshot({animations: 'disabled', caret: 'hide'});
	await page.mouse.move(1, 1);
	if (press) await page.mouse.up();
	return png;
}

async function compareStates(name, safe) {
	let bad = 0;
	for (let i = 0; i < Number(process.env.HOVER_COUNT || 6); i++) {
		for (const press of [false, true]) {
			const [a, b] = [await stateShot(oldPage, i, press), await stateShot(newPage, i, press)];
			if (!a || !b) {
				if (a || b) {
					console.log(`DIFF ${name} — элемент ${i + 1} есть не в обеих версиях`);
					bad++;
				}
				return bad;
			}
			const diff = await compare(a, b);
			if (diff > 0) {
				bad++;
				const tag = `${safe}-${i + 1}-${press ? 'нажатие' : 'наведение'}`;
				fs.writeFileSync(path.join(shotsDir, `${tag}-было.png`), a);
				fs.writeFileSync(path.join(shotsDir, `${tag}-стало.png`), b);
				console.log(`DIFF ${name}, элемент ${i + 1}, ${press ? 'нажатие' : 'наведение'} — ${diff} пикс.`);
			}
		}
	}
	return bad;
}

console.log(failed === 0 ? `\nВсе ${names.length} экранов совпадают` : `\nРазличаются: ${failed} из ${names.length}`);
await browser.close();
server.close();
process.exit(failed === 0 ? 0 : 1);
