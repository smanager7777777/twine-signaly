// «Twine СИГНАЛЫ»: условия, состояния и значения переменных в тексте экрана
// (шаг 3.1, ответы автора 3А, 4А, 6А). Всё — обычные команды SugarCube 2.37:
//   Условие:   <<if $a and $b gt 2>>текст<<else>>другой текст<</if>>
//   Состояния: <<switch $PRCD>>
//              <<case 0>><span class="red-big">Данные повреждены</span>\
//              <<case 1>>Нужен пароль\
//              <<default>>…\
//              <</switch>>
//   Значение:  <span class="sg-value">Глава: <<= $chapter>> из 5</span>
//              <span class="sg-value">Журнал: <<= $log ? "найден" : "не найден">></span>
// Шаг 3.5 (ответы 7А, 8А): в строках условия — ещё заходы на экраны и коды,
// введённые сотрудниками (счётчики ведёт движок терминала):
//   был на экране            setup.visits("Экран") gt 0
//   не был на экране         setup.visits("Экран") is 0
//   заходил не меньше N раз  setup.visits("Экран") gte 3
//   заходил ровно N раз      setup.visits("Экран") is 3
//   сотрудник ввёл код       setup.entered("2", "101")   (не ввёл — not …)
//   значение: число заходов  <<= setup.visits("Экран")>>
// Что формы не понимают (сложное условие, <<elseif>>), остаётся как есть.

import {findClose} from './signaly-screen-blocks';
import {literal, parseLiteral, VarValue} from './signaly-variables';

/* ----- Условие ----- */

/**
 * on — «включена» (истинна), off — «выключена», eq — «равна», ne — «не равна»,
 * gt — «больше», lt — «меньше» (off и ne — шаг 3.2, ответ 7А).
 */
export type CondOp = 'on' | 'off' | 'eq' | 'ne' | 'gt' | 'lt' | 'ge';

/**
 * Что проверяет строка (шаг 3.5): undefined — переменную; visits — заходы на
 * экран (on — был, off — не был, ge — не меньше N раз, eq — ровно N раз);
 * entered — сотрудник ввёл код таблицы (on — ввёл, off — не ввёл).
 */
export type CondKind = 'visits' | 'entered';

export interface Cond {
	/** Имя переменной без «$». */
	name: string;
	op: CondOp;
	value?: VarValue;
	kind?: CondKind;
	/** visits: имя экрана. */
	screen?: string;
	/** entered: номер или имя сотрудника и код. */
	person?: string;
	code?: string;
}

export interface Condition {
	/** Где условие в тексте (с <</if>>). */
	from: number;
	to: number;
	/** Конец <<if …>>. */
	headTo: number;
	/** Выражение после if, как написано. */
	expr: string;
	/** Разобранное выражение или undefined, если оно записано кодом. */
	conds?: Cond[];
	join: 'and' | 'or';
	/** Где показываемый текст. */
	contentFrom: number;
	contentTo: number;
	/** «Иначе»: где <<else>> и текст после него. */
	elseFrom?: number;
	elseContentFrom?: number;
}

const opWords: Record<string, CondOp> = {
	is: 'eq',
	eq: 'eq',
	'==': 'eq',
	'===': 'eq',
	isnot: 'ne',
	neq: 'ne',
	'!=': 'ne',
	'!==': 'ne',
	gt: 'gt',
	'>': 'gt',
	lt: 'lt',
	'<': 'lt'
};

const opWrite: Record<Exclude<CondOp, 'on' | 'off'>, string> = {
	eq: 'is',
	ne: 'isnot',
	gt: 'gt',
	lt: 'lt',
	ge: 'gte'
};

const str = `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`;
const visitsRe = new RegExp(`^setup\\.visits\\(\\s*${str}\\s*\\)\\s+(gte|gt|is|eq|===|==|>=|>)\\s+(\\d+)$`);
const enteredRe = new RegExp(`^(not\\s+|!\\s*)?setup\\.entered\\(\\s*${str}\\s*,\\s*${str}\\s*\\)$`);
const enteredCodeRe = new RegExp(`setup\\.entered\\(\\s*${str}\\s*,\\s*${str}\\s*\\)`, 'g');

/**
 * Выражение → части и связки «and»/«or» на верхнем уровне: внутри кавычек и
 * скобок не режем (имя экрана может содержать « and »).
 */
