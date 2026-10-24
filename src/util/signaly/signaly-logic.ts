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
// Что формы не понимают (сложное условие, <<elseif>>), остаётся как есть.

import {findClose} from './signaly-screen-blocks';
import {literal, parseLiteral, VarValue} from './signaly-variables';

/* ----- Условие ----- */

/** on — «включена» (истинна), eq — «равна», gt — «больше», lt — «меньше». */
export type CondOp = 'on' | 'eq' | 'gt' | 'lt';

export interface Cond {
	/** Имя переменной без «$». */
	name: string;
	op: CondOp;
	value?: VarValue;
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
	gt: 'gt',
	'>': 'gt',
	lt: 'lt',
	'<': 'lt'
};

const opWrite: Record<Exclude<CondOp, 'on'>, string> = {eq: 'is', gt: 'gt', lt: 'lt'};

/** Разбор выражения «$a and $b is 2» на условия; undefined — записано кодом. */
export function parseExpr(expr: string): {conds: Cond[]; join: 'and' | 'or'} | undefined {
	const parts = expr.trim().split(/\s+(and|or|&&|\|\|)\s+/);
	const joins = parts.filter((_, i) => i % 2 === 1).map(j => (j === 'and' || j === '&&' ? 'and' : 'or'));

	if (joins.some(j => j !== joins[0])) {
		return undefined;
	}

	const conds: Cond[] = [];

	for (let i = 0; i < parts.length; i += 2) {
		const m = /^\$([A-Za-z_]\w*)(?:\s+(is|eq|gt|lt|===|==|>|<)\s+(.+))?$/.exec(parts[i].trim());

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

export function writeExpr(conds: Cond[], join: 'and' | 'or') {
	return conds
		.map(c =>
			c.op === 'on' ? `$${c.name}` : `$${c.name} ${opWrite[c.op]} ${literal(c.value ?? 0)}`
		)
		.join(` ${join} `);
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
	/** Имя переменной без «$». */
	name: string;
	/** Подпись перед значением («Глава»), без двоеточия. */
	label: string;
	/** Да-нет: слова для «да» и «нет». */
	yes?: string;
	no?: string;
	/** Число «из N». */
	of?: number;
}

const valueRe =
	/<span class="sg-value">(?:([^<]*?):\s)?<<=\s*\$([A-Za-z_]\w*)(?:\s*\?\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))?\s*>>(?: из (\d+(?:\.\d+)?))?<\/span>/g;

export function findValues(text: string): ValueShow[] {
	return [...text.matchAll(valueRe)].map(m => ({
		from: m.index!,
		to: m.index! + m[0].length,
		label: m[1] ?? '',
		name: m[2],
		yes: m[3] === undefined ? undefined : String(parseLiteral(m[3])),
		no: m[4] === undefined ? undefined : String(parseLiteral(m[4])),
		of: m[5] === undefined ? undefined : Number(m[5])
	}));
}

export function writeValue(v: Omit<ValueShow, 'from' | 'to'>) {
	const label = v.label.replace(/[<:]/g, '').trim();
	const shown =
		v.yes !== undefined || v.no !== undefined
			? `<<= $${v.name} ? ${literal(v.yes ?? '')} : ${literal(v.no ?? '')}>>`
			: `<<= $${v.name}>>`;
	const of = v.of !== undefined && v.yes === undefined && v.no === undefined ? ` из ${v.of}` : '';

	return `<span class="sg-value">${label ? `${label}: ` : ''}${shown}${of}</span>`;
}
