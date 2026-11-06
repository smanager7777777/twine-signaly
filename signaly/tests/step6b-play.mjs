// Проверка этапа 6, порция 2, в Chromium: блок «Значение» обновляется сам,
// «Запомнить открытое» у раскрытия, русские служебные надписи SugarCube.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node step6b-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, `$1<<set $v1 to 1>>
<<set $vflag to false>>
<<set $vtext to "альфа">>
`)
		.replace(/(:: Горячие клавиши[^\n]*\n)/, `$1<<sg-key "Shift+Z+D" "Плюс глава">><<set $v1 += 1>><</sg-key>>
`)
		.replace(/\s*$/, '\n') +
	`
:: VHome {"position":"100,9000","size":"100,100"}
Домашний экран

:: VArchive {"position":"200,9000","size":"100,100"}
<span class="sg-value">Глава: <<= $v1>> из 5</span>
<span class="sg-value">Журнал: <<= $vflag ? "найден" : "не найден">></span>
<span class="sg-value">Текст: <<= $vtext>></span>
<span class="sg-value">Заходов: <<= setup.visits("VHome")>></span>
<span class="sg-value" id="v-many"><<= $v1>>/<<= $v1 + 1>></span>
Без блока: <span id="v-plain"><<= $v1>></span>
<<if $v1 gt 0>><span class="sg-value">В условии: <<= $v1>></span><</if>>
<<type 5ms>><span class="sg-value">В печати: <<= $v1>></span><</type>>

:: VBad {"position":"300,9000","size":"100,100"}
<span class="sg-value">Сломано: <<= нетТакого.поля>></span>
<span class="sg-value">Живое: <<= $v1>></span>

:: VKeep {"position":"400,9000","size":"100,100"}
До. <<sg-reveal "sg-reveal1" "[РАСШИФРОВАТЬ]" kind "amber">>Секрет <span class="sg-blink">мигает</span> [[дальше|VHome]]<</sg-reveal>> После.

Вторая: <<sg-reveal "sg-reveal2" "[ССЫЛКА]" link>>Второй текст<</sg-reveal>>

Обычная: <span id="sg-reveal3"><<button "[ОБЫЧНАЯ]">><<replace "#sg-reveal3">>Третий текст<</replace>><</button>></span>

<<type 5ms>>Печать: <<sg-reveal "sg-reveal4" "[В ПЕЧАТИ]">>Четвёртый текст<</sg-reveal>><</type>>

:: VKeep2 {"position":"500,9000","size":"100,100"}
<<sg-reveal "sg-reveal1" "[ДРУГОЙ ЭКРАН]">>Текст другого экрана<</sg-reveal>>

:: VSameA {"position":"600,9000","size":"100,100"}
Текст <<sg-reveal "sg-reveal1" "[КНОПКА]" kind "amber">>Открытый текст<</sg-reveal>> дальше

:: VSameB {"position":"700,9000","size":"100,100"}
Текст <span id="sg-reveal1"><span class="amber"><<button "[КНОПКА]">><<replace "#sg-reveal1">>Открытый текст<</replace>><</button>></span></span> дальше

:: VWords {"position":"800,9000","size":"100,100"}
<<return>>