function splitJoins(expr: string) {
	const parts: string[] = [];
	const joins: string[] = [];
	let depth = 0;
	let quote = '';
	let start = 0;

	for (let i = 0; i < expr.length; i++) {
		const ch = expr[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			} else if (ch === quote) {
				quote = '';
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === '(' || ch === '[') {
			depth++;
		} else if (ch === ')' || ch === ']') {
			depth--;
		} else if (depth === 0 && /\s/.test(ch)) {
			const m = /^\s+(and|or|&&|\|\|)\s+/.exec(expr.slice(i));

			if (m) {
				parts.push(expr.slice(start, i));
				joins.push(m[1]);
				i += m[0].length - 1;
				start = i + 1;
			}
		}
	}
	parts.push(expr.slice(start));
	return {parts, joins};
}

/** Строка в кавычках → текст. */
function unquote(s: string) {
	const v = parseLiteral(s);

	return typeof v === 'string' ? v : undefined;
}

/** Строка условия про заходы на экран или введённый код (шаг 3.5). */
function parseSpecial(part: string): Cond | undefined {
	const v = visitsRe.exec(part);

	if (v) {
		const screen = unquote(v[1]);
		const n = Number(v[3]);
		const op = v[2];

		if (screen === undefined) {
			return undefined;
		}
		if ((op === 'gt' || op === '>') && n === 0) {
			return {name: '', kind: 'visits', screen, op: 'on'};
		}
		if (op === 'is' || op === 'eq' || op === '==' || op === '===') {
			return n === 0
				? {name: '', kind: 'visits', screen, op: 'off'}
				: {name: '', kind: 'visits', screen, op: 'eq', value: n};
		}
		if (op === 'gte' || op === '>=') {
			return {name: '', kind: 'visits', screen, op: 'ge', value: n};
		}
		return undefined;
	}

	const e = enteredRe.exec(part);

	if (e) {
		const person = unquote(e[2]);
		const code = unquote(e[3]);

		return person === undefined || code === undefined
			? undefined
			: {name: '', kind: 'entered', person, code, op: e[1] ? 'off' : 'on'};
	}
	return undefined;
}

/** Разбор выражения «$a and $b is 2» на условия; undefined — записано кодом. */
export function parseExpr(expr: string): {conds: Cond[]; join: 'and' | 'or'} | undefined {
	const {parts, joins: rawJoins} = splitJoins(expr.trim());
	const joins = rawJoins.map(j => (j === 'and' || j === '&&' ? 'and' : 'or'));

	if (joins.some(j => j !== joins[0])) {
		return undefined;
	}

	const conds: Cond[] = [];

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i].trim();
		const special = parseSpecial(part);

		if (special) {
			conds.push(special);
			continue;
		}

		const off = /^(?:not\s+|!\s*)\$([A-Za-z_]\w*)$/.exec(part);

		if (off) {
			conds.push({name: off[1], op: 'off'});
			continue;
		}

		const m = /^\$([A-Za-z_]\w*)(?:\s+(isnot|is|neq|eq|gt|lt|!==|!=|===|==|>|<)\s+(.+))?$/.exec(part);

		if (!m) {
			return undefined;
		}
		if (m[2] === undefined) {
			conds.push({name: m[1], op: 'on'});
			continue;
		}

		const value = parseLiteral(m[3]);

		if (value === undefined) {
			return undefined;
		}
		conds.push({name: m[1], op: opWords[m[2]], value});
	}
	return {conds, join: (joins[0] as 'and' | 'or') ?? 'and'};
}

function writeSpecial(c: Cond) {
	if (c.kind === 'entered') {
		const call = `setup.entered(${literal(c.person ?? '')}, ${literal(c.code ?? '')})`;

		return c.op === 'off' ? `not ${call}` : call;
	}

	const call = `setup.visits(${literal(c.screen ?? '')})`;
	const n = Math.max(0, Math.round(Number(c.value) || 0));

	switch (c.op) {
		case 'off':
			return `${call} is 0`;
		case 'ge':
			return `${call} gte ${n}`;
		case 'eq':
			return `${call} is ${n}`;
		default:
			return `${call} gt 0`;
	}
}

export function writeExpr(conds: Cond[], join: 'and' | 'or') {
	return conds
		.map(c =>
			c.kind
				? writeSpecial(c)
				: c.op === 'on'
				? `$${c.name}`
				: c.op === 'off'
				? `not $${c.name}`
				: `$${c.name} ${opWrite[c.op]} ${literal(c.value ?? 0)}`
		)
		.join(` ${join} `);
}

