// Проверка шаблона в Chromium: каждый пассаж открывается без ошибок SugarCube,
// медиа запрашиваются только из media/…, работают исправления 1–14.
// node template-play.mjs <путь к game.html> <путь к playwright> [папка для снимков]
import {createRequire} from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [gameFile, playwrightPath, shotsDir = '/tmp/signaly-shots'] =
	process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
fs.mkdirSync(shotsDir, {recursive: true});

// Папка игры отдаётся простым сервером: так видно, какие файлы игра просит.
const gameDir = path.dirname(path.resolve(gameFile));
const gameName = path.basename(gameFile);
const requested = new Set();
const missing = new Set();
const server = http
	.createServer((req, res) => {
		const url = decodeURIComponent(req.url.split('?')[0]);
		if (url !== '/' + gameName && url !== '/favicon.ico') requested.add(url);
		const file = path.join(gameDir, url);
		const types = {html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4', woff2: 'font/woff2'};
		if (!file.startsWith(gameDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
			if (url !== '/favicon.ico') missing.add(url);
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream'});
		fs.createReadStream(file).pipe(res);
	})
	.listen(0);
const port = server.address().port;

const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

const browser = await chromium.launch({
	args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
await page.goto(`http://localhost:${port}/${encodeURIComponent(gameName)}`);
// Шаг 1.2: стартовый экран — игра запускается по щелчку.
await page.waitForTimeout(800);
if (await page.$('#sg-start')) await page.click('#sg-start');
await page.waitForFunction(() => window.SugarCube && SugarCube.State && SugarCube.State.passage, null, {timeout: 20000});
await page.waitForTimeout(1500);

const sugarErrors = () =>
	page.evaluate(() =>
		[...document.querySelectorAll('.error-view, .error')].map(e => e.textContent.trim().slice(0, 200))
	);
const go = async (name, wait = 1200) => {
	await page.evaluate(n => {
		SugarCube.Dialog.close();
		SugarCube.Engine.play(n);
	}, name);
	await page.waitForTimeout(wait);
};

// 1. Каждый пассаж.
const names = await page.evaluate(() =>
	SugarCube.Story.filter(p => !p.tags.some(t => ['script', 'stylesheet', 'widget', 'StoryInit'].includes(t)) && !['StoryInit', 'StoryCaption', 'StoryMenu', 'PassageReady', 'PassageDone', 'drafts'].includes(p.name)).map(p => p.name)
);
for (const name of names) {
	const before = jsErrors.length;
	await go(name, 700);
	const errs = await sugarErrors();
	const js = jsErrors.slice(before);
	check(`пассаж ${name}`, errs.length === 0 && js.length === 0, [...errs, ...js].join(' | '));
}

// 2. Главный экран: цвета кнопок.
await go('Start', 1500);
await page.screenshot({path: path.join(shotsDir, 'start.png')});
const colors = await page.evaluate(() => {
	const color = el => el && getComputedStyle(el).color;
	const link = text => [...document.querySelectorAll('#passages a')].find(a => a.textContent.trim() === text);
	return {
		volumeA: color(link('A')),
		rad: color(link('РАД') || link('PAД')),
		menu: color(link('PRCDTEST')),
		red: color([...document.querySelectorAll('#passages button')].find(b => b.textContent.includes('Краснаякнопка'))),
		yellow: color(link('Желтая ссылка'))
	};
});
check('янтарные кнопки громкости', colors.volumeA === 'rgb(255, 191, 0)', colors.volumeA);
check('янтарная РАД', colors.rad === 'rgb(255, 191, 0)', colors.rad);
check('пункты меню зелёные (не янтарные)', colors.menu === 'rgb(0, 204, 0)', colors.menu);
check('красная кнопка', colors.red === 'rgb(204, 0, 0)', colors.red);
check('жёлтая ссылка', colors.yellow === 'rgb(204, 204, 0)', colors.yellow);

// 3. История в один шаг.
check('история в один шаг', await page.evaluate(() => SugarCube.Config.history.maxStates === 1));

// 4. Процедуры: одна строка вместо 99 веток.
await go('PRCDTEST');
await page.getByRole('button', {name: '002'}).click();
await page.waitForTimeout(500);
const prcd = await page.evaluate(() => document.querySelector('#ui-dialog-body')?.textContent.trim());
check('процедура 002 в окне', prcd === 'Процедура 2222222', prcd);
await page.evaluate(() => {
	SugarCube.State.variables.PRCD = 57;
	SugarCube.Dialog.close();
	SugarCube.Dialog.create('x').wikiPassage('PRCDRESULT').open();
});
const prcd57 = await page.evaluate(() => document.querySelector('#ui-dialog-body')?.textContent.trim());
check('несуществующая процедура без ошибки', prcd57 === 'Процедура не выбрана', prcd57);

// 5. Ввод кода.
await go('INPUTTEST');
await page.locator('input[type=text]').fill('33333');
await page.locator('input[type=text]').dispatchEvent('change');
await page.getByRole('button', {name: 'Подтвердить'}).click();
await page.waitForTimeout(500);
check('код 33333 → окно', (await page.evaluate(() => document.querySelector('#ui-dialog-title')?.textContent)) === 'Предустановленное инфо');

await go('PASSWORDTEST');
// С шага 1.4 поле пароля — блок <<sg-code password>>.
const pwd = await page.evaluate(() => document.querySelector('input[type=password]').value);
check('пароль: поле пустое, без <<print>>', pwd === '', pwd);
check('пароль: нет лишней строки «:: PasswordEntry»', !(await page.evaluate(() => document.querySelector('.passage').textContent.includes('PasswordEntry'))));

// 6. Хактест: строки ровные.
await go('Хактест', 1500);
const rows = await page.evaluate(() => [...document.querySelectorAll('.sg-hack-line')].map(d => d.textContent.length));
check('хактест: 10 строк по 60 знаков', rows.length === 10 && rows.every(n => n === 60), rows.join(','));
await page.screenshot({path: path.join(shotsDir, 'hacktest.png')});

// 7. KR2: здоровье задано.
await go('Космические рейнджеры', 1500);
const vars = await page.evaluate(() => document.querySelector('#kr2-vars')?.textContent.trim());
check('KR2: здоровье 100', vars === 'Здоровье: 100', vars);
await page.screenshot({path: path.join(shotsDir, 'kr2.png')});

// 8. TERRAFORM: «отремонтировано» не сбрасывается.
await page.evaluate(() => (SugarCube.State.variables.terraformrepaired = 1));
await go('TERRAFORM');
check('TERRAFORM: отметка ремонта сохраняется', await page.evaluate(() => SugarCube.State.variables.terraformrepaired === 1));

// 9. Таймер идёт в фоне и по окончании ведёт на Start.
// Скрытый таймер TERRAFORM_FAIL из обхода всех экранов (30 с) мог бы увести на TERRAFORM посреди проверки.
await page.evaluate(() => (SugarCube.State.variables.sgTimers = {}));
await go('Clocktest5', 1000);
const shown = await page.evaluate(() => (document.querySelector('.sg-timer') || document.querySelector('#countdown'))?.textContent);
check('таймер: табло мм:сс', /^\d\d:\d\d$/.test(shown || ''), shown);
await go('Texttests', 500);
await page.waitForTimeout(5500);
check('таймер: в фоне довёл до Start', (await page.evaluate(() => SugarCube.State.passage)) === 'Start');

// 10. Xiaomi: кнопка «Подключить камеру».
await go('XIAOMICAM');
check('XIAOMICAM: есть кнопка подключения', (await page.getByRole('button', {name: 'Подключить камеру'}).count()) === 1);

// 11. Медиа — только из media/….
await go('radio', 1500);
await go('TERRAFORM', 1000);
await go('TERRAFORM_SUCCESS', 1000);
await page.screenshot({path: path.join(shotsDir, 'terraform-success.png')});
const outside = [...requested].filter(u => !u.startsWith('/media/'));
check('все файлы запрашиваются из media/', outside.length === 0, outside.join(', '));
fs.writeFileSync(path.join(shotsDir, 'requested-media.txt'), [...requested].sort().join('\n') + '\n');

check('все файлы найдены', missing.size === 0, [...missing].join(', '));
check('нет ошибок JavaScript', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(results.every(Boolean) ? 'ВСЁ ХОРОШО' : 'ЕСТЬ ОШИБКИ');
process.exit(results.every(Boolean) ? 0 : 1);
