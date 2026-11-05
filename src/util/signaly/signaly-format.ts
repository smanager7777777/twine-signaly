// «Twine СИГНАЛЫ»: правки текста пассажа для панели форматирования (шаг 1.3,
// ответ автора 5а). Всё, что вставляется, — обычная разметка SugarCube или
// HTML, которая читается и работает в обычном Twine:
//   ''жирный''  //курсив//  __подчёркнутый__  ==зачёркнутый==
//   @@color:#cc0000;текст@@  @@font-size:150%;текст@@
//   <div class="center-text">…</div>  <div class="side-text">…</div>
//   !Заголовок  * пункт списка  ----
//   <span class="amber">…</span> — вид кнопок и ссылок.
// Кнопка на экране — блок <<sg-place>> (signaly-screen-blocks.ts).
//
// Функции получают текст и выделение (смещения) и возвращают правку: какой
// кусок заменить и что выделить после.

export interface Edit {
	from: number;
	to: number;
	insert: string;
	/** Выделение после правки (смещения в новом тексте). */
	selFrom: number;
	selTo: number;
}

function replace(
	from: number,
	to: number,
	insert: string,
	selFrom: number,
	selTo: number
): Edit {
	return {from, to, insert, selFrom, selTo};
}

/* ----- Простые обёртки: жирный, курсив… ----- */

export const marks = {
	bold: "''",
	italic: '//',
	underline: '__',
	strike: '=='
} as const;

export type Mark = keyof typeof marks;

/** Обернуть выделение меткой или снять её, если выделение уже обёрнуто. */
export function toggleMark(text: string, from: number, to: number, mark: Mark): Edit {
	const m = marks[mark];
	const selected = text.slice(from, to);

	// Метки вокруг выделения: ''|текст|''.
	if (text.slice(from - m.length, from) === m && text.slice(to, to + m.length) === m) {
		return replace(from - m.length, to + m.length, selected, from - m.length, to - m.length);
	}
	// Метки внутри выделения: |''текст''|.
	if (selected.length >= m.length * 2 && selected.startsWith(m) && selected.endsWith(m)) {
		const inner = selected.slice(m.length, -m.length);

		return replace(from, to, inner, from, from + inner.length);
	}
	return replace(from, to, m + selected + m, from + m.length, to + m.length);
}

/* ----- Стиль @@свойство:значение;текст@@ ----- */

interface StyleRun {
	from: number;
	to: number;
	/** Список стилей: «color:#cc0000;font-size:150%;». */
	styles: string;
	contentFrom: number;
	contentTo: number;
}

function styleRuns(text: string): StyleRun[] {
	const result: StyleRun[] = [];
	const re = /@@((?:[^;@\n]+;)+)([\s\S]*?)@@/g;
	let match;

	while ((match = re.exec(text))) {
		const contentFrom = match.index + 2 + match[1].length;

		result.push({
			from: match.index,
			to: match.index + match[0].length,
			styles: match[1],
			contentFrom,
			contentTo: contentFrom + match[2].length
		});
	}
	return result;
}

function parseStyles(styles: string) {
	return styles
		.split(';')
		.filter(Boolean)
		.map(part => {
			const colon = part.indexOf(':');

			return colon === -1
				? {prop: part.trim(), value: undefined as string | undefined}
				: {prop: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim()};
		});
}

/** Значение свойства стиля там, где стоит выделение (или undefined). */
export function styleAt(text: string, from: number, to: number, prop: string) {
	const run = innermost(
		styleRuns(text).filter(r => r.contentFrom <= from && to <= r.contentTo)
	);

	return run ? parseStyles(run.styles).find(s => s.prop === prop)?.value : undefined;
}

function innermost<T extends {from: number; to: number}>(list: T[]) {
	return list.sort((a, b) => b.from - a.from)[0];
}

/**
 * Задать свойство стиля выделенному тексту: color, font-size. value === null —
 * убрать свойство. Если выделение уже внутри @@…@@, меняется его список.
 */
export function setStyle(
	text: string,
	from: number,
	to: number,
	prop: string,
	value: string | null
): Edit | undefined {
	const run = innermost(
		styleRuns(text).filter(r => r.contentFrom <= from && to <= r.contentTo)
	);

	if (run) {
		const list = parseStyles(run.styles).filter(s => s.prop !== prop);

		if (value !== null) {
			list.push({prop, value});
		}

		const content = text.slice(run.contentFrom, run.contentTo);

		if (list.length === 0) {
			return replace(run.from, run.to, content, from - run.contentFrom + run.from, to - run.contentFrom + run.from);
		}

		const styles = list.map(s => (s.value === undefined ? s.prop : `${s.prop}:${s.value}`) + ';').join('');
		const shift = run.from + 2 + styles.length - run.contentFrom;

		return replace(run.from, run.to, `@@${styles}${content}@@`, from + shift, to + shift);
	}
	if (value === null || from === to) {
		return undefined;
	}

	const open = `@@${prop}:${value};`;

	return replace(from, to, open + text.slice(from, to) + '@@', from + open.length, to + open.length);
}

