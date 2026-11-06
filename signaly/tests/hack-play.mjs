// Проверка шага 5.2 в Chromium: блок «Терминал взлома».
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node hack-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [снимки] [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const pool = 'СТОЛ ДОМА ЛЕСА ОКНО, ПАРИЯ КУХНЯ СОННЯ ЧЕХИЯ\nМАЯК РЕКА';
const test =
	fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n').replace(/\s*$/, '\n') +
	`
:: HkHome {"position":"100,5000","size":"100,100"}
<<set $errors to 0>><<set $fails to 0>>[[На взлом|HkMain]]
[[На закреплённый|HkFixed]]

:: HkMain {"position":"200,5000","size":"100,100"}
<<sg-hack words "${pool.replace(/\n/g, '\\n')}" count 4 attempts 3 rows 8 cols 16 columns 3 gap 3 size 24 hint "top" tries "left" triesshow "boxes" missfx "flash" misstime 0.5 missplace "bottom" misslabel "СБОЙ" misssound "media/audio/click3.wav" win "HkWin" fail "HkFail" delay 0.3 frame usedglitch>>
<<sg-hack-win>><<set $won to 1>>
<<sg-hack-fail>><<set $fails += 1>>
<<sg-hack-miss>><<set $errors += 1>>
<</sg-hack>>\\
Под полем

:: HkWin {"position":"300,5000","size":"100,100"}
Взломано
[[Снова|HkMain]]

:: HkFail {"position":"400,5000","size":"100,100"}
Провал
[[Снова|HkMain]]

:: HkSound {"position":"1300,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА, ЛЕСА, ПАРИЯ" key "ДОМА" count 3 attempts 5 rows 6 cols 12>>
<</sg-hack>>

:: HkFixed {"position":"500,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА, ЛЕСА, ПАРИЯ" key "ОКНО" count 3 attempts 1 rows 6 cols 12 fail "HkFail" delay 0.1>>
<</sg-hack>>

:: HkRipple {"position":"600,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА, ЛЕСА, ОКНО" count 4 attempts 5 rows 6 cols 12 missfx "ripple" misstime 0.6 missplace "over" misscolor "#ffcc00" hinttext "{слово}: {совпало} из {всего}" triesshow "both" triestext "Осталось: {попытки}" wintext "Открыто\\nСлово {слово}" winnote "Готово" tries "right" hint "right" light "#ff00ff">>
<</sg-hack>>

:: HkTiny {"position":"700,5000","size":"100,100"}
<<sg-hack words "ПАРИЯ, КУХНЯ, СОННЯ" count 3 rows 2 cols 6 attempts 5>>
<</sg-hack>>

:: HkGuard {"position":"800,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА" key "СТОЛ" count 2 rows 3 cols 12 win "HkClosed" delay 0.1>>
<</sg-hack>>

:: HkClosed [sg-access] {"position":"900,5000","size":"100,100"}
<<sg-access lock "HkLock">>$open<<sg-rule auto "hack:HkGuard" do block to "HkLock">><</sg-access>>\\
Закрытый экран

:: HkLock {"position":"1000,5000","size":"100,100"}
Рано

:: HkFirst [sg-first-noise] {"position":"1100,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА, ЛЕСА" count 3 rows 4 cols 12>>
<</sg-hack>>

:: HkSlow {"position":"1200,5000","size":"100,100"}
<<sg-hack words "СТОЛ, ДОМА" key "СТОЛ" count 2 rows 3 cols 12 win "HkWin" delay 8>>
<</sg-hack>>

:: HkCss [stylesheet] {"position":"0,5000","size":"100,100"}
html { --sg-first-noise: noise 0.2 0.1 0 90 #ffffff 1 - - - -; }
`;

fs.writeFileSync(path.join(gameDir, 'hack-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'hack-test.twee'), path.join(gameDir, 'hack-test.html')]);

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
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(`${url}: ${e.message}`));
	page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${url}: ${m.text()}`));
	await page.goto(url);
	await page.waitForSelector('#sg-start');
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
const setVar = (page, name, value) => page.evaluate(([n, x]) => (SugarCube.State.variables[n] = x), [name, value]);
const getVar = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const where = page => page.evaluate(() => SugarCube.State.passage);
const words = page => page.$$eval('.sg-hack-word', list => list.map(w => w.getAttribute('data-word')));
const keyOf = (page, screen) => page.evaluate(s => SugarCube.State.variables.sgHack[s].last, screen);
const wrongOf = (list, key) => list.filter(w => w !== key);
const pick = (page, word) => page.click(`.sg-hack-word[data-word="${word}"]:not(.sg-hack-used)`);
const rect = (page, sel) => page.$eval(sel, el => {
	const r = el.getBoundingClientRect();

	return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
});

async function run(url, say) {
	const page = await open(url);

	/* Звуки поля (сессия 21, ответ 7А): символы и слова звучат как ссылки */
	await page.evaluate(() => {
		const play = HTMLMediaElement.prototype.play;

		window.sgPlayed = [];
		HTMLMediaElement.prototype.play = function () {
			if (this.sgUi) {
				window.sgPlayed.push(this.getAttribute('src'));
			}
			return play.apply(this, arguments);
		};
	});

	const played = async action => {
		await page.evaluate(() => (window.sgPlayed = []));
		await action();
		await page.waitForTimeout(150);
		return page.evaluate(() => window.sgPlayed);
	};

	await go(page, 'HkSound');
	await page.mouse.move(5, 5);

	const setFiles = name => page.evaluate(n => SugarCube.setup.signalySounds.sets.find(set => set.name === n).files, name);
	const hoverOf = await setFiles('Наведение');
	const clickOf = await setFiles('Нажатие');

	const onChar = await played(() => page.hover('.sg-hack-c'));

	say('наведение на символ звучит из набора наведения', onChar.length === 1 && hoverOf.includes(onChar[0]), onChar.join());
	const toChars = await played(async () => {
		await page.hover('.sg-hack-line:nth-child(2) .sg-hack-c:nth-child(3)');
		await page.hover('.sg-hack-line:nth-child(2) .sg-hack-c:nth-child(4)');
	});

	say('каждый символ звучит отдельно', toChars.length === 2, toChars.join());
	const onWord = await played(() => page.hover('.sg-hack-word'));

	say('наведение на слово звучит из набора наведения', onWord.length === 1 && hoverOf.includes(onWord[0]), onWord.join());
	const wordList = await words(page);
	const miss = wordList.find(w => w !== 'ДОМА');
	const onPick = await played(() => pick(page, miss));

	say('щелчок по слову звучит из набора нажатия', onPick.some(f => clickOf.includes(f)), onPick.join());
	const usedAt = await rect(page, `.sg-hack-word[data-word="${miss}"]`);
	const again = await played(() => page.mouse.click((usedAt.left + usedAt.right) / 2, (usedAt.top + usedAt.bottom) / 2));

	say('щелчок по выбранному слову нажатием не звучит', !again.some(f => clickOf.includes(f)), again.join());
	const onField = await played(() => page.click('.sg-hack-c'));

	say('щелчок по символу нажатием не звучит', !onField.some(f => clickOf.includes(f)), onField.join());

	/* Поле */
	await go(page, 'HkHome');
	await go(page, 'HkMain');
	let list = await words(page);
	let key = await keyOf(page, 'HkMain');
	const columns = await page.$$eval('.sg-hack-field > div', c => c.map(x => x.children.length));
	const lines = await page.$$eval('.sg-hack-line', l => l.map(x => x.textContent.length));
	const size = await page.$eval('.sg-hack-field', f => getComputedStyle(f).fontSize);

	say('четыре варианта', list.length === 4, list.join());
	say('все слова одной длины', new Set(list.map(w => [...w].length)).size === 1, list.join());
	say('ключевое слово среди вариантов', list.includes(key), key);
	say('три столбца по 8 строк', columns.length === 3 && columns.every(n => n === 8), columns.join());
	say('строки по 16 символов', lines.every(n => n === 16), lines.join());
	say('размер текста 24', size === "24px", size);
	say('шрифт ровный: столбцы одной ширины', await page.$$eval('.sg-hack-field > div', c => new Set(c.map(x => Math.round(x.offsetWidth))).size === 1));

	/* Подсветка */
	await page.hover('.sg-hack-c');
	const char = await page.$eval('.sg-hack-c:hover', c => [getComputedStyle(c).backgroundColor, c.textContent.length]);
	say('символ подсвечивается отдельно', char[0] !== 'rgba(0, 0, 0, 0)' && char[1] === 1, char.join());
	await page.hover('.sg-hack-word');
	const whole = await page.$eval('.sg-hack-word:hover', w => [getComputedStyle(w).backgroundColor, getComputedStyle(w).color, w.textContent.length]);
	say('слово подсвечивается целиком', whole[0] !== 'rgba(0, 0, 0, 0)' && whole[1] === 'rgb(0, 0, 0)' && whole[2] === [...key].length, whole.join());
	if (shots) {
		await page.screenshot({path: path.join(shots, 'hack-field.png')});
	}

	/* Места */
	const field = await rect(page, '.sg-hack-field');
	const hint = await rect(page, '.sg-hack-hint');
	const tries = await rect(page, '.sg-hack-tries');
	const label = await rect(page, '.sg-hack-label');

	say('подсказка над полем', hint.bottom <= field.top, JSON.stringify([hint, field]));
	say('попытки слева от поля', tries.right <= field.left, JSON.stringify([tries, field]));
	say('место надписи ошибки под полем', label.top >= field.bottom);

	/* Квадратики */
	let boxes = await page.$$eval('.sg-hack-box', b => b.map(x => x.classList.contains('sg-on')));
	say('три квадратика, все полные', boxes.length === 3 && boxes.every(Boolean), boxes.join());
	say('надписи о попытках нет', !(await page.$eval('.sg-hack-tries', t => t.textContent)).length);

	/* Неверное слово */
	await page.evaluate(() => {
		window.plays = 0;
		const play = HTMLMediaElement.prototype.play;

		HTMLMediaElement.prototype.play = function () {
			window.plays++;
			return play.apply(this, arguments);
		};
	});
	const wrong = wrongOf(list, key);
	const same = [...wrong[0]].filter((c, i) => c === [...key][i]).length;

	await pick(page, wrong[0]);
	await page.waitForTimeout(100);
	say('подсказка: сколько букв на месте', (await page.$eval('.sg-hack-hint', h => h.textContent)) === `${same}/${[...key].length} ВЕРНО`, await page.$eval('.sg-hack-hint', h => h.textContent));
	boxes = await page.$$eval('.sg-hack-box', b => b.map(x => x.classList.contains('sg-on')));
	say('один квадратик погас', boxes.filter(Boolean).length === 2, boxes.join());
	say('вспышка', await page.$eval('.sg-hack-layer', l => l.style.animation.includes('sg-hack-flash')).catch(() => false));
	say('надпись СБОЙ видна', await page.$eval('.sg-hack-label', l => getComputedStyle(l).visibility === 'visible' && l.textContent === 'СБОЙ'));
	say('звук ошибки', (await page.evaluate(() => window.plays)) >= 1);
	if (shots) {
		await page.screenshot({path: path.join(shots, 'hack-miss.png')});
	}
	say('ошибка посчитана', (await getVar(page, 'errors')) === 1, String(await getVar(page, 'errors')));
	const glitch = await page.$eval(`.sg-hack-word[data-word="${wrong[0]}"]`, w => [w.classList.contains('glitchy'), w.getAttribute('data-text')]);
	say('выбранное слово с глитчем', glitch[0] && glitch[1] === wrong[0], glitch.join());
	await page.waitForTimeout(600);
	say('вспышка и надпись погасли', (await page.$$('.sg-hack-layer')).length === 0 && (await page.$eval('.sg-hack-label', l => getComputedStyle(l).visibility)) === 'hidden');
	await page.mouse.click(0, 0);
	await page.evaluate(w => document.querySelector(`.sg-hack-word[data-word="${w}"]`).click(), wrong[0]);
	boxes = await page.$$eval('.sg-hack-box', b => b.filter(x => x.classList.contains('sg-on')).length);
	say('второй щелчок по выбранному слову попытку не тратит', boxes === 2, String(boxes));

	/* Провал */
	await pick(page, wrong[1]);
	await page.waitForTimeout(50);
	await pick(page, wrong[2]);
	await page.waitForTimeout(100);
	const lost = await page.$eval('.sg-hack-field', f => f.innerText);
	say('текст провала', lost.includes('Доступ запрещён!') && lost.includes('Терминал заблокирован.'), lost);
	say('ошибок три, провал один', (await getVar(page, 'errors')) === 3 && (await getVar(page, 'fails')) === 1, `${await getVar(page, 'errors')}/${await getVar(page, 'fails')}`);
	await page.waitForTimeout(400);
	say('переход на экран провала', (await where(page)) === 'HkFail');

	/* Новая попытка */
	let last = key;
	let changed = true;
	let sameLength = true;

	for (let i = 0; i < 10; i++) {
		await go(page, 'HkMain', 120);

		const now = await keyOf(page, 'HkMain');
		const options = await words(page);

		changed = changed && now !== last;
		sameLength = sameLength && new Set(options.map(w => [...w].length)).size === 1 && options.length === 4;
		last = now;
		await go(page, 'HkFail', 60);
	}
	say('при повторной попытке слово другое (10 раз подряд)', changed);
	say('в каждой попытке одна длина, 4 варианта', sameLength);
	await go(page, 'HkMain');
	boxes = await page.$$eval('.sg-hack-box.sg-on', b => b.length);
	say('попытки сброшены при входе', boxes === 3, String(boxes));

	/* Успех */
	key = await keyOf(page, 'HkMain');
	await pick(page, key);
	await page.waitForTimeout(100);
	const won = await page.$eval('.sg-hack-field', f => f.innerText);
	say('текст успеха с ключевым словом', won.includes('Доступ разрешён!') && won.includes('Пароль: ' + key), won);
	say('надпись успеха', (await page.$eval('.sg-hack-tries', t => t.textContent)) === 'Взлом завершён успешно!');
	say('действия успеха', (await getVar(page, 'won')) === 1);
	await page.waitForTimeout(400);
	say('переход на экран успеха', (await where(page)) === 'HkWin');

	/* Повторный вход */
	await page.evaluate(() => {
		window.sawHack = false;
		new MutationObserver(() => {
			window.sawHack = window.sawHack || !!document.querySelector('.sg-hack');
		}).observe(document.body, {childList: true, subtree: true});
	});
	await page.click('.passage a[data-passage="HkMain"]');
	await page.waitForTimeout(300);
	say('взломанный экран не показывается: ссылка ведёт на экран успеха', (await where(page)) === 'HkWin' && !(await page.evaluate(() => window.sawHack)), await where(page));
	await go(page, 'HkMain');
	say('и прямой переход тоже', (await where(page)) === 'HkWin');

	/* Заданное слово */
	await go(page, 'HkFixed');
	list = await words(page);
	say('заданное слово и варианты его длины', (await keyOf(page, 'HkFixed')) === 'ОКНО' && list.length === 3 && list.includes('ОКНО') && !list.includes('ПАРИЯ'), list.join());
	await pick(page, wrongOf(list, 'ОКНО')[0]);
	await page.waitForTimeout(350);
	say('последняя попытка — сразу провал', (await where(page)) === 'HkFail');
	await go(page, 'HkFixed');
	say('заданное слово не меняется', (await keyOf(page, 'HkFixed')) === 'ОКНО');

	/* Рябь и надпись поверх, свои надписи */
	await go(page, 'HkRipple');
	list = await words(page);
	key = await keyOf(page, 'HkRipple');
	const other = wrongOf(list, key)[0];

	await pick(page, other);
	await page.waitForTimeout(120);
	const layer = await page.$eval('.sg-hack-layer', l => l.style.backdropFilter).catch(() => '');
	const over = await page.$eval('.sg-hack-over', l => [getComputedStyle(l).fontSize, getComputedStyle(l).color, l.textContent]).catch(() => []);
	say('рябь', layer.includes('sg-hack-ripple'), layer);
	say('очень крупная надпись поверх текста', over[0] === '240px' && over[1] === 'rgb(255, 204, 0)' && over[2] === 'ОШИБКА', over.join());
	if (shots) {
		await page.screenshot({path: path.join(shots, 'hack-over.png')});
	}
	const place = await page.$eval('.sg-hack-over', l => getComputedStyle(l).pointerEvents);
	say('надпись не мешает щёлкать', place === 'none', place);
	await page.waitForTimeout(700);
	say('рябь снята, слой убран', (await page.$$('.sg-hack-layer, .sg-hack-over, body > svg filter#sg-hack-ripple')).length === 0);
	const text = await page.$eval('.sg-hack-hint', h => h.textContent);
	say('своя подсказка', text === `${other}: ${[...other].filter((c, i) => c === [...key][i]).length} из ${[...key].length}`, text);
	const both = await page.$eval('.sg-hack-tries', t => [t.textContent, t.querySelectorAll('.sg-hack-box').length]);
	say('надпись и квадратики вместе', both[0] === 'Осталось: 4' && both[1] === 5, both.join());
	const hrect = await rect(page, '.sg-hack-hint');
	const frect = await rect(page, '.sg-hack-field');
	say('подсказка справа', hrect.left >= frect.right);
	const lightOn = await page.$eval('.sg-hack', b => getComputedStyle(b).getPropertyValue('--sg-hack-light').trim());
	say('свой цвет подсветки', lightOn === '#ff00ff', lightOn);
	await pick(page, key);
	await page.waitForTimeout(100);
	const lines2 = await page.$eval('.sg-hack-field', f => f.innerText.split('\n'));
	say('свой текст успеха в две строки', lines2[0] === 'Открыто' && lines2[1] === 'Слово ' + key, lines2.join('|'));
	say('без экрана успеха — остаёмся', (await where(page)) === 'HkRipple');

	/* Маленькое поле */
	await go(page, 'HkTiny');
	list = await words(page);
	say('в маленькое поле ключевое слово попадает всегда', list.includes(await keyOf(page, 'HkTiny')), list.join());

	/* Доступ */
	await go(page, 'HkGuard');
	await pick(page, 'СТОЛ');
	await page.waitForTimeout(300);
	say('«Доступ»: успех ведёт на блокировку', (await where(page)) === 'HkLock', await where(page));
	await setVar(page, 'open', true);
	await go(page, 'HkGuard');
	say('«Доступ»: взломанный экран ведёт дальше, когда открыто', (await where(page)) === 'HkClosed', await where(page));

	/* Первое посещение */
	await go(page, 'HkFirst', 600);
	await page.hover('.sg-hack-word');
	const firstHover = await page.$eval('.sg-hack-word:hover', w => getComputedStyle(w).color).catch(() => '');
	say('первое посещение: поле работает', firstHover === 'rgb(0, 0, 0)', firstHover);

	/* Сбой посреди успеха */
	await go(page, 'HkSlow');
	await pick(page, 'СТОЛ');
	await page.waitForTimeout(300);
	await page.goto(url);
	await page.waitForSelector('#sg-start, .passage');
	await page.click('#sg-start').catch(() => {});
	await page.waitForSelector('.passage');
	await page.waitForTimeout(500);
	say('после сбоя взломанный экран ведёт дальше', (await where(page)) === 'HkWin', await where(page));

	/* Шаблон */
	await go(page, 'Хактест', 400);
	const tmpl = await page.$$eval('.sg-hack-line', l => l.map(x => x.textContent.length));
	const tmplWords = await words(page);
	say('«Хактест»: 10 строк по 60 знаков, 5 слов', tmpl.length === 10 && tmpl.every(n => n === 60) && tmplWords.length === 5, tmpl.join());
	if (shots) {
		await page.screenshot({path: path.join(shots, 'hack-template.png')});
	}
	await page.close();
}

for (const [url, prefix] of [
	[base + 'hack-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	await run(url, (name, ok, more) => check(prefix + name, ok, more));
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));
await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
