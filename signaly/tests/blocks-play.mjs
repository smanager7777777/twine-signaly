// Проверка блоков экрана (шаг 1.4) в Chromium: картинка, видео, окно-сообщение,
// поле кода, экран тревоги (щелчок, мастер Shift+Z+X), окно KR2 со статусами.
// С сессии 6: кнопка на экране <<sg-place>>, условия статусов KR2, эффекты
// текста (печать: щелчок и повторный вход, появление по очереди, смена,
// мигание, глитч).
// С сессии 7: «после эффектов выше», начало глитча и мигания, ссылка и глитч
// в печатающемся тексте, глитч на ссылке.
// node blocks-play.mjs <история.twee с движком v5> <папка с media> <playwright>
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
<<if $flight>>Журнал полёта: найден<br><</if>>\\
<<if $chapter is 2>>Глава 2<br><</if>>\\
<<sg-dialog "Подробно" title "Реактор" passage "showPSGinfo">><</sg-dialog>><</kr2vars>>
<<kr2main>>
Текст комнаты.
<</kr2main>>

[[Start]]

:: SGPlace {"position":"0,0","size":"100,100"}
Текст<<sg-place kind amber corner tr x 5 y 20>><<link "РАД2">><<set $placeClicked to 1>><</link>><</sg-place>>\\
<<sg-place corner bl x 10 y 30>><<button "Низ">><</button>><</sg-place>>

:: SGType {"position":"0,0","size":"100,100"}
<<type 60ms>>Длинный текст для печати по буквам, долго<</type>>

:: SGLines {"position":"0,0","size":"100,100"}
<<timed 0.3s>>Строка 1
<<next>>Строка 2
<<next 0.6s>>Строка 3<</timed>>

:: SGSwap {"position":"0,0","size":"100,100"}
<span id="sg-swap1">Старый</span><<timed 0.3s>><<replace "#sg-swap1">>Новый<</replace>><</timed>>

:: SGEffects {"position":"0,0","size":"100,100"}
<span class="sg-blink" style="animation-duration: 0.5s">Мигаю</span>
<span class="glitchy" data-text="КУПИ">Мысль</span>

:: SGAfter {"position":"0,0","size":"100,100"}
<span id="sg-swap1"><<type 30ms start 0s>>Печатаю текст<</type>></span><<timed 0s after>><<replace "#sg-swap1">>Сменился<</replace>><</timed>>
<<timed 0.3s>>Появился<</timed>><<type 20ms start 0s after>>Потом печать<</type>>
<span class="glitchy" data-text="Г" data-sg-after="1">Глитч</span> <span class="sg-blink" data-sg-start="0.3s">Мигну</span>

:: SGTypeLink {"position":"0,0","size":"100,100"}
<<type 60ms start 0s>>Нажми [[Сюда длинная ссылка|Start]] и ещё текст после<</type>>

:: SGTypeGlitch {"position":"0,0","size":"100,100"}
<<type 60ms start 0s>><span class="glitchy" data-text="ПОДМЕННЫЙ ТЕКСТ">Настоящий текст</span><</type>>