/* ----- Теги <span>/<div> с классами ----- */

export interface TagRun {
	tag: string;
	/** Начало и конец открывающего тега. */
	openFrom: number;
	openTo: number;
	/** Начало и конец закрывающего тега. */
	closeFrom: number;
	closeTo: number;
	classes: string[];
	/** Где в тексте стоит значение атрибута class (если есть). */
	classFrom?: number;
	classTo?: number;
}

/** Пары тегов span и div в тексте (вложенность учитывается). */
export function tagRuns(text: string): TagRun[] {
	const result: TagRun[] = [];
	const stack: Array<Omit<TagRun, 'closeFrom' | 'closeTo'>> = [];
	const re = /<(\/?)(span|div)\b([^>]*)>/gi;
	let match;

	while ((match = re.exec(text))) {
		const tag = match[2].toLowerCase();

		if (match[1] === '') {
			if (match[3].trim().endsWith('/')) {
				continue;
			}

			const cls = /\bclass\s*=\s*(["'])([^"']*)\1/i.exec(match[3]);
			const attrAt = match.index + 1 + match[2].length;

			stack.push({
				tag,
				openFrom: match.index,
				openTo: match.index + match[0].length,
				classes: cls ? cls[2].split(/\s+/).filter(Boolean) : [],
				classFrom: cls ? attrAt + cls.index + cls[0].indexOf(cls[1]) + 1 : undefined,
				classTo: cls ? attrAt + cls.index + cls[0].lastIndexOf(cls[1]) : undefined
			});
		} else {
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].tag === tag) {
					const [open] = stack.splice(i, 1);

					result.push({...open, closeFrom: match.index, closeTo: match.index + match[0].length});
					break;
				}
			}
		}
	}
	return result;
}

/** Самый внутренний тег, который охватывает выделение и подходит под условие. */
export function enclosingTag(
	text: string,
	from: number,
	to: number,
	test: (run: TagRun) => boolean
) {
	return tagRuns(text)
		.filter(r => r.openTo <= from && to <= r.closeFrom && test(r))
		.sort((a, b) => b.openFrom - a.openFrom)[0];
}

