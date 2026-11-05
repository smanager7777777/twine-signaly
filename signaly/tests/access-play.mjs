// Проверка шага 4.3 в Chromium: закрытые экраны.
// Тестовая история — шаблон + экраны с <<sg-access>>: ссылка скрыта вместе с
// обёрткой и строкой, видна, но не нажимается, ведёт на блокировку (общую,
// свою у экрана, свою у ссылки); ссылка появляется сама, когда экран открылся;
// «Вернуться» ведёт туда, откуда пришли; код раньше времени (блокировка,
// «Неверный код», «Нет доступа», пропустить, не тратится, личный код не
// спрашивает); клавиши мастера, событие, таймер, тревога.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node access-play.mjs <история.twee (шаблон)> <папка с media> <playwright> [ещё игра.html …]
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {writeCodes, defaultTexts} = require(path.join(tools, 'signaly-codes.js'));

const story = fs.readFileSync(storyPath, 'utf8').replace(/\r\n/g, '\n');
const entry = (code, label, more = {}) => ({code, label, who: [], once: '', title: '', answer: '', goto: '', denied: '', used: '', actions: [], multiline: false, extra: [], ...more});
const codesText = writeCodes('', {
	texts: defaultTexts,
	people: [{id: '2', pin: '222', variable: '', extra: []}],
	codes: [
		entry('205', 'На блокировку', {goto: 'AcCoded'}),
		entry('206', 'Неверный', {goto: 'AcWrong'}),
		entry('207', 'Нет доступа', {goto: 'AcDenied'}),
		entry('208', 'Пропустить', {goto: 'AcPass'}),
		entry('209', 'Одноразовый', {goto: 'AcOnce', once: 'all', actions: [{type: 'code', code: '<<set $acRan += 1>>'}]}),
		entry('210', 'С личным кодом', {goto: 'AcPin', who: ['2']})
	]
});
const back = '<<link "Назад">><<sg-back>><</link>>';
const test =
	story
		.replace(/(:: StoryInit[^\n]*\n)/, '$1<<set $acOpen to false>>\n<<set $acEv to false>>\n<<set $acRan to 0>>\n<<set $acInput to "">>\n')
		.replace(/\s*$/, '\n') +
	`
:: Коды [sg-codes] {"position":"0,0","size":"100,100"}
${codesText}

:: Горячие клавиши [sg-keys] {"position":"0,100","size":"100,100"}
<<sg-key "Shift+Z+A" "Мимо" goto "AcKeyPass">><</sg-key>>
<<sg-key "Shift+Z+B" "Блок" goto "AcKeyBlock">><</sg-key>>
<<sg-key "Shift+Z+C" "Стоять" goto "AcKeyStay">><<set $acRan to 50>><</sg-key>>

:: AcHome {"position":"100,0","size":"100,100"}
Первая строка
<span class="amber">[[Скрытая|AcHide]]</span>
Вторая строка
Текст [[Вместе|AcHide]] в строке
[[Неактивная|AcOff]]
<<button "Кнопка" "AcOff">><</button>>
[[К блокировке|AcBlock]]
[[К своей|AcOwn]]
[[Своя у ссылки|AcMix]]
[[Пустить|AcRuled]]
<<sg-place corner tr x 5 y 5>><<link "Верх" "AcHide">><</link>><</sg-place>>
<<link "Открыть">><<set $acOpen to true>><</link>>
<<link "Закрыть">><<set $acOpen to false>><</link>>
<<sg-code var "$acInput" table>><<sg-case "301" goto "AcCase">>Принято<</sg-code>>

:: AcSide {"position":"200,0","size":"100,100"}
На стороне
[[Там|AcMix]]

:: AcTyped {"position":"200,100","size":"100,100"}
<<type 5ms>>[[Печать|AcHide]]<</type>>
[[Пустить|AcRuled]]

:: AcWindow {"position":"300,100","size":"100,100"}
<<sg-dialog "Окно" title "Окно">>Внутри [[Спрятать|AcHide]]<</sg-dialog>>

:: AcPlain {"position":"400,100","size":"100,100"}
Текст экрана

:: AcHide [sg-access] {"position":"300,0","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Текст экрана

:: AcOff [sg-access] {"position":"400,0","size":"100,100"}
<<sg-access links off>>$acOpen<</sg-access>>\\
Экран off

:: AcBlock [sg-access] {"position":"500,0","size":"100,100"}
<<sg-access links block>>$acOpen<</sg-access>>\\
Экран block

:: AcOwn [sg-access] {"position":"600,0","size":"100,100"}
<<sg-access lock "AcOwnLock" links block>>$acOpen<</sg-access>>\\
Экран own

:: AcMix [sg-access] {"position":"700,0","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule link "Своя у ссылки" from "AcHome" do block to "AcOwnLock">>
<</sg-access>>\\
Экран mix

:: AcRuled [sg-access] {"position":"750,100","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule link "Пустить" from "AcHome" do pass>>
<</sg-access>>\\
Экран ruled

:: AcLock [sg-lock] {"position":"800,0","size":"100,100"}
Ещё слишком рано
${back}

:: AcOwnLock {"position":"900,0","size":"100,100"}
Своя блокировка
${back}

:: AcCoded [sg-access] {"position":"100,200","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Код: блок

:: AcWrong [sg-access] {"position":"200,200","size":"100,100"}
<<sg-access codes wrong>>$acOpen<</sg-access>>\\
Код: неверный

:: AcDenied [sg-access] {"position":"300,200","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule code "207" do denied>>
<</sg-access>>\\
Код: нет доступа

:: AcPass [sg-access] {"position":"400,200","size":"100,100"}
<<sg-access codes pass>>$acOpen<</sg-access>>\\
Код: пропущен

:: AcOnce [sg-access] {"position":"500,200","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Код: один раз

:: AcPin [sg-access] {"position":"600,200","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Код: личный

:: AcCase [sg-access] {"position":"700,200","size":"100,100"}
<<sg-access lock "AcOwnLock">>$acOpen<</sg-access>>\\
Код поля

:: AcKeyPass [sg-access] {"position":"100,300","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Клавиша прошла

:: AcKeyBlock [sg-access] {"position":"200,300","size":"100,100"}
<<sg-access keys block>>$acOpen<</sg-access>>\\
Клавиша блок

:: AcKeyStay [sg-access] {"position":"300,300","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule key "Shift+Z+C" do stay>>
<</sg-access>>\\
Клавиша стоит

:: AcEvWait [sg-access sg-event] {"position":"400,300","size":"100,100"}
<<sg-access events stay>>$acOpen<</sg-access>>\\
<<sg-event $acEv>>
Событие ждало

:: AcEvGo [sg-access sg-event] {"position":"500,300","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
<<sg-event $acRan is 7>>
Событие прошло

:: AcTimers {"position":"600,300","size":"100,100"}
Таймеры
<<sg-timer "T1" seconds 1 goto "AcTimerGo" hidden>>

:: AcTimers2 {"position":"700,300","size":"100,100"}
Таймер стоит
<<sg-timer "T2" seconds 1 goto "AcTimerStay" hidden>>

:: AcTimerGo [sg-access] {"position":"800,300","size":"100,100"}
<<sg-access>>$acOpen<</sg-access>>\\
Таймер прошёл

:: AcTimerStay [sg-access] {"position":"900,300","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule auto "timer:T2" do stay>>
<</sg-access>>\\
Таймер не прошёл

:: AcAlarm {"position":"600,400","size":"100,100"}
<<sg-alarm close click goto "AcAlarmGo">>ТРЕВОГА<</sg-alarm>>

:: AcAlarmGo [sg-access] {"position":"700,400","size":"100,100"}
<<sg-access>>$acOpen
<<sg-rule auto "alarm:AcAlarm" do block>>
<</sg-access>>\\
После тревоги
`;

