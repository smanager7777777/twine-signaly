// «Twine СИГНАЛЫ»: блоки экрана (шаг 1.4, ответы автора — решение 52).
// Блок в тексте пассажа — короткая команда движка (имена только латиницей,
// таковы правила SugarCube), например:
//   <<sg-image "media/img/radio.jpg" width 400 place screen corner tr x 120 y 50>>
//   <<sg-video "media/video/a.mp4" width 1000 height 1000 autoplay loop muted>>
//   <<sg-alarm bg "#cc0000" color "#000000" size 70 close click>>ТРЕВОГА<</sg-alarm>>
//   <<sg-dialog "Открыть" title "Заголовок" passage "showPSGinfo">><</sg-dialog>>
//   <<sg-code password button "Подтвердить">>
//   <<sg-case "11111" goto "gotoPSG">>
//   <<sg-wrong title "Ошибка">>Неверный код
//   <</sg-code>>
//   <<sg-place kind amber corner tr x 5 y 20>><<link "РАД">>…<</link>><</sg-place>>
//   (кнопка на экране — с сессии 6 место задаётся у самого элемента)
//   <<sg-timer "Clocks" minutes 5 goto "Start">>          (шаг 2.3: таймер)
//   <<sg-chain width 1000 height 1000 goto "Start">>      (шаг 2.3: цепочка видео)
//   <<sg-step "media/video/a.mp4" loop muted next click>>
//   <<sg-step "media/video/b.mp4" next end>>
//   <</sg-chain>>
//   <<sg-articles columns 2 headings>>                    (шаг 4.4: список статей)
// Окно KR2 — команды <<kr2image>>, <<kr2layout>>, <<kr2vars>>, <<kr2main>>.
// Команды понимает движок (signaly-engine.ts) — и в обычном Twine тоже.
//
// Здесь — разбор команд и запись обратно. Всё, что формы не понимают
// (неизвестные слова в команде), сохраняется как есть.

export type BlockType =
	| 'image'
	| 'video'
	| 'alarm'
	| 'dialog'
	| 'code'
	| 'place'
	| 'timer'
	| 'chain'
	| 'articles';
export type CaseKind = 'case' | 'wrong';
type PartKind = CaseKind | 'step';
export type Value = string | number | boolean;
export type Values = Record<string, Value | undefined>;

export const blockMacros: Record<BlockType, string> = {
	image: 'sg-image',
	video: 'sg-video',
	alarm: 'sg-alarm',
	dialog: 'sg-dialog',
	code: 'sg-code',
	place: 'sg-place',
	timer: 'sg-timer',
	chain: 'sg-chain',
	articles: 'sg-articles'
};

const partMacros: Record<PartKind, string> = {case: 'sg-case', wrong: 'sg-wrong', step: 'sg-step'};

export const blockTypes = Object.keys(blockMacros) as BlockType[];

interface ArgSpec {
	/** Значения без названия — по порядку в начале команды. */
	pos: string[];
	/** Значения с названием: «width 400». */
	keys: Record<string, 'string' | 'number'>;
	/** Слова-галочки: «loop». */
	flags: string[];
	container: boolean;
}

const placeKeys = {
	place: 'string',
	corner: 'string',
	x: 'number',
	y: 'number',
	border: 'number',
	color: 'string',
	glow: 'number'
} as const;

const actionKeys = {
	goto: 'string',
	title: 'string',
	passage: 'string',
	sound: 'string'
} as const;

/**
 * Вид табло таймера по умолчанию (шаг 2.3, ответ 3А) — как #timer-display
 * в стилях автора. Движок берёт те же значения.
 */
export const timerDefaults = {
	font: 'media/fonts/DSEG7Classic-Regular.woff2',
	color: '#cc0000',
	bg: '#000000',
	size: 125,
	border: 2,
	glow: 10
};

