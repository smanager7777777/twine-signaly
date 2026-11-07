// «Twine СИГНАЛЫ»: строка событий и цикл на главном экране (шаг 4.1, ответы
// автора 3 и 6 порции к этапу 4). Настройки — обычный пассаж «Строка событий» с
// тегом sg-ticker (виден на карте, правится и в обычном Twine):
//   <<sg-ticker screen "Start" height 48 size 22 font "Consolas" speed 60
//     pause 2 hold 8 change 1.5 mode fade order "new,general,seen">>
//   <<sg-cycle var "$progress" spin 10 gap 0.5 from "20,20,20,20,20"
//     to "2,2,2,2,2" sound "media/audio/x.wav" volume 100>>
//   <<sg-cycle-at 7 "00487">>                — прогресс 7 = цикл 00487
//   <<sg-news "ВИП" general priority 1 minutes 10 times 3 color "#ff0000"
//     bold italic effect blink>>условие<<sg-text>>текст<</sg-news>>
// Условие пустое — сообщение включено всегда. Движок (с версии 11) рисует
// строку на экране screen, а условия и смену цикла проверяет на любом экране.

import {arg} from './signaly-link-form';
import {Cond, parseExpr} from './signaly-logic';
import {findClose, scanArgs, timerDefaults} from './signaly-screen-blocks';

export const tickerTag = 'sg-ticker';
export const tickerPassageName = 'Строка событий';

export const tickerHeader =
	'/* СИГНАЛЫ: строка событий и цикл — правьте в окне «Строка событий» (вкладка «История»).\n' +
	'   Этот экран игрокам не показывается. */';

/** Что показывать раньше: новые, общие, уже увиденные. */
export type NewsRank = 'new' | 'general' | 'seen';
export const defaultOrder: NewsRank[] = ['new', 'general', 'seen'];

export interface TickerLine {
	/** Экран, на котором стоит строка. */
	screen: string;
	height: number;
	size: number;
	/** Шрифт: '' — как у терминала, файл из media/fonts или имя системного. */
	font: string;
	/** Скорость прокрутки, точек в секунду. */
	speed: number;
	/** Секунды до начала прокрутки. */
	pause: number;
	/** Сколько секунд стоит текст, который умещается. */
	hold: number;
	/** Длительность смены сообщений, секунды. */
	change: number;
	mode: 'fade' | 'scroll';
	order: NewsRank[];
}

export interface CycleRow {
	progress: number;
	value: string;
}

export interface TickerCycle {
	/** Переменная прогресса без $ ('' — цикла нет). */
	variable: string;
	/** Через сколько секунд останавливается самая правая цифра. */
	spin: number;
	/** Сколько секунд проходит до остановки каждой следующей цифры левее. */
	gap: number;
	/** Скорость каждой из 5 цифр в начале, смен в секунду, слева направо. */
	from: number[];
	/** Скорость каждой из 5 цифр к остановке. */
	to: number[];
	sound: string;
	volume: number;
	/** Шрифт цифр: файл из media/fonts; 'none' — как у строки (сессия 26: по умолчанию DSEG7). */
	font: string;
	rows: CycleRow[];
}

export interface News {
	name: string;
	text: string;
	/** Условие, как написано ('' — всегда). */
	expr: string;
	/** Общее: новое общее сменяет старое. */
	general: boolean;
	priority: number;
	/** Сколько минут показывается после включения (0 — без срока). */
	minutes: number;
	/** Сколько раз показывается (0 — без счёта). */
	times: number;
	color: string;
	bold: boolean;
	italic: boolean;
	effect: '' | 'blink' | 'glitch';
}

export interface TickerData {
	line: TickerLine;
	cycle: TickerCycle;
	news: News[];
}

export const defaultLine = (screen: string): TickerLine => ({
	screen,
	height: 48,
	size: 22,
	font: '',
	speed: 60,
	pause: 2,
	hold: 8,
	change: 1.5,
	mode: 'fade',
	order: defaultOrder
});

export const cycleDigits = 5;

export const defaultCycle: TickerCycle = {
	variable: '',
	spin: 10,
	gap: 0.5,
	from: [20, 20, 20, 20, 20],
	to: [2, 2, 2, 2, 2],
	sound: '',
	volume: 100,
	font: timerDefaults.font,
	rows: []
};

export function newNews(news: News[]): News {
	let n = news.length + 1;

	while (news.some(item => item.name === `Сообщение ${n}`)) {
		n++;
	}
	return {
		name: `Сообщение ${n}`,
		text: '',
		expr: '',
		general: false,
		priority: 0,
		minutes: 0,
		times: 0,
		color: '',
		bold: false,
		italic: false,
		effect: ''
	};
}

