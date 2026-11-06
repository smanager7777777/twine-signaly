// Проверка шага 5.1 в Chromium: блок «Список состояний» — процедуры и плитка.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node list-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [снимки] [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, shots, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);

const rows99 = Array.from({length: 99}, (_, i) => {
	const n = String(i + 1).padStart(3, '0');

	return `<<sg-row "${n}" "Процедура ${n}" var "$many${i + 1}">>`;
}).join('\n');
const test =
	fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n').replace(/\s*$/, '\n') +
	`
:: LsHome {"position":"100,4000","size":"100,100"}
<<sg-list form button columns 2>>
<<sg-state 0 label "{номер}. Данные повреждены" color "#cc0000" keykind "purple">>
<<sg-state 1 label "{номер}. Нужен пароль" color "#ff8800" keykind "purple" goto "LsCode">>
<<sg-state 2 label "{номер}. Нужна дешифровка" color "#ffcc00" keykind "purple" goto "LsDec">>
<<sg-state 3 label "{номер}. {название}" color "#00cc00" keykind "purple" do window title "Процедура {номер}">>
<<sg-row "001" "Гибернация" var "$a" passage "LsText">>
<<sg-row "002" "Шлюз" var "$b" passage "LsText" key>>
<<sg-row "003" "Без экрана" var "$c" passage "LsNone">>
<</sg-list>>
Строка под списком
<<sg-code table>><</sg-code>>

:: LsCode {"position":"200,4000","size":"100,100"}
Экран пароля
[[Обратно|LsHome]]

:: LsDec {"position":"300,4000","size":"100,100"}
Дешифратор
[[Обратно|LsHome]]

:: LsText {"position":"400,4000","size":"100,100"}
Текст процедуры

:: LsTiles {"position":"500,4000","size":"100,100"}
<<sg-list form tile columns 4>>
<<sg-state 0 label "Отказ" color "#cc0000">>
<<sg-state 1 label "Норма" color "#00cc00" kind "amber" do row>>
<<sg-state "ремонт" label "Ремонт {номер}" color "#ffcc00">><<set $clicked to 1>>
<<sg-row "1" "Реактор" var "$r1" passage "LsText">>
<<sg-row "2" "Шлюз" var "$r2" passage "LsText">>
<</sg-list>>

:: LsLinks {"position":"600,4000","size":"100,100"}
<<sg-list columns 1>>
<<sg-state 0 label "Первое {название}" kind "amber" do row>>
<<sg-state 1 label "Второе" kind "red-big" keykind "purple"><<set $done to 1>>
<<sg-row "1" "Закрытая" var "$l1" passage "LsClosed">>
<<sg-row "2" "Ключевая" var "$l2" passage "LsText" key>>
<</sg-list>>

:: LsClosed [sg-access] {"position":"700,4000","size":"100,100"}
<<sg-access lock "LsLock">>$open<<sg-rule link "Закрытая" from "LsLinks" do off>><</sg-access>>\\
Открыто

:: LsLock {"position":"800,4000","size":"100,100"}
Блокировка

:: LsMany {"position":"900,4000","size":"100,100"}
<<sg-list form button columns 3>>
<<sg-state 0 label "{номер}" color "#cc0000">>
<<sg-state 1 label "{название}" color "#00cc00">>
${rows99}
<</sg-list>>

:: LsFirst [sg-first-noise] {"position":"1000,4000","size":"100,100"}
<<sg-list form tile columns 2>>
<<sg-state 0 label "Отказ">>
<<sg-row "1" "Раз" var "$f1">>
<<sg-row "2" "Два" var "$f2">>
<</sg-list>>

:: LsCss [stylesheet] {"position":"0,4000","size":"100,100"}
html { --sg-first-noise: noise 0.4 0.1 0 90 #ffffff 1 - - - -; }

:: LsTable [sg-codes] {"position":"0,4100","size":"100,100"}
<<sg-entry "501" "Пароль процедуры">><<set $a to 2>><<sg-answer>>Принято<</sg-entry>>
`;