/**
 * Коды таблицы, которые упоминаются в условиях «сотрудник ввёл код» (шаг 3.5):
 * терминалу нужно знать, кто их вводит, — он спросит личный код.
 */
export function enteredCodes(texts: string[]) {
	const codes = new Set<string>();

	texts.forEach(text => {
		for (const m of text.matchAll(enteredCodeRe)) {
			const code = unquote(m[2]);

			if (code !== undefined) {
				codes.add(code.trim());
			}
		}
	});
	return codes;
}

/** Условия <<if>> с одним необязательным <<else>> (без <<elseif>>). */
export function findConditions(text: string): Condition[] {
	const result: Condition[] = [];
	const re = /<<if(?=\s)/g;
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const headEnd = text.indexOf('>>', m.index);

		if (headEnd === -1) {
			break;
		}

		const headTo = headEnd + 2;
		const close = findClose(text, 'if', headTo);

		if (!close) {
			continue;
		}

		// <<else>> и <<elseif>> на этом уровне (не во вложенных <<if>>).
		const inner = /<<(\/?)if(?=[\s>])|<<(else|elseif)(?=[\s>])/g;
		let depth = 0;
		let elseAt: number | undefined;
		let elseTo: number | undefined;
		let unsupported = false;
		let x: RegExpExecArray | null;

		inner.lastIndex = headTo;
		while ((x = inner.exec(text)) && x.index < close.at) {
			if (x[2] === undefined) {
				depth += x[1] ? -1 : 1;
			} else if (depth === 0) {
				if (x[2] === 'elseif' || elseAt !== undefined) {
					unsupported = true;
					break;
				}

				const end = text.indexOf('>>', x.index);

				if (text.slice(x.index, end + 2) !== '<<else>>') {
					unsupported = true;
					break;
				}
				elseAt = x.index;
				elseTo = end + 2;
			}
		}
		if (unsupported) {
			continue;
		}

		const expr = text.slice(m.index + 4, headEnd).trim();
		const parsed = parseExpr(expr);

		result.push({
			from: m.index,
			to: close.end,
			headTo,
			expr,
			conds: parsed?.conds,
			join: parsed?.join ?? 'and',
			contentFrom: headTo,
			contentTo: elseAt ?? close.at,
			elseFrom: elseAt,
			elseContentFrom: elseTo
		});
	}
	return result;
}

/** Новая голова условия: <<if выражение>>. */
export function replaceConditionHead(text: string, cond: Condition, expr: string) {
	return text.slice(0, cond.from) + `<<if ${expr}>>` + text.slice(cond.headTo);
}

/** Включить или снять «иначе» (снимается вместе с текстом после <<else>>). */
export function setConditionElse(text: string, cond: Condition, on: boolean, sample: string) {
	if (on && cond.elseFrom === undefined) {
		return text.slice(0, cond.contentTo) + `<<else>>${sample}` + text.slice(cond.contentTo);
	}
	if (!on && cond.elseFrom !== undefined) {
		return text.slice(0, cond.elseFrom) + text.slice(cond.to - '<</if>>'.length);
	}
	return text;
}

/** Обернуть выделение условием (без выделения — образец текста). */
export function wrapCondition(text: string, from: number, to: number, expr: string, sample: string) {
	const content = from === to ? sample : text.slice(from, to);
	const insert = `<<if ${expr}>>${content}<</if>>`;

	return {from, to, insert};
}

/* ----- Состояния ----- */

export interface StateCase {
	/** Значение как написано (<<case 1>> → «1»); undefined — «в остальных случаях». */
	value?: string;
	/** Текст состояния (разметка SugarCube) без обёртки вида. */
	content: string;
	/** Класс вида (обёртка <span class="…">), '' — без вида. */
	kind: string;
}

export interface States {
	from: number;
	to: number;
	/** Выражение после switch — обычно «$имя». */
	expr: string;
	cases: StateCase[];
}

const caseRe = /<<(case|default)(?=[\s>])/g;

function unwrapKind(content: string, kinds: string[]) {
	const m = /^<span class="([^"]+)">([^]*)<\/span>$/.exec(content);

	if (m && kinds.includes(m[1]) && !/<\/span>/.test(m[2].replace(/<span\b[^>]*>[^]*?<\/span>/g, ''))) {
		return {kind: m[1], content: m[2]};
	}
	return {kind: '', content};
}

