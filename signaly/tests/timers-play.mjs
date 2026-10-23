// Проверка таймеров и цепочки видео (шаг 2.3) в Chromium: табло (вид, отсчёт,
// формат), таймер в фоне и на нескольких экранах, «уже идёт», скрытый таймер,
// окно-сообщение по окончании, продолжение после сбоя (автокопия), цепочки
// видео шаблона (щелчок / окончание / переход) и «через N секунд».
// node timers-play.mjs <история.twee с движком 6> <папка с media> <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [tweePath, gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

const extra = `

:: SGTimerHMS {"position":"0,0","size":"100,100"}
<<sg-timer "T2" hours 1 minutes 2 seconds 3 format hms color "#00ff00" size 40 border 0 glow 0 font none>>

:: SGTimerDlg {"position":"0,0","size":"100,100"}
<<sg-timer "T3" seconds 1 title "Конец" text "Время ''вышло''">>

:: SGTimerShow {"position":"0,0","size":"100,100"}
<<sg-timer "T3" start running>>

:: SGChainTime {"position":"0,0","size":"100,100"}
<<sg-chain width 200 height 100 place screen corner tl x 10 y 10 border 2 color "#ff0000">>
<<sg-step "media/video/SHUTTERS.mp4" next time seconds 0.5>>
<<sg-step "media/video/DESERT_RAIN.mp4" next click>>
<</sg-chain>>
`;

const twee = fs.readFileSync(tweePath, 'utf8').replace(/\s*$/, '\n') + extra;
const tweeOut = path.join(gameDir, 'timers.twee');

fs.writeFileSync(tweeOut, twee);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), tweeOut, path.join(gameDir, 'timers-test.html'), 'debug']);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), tweeOut, path.join(gameDir, 'timers-game.html')]);

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

async function open(file) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(e.message));
	await page.goto(base + file);
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(300);
	return page;
}

let page = await open('timers-test.html');
const go = async (name, wait = 300) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const passage = () => page.evaluate(() => SugarCube.State.passage);
const board = () =>
	page.evaluate(() => {
		const el = document.querySelector('.sg-timer');

		if (!el) return null;
		const s = getComputedStyle(el);
		return {text: el.textContent, font: s.fontFamily, size: s.fontSize, color: s.color, border: s.borderTopWidth, shadow: s.boxShadow, display: s.display};
	});
const sugarErrors = () => page.$$eval('.error-view, .error', els => els.map(e => e.textContent));

/* Таймер шаблона: Clocktest5 → Clocks → в фоне → Start */
await go('Clocks');
check('Clocks без идущего таймера — табло нет', (await board()) === null);
await go('Clocktest5', 100);
let b = await board();
check('Clocktest5: табло 00:05', b && b.text === '00:05', JSON.stringify(b));
check('табло как #timer-display (DSEG7, 125px, красный, рамка 2px, свечение)',
	b && /sg-timer-font/.test(b.font) && b.size === '125px' && b.color === 'rgb(204, 0, 0)' && b.border === '2px' && /204, 0, 0/.test(b.shadow) && b.display === 'flex', JSON.stringify(b));
await page.waitForTimeout(1300);
b = await board();
check('отсчёт идёт', b && (b.text === '00:04' || b.text === '00:03'), b && b.text);
await page.click('.passage a[data-passage="Clocks"]');
await page.waitForTimeout(300);
b = await board();
check('на Clocks — табло того же таймера', (await passage()) === 'Clocks' && b && /^00:0[1-4]$/.test(b.text), b && b.text);
await go('Texttests');
check('ушли с экрана — табло нет, таймер идёт', (await board()) === null && (await page.evaluate(() => !!SugarCube.State.variables.sgTimers.Clocks)));
await page.waitForFunction(() => SugarCube.State.passage === 'Start', null, {timeout: 6000}).catch(() => {});
check('время вышло — переход на Start с другого экрана', (await passage()) === 'Start');
check('таймер закончился и убран', await page.evaluate(() => !SugarCube.State.variables.sgTimers.Clocks));
await go('Clocks');
check('после окончания на Clocks табло нет', (await board()) === null);

