// Проверка блоков экрана (шаг 1.4) в Chromium: картинка, видео, окно-сообщение,
// поле кода, экран тревоги (щелчок, мастер Shift+Z+X), окно KR2 со статусами.
// node blocks-play.mjs <история.twee с движком v3> <папка с media> <playwright>
// Скрипт добавляет к истории проверочные пассажи, публикует test.html в папку
// и проверяет. Ошибки SugarCube и страницы — провал.
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

:: SGBlocks {"position":"0,0","size":"100,100"}
Картинка <<sg-image "media/img/radio.jpg" width 200 border 3 color "#ff0000" glow 5>>
<<sg-image "media/img/radio.jpg" width 150 place screen corner tr x 10 y 20>>
<<sg-image "media/img/radio.jpg" width 100 place center>>
<<sg-video "media/video/fullvideo.mp4" width 300 height 200 controls loop muted buttons>>
<<sg-dialog "Открыть" title "Т" close ok>>Привет ''мир''<</sg-dialog>>
<<sg-dialog "Пассаж" title "П" passage "showPSGinfo" button close time seconds 1>><</sg-dialog>>
<<sg-code button "Ок" gap 0 var "$inputCode">>
<<sg-case "1" goto "Start">>
<<sg-case "2" title "Два">>Код _code
<<sg-wrong title "Ошибка">>Неверно: _code
<</sg-code>>

:: SGAlarm {"position":"0,0","size":"100,100"}
<<sg-alarm bg "#cc0000" color "#000000" size 50 blink 1 close click goto "Start">>ТРЕВОГА<</sg-alarm>>

:: SGAlarmMaster {"position":"0,0","size":"100,100"}
<<sg-alarm bg "#0000cc" close master goto "Start">>ТРЕВОГА<</sg-alarm>>
<<sg-alarm bg "#00cc00" close time seconds 1>>ПОВЕРХ<</sg-alarm>>

:: SGKr2 [kr2] {"position":"0,0","size":"100,100"}
<<kr2image "media/img/radio.jpg">>
<<kr2layout 50 40>>
<<kr2vars>>Реактор: $health
<<sg-dialog "Подробно" title "Реактор" passage "showPSGinfo">><</sg-dialog>><</kr2vars>>
<<kr2main>>
Текст комнаты.
<</kr2main>>