const specs: Record<BlockType | PartKind, ArgSpec> = {
	image: {pos: ['src'], keys: {width: 'number', ...placeKeys}, flags: [], container: false},
	video: {
		pos: ['src'],
		keys: {width: 'number', height: 'number', ...placeKeys},
		flags: ['autoplay', 'loop', 'muted', 'controls', 'buttons'],
		container: false
	},
	alarm: {
		pos: [],
		keys: {
			bg: 'string',
			color: 'string',
			size: 'number',
			blink: 'number',
			sound: 'string',
			volume: 'number',
			close: 'string',
			seconds: 'number',
			goto: 'string'
		},
		flags: ['loop'],
		container: true
	},
	dialog: {
		pos: ['label'],
		keys: {title: 'string', passage: 'string', close: 'string', seconds: 'number', ok: 'string'},
		flags: ['button'],
		container: true
	},
	code: {
		pos: [],
		keys: {var: 'string', button: 'string', gap: 'number'},
		// table — проверять ещё и по общей таблице кодов (шаг 3.4).
		flags: ['password', 'focus', 'clear', 'table'],
		container: true
	},
	place: {
		pos: [],
		// hover, click — свой звук (шаг 2.2): имя набора или none (без звука).
		keys: {kind: 'string', corner: 'string', x: 'number', y: 'number', hover: 'string', click: 'string'},
		flags: [],
		container: true
	},
	// Шаг 2.3: таймер. start running — только табло уже идущего таймера;
	// goto / title + text или passage / sound — что по окончании; hidden — без
	// табло; font none — шрифт терминала; format hms — ЧЧ:ММ:СС.
	timer: {
		pos: ['name'],
		keys: {
			hours: 'number',
			minutes: 'number',
			seconds: 'number',
			start: 'string',
			...actionKeys,
			text: 'string',
			font: 'string',
			color: 'string',
			bg: 'string',
			size: 'number',
			border: 'number',
			glow: 'number',
			format: 'string'
		},
		flags: ['hidden'],
		container: false
	},
	// Шаг 2.3: цепочка видео — шаги <<sg-step>> внутри.
	chain: {
		pos: [],
		keys: {width: 'number', height: 'number', ...placeKeys, goto: 'string'},
		flags: [],
		container: true
	},
	// Шаг 4.4: список статей; sections — через запятую, нет — все статьи.
	articles: {
		pos: [],
		keys: {sections: 'string', form: 'string', kind: 'string', columns: 'number'},
		flags: ['headings'],
		container: false
	},
	case: {pos: ['code'], keys: actionKeys, flags: [], container: false},
	wrong: {pos: [], keys: actionKeys, flags: [], container: false},
	// next: click (щелчок по видео) / end (видео закончилось) / time (через seconds).
	step: {pos: ['src'], keys: {next: 'string', seconds: 'number'}, flags: ['loop', 'muted'], container: false}
};

export interface CodeCase {
	kind: CaseKind;
	values: Values;
	extra: string[];
	/** Текст сообщения (разметка SugarCube). */
	content: string;
}

export interface ScreenBlock {
	type: BlockType;
	/** Где блок в тексте (вместе с закрывающей командой). */
	from: number;
	to: number;
	/** Конец открывающей команды. */
	headTo?: number;
	values: Values;
	/** Непонятые слова команды — сохраняются как есть. */
	extra: string[];
	/** Содержимое (тревога, окно-сообщение). */
	content?: string;
	/** Таблица «код → действие» (поле кода). */
	cases?: CodeCase[];
	/** Шаги цепочки видео. */
	steps?: ChainStep[];
}

export interface ChainStep {
	values: Values;
	extra: string[];
}

/* ----- Разбор аргументов, как в SugarCube ----- */

/** Слова команды до «>>» с учётом кавычек. Возвращает слова и конец команды. */
export function scanArgs(text: string, at: number) {
	const tokens: string[] = [];
	let i = at;

	while (i < text.length) {
		const ch = text[i];

		if (ch === '>' && text[i + 1] === '>') {
			return {tokens, end: i + 2};
		}
		if (/\s/.test(ch)) {
			i++;
			continue;
		}

		const start = i;

		if (ch === '"' || ch === "'" || ch === '`') {
			i++;
			while (i < text.length && text[i] !== ch) {
				i += text[i] === '\\' ? 2 : 1;
			}
			i++;
		} else if (ch === '[' && text[i + 1] === '[') {
			const close = text.indexOf(']]', i);

			i = close === -1 ? text.length : close + 2;
		} else {
			while (
				i < text.length &&
				!/\s/.test(text[i]) &&
				!(text[i] === '>' && text[i + 1] === '>')
			) {
				i++;
			}
		}
		tokens.push(text.slice(start, Math.min(i, text.length)));
	}
	return undefined;
}

