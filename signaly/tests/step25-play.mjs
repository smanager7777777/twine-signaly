// Проверка сессии 25 в Chromium: статусы KR2 обновляются сами (ответ 1А),
// блок «Вставить экран» — обычный <<include>> (ответ 4А).
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node step25-play.mjs <история.twee (шаблон)> <папка с media> <playwright> <снимки или ""> [ещё игра.html …]
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
		.replace(/(:: StoryInit[^\n]*\n)/, `$1<<set $kh to 100>>
<<set $klog to false>>
<<set $kclicks to 0>>
`)
		.replace(/(:: Горячие клавиши[^\n]*\n)/, `$1<<sg-key "Shift+Z+D" "Журнал найден">><<set $klog to true>><</sg-key>>
`)
		.replace(/\s*$/, '\n') +
	`
:: KHome {"position":"100,9100","size":"100,100"}
Домашний экран
<<include "KPart">>
[[KRoom]]

:: KPart {"position":"200,9100","size":"100,100"}
<span id="k-part">Общий кусок: <<= $kh>></span>

:: KRoom [kr2] {"position":"300,9100","size":"100,100"}
<<kr2image "media/img/radio.jpg">>
<<kr2vars>>Здоровье: $kh
<<if $klog>>Журнал полёта: найден<br><</if>>\\
<<link "Подробнее">><<set $kclicks += 1>><<sg-open "Журнал">>Записи журнала<</sg-open>><</link>><</kr2vars>>
<<kr2main>>
Вы вошли в комнату.
<</kr2main>>
[[KHome]]

:: KTyped [kr2] {"position":"400,9100","size":"100,100"}
<<kr2vars>><<type 5ms>>Печать: $kh<</type>><</kr2vars>>
<<kr2main>>Текст<</kr2main>>
`;

fs.writeFileSync(path.join(gameDir, 'step25-test.twee'), test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, 'step25-test.twee'), path.join(gameDir, 'step25-test.html')]);

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

const vars = page => page.locator('#kr2-vars').innerText();

async function kr2Checks(url, say) {
	const page = await start(await open(url));

	await go(page, 'KRoom');

	let now = await vars(page);

	say('статусы KR2 при входе', /Здоровье: 100/.test(now) && !/Журнал полёта/.test(now), now);
	await page.evaluate(() => {
		window.sgMut = 0;
		new MutationObserver(list => (window.sgMut += list.length)).observe(document.getElementById('kr2-vars'), {childList: true, subtree: true, characterData: true});
	});
	await page.waitForTimeout(1100);
	say('без изменений зона статусов не перерисовывается', (await page.evaluate(() => window.sgMut)) === 0);
	await setVar(page, 'kh', 73);
	await page.waitForTimeout(450);
	now = await vars(page);
	say('значение в статусе поменялось без перехода', /Здоровье: 73/.test(now), now);
	say('экран тот же', (await page.evaluate(() => SugarCube.State.passage)) === 'KRoom');
	await key(page, 'KeyD');
	await page.waitForTimeout(450);
	now = await vars(page);
	say('строка «показывать, когда…» появилась после клавиши мастера', /Журнал полёта: найден/.test(now), now);
	await page.locator('#kr2-vars a', {hasText: 'Подробнее'}).click();
	await page.waitForTimeout(300);
	say('ссылка в обновлённой зоне работает', (await page.locator('#ui-dialog-body').innerText().catch(() => '')).includes('Записи журнала'));
	say('действие ссылки выполнено один раз', (await page.evaluate(() => SugarCube.State.variables.kclicks)) === 1);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
	await setVar(page, 'klog', false);
	await page.waitForTimeout(450);
	say('строка исчезла, когда условие стало ложным', !/Журнал полёта/.test(await vars(page)), await vars(page));
	say('остальные зоны KR2 на месте', (await page.locator('#kr2-main').innerText()).includes('Вы вошли в комнату') && (await page.locator('#kr2-nav a').count()) > 0);
	if (shots) {
		await page.screenshot({path: path.join(shots, 'step25-kr2.png')});
	}
	await go(page, 'KTyped', 600);
	const typed = await vars(page);

	await setVar(page, 'kh', 5);
	await page.waitForTimeout(600);
	say('статусы с печатью не перепечатываются (обновятся при входе)', (await vars(page)) === typed && /Печать: 73/.test(typed), typed);
	await go(page, 'KHome');
	await setVar(page, 'kh', 6);
	await page.waitForTimeout(450);
	say('на других экранах ничего не ломается', (await page.locator('#k-part').innerText()) === 'Общий кусок: 5');
	await page.context().close();
}

async function includeChecks(url, say) {
	const page = await start(await open(url));

	await go(page, 'KHome');
	say('«Вставить экран»: текст вставленного экрана на месте', (await page.locator('#k-part').innerText()) === 'Общий кусок: 100');
	await go(page, 'Start');
	say('кнопки звука шаблона вставлены через <<include>>', (await page.locator('.sg-place').count()) >= 7);
	await page.context().close();
}

const templateKr2 = async (url, say) => {
	const page = await start(await open(url));

	await go(page, 'Космические рейнджеры');
	await setVar(page, 'health', 42);
	await page.waitForTimeout(450);
	say('KR2 шаблона: «Здоровье» обновилось само', /Здоровье: 42/.test(await vars(page)), await vars(page));
	await page.context().close();
};

for (const [url, prefix] of [
	[base + 'step25-test.html', ''],
	...extra.map(file => [base + path.relative(gameDir, path.resolve(file)), `[${path.basename(file)}] `])
]) {
	const say = (name, ok, more) => check(prefix + name, ok, more);

	await kr2Checks(url, say);
	await includeChecks(url, say);
	await templateKr2(url, say);
}

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