/** Копия сообщения с новым именем (имя — ключ отметок в игре, оно одно на сообщение). */
export function copyNews(news: News[], item: News): News {
	let name = `${item.name} (копия)`;
	let n = 2;

	while (news.some(other => other.name === name)) {
		name = `${item.name} (копия ${n++})`;
	}
	return {...item, name};
}

/** Условие для формы: строки или undefined, если оно записано кодом. */
export function newsConds(expr: string): {conds: Cond[]; join: 'and' | 'or'} | undefined {
	if (expr.trim() === '') {
		return {conds: [], join: 'and'};
	}

	const parsed = parseExpr(expr);

	return parsed ? {conds: parsed.conds, join: parsed.join} : undefined;
}

interface Found {
	from: number;
	to: number;
	tokens: string[];
	body: string;
}

function findAll(text: string, name: string, container: boolean) {
	const result: Found[] = [];
	const re = new RegExp(`<<${name}(?=[\\s>])`, 'g');
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const head = scanArgs(text, m.index + name.length + 2);

		if (!head) {
			continue;
		}

		const close = container ? findClose(text, name, head.end) : undefined;

		if (container && !close) {
			continue;
		}
		result.push({
			from: m.index,
			to: close ? close.end : head.end,
			tokens: head.tokens,
			body: close ? text.slice(head.end, close.at) : ''
		});
		re.lastIndex = close ? close.end : head.end;
	}
	return result;
}

function unquote(token: string | undefined) {
	if (token === undefined) {
		return '';
	}

	const q = token[0];

	return (q === '"' || q === "'") && token[token.length - 1] === q
		? token.slice(1, -1).replace(/\\(.)/g, '$1')
		: token;
}

/** Слова команды: «ключ значение» и флаги. */
function readWords(tokens: string[], keys: string[]) {
	const values: Record<string, string> = {};
	const flags = new Set<string>();
	const words = tokens.slice();

	while (words.length) {
		const word = words.shift()!;

		if (keys.includes(word) && words.length) {
			values[word] = unquote(words.shift());
		} else {
			flags.add(word);
		}
	}
	return {values, flags};
}

function num(value: string | undefined, fallback: number) {
	const n = Number(value);

	return value === undefined || value === '' || !isFinite(n) ? fallback : n;
}

/** Скорости пяти цифр: «20,20,20,20,20»; непонятное — значение по умолчанию. */
function readRates(value: string | undefined, fallback: number[]) {
	const words = (value ?? '').split(',');

	return fallback.map((rate, i) => {
		const n = Number(words[i]);

		return words[i] !== undefined && words[i] !== '' && n > 0 ? n : rate;
	});
}

function readOrder(value: string | undefined) {
	const list = (value ?? '').split(',').filter((r): r is NewsRank => defaultOrder.includes(r as NewsRank));

	return defaultOrder.every(r => list.includes(r)) ? list : defaultOrder;
}

/** Строка, цикл и сообщения из текста пассажа. */
export function readTicker(text: string, startScreen: string): TickerData {
	const lineHead = findAll(text, 'sg-ticker', false)[0];
	const cycleHead = findAll(text, 'sg-cycle', false)[0];
	const line = defaultLine(startScreen);
	const cycle: TickerCycle = {...defaultCycle, rows: []};

	if (lineHead) {
		const {values} = readWords(lineHead.tokens, ['screen', 'height', 'size', 'font', 'speed', 'pause', 'hold', 'change', 'mode', 'order']);

		line.screen = values.screen ?? startScreen;
		line.height = num(values.height, line.height);
		line.size = num(values.size, line.size);
		line.font = values.font ?? '';
		line.speed = num(values.speed, line.speed);
		line.pause = num(values.pause, line.pause);
		line.hold = num(values.hold, line.hold);
		line.change = num(values.change, line.change);
		line.mode = values.mode === 'scroll' ? 'scroll' : 'fade';
		line.order = readOrder(values.order);
	}
	if (cycleHead) {
		const {values} = readWords(cycleHead.tokens, ['var', 'spin', 'gap', 'from', 'to', 'rate', 'sound', 'volume', 'font']);
		// rate — запись сборок до сессии 15: одна скорость на все цифры,
		// к концу в 15 раз меньше.
		const rate = num(values.rate, 0);

		cycle.variable = (values.var ?? '').replace(/^\$/, '');
		cycle.spin = num(values.spin, cycle.spin);
		cycle.gap = num(values.gap, cycle.gap);
		cycle.from = readRates(values.from, rate > 0 ? cycle.from.map(() => rate) : cycle.from);
		cycle.to = readRates(values.to, rate > 0 ? cycle.to.map(() => Math.max(1, Math.round(rate / 15))) : cycle.to);
		cycle.sound = values.sound ?? '';
		cycle.volume = num(values.volume, cycle.volume);
		cycle.font = values.font ?? cycle.font;
	}
	cycle.rows = findAll(text, 'sg-cycle-at', false).map(f => ({
		progress: num(unquote(f.tokens[0]), 0),
		value: unquote(f.tokens[1])
	}));

	const news = findAll(text, 'sg-news', true).map(f => {
		const words = f.tokens.slice();
		const name = unquote(words.shift());
		const {values, flags} = readWords(words, ['priority', 'minutes', 'times', 'color', 'effect']);
		const split = f.body.indexOf('<<sg-text>>');

		return {
			name,
			text: split === -1 ? '' : f.body.slice(split + '<<sg-text>>'.length).trim(),
			expr: (split === -1 ? f.body : f.body.slice(0, split)).trim(),
			general: flags.has('general'),
			priority: num(values.priority, 0),
			minutes: num(values.minutes, 0),
			times: num(values.times, 0),
			color: values.color ?? '',
			bold: flags.has('bold'),
			italic: flags.has('italic'),
			effect: values.effect === 'blink' || values.effect === 'glitch' ? values.effect : ''
		} as News;
	});

	return {line, cycle, news};
}

