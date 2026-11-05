// Проверка шага 4.2 в Chromium: виды экранов, стили текста, поля ввода.
// node screens-play.mjs <шаблон.twee> <папка с media> <playwright> [ещё игра.html …]
// Перед запуском: npx tsc -p signaly/tools/tsconfig.json
// Пишет screens-test.twee|html в папку с медиа; «ещё игра.html» — та же тестовая
// история, опубликованная в другом месте (обычный Twine).
import {createRequire} from 'module';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [storyPath, gameDir, playwrightPath, ...extra] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const tools = path.join(root, '.signaly-tools/src/util/signaly');
const {newScreenView, newTextStyle} = require(path.join(tools, 'signaly-screens.js'));
const {defaultLine, writeTicker, defaultCycle} = require(path.join(tools, 'signaly-ticker.js'));

const view = (id, more) => ({...newScreenView([], 'Вид'), name: id, id, ...more});
const style = (id, more) => ({...newTextStyle([], 'Стиль'), name: id, id, ...more});
const font = 'media/fonts/DSEG7Classic-Regular.woff2';
const settings = {
	vignette: 40,
	noise: 0,
	flicker: true,
	inputOn: true,
	inputBg: '#112233',
	inputColor: '#ffee00',
	inputBorderColor: '#ff00ff',
	inputBorderWidth: 3,
	inputGlow: 0,
	inputSize: 31,
	inputWidth: 333,
	screens: [
		view('red', {frame: 'none', size: 'full', winBg: '#cc0000', textColor: '#000000', fontSize: 100, textPlace: 'mc', flicker: 'off', vignette: 'off'}),
		view('white', {frame: 'none', size: 'full', winBg: '#ffffff', textColor: '#000000', fontSize: 14, textPlace: 'br', padding: 30}),
		view('green', {
			frame: 'own',
			borderWidth: 6,
			borderColor: '#004400',
			glowSize: 0,
			size: 'own',
			winWidth: 900,
			winHeight: 700,
			winOffsetX: 100,
			winOffsetY: 50,
			pageBg: '#003300',
			winBg: '#00aa00',
			textColor: '#002200',
			font,
			padding: 40,
			textPlace: 'tc',
			noise: 'on',
			noiseValue: 30,
			vignette: 'on',
			vignetteValue: 70
		}),
		view('middle', {textPlace: 'ml'})
	],
	textStyles: [
		style('big', {font, size: 40, color: '#ff8800', glow: 6}),
		style('para', {lineHeight: 2.5, size: 20})
	]
};
const out = path.join(gameDir, 'screens-base.twee');

execFileSync('node', [path.join(root, '.signaly-tools/signaly/tools/migrate-twee.js'), storyPath, out, JSON.stringify(settings)], {stdio: 'pipe'});

const button = '<<sg-place corner tr x 5 y 2>><<link "РАД">><</link>><</sg-place>>';
const tickerText = writeTicker('', {
	line: {...defaultLine('ScMiddle'), height: 50},
	cycle: {...defaultCycle},
	news: []
});
const test =
	fs.readFileSync(out, 'utf8').replace('"start": "Start"', '"start": "ScPlain"').replace(/\s*$/, '\n') +
	`
:: Строка событий [sg-ticker] {"position":"0,0","size":"100,100"}
${tickerText}

:: ScPlain {"position":"100,0","size":"100,100"}
Обычный экран
${button}
<span class="sg-ts-big">Крупный стиль</span> и обычный текст
<span class="sg-ts-para">Абзац со своим интервалом, первая строка.
Вторая строка.</span>
<<sg-code var "$scCode">>
<</sg-code>>

:: ScRed [sg-scr-red] {"position":"200,0","size":"100,100"}
Вам здесь не место
${button}

:: ScWhite [sg-scr-white] {"position":"300,0","size":"100,100"}
Мелкий текст
${button}

:: ScGreen [sg-scr-green] {"position":"400,0","size":"100,100"}
Зелёный экран
${button}

:: ScMiddle [sg-scr-middle] {"position":"500,0","size":"100,100"}
Текст по центру слева
${button}

:: ScLong [sg-scr-red] {"position":"600,0","size":"100,100"}
${'Длинный текст, который не помещается на экран. '.repeat(40)}
`;
const twee = path.join(gameDir, 'screens-test.twee');
const html = path.join(gameDir, 'screens-test.html');

fs.writeFileSync(twee, test);
execFileSync('node', [path.join(here, 'publish-twee.mjs'), twee, html], {stdio: 'pipe'});

const mime = {'.html': 'text/html; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2'};
const serve = dir =>
	new Promise(resolve => {
		const server = http.createServer((req, res) => {
			const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));

			fs.readFile(file, (err, data) => {
				if (err) {
					res.writeHead(404);
					res.end();
				} else {
					res.writeHead(200, {'content-type': mime[path.extname(file)] ?? 'application/octet-stream'});
					res.end(data);
				}
			});
		});

		server.listen(0, () => resolve({server, base: `http://127.0.0.1:${server.address().port}/`}));
	});