function unquote(token: string): Value {
	const q = token[0];

	if (q === '"' || q === "'") {
		const body = token.slice(1, -1);

		return body.replace(/\\(.)/g, (_, c: string) =>
			c === 'n' ? '\n' : c === 't' ? '\t' : c
		);
	}

	const number = Number(token);

	if (token !== '' && !isNaN(number)) {
		return number;
	}
	return token;
}

/** Строка в кавычках для команды. */
export function quote(value: string) {
	return (
		'"' +
		value
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n')
			.replace(/\t/g, '\\t') +
		'"'
	);
}

function round(value: number) {
	return String(Math.round(value * 100) / 100);
}

function readValues(tokens: string[], spec: ArgSpec) {
	const values: Values = {};
	const extra: string[] = [];
	let i = 0;

	spec.pos.forEach(name => {
		if (i < tokens.length) {
			values[name] = unquote(tokens[i++]);
		}
	});

	while (i < tokens.length) {
		const word = tokens[i];

		if (spec.flags.includes(word)) {
			values[word] = true;
			i++;
		} else if (word in spec.keys && i + 1 < tokens.length) {
			let value = unquote(tokens[i + 1]);

			if (spec.keys[word] === 'string' && typeof value === 'number') {
				value = tokens[i + 1];
			}
			values[word] = value;
			i += 2;
		} else {
			extra.push(word);
			i++;
		}
	}
	return {values, extra};
}

function writeValue(value: Value) {
	return typeof value === 'number' ? round(value) : quote(String(value));
}

const bareKeys = ['place', 'corner', 'close', 'kind', 'form', 'hover', 'click', 'start', 'format', 'next', 'font'];

function writeArgs(values: Values, extra: string[], spec: ArgSpec) {
	const parts: string[] = [];

	spec.pos.forEach(name => {
		const value = values[name];

		parts.push(value === undefined || value === false ? '""' : writeValue(value));
	});
	Object.keys(spec.keys).forEach(name => {
		const value = values[name];

		// Пустой пассаж окна пишется («passage ""»), чтобы форма помнила выбор.
		if (value === undefined || value === false || (value === '' && name !== 'passage')) {
			return;
		}
		// Слова place, corner, close, kind пишутся без кавычек — так читается легче.
		parts.push(
			name,
			typeof value === 'string' && bareKeys.includes(name) && /^[a-z]+$/.test(value)
				? value
				: writeValue(value)
		);
	});
	spec.flags.forEach(name => {
		if (values[name] === true) {
			parts.push(name);
		}
	});
	parts.push(...extra);
	return parts.length ? ' ' + parts.join(' ') : '';
}

/* ----- Поиск блоков в тексте ----- */

const openRe = /<<sg-(image|video|alarm|dialog|code|place|timer|chain|articles)(?=[\s>])/g;

function macroType(name: string): BlockType | undefined {
	return blockTypes.find(type => blockMacros[type] === 'sg-' + name);
}

/** Конец парной команды с учётом вложенных команд с тем же именем. */
export function findClose(text: string, name: string, from: number) {
	const re = new RegExp(`<<(/?)${name}(?=[\\s>])`, 'g');
	let depth = 1;
	let match: RegExpExecArray | null;

	re.lastIndex = from;
	while ((match = re.exec(text))) {
		depth += match[1] ? -1 : 1;
		if (depth === 0) {
			const end = text.indexOf('>>', match.index);

			return end === -1 ? undefined : {at: match.index, end: end + 2};
		}
	}
	return undefined;
}

function parseCases(content: string, re = /<<sg-(case|wrong)(?=[\s>])/g): CodeCase[] {
	const cases: CodeCase[] = [];
	const heads: Array<{kind: CaseKind; at: number; end: number; tokens: string[]}> = [];
	let match: RegExpExecArray | null;

	while ((match = re.exec(content))) {
		const scan = scanArgs(content, match.index + match[0].length);

		if (!scan) {
			break;
		}
		heads.push({
			kind: match[1] as CaseKind,
			at: match.index,
			end: scan.end,
			tokens: scan.tokens
		});
		re.lastIndex = scan.end;
	}
	heads.forEach((head, index) => {
		const next = index + 1 < heads.length ? heads[index + 1].at : content.length;
		const {values, extra} = readValues(head.tokens, specs[head.kind]);

		cases.push({
			kind: head.kind,
			values,
			extra,
			content: content.slice(head.end, next).replace(/^\n/, '').replace(/\s+$/, '')
		});
	});
	return cases;
}

