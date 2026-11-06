// «Twine СИГНАЛЫ»: подсказка при наведении (шаг 5.4, ответ 4А). В тексте — та же
// команда <<hovertip "Текст подсказки" [ширина]>>текст<</hovertip>>, что и в
// шаблоне. Её понимает движок, поэтому кнопка «Подсказка» работает и в новой
// истории; вид рамки — в «Оформлении терминала» (переменные --sg-tip-…). Здесь —
// разбор и запись команды, основа стилей и перенос кода шаблона: он становится
// не нужен и убирается, только если узнан целиком.

import type {Edit} from './signaly-format';
import {scriptHash} from './signaly-hack';
import {findClose, quote, scanArgs, unquote} from './signaly-screen-blocks';

/** Вид подсказки по умолчанию — как в стилях автора (hovertip v2.0). */
export const tipDefaults = {
	tipBg: '#000000',
	tipColor: '#00cc00',
	tipBorderColor: '#00cc00',
	tipBorderWidth: 2,
	tipRadius: 6,
	tipWidth: 333,
	tipFont: '',
	tipSize: 0,
	tipLineColor: '#00cc00',
	tipLineWidth: 2
};

const d = tipDefaults;

/**
 * Основа стилей: то, что не настраивается, и вид через переменные. Правила вида
 * с html: сильнее стилей автора, если их код не перенесён. Без блока оформления
 * действуют значения автора.
 */
export const tipBase = [
	'.hoverTip { border-width: 0; display: inline-block; top: 4px; }',
	'.hoverTipTxt { line-height: initial; position: relative; vertical-align: text-bottom; }',
	'.hoverTipTxt .hoverBox { position: absolute; visibility: hidden; }',
	'.hoverTipTxt:hover .hoverBox, .hoverTipTxt:focus .hoverBox { visibility: visible; }',
	'.hoverBox { box-shadow: 0 0 12px 2px rgba(0, 0, 0, 0.75); line-height: initial; padding: 3px 10px; text-align: left; width: max-content; z-index: 100; }',
	'.hoverTail::after { border-style: solid; border-width: 8px; content: ""; left: 50%; margin-left: -5px; position: absolute; top: 100%; z-index: 100; }',
	'.hoverBox a { transition-duration: unset; }',
	'#ui-bar .hoverBox { max-width: 230px; }',
	`html .hoverTip { border-bottom: var(--sg-tip-line, ${d.tipLineWidth}px) dotted var(--sg-tip-line-color, ${d.tipLineColor}); }`,
	`html .hoverBox { background-color: var(--sg-tip-bg, ${d.tipBg}); border: var(--sg-tip-border, ${d.tipBorderWidth}px) solid var(--sg-tip-border-color, ${d.tipBorderColor}); border-radius: var(--sg-tip-radius, ${d.tipRadius}px); color: var(--sg-tip-color, ${d.tipColor}); font-family: var(--sg-tip-font, inherit); font-size: var(--sg-tip-size, inherit); max-width: var(--sg-tip-width, ${d.tipWidth}px); }`,
	`html .hoverTail::after { border-color: var(--sg-tip-border-color, ${d.tipBorderColor}) transparent transparent transparent; }`
].join('\n') + '\n';

export interface Tip {
	/** Начало и конец всей команды. */
	from: number;
	to: number;
	headTo: number;
	/** Конец текста на экране: дальше закрывающая команда. */
	closeFrom: number;
	/** Текст подсказки. */
	tip: string;
	/** Своя ширина, px; 0 — как в «Оформлении терминала». */
	width: number;
}

const tipOpen = /<<hovertip(?=[\s>])/g;

export function findTips(text: string) {
	const tips: Tip[] = [];

	for (const match of text.matchAll(tipOpen)) {
		const scan = scanArgs(text, match.index! + match[0].length);
		const close = scan && findClose(text, 'hovertip', scan.end);

		if (scan && close) {
			tips.push({
				from: match.index!,
				to: close.end,
				headTo: scan.end,
				closeFrom: close.at,
				tip: scan.tokens[0] === undefined ? '' : String(unquote(scan.tokens[0])),
				width: Math.max(0, parseInt(scan.tokens[1] ?? '', 10) || 0)
			});
		}
	}
	return tips;
}

export function tipContent(text: string, tip: Tip) {
	return text.slice(tip.headTo, tip.closeFrom);
}

function head(tip: string, width: number) {
	return `<<hovertip ${quote(tip)}${width > 0 ? ` ${Math.round(width)}` : ''}>>`;
}

/** Текст пассажа с изменённой подсказкой. */
export function setTip(text: string, tip: Tip, patch: {tip?: string; width?: number; content?: string}) {
	return (
		text.slice(0, tip.from) +
		head(patch.tip ?? tip.tip, patch.width ?? tip.width) +
		(patch.content ?? tipContent(text, tip)) +
		text.slice(tip.closeFrom)
	);
}

/** Текст пассажа без подсказки: текст на экране остаётся. */
export function removeTip(text: string, tip: Tip) {
	return text.slice(0, tip.from) + tipContent(text, tip) + text.slice(tip.to);
}

/** Выделенный текст получает подсказку; без выделения вставляется образец. */
export function wrapTip(text: string, from: number, to: number, sample: string, tip: string): Edit {
	const open = head(tip, 0);
	const content = from === to ? sample : text.slice(from, to);

	return {
		from,
		to,
		insert: `${open}${content}<</hovertip>>`,
		selFrom: from + open.length,
		selTo: from + open.length + content.length
	};
}

/* ----- Перенос кода шаблона ----- */

// Контрольные числа кода hovertip v2.0 шаблона 27_03_2025.
const templateScript = 1785917346;
const templateStyle = 733462551;

const scriptRe = /\/\* hovertip v2\.0 - Старт ?\*\/[^]*?\/\* hovertip v2\.0 - Конец ?\*\//;

export const tipMovedNote = '/* СИГНАЛЫ: подсказка при наведении перенесена в движок (шаг 5.4). */';
export const tipStyleNote = '/* СИГНАЛЫ: вид подсказки — в «Оформлении терминала» (шаг 5.4). */';

function moved(source: string, sample: number, note: string) {
	return source.replace(scriptRe, code =>
		scriptHash(code.replace(/\r\n/g, '\n')) === sample ? note : code
	);
}

/** JavaScript истории и таблица стилей без кода подсказки шаблона. */
export function moveTemplateTips(script: string, stylesheet: string) {
	return {
		script: moved(script, templateScript, tipMovedNote),
		stylesheet: moved(stylesheet, templateStyle, tipStyleNote)
	};
}