let fails = 0;
let total = 0;
const check = (name, ok, more) => {
	total++;
	if (!ok) {
		fails++;
	}
	console.log(`${ok ? 'OK ' : 'ОШИБКА '} ${name}${!ok && more !== undefined ? ` — ${JSON.stringify(more)}` : ''}`);
};

const browser = await chromium.launch();

const look = page =>
	page.evaluate(() => {
		const box = e => {
			const r = e.getBoundingClientRect();

			return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
		};
		const win = document.getElementById('passages');
		const passage = document.querySelector('.passage');
		const fx = document.getElementById('sg-fx');
		const css = getComputedStyle(win);
		const text = getComputedStyle(passage);
		const before = getComputedStyle(fx, '::before');
		const after = getComputedStyle(fx, '::after');
		const button = [...document.querySelectorAll('a')].find(a => a.textContent === 'РАД');

		return {
			win: box(win),
			passage: box(passage),
			fx: box(fx),
			button: button ? box(button) : null,
			border: css.borderTopWidth,
			borderColor: css.borderTopColor,
			shadow: css.boxShadow,
			bg: css.backgroundColor,
			pageBg: getComputedStyle(document.body).backgroundColor,
			color: text.color,
			size: text.fontSize,
			family: text.fontFamily,
			align: text.textAlign,
			flicker: css.animationName,
			vignette: before.content,
			vignetteBg: before.backgroundImage,
			noise: after.content,
			noiseOpacity: after.opacity
		};
	});