/** Все блоки экрана в тексте пассажа по порядку. */
export function findBlocks(text: string): ScreenBlock[] {
	const blocks: ScreenBlock[] = [];
	let match: RegExpExecArray | null;

	openRe.lastIndex = 0;
	while ((match = openRe.exec(text))) {
		const type = macroType(match[1])!;
		const spec = specs[type];
		const scan = scanArgs(text, match.index + match[0].length);

		if (!scan) {
			break;
		}

		const {values, extra} = readValues(scan.tokens, spec);
		const block: ScreenBlock = {
			type,
			from: match.index,
			to: scan.end,
			headTo: scan.end,
			values,
			extra
		};

		if (spec.container) {
			const close = findClose(text, blockMacros[type], scan.end);

			if (!close) {
				// Нет закрывающей команды — блок не трогаем.
				openRe.lastIndex = scan.end;
				continue;
			}

			const content = text.slice(scan.end, close.at);

			block.to = close.end;
			if (type === 'code') {
				block.cases = parseCases(content);
			} else if (type === 'chain') {
				// Текст между шагами не показывается — его не храним.
				block.steps = parseCases(content, /<<sg-(step)(?=[\s>])/g).map(step => ({
					values: step.values,
					extra: step.extra
				}));
			} else {
				block.content = content;
			}
		}
		blocks.push(block);
		// Внутри тревоги, окна и кнопки на экране могут стоять другие блоки и
		// эффекты — их тоже ищем (у поля кода внутри — таблица кодов, у цепочки —
		// шаги).
		openRe.lastIndex = type === 'code' || type === 'chain' ? block.to : scan.end;
	}
	return blocks;
}

/** Самый внутренний из диапазонов, внутри которого стоит курсор (номер или -1). */
export function innermostAt(ranges: Array<{from: number; to: number}>, index: number) {
	let best = -1;

	ranges.forEach((r, i) => {
		if (index > r.from && index < r.to && (best === -1 || r.from >= ranges[best].from)) {
			best = i;
		}
	});
	return best;
}

/** Блок, внутри которого стоит курсор (смещение), или undefined. */
export function blockAt(text: string, index: number) {
	const blocks = findBlocks(text);

	return blocks[innermostAt(blocks, index)];
}

/** Текст блока для вставки в пассаж. */
export function writeBlock(block: Omit<ScreenBlock, 'from' | 'to'>) {
	const name = blockMacros[block.type];
	const spec = specs[block.type];
	const head = `<<${name}${writeArgs(block.values, block.extra, spec)}>>`;

	if (!spec.container) {
		return head;
	}
	if (block.type === 'code') {
		const lines = (block.cases ?? []).map(
			c =>
				`<<${partMacros[c.kind]}${writeArgs(c.values, c.extra, specs[c.kind])}>>` +
				c.content
		);

		return `${head}\n${lines.join('\n')}\n<</${name}>>`;
	}
	if (block.type === 'chain') {
		const lines = (block.steps ?? []).map(
			s => `<<${partMacros.step}${writeArgs(s.values, s.extra, specs.step)}>>`
		);

		return `${head}\n${lines.map(line => line + '\n').join('')}<</${name}>>`;
	}
	return `${head}${block.content ?? ''}<</${name}>>`;
}

/** Только открывающая команда блока (без содержимого и закрывающей). */
export function writeBlockHead(
	type: BlockType,
	values: Values,
	extra: string[]
) {
	return `<<${blockMacros[type]}${writeArgs(values, extra, specs[type])}>>`;
}

/** Заменить блок в тексте новым. */
export function replaceBlock(
	text: string,
	block: ScreenBlock,
	changed: Omit<ScreenBlock, 'from' | 'to'>
) {
	const insert = writeBlock(changed);

	return {
		text: text.slice(0, block.from) + insert + text.slice(block.to),
		from: block.from,
		to: block.from + insert.length
	};
}

