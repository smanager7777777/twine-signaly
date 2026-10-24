// «Twine СИГНАЛЫ»: окно «Переменные» (шаг 3.1, ответ автора 2А). Начальные
// значения — обычные команды SugarCube в StoryInit, разделом между метками:
//   /* ===== СИГНАЛЫ: переменные — правьте в окне «Переменные» ===== */
//   <<set $chapter to 1>> /* Глава */
//   <<set $flightlog1 to false>> /* Журнал полёта 1 */
//   /* ===== СИГНАЛЫ: конец переменных ===== */
// Тип виден по значению: число, true/false (да-нет) или текст в кавычках.
// Подпись по-русски — комментарий в конце строки. Простые <<set $x to 5>> вне
// раздела (одна переменная, одно значение, задана один раз) при сохранении
// переносятся в раздел; остальной код StoryInit не трогается.

import {BlockMarkers, findBlock} from './signaly-blocks';

export type VarType = 'number' | 'bool' | 'text';
export type VarValue = number | boolean | string;

export interface Variable {
	/** Имя без «$»: латиница, цифры, «_» (так требует SugarCube). */
	name: string;
	/** Подпись по-русски («Глава»). */
	label: string;
	value: VarValue;
}

export const variablesMarkers: BlockMarkers = {
	start: '/* ===== СИГНАЛЫ: переменные — правьте в окне «Переменные» ===== */',
	end: '/* ===== СИГНАЛЫ: конец переменных ===== */'
};

export const variableNameRe = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function typeOf(value: VarValue): VarType {
	return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'bool' : 'text';
}

/** Значение по умолчанию для типа. */
export function defaultValue(type: VarType): VarValue {
	return type === 'number' ? 0 : type === 'bool' ? false : '';
}

/** Значение в записи SugarCube: 5, true, "текст". */
export function literal(value: VarValue) {
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** Разбор значения: число, true/false, строка в кавычках; иначе undefined. */
export function parseLiteral(source: string): VarValue | undefined {
	const s = source.trim();

	if (/^-?\d+(?:\.\d+)?$/.test(s)) {
		return Number(s);
	}
	if (s === 'true' || s === 'false') {
		return s === 'true';
	}

	const q = s[0];

	if ((q === '"' || q === "'") && s.length >= 2 && s[s.length - 1] === q) {
		const body = s.slice(1, -1);

		// Кавычка внутри без «\» — это уже не одна строка.
		if (new RegExp(`(^|[^\\\\])${q}`).test(body)) {
			return undefined;
		}
		return body.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c));
	}
	return undefined;
}