/* Скрытый таймер TERRAFORM_FAIL */
await go('TERRAFORM_FAIL');
const hidden = await page.evaluate(() => {
	const t = SugarCube.State.variables.sgTimers.TERRAFORM_FAIL;
	return {board: !!document.querySelector('.sg-timer'), left: t ? t.end - Date.now() : null, goto: t && t.goto};
});
check('TERRAFORM_FAIL: табло не видно, 30 с, переход на TERRAFORM', !hidden.board && hidden.left > 28000 && hidden.left <= 30000 && hidden.goto === 'TERRAFORM', JSON.stringify(hidden));
await page.evaluate(() => {
	SugarCube.State.variables.sgTimers.TERRAFORM_FAIL.end = Date.now() + 300;
});
await page.waitForTimeout(900);
check('скрытый таймер переводит на TERRAFORM', (await passage()) === 'TERRAFORM');

/* Формат ЧЧ:ММ:СС, свой вид */
await go('SGTimerHMS', 100);
b = await board();
check('ЧЧ:ММ:СС, свой цвет и размер, шрифт терминала, без рамки и свечения',
	b && b.text === '01:02:03' && b.color === 'rgb(0, 255, 0)' && b.size === '40px' && !/sg-timer-font/.test(b.font) && b.border === '0px' && b.shadow === 'none', JSON.stringify(b));

/* Окно-сообщение по окончании, табло «уже идёт» на другом экране */
await go('SGTimerDlg', 100);
await go('SGTimerShow', 100);
b = await board();
check('«уже идёт» — табло таймера с другого экрана', b && b.text === '00:01', b && b.text);
await page.waitForTimeout(1300);
const dlg = await page.evaluate(() => ({open: SugarCube.Dialog.isOpen(), title: document.querySelector('#ui-dialog-title')?.textContent, body: document.querySelector('#ui-dialog-body')?.innerHTML}));
check('по окончании — окно-сообщение, экран тот же', dlg.open && dlg.title === 'Конец' && /<strong>вышло<\/strong>/.test(dlg.body) && (await passage()) === 'SGTimerShow', JSON.stringify(dlg));
await page.evaluate(() => SugarCube.Dialog.close());

/* Цепочка видео WINDOWDESSERT */
await go('WINDOWDESSERT', 500);
const state = () =>
	page.evaluate(() => [...document.querySelectorAll('.sg-chain video')].map(v => (v.style.display === 'none' ? 0 : 1)).join(''));
const videos = await page.evaluate(() =>
	[...document.querySelectorAll('.sg-chain video')].map(v => ({src: v.querySelector('source').getAttribute('src'), loop: v.loop, muted: v.muted, preload: v.getAttribute('preload'), w: v.getAttribute('width'), h: v.getAttribute('height'), paused: v.paused}))
);
check('цепочка: 4 видео, файлы, повтор, без звука, размер',
	videos.length === 4 && videos[0].src === 'media/video/SHUTTERS.mp4' && videos[0].loop && videos[0].muted && !videos[1].loop && !videos[1].muted && videos[2].loop && videos[3].src === 'media/video/SHUTTERS_DESSET_CLOSE_SOUND.mp4' && videos.every(v => v.w === '1000' && v.h === '1000'),
	JSON.stringify(videos));
check('следующие видео загружаются заранее (preload)', videos.slice(1).every(v => v.preload === 'auto'));
check('видно только первое, оно играет', (await state()) === '1000' && !videos[0].paused);
// Положение внутри страницы (щелчок Playwright может прокрутить терминал).
const spot = i => page.evaluate(n => {
	const v = document.querySelectorAll('.sg-chain video')[n];
	return JSON.stringify([v.offsetLeft, v.offsetTop, v.offsetWidth, v.offsetHeight]);
}, i);
const box0 = await spot(0);
await page.evaluate(() => document.querySelectorAll('.sg-chain video')[0].dispatchEvent(new Event('ended')));
check('первое (по кругу) не переключается по окончанию', (await state()) === '1000');
await page.click('.sg-chain video >> nth=0');
await page.waitForTimeout(200);
check('щелчок — второе видео, сразу', (await state()) === '0100');
const box1 = await spot(1);
check('второе — на том же месте, что первое', box0 === box1, box0 + ' / ' + box1);
await page.evaluate(() => document.querySelectorAll('.sg-chain video')[1].dispatchEvent(new Event('ended')));
check('второе закончилось — третье', (await state()) === '0010');
await page.evaluate(() => document.querySelectorAll('.sg-chain video')[2].dispatchEvent(new Event('ended')));
check('третье (по кругу) ждёт щелчка', (await state()) === '0010');
await page.click('.sg-chain video >> nth=2');
await page.waitForTimeout(200);
check('щелчок — четвёртое', (await state()) === '0001' && (await passage()) === 'WINDOWDESSERT');
await page.evaluate(() => document.querySelectorAll('.sg-chain video')[3].dispatchEvent(new Event('ended')));
await page.waitForTimeout(300);
check('четвёртое закончилось — переход на Start', (await passage()) === 'Start');