/** Новый блок с начальными значениями. */
export function newBlock(type: BlockType): Omit<ScreenBlock, 'from' | 'to'> {
	switch (type) {
		case 'image':
			return {type, values: {src: '', width: 400}, extra: []};
		case 'video':
			return {
				type,
				values: {src: '', width: 1000, autoplay: true, loop: true, muted: true},
				extra: []
			};
		case 'alarm':
			return {
				type,
				values: {bg: '#cc0000', color: '#000000', size: 70, close: 'click'},
				extra: [],
				content: 'ТРЕВОГА'
			};
		case 'dialog':
			return {
				type,
				values: {label: 'Открыть сообщение', title: 'Сообщение'},
				extra: [],
				content: 'Текст сообщения'
			};
		case 'place':
			return {
				type,
				values: {corner: 'tr', x: 20, y: 20},
				extra: [],
				content: '<<link "Кнопка">><</link>>'
			};
		case 'timer':
			return {type, values: {name: 'Таймер', minutes: 5, seconds: 0}, extra: []};
		case 'chain':
			return {
				type,
				values: {width: 1000, height: 1000},
				extra: [],
				steps: [
					{values: {src: '', loop: true, muted: true, next: 'click'}, extra: []},
					{values: {src: '', next: 'end'}, extra: []}
				]
			};
		case 'articles':
			return {type, values: {columns: 1, headings: true}, extra: []};
		case 'code':
			return {
				type,
				values: {button: 'Подтвердить', gap: 1},
				extra: [],
				cases: [
					{kind: 'case', values: {code: '11111', title: 'Код принят'}, extra: [], content: 'Доступ разрешён'},
					{kind: 'wrong', values: {title: 'Ошибка'}, extra: [], content: 'Неверный код'}
				]
			};
	}
}

/* ----- Окно KR2 ----- */

export const kr2Tag = 'kr2';
export const kr2DefaultCols = 65;
export const kr2DefaultRows = 65;

/**
 * Когда показывать строку статуса (ответ автора 3Б, сессия 6): переменная
 * «включена» (не пустая, не 0, не false) или равна значению.
 */
export interface Kr2When {
	name: string;
	/** Значение, как его ввёл автор; undefined — «переменная включена». */
	value?: string;
}

export type Kr2Row = (
	| {kind: 'text'; text: string}
	| {kind: 'window'; label: string; title: string; passage: string; button: boolean}
) & {when?: Kr2When};

export interface Kr2 {
	image: string;
	/** Доля ширины левой колонки и высоты верхнего ряда, %. */
	cols: number;
	rows: number;
	/** Зона «Статусы» (бывшая «Здоровье»): строки текста и кнопки окон. */
	status: Kr2Row[];
	/** Есть ли в тексте хоть одна команда KR2. */
	present: boolean;
}

interface Found {
	from: number;
	to: number;
	inner?: string;
	tokens: string[];
}

function findKr2(text: string, name: string, container: boolean): Found | undefined {
	const re = new RegExp(`<<${name}(?=[\\s>])`);
	const match = re.exec(text);

	if (!match) {
		return undefined;
	}

	const scan = scanArgs(text, match.index + match[0].length);

	if (!scan) {
		return undefined;
	}
	if (!container) {
		return {from: match.index, to: scan.end, tokens: scan.tokens};
	}

	const close = findClose(text, name, scan.end);

	return close
		? {
				from: match.index,
				to: close.end,
				inner: text.slice(scan.end, close.at),
				tokens: scan.tokens
		  }
		: undefined;
}

// Строка с условием: <<if $имя>>…<br><</if>>\ или <<if $имя is значение>>…
// <br> внутри условия и «\» в конце — скрытая строка не оставляет пустого места.
const whenRow = /^<<if\s+(\$[A-Za-z_]\w*)(?:\s+is\s+(.+?))?>>([^]*)<br><<\/if>>(?:\\)?$/;

function readRow(line: string): Kr2Row {
	const when = whenRow.exec(line);

	if (when && !/<<(?:if|else|elseif|\/if)[\s>]/.test(when[3])) {
		const value = when[2] === undefined ? undefined : unquote(when[2].trim());

		return {
			...readPlainRow(when[3]),
			when: {name: when[1], value: value === undefined ? undefined : String(value)}
		};
	}
	return readPlainRow(line);
}

