// Проверка шага 4.4 в Chromium: статьи. Тестовая история — шаблон + статьи и
// списки: порядок, разделы, столбцы, ссылки и кнопки, новая статья в списке,
// закрытые статьи («Доступ»), ссылка «Назад», цепочка статей, событие и сбой.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node articles-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $arOpen to false>>\n<<set $arEv to false>>\n')
		.replace(/\s*$/, '\n') +
	`
:: ArHome {"position":"100,0","size":"100,100"}
Главное меню
<<sg-articles columns 2 headings>>
<<link "Открыть">><<set $arOpen to true>><</link>>
<<link "Закрыть">><<set $arOpen to false>><</link>>

:: ArPick {"position":"200,0","size":"100,100"}
<<sg-articles sections "Бета" form button kind amber>>

:: ArNoHead {"position":"300,0","size":"100,100"}
<<sg-articles sections "Альфа">>

:: ArOne [sg-article] {"position":"100,100","size":"100,100"}
<<sg-article title "Первая" section "Альфа" order 1>>\\
Текст первой

:: ArTwo [sg-article] {"position":"200,100","size":"100,100"}
<<sg-article title "Вторая" section "Альфа" order 2 back "К списку">>\\
Текст второй
[[Дальше|ArOne]]

:: ArThree [sg-article] {"position":"300,100","size":"100,100"}
<<sg-article section "Бета" order 5>>\\
Текст третьей

:: ArFour [sg-article] {"position":"400,100","size":"100,100"}
<<sg-article title "Без раздела" order 0>>\\
Текст четвёртой

:: ArTagOnly [sg-article] {"position":"500,100","size":"100,100"}
Только тег

:: ArHidden [sg-article sg-access] {"position":"100,200","size":"100,100"}
<<sg-access>>$arOpen<</sg-access>>\\
<<sg-article title "Скрытая" section "Гамма" order 7>>\\
Текст скрытой

:: ArOff [sg-article sg-access] {"position":"200,200","size":"100,100"}
<<sg-article title "Неактивная" section "Дельта" order 8>>\\
<<sg-access links off>>$arOpen<</sg-access>>\\
Текст неактивной

:: ArBlock [sg-article sg-access] {"position":"300,200","size":"100,100"}
<<sg-article title "К блокировке" section "Дельта" order 9>>\\
<<sg-access links block>>$arOpen<</sg-access>>\\
Текст

:: ArRule [sg-article sg-access] {"position":"400,200","size":"100,100"}
<<sg-article title "Пропускаемая" section "Дельта" order 10>>\\
<<sg-access>>$arOpen
<<sg-rule link "Пропускаемая" from "ArHome" do pass>>
<</sg-access>>\\
Текст

:: ArLock [sg-lock] {"position":"500,200","size":"100,100"}
Ещё слишком рано
<<link "Вернуться">><<sg-back>><</link>>

:: ArEvent [sg-event] {"position":"600,200","size":"100,100"}
<<sg-event $arEv>>\\
Событие
<<link "Вернуться">><<sg-back>><</link>>
`;