fs.writeFileSync(path.join(gameDir, 'list-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'list-test.twee'), path.join(gameDir, 'list-test.html')]);

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

const go = async (page, name, wait = 350) => {
	await page.evaluate(n => SugarCube.Engine.play(n), name);
	await page.waitForTimeout(wait);
};
const setVar = (page, name, value) => page.evaluate(([n, x]) => (SugarCube.State.variables[n] = x), [name, value]);
const getVar = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const where = page => page.evaluate(() => SugarCube.State.passage);
const items = async page => {
	await page.mouse.move(5, 5);
	await page.waitForTimeout(350);
	return page.$$eval('.sg-list-item', list =>
		list.map(item => {
			const el = item.querySelector('a, button, .sg-tile');
			const style = el && getComputedStyle(el);

			return {
				text: el ? el.textContent.trim() : '',
				tag: el ? el.tagName : '',
				wrap: item.firstElementChild && item.firstElementChild.tagName === 'SPAN' ? item.firstElementChild.className : '',
				color: style ? style.color : '',
				border: style ? style.borderTopColor : '',
				hidden: item.classList.contains('sg-acc-hide'),
				off: el ? el.classList.contains('sg-acc-off') : false,
				dpass: el ? el.getAttribute('data-passage') : null
			};
		})
	);
};
const dialogText = page => page.$eval('#ui-dialog-body', x => x.textContent.trim()).catch(() => '');
const dialogTitle = page => page.$eval('#ui-dialog-title', x => x.textContent.trim()).catch(() => '');

async function run(url, say) {
	const page = await open(url);

	/* Процедуры */
	await go(page, 'LsHome');
	let list = await items(page);

	say('три строки кнопками', list.length === 3 && list.every(i => i.tag === 'BUTTON'), JSON.stringify(list));
	say('пустая переменная — состояние 0', list[0].text === '001. Данные повреждены', list[0].text);
	say('цвет состояния у надписи и рамки', list[0].color === 'rgb(204, 0, 0)' && list[0].border === 'rgb(204, 0, 0)', JSON.stringify(list[0]));
	say('ключевая строка — вид состояния для ключевых', list[1].wrap === 'purple' && list[0].wrap === '', JSON.stringify(list));
	say('у ключевой цвет задаёт вид', list[1].color !== 'rgb(204, 0, 0)', list[1].color);

	const glow = await page.$eval('.sg-list-item button', b => getComputedStyle(b).boxShadow);
	say('свечение в цвет состояния', glow.includes('rgb(204, 0, 0)'), glow);
	await page.hover('.sg-list-item button');
	await page.waitForTimeout(450);
	const over = await page.$eval('.sg-list-item button', b => [getComputedStyle(b).color, getComputedStyle(b).backgroundColor]);
	say('при наведении цвета меняются местами', over[0] === 'rgb(0, 0, 0)' && over[1] === 'rgb(204, 0, 0)', over.join());
	await page.click('.sg-list-item button');
	await page.waitForTimeout(250);
	say('состояние без действия никуда не ведёт', (await where(page)) === 'LsHome');
	await page.mouse.move(5, 5);

	await setVar(page, 'a', 1);
	await page.waitForTimeout(400);
	list = await items(page);
	say('строка перерисовалась сама', list[0].text === '001. Нужен пароль' && list[0].color === 'rgb(255, 136, 0)', JSON.stringify(list[0]));
	await page.click('.sg-list-item button');
	await page.waitForTimeout(350);
	say('«нужен пароль» ведёт на экран кода', (await where(page)) === 'LsCode');

	await go(page, 'LsHome');
	await page.fill('input.sg-code', '501');
	await page.press('input.sg-code', 'Enter');
	await page.waitForTimeout(400);
	await page.click('#ui-dialog-close');
	await page.waitForTimeout(450);
	list = await items(page);
	say('код таблицы меняет состояние', (await getVar(page, 'a')) === 2 && list[0].text === '001. Нужна дешифровка', JSON.stringify(list[0]));
	await page.click('.sg-list-item button');
	await page.waitForTimeout(350);
	say('«нужна дешифровка» ведёт на дешифратор', (await where(page)) === 'LsDec');

	await setVar(page, 'a', 3);
	await go(page, 'LsHome');
	list = await items(page);
	say('доступен текст: название и зелёный', list[0].text === '001. Гибернация' && list[0].color === 'rgb(0, 204, 0)', JSON.stringify(list[0]));
	await page.click('.sg-list-item button');
	await page.waitForTimeout(450);
	say('текст открылся в окне', (await dialogText(page)) === 'Текст процедуры' && (await dialogTitle(page)) === 'Процедура 001', await dialogText(page));
	say('окно не переход', (await where(page)) === 'LsHome');
	await page.click('#ui-dialog-close');
	await page.waitForTimeout(200);

	await setVar(page, 'c', 3);
	await page.waitForTimeout(400);
	await page.locator('.sg-list-item button').nth(2).click();
	await page.waitForTimeout(300);
	say('нет экрана строки — ошибки нет, окна нет', !(await dialogText(page)));

	await setVar(page, 'b', 7);
	await page.waitForTimeout(400);
	list = await items(page);
	say('значения нет в списке — первое состояние', list[1].text === '002. Данные повреждены', list[1].text);

	/* Плитка */
	await go(page, 'LsTiles');
	list = await items(page);
	say('плитка: название и статус', list[0].text.includes('Реактор') && list[0].text.includes('Отказ') && list[0].tag === 'DIV', JSON.stringify(list[0]));
	say('плитка в цвете статуса', list[0].color === 'rgb(204, 0, 0)' && list[0].border === 'rgb(204, 0, 0)', JSON.stringify(list[0]));
	const tileBox = await page.$$eval('.sg-tile', t => t.map(x => x.getBoundingClientRect().width));
	const columns = await page.$eval('.sg-list-grid', g => getComputedStyle(g).gridTemplateColumns.split(' ').length);
	say('четыре столбца, плитки во всю ячейку', columns === 4 && tileBox[0] > 200, `${tileBox} ${columns}`);

	await setVar(page, 'r1', 1);
	await page.waitForTimeout(400);
	list = await items(page);
	say('статус сменился сам, с видом', list[0].text.includes('Норма') && list[0].tag === 'A' && list[0].wrap === 'amber' && list[0].color === 'rgb(0, 204, 0)', JSON.stringify(list[0]));
	if (shots) {
		await setVar(page, 'r2', 'ремонт');
		await page.mouse.move(5, 5);
		await page.waitForTimeout(600);
		await page.screenshot({path: path.join(shots, 'list-tiles.png')});
		await setVar(page, 'r2', 0);
		await page.waitForTimeout(400);
	}
	await setVar(page, 'r2', 'ремонт');
	await page.waitForTimeout(400);
	list = await items(page);
	say('текстовое значение и номер в статусе', list[1].text.includes('Ремонт 2'), list[1].text);
	await page.click('.sg-list-item:nth-child(2) a');
	await page.waitForTimeout(300);
	say('действие состояния выполнено', (await getVar(page, 'clicked')) === 1);
	await page.mouse.move(5, 5);
	await page.click('.sg-list-item:nth-child(1) a');
	await page.waitForTimeout(350);
	say('плитка ведёт на экран строки', (await where(page)) === 'LsText');

	/* Ссылки и «Доступ» */
	await go(page, 'LsLinks');
	list = await items(page);
	say('ссылки с видом', list[0].tag === 'A' && list[0].wrap === 'amber' && list[0].text === 'Первое Закрытая', JSON.stringify(list[0]));
	say('правило «Доступа» по названию строки', list[0].off === true, JSON.stringify(list[0]));
	await setVar(page, 'open', true);
	await page.waitForTimeout(400);
	list = await items(page);
	say('экран открылся — ссылка нажимается', list[0].off === false);
	await page.click('.sg-list-item a');
	await page.waitForTimeout(350);
	say('переход на открытый экран', (await where(page)) === 'LsClosed');
	await setVar(page, 'open', false);
	await setVar(page, 'l2', 1);
	await go(page, 'LsLinks');
	list = await items(page);
	say('ключевая: другой вид в другом состоянии', list[1].wrap === 'purple' && list[1].text === 'Второе', JSON.stringify(list[1]));

	/* 99 строк */
	await go(page, 'LsMany', 500);
	list = await items(page);
	say('99 строк', list.length === 99 && list[98].text === '099', String(list.length));
	await setVar(page, 'many50', 1);
	await page.waitForTimeout(400);
	list = await items(page);
	say('меняется только нужная строка', list[49].text === 'Процедура 050' && list[50].text === '051', list[49].text);
	if (shots) {
		await page.screenshot({path: path.join(shots, 'list-many.png')});
	}

	/* Первое посещение */
	await page.evaluate(() => SugarCube.Engine.play('LsFirst'));
	await page.waitForTimeout(150);
	const start = await page.$$eval('.sg-list-item', l => l.map(x => x.style.opacity));
	say('первое посещение: плитки возникают по очереди', start.some(o => o !== ''), JSON.stringify(start));
	await page.waitForFunction(() => !document.getElementById('sg-fv-canvas'), null, {timeout: 4000});
	const after = await page.$$eval('.sg-list-item', l => l.map(x => x.style.opacity));
	say('после эффекта плитки на месте', after.length === 2 && after.every(o => o === ''), JSON.stringify(after));

	/* Сбой */
	await setVar(page, 'a', 3);
	await go(page, 'LsHome');
	await page.click('.passage');
	await page.waitForTimeout(250);
	await page.goto(url);
	await page.waitForSelector('#sg-start, .passage');
	await page.click('#sg-start').catch(() => {});
	await page.waitForSelector('.sg-list-item');
	await page.waitForTimeout(400);
	list = await items(page);
	say('после сбоя то же состояние', (await where(page)) === 'LsHome' && list[0].text === '001. Гибернация', JSON.stringify(list[0]));
	await page.close();
}

for (const [url, prefix] of [
	[base + 'list-test.html', ''],
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