/* WINDOWSSHUTTERS: щелчок — Start */
await go('WINDOWSSHUTTERS', 400);
await page.click('.sg-chain video');
await page.waitForTimeout(300);
check('WINDOWSSHUTTERS: щелчок по видео — Start', (await passage()) === 'Start');

/* Videotest2: в рамке по центру, следующие видео — тоже по центру */
await go('Videotest2', 400);
const centered = await page.evaluate(() => {
	const vs = [...document.querySelectorAll('.sg-chain video')];
	const a = vs[0].getBoundingClientRect().left;
	vs[0].click();
	return new Promise(r => setTimeout(() => r([a, vs[1].getBoundingClientRect().left]), 100));
});
check('Videotest2: второе видео стоит там же, где первое', centered[0] === centered[1], JSON.stringify(centered));

/* Шаг «через N секунд», место на экране, остаться в конце */
await go('SGChainTime', 100);
const placed = await page.evaluate(() => {
	const box = document.querySelector('.sg-chain');
	const v = box.querySelector('video');
	return {pos: getComputedStyle(box).position, border: getComputedStyle(v).borderTopWidth};
});
check('цепочка «на экране», рамка у видео', placed.pos === 'fixed' && placed.border === '2px', JSON.stringify(placed));
check('через 0,5 с ещё первое', (await state()) === '10');
await page.waitForTimeout(700);
check('через 0,5 с — второе', (await state()) === '01');
await page.click('.sg-chain video >> nth=1');
await page.waitForTimeout(300);
check('последний шаг без перехода — остаёмся', (await passage()) === 'SGChainTime' && (await state()) === '01');
await go('SGChainTime', 100);
await go('Start', 900);
check('ушли с экрана — цепочка никуда не переводит', (await passage()) === 'Start');

check('ошибок SugarCube нет', (await sugarErrors()).length === 0, (await sugarErrors()).join(' | '));
await page.close();

/* После сбоя таймер продолжает по времени окончания (автокопия, обычная игра) */
page = await open('timers-game.html');
await page.evaluate(() => localStorage.clear());
await go('Clocktest5', 100);
const endAt = await page.evaluate(() => SugarCube.State.variables.sgTimers.Clocks.end);
const copied = await page.evaluate(() => {
	const key = Object.keys(localStorage).find(k => k.startsWith('СИГНАЛЫ/автокопия/'));
	return key && JSON.parse(localStorage.getItem(key)).timers;
});
check('таймер записан в автокопию', copied && copied.Clocks && copied.Clocks.end === endAt, JSON.stringify(copied));
await page.waitForTimeout(2200);
await page.reload();
await page.waitForSelector('#sg-start');
await page.click('#sg-start');
await page.waitForSelector('.passage');
await page.waitForTimeout(200);
b = await board();
check('после сбоя — тот же экран, отсчёт продолжается (не с 00:05)', (await passage()) === 'Clocktest5' && b && /^00:0[1-3]$/.test(b.text), b && b.text);
check('время окончания то же', (await page.evaluate(() => SugarCube.State.variables.sgTimers.Clocks.end)) === endAt);
await page.waitForFunction(() => SugarCube.State.passage === 'Start', null, {timeout: 5000}).catch(() => {});
const late = Date.now() - endAt;
check('после сбоя таймер заканчивается вовремя — переход на Start', (await passage()) === 'Start' && late < 1500, `опоздание ${late} мс`);
await go('Clocktest5', 100);
b = await board();
check('новый вход на экран — таймер начинается заново', b && b.text === '00:05', b && b.text);
await page.close();

check('ошибок страницы нет', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
