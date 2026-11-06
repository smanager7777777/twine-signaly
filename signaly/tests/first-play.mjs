// Проверка шага 4.5 в Chromium: ДЕШИФРАТОР (поле «Только цифры», любой код
// таблицы, «Доступ» раньше времени, повторный ввод) и первое посещение
// (способы, порядок, части экрана, щелчок, сбой, второй заход).
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node first-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [снимки] [ещё игра.html …]
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
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $decOpen to false>>\n<<set $fvOpen to false>>\n<<set $dec to "">>\n')
		.replace(/\s*$/, '\n') +
	`
:: FvCss [stylesheet] {"position":"0,3000","size":"100,100"}
html {
	--sg-fvs-1: #0000ff;
	--sg-fvs-2: #ff0000;
	--sg-first-noise: noise 0.6 0.15 0 90 #ffffff 1 - - - -;
	--sg-first-fade: fade 0.5 0.3 0 80 #ffffff 0 - - - -;
	--sg-first-wave: wave 0.8 0 0 90 #00ff00 1 - - - -;
	--sg-first-glitch: glitch 0.8 0 0 90 #ffffff 1 - - - -;
	--sg-first-mix: noise 0.5 0.1 0 80 #ffffff 1 now glitch fade -;
	--sg-first-long: fade 30 0 0 80 #ffffff 1 - - - -;
	--sg-first-slow: fade 0.3 0 1.2 80 #ffffff 1 - - - -;
}

:: DecHome {"position":"100,3000","size":"100,100"}
ДЕШИФРАТОР
<<sg-code var "$dec" button "Ввод" table digits clear>><</sg-code>>

:: DecPin {"position":"200,3000","size":"100,100"}
<<sg-code table digits>><</sg-code>>

:: DecData {"position":"100,3100","size":"100,100"}
Блок данных восстановлен
<<link "Обратно" "DecHome">><</link>>

:: DecEnvelope [sg-access] {"position":"200,3100","size":"100,100"}
<<sg-access lock "DecEarly">>$decOpen<</sg-access>>\\
Откройте конверт
<<link "Обратно" "DecHome">><</link>>

:: DecEarly {"position":"300,3100","size":"100,100"}
Ещё слишком рано
<<link "Обратно" "DecHome">><</link>>

:: DecShared [sg-lock] {"position":"500,3100","size":"100,100"}
Общая блокировка
<<link "Обратно">><<sg-back>><</link>>

:: DecTable [sg-codes] {"position":"400,3100","size":"100,100"}
<<sg-person "2" pin "417" var "$p2">>
<<sg-entry "777" "Блок" decoder goto "DecData">><</sg-entry>>
<<sg-entry "1234567890123456" "Длинный" decoder goto "DecData">><</sg-entry>>
<<sg-entry "007" "Нули" goto "DecData">><</sg-entry>>
<<sg-entry "205" "Конверт" once all goto "DecEnvelope">><</sg-entry>>
<<sg-entry "500" "Личный" who "2" goto "DecData">><</sg-entry>>
<<sg-entry "300" "Конверт без экрана" once all lock "DecEarly" title "Конверт">><<set $got to 1>><<sg-answer>>Откройте конверт 3-2<<sg-when>>$decOpen<</sg-entry>>
<<sg-entry "301" "К общей блокировке">><<sg-answer>>Открыто<<sg-when>>setup.visits("DecData") gt 99<</sg-entry>>
<<sg-entry "302" "Личный рано" who "2" lock "DecEarly">><<sg-when>>$decLate<</sg-entry>>

:: FvPlain {"position":"100,3200","size":"100,100"}
Обычный экран

:: FvNoise [sg-first-noise] {"position":"200,3200","size":"100,100"}
Первая строка
Вторая <span class="amber">цветная</span> строка
<<sg-image "media/img/x.jpg" width 100>>
[[Дальше|FvPlain]]
<<sg-place corner tr x 5 y 5>><<link "РАД2">><</link>><</sg-place>>
<<sg-code var "$fv">><</sg-code>>

:: FvFade [sg-first-fade] {"position":"300,3200","size":"100,100"}
Один
Два
Три

:: FvWave [sg-first-wave] {"position":"400,3200","size":"100,100"}
Помехи на этом тексте
[[Дальше|FvPlain]]

:: FvGlitch [sg-first-glitch] {"position":"500,3200","size":"100,100"}
Глитч на этом тексте
[[Дальше|FvPlain]]

:: FvMix [sg-first-mix] {"position":"600,3200","size":"100,100"}
Текст сразу
[[Ссылка глитчем|FvPlain]]

:: FvLong [sg-first-long] {"position":"100,3300","size":"100,100"}
Долгий текст
[[Ссылка|FvPlain]]

:: FvSlow [sg-first-slow] {"position":"200,3300","size":"100,100"}
С паузой

:: FvType [sg-first-noise] {"position":"300,3300","size":"100,100"}
<<type 10ms>>Печать идёт как обычно<</type>>
Другая строка

:: FvKr2 [kr2 sg-first-noise] {"position":"400,3300","size":"100,100"}
<<kr2vars>>Статус<</kr2vars>><<kr2main>>Основной текст<</kr2main>>

:: FvShow [sg-first-noise] {"position":"500,3300","size":"100,100"}
Экран для снимка, первая строка текста
Вторая строка текста на экране
Третья строка текста на экране
[[Дальше|FvPlain]]
`;