export function writeNews(n: News) {
	const words = [arg(n.name)];

	if (n.general) {
		words.push('general');
	}
	if (n.priority) {
		words.push(`priority ${n.priority}`);
	}
	if (n.minutes) {
		words.push(`minutes ${n.minutes}`);
	}
	if (n.times) {
		words.push(`times ${n.times}`);
	}
	if (n.color) {
		words.push(`color ${arg(n.color)}`);
	}
	if (n.bold) {
		words.push('bold');
	}
	if (n.italic) {
		words.push('italic');
	}
	if (n.effect) {
		words.push(`effect ${n.effect}`);
	}
	return `<<sg-news ${words.join(' ')}>>${n.expr.trim()}<<sg-text>>${n.text.trim()}<</sg-news>>`;
}

function writeLine(l: TickerLine) {
	const words = [
		`screen ${arg(l.screen)}`,
		`height ${l.height}`,
		`size ${l.size}`,
		...(l.font ? [`font ${arg(l.font)}`] : []),
		`speed ${l.speed}`,
		`pause ${l.pause}`,
		`hold ${l.hold}`,
		`change ${l.change}`,
		`mode ${l.mode}`,
		`order "${l.order.join(',')}"`
	];

	return `<<sg-ticker ${words.join(' ')}>>`;
}

function writeCycle(c: TickerCycle) {
	const words = [
		`var "$${c.variable}"`,
		`spin ${c.spin}`,
		`gap ${c.gap}`,
		`from "${c.from.join(',')}"`,
		`to "${c.to.join(',')}"`,
		...(c.sound ? [`sound ${arg(c.sound)}`, `volume ${c.volume}`] : []),
		...(c.font !== timerDefaults.font ? [`font ${arg(c.font || 'none')}`] : [])
	];

	return [
		`<<sg-cycle ${words.join(' ')}>>`,
		...c.rows.map(r => `<<sg-cycle-at ${r.progress} ${arg(r.value)}>>`)
	];
}

/** Записывает настройки в текст пассажа; всё остальное в нём остаётся. */
export function writeTicker(text: string, data: TickerData) {
	const found = ['sg-ticker', 'sg-cycle', 'sg-cycle-at']
		.flatMap(name => findAll(text, name, false))
		.concat(findAll(text, 'sg-news', true))
		.sort((a, b) => b.from - a.from);
	let rest = text;

	found.forEach(f => {
		rest = rest.slice(0, f.from) + rest.slice(f.to).replace(/^[ \t]*\n/, '');
	});

	const lines = [
		writeLine(data.line),
		...(data.cycle.variable ? writeCycle(data.cycle) : []),
		...data.news.map(writeNews)
	];
	const kept = rest.trim() || tickerHeader;

	return `${kept}\n${lines.join('\n')}`;
}

/** Цикл показывается пятью цифрами и только цифрами. */
export function validCycle(value: string) {
	return /^\d{1,5}$/.test(value);
}

/** Что мешает сохранить: повторы имён, строки цикла. */
export function tickerProblems(data: TickerData) {
	const names = data.news.map(n => n.name.trim());
	const progress = data.cycle.rows.map(r => r.progress);

	return {
		emptyName: names.some(n => n === ''),
		duplicateNames: [...new Set(names.filter((n, i) => n !== '' && names.indexOf(n) !== i))],
		badCycle: data.cycle.rows.some(r => !validCycle(r.value)),
		duplicateProgress: [...new Set(progress.filter((p, i) => progress.indexOf(p) !== i))]
	};
}
