// «Twine СИГНАЛЫ»: эффекты текста (шаг 2.1, ответы автора 5А–7А). В тексте
// пассажа — обычные команды SugarCube и HTML, поэтому всё работает и в обычном
// Twine:
//   печать           <<type 40ms start 1s none>>текст<</type>>
//   появление        <<timed 3s>>текст<</timed>>
//   по очереди      <<timed 1s>>строка 1
//                    <<next>>строка 2<</timed>>
//   смена через N с  <span id="sg-swap1">старый</span><<timed 3s>><<replace "#sg-swap1">>новый<</replace>><</timed>>
//   мигание          <span class="sg-blink">текст</span> (style="animation-duration: 0.5s")
//   глитч            <span class="glitchy" data-text="подменный">текст</span>
// Кнопка «Эффект» в панели над текстом ставит их на выделенный текст; щелчок по
// команде открывает форму. Непонятые слова в командах сохраняются как есть.

import {quote} from './signaly-screen-blocks';

export type EffectType = 'type' | 'timed' | 'swap' | 'blink' | 'glitch';
export type Cursor = 'blink' | 'none' | 'keep';

export interface TypeValues {
	/** Скорость: миллисекунд на букву. */
	speed: number;
	/** Пауза перед печатью, с (undefined — как у SugarCube, 0,4 с). */
	start?: number;
	cursor: Cursor;
	/** Печатать в строку (element "span"), а не отдельным абзацем. */
	inline: boolean;
}

export interface TimedSection {
	/** Задержка, с; у <<next>> без числа — undefined (как у предыдущей). */
	delay?: number;
	content: string;
}

export interface Effect {
	type: EffectType;
	/** Где эффект в тексте целиком. */
	from: number;
	to: number;
	/** Где содержимое (текст под эффектом). */
	contentFrom: number;
	contentTo: number;
	/** Непонятые слова команды (печать, появление) — сохраняются. */
	extra: string[];
	type_?: TypeValues;
	/** Появление: разделы <<timed>>…<<next>>…; плавно — t8n. */
	sections?: TimedSection[];
	fade?: boolean;
	/** Смена: какой элемент меняется, новый текст, плавно. */
	target?: string;
	replacement?: string;
	replaceFade?: boolean;
	/** Мигание: период, с. */
	period?: number;
	/** Глитч: подменный текст. */
	shadow?: string;
}

/* ----- Время ----- */