/** <<set $x to значение>> с необязательной подписью /* … *\/ в конце строки. */
const simpleSetRe =
	/<<set\s+\$([A-Za-z_]\w*)\s+(?:to|=)\s+((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^>"'])+?)\s*>>(?:[ \t]*\/\*([^]*?)\*\/)?/g;

/** Все упоминания «$имя» в команде <<set …>> (чтобы найти повторы). */
const anySetRe = /<<set\s[^]*?>>/g;

export interface ReadVariables {
	/** Переменные раздела и простые <<set>> вне его, по порядку. */
	variables: Variable[];
	/** Где простые <<set>> вне раздела (их заменит раздел). */
	ranges: Array<{from: number; to: number}>;
	/** Переменные, которые StoryInit задаёт кодом (сложные <<set>>). */
	byCode: string[];
}

function setsOf(text: string) {
	const counts = new Map<string, number>();

	for (const m of text.matchAll(anySetRe)) {
		for (const name of m[0].match(/\$[A-Za-z_]\w*(?!\w)(?=\s*(?:to(?!\w)|=(?!=)))/g) ?? []) {
			counts.set(name.slice(1), (counts.get(name.slice(1)) ?? 0) + 1);
		}
	}
	return counts;
}

function readSimple(text: string, offset = 0) {
	const found: Array<Variable & {from: number; to: number}> = [];

	for (const m of text.matchAll(simpleSetRe)) {
		const value = parseLiteral(m[2]);

		if (value !== undefined) {
			found.push({
				name: m[1],
				label: (m[3] ?? '').trim(),
				value,
				from: offset + m.index!,
				to: offset + m.index! + m[0].length
			});
		}
	}
	return found;
}

/** Переменные StoryInit: раздел окна и простые <<set>> вне его. */
export function readVariables(text: string): ReadVariables {
	const block = findBlock(text, variablesMarkers);
	const inner = block ? readSimple(block.inner) : [];
	const rest = block ? text.slice(0, block.from) + ' '.repeat(block.to - block.from) + text.slice(block.to) : text;
	const counts = setsOf(rest);
	const variables: Variable[] = inner.map(({name, label, value}) => ({name, label, value}));
	const ranges: Array<{from: number; to: number}> = [];
	const byCode = new Set<string>();

	readSimple(rest).forEach(v => {
		if (counts.get(v.name) === 1 && !variables.some(other => other.name === v.name)) {
			variables.push({name: v.name, label: v.label, value: v.value});
			ranges.push({from: v.from, to: v.to});
		}
	});
	counts.forEach((_, name) => {
		if (!variables.some(v => v.name === name)) {
			byCode.add(name);
		}
	});
	return {variables, ranges, byCode: [...byCode].sort()};
}

/** Раздел окна для StoryInit. */
export function variablesBlock(variables: Variable[]) {
	return [
		variablesMarkers.start,
		...variables.map(
			v =>
				`<<set $${v.name} to ${literal(v.value)}>>` +
				(v.label.trim() ? ` /* ${v.label.trim().replace(/\*\//g, '* /')} */` : '')
		),
		variablesMarkers.end
	].join('\n');
}

/**
 * Текст StoryInit с новым разделом: простые <<set>> вне раздела убираются,
 * раздел встаёт на своё место, на место первой из них или в начало.
 */
export function withVariables(text: string, variables: Variable[]) {
	const block = findBlock(text, variablesMarkers);
	let rest = text;
	let at = -1;

	if (block) {
		rest = text.slice(0, block.from) + text.slice(block.to);
		at = block.from;
	}

	const {ranges} = readVariables(rest);

	if (at === -1) {
		at = ranges.length ? ranges[0].from : 0;
	}

	let result = rest;

	[...ranges].reverse().forEach(r => {
		let to = r.to;
		let from = r.from;

		while (result[to] === ' ' || result[to] === '\t') {
			to++;
		}
		if (result[to] === '\n') {
			to++;
		}
		while (from > 0 && (result[from - 1] === ' ' || result[from - 1] === '\t')) {
			from--;
		}
		result = result.slice(0, from) + result.slice(to);
		if (from < at) {
			at -= Math.min(to, at) - from;
		}
	});

	const before = result.slice(0, at);
	const after = result.slice(at).replace(/^\n+/, '');

	if (variables.length === 0) {
		return before + after;
	}
	return `${before}${before && !before.endsWith('\n') ? '\n' : ''}${variablesBlock(variables)}\n${after ? '\n' + after : ''}`;
}

/** Где упоминается переменная: имена пассажей (и «JavaScript истории»). */
export function variableUsage(
	name: string,
	passages: Array<{name: string; text: string}>,
	script: string,
	scriptLabel: string
) {
	const re = new RegExp(`\\$${name}(?![\\w])`);
	const js = new RegExp(`(?:State\\.variables|variables\\(\\))\\.${name}(?![\\w])`);
	const result = passages.filter(p => re.test(p.text)).map(p => p.name);

	if (js.test(script)) {
		result.push(scriptLabel);
	}
	return result;
}

/** Переименовать переменную в тексте пассажа или скрипта. */
export function renameVariable(text: string, from: string, to: string) {
	return text
		.replace(new RegExp(`\\$${from}(?![\\w])`, 'g'), `$${to}`)
		.replace(new RegExp(`((?:State\\.variables|variables\\(\\))\\.)${from}(?![\\w])`, 'g'), `$1${to}`);
}

/** Все «$имя» в текстах — переменные, которые встречаются в истории. */
export function variablesInTexts(texts: string[]) {
	const names = new Set<string>();

	texts.forEach(text => {
		for (const m of text.matchAll(/\$([A-Za-z_]\w*)/g)) {
			names.add(m[1]);
		}
	});
	return [...names].sort((a, b) => a.localeCompare(b));
}

export interface KnownVariable {
	name: string;
	label: string;
	type?: VarType;
}

/**
 * Переменные для выбора в формах: из раздела окна (с подписью и типом), затем
 * остальные, найденные в тексте экранов. Служебные переменные движка ($sg…) —
 * не показываются.
 */
export function knownVariables(passages: Array<{name: string; text: string}>, initName = 'StoryInit'): KnownVariable[] {
	const init = passages.find(p => p.name === initName);
	const {variables} = readVariables(init?.text ?? '');
	const result: KnownVariable[] = variables.map(v => ({name: v.name, label: v.label, type: typeOf(v.value)}));

	variablesInTexts(passages.map(p => p.text)).forEach(name => {
		if (!result.some(v => v.name === name) && !/^sg[A-Z]/.test(name)) {
			result.push({name, label: ''});
		}
	});
	return result;
}

/** Подпись для списка: «Глава ($chapter)» или «$chapter». */
export function variableTitle(v: {name: string; label: string}) {
	return v.label ? `${v.label} ($${v.name})` : `$${v.name}`;
}