function readPlainRow(line: string): Kr2Row {
	const blocks = findBlocks(line);
	const only = blocks.length === 1 ? blocks[0] : undefined;

	if (
		only &&
		only.type === 'dialog' &&
		only.extra.length === 0 &&
		(only.content ?? '').trim() === '' &&
		line.slice(0, only.from).trim() === '' &&
		line.slice(only.to).trim() === '' &&
		typeof only.values.passage === 'string'
	) {
		return {
			kind: 'window',
			label: String(only.values.label ?? ''),
			title: String(only.values.title ?? ''),
			passage: only.values.passage,
			button: only.values.button === true
		};
	}
	return {kind: 'text', text: line};
}

/** Значение для условия: числа и true/false — как есть, остальное в кавычках. */
function conditionValue(value: string) {
	const v = value.trim();

	return /^-?\d+(\.\d+)?$/.test(v) || v === 'true' || v === 'false' ? v : quote(v);
}

function writeRow(row: Kr2Row, last = false) {
	const body = writePlainRow(row);

	if (!row.when || !/^\$[A-Za-z_]\w*$/.test(row.when.name)) {
		return body;
	}

	const cond =
		row.when.value === undefined
			? row.when.name
			: `${row.when.name} is ${conditionValue(row.when.value)}`;

	// У последней строки «\\» не нужен: за ней не перенос, а <</kr2vars>>.
	return `<<if ${cond}>>${body}<br><</if>>${last ? '' : '\\'}`;
}

function writePlainRow(row: Kr2Row) {
	if (row.kind === 'text') {
		return row.text;
	}
	return writeBlock({
		type: 'dialog',
		values: {
			label: row.label,
			title: row.title,
			passage: row.passage,
			button: row.button
		},
		extra: [],
		content: ''
	});
}

export function readKr2(text: string): Kr2 {
	const image = findKr2(text, 'kr2image', false);
	const layout = findKr2(text, 'kr2layout', false);
	const vars = findKr2(text, 'kr2vars', true);
	const main = findKr2(text, 'kr2main', true);
	const num = (token: string | undefined, fallback: number) => {
		const value = token === undefined ? NaN : Number(unquote(token));

		return isFinite(value) ? value : fallback;
	};

	return {
		image: image?.tokens[0] !== undefined ? String(unquote(image.tokens[0])) : '',
		cols: num(layout?.tokens[0], kr2DefaultCols),
		rows: num(layout?.tokens[1], kr2DefaultRows),
		status:
			vars?.inner !== undefined && vars.inner !== ''
				? vars.inner.split('\n').map(readRow)
				: [],
		present: !!(image || layout || vars || main)
	};
}

/** Текст пассажа с новыми настройками KR2 (недостающие команды — в начало). */
export function writeKr2(text: string, kr2: Omit<Kr2, 'present'>) {
	let result = text;
	const inserts: string[] = [];

	function put(name: string, container: boolean, value: string | undefined) {
		const found = findKr2(result, name, container);

		if (found) {
			result =
				result.slice(0, found.from) +
				(value ?? '') +
				result.slice(value === undefined ? found.to + (result[found.to] === '\n' ? 1 : 0) : found.to);
		} else if (value !== undefined) {
			inserts.push(value);
		}
	}

	put('kr2image', false, kr2.image ? `<<kr2image ${quote(kr2.image)}>>` : undefined);
	put(
		'kr2layout',
		false,
		kr2.cols === kr2DefaultCols && kr2.rows === kr2DefaultRows
			? undefined
			: `<<kr2layout ${round(kr2.cols)} ${round(kr2.rows)}>>`
	);
	put(
		'kr2vars',
		true,
		kr2.status.length ? `<<kr2vars>>${kr2.status.map((row, i) => writeRow(row, i === kr2.status.length - 1)).join('\n')}<</kr2vars>>` : undefined
	);

	return inserts.length ? inserts.join('\n') + '\n' + result : result;
}

/** Имена переменных ($имя), которые встречаются в тексте. */
export function variablesIn(texts: string[]) {
	const names = new Set<string>();

	texts.forEach(text => {
		(text.match(/\$[A-Za-z_][\w]*/g) ?? []).forEach(name => names.add(name));
	});
	return [...names].sort((a, b) => a.localeCompare(b));
}