/** «40ms», «0.5s», «2s» → секунды; undefined, если не время. */
export function parseTime(token: string): number | undefined {
	const t = token.replace(/^["']|["']$/g, '');
	const match = /^(\d*\.?\d+)(ms|s)$/i.exec(t);

	if (!match) {
		return undefined;
	}

	const value = Number(match[1]);

	return match[2].toLowerCase() === 'ms' ? value / 1000 : value;
}

function round(value: number) {
	return String(Math.round(value * 1000) / 1000);
}

export function writeSeconds(seconds: number) {
	return `${round(seconds)}s`;
}

/* ----- Слова команды ----- */

function tokens(text: string) {
	const result: string[] = [];
	const re = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+/g;
	let match;

	while ((match = re.exec(text))) {
		result.push(match[0]);
	}
	return result;
}

function unquoteToken(token: string) {
	const q = token[0];

	return q === '"' || q === "'" ? token.slice(1, -1).replace(/\\(.)/g, '$1') : token;
}

/** Конец открывающей команды «<<имя …>>» с учётом кавычек. */
function headEnd(text: string, from: number) {
	let i = from;

	while (i < text.length) {
		const ch = text[i];

		if (ch === '"' || ch === "'") {
			i++;
			while (i < text.length && text[i] !== ch) {
				i += text[i] === '\\' ? 2 : 1;
			}
			i++;
			continue;
		}
		if (ch === '>' && text[i + 1] === '>') {
			return i + 2;
		}
		i++;
	}
	return -1;
}

/** Закрывающая команда с учётом вложенных одноимённых. */
function findClose(text: string, name: string, from: number) {
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

/* ----- Печать ----- */

function readType(args: string[]) {
	const values: TypeValues = {speed: 40, cursor: 'blink', inline: false};
	const extra: string[] = [];
	const speed = args.length ? parseTime(args[0]) : undefined;
	let i = 1;

	if (speed === undefined) {
		return undefined;
	}
	values.speed = Math.round(speed * 1000);
	while (i < args.length) {
		const word = args[i];
		const next = args[i + 1];

		if (word === 'start' && next !== undefined && parseTime(next) !== undefined) {
			values.start = parseTime(next);
			i += 2;
		} else if (word === 'none' || word === 'keep') {
			values.cursor = word;
			i++;
		} else if (word === 'element' && next !== undefined && unquoteToken(next) === 'span') {
			values.inline = true;
			i += 2;
		} else {
			extra.push(word);
			i++;
		}
	}
	return {values, extra};
}

export function typeHead(values: TypeValues, extra: string[] = []) {
	const parts = [`${Math.round(values.speed)}ms`];

	if (values.start !== undefined) {
		parts.push('start', writeSeconds(values.start));
	}
	if (values.inline) {
		parts.push('element', '"span"');
	}
	if (values.cursor !== 'blink') {
		parts.push(values.cursor);
	}
	parts.push(...extra);
	return `<<type ${parts.join(' ')}>>`;
}

/* ----- Появление и смена ----- */

const replaceRe = /^\s*<<replace\s+("#[^"]+"|'#[^']+')(\s+(?:t8n|transition))?\s*>>([^]*)<<\/replace>>\s*$/;

function splitSections(content: string, firstDelay: number): TimedSection[] | undefined {
	const sections: TimedSection[] = [];
	const re = /<<next(?=[\s>])/g;
	let start = 0;
	let delay: number | undefined = firstDelay;
	let match: RegExpExecArray | null;

	// <<next>> только верхнего уровня: вложенные <<timed>> пропускаем.
	const depthAt = (index: number) =>
		(content.slice(0, index).match(/<<timed[\s>]/g) ?? []).length -
		(content.slice(0, index).match(/<<\/timed>>/g) ?? []).length;

	while ((match = re.exec(content))) {
		if (depthAt(match.index) !== 0) {
			continue;
		}

		const end = headEnd(content, match.index + 6);

		if (end === -1) {
			return undefined;
		}

		const args = tokens(content.slice(match.index + 6, end - 2));

		sections.push({delay, content: content.slice(start, match.index)});
		if (args.length > 1 || (args.length === 1 && parseTime(args[0]) === undefined)) {
			return undefined;
		}
		delay = args.length ? parseTime(args[0]) : undefined;
		start = end;
		re.lastIndex = end;
	}
	sections.push({delay, content: content.slice(start)});
	return sections;
}

export function timedHead(delay: number, fade: boolean, extra: string[] = []) {
	return `<<timed ${writeSeconds(delay)}${fade ? ' t8n' : ''}${extra.length ? ' ' + extra.join(' ') : ''}>>`;
}

/**
 * Текст <<timed>> с разделами (появление по очереди). У <<next>> число пишется,
 * только если оно задано (без числа — как у предыдущей строки).
 */
export function writeTimed(sections: TimedSection[], fade: boolean, extra: string[] = []) {
	return (
		timedHead(sections[0]?.delay ?? 1, fade, extra) +
		sections
			.map((section, index) =>
				index === 0
					? section.content
					: (section.delay === undefined ? '<<next>>' : `<<next ${writeSeconds(section.delay)}>>`) +
					  section.content
			)
			.join('') +
		'<</timed>>'
	);
}

export function writeSwap(
	delay: number,
	target: string,
	replacement: string,
	fade: boolean,
	replaceFade: boolean,
	extra: string[] = []
) {
	return (
		timedHead(delay, fade, extra) +
		`<<replace ${quote('#' + target)}${replaceFade ? ' t8n' : ''}>>${replacement}<</replace>>` +
		'<</timed>>'
	);
}

/* ----- Мигание и глитч (теги span) ----- */

const spanOpen = /<span\b([^>]*)>/gi;

function attr(attrs: string, name: string) {
	const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs);

	return match ? match[2] ?? match[3] : undefined;
}

/** Закрывающий </span> с учётом вложенных span. */
function spanClose(text: string, from: number) {
	const re = /<(\/?)span\b[^>]*>/gi;
	let depth = 1;
	let match: RegExpExecArray | null;

	re.lastIndex = from;
	while ((match = re.exec(text))) {
		if (match[1]) {
			depth--;
			if (depth === 0) {
				return {at: match.index, end: match.index + match[0].length};
			}
		} else if (!match[0].endsWith('/>')) {
			depth++;
		}
	}
	return undefined;
}

export function htmlAttr(value: string) {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function fromHtmlAttr(value: string) {
	return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export function blinkOpen(period?: number) {
	return period === undefined || period === 1
		? '<span class="sg-blink">'
		: `<span class="sg-blink" style="animation-duration: ${writeSeconds(period)}">`;
}

export function glitchOpen(shadow: string) {
	return `<span class="glitchy" data-text="${htmlAttr(shadow)}">`;
}

/* ----- Поиск эффектов ----- */

/** Все эффекты в тексте пассажа по порядку (вложенные тоже). */
export function findEffects(text: string): Effect[] {
	const effects: Effect[] = [];
	const macroRe = /<<(type|timed)(?=[\s>])/g;
	let match: RegExpExecArray | null;

	while ((match = macroRe.exec(text))) {
		const name = match[1];
		const end = headEnd(text, match.index + 2 + name.length);

		if (end === -1) {
			break;
		}

		const close = findClose(text, name, end);

		if (!close) {
			continue;
		}

		const args = tokens(text.slice(match.index + 2 + name.length, end - 2));
		const base = {
			from: match.index,
			to: close.end,
			contentFrom: end,
			contentTo: close.at
		};
		const content = text.slice(end, close.at);

		if (name === 'type') {
			const read = readType(args);

			if (read) {
				effects.push({type: 'type', ...base, extra: read.extra, type_: read.values});
			}
			continue;
		}

		const delay = args.length ? parseTime(args[0]) : undefined;

		if (delay === undefined) {
			continue;
		}

		const fade = args.slice(1).some(a => a === 't8n' || a === 'transition');
		const extra = args.slice(1).filter(a => a !== 't8n' && a !== 'transition');
		const swap = replaceRe.exec(content);

		if (swap && !/<<next[\s>]/.test(content)) {
			effects.push({
				type: 'swap',
				...base,
				extra,
				fade,
				target: unquoteToken(swap[1]).slice(1),
				replaceFade: swap[2] !== undefined,
				replacement: swap[3],
				sections: [{delay, content}]
			});
			continue;
		}

		const sections = splitSections(content, delay);

		if (sections) {
			effects.push({type: 'timed', ...base, extra, fade, sections});
		}
	}

	spanOpen.lastIndex = 0;
	while ((match = spanOpen.exec(text))) {
		const attrs = match[1];
		const cls = (attr(attrs, 'class') ?? '').split(/\s+/).filter(Boolean);
		const kind = cls.includes('sg-blink') ? 'blink' : cls.includes('glitchy') ? 'glitch' : undefined;

		if (!kind) {
			continue;
		}

		const close = spanClose(text, match.index + match[0].length);

		if (!close) {
			continue;
		}

		const effect: Effect = {
			type: kind,
			from: match.index,
			to: close.end,
			contentFrom: match.index + match[0].length,
			contentTo: close.at,
			extra: []
		};

		if (kind === 'blink') {
			const style = attr(attrs, 'style') ?? '';
			const duration = /animation-duration\s*:\s*([\d.]+m?s)/i.exec(style);

			effect.period = duration ? parseTime(duration[1]) : 1;
		} else {
			effect.shadow = fromHtmlAttr(attr(attrs, 'data-text') ?? '');
		}
		effects.push(effect);
	}

	return effects.sort((a, b) => a.from - b.from);
}

/* ----- Запись ----- */

/** Текст эффекта целиком (как он встанет в пассаж). */
export function writeEffect(effect: Effect, content: string) {
	switch (effect.type) {
		case 'type':
			return `${typeHead(effect.type_!, effect.extra)}${content}<</type>>`;
		case 'timed':
			return writeTimed(effect.sections!, !!effect.fade, effect.extra);
		case 'swap':
			return writeSwap(
				effect.sections?.[0]?.delay ?? 3,
				effect.target ?? '',
				effect.replacement ?? '',
				!!effect.fade,
				!!effect.replaceFade,
				effect.extra
			);
		case 'blink':
			return `${blinkOpen(effect.period)}${content}</span>`;
		case 'glitch':
			return `${glitchOpen(effect.shadow ?? '')}${content}</span>`;
	}
}

/** Текст пассажа с изменённым эффектом. */
export function replaceEffect(text: string, effect: Effect, changed: Effect) {
	const content = text.slice(effect.contentFrom, effect.contentTo);

	return text.slice(0, effect.from) + writeEffect(changed, content) + text.slice(effect.to);
}

/* ----- Новый эффект на выделенный текст ----- */

/** Свободное имя для <span id="…"> смены текста. */
export function freeSwapId(text: string) {
	let n = 1;

	while (new RegExp(`id\\s*=\\s*["']sg-swap${n}["']`).test(text)) {
		n++;
	}
	return `sg-swap${n}`;
}

export interface NewEffect {
	insert: string;
	/** Смещение начала эффекта внутри insert (для формы). */
	at: number;
}

/** Что вставить вместо выделенного текста (пусто — образец). */
export function newEffect(
	type: EffectType,
	selected: string,
	text: string,
	sample: string,
	sampleNew: string
): NewEffect {
	const body = selected === '' ? sample : selected;

	switch (type) {
		case 'type':
			return {insert: `${typeHead({speed: 40, cursor: 'blink', inline: false})}${body}<</type>>`, at: 0};
		case 'timed':
			return {insert: `${timedHead(3, false)}${body}<</timed>>`, at: 0};
		case 'swap': {
			const id = freeSwapId(text);
			const span = `<span id="${id}">${body}</span>`;

			return {insert: span + writeSwap(3, id, sampleNew, false, false), at: span.length};
		}
		case 'blink':
			return {insert: `${blinkOpen()}${body}</span>`, at: 0};
		case 'glitch':
			return {insert: `${glitchOpen(body)}${body}</span>`, at: 0};
	}
}

/** Появление строк по очереди: каждая выделенная строка — свой раздел. */
export function newLinesEffect(selected: string, sample: string, interval = 1): NewEffect {
	const lines = (selected === '' ? sample : selected).split('\n');
	const sections = lines.map((line, index) => ({
		delay: index === 0 ? interval : undefined,
		content: line + (index < lines.length - 1 ? '\n' : '')
	}));

	return {insert: writeTimed(sections, false), at: 0};
}

/** id элементов в тексте (для выбора, что меняется). */
export function idsIn(text: string) {
	const ids = new Set<string>();

	for (const match of text.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) {
		ids.add(match[1]);
	}
	return [...ids];
}