:: SGGlitchLink {"position":"0,0","size":"100,100"}
<span class="glitchy" data-text="Перейти">[[Перейти|Start]]</span>
`;

const twee = fs.readFileSync(tweePath, 'utf8').replace(/\s*$/, '\n') + extra;
const tweeOut = path.join(gameDir, 'blocks.twee');

fs.writeFileSync(tweeOut, twee);
// NODEBUG=1 — без режима «Тестировать».
execFileSync('node', [path.join(here, 'publish-twee.mjs'), tweeOut, path.join(gameDir, 'blocks.html'), ...(process.env.NODEBUG ? [] : ['debug']), 'start=SGBlocks']);

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
check('видео: кнопки «Воспроизвести/Остановить»', /^BR:,(BUTTON|SPAN):Воспроизвести,W?BR:/.test(video.next) && (await page.getByRole('button', {name: 'Воспроизвести', exact: true}).count()) === 1, video.next);
await page.getByRole('button', {name: 'Остановить', exact: true}).click();
check('видео: «Остановить» ставит на паузу', await page.$eval('.passage video', v => v.paused));

/* Окно-сообщение «только кнопкой» */
await page.getByText('Открыть', {exact: true}).click();
await page.waitForTimeout(300);
check('окно: открылось с заголовком и текстом', (await dialogOpen()) && (await page.textContent('#ui-dialog-title')) === 'Т' && (await page.textContent('#ui-dialog-body')).startsWith('Привет мир'));
check('окно: крестик скрыт', !(await page.isVisible('#ui-dialog-close')));
await page.mouse.click(30, 30);
await page.waitForTimeout(300);
check('окно: щелчок мимо не закрывает', await dialogOpen());
await page.getByRole('button', {name: 'Принято', exact: true}).click();
await page.waitForTimeout(300);
check('окно: «Принято» закрывает', !(await dialogOpen()));
check('окно: крестик снова виден у других окон', (await page.evaluate(() => document.documentElement.getAttribute('data-sg-dialog'))) === null);

/* Окно из пассажа, само закрывается */
await page.getByRole('button', {name: 'Пассаж', exact: true}).click();
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
await page.getByRole('button', {name: 'Ок', exact: true}).click();
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

/* Статусы KR2 с условием (сессия 6) */
const kr2Text = () => page.evaluate(() => document.getElementById('kr2-vars').innerText);
await go('SGKr2');
let vars = await kr2Text();
check('KR2: строки с условием скрыты без пустых строк', !vars.includes('Журнал') && !vars.includes('Глава') && /Реактор: 100\s*\nПодробно/.test(vars), JSON.stringify(vars));
await page.evaluate(() => {
	SugarCube.State.variables.flight = true;
	SugarCube.State.variables.chapter = 2;
});
await go('SGKr2');
vars = await kr2Text();
check('KR2: строки с условием видны, когда переменная включена и равна', /Реактор: 100\s*\nЖурнал полёта: найден\s*\nГлава 2\s*\nПодробно/.test(vars), JSON.stringify(vars));

/* Кнопка на экране (сессия 6) */
await go('SGPlace');
const places = await page.$$eval('.sg-place', els =>
	els.map(e => {
		const r = e.getBoundingClientRect();
		const a = e.querySelector('a, button');
		return {pos: getComputedStyle(e).position, cls: e.className, left: r.left, right: r.right, top: r.top, bottom: r.bottom, color: getComputedStyle(a).color};
	})
);
check('кнопка на экране: от правого верхнего угла окна, вид «Янтарный»', places[0].pos === 'fixed' && Math.abs(places[0].right - 1480) < 1 && Math.abs(places[0].top - 35) < 1 && places[0].cls === 'sg-place amber' && places[0].color === 'rgb(255, 191, 0)', JSON.stringify(places[0]));
check('кнопка на экране: от левого нижнего угла', Math.abs(places[1].left - 445) < 1 && Math.abs(places[1].bottom - 1035) < 1, JSON.stringify(places[1]));
await page.locator('.sg-place a').first().click();
await page.waitForTimeout(200);
check('кнопка на экране: нажимается', (await page.evaluate(() => SugarCube.State.variables.placeClicked)) === 1);

/* Печать: щелчок допечатывает, повторный вход — сразу весь текст */
const full = 'Длинный текст для печати по буквам, долго';
const typed = () => page.evaluate(() => document.querySelector('.macro-type')?.textContent ?? '');
await go('SGType');
await page.waitForTimeout(300);
const partial = await typed();
check('печать: печатает по буквам', partial.length > 0 && partial.length < full.length, JSON.stringify(partial));
await page.mouse.click(700, 700);
await page.waitForTimeout(150);
check('печать: щелчок допечатывает сразу', (await typed()) === full, JSON.stringify(await typed()));
await go('Start');
await page.evaluate(() => SugarCube.Engine.play('SGType'));
await page.waitForTimeout(80);
check('печать: на уже виденном экране — сразу весь текст', (await typed()) === full, JSON.stringify(await typed()));

/* Появление по очереди и смена текста */
const passageText = () => page.evaluate(() => document.querySelector('.passage').innerText);
await page.evaluate(() => SugarCube.Engine.play('SGLines'));
await page.waitForTimeout(450);
const t1 = await passageText();
await page.waitForTimeout(450);
const t2 = await passageText();
await page.waitForTimeout(700);
const t3 = await passageText();
check('появление по очереди', t1.includes('Строка 1') && !t1.includes('Строка 2') && t2.includes('Строка 2') && !t2.includes('Строка 3') && t3.includes('Строка 3'), JSON.stringify([t1, t2, t3]));
await page.evaluate(() => SugarCube.Engine.play('SGSwap'));
await page.waitForTimeout(100);
const s1 = await passageText();
await page.waitForTimeout(500);
const s2 = await passageText();
check('смена текста через N секунд', s1.includes('Старый') && s2.includes('Новый') && !s2.includes('Старый'), JSON.stringify([s1, s2]));

/* Мигание и глитч */
await go('SGEffects');
const fx = await page.evaluate(() => {
	const blink = getComputedStyle(document.querySelector('.sg-blink'));
	const glitch = document.querySelector('.glitchy');
	const after = getComputedStyle(glitch, '::after');
	const before = getComputedStyle(glitch, '::before');
	return {blink: blink.animationName, period: blink.animationDuration, content: after.content, left: after.left, shadow: before.textShadow, anim: after.animationName};
});
check('мигание: анимация и период', fx.blink === 'sg-text-blink' && fx.period === '0.5s', JSON.stringify(fx));
check('глитч: подменный текст, сдвиг, тени из оформления', fx.content === '"КУПИ"' && fx.left === '-5px' && fx.shadow.startsWith('rgb(0, 0, 255)') && fx.anim === 'sg-glitch-1', JSON.stringify(fx));
check('эффекты: без ошибок SugarCube', (await sugarErrors()).length === 0, (await sugarErrors()).join(' | '));

/* Сессия 7: «после эффектов выше», начало глитча и мигания */
await page.evaluate(() => {
	window.sgLog = [];
	const tick = () => {
		const el = document.getElementById('sg-swap1');
		if (el) window.sgLog.push(el.textContent);
		if (window.sgLog.length < 400) requestAnimationFrame(tick);
	};
	SugarCube.Engine.play('SGAfter');
	requestAnimationFrame(tick);
});
await page.waitForTimeout(150);
const a1 = await page.evaluate(() => ({
	text: document.querySelector('.passage').innerText,
	glitchOff: document.querySelector('.glitchy').classList.contains('sg-off'),
	blinkOff: document.querySelector('.passage .sg-blink').classList.contains('sg-off'),
	glitchContent: getComputedStyle(document.querySelector('.glitchy'), '::before').content
}));
await page.waitForTimeout(1300);
const a2 = await page.evaluate(() => ({
	text: document.querySelector('.passage').innerText,
	glitchOff: document.querySelector('.glitchy').classList.contains('sg-off'),
	blinkOff: document.querySelector('.passage .sg-blink').classList.contains('sg-off'),
	log: window.sgLog
}));
const beforeSwap = a2.log.filter(t => t !== 'Сменился').pop();
check('после печати: смена — только когда допечатано (без счёта секунд)', !a1.text.includes('Сменился') && a2.text.includes('Сменился') && beforeSwap === 'Печатаю текст', JSON.stringify([a1.text, beforeSwap]));
check('после эффектов выше: печать ждёт появление и смену', !a1.text.includes('Потом') && a2.text.includes('Потом печать'), JSON.stringify(a1.text));
check('глитч «после эффектов выше»: до этого — обычный текст', a1.glitchOff && a1.glitchContent === 'none' && !a2.glitchOff, JSON.stringify([a1.glitchOff, a1.glitchContent, a2.glitchOff]));
check('мигание через N секунд', a1.blinkOff && !a2.blinkOff);
await go('Start');
await page.evaluate(() => SugarCube.Engine.play('SGAfter'));
await page.waitForTimeout(120);
const a3 = await passageText();
await page.waitForTimeout(400);
const a4 = await passageText();
check('после эффектов выше: на виденном экране печать сразу, появление — в свой срок', a3.includes('Сменился') && !a3.includes('Появился') && a4.includes('Появился') && a4.includes('Потом печать'), JSON.stringify([a3, a4]));

/* Ссылка в печатающемся тексте */
await page.evaluate(() => SugarCube.Engine.play('SGTypeLink'));
await page.waitForTimeout(1000);
const l1 = await page.evaluate(() => {
	const a = document.querySelector('.passage a');
	return a && {wait: a.classList.contains('sg-type-wait'), pe: getComputedStyle(a).pointerEvents, text: a.textContent};
});
await page.waitForTimeout(900);
const l2 = await page.evaluate(() => {
	const a = document.querySelector('.passage a');
	return {wait: a.classList.contains('sg-type-wait'), pe: getComputedStyle(a).pointerEvents, text: a.textContent, typing: !!document.querySelector('.macro-type:not(.macro-type-done)')};
});
check('ссылка в печати: пока печатается — не нажимается', !!l1 && l1.wait && l1.pe === 'none' && l1.text.length < 19, JSON.stringify(l1));
check('ссылка в печати: допечатана — нажимается, текст ещё печатается', !l2.wait && l2.pe === 'auto' && l2.text === 'Сюда длинная ссылка' && l2.typing, JSON.stringify(l2));
await page.click('.passage a');
await page.waitForTimeout(200);
check('ссылка в печати: переход', (await page.evaluate(() => SugarCube.State.passage)) === 'Start');

/* Глитч в печатающемся тексте и глитч на ссылке */
await page.evaluate(() => SugarCube.Engine.play('SGTypeGlitch'));
await page.waitForTimeout(500);
const g1 = await page.evaluate(() => {
	const g = document.querySelector('.glitchy');
	return {shadow: g.getAttribute('data-text'), text: g.textContent};
});
await page.mouse.click(700, 900);
await page.waitForTimeout(300);
const g2 = await page.evaluate(() => {
	const g = document.querySelector('.glitchy');
	return {shadow: g.getAttribute('data-text'), keep: g.getAttribute('data-sg-text')};
});
check('глитч печатается вместе с текстом', g1.text.length > 0 && g1.text.length < 15 && g1.shadow === 'ПОДМЕННЫЙ ТЕКСТ'.slice(0, g1.text.length), JSON.stringify(g1));
check('глитч после печати — весь подменный текст', g2.shadow === 'ПОДМЕННЫЙ ТЕКСТ' && g2.keep === null, JSON.stringify(g2));
await go('SGGlitchLink');
const gl = await page.evaluate(() => {
	const a = document.querySelector('.glitchy a');
	const r = a.getBoundingClientRect();
	const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
	return {hit: hit === a || a.contains(hit), pe: getComputedStyle(document.querySelector('.glitchy'), '::before').pointerEvents};
});
check('глитч на ссылке: ссылка нажимается сквозь «тени»', gl.hit && gl.pe === 'none', JSON.stringify(gl));
await page.click('.glitchy a');
await page.waitForTimeout(200);
check('глитч на ссылке: переход', (await page.evaluate(() => SugarCube.State.passage)) === 'Start');
check('эффекты сессии 7: без ошибок SugarCube', (await sugarErrors()).length === 0, (await sugarErrors()).join(' | '));

check('ошибок страницы нет', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