:: VOwn {"position":"900,9000","size":"100,100"}
<<sg-dialog "Открыть" title "Окно">>Текст окна<</sg-dialog>>
`;

fs.writeFileSync(path.join(gameDir, 'step6b-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'step6b-test.twee'), path.join(gameDir, 'step6b-test.html')]);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'step6b-test.twee'), path.join(gameDir, 'step6b-debug.html'), 'debug']);

// Надпись автора главнее: код автора стоит ниже движка.
const scriptEnd = test.indexOf('\n:: ', test.indexOf(':: StoryScript [script]'));
const own = test.slice(0, scriptEnd) + '\nl10nStrings.macroReturnText = "Обратно";' + test.slice(scriptEnd);

fs.writeFileSync(path.join(gameDir, 'step6b-own.twee'), own);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'step6b-own.twee'), path.join(gameDir, 'step6b-own.html')]);

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
const setVar = (page, name, value) => page.evaluate(([n, v]) => (SugarCube.State.variables[n] = v), [name, value]);
const text = page => page.locator('.passage').innerText();
const key = async (page, code) => {
	await page.keyboard.down('z');
	await page.keyboard.down('Shift');
	await page.keyboard.press(code);
	await page.keyboard.up('Shift');
	await page.keyboard.up('z');
};

async function valueChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'VArchive');

	const first = await text(page);

	say('значения на экране при входе', /Глава: 1 из 5/.test(first) && /Журнал: не найден/.test(first) && /Текст: альфа/.test(first), first);
	say('вид строки прежний: подпись, значение, «из N» в одном блоке', (await page.locator('.sg-value').first().innerText()) === 'Глава: 1 из 5');
	await setVar(page, 'v1', 2);
	await page.waitForTimeout(450);

	let now = await text(page);

	say('число поменялось без перехода', /Глава: 2 из 5/.test(now), now);
	say('та же минута, тот же экран', (await page.evaluate(() => SugarCube.State.passage)) === 'VArchive');
	say('вне блока «Значение» обычная команда не обновляется', (await page.locator('#v-plain').innerText()) === '1');
	say('внутри условия обновляется', /В условии: 2/.test(now), now);
	say('внутри печати обновляется', /В печати: 2/.test(now), now);
	say('две команды в одном блоке', (await page.locator('#v-many').innerText()) === '2/3', await page.locator('#v-many').innerText());
	await setVar(page, 'vflag', true);
	await page.waitForTimeout(450);
	say('да-нет словами', /Журнал: найден/.test(await text(page)));
	await setVar(page, 'vtext', 'бета <b>жирный</b>');
	await page.waitForTimeout(450);
	say('значение с разметкой выводится так же, как при входе', (await page.locator('.sg-value b').innerText()) === 'жирный');
	await key(page, 'KeyD');
	await page.waitForTimeout(450);
	say('клавиша мастера: значение обновилось само', /Глава: 3 из 5/.test(await text(page)), await text(page));
	await go(page, 'VHome');
	await go(page, 'VArchive');
	say('заходы на экран обновляются при входе', /Заходов: 1/.test(await text(page)), await text(page));
	await page.evaluate(() => {
		const v = SugarCube.State.variables;

		v.sgVisits.VHome = 4;
	});
	await page.waitForTimeout(450);
	say('и на открытом экране', /Заходов: 4/.test(await text(page)), await text(page));
	await go(page, 'VBad');
	say('ошибка в выражении показана как обычно', (await page.locator('.error-view, .error').count()) > 0);
	await setVar(page, 'v1', 9);
	await page.waitForTimeout(450);
	say('соседнее значение живёт', /Живое: 9/.test(await text(page)), await text(page));
	await page.context().close();
}

async function keepChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'VKeep');
	await page.waitForTimeout(600);

	let now = await text(page);

	say('до щелчка видно надписи', /РАСШИФРОВАТЬ/.test(now) && /ССЫЛКА/.test(now) && !/Секрет/.test(now), now);
	say('вид кнопки — как у обычного раскрытия', (await page.locator('#sg-reveal1 .amber button').count()) === 1);
	say('ссылкой — ссылка', (await page.locator('#sg-reveal2 a').count()) === 1);
	await page.locator('#sg-reveal1 button').click();
	await page.waitForTimeout(200);
	now = await text(page);
	say('щелчок открыл текст на месте', /До\. Секрет мигает дальше После\./.test(now), now);
	say('эффект внутри работает', (await page.locator('#sg-reveal1 .sg-blink').count()) === 1);
	say('ссылка внутри работает как ссылка', (await page.locator('#sg-reveal1 a[data-passage="VHome"]').count()) === 1);
	say('отметка записана', await page.evaluate(() => SugarCube.State.variables.sgRevealed['VKeep|sg-reveal1'] === 1));
	await page.locator('#sg-reveal3 button').click();
	await page.waitForTimeout(150);
	say('обычная без галочки тоже открылась', /Третий текст/.test(await text(page)));
	await page.locator('#sg-reveal1 a[data-passage="VHome"]').click();
	await page.waitForTimeout(300);
	await go(page, 'VKeep');
	await page.waitForTimeout(600);
	now = await text(page);
	say('вернулись: открытое открыто', /Секрет мигает/.test(now) && !/РАСШИФРОВАТЬ/.test(now), now);
	say('вернулись: неоткрытая осталась надписью', /ССЫЛКА/.test(now), now);
	say('вернулись: без галочки снова надпись', /ОБЫЧНАЯ/.test(now) && !/Третий/.test(now), now);
	await go(page, 'VKeep2');
	say('тот же номер на другом экране — своя отметка', /ДРУГОЙ ЭКРАН/.test(await text(page)), await text(page));
	await go(page, 'VKeep');
	await page.waitForTimeout(600);
	await page.locator('#sg-reveal4 button').click();
	await page.waitForTimeout(200);
	say('внутри печати открывается', /Печать: Четвёртый текст/.test(await text(page)), await text(page));
	await go(page, 'VHome');
	await go(page, 'VKeep', 700);
	say('внутри печати запомнилось', /Четвёртый текст/.test(await text(page)) && !/В ПЕЧАТИ/.test(await text(page)), await text(page));
	await page.reload();
	await page.waitForSelector('.passage, #sg-start');
	await page.waitForTimeout(900);
	if (await page.locator('#sg-start').count()) {
		await page.click('#sg-start');
		await page.waitForTimeout(900);
	}
	now = await text(page);
	say('после сбоя открытое открыто', /Секрет мигает/.test(now) && !/РАСШИФРОВАТЬ/.test(now), now);
	await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	await key(page, 'KeyN');
	await page.waitForSelector('#ui-dialog-body button.sg-new-game-yes');
	await page.click('#ui-dialog-body button.sg-new-game-yes');
	await page.waitForSelector('#sg-start');
	await start(page);
	await go(page, 'VKeep');
	await page.waitForTimeout(600);
	now = await text(page);
	say('«Новая игра»: снова надпись', /РАСШИФРОВАТЬ/.test(now) && !/Секрет/.test(now), now);
	await page.context().close();
}

async function sameChecks(url, say) {
	const page = await start(await open(url));
	const shot = () => page.screenshot({animations: 'disabled'});

	await page.mouse.move(5, 5);
	await go(page, 'VSameB');

	const plain = await shot();

	await go(page, 'VSameA');
	say('до щелчка вид совпадает с обычным раскрытием', plain.equals(await shot()));
	await page.locator('#sg-reveal1 button').click();
	await page.mouse.move(5, 5);
	await page.waitForTimeout(200);

	const kept = await shot();

	await go(page, 'VSameB');
	await page.locator('#sg-reveal1 button').click();
	await page.mouse.move(5, 5);
	await page.waitForTimeout(200);
	say('после щелчка вид совпадает', kept.equals(await shot()));
	await page.context().close();
}

async function wordChecks(url, say) {
	const page = await start(await open(url));

	say('надписи заменены', await page.evaluate(() => SugarCube.L10n.get('restartTitle') === 'Начать заново' && SugarCube.L10n.get('textOk') === 'ОК'));
	await page.evaluate(() => SugarCube.UI.restart());
	await page.waitForSelector('#ui-dialog-body');
	await page.waitForTimeout(300);

	const dialog = await page.locator('#ui-dialog').innerText();

	say('окно подтверждения по-русски', /Начать заново/.test(dialog) && /ОК/.test(dialog) && /Отмена/.test(dialog) && !/Restart|Cancel/.test(dialog), dialog);
	say('крестик окна по-русски', (await page.locator('#ui-dialog-close').getAttribute('aria-label')) === 'Закрыть');
	await page.evaluate(() => SugarCube.Dialog.close());
	await page.waitForTimeout(300);
	await go(page, 'VHome');
	await go(page, 'VWords');

	const shown = await text(page);

	say('«Вернуться»', /Вернуться/.test(shown), shown);
	await page.evaluate(() => SugarCube.Engine.play('НетТакогоЭкрана'));
	await page.waitForTimeout(300);
	say('ошибка несуществующего экрана по-русски', /пассажа «НетТакогоЭкрана» не существует/.test(await text(page)), await text(page));
	await page.context().close();
}

async function ownChecks() {
	const page = await start(await open(base + 'step6b-own.html'));

	await go(page, 'VHome');
	await go(page, 'VWords');

	const shown = await text(page);

	check('надпись автора главнее', /Обратно/.test(shown) && !/Вернуться/.test(shown), shown);
	await page.context().close();
}

async function debugChecks() {
	const page = await start(await open(base + 'step6b-debug.html'));

	await page.waitForTimeout(300);

	const bar = await page.locator('#debug-bar').innerHTML();

	check('панель режима «Тестировать» по-русски', /Наблюдение/.test(bar) && /Пассаж/.test(bar) && !/Watch</.test(bar));
	if (shots) {
		await page.screenshot({path: path.join(shots, 'step6b-debug.png')});
	}
	await page.context().close();
}

for (const [url, prefix] of [
	[base + 'step6b-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await valueChecks(url, say);
	await keepChecks(url, say);
	await sameChecks(url, say);
	await wordChecks(url, say);
}
await ownChecks();
await debugChecks();

if (shots) {
	const page = await start(await open(base + 'step6b-test.html'));

	await go(page, 'VArchive');
	await page.screenshot({path: path.join(shots, 'step6b-archive.png')});
	await go(page, 'VKeep', 600);
	await page.screenshot({path: path.join(shots, 'step6b-keep.png')});
	await page.context().close();
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
