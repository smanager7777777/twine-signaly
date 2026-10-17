// Проверка движка терминала в Chromium: стартовый экран, полный экран,
// автокопия, продолжение после сбоя, «Новая игра» (Shift+Z+N),
// режим «Тестировать» без автокопии, защита экрана, эффекты монитора.
// node engine-play.mjs <папка игры> <playwright>
// В папке: game.html (обычная публикация), test.html (режим «Тестировать»),
// prot.html (включены защита, эффекты и звук запуска).
import {createRequire} from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);

const requested = [];
const types = {html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2'};
const server = http
	.createServer((req, res) => {
		const url = decodeURIComponent(req.url.split('?')[0]);
		requested.push(url);
		const file = path.join(gameDir, url);
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
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

const browser = await chromium.launch({args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
const errors = [];

async function open(file) {
	const page = await context.newPage();
	page.on('pageerror', e => errors.push(`${file}: ${e.message}`));
	await page.addInitScript(() => {
		window.__fullscreenCalls = 0;
		const original = Element.prototype.requestFullscreen;
		Element.prototype.requestFullscreen = function (...args) {
			window.__fullscreenCalls++;
			return original.apply(this, args);
		};
	});
	await page.goto(base + file);
	await page.waitForSelector('#sg-start', {timeout: 15000});
	await page.waitForTimeout(500);
	return page;
}

async function start(page) {
	await page.click('#sg-start');
	await page.waitForFunction(() => SugarCube.State.passage, null, {timeout: 15000});
	await page.waitForTimeout(1200);
}

const passage = page => page.evaluate(() => SugarCube.State.passage);
const vars = page => page.evaluate(() => ({...SugarCube.State.variables}));
const copy = (page, file = 'game.html') =>
	page.evaluate(f => {
		const key = Object.keys(localStorage).find(k => k.startsWith('СИГНАЛЫ/автокопия/') && k.endsWith('/' + f));
		return key ? JSON.parse(localStorage.getItem(key)) : null;
	}, file);
const playing = page =>
	page.evaluate(() =>
		['radiovinyl', 'radioRegentropfen', 'loopcomputer'].filter(id => SugarCube.SimpleAudio.tracks.get(id).isPlaying())
	);

// 1. Стартовый экран
let page = await open('game.html');
const startText = await page.evaluate(() => getComputedStyle(document.querySelector('#sg-start'), '::after').content);
check('стартовый экран с надписью', startText === '"Нажмите, чтобы запустить систему"', startText);
check('до клика игра не запущена', (await passage(page)) === '' || (await passage(page)) == null);
check('до клика StoryInit не запускался (звуки из него не грузятся)', !requested.includes('/media/audio/radioMoonlight.wav'));

// 2. Клик — полный экран и первый экран игры
await start(page);
check('после клика — экран Start', (await passage(page)) === 'Start');
check('после клика — запрос полного экрана', (await page.evaluate(() => window.__fullscreenCalls)) >= 1);
check('стартовый экран убран', (await page.$('#sg-start')) === null);
check('автокопия записана при входе', (await copy(page))?.passage === 'Start');

// 3. Действие без перехода попадает в автокопию
await page.click('#passages a[data-passage="radio"]');
await page.waitForTimeout(800);
check('переход на radio', (await passage(page)) === 'radio');
await page.click('#passages >> text=Трек 1 radioRegentropfen');
await page.waitForTimeout(9500);
const c1 = await copy(page);
check('действие на экране записано (без перехода)', c1?.passage === 'radio' && JSON.parse(c1.vars).radioplaying === 1, c1 && c1.vars.slice(0, 120));
check('играет radioRegentropfen', (await playing(page)).includes('radioRegentropfen'));

// 4. «Сбой»: закрываем вкладку, открываем заново
await page.close();
page = await open('game.html');
check('после сбоя снова стартовый экран', (await page.$('#sg-start')) !== null);
await start(page);
await page.waitForTimeout(800);
check('после сбоя — тот же экран (radio)', (await passage(page)) === 'radio');
check('после сбоя — переменные на месте', (await vars(page)).radioplaying === 1);
// Ответ автора 2б: музыку после сбоя включает мастер.
check('после сбоя — радио само не включается', !(await playing(page)).includes('radioRegentropfen'), (await playing(page)).join(','));

// 5. F5 в той же вкладке — тоже по автокопии
await page.reload();
await page.waitForSelector('#sg-start');
await start(page);
check('после F5 — тот же экран', (await passage(page)) === 'radio');

// 6. Новая игра: Shift+Z+N → «Да»
await page.keyboard.down('KeyZ');
await page.keyboard.down('Shift');
await page.keyboard.press('KeyN');
await page.keyboard.up('Shift');
await page.keyboard.up('KeyZ');
await page.waitForTimeout(500);
check('Shift+Z+N — вопрос «Начать новую игру?»', (await page.textContent('#ui-dialog-body')).includes('Начать новую игру?'));
await page.click('#ui-dialog-body button.sg-new-game-no');
await page.waitForTimeout(300);
check('«Нет» — игра продолжается', (await passage(page)) === 'radio' && (await copy(page)) !== null);
await page.keyboard.down('KeyZ');
await page.keyboard.down('Shift');
await page.keyboard.press('KeyN');
await page.keyboard.up('Shift');
await page.keyboard.up('KeyZ');
await page.waitForTimeout(500);
await Promise.all([page.waitForNavigation(), page.click('#ui-dialog-body button.sg-new-game-yes')]);
await page.waitForSelector('#sg-start');
check('«Да» — автокопия стёрта, снова стартовый экран', (await copy(page)) === null);
await start(page);
check('новая игра — с экрана Start', (await passage(page)) === 'Start' && (await vars(page)).radioplaying === 0);

// 7. Ответ автора 4б: после Esc полный экран кликом не возвращается
const before = await page.evaluate(() => window.__fullscreenCalls);
await page.mouse.click(50, 50);
await page.waitForTimeout(300);
check('клик в игре не включает полный экран повторно', (await page.evaluate(() => window.__fullscreenCalls)) === before);
await page.close();

// 8. «Тестировать» — без автокопии
page = await open('test.html');
await start(page);
await page.waitForTimeout(500);
check('«Тестировать»: автокопия не пишется', (await copy(page, 'test.html')) === null);
await page.close();

// 9. Защита, эффекты, звук запуска
page = await open('prot.html');
const before9 = requested.length;
await start(page);
check('звук запуска запрошен', requested.slice(before9).includes('/media/audio/startscreentape.mp3'));
const menu = await page.evaluate(() => {
	const ev = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
	document.body.dispatchEvent(ev);
	return ev.defaultPrevented;
});
check('правая кнопка мыши заблокирована', menu);
const zoom = await page.evaluate(() => {
	const ev = new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100});
	document.body.dispatchEvent(ev);
	return ev.defaultPrevented;
});
check('Ctrl+колесо заблокировано', zoom);
check('выделение текста запрещено', (await page.evaluate(() => getComputedStyle(document.body).userSelect)) === 'none');
await page.waitForTimeout(2300);
check('курсор скрыт после простоя', await page.evaluate(() => document.documentElement.classList.contains('sg-cursor-hidden')));
await page.mouse.move(400, 400);
check('курсор вернулся при движении', !(await page.evaluate(() => document.documentElement.classList.contains('sg-cursor-hidden'))));
const fx = await page.evaluate(() => [getComputedStyle(document.body, '::before').backgroundImage, getComputedStyle(document.body, '::after').opacity]);
check('строки развёртки и затемнение углов', fx[0].includes('repeating-linear-gradient') && fx[0].includes('radial-gradient'));
check('шум', fx[1] === '0.2', fx[1]);
check('клик проходит сквозь эффекты', await page.evaluate(() => getComputedStyle(document.body, '::before').pointerEvents === 'none'));
await page.click('#passages a[data-passage="radio"]');
await page.waitForTimeout(500);
check('ссылки работают поверх эффектов', (await passage(page)) === 'radio');
await page.close();

check('нет ошибок JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(failed ? `\nНе прошло: ${failed} из ${results.length}` : `\nВсе ${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
