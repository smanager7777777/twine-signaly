// Проверка шага 3.1 в Chromium: перенос начальных значений StoryInit в раздел
// окна «Переменные» не меняет переменных игры; условие, состояния и значение
// переменной работают и меняются вместе с переменными; ссылка ↔ кнопка.
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// node logic-play.mjs <история.twee> <папка с media> <playwright>
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [tweePath, gameDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const tools = path.resolve(here, '../../.signaly-tools/src/util/signaly');
const {readVariables, withVariables} = require(path.join(tools, 'signaly-variables.js'));
const {writeStates, writeValue} = require(path.join(tools, 'signaly-logic.js'));

const before = fs.readFileSync(tweePath, 'utf8').replace(/\r\n/g, '\n');
const initRe = /(:: StoryInit[^\n]*\n)([^]*?)(\n:: )/;
const initText = initRe.exec(before)[2];

/** История с новым StoryInit. */
const withInit = (twee, variables) =>
	twee.replace(initRe, (_, head, text, tail) => head + withVariables(text, variables) + tail);

const moved = withInit(before, readVariables(initText).variables);
const logic =
	withInit(before, [
		...readVariables(initText).variables,
		{name: 'chapter', label: 'Глава', value: 1},
		{name: 'flightlog1', label: 'Журнал полёта', value: false},
		{name: 'PRCD', label: 'Процедура', value: 0}
	]).replace(/\s*$/, '\n') +
	`
:: LogicTest {"position":"0,0","size":"100,100"}
<<if $chapter gt 1 and $flightlog1>>СЕКРЕТ<<else>>НЕТ<</if>>
${writeStates({
	expr: '$PRCD',
	cases: [
		{value: '0', content: 'Данные повреждены', kind: 'red-big'},
		{value: '1', content: '<<button "Нужен пароль">><</button>>', kind: 'amber'},
		{content: 'ГОТОВО', kind: ''}
	]
})}
${writeValue({name: 'chapter', label: 'Глава', of: 5})}
${writeValue({name: 'flightlog1', label: 'Журнал', yes: 'найден', no: 'не найден'})}
<<link "дальше">><<set $chapter to 2>><<set $flightlog1 to true>><<set $PRCD to 1>><<goto "LogicTest">><</link>>
`;

const files = {before: before, moved, logic};

for (const [name, text] of Object.entries(files)) {
	fs.writeFileSync(path.join(gameDir, `logic-${name}.twee`), text);
	execFileSync('node', [path.join(here, 'publish-twee.mjs'), path.join(gameDir, `logic-${name}.twee`), path.join(gameDir, `logic-${name}.html`), 'debug']);
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

async function open(file) {
	const page = await browser.newPage({viewport: {width: 1920, height: 1080}});

	page.on('pageerror', e => errors.push(e.message));
	await page.goto(base + file);
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(300);
	return page;
}

const vars = page => page.evaluate(() => JSON.stringify(SugarCube.State.variables));

/* Перенос StoryInit: те же переменные */
const p1 = await open('logic-before.html');
const p2 = await open('logic-moved.html');
const v1 = await vars(p1);
const v2 = await vars(p2);

check('раздел «Переменные» в StoryInit: переменные игры те же', v1 === v2, `${v1}\n${v2}`);
check('StoryInit шаблона: раздел появился, сложный код не тронут', moved.includes('СИГНАЛЫ: переменные') && moved !== before);
await p1.close();
await p2.close();

/* Условие, состояния, значение */
const page = await open('logic-logic.html');

await page.evaluate(() => SugarCube.Engine.play('LogicTest'));
await page.waitForTimeout(300);

const look = () =>
	page.evaluate(() => {
		const p = document.querySelector('.passage');
		const red = p.querySelector('.red-big');
		const amberButton = p.querySelector('.amber button');

		return {
			text: p.innerText,
			red: red ? getComputedStyle(red.closest('.red-big')).color : null,
			button: amberButton ? amberButton.textContent : null,
			errors: p.querySelectorAll('.error').length
		};
	});
let s = await look();

check('условие не выполнено — «иначе»', s.text.includes('НЕТ') && !s.text.includes('СЕКРЕТ'), s.text);
check('состояние 0 — красный текст', s.text.includes('Данные повреждены') && s.red !== null && s.button === null, JSON.stringify(s));
check('значения: «Глава: 1 из 5», «Журнал: не найден»', s.text.includes('Глава: 1 из 5') && s.text.includes('Журнал: не найден'), s.text);
check('без ошибок SugarCube', s.errors === 0);
check('лишних пустых строк нет', !/\n\n/.test(s.text.split('Данные повреждены')[0]), JSON.stringify(s.text));
await page.click('.passage a:text("дальше")');
await page.waitForTimeout(400);
s = await look();
check('переменные изменились — условие выполнено', s.text.includes('СЕКРЕТ') && !s.text.includes('НЕТ'), s.text);
check('состояние 1 — янтарная кнопка', s.button === 'Нужен пароль' && !s.text.includes('Данные повреждены'), JSON.stringify(s));
check('значения: «Глава: 2 из 5», «Журнал: найден»', s.text.includes('Глава: 2 из 5') && s.text.includes('Журнал: найден'), s.text);
await page.evaluate(() => {
	SugarCube.State.variables.PRCD = 7;
	SugarCube.Engine.play('LogicTest');
});
await page.waitForTimeout(300);
s = await look();
check('другое значение — «в остальных случаях»', s.text.includes('ГОТОВО') && s.button === null, s.text);
check('ошибок на странице нет', errors.length === 0, errors.join('; '));

await browser.close();
server.close();

const failed = results.filter(ok => !ok).length;

console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
process.exit(failed ? 1 : 0);