/** Блоки <<switch>>. kinds — классы видов (чтобы узнать обёртку вида). */
export function findStates(text: string, kinds: string[] = []): States[] {
	const result: States[] = [];
	const re = /<<switch(?=\s)/g;
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const headEnd = text.indexOf('>>', m.index);

		if (headEnd === -1) {
			break;
		}

		const close = findClose(text, 'switch', headEnd + 2);

		if (!close) {
			continue;
		}

		const body = text.slice(headEnd + 2, close.at);
		const heads: Array<{at: number; end: number; value?: string}> = [];
		let depth = 0;
		const scan = /<<(\/?)switch(?=[\s>])|<<(case|default)(?=[\s>])/g;
		let x: RegExpExecArray | null;

		while ((x = scan.exec(body))) {
			if (x[2] === undefined) {
				depth += x[1] ? -1 : 1;
				continue;
			}
			if (depth !== 0) {
				continue;
			}

			const end = body.indexOf('>>', x.index);
			const args = body.slice(x.index + 2 + x[2].length, end).trim();

			heads.push({at: x.index, end: end + 2, value: x[2] === 'case' ? args : undefined});
		}

		const cases = heads.map((h, i) => {
			let content = body.slice(h.end, i + 1 < heads.length ? heads[i + 1].at : body.length);

			// «\» и перевод строки в конце — для красоты записи, не текст.
			content = content.replace(/\\?\n?$/, '');
			return {value: h.value, ...unwrapKind(content, kinds)};
		});

		result.push({
			from: m.index,
			to: close.end,
			expr: text.slice(m.index + 8, headEnd).trim(),
			cases
		});
	}
	caseRe.lastIndex = 0;
	return result;
}

export function writeStates(states: Pick<States, 'expr' | 'cases'>) {
	const lines = states.cases.map(c => {
		const content = c.kind ? `<span class="${c.kind}">${c.content}</span>` : c.content;

		return `${c.value === undefined ? '<<default>>' : `<<case ${c.value}>>`}${content}\\`;
	});

	return `<<switch ${states.expr}>>\n${lines.join('\n')}\n<</switch>>`;
}

/** Значение для <<case>>: число, true/false, иначе текст в кавычках. */
export function caseValue(input: string) {
	const value = parseLiteral(input);

	return value !== undefined ? literal(value) : literal(input);
}

/** Значение <<case>> для поля формы (без кавычек). */
export function caseInput(value: string) {
	const parsed = parseLiteral(value);

	return parsed === undefined ? value : String(parsed);
}

/* ----- Значение переменной ----- */

export interface ValueShow {
	from: number;
	to: number;
	/** Имя переменной без «$» ('' — показывается число заходов на экран). */
	name: string;
	/** Шаг 3.5: число заходов на этот экран (setup.visits). */
	screen?: string;
	/** Подпись перед значением («Глава»), без двоеточия. */
	label: string;
	/** Да-нет: слова для «да» и «нет». */
	yes?: string;
	no?: string;
	/** Число «из N». */
	of?: number;
}

const valueRe =
	/<span class="sg-value">(?:([^<]*?):\s)?<<=\s*(?:setup\.visits\(\s*("(?:\\.|[^"\\])*")\s*\)|\$([A-Za-z_]\w*)(?:\s*\?\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))?)\s*>>(?: из (\d+(?:\.\d+)?))?<\/span>/g;

export function findValues(text: string): ValueShow[] {
	return [...text.matchAll(valueRe)].map(m => ({
		from: m.index!,
		to: m.index! + m[0].length,
		label: m[1] ?? '',
		name: m[3] ?? '',
		screen: m[2] === undefined ? undefined : String(parseLiteral(m[2])),
		yes: m[4] === undefined ? undefined : String(parseLiteral(m[4])),
		no: m[5] === undefined ? undefined : String(parseLiteral(m[5])),
		of: m[6] === undefined ? undefined : Number(m[6])
	}));
}

export function writeValue(v: Omit<ValueShow, 'from' | 'to'>) {
	const label = v.label.replace(/[<:]/g, '').trim();
	const shown =
		v.screen !== undefined
			? `<<= setup.visits(${literal(v.screen)})>>`
			: v.yes !== undefined || v.no !== undefined
			? `<<= $${v.name} ? ${literal(v.yes ?? '')} : ${literal(v.no ?? '')}>>`
			: `<<= $${v.name}>>`;
	const of =
		v.of !== undefined && v.yes === undefined && v.no === undefined ? ` из ${v.of}` : '';

	return `<span class="sg-value">${label ? `${label}: ` : ''}${shown}${of}</span>`;
}