[[Start]]
`;

const twee = fs.readFileSync(tweePath, 'utf8').replace(/\s*$/, '\n') + extra;
const tweeOut = path.join(gameDir, 'blocks.twee');

fs.writeFileSync(tweeOut, twee);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), tweeOut, path.join(gameDir, 'blocks.html'), 'debug', 'start=SGBlocks']);

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

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(base + 'blocks.html');
await page.waitForSelector('#sg-start');
await page.click('#sg-start');
await page.waitForSelector('.passage');
await page.waitForTimeout(500);

const go = async name => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(400);
};
const sugarErrors = () => page.$$eval('.error-view, .error', els => els.map(e => e.textContent));
const dialogOpen = () => page.evaluate(() => SugarCube.Dialog.isOpen());

/* Картинки */
const imgs = await page.$$eval('.passage img', els =>
	els.map(e => {
		const r = e.getBoundingClientRect();
		const s = getComputedStyle(e);
		return {w: r.width, right: r.right, top: r.top, pos: s.position, border: s.borderTopWidth, shadow: s.boxShadow, parentAlign: getComputedStyle(e.parentElement).textAlign};
	})
);
check('картинки: три штуки', imgs.length === 3, JSON.stringify(imgs.map(i => i.w)));
check('картинка: ширина, рамка, свечение', imgs[0].w === 206 && imgs[0].border === '3px' && /rgb\(255, 0, 0\) 0px 0px 5px/.test(imgs[0].shadow), `${imgs[0].w} ${imgs[0].border} ${imgs[0].shadow}`);
// Окно терминала 1050×1050 по центру 1920×1080: правый край 1485, верх 15.
check('картинка на экране: от правого верхнего угла окна', imgs[1].pos === 'fixed' && Math.abs(imgs[1].right - 1475) < 1 && Math.abs(imgs[1].top - 35) < 1, `${imgs[1].right} ${imgs[1].top}`);
check('картинка по центру', imgs[2].parentAlign === 'center');

/* Видео */
const video = await page.$eval('.passage video', v => ({w: v.getAttribute('width'), h: v.getAttribute('height'), loop: v.loop, muted: v.muted, controls: v.controls, src: v.querySelector('source').getAttribute('src'), next: [...v.parentElement.children].slice([...v.parentElement.children].indexOf(v) + 1, [...v.parentElement.children].indexOf(v) + 4).map(e => e.tagName + ':' + e.textContent).join(',')}));
check('видео: размер и галочки', video.w === '300' && video.h === '200' && video.loop && video.muted && video.controls && video.src === 'media/video/fullvideo.mp4', JSON.stringify(video));
check('видео: кнопки «Воспроизвести/Остановить»', /^BR:,(BUTTON|SPAN):Воспроизвести,W?BR:/.test(video.next) && (await page.getByRole('button', {name: 'Воспроизвести'}).count()) === 1, video.next);
await page.getByRole('button', {name: 'Остановить'}).click();
check('видео: «Остановить» ставит на паузу', await page.$eval('.passage video', v => v.paused));

/* Окно-сообщение «только кнопкой» */
await page.getByText('Открыть', {exact: true}).click();
await page.waitForTimeout(300);
check('окно: открылось с заголовком и текстом', (await dialogOpen()) && (await page.textContent('#ui-dialog-title')) === 'Т' && (await page.textContent('#ui-dialog-body')).startsWith('Привет мир'));
check('окно: крестик скрыт', !(await page.isVisible('#ui-dialog-close')));
await page.mouse.click(30, 30);
await page.waitForTimeout(300);
check('окно: щелчок мимо не закрывает', await dialogOpen());
await page.getByRole('button', {name: 'Принято'}).click();
await page.waitForTimeout(300);
check('окно: «Принято» закрывает', !(await dialogOpen()));
check('окно: крестик снова виден у других окон', (await page.evaluate(() => document.documentElement.getAttribute('data-sg-dialog'))) === null);

/* Окно из пассажа, само закрывается */
await page.getByRole('button', {name: 'Пассаж'}).click();
await page.waitForTimeout(300);
const fromPassage = await page.textContent('#ui-dialog-body');
check('окно из пассажа', (await dialogOpen()) && fromPassage.trim().length > 0, fromPassage.trim().slice(0, 40));
await page.waitForTimeout(1200);
check('окно: закрылось само через 1 с', !(await dialogOpen()));

/* Поле кода */
const field = page.locator('input.sg-code');
await field.fill('2');
await field.press('Enter');
await page.waitForTimeout(300);
check('поле кода: Enter, код из таблицы → окно', (await page.textContent('#ui-dialog-title')) === 'Два' && (await page.textContent('#ui-dialog-body')).trim() === 'Код 2');
await page.evaluate(() => SugarCube.Dialog.close());
await field.fill('x');
await page.getByRole('button', {name: 'Ок'}).click();
await page.waitForTimeout(300);
check('поле кода: кнопка, неверный код → сообщение', (await page.textContent('#ui-dialog-body')).trim() === 'Неверно: x');
check('поле кода: значение в переменной', (await page.evaluate(() => SugarCube.State.variables.inputCode)) === 'x');
await page.evaluate(() => SugarCube.Dialog.close());
await field.fill('1');
await field.press('Enter');
await page.waitForTimeout(400);
check('поле кода: код → переход на экран', (await page.evaluate(() => SugarCube.State.passage)) === 'Start');
check('блоки: без ошибок SugarCube', (await sugarErrors()).length === 0, (await sugarErrors()).join(' | '));

/* Экран тревоги */
await go('SGAlarm');
const alarm = await page.$eval('.sg-alarm', e => {
	const r = e.getBoundingClientRect();
	const s = getComputedStyle(e);
	return {w: r.width, h: r.height, bg: s.backgroundColor, size: s.fontSize, anim: s.animationName, z: s.zIndex};
});
check('тревога: весь экран, цвет, размер, мигание', alarm.w === 1920 && alarm.h === 1080 && alarm.bg === 'rgb(204, 0, 0)' && alarm.size === '50px' && alarm.anim === 'sg-alarm-blink', JSON.stringify(alarm));
await page.mouse.click(960, 540);
await page.waitForTimeout(400);
check('тревога: щелчок закрывает и переходит на экран', (await page.evaluate(() => SugarCube.State.passage)) === 'Start');

await go('SGAlarmMaster');
check('тревога: две поверх друг друга', (await page.$$('.sg-alarm')).length === 2);
await page.waitForTimeout(1300);
check('тревога: верхняя закрылась сама через 1 с', (await page.$$('.sg-alarm')).length === 1);
await page.mouse.click(960, 540);
await page.waitForTimeout(300);
check('тревога «только мастер»: щелчок не закрывает', (await page.$$('.sg-alarm')).length === 1);
await page.keyboard.down('Shift');
await page.keyboard.down('KeyZ');
await page.keyboard.press('KeyX');
await page.keyboard.up('KeyZ');
await page.keyboard.up('Shift');
await page.waitForTimeout(400);
check('тревога: Shift+Z+X закрывает и переходит', (await page.$$('.sg-alarm')).length === 0 && (await page.evaluate(() => SugarCube.State.passage)) === 'Start');

/* KR2 */
await go('SGKr2');
const kr2 = await page.evaluate(() => {
	const p = document.getElementById('passages');
	const s = getComputedStyle(p);
	return {
		cls: p.classList.contains('kr2-layout'),
		cols: s.gridTemplateColumns,
		rows: s.gridTemplateRows,
		main: document.getElementById('kr2-main')?.textContent.trim(),
		nav: document.getElementById('kr2-nav')?.textContent.trim(),
		vars: document.getElementById('kr2-vars')?.textContent.trim(),
		img: !!document.querySelector('#kr2-image img')
	};
});
check('KR2: зоны и доли 50/40', kr2.cls && kr2.main === 'Текст комнаты.' && kr2.nav === 'Start' && kr2.img && /^5\d\d(\.\d+)?px 5\d\d/.test(kr2.cols), JSON.stringify(kr2));
check('KR2: статусы с переменной', kr2.vars.startsWith('Реактор: 100'), kr2.vars);
await page.locator('#kr2-vars a').click();
await page.waitForTimeout(300);
check('KR2: ссылка в статусах открывает окно', (await dialogOpen()) && (await page.textContent('#ui-dialog-title')) === 'Реактор');
await page.evaluate(() => SugarCube.Dialog.close());
await page.click('#kr2-image');
await page.waitForTimeout(200);
check('KR2: картинка разворачивается', (await page.$$('#kr2-overlay')).length === 1);
await page.click('#kr2-overlay');
await page.locator('#kr2-nav a').click();
await page.waitForTimeout(400);
check('KR2: ссылка навигации, вид KR2 снят', (await page.evaluate(() => SugarCube.State.passage)) === 'Start' && !(await page.evaluate(() => document.getElementById('passages').classList.contains('kr2-layout'))) && (await page.evaluate(() => document.getElementById('passages').style.gridTemplateColumns)) === '');

await go('Космические рейнджеры');
check('KR2 шаблона: без ошибок', (await sugarErrors()).length === 0 && (await page.textContent('#kr2-vars')).includes('100'));

check('ошибок страницы нет', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
