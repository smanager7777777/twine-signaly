// Проверка шага 3.3 в Chromium: горячие клавиши мастера.
// 1) Шаблон: Shift+Z+A/B/C кодом в JavaScript истории (сборка 12) и таблицей в
//    пассаже «Горячие клавиши» (движок 8) — то же окно (попиксельно), тот же
//    переход, те же звуки (файл, громкость, с начала / не перебивать).
// 2) Новое: «Спросить перед выполнением», «если … то … иначе», «через N
//    секунд», переход, встроенная «новая игра» на другой комбинации, поле
//    ввода (Z и буква не попадают в поле, переменная поля не меняется), до
//    запуска системы клавиши молчат.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node keys-play.mjs <было.twee> <стало.twee> <папка с media> <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [beforePath, afterPath, gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {readKeys, writeKeys} = require(path.join(tools, 'signaly-keys.js'));

const before = fs.readFileSync(beforePath, 'utf8').replace(/\r\n/g, '\n');
const after = fs.readFileSync(afterPath, 'utf8').replace(/\r\n/g, '\n');

// Тестовая копия: своя таблица (новая игра — на Shift+Z+M) и экран проверки.
const keysAt = after.indexOf(':: Горячие клавиши [sg-keys]');
const keysBody = after.slice(after.indexOf('\n', keysAt) + 1, after.indexOf('\n:: ', keysAt)).replace(/\s+$/, '');
const table = readKeys(keysBody);

table[0] = {...table[0], combo: 'Shift+Z+M', raw: undefined};
table.push(
	{
		combo: 'Shift+Z+Q',
		label: 'Следующая глава',
		goto: '',
		ask: true,
		actions: [{type: 'set', name: 'chapter', op: 'add', value: 1}],
		multiline: true,
		extra: []
	},
	{
		combo: 'Shift+Z+1',
		label: 'Если и потом',
		goto: '',
		ask: false,
		actions: [
			{
				type: 'if',
				expr: '$n is 0',
				then: [{type: 'set', name: 'n', op: 'to', value: 1}],
				else: [{type: 'set', name: 'n', op: 'to', value: 2}],
				multiline: false
			},
			{type: 'delay', seconds: 0.5, actions: [{type: 'set', name: 'm', op: 'to', value: 7}], multiline: false}
		],
		multiline: true,
		extra: []
	}
);

const initRe = /(:: StoryInit[^\n]*\n)/;
const test =
	after
		.replace(keysBody, writeKeys(keysBody, table))
		.replace(initRe, '$1<<set $n to 0>>\n<<set $m to 0>>\n<<set $chapter to 1>>\n')
		.replace(/\s*$/, '\n') +
	`
:: KeysTest {"position":"0,0","size":"100,100"}
n=$n m=$m глава=$chapter
`;

// Звук C — длиннее пустышки, чтобы было видно, начинается ли он заново.
{
	const rate = 8000;
	const samples = rate * 5;
	const wav = Buffer.alloc(44 + samples * 2);

	wav.write('RIFF', 0);
	wav.writeUInt32LE(36 + samples * 2, 4);
	wav.write('WAVEfmt ', 8);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(rate, 24);
	wav.writeUInt32LE(rate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write('data', 36);
	wav.writeUInt32LE(samples * 2, 40);
	fs.writeFileSync(path.join(gameDir, 'media/audio/radiovinyl.wav'), wav);
}

for (const [name, text] of Object.entries({before, after, test})) {
	fs.writeFileSync(path.join(gameDir, `keys-${name}.twee`), text);
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, `keys-${name}.twee`), path.join(gameDir, `keys-${name}.html`)]);
}

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