fs.writeFileSync(path.join(gameDir, 'articles-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'articles-test.twee'), path.join(gameDir, 'articles-test.html')]);

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

const go = async (page, name) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(350);
};
const setVar = (page, name, value) => page.evaluate(([n, x]) => (SugarCube.State.variables[n] = x), [name, value]);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const click = async (page, selector) => {
	await page.click(selector);
	await page.waitForTimeout(350);
};
const titles = page =>
	page.$$eval('.sg-art-item:not(.sg-acc-hide) a, .sg-art-item:not(.sg-acc-hide) button', list => list.map(x => x.textContent));
const headings = page => page.$$eval('.sg-art-section:not(.sg-acc-hide) .sg-art-heading', list => list.map(x => x.textContent));
const backLink = '.sg-art-back a, .sg-art-back button';
const backText = page => page.$eval(backLink, x => x.textContent);

async function newChecks(url, prefix) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const page = await open(url);

	await go(page, 'ArHome');

	// Порядок и разделы.
	const all = await titles(page);

	say('все открытые статьи по разделам и порядку; без раздела — в конце', all.join('|') === 'Первая|Вторая|ArThree|Неактивная|К блокировке|Пропускаемая|Без раздела|ArTagOnly', all.join('|'));
	say('ответ 1: без названия — имя экрана', all.includes('ArThree'));
	say('статья с одним тегом тоже в списке', all.includes('ArTagOnly'));
	say('заголовки разделов; разделы без видимых статей скрыты', (await headings(page)).join('|') === 'Альфа|Бета|Дельта', (await headings(page)).join('|'));
	say('два столбца', (await page.$eval('.sg-art-grid', x => getComputedStyle(x).gridTemplateColumns.split(' ').length)) === 2);
	say('список на месте блока: текст и ссылки вокруг целы', (await page.innerText('.passage')).startsWith('Главное меню') && (await page.isVisible('.passage a:text-is("Открыть")')));
	say('в статье команда не оставляет пустой строки', await (async () => {
		await go(page, 'ArOne');
		return (await page.innerText('.passage')).startsWith('Текст первой');
	})());

	// Выбранные разделы, кнопки, вид.
	await go(page, 'ArPick');
	say('только выбранный раздел', (await titles(page)).join('|') === 'ArThree');
	say('кнопками и с видом', (await page.$$('.sg-art-item span.amber button')).length === 1);
	say('без галочки — без названий разделов', await (async () => {
		await go(page, 'ArNoHead');
		return (await headings(page)).length === 0 && (await titles(page)).length === 2;
	})());

	// Ссылка «Назад».
	await go(page, 'ArHome');
	await click(page, '.sg-art-item a:text-is("Первая")');
	say('ссылка открывает статью', (await passage(page)) === 'ArOne');
	say('внизу статьи — «Назад»', (await backText(page)) === 'Назад' && (await page.$eval('.passage', x => x.lastElementChild.className)) === 'sg-art-back');
	await click(page, backLink);
	say('«Назад» ведёт на экран, откуда открыли', (await passage(page)) === 'ArHome');

	await go(page, 'ArPick');
	await click(page, '.sg-art-item button:text-is("ArThree")');
	await click(page, backLink);
	say('из другого списка — в него же', (await passage(page)) === 'ArPick');

	await go(page, 'ArNoHead');
	await click(page, '.sg-art-item a:text-is("Вторая")');
	say('своя надпись у статьи', (await backText(page)) === 'К списку');
	await click(page, '.passage a:text-is("Дальше")');
	await click(page, backLink);
	say('статья из статьи: «Назад» — на первую статью', (await passage(page)) === 'ArTwo');
	await click(page, backLink);
	say('и дальше — на список', (await passage(page)) === 'ArNoHead');

	await page.evaluate(() => {
		const root = document.documentElement.style;

		root.setProperty('--sg-article-back', '"Выход"');
		root.setProperty('--sg-article-kind', '"amber"');
		root.setProperty('--sg-article-button', '1');
	});
	await go(page, 'ArHome');
	await click(page, '.sg-art-item a:text-is("Первая")');
	say('общая надпись, вид и кнопка из оформления', (await page.$$('.sg-art-back span.amber button:text-is("Выход")')).length === 1);
	await click(page, backLink);
	await page.evaluate(() => {
		const root = document.documentElement.style;

		root.removeProperty('--sg-article-back');
		root.removeProperty('--sg-article-kind');
		root.removeProperty('--sg-article-button');
	});

	// На обычном экране ссылки нет.
	say('на обычном экране «Назад» нет', (await page.$$('.sg-art-back')).length === 0);

	// Закрытые статьи.
	await go(page, 'ArHome');
	say('закрытая статья скрыта вместе с разделом', !(await titles(page)).includes('Скрытая') && !(await headings(page)).includes('Гамма'));
	say('«показывать, но не нажимается»', await page.isVisible('.sg-art-item a:text-is("Неактивная").sg-acc-off'));
	await click(page, '.sg-art-item a:text-is("К блокировке")');
	say('«вести на блокировку»', (await passage(page)) === 'ArLock');
	await click(page, '.passage a:text-is("Вернуться")');
	say('с блокировки — обратно на список', (await passage(page)) === 'ArHome');
	await click(page, '.sg-art-item a:text-is("Пропускаемая")');
	say('своё правило источника в списке', (await passage(page)) === 'ArRule');
	await go(page, 'ArHome');
	await click(page, '.passage a:text-is("Открыть")');
	await page.waitForTimeout(350);
	say('условие выполнилось — статья и раздел появились сами', (await titles(page)).includes('Скрытая') && (await headings(page)).includes('Гамма'));
	say('неактивная стала нажиматься', (await page.$$('.sg-art-item a.sg-acc-off')).length === 0);
	await click(page, '.sg-art-item a:text-is("Скрытая")');
	say('открытая статья открывается и «Назад» работает', (await passage(page)) === 'ArHidden' && (await backText(page)) === 'Назад');
	await click(page, backLink);
	await click(page, '.passage a:text-is("Закрыть")');
	await page.waitForTimeout(350);
	say('условие снова ложно — статья скрылась', !(await titles(page)).includes('Скрытая'));

	// Событие посреди статьи.
	await click(page, '.sg-art-item a:text-is("Первая")');
	await setVar(page, 'arEv', true);
	await page.waitForTimeout(500);
	say('событие срабатывает со статьи', (await passage(page)) === 'ArEvent');
	await click(page, '.passage a:text-is("Вернуться")');
	say('«Вернуться» с события — на статью', (await passage(page)) === 'ArOne');
	await click(page, backLink);
	say('«Назад» после события — всё равно на список', (await passage(page)) === 'ArHome');

	// Сбой.
	await click(page, '.sg-art-item a:text-is("Первая")');
	await page.click('.passage');
	await page.waitForTimeout(200);
	await open(url, page);
	say('сбой: та же статья, «Назад» на месте', (await passage(page)) === 'ArOne' && (await backText(page)) === 'Назад', await passage(page));
	await click(page, backLink);
	say('и ведёт туда же', (await passage(page)) === 'ArHome');
	await page.close();
}

await newChecks(base + 'articles-test.html', '');
for (const file of extra) {
	await newChecks(base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
