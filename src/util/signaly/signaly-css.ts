// «Twine СИГНАЛЫ»: простой разбор таблицы стилей автора — ровно столько,
// чтобы перенести общие настройки (body, #passages, мерцание) в блок
// оформления, не трогая остальной код.

export interface CssRule {
	/** Селектор, пробелы схлопнуты: "input, textarea". */
	selector: string;
	/** Начало правила (селектора) в тексте. */
	from: number;
	/** Сразу за закрывающей скобкой. */
	to: number;
	/** Позиция сразу за «{». */
	bodyFrom: number;
	/** Позиция «}». */
	bodyTo: number;
	/** Для @-правил: "@keyframes flicker". */
	at?: string;
}

export interface CssDeclaration {
	property: string;
	value: string;
	/** Границы объявления в тексте (с отступом перед ним и «;» после). */
	from: number;
	to: number;
}

/** Строка для CSS: "текст" с экранированием. */
export function cssString(value: string) {
	return (
		'"' +
		value
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"') +
		'"'
	);
}

export function cssUrl(path: string) {
	return `url(${cssString(path)})`;
}

function skipComment(css: string, at: number) {
	const end = css.indexOf('*/', at + 2);

	return end === -1 ? css.length : end + 2;
}

function skipString(css: string, at: number) {
	const quote = css[at];
	let i = at + 1;

	while (i < css.length && css[i] !== quote) {
		i += css[i] === '\\' ? 2 : 1;
	}
	return i + 1;
}

function matchingBrace(css: string, open: number) {
	let depth = 0;
	let i = open;

	while (i < css.length) {
		const char = css[i];

		if (char === '/' && css[i + 1] === '*') {
			i = skipComment(css, i);
			continue;
		}
		if (char === '"' || char === "'") {
			i = skipString(css, i);
			continue;
		}
		if (char === '{') {
			depth++;
		} else if (char === '}') {
			depth--;
			if (depth === 0) {
				return i;
			}
		}
		i++;
	}
	return css.length;
}

/** Правила верхнего уровня (вложенные — внутри @-правил — не разбираются). */
export function topLevelRules(css: string): CssRule[] {
	const result: CssRule[] = [];
	let i = 0;
	let start = -1;

	while (i < css.length) {
		const char = css[i];

		if (char === '/' && css[i + 1] === '*') {
			i = skipComment(css, i);
			continue;
		}
		if (char === '"' || char === "'") {
			if (start === -1) {
				start = i;
			}
			i = skipString(css, i);
			continue;
		}
		if (char === ';' && start !== -1 && css[start] === '@') {
			// @import, @charset — без тела.
			start = -1;
			i++;
			continue;
		}
		if (char === '{') {
			const close = matchingBrace(css, i);
			const head = css
				.slice(start === -1 ? i : start, i)
				.replace(/\/\*[\s\S]*?\*\//g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			const rule: CssRule = {
				selector: head,
				from: start === -1 ? i : start,
				to: close + 1,
				bodyFrom: i + 1,
				bodyTo: close
			};

			if (head.startsWith('@')) {
				rule.at = head;
			}
			result.push(rule);
			start = -1;
			i = close + 1;
			continue;
		}
		if (start === -1 && !/\s/.test(char)) {
			start = i;
		}
		i++;
	}
	return result;
}

/** Объявления «свойство: значение;» внутри тела правила. */
export function declarations(css: string, rule: CssRule): CssDeclaration[] {
	const result: CssDeclaration[] = [];
	let i = rule.bodyFrom;
	let declStart = i;

	function flush(end: number, after: number) {
		const text = css.slice(declStart, end);
		const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
		const colon = clean.indexOf(':');

		if (colon !== -1) {
			// Отступ и перевод строки перед объявлением уходят вместе с ним.
			let from = declStart;

			while (from < end && /\s/.test(css[from])) {
				from++;
			}
			while (from > rule.bodyFrom && /[ \t]/.test(css[from - 1])) {
				from--;
			}
			if (from > rule.bodyFrom && css[from - 1] === '\n') {
				from--;
			}
			result.push({
				property: clean.slice(0, colon).trim().toLowerCase(),
				value: clean
					.slice(colon + 1)
					.replace(/\s+/g, ' ')
					.trim(),
				from,
				to: after
			});
		}
	}

	while (i < rule.bodyTo) {
		const char = css[i];

		if (char === '/' && css[i + 1] === '*') {
			// Комментарий между объявлениями — не часть следующего объявления.
			const end = skipComment(css, i);

			if (css.slice(declStart, i).trim() === '') {
				declStart = end;
			}
			i = end;
			continue;
		}
		if (char === '"' || char === "'") {
			i = skipString(css, i);
			continue;
		}
		if (char === '(') {
			const close = css.indexOf(')', i);

			i = close === -1 ? rule.bodyTo : close + 1;
			continue;
		}
		if (char === ';') {
			flush(i, i + 1);
			declStart = i + 1;
		}
		i++;
	}
	if (css.slice(declStart, rule.bodyTo).trim() !== '') {
		flush(rule.bodyTo, rule.bodyTo);
	}
	return result;
}

/**
 * Вырезает из текста указанные куски (объявления или правила целиком).
 * Куски не должны пересекаться.
 */
export function cutRanges(
	css: string,
	ranges: Array<{from: number; to: number}>
): string {
	let result = css;

	[...ranges]
		.sort((a, b) => b.from - a.from)
		.forEach(({from, to}) => {
			result = result.slice(0, from) + result.slice(to);
		});
	return result;
}

/** Цвет вида #abc / #aabbcc → #aabbcc (нижний регистр); иначе undefined. */
export function normalizeHex(value: string): string | undefined {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());

	if (!match) {
		return undefined;
	}

	let hex = match[1].toLowerCase();

	if (hex.length === 3) {
		hex = hex
			.split('')
			.map(c => c + c)
			.join('');
	}
	return '#' + hex;
}

/** "25px" → 25; иначе undefined. */
export function parsePx(value: string): number | undefined {
	const match = /^(-?\d+(?:\.\d+)?)px$/i.exec(value.trim());

	return match ? Number(match[1]) : undefined;
}

/** "0.1s" / "100ms" → секунды; иначе undefined. */
export function parseSeconds(value: string): number | undefined {
	const match = /^(\d+(?:\.\d+)?)(m?s)$/i.exec(value.trim());

	if (!match) {
		return undefined;
	}
	return match[2].toLowerCase() === 'ms'
		? Number(match[1]) / 1000
		: Number(match[1]);
}