fs.writeFileSync(path.join(gameDir, 'access-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'access-test.twee'), path.join(gameDir, 'access-test.html')]);

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
const v = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const seen = (page, selector) => page.isVisible(selector);
const a = text => `.passage a:text-is("${text}")`;
const link = async (page, text) => {
	await page.click(a(text));
	await page.waitForTimeout(350);
};
async function enter(page, value) {
	const field = await page.$('.passage input.sg-code');

	await field.fill(value);
	await field.press('Enter');
	await page.waitForTimeout(350);
}
async function combo(page, key) {
	await page.keyboard.down('z');
	await page.keyboard.down('Shift');
	await page.keyboard.press(key);
	await page.keyboard.up('Shift');
	await page.keyboard.up('z');
	await page.waitForTimeout(350);
}
const dialog = page => page.evaluate(() => (SugarCube.Dialog.isOpen() ? document.querySelector('#ui-dialog-body').innerText.trim() : ''));
const closeDialog = async page => {
	await page.evaluate(() => SugarCube.Dialog.close());
	await page.waitForTimeout(200);
};
const lines = async page => (await page.innerText('.passage')).split('\n').map(s => s.trim());

async function newChecks(url, prefix) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const page = await open(url);

	await go(page, 'AcHome');
	let text = await lines(page);

	say('ответ 4А: скрытая ссылка ушла со строкой и обёрткой', text[0] === 'Первая строка' && text[1] === 'Вторая строка', JSON.stringify(text.slice(0, 4)));
	say('обёртка вида спрятана', await page.evaluate(() => getComputedStyle(document.querySelector('.passage span.amber')).display === 'none'));
	say('ссылка в строке с текстом — текст остаётся', text.join('|').includes('Текст  в строке') || text.join('|').includes('Текст в строке'), text.join('|'));
	say('кнопка на экране исчезает целиком', await page.evaluate(() => [...document.querySelectorAll('.sg-place')].some(p => p.textContent === 'Верх' && getComputedStyle(p).display === 'none')));
	say('«ссылки не показывать» по умолчанию; своя у ссылки — показана', !(await seen(page, a('Скрытая'))) && (await seen(page, a('Своя у ссылки'))) && (await seen(page, a('Пустить'))));

	// Показывать, но не нажимается: и ссылка, и кнопка.
	const off = await page.locator(a('Неактивная')).boundingBox();

	say('«показывать, но не нажимается» — ссылка видна', off && off.width > 0);
	await page.mouse.click(off.x + 5, off.y + 5);
	await page.waitForTimeout(300);
	say('щелчок по ней ничего не делает', (await passage(page)) === 'AcHome');
	const button = await page.locator('.passage button:text-is("Кнопка")').boundingBox();

	await page.mouse.click(button.x + 5, button.y + 5);
	await page.waitForTimeout(300);
	say('кнопка тоже не нажимается', (await passage(page)) === 'AcHome' && (await seen(page, '.passage button:text-is("Кнопка")')));

	// Общая блокировка и «Вернуться».
	await link(page, 'К блокировке');
	say('ссылка ведёт на общий пассаж блокировки (тег sg-lock)', (await passage(page)) === 'AcLock');
	await link(page, 'Назад');
	say('«Вернуться» — откуда пришли', (await passage(page)) === 'AcHome');
	await link(page, 'К своей');
	say('свой пассаж блокировки у экрана', (await passage(page)) === 'AcOwnLock');
	await link(page, 'Назад');
	await link(page, 'Своя у ссылки');
	say('своё поведение и свой пассаж у ссылки', (await passage(page)) === 'AcOwnLock');
	await link(page, 'Назад');
	await link(page, 'Пустить');
	say('«пропускать» у отдельной ссылки: экран закрыт, а она ведёт', (await passage(page)) === 'AcRuled');

	await go(page, 'AcSide');
	say('та же цель с другого экрана — общее поведение (скрыта)', !(await seen(page, a('Там'))) && (await lines(page))[0] === 'На стороне');
	await go(page, 'AcTyped');
	await page.waitForTimeout(300);
	say('ссылка в печатающемся тексте скрыта', !(await seen(page, a('Печать'))));
	await go(page, 'AcWindow');
	await page.click('.passage a:text-is("Окно")');
	await page.waitForTimeout(300);
	say('ссылка в окне-сообщении скрыта', !(await seen(page, '#ui-dialog-body a:text-is("Спрятать")')) && (await dialog(page)).includes('Внутри'));
	await closeDialog(page);

	// Строка команды ничего не выводит.
	await go(page, 'AcPlain');
	const plain = await page.evaluate(() => document.querySelector('.passage').getBoundingClientRect().height);

	await setVar(page, 'acOpen', true);
	await go(page, 'AcHide');
	const closedRow = await page.evaluate(() => document.querySelector('.passage').getBoundingClientRect().height);

	say('экран открыт — ссылка ведёт; команда не оставляет пустой строки', (await passage(page)) === 'AcHide' && plain === closedRow, `${plain} ${closedRow}`);
	await setVar(page, 'acOpen', false);

	// Ссылка появляется сама.
	await go(page, 'AcHome');
	await link(page, 'Открыть');
	await page.waitForTimeout(350);
	text = await lines(page);
	say('экран открылся — ссылка и строка вернулись сами', (await seen(page, a('Скрытая'))) && text[1] === 'Скрытая', text.slice(0, 3).join('|'));
	say('кнопка на экране и «неактивная» — тоже', (await seen(page, '.sg-place a')) && (await page.evaluate(() => !document.querySelector('.sg-acc-off'))));
	await link(page, 'Закрыть');
	await page.waitForTimeout(350);
	say('снова закрылся — снова скрыта', !(await seen(page, a('Скрытая'))));
	await link(page, 'Открыть');
	await page.waitForTimeout(300);
	await link(page, 'Неактивная');
	say('открытый экран: «неактивная» нажимается', (await passage(page)) === 'AcOff');

	// После сбоя экран остаётся, хотя он закрылся.
	await setVar(page, 'acOpen', false);
	await page.evaluate(() => SugarCube.Engine.show());
	await page.waitForTimeout(350);
	say('показ того же экрана заново не уводит', (await passage(page)) === 'AcOff');

	// Коды.
	await go(page, 'AcHome');
	await enter(page, '205');
	say('код раньше времени — на пассаж блокировки', (await passage(page)) === 'AcLock');
	await link(page, 'Назад');
	await enter(page, '206');
	say('поведение «Неверный код»', (await passage(page)) === 'AcHome' && (await dialog(page)) === defaultTexts.wrong, await dialog(page));
	await closeDialog(page);
	await enter(page, '207');
	say('своё у кода: «Нет доступа»', (await passage(page)) === 'AcHome' && (await dialog(page)) === defaultTexts.denied, await dialog(page));
	await closeDialog(page);
	await enter(page, '208');
	say('«пропускать»: код проходит на закрытый экран', (await passage(page)) === 'AcPass');
	await go(page, 'AcHome');
	await enter(page, '209');
	say('одноразовый раньше времени: блокировка', (await passage(page)) === 'AcLock');
	say('код не потрачен, действия не выполнены', (await v(page, 'acRan')) === 0 && !((await v(page, 'sgUsed')) || {})['209']);
	await link(page, 'Назад');
	await enter(page, '210');
	say('раньше времени личный код не спрашивается', (await passage(page)) === 'AcLock');
	await link(page, 'Назад');
	await enter(page, '301');
	say('код самого поля: свой пассаж экрана', (await passage(page)) === 'AcOwnLock');
	await link(page, 'Назад');
	await setVar(page, 'acOpen', true);
	await enter(page, '209');
	say('экран открыт: код срабатывает', (await passage(page)) === 'AcOnce' && (await v(page, 'acRan')) === 1 && (await v(page, 'sgUsed'))['209'] === true);
	await go(page, 'AcHome');
	await enter(page, '210');
	say('экран открыт: личный код спрашивается', (await page.$$('.passage input.sg-code')).length === 2);
	await enter(page, '');
	await closeDialog(page);
	await setVar(page, 'acOpen', false);

	// Клавиши мастера.
	await go(page, 'AcHome');
	await combo(page, 'A');
	say('ответ 3А: клавиша мастера проходит всегда', (await passage(page)) === 'AcKeyPass');
	await go(page, 'AcHome');
	await combo(page, 'B');
	say('клавише можно задать блокировку', (await passage(page)) === 'AcLock');
	await go(page, 'AcHome');
	await combo(page, 'C');
	say('«не переходить»: действия выполнены, экран тот же', (await passage(page)) === 'AcHome' && (await v(page, 'acRan')) === 50);
	await setVar(page, 'acRan', 1);

	// События.
	await setVar(page, 'acEv', true);
	await page.waitForTimeout(500);
	say('событие с поведением «ждать» ждёт, пока экран закрыт', (await passage(page)) === 'AcHome');
	await setVar(page, 'acOpen', true);
	await page.waitForTimeout(500);
	say('экран открылся — событие сработало', (await passage(page)) === 'AcEvWait');
	await setVar(page, 'acOpen', false);
	await go(page, 'AcHome');
	await setVar(page, 'acRan', 7);
	await page.waitForTimeout(500);
	say('ответ 3А: событие на закрытый экран проходит', (await passage(page)) === 'AcEvGo');

	// Таймеры и тревога.
	await go(page, 'AcTimers');
	await page.waitForTimeout(1300);
	say('ответ 3А: таймер проходит на закрытый экран', (await passage(page)) === 'AcTimerGo');
	await go(page, 'AcTimers2');
	await page.waitForTimeout(1300);
	say('таймеру можно задать «не переходить»', (await passage(page)) === 'AcTimers2');
	await go(page, 'AcAlarm');
	await page.click('.sg-alarm');
	await page.waitForTimeout(350);
	say('тревоге можно задать блокировку', (await passage(page)) === 'AcLock');

	// После сбоя игроки остаются на закрытом экране.
	await setVar(page, 'acOpen', true);
	await go(page, 'AcHide');
	await page.evaluate(() => SugarCube.State.variables.acOpen = false);
	await page.waitForTimeout(100);
	await page.click('.passage');
	await page.waitForTimeout(200);
	await open(url, page);
	say('сбой: тот же экран, хотя он закрылся', (await passage(page)) === 'AcHide', await passage(page));
	await page.close();
}

await newChecks(base + 'access-test.html', '');
for (const file of extra) {
	await newChecks(base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