/** Новый список классов тега; пустой список — тег снимается (остаётся содержимое). */
function retag(
	text: string,
	run: TagRun,
	classes: string[],
	from: number,
	to: number
): Edit {
	const inner = text.slice(run.openTo, run.closeFrom);

	if (classes.length === 0 && run.classFrom !== undefined) {
		const openRest = text
			.slice(run.openFrom, run.openTo)
			.replace(/\s*\bclass\s*=\s*(["'])[^"']*\1/i, '');

		// Кроме класса у тега ничего не было — снимаем тег целиком.
		if (/^<(span|div)\s*>$/i.test(openRest)) {
			const shift = run.openTo - run.openFrom;

			return replace(run.openFrom, run.closeTo, inner, from - shift, to - shift);
		}
		return replace(
			run.openFrom,
			run.openTo,
			openRest,
			from - (run.openTo - run.openFrom - openRest.length),
			to - (run.openTo - run.openFrom - openRest.length)
		);
	}

	const value = classes.join(' ');
	const delta = value.length - (run.classTo! - run.classFrom!);

	return replace(run.classFrom!, run.classTo!, value, from + delta, to + delta);
}

/* ----- Вид кнопок и ссылок ----- */

/** Класс вида там, где стоит курсор ('' — без вида). */
export function kindAt(text: string, from: number, to: number, kinds: string[]) {
	const run = enclosingTag(text, from, to, r => r.classes.some(c => kinds.includes(c)));

	return run ? run.classes.find(c => kinds.includes(c))! : '';
}

/**
 * Назначить вид выделенному. Внутри обёртки другого вида — меняет класс;
 * cls === '' — снимает вид. Без выделения вставляет образец ссылки.
 */
/** Стиль текста: как вид, но без выделения вставляется образец текста, а не ссылка. */
export function applyTextStyle(
	text: string,
	from: number,
	to: number,
	cls: string,
	styles: string[],
	sample: string
): Edit | undefined {
	if (from !== to || cls === '' || enclosingTag(text, from, to, r => r.classes.some(c => styles.includes(c)))) {
		return applyKind(text, from, to, cls, styles, '');
	}

	const open = `<span class="${cls}">`;

	return replace(from, to, `${open}${sample}</span>`, from + open.length, from + open.length + sample.length);
}

export function applyKind(
	text: string,
	from: number,
	to: number,
	cls: string,
	kinds: string[],
	sample: string
): Edit | undefined {
	const run = enclosingTag(text, from, to, r => r.classes.some(c => kinds.includes(c)));

	if (run) {
		const classes = run.classes.filter(c => !kinds.includes(c));

		if (cls !== '') {
			classes.push(cls);
		}
		return retag(text, run, classes, from, to);
	}
	if (cls === '') {
		return undefined;
	}

	const open = `<span class="${cls}">`;

	if (from === to) {
		const link = `<<link "${sample}">><</link>>`;
		const at = from + open.length + '<<link "'.length;

		return replace(from, to, open + link + '</span>', at, at + sample.length);
	}
	return replace(from, to, open + text.slice(from, to) + '</span>', from + open.length, to + open.length);
}

/* ----- Выравнивание ----- */

export const alignClasses = {center: 'center-text', right: 'side-text'} as const;

export type Align = keyof typeof alignClasses;

export function alignAt(text: string, from: number, to: number): Align | '' {
	const run = enclosingTag(
		text,
		from,
		to,
		r => r.tag === 'div' && r.classes.some(c => c === 'center-text' || c === 'side-text')
	);

	if (!run) {
		return '';
	}
	return run.classes.includes('center-text') ? 'center' : 'right';
}

/** По центру / справа; повторное нажатие (или align === '') — обычное выравнивание. */
export function applyAlign(text: string, from: number, to: number, align: Align | ''): Edit | undefined {
	const all = Object.values(alignClasses) as string[];
	const run = enclosingTag(
		text,
		from,
		to,
		r => r.tag === 'div' && r.classes.some(c => all.includes(c))
	);

	if (run) {
		const classes = run.classes.filter(c => !all.includes(c));
		const current = run.classes.includes('center-text') ? 'center' : 'right';

		if (align !== '' && align !== current) {
			classes.push(alignClasses[align]);
		}
		return retag(text, run, classes, from, to);
	}
	if (align === '') {
		return undefined;
	}

	// Без выделения — вся строка.
	let a = from;
	let b = to;

	if (a === b) {
		a = text.lastIndexOf('\n', a - 1) + 1;
		b = text.indexOf('\n', b);
		b = b === -1 ? text.length : b;
	}

	const open = `<div class="${alignClasses[align]}">`;

	return replace(a, b, open + text.slice(a, b) + '</div>', from + open.length, to + open.length);
}

/** CSS выравнивания, если в таблице стилей его нет (классы шаблона автора). */
export function missingAlignCss(stylesheet: string, align: Align) {
	const cls = alignClasses[align];

	if (new RegExp(`\\.${cls}\\s*[,{]`).test(stylesheet)) {
		return '';
	}
	return `\n\n.${cls} {\n\ttext-align: ${align === 'center' ? 'center' : 'right'};\n}\n`;
}

/* ----- Строки: заголовок, список, линия ----- */

function lineRange(text: string, from: number, to: number) {
	const start = text.lastIndexOf('\n', from - 1) + 1;
	let end = text.indexOf('\n', to > from && text[to - 1] === '\n' ? to - 1 : to);

	end = end === -1 ? text.length : end;
	return {start, end};
}

function mapLines(
	text: string,
	from: number,
	to: number,
	change: (lines: string[]) => string[]
): Edit {
	const {start, end} = lineRange(text, from, to);
	const lines = text.slice(start, end).split('\n');
	const result = change(lines).join('\n');

	return replace(start, end, result, start, start + result.length);
}

/** Заголовок уровня 1–3 (!, !!, !!!); тот же уровень ещё раз — снять. */
export function toggleHeading(text: string, from: number, to: number, level: number) {
	const prefix = '!'.repeat(level);

	return mapLines(text, from, to, lines => {
		const all = lines.every(l => l.startsWith(prefix) && l[level] !== '!');

		return lines.map(l => {
			const bare = l.replace(/^!+/, '');

			return all ? bare : prefix + bare;
		});
	});
}

/** Список «* пункт»; ещё раз — снять. */
export function toggleList(text: string, from: number, to: number) {
	return mapLines(text, from, to, lines => {
		const all = lines.every(l => /^\* /.test(l));

		return lines.map(l => (all ? l.replace(/^\* /, '') : `* ${l.replace(/^\* /, '')}`));
	});
}

/** Горизонтальная линия «----» отдельной строкой. */
export function insertRule(text: string, from: number): Edit {
	const before = from > 0 && text[from - 1] !== '\n' ? '\n' : '';
	const after = from < text.length && text[from] !== '\n' ? '\n' : '';
	const insert = `${before}----${after}`;
	const at = from + insert.length;

	return replace(from, from, insert, at, at);
}