// Какие звуки играли: файл, громкость и позиция в момент play().
const spy = () => {
	window.__played = [];
	const play = HTMLMediaElement.prototype.play;

	HTMLMediaElement.prototype.play = function () {
		if (/\.(wav|mp3)$/.test(this.src) && /msgsoundA|click3|radiovinyl|signal/.test(this.src)) {
			window.__played.push({el: this, src: this.src.replace(/^.*\/media\//, 'media/'), volume: this.volume, time: this.currentTime});
		}
		return play.apply(this, arguments);
	};
};

async function open(file, start = true) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(`${file}: ${e.message}`));
	await page.addInitScript(spy);
	await page.goto(base + file);
	await page.waitForSelector('#sg-start');
	if (start) {
		await page.click('#sg-start');
		await page.waitForSelector('.passage');
		await page.waitForTimeout(300);
		await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
	}
	return page;
}

/** Удерживать Z, нажать Shift + клавишу (как мастер). */
async function combo(page, code) {
	await page.keyboard.down('z');
	await page.keyboard.down('Shift');
	await page.keyboard.press(code);
	await page.keyboard.up('Shift');
	await page.keyboard.up('z');
	await page.waitForTimeout(400);
}

const go = (page, name) => page.evaluate(n => SugarCube.Engine.play(n), name);
const v = (page, name) => page.evaluate(n => SugarCube.State.variables[n], name);
const passage = page => page.evaluate(() => SugarCube.State.passage);
const played = page => page.evaluate(() => window.__played.map(({src, volume, time}) => ({src, volume, time})));
const dialog = async page =>
	(await page.$('#ui-dialog.open'))
		? {title: await page.textContent('#ui-dialog-title'), body: (await page.innerText('#ui-dialog-body')).trim()}
		: null;

/* 1. Шаблон: код → таблица */
const runs = [];

for (const file of ['keys-before.html', 'keys-after.html']) {
	const page = await open(file);
	const run = {};

	await combo(page, 'KeyA');
	await page.waitForTimeout(500);
	run.a = {dialog: await dialog(page), sounds: await played(page), png: await page.screenshot({animations: 'disabled'})};
	await page.evaluate(() => SugarCube.Dialog.close());
	await page.waitForTimeout(400);

	// Повторное нажатие A начинает звук с начала.
	await page.evaluate(() => {
		const a = window.__played[0].el;

		a.loop = true;
		return a.play();
	});
	await page.waitForTimeout(400);
	await page.evaluate(() => (window.__played = []));
	await combo(page, 'KeyA');
	run.a2 = await played(page);
	await page.evaluate(() => SugarCube.Dialog.close());
	await page.waitForTimeout(300);

	await page.evaluate(() => (window.__played = []));
	await combo(page, 'KeyB');
	run.b = {passage: await passage(page), sounds: await played(page)};

	await page.evaluate(() => (window.__played = []));
	await combo(page, 'KeyC');
	run.c = await played(page);
	// Пока звук C ещё звучит, повторное нажатие его не перебивает.
	await page.waitForTimeout(500);
	await page.evaluate(() => (window.__played = []));
	await combo(page, 'KeyC');
	run.c2 = await played(page);
	runs.push(run);
	await page.close();
}

const [old, now] = runs;
const keysPassage = after.slice(keysAt, after.indexOf('\n:: ', keysAt));

check('код горячих клавиш убран из JavaScript истории', !after.includes('/* ===== Горячие клавиши мастера ===== */') && after.includes('перенесены в пассаж «Горячие клавиши»'));
check('пассаж «Горячие клавиши» с тегом sg-keys', keysAt !== -1 && keysPassage.includes('<<sg-key "Shift+Z+A" "Мастерское сообщение">>'));
check('A: то же окно (заголовок и текст)', JSON.stringify(old.a.dialog) === JSON.stringify(now.a.dialog) && now.a.dialog?.title === 'Мастерское сообщение', `${JSON.stringify(old.a.dialog)} ${JSON.stringify(now.a.dialog)}`);

let samePixels = old.a.png.equals(now.a.png);

if (!samePixels) {
	try {
		const sharp = require('/opt/npm-tools/node_modules/sharp');
		const [x, y] = await Promise.all([old.a.png, now.a.png].map(p => sharp(p).raw().toBuffer()));

		samePixels = x.equals(y);
	} catch (e) {
		console.log('sharp недоступен:', e.message);
	}
}
check('A: открытое окно совпадает попиксельно', samePixels);

const sounds = list => JSON.stringify(list.map(s => [s.src, s.volume, s.time === 0]));

check('A: тот же звук и громкость', sounds(old.a.sounds) === sounds(now.a.sounds) && now.a.sounds[0]?.src === 'media/audio/msgsoundA.wav', `${sounds(old.a.sounds)} ${sounds(now.a.sounds)}`);
check('A: повторно — звук с начала', old.a2.length === 1 && now.a2.length === 1 && old.a2[0].time === 0 && now.a2[0].time === 0, `${JSON.stringify(old.a2)} ${JSON.stringify(now.a2)}`);
check('B: тот же переход', old.b.passage === 'gotoPSG' && now.b.passage === 'gotoPSG', `${old.b.passage} ${now.b.passage}`);
check('B: тот же звук', sounds(old.b.sounds) === sounds(now.b.sounds) && now.b.sounds[0]?.src === 'media/audio/click3.wav', `${sounds(old.b.sounds)} ${sounds(now.b.sounds)}`);
check('C: тот же звук', sounds(old.c) === sounds(now.c) && now.c[0]?.src === 'media/audio/radiovinyl.wav', `${sounds(old.c)} ${sounds(now.c)}`);
check('C: пока звучит, не начинается заново', old.c2.length === 1 && now.c2.length === 1 && old.c2[0].time > 0.2 && now.c2[0].time > 0.2, `${JSON.stringify(old.c2)} ${JSON.stringify(now.c2)}`);

/* 2. Новое */
const page = await open('keys-test.html');

await go(page, 'KeysTest');
await page.waitForTimeout(300);

await combo(page, 'KeyQ');
let d = await dialog(page);

check('«Спросить»: окно «Да / Нет» с подписью', d?.title === 'Следующая глава' && /Выполнить «Следующая глава»\?/.test(d.body) && (await v(page, 'chapter')) === 1, JSON.stringify(d));
await page.click('#ui-dialog-body .sg-key-no');
await page.waitForTimeout(300);
check('«Нет» — ничего не делает', !(await dialog(page)) && (await v(page, 'chapter')) === 1);
await combo(page, 'KeyQ');
await page.click('#ui-dialog-body .sg-key-yes');
await page.waitForTimeout(300);
check('«Да» — действие выполнено', (await v(page, 'chapter')) === 2, String(await v(page, 'chapter')));

await combo(page, 'Digit1');
check('«если … то»: $n 0 → 1', (await v(page, 'n')) === 1 && (await passage(page)) === 'KeysTest' && (await v(page, 'm')) === 0, `${await v(page, 'n')} ${await v(page, 'm')}`);
await page.waitForTimeout(500);
check('«через 0,5 с»: $m = 7', (await v(page, 'm')) === 7, String(await v(page, 'm')));
await combo(page, 'Digit1');
check('«иначе»: $n 1 → 2', (await v(page, 'n')) === 2, String(await v(page, 'n')));

await combo(page, 'KeyN');
check('Shift+Z+N больше не «новая игра»', !(await dialog(page)));
await combo(page, 'KeyM');
d = await dialog(page);
check('Shift+Z+M — «Новая игра?»', d?.title === 'Новая игра', JSON.stringify(d));
await page.click('#ui-dialog-body .sg-new-game-no');
await page.waitForTimeout(300);

// Поле ввода: игрок набрал «ab», мастер нажимает Shift+Z+Q.
await go(page, 'INPUTTEST');
await page.waitForTimeout(300);
await page.click('input.sg-code');
await page.keyboard.type('ab');
await combo(page, 'KeyQ');
d = await dialog(page);
check('в поле ввода комбинация срабатывает', d?.title === 'Следующая глава', JSON.stringify(d));
await page.click('#ui-dialog-body .sg-key-no');
await page.waitForTimeout(300);
check('Z и буква не попали в поле, переменная поля та же', (await page.inputValue('input.sg-code')) === 'ab' && (await v(page, 'inputCode')) === 'ab', `${await page.inputValue('input.sg-code')} ${await v(page, 'inputCode')}`);
await page.click('input.sg-code');
await page.keyboard.type('z1');
check('обычная z в поле печатается', (await page.inputValue('input.sg-code')) === 'abz1', await page.inputValue('input.sg-code'));

check('без ошибок SugarCube на экране', (await page.$$('.passage .error')).length === 0);
await page.close();

// До запуска системы клавиши молчат.
const idle = await open('keys-test.html', false);

await combo(idle, 'KeyQ');
await combo(idle, 'KeyA');
check('до запуска системы — ничего не происходит', !(await dialog(idle)) && !!(await idle.$('#sg-start')));
await idle.close();

check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