async function run(url, prefix) {
	const say = (name, ok, more) => check(prefix + name, ok, more);
	const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
	const page = await context.newPage();
	const errors = [];

	page.on('pageerror', e => errors.push(String(e)));
	await page.goto(url);
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(400);

	const go = async name => {
		await page.evaluate(n => SugarCube.Engine.play(n), name);
		await page.waitForTimeout(500);
		return look(page);
	};

	const plain = await look(page);

	say('обычный экран: окно 1050×1050, рамка 2', plain.win.width === 1050 && plain.border === '2px', plain);
	say('обычный экран: мерцание и затемнение углов из общего', plain.flicker === 'sg-flicker' && plain.vignette !== 'none', plain);

	/* Красный: без рамки, на весь экран, крупный чёрный по центру */
	const red = await go('ScRed');

	say('красный: окно на весь экран', red.win.left === 0 && red.win.top === 0 && red.win.width === 1920 && red.win.height === 1080, red.win);
	say('красный: без рамки и свечения', red.border === '0px' && red.shadow === 'none', [red.border, red.shadow]);
	say('красный: цвет заливки', red.bg === 'rgb(204, 0, 0)', red.bg);
	say('красный: крупный чёрный текст', red.color === 'rgb(0, 0, 0)' && red.size === '100px', [red.color, red.size]);
	say('красный: текст по центру экрана', Math.abs((red.passage.left + red.passage.right) / 2 - 960) < 2 && Math.abs((red.passage.top + red.passage.bottom) / 2 - 540) < 2 && red.align === 'center', red.passage);
	say('красный: мерцание и углы выключены', red.flicker === 'none' && red.vignette === 'none', [red.flicker, red.vignette]);
	say('кнопка на экране не прыгает', JSON.stringify(red.button) === JSON.stringify(plain.button), [red.button, plain.button]);
	say('слой эффектов — по новому окну', red.fx.width === 1920 && red.fx.height === 1080, red.fx);

	/* Белый: мелкий текст снизу справа */
	const white = await go('ScWhite');

	say('белый: мелкий чёрный текст', white.color === 'rgb(0, 0, 0)' && white.size === '14px' && white.bg === 'rgb(255, 255, 255)', white);
	say('белый: снизу справа, у отступа 30', Math.abs(white.passage.right - 1890) < 2 && Math.abs(white.passage.bottom - 1050) < 2 && white.align === 'right', white.passage);
	say('белый: мерцание как в общем', white.flicker === 'sg-flicker', white.flicker);

	/* Зелёный: свой размер, рамка, шрифт, эффекты */
	const green = await go('ScGreen');

	say('зелёный: свой размер и сдвиг', green.win.width === 900 && green.win.height === 700 && green.win.left === 610 && green.win.top === 240, green.win);
	say('зелёный: своя рамка', green.border === '6px' && green.borderColor === 'rgb(0, 68, 0)' && green.shadow === 'none', [green.border, green.borderColor, green.shadow]);
	say('зелёный: фон окна и фон вокруг', green.bg === 'rgb(0, 170, 0)' && green.pageBg === 'rgb(0, 51, 0)', [green.bg, green.pageBg]);
	say('зелёный: свой шрифт', green.family.includes('sg-scr-font-green'), green.family);
	say('зелёный: шрифт загрузился', await page.evaluate(() => document.fonts.check('20px "sg-scr-font-green"')));
	say('зелёный: шум включён, хотя в общем выключен', green.noise !== 'none' && green.noiseOpacity === '0.3', [green.noise, green.noiseOpacity]);
	say('зелёный: своя сила затемнения', green.vignetteBg.includes('0.7'), green.vignetteBg);
	say('зелёный: сверху по центру', Math.abs((green.passage.left + green.passage.right) / 2 - 1060) < 2 && Math.abs(green.passage.top - (240 + 6 + 40)) < 2, green.passage);
	say('кнопка на экране и тут не прыгает', JSON.stringify(green.button) === JSON.stringify(plain.button), green.button);

	/* Экран со строкой событий */
	const middle = await go('ScMiddle');

	say('вид со строкой событий: строка сверху, текст ниже', await page.evaluate(() => {
		const strip = document.getElementById('sg-ticker').getBoundingClientRect();
		const text = document.querySelector('.passage').getBoundingClientRect();
		const win = document.getElementById('passages').getBoundingClientRect();

		return strip.top <= win.top + 5 && text.top > strip.bottom && text.left < win.left + 40;
	}), middle.passage);
	say('вид только сдвинул текст: окно обычное', middle.win.width === 1050 && middle.border === '2px', middle.win);

	/* Длинный текст */
	await go('ScLong');
	say('длинный текст на виде по центру прокручивается с начала', await page.evaluate(() => {
		const win = document.getElementById('passages');
		const text = document.querySelector('.passage');

		win.scrollTop = 0;
		return win.scrollHeight > win.clientHeight && text.getBoundingClientRect().top >= -1;
	}));

	/* Возврат */
	const back = await go('ScPlain');

	// Слой эффектов на самом первом экране встаёт по рамке в течение секунды.
	delete back.fx;
	delete plain.fx;

	say('вернулись на обычный: всё как было', JSON.stringify(back) === JSON.stringify(plain), Object.keys(back).filter(k => JSON.stringify(back[k]) !== JSON.stringify(plain[k])).map(k => [k, back[k], plain[k]]));
	say('на обычном нет тега вида', await page.evaluate(() => !document.documentElement.hasAttribute('data-tags')));

	/* Стили текста */
	const big = await page.evaluate(() => {
		const css = getComputedStyle(document.querySelector('.sg-ts-big'));

		return {font: css.fontFamily, size: css.fontSize, color: css.color, shadow: css.textShadow, display: css.display};
	});

	say('стиль: шрифт, размер, цвет, свечение', big.font.includes('sg-ts-font-big') && big.size === '40px' && big.color === 'rgb(255, 136, 0)' && big.shadow.includes('6px'), big);
	say('стиль без интервала остаётся в строке', big.display === 'inline', big.display);
	say('стиль с интервалом: высота строки своя', await page.evaluate(() => {
		const el = document.querySelector('.sg-ts-para');
		const css = getComputedStyle(el);

		return css.display === 'inline-block' && css.lineHeight === '50px' && css.fontSize === '20px' && css.color === getComputedStyle(document.querySelector('.passage')).color;
	}));

	/* Поле ввода */
	await page.mouse.move(5, 5);
	await page.evaluate(() => document.activeElement.blur());
	const field = await page.evaluate(() => {
		const el = document.querySelector('input.sg-code');
		const css = getComputedStyle(el);

		return {bg: css.backgroundColor, color: css.color, border: css.borderTopWidth, borderColor: css.borderTopColor, size: css.fontSize, width: el.getBoundingClientRect().width, shadow: css.boxShadow};
	});

	say('поле ввода: цвета и рамка', field.bg === 'rgb(17, 34, 51)' && field.color === 'rgb(255, 238, 0)' && field.border === '3px' && field.borderColor === 'rgb(255, 0, 255)', field);
	say('поле ввода: размер, ширина, без свечения', field.size === '31px' && field.width === 333 && field.shadow === 'none', field);

	/* Сбой */
	await go('ScRed');
	await page.reload();
	await page.waitForSelector('#sg-start');
	await page.click('#sg-start');
	await page.waitForSelector('.passage');
	await page.waitForTimeout(500);
	say('после сбоя вид экрана тот же', (await look(page)).bg === 'rgb(204, 0, 0)');
	say('ошибок нет', errors.length === 0, errors);
	await context.close();
}

const {server, base} = await serve(gameDir);

await run(`${base}screens-test.html`, '');
for (const file of extra) {
	const name = path.basename(file);

	if (path.resolve(file) !== path.join(path.resolve(gameDir), name)) {
		fs.copyFileSync(file, path.join(gameDir, name));
	}
	await run(`${base}${name}`, `${name}: `);
}
server.close();
await browser.close();
console.log(fails ? `Ошибок: ${fails} из ${total}` : `ВСЁ ХОРОШО: ${total}/${total}`);