fs.writeFileSync(path.join(gameDir, 'first-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'first-test.twee'), path.join(gameDir, 'first-test.html')]);

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

async function open(url, page) {
	if (!page) {
		page = await browser.newPage({viewport: {width: 1920, height: 1080}});
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

const play = (page, name) => page.evaluate(n => SugarCube.Engine.play(n), name);
const go = async (page, name, wait = 350) => {
	await play(page, name);
	await page.waitForTimeout(wait);
};
const setVar = (page, name, value) => page.evaluate(([n, x]) => (SugarCube.State.variables[n] = x), [name, value]);
const getVar = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const canvas = page => page.evaluate(() => !!document.getElementById('sg-fv-canvas'));
const wraps = page => page.evaluate(() => document.querySelectorAll('.sg-fv').length);
const ends = async (page, ms = 4000) => {
	await page.waitForFunction(() => !document.getElementById('sg-fv-canvas'), null, {timeout: ms});
};
const dialogText = page => page.$eval('#ui-dialog-body', x => x.textContent.trim()).catch(() => '');
const closeDialog = async page => {
	await page.click('#ui-dialog-close').catch(() => {});
	await page.waitForTimeout(150);
};
const enter = async (page, code) => {
	await page.fill('input.sg-code', '');
	await page.type('input.sg-code', code);
	await page.press('input.sg-code', 'Enter');
	await page.waitForTimeout(300);
};

async function decoderChecks(url, say) {
	const page = await open(url);

	await go(page, 'DecHome');
	await page.type('input.sg-code', '12ab3!я 4');
	say('буквы и знаки не печатаются', (await page.inputValue('input.sg-code')) === '1234', await page.inputValue('input.sg-code'));
	say('переменная поля — только цифры', (await getVar(page, 'dec')) === '1234', await getVar(page, 'dec'));
	await page.fill('input.sg-code', '');
	await page.evaluate(() => {
		const el = document.querySelector('input.sg-code');

		el.value = '9x8-7';
		el.dispatchEvent(new Event('input', {bubbles: true}));
	});
	say('вставка из буфера — тоже', (await page.inputValue('input.sg-code')) === '987');

	await enter(page, '777');
	say('пароль с меткой ведёт на свой экран', (await passage(page)) === 'DecData');
	await page.click('.passage a:text-is("Обратно")');
	await page.waitForTimeout(300);
	await enter(page, '777');
	say('ответ 7А: повторный ввод снова открывает экран', (await passage(page)) === 'DecData');
	await go(page, 'DecHome');
	await enter(page, '1234567890123456');
	say('ответ 4А: число любой длины', (await passage(page)) === 'DecData');
	await go(page, 'DecHome');
	await enter(page, '007');
	say('ответ 3Б: код без метки тоже принимается; нули слева важны', (await passage(page)) === 'DecData');
	await go(page, 'DecHome');
	await enter(page, '7');
	say('поле очищается, неверный код — обычное сообщение', (await dialogText(page)) === 'Неверный код', await dialogText(page));
	await closeDialog(page);

	await enter(page, '205');
	say('ответ 3Б: конверт раньше времени — пассаж блокировки', (await passage(page)) === 'DecEarly', await passage(page));
	say('на нём текст автора', (await page.innerText('.passage')).startsWith('Ещё слишком рано'));
	await page.click('.passage a:text-is("Обратно")');
	await page.waitForTimeout(300);
	await setVar(page, 'decOpen', true);
	await enter(page, '205');
	say('одноразовый код раньше времени не потрачен: теперь открывает конверт', (await passage(page)) === 'DecEnvelope', await passage(page));
	await go(page, 'DecHome');
	await enter(page, '205');
	say('«Одноразовый» работает: второй раз — «Пусто»', (await dialogText(page)) === 'Пусто', await dialogText(page));
	await closeDialog(page);

	// Код без экрана: своё условие.
	await setVar(page, 'decOpen', false);
	await go(page, 'DecHome');
	await enter(page, '300');
	say('код без экрана раньше времени — пассаж блокировки', (await passage(page)) === 'DecEarly', await passage(page));
	say('действия кода не выполнены', (await getVar(page, 'got')) === undefined);
	await go(page, 'DecHome');
	await setVar(page, 'decOpen', true);
	await enter(page, '300');
	say('условие выполнено: тот же код работает, не потрачен', (await dialogText(page)) === 'Откройте конверт 3-2' && (await getVar(page, 'got')) === 1, await dialogText(page));
	await closeDialog(page);
	await enter(page, '301');
	say('без своего пассажа — общий пассаж блокировки; условие с кавычками', (await passage(page)) === 'DecShared', await passage(page));
	await page.click('.passage a:text-is("Обратно")');
	await page.waitForTimeout(300);
	say('«Вернуться» с блокировки — к дешифратору', (await passage(page)) === 'DecHome');
	await go(page, 'DecPin');
	await enter(page, '302');
	say('раньше времени личный код не спрашивается', (await passage(page)) === 'DecEarly' && (await page.locator('.sg-code-pin input').count()) === 0);

	await go(page, 'DecPin');
	await enter(page, '500');
	const pin = page.locator('.sg-code-pin input');

	await pin.type('4a1b7');
	say('поле личного кода — тоже только цифры', (await pin.inputValue()) === '417');
	await pin.press('Enter');
	await page.waitForTimeout(300);
	say('код с личным кодом проходит', (await passage(page)) === 'DecData');
	await page.close();
}

async function firstChecks(url, say) {
	const page = await open(url);

	await go(page, 'FvPlain');
	say('экран без тега — без эффекта', !(await canvas(page)) && (await wraps(page)) === 0);

	// Белый шум, порядок, части.
	await play(page, 'FvNoise');
	const mid = await page.evaluate(() => {
		const wraps = [...document.querySelectorAll('.sg-fv')];

		return {
			canvas: !!document.getElementById('sg-fv-canvas'),
			lines: wraps.map(x => x.textContent.trim()),
			hidden: Number(wraps[1].style.opacity) < 1,
			linkOff: document.querySelector('.passage a[data-passage]').style.pointerEvents === 'none',
			imgOff: document.querySelector('.passage img').style.opacity === '0'
		};
	});

	say('первый заход: поверх экрана слой шума', mid.canvas);
	say('строки текста — отдельные элементы', mid.lines.join('|') === 'Первая строка|Вторая цветная строка', mid.lines.join('|'));
	say('элементы скрыты, пока не настала очередь', mid.hidden && mid.imgOff);
	say('ссылка не нажимается, пока не возникла', mid.linkOff);
	await ends(page);
	const after = await page.evaluate(() => ({
		html: document.querySelector('.passage').innerHTML,
		place: document.querySelector('.sg-place').getBoundingClientRect().top,
		svg: !!document.querySelector('body > svg')
	}));

	say('эффект закончен: обёрток и слоёв не осталось', (await wraps(page)) === 0 && !after.svg);
	await go(page, 'FvPlain');
	await go(page, 'FvNoise');
	const second = await page.evaluate(() => ({
		html: document.querySelector('.passage').innerHTML,
		place: document.querySelector('.sg-place').getBoundingClientRect().top
	}));

	say('второй заход — без эффекта', !(await canvas(page)));
	say('страница после эффекта такая же, как при втором заходе', after.html.replace(/ style=""/g, '') === second.html.replace(/ style=""/g, ''));
	say('кнопка на экране на своём месте', after.place === second.place);

	// Плавно: по очереди сверху вниз; щелчок выключен.
	await play(page, 'FvFade');
	await page.waitForTimeout(150);
	const fade1 = await page.$$eval('.sg-fv', list => list.map(x => Number(x.style.opacity || 1)));

	say('плавно: первая строка уже проявляется, третья ещё нет', fade1[0] > 0 && fade1[2] === 0, fade1.join(','));
	await page.mouse.click(960, 900);
	await page.waitForTimeout(50);
	say('щелчок выключен в способе — эффект идёт дальше', await canvas(page));
	await ends(page);

	// Помехи и глитч.
	await play(page, 'FvWave');
	await page.waitForTimeout(100);
	const wave = await page.$eval('.sg-fv', x => ({f: x.style.filter}));

	say('помехи: фильтр на элементе', /url\(/.test(wave.f), wave.f);
	await ends(page);
	await play(page, 'FvGlitch');
	await page.waitForTimeout(150);
	const glitch = await page.$eval('.sg-fv', x => ({f: x.style.filter, left: x.style.left}));

	say('глитч: цветные тени и сдвиг', /drop-shadow/.test(glitch.f), glitch.f);
	await ends(page);
	say('следа не осталось', !(await page.$eval('.passage', x => /sg-fv|drop-shadow|url\(#/.test(x.innerHTML))));

	// Части экрана.
	await play(page, 'FvMix');
	await page.waitForTimeout(60);
	const mix = await page.evaluate(() => ({
		text: document.querySelector('.passage').textContent.includes('Текст сразу') && document.querySelectorAll('.sg-fv').length,
		link: document.querySelector('.passage a[data-passage]').getAttribute('style')
	}));

	say('части экрана: текст сразу, без эффекта', mix.text === 0, String(mix.text));
	say('части экрана: у ссылки свой способ', !!mix.link, String(mix.link));
	await ends(page);

	// Щелчок.
	await play(page, 'FvLong');
	await page.waitForTimeout(100);
	await page.mouse.click(960, 900);
	await page.waitForTimeout(100);
	say('щелчок показывает всё сразу', !(await canvas(page)) && (await wraps(page)) === 0);
	await go(page, 'FvPlain');

	// Пауза перед началом.
	await setVar(page, 'sgVisits', {});
	await play(page, 'FvSlow');
	await page.waitForTimeout(300);
	say('пауза перед первым элементом: ещё скрыто', (await page.$eval('.sg-fv', x => x.style.opacity)) === '0');
	await page.evaluate(() => document.querySelector('.sg-fv').click());
	await page.waitForTimeout(50);

	// Переход посреди эффекта.
	await setVar(page, 'sgVisits', {});
	await play(page, 'FvLong');
	await page.waitForTimeout(100);
	await go(page, 'FvPlain');
	say('переход посреди эффекта: слой убран, следующий экран обычный', !(await canvas(page)) && (await wraps(page)) === 0);

	// Эффекты текста живут своей жизнью.
	await go(page, 'FvType', 700);
	await ends(page);
	await page.waitForTimeout(500);
	say('печать допечатана, текст на месте', (await page.innerText('.passage')).includes('Печать идёт как обычно') && (await page.innerText('.passage')).includes('Другая строка'));

	// KR2.
	await play(page, 'FvKr2');
	await page.waitForTimeout(80);
	say('окно KR2: зоны тоже возникают', (await canvas(page)) && Number(await page.$eval('#kr2-main', x => x.style.opacity)) < 1);
	await ends(page);
	say('окно KR2 цело', (await page.innerText('#kr2-main')).includes('Основной текст') && (await page.innerText('#kr2-vars')).includes('Статус'));
	await go(page, 'FvPlain');

	// Снимки: как это выглядит.
	if (shots) {
		await setVar(page, 'sgVisits', {});
		for (const name of ['FvShow']) {
			await play(page, name);
			await page.waitForTimeout(250);
			await page.screenshot({path: path.join(shots, 'first-noise.png')});
			await ends(page);
			await go(page, 'FvPlain');
		}
		await setVar(page, 'sgVisits', {});
		await play(page, 'FvWave');
		await page.waitForTimeout(200);
		await page.screenshot({path: path.join(shots, 'first-wave.png')});
		await ends(page);
		await play(page, 'FvGlitch');
		await page.waitForTimeout(200);
		await page.screenshot({path: path.join(shots, 'first-glitch.png')});
		await ends(page);
	}

	// Сбой: экран, который уже показывали, заново не появляется.
	await setVar(page, 'sgVisits', {});
	await go(page, 'FvFade', 100);
	await ends(page);
	await page.click('.passage');
	await page.waitForTimeout(200);
	await open(url, page);
	say('после сбоя тот же экран, без эффекта', (await passage(page)) === 'FvFade' && !(await canvas(page)), await passage(page));
	await page.close();
}

for (const [url, prefix] of [
	[base + 'first-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await decoderChecks(url, say);
	await firstChecks(url, say);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
