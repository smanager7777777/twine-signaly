// «Twine СИГНАЛЫ»: виды кнопок и ссылок и «кнопки на экране» (окно «Виды
// кнопок и ссылок», шаг 1.3).
//
// Хранится в «Таблице стилей», в блоке между метками (сразу после блока
// оформления):
// - строка-комментарий «СИГНАЛЫ-виды: {…}» — её читает программа;
// - обычный CSS — его читает браузер, поэтому история выглядит так же и в
//   обычном Twine.
//
// Вид назначается в пассаже обёрткой: <span class="amber">…ссылки и
// кнопки…</span>. Основной вид — правила для всех a и button.
// Кнопки на экране (places, классы sg-place-…) были здесь до сессии 6; теперь
// это элементы <<sg-place>> в пассажах, а места только читаются для переноса
// (signaly-places.ts).

import {BlockMarkers, findBlock, putBlock} from './signaly-blocks';
import {
	CssDeclaration,
	CssRule,
	declarations,
	normalizeHex,
	parsePx,
	parseSeconds,
	topLevelRules
} from './signaly-css';

/** Как выглядит ссылка или кнопка в одном состоянии. */
export interface LookState {
	color: string;
	/** Цвет фона; '' — без фона. */
	bg: string;
	/** Толщина рамки, px; 0 — без рамки. */
	borderWidth: number;
	borderColor: string;
	/** Свечение, px; 0 — без свечения. */
	glow: number;
	glowColor: string;
	underline: boolean;
}

/** Облик ссылок или кнопок одного вида. */
export interface Look {
	normal: LookState;
	hover: LookState;
	/** При нажатии; null — как при наведении. */
	active: LookState | null;
	/** Отступы внутри рамки, px. */
	padV: number;
	padH: number;
	/** Размер текста, % от обычного текста. */
	size: number;
	/** Плавность смены состояний, секунды. */
	transition: number;
}

export interface Kind {
	/** Класс в пассаже; '' — основной вид (все ссылки и кнопки). */
	cls: string;
	/** Название в программе. */
	name: string;
	link: Look;
	button: Look;
	/** Кнопки выглядят как ссылки этого вида. */
	buttonAsLink: boolean;
}

export type PlaceCorner = 'tl' | 'tr' | 'bl' | 'br';

/** Кнопка на экране — место, заданное от угла окна терминала. */
export interface Place {
	/** Имя места: класс в пассаже — «sg-place-<id>». */
	id: string;
	name: string;
	corner: PlaceCorner;
	/** Отступ от вертикального края окна (левого или правого), px. */
	x: number;
	/** Отступ от верхнего или нижнего края окна, px. */
	y: number;
	/** Вид кнопки (класс вида, '' — основной) — для вставки и образцов. */
	kind: string;
}

export interface SignalyKinds {
	kinds: Kind[];
	places: Place[];
}

export const placePrefix = 'sg-place-';

export const kindsMarkers: BlockMarkers = {
	start:
		'/* ===== СИГНАЛЫ: виды кнопок и ссылок — не редактировать вручную ===== */',
	end: '/* ===== СИГНАЛЫ: конец видов кнопок и ссылок ===== */'
};

const dataPrefix = '/* СИГНАЛЫ-виды: ';

/** Названия видов из шаблона автора. */
const knownNames: Record<string, string> = {
	'': 'Обычный',
	amber: 'Янтарный',
	'red-big': 'Красный большой',
	'yellow-small': 'Жёлтый маленький',
	purple: 'Фиолетовый'
};

/* ----- Значения по умолчанию ----- */

function state(
	color: string,
	partial: Partial<LookState> = {}
): LookState {
	return {
		color,
		bg: '',
		borderWidth: 0,
		borderColor: color,
		glow: 0,
		glowColor: color,
		underline: false,
		...partial
	};
}

/** Ссылка-текст: цвет, при наведении ярче и подчёркнута. */
export function textLook(color: string, hoverColor: string): Look {
	return {
		normal: state(color),
		hover: state(hoverColor, {borderColor: color, glowColor: color, underline: true}),
		active: null,
		padV: 0,
		padH: 0,
		size: 100,
		transition: 0.2
	};
}

/** Кнопка в рамке со свечением, при наведении заливается цветом. */
export function framedLook(color: string, background = '#000000'): Look {
	const frame = {bg: background, borderWidth: 1, glow: 5};

	return {
		normal: state(color, frame),
		hover: state(background, {...frame, bg: color, borderColor: color, glowColor: color}),
		active: null,
		padV: 5,
		padH: 10,
		size: 100,
		transition: 0.3
	};
}

export function newKind(cls: string, name: string, color: string): Kind {
	return {
		cls,
		name,
		link: textLook(color, color),
		button: framedLook(color),
		buttonAsLink: false
	};
}

export function cloneLook(look: Look): Look {
	return JSON.parse(JSON.stringify(look));
}

/* ----- CSS ----- */

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

type Prop = 'color' | 'bg' | 'border' | 'glow' | 'decoration';

function propCss(s: LookState): Record<Prop, string> {
	return {
		color: `color: ${s.color};`,
		bg: `background-color: ${s.bg || 'transparent'};`,
		border:
			s.borderWidth > 0
				? `border: ${round(s.borderWidth)}px solid ${s.borderColor};`
				: 'border: none;',
		glow:
			s.glow > 0
				? `box-shadow: 0 0 ${round(s.glow)}px ${s.glowColor};`
				: 'box-shadow: none;',
		decoration: `text-decoration: ${s.underline ? 'underline' : 'none'};`
	};
}

const allProps: Prop[] = ['color', 'bg', 'border', 'glow', 'decoration'];

function rule(selector: string, lines: string[]) {
	return lines.length === 0
		? ''
		: `${selector} {\n${lines.map(l => '\t' + l).join('\n')}\n}`;
}

/**
 * Правила одного облика. base — правила для всех a/button (основной вид):
 * у ссылок пишется только то, что отличается от простого текста, а у
 * наведения — всё, что меняет SugarCube, чтобы его цвета не просочились.
 */
function lookCss(selector: string, look: Look, target: 'link' | 'button', base: boolean) {
	const normal = propCss(look.normal);
	const hover = propCss(look.hover);
	const lines: string[] = [];

	allProps.forEach(p => {
		const plain =
			base &&
			target === 'link' &&
			((p === 'bg' && look.normal.bg === '') ||
				(p === 'border' && look.normal.borderWidth === 0) ||
				(p === 'glow' && look.normal.glow === 0));

		if (!plain) {
			lines.push(normal[p]);
		}
	});

	if (!(base && target === 'link' && look.padV === 0 && look.padH === 0)) {
		lines.push(`padding: ${round(look.padV)}px ${round(look.padH)}px;`);
	}
	if (!(base && look.size === 100)) {
		lines.push(`font-size: ${round(look.size / 100)}em;`);
	}
	lines.push(`transition: all ${round(look.transition)}s;`);

	// То, что SugarCube меняет при наведении сам.
	const forced: Prop[] = !base
		? []
		: target === 'link'
		? ['color', 'decoration']
		: ['bg', 'border'];
	const hoverLines = allProps
		.filter(p => forced.includes(p) || hover[p] !== normal[p])
		.map(p => hover[p]);
	const result = [rule(selector, lines), rule(`${selector}:hover`, hoverLines)];

	if (look.active) {
		const active = propCss(look.active);

		result.push(
			rule(
				`${selector}:active`,
				allProps.filter(p => active[p] !== hover[p]).map(p => active[p])
			)
		);
	}
	return result.filter(Boolean).join('\n');
}

function kindCss(kind: Kind) {
	const base = kind.cls === '';
	const scope = base ? '' : `.${kind.cls} `;

	return [
		lookCss(`${scope}a`, kind.link, 'link', base),
		lookCss(
			`${scope}button`,
			kind.buttonAsLink ? kind.link : kind.button,
			'button',
			base
		)
	].join('\n');
}

/** Где стоит кнопка на экране: от угла окна терминала (переменные оформления). */
export function placeCss(place: Place) {
	const halfW = 'var(--sg-win-width, 1050px) / 2';
	const halfH = 'var(--sg-win-height, 1050px) / 2';
	const offX = 'var(--sg-win-offset-x, 0px)';
	const offY = 'var(--sg-win-offset-y, 0px)';
	const x = `${round(place.x)}px`;
	const y = `${round(place.y)}px`;
	const right = place.corner === 'tr' || place.corner === 'br';
	const bottom = place.corner === 'bl' || place.corner === 'br';

	return rule(`.${placePrefix}${place.id}`, [
		'position: fixed;',
		right
			? `right: calc(50% - ${halfW} - ${offX} + ${x});`
			: `left: calc(50% - ${halfW} + ${offX} + ${x});`,
		bottom
			? `bottom: calc(50% - ${halfH} - ${offY} + ${y});`
			: `top: calc(50% - ${halfH} + ${offY} + ${y});`
	]);
}

export function kindsCss(data: SignalyKinds): string {
	const json = JSON.stringify({v: 1, ...data}).replace(/\*\//g, '*\\/');
	const parts = [
		'/* Меняется в окне «Виды кнопок и ссылок» программы «Twine СИГНАЛЫ».',
		'   В пассаже вид назначается обёрткой: <span class="amber">…ссылки и кнопки…</span>. */',
		`${dataPrefix}${json} */`,
		...data.kinds.map(kindCss),
		...data.places.map(placeCss)
	];

	return parts.join('\n');
}

export function kindsBlock(data: SignalyKinds) {
	return `${kindsMarkers.start}\n${kindsCss(data)}\n${kindsMarkers.end}`;
}

/** CSS только для предпросмотра: класс sg-demo-hover / sg-demo-active показывает состояние без мыши. */
export function demoStatesCss(data: SignalyKinds) {
	const result: string[] = [
		'.sg-demo-table { border-collapse: collapse; }',
		'.sg-demo-table th, .sg-demo-table td { padding: 10px 14px; text-align: left; vertical-align: middle; font-weight: normal; opacity: 1; }',
		'.sg-demo-table th { opacity: 0.6; }',
		'.sg-demo-table td button { margin-top: 8px; }'
	];

	data.kinds.forEach(kind => {
		const scope = kind.cls === '' ? '.sg-demo-plain ' : `.${kind.cls} `;

		(['link', 'button'] as const).forEach(target => {
			const look =
				target === 'button' && kind.buttonAsLink ? kind.link : kind[target];
			const tag = target === 'link' ? 'a' : 'button';
			const hover = propCss(look.hover);
			const active = propCss(look.active ?? look.hover);

			result.push(
				rule(
					`.sg-demo-hover ${scope}${tag}`,
					allProps.map(p => hover[p].replace(';', ' !important;'))
				),
				rule(
					`.sg-demo-active ${scope}${tag}`,
					allProps.map(p => active[p].replace(';', ' !important;'))
				)
			);
		});
	});
	return result.join('\n');
}

/** Текст экрана-образца для предпросмотра: каждый вид в трёх состояниях. */
export function demoPassageText(data: SignalyKinds, labels: DemoLabels) {
	const sample = `<<link "${labels.link}">><</link>><br><<button "${labels.button}">><</button>>`;
	const cell = (kind: Kind, state: string) =>
		`<td class="${state}"><span class="${kind.cls || 'sg-demo-plain'}">${sample}</span></td>`;
	const rows = data.kinds.map(
		kind =>
			`<tr><td class="sg-demo-name">${verbatim(kind.name)}</td>` +
			cell(kind, '') +
			cell(kind, 'sg-demo-hover') +
			cell(kind, 'sg-demo-active') +
			'</tr>'
	);
	return (
		'<table class="sg-demo-table"><tr><th></th>' +
		`<th>${labels.normal}</th><th>${labels.hover}</th><th>${labels.active}</th></tr>` +
		rows.join('') +
		'</table>'
	);
}

export interface DemoLabels {
	link: string;
	button: string;
	normal: string;
	hover: string;
	active: string;
}

/** Название как обычный текст (без разметки SugarCube). */
function verbatim(text: string) {
	return `"""${text.replace(/"""/g, '"')}"""`;
}

/* ----- Чтение ----- */

function sanitizeState(data: any, fallback: LookState): LookState {
	const result = {...fallback};

	if (!data || typeof data !== 'object') {
		return result;
	}
	(['color', 'borderColor', 'glowColor'] as const).forEach(key => {
		const hex = typeof data[key] === 'string' && normalizeHex(data[key]);

		if (hex) {
			result[key] = hex;
		}
	});
	if (data.bg === '') {
		result.bg = '';
	} else if (typeof data.bg === 'string' && normalizeHex(data.bg)) {
		result.bg = normalizeHex(data.bg)!;
	}
	(['borderWidth', 'glow'] as const).forEach(key => {
		if (typeof data[key] === 'number' && isFinite(data[key]) && data[key] >= 0) {
			result[key] = data[key];
		}
	});
	if (typeof data.underline === 'boolean') {
		result.underline = data.underline;
	}
	return result;
}

function sanitizeLook(data: any, fallback: Look): Look {
	if (!data || typeof data !== 'object') {
		return cloneLook(fallback);
	}

	const normal = sanitizeState(data.normal, fallback.normal);
	const num = (key: 'padV' | 'padH' | 'size' | 'transition') =>
		typeof data[key] === 'number' && isFinite(data[key]) && data[key] >= 0
			? data[key]
			: fallback[key];

	return {
		normal,
		hover: sanitizeState(data.hover, fallback.hover),
		active:
			data.active && typeof data.active === 'object'
				? sanitizeState(data.active, fallback.hover)
				: null,
		padV: num('padV'),
		padH: num('padH'),
		size: num('size') || 100,
		transition: num('transition')
	};
}

const classPattern = /^[A-Za-z_][\w-]*$/;

export function sanitizeKinds(data: any): SignalyKinds {
	const kinds: Kind[] = [];
	const places: Place[] = [];

	if (data && Array.isArray(data.kinds)) {
		data.kinds.forEach((k: any) => {
			if (!k || typeof k !== 'object') {
				return;
			}

			const cls = typeof k.cls === 'string' ? k.cls : '';

			if (
				(cls !== '' && !classPattern.test(cls)) ||
				kinds.some(other => other.cls === cls)
			) {
				return;
			}

			const fallback = newKind(cls, '', '#00cc00');

			kinds.push({
				cls,
				name:
					typeof k.name === 'string' && k.name.trim() !== ''
						? k.name
						: knownNames[cls] ?? cls,
				link: sanitizeLook(k.link, fallback.link),
				button: sanitizeLook(k.button, fallback.button),
				buttonAsLink: k.buttonAsLink === true
			});
		});
	}
	if (!kinds.some(k => k.cls === '')) {
		kinds.unshift(newKind('', knownNames[''], '#00cc00'));
	}
	if (data && Array.isArray(data.places)) {
		data.places.forEach((p: any) => {
			if (
				!p ||
				typeof p.id !== 'string' ||
				!/^[a-z0-9][a-z0-9-]*$/.test(p.id) ||
				places.some(other => other.id === p.id)
			) {
				return;
			}
			places.push({
				id: p.id,
				name: typeof p.name === 'string' && p.name !== '' ? p.name : p.id,
				corner: ['tl', 'tr', 'bl', 'br'].includes(p.corner) ? p.corner : 'tl',
				x: typeof p.x === 'number' && isFinite(p.x) ? p.x : 0,
				y: typeof p.y === 'number' && isFinite(p.y) ? p.y : 0,
				kind:
					typeof p.kind === 'string' && classPattern.test(p.kind) ? p.kind : ''
			});
		});
	}
	return {kinds, places};
}

/** Данные блока видов или undefined, если блока нет. */
export function readKinds(stylesheet: string): SignalyKinds | undefined {
	const block = findBlock(stylesheet, kindsMarkers);

	if (!block) {
		return undefined;
	}

	const at = block.inner.indexOf(dataPrefix);

	if (at === -1) {
		return sanitizeKinds({});
	}

	const end = block.inner.indexOf(' */', at);

	try {
		return sanitizeKinds(
			JSON.parse(
				block.inner.slice(at + dataPrefix.length, end === -1 ? undefined : end)
			)
		);
	} catch {
		return sanitizeKinds({});
	}
}

/**
 * Таблица стилей с новым блоком видов. Новый блок встаёт сразу после блока
 * оформления (after), чтобы порядок правил был тем же, что у автора.
 */
export function withKinds(
	stylesheet: string,
	data: SignalyKinds,
	after?: BlockMarkers
) {
	const block = kindsBlock(data);

	if (findBlock(stylesheet, kindsMarkers) || !after) {
		return putBlock(stylesheet, kindsMarkers, block);
	}

	const previous = findBlock(stylesheet, after);

	if (!previous) {
		return putBlock(stylesheet, kindsMarkers, block);
	}

	const rest = stylesheet.slice(previous.to).replace(/^\s+/, '');

	return (
		stylesheet.slice(0, previous.to) +
		'\n\n' +
		block +
		(rest === '' ? '\n' : '\n\n\n' + rest)
	);
}

/* ----- Перенос правил из таблицы стилей автора ----- */

type TargetState = 'normal' | 'hover' | 'active';

interface Target {
	/** Класс вида ('' — основной). */
	cls: string;
	target: 'link' | 'button';
	state: TargetState;
	/** Дубль «.amber-link» / «.amber-button» — класс прямо на ссылке. */
	dup: boolean;
}

/** Частичное состояние — то, что задано в одном правиле. */
interface Partial_ {
	color?: string;
	bg?: string;
	borderWidth?: number;
	borderColor?: string;
	glow?: number;
	glowColor?: string;
	underline?: boolean;
	padV?: number;
	padH?: number;
	size?: number;
	transition?: number;
}

function classifySelector(selector: string): Target | undefined {
	const match =
		/^(?:\.([A-Za-z_][\w-]*)\s+)?(a|button)(?::(hover|active))?$/.exec(selector) ??
		undefined;

	if (match) {
		return {
			cls: match[1] ?? '',
			target: match[2] === 'a' ? 'link' : 'button',
			state: (match[3] as TargetState) ?? 'normal',
			dup: false
		};
	}

	const dup = /^\.([A-Za-z_][\w-]*)-(link|button)(?::(hover|active))?$/.exec(
		selector
	);

	if (dup) {
		return {
			cls: dup[1],
			target: dup[2] === 'link' ? 'link' : 'button',
			state: (dup[3] as TargetState) ?? 'normal',
			dup: true
		};
	}
	return undefined;
}

/** Понимает одно объявление; undefined — не понимает (останется у автора). */
function parseDeclaration(d: CssDeclaration): Partial_ | undefined {
	const value = d.value.replace(/\s*!important$/i, '');
	const hex = normalizeHex(value);

	switch (d.property) {
		case 'color':
			return hex ? {color: hex} : undefined;
		case 'background':
		case 'background-color':
			if (hex) {
				return {bg: hex};
			}
			return /^(transparent|none)$/i.test(value) ? {bg: ''} : undefined;
		case 'border': {
			if (/^(none|0)$/i.test(value)) {
				return {borderWidth: 0};
			}
			if (hex) {
				// «border: #cc0000» — без толщины и стиля: рамки нет.
				return {borderWidth: 0, borderColor: hex};
			}

			const match = /^(\d+(?:\.\d+)?)px solid (#[0-9a-f]{3,6})$/i.exec(value);

			return match && normalizeHex(match[2])
				? {borderWidth: Number(match[1]), borderColor: normalizeHex(match[2])}
				: undefined;
		}
		case 'border-color':
			return hex ? {borderColor: hex} : undefined;
		case 'box-shadow': {
			if (value === 'none') {
				return {glow: 0};
			}

			const match = /^0 0 (\d+(?:\.\d+)?)px (#[0-9a-f]{3,6})$/i.exec(value);

			return match && normalizeHex(match[2])
				? {glow: Number(match[1]), glowColor: normalizeHex(match[2])}
				: undefined;
		}
		case 'text-decoration':
			return value === 'none'
				? {underline: false}
				: value === 'underline'
				? {underline: true}
				: undefined;
		case 'padding': {
			const parts = value.split(' ').map(parsePx);

			if (parts.some(p => p === undefined) || parts.length > 2) {
				return undefined;
			}
			return {padV: parts[0], padH: parts[1] ?? parts[0]};
		}
		case 'font-size': {
			const em = /^(\d+(?:\.\d+)?)em$/.exec(value);
			const percent = /^(\d+(?:\.\d+)?)%$/.exec(value);

			if (em) {
				return {size: Math.round(Number(em[1]) * 1000) / 10};
			}
			return percent ? {size: Number(percent[1])} : undefined;
		}
		case 'transition': {
			// «background-color 0.3s, color 0.3s» → 0.3 с (у всех одинаково).
			const seconds = value
				.split(',')
				.map(part => {
					const words = part.trim().split(' ');

					return words.length <= 2 ? parseSeconds(words[words.length - 1]) : undefined;
				});

			return seconds.every(s => s !== undefined && s === seconds[0])
				? {transition: seconds[0]}
				: undefined;
		}
		case 'transition-duration': {
			const seconds = parseSeconds(value);

			return seconds === undefined ? undefined : {transition: seconds};
		}
	}
	return undefined;
}

/** Как SugarCube рисует ссылки и кнопки без стилей автора. */
const sugarcubeBase: Record<'link' | 'button', Record<TargetState, Partial_>> = {
	link: {
		normal: {
			color: '#6688dd',
			bg: '',
			borderWidth: 0,
			glow: 0,
			underline: false,
			padV: 0,
			padH: 0,
			size: 100,
			transition: 0.2
		},
		hover: {color: '#88aaff', underline: true},
		active: {}
	},
	button: {
		normal: {
			color: '#eeeeee',
			bg: '#3355aa',
			borderWidth: 1,
			borderColor: '#5577cc',
			glow: 0,
			glowColor: '#5577cc',
			underline: false,
			padV: 10,
			padH: 10,
			size: 100,
			transition: 0.2
		},
		hover: {bg: '#5577cc', borderColor: '#7799ee'},
		active: {}
	}
};

function toState(p: Partial_): LookState {
	return {
		color: p.color!,
		bg: p.bg ?? '',
		borderWidth: p.borderWidth ?? 0,
		borderColor: p.borderColor ?? p.color!,
		glow: p.glow ?? 0,
		glowColor: p.glowColor ?? p.color!,
		underline: p.underline ?? false
	};
}

export interface KindsMigration {
	kinds: SignalyKinds;
	/** Таблица стилей без перенесённого (блок ещё не вставлен). */
	stylesheet: string;
	/** Что перенесено — для отчёта. */
	moved: string[];
}

/** Используется ли класс в текстах пассажей. */
function classUsed(cls: string, texts: string[]) {
	const re = new RegExp(`(^|[^\\w-])${cls}([^\\w-]|$)`);

	return texts.some(text => re.test(text));
}

/**
 * Переносит правила ссылок и кнопок автора в виды: a, button, .X a, .X button
 * (с :hover и :active), а также дубли .X-link / .X-button, если они не
 * используются в пассажах. Непонятные объявления остаются у автора.
 */
export function migrateKinds(css: string, passageTexts: string[]): KindsMigration {
	const rules = topLevelRules(css).filter(r => !r.at);
	const cuts: Array<{from: number; to: number}> = [];
	const moved: string[] = [];
	// Заданное в правилах автора, по порядку: [вид, цель, состояние] → части.
	const found: Array<{t: Target; p: Partial_; order: number}> = [];
	const classes: string[] = [];
	const hasPlain = new Set<string>();

	rules.forEach(rule => {
		const selectors = rule.selector.split(',').map(s => s.trim());
		const targets = selectors.map(classifySelector);

		if (targets.some(t => t === undefined)) {
			return;
		}
		if (targets.some(t => t!.dup && classUsed(`${t!.cls}-${t!.target}`, passageTexts))) {
			return;
		}
		if (declarations(css, rule).map(parseDeclaration).some(p => p === undefined)) {
			return;
		}
		targets.forEach(t => {
			if (!t!.dup) {
				hasPlain.add(`${t!.cls}/${t!.target}`);
			}
		});
	});

	rules.forEach((rule, order) => {
		const selectors = rule.selector.split(',').map(s => s.trim());
		const targets = selectors.map(classifySelector);

		if (targets.some(t => t === undefined)) {
			return;
		}
		if (targets.some(t => t!.dup && classUsed(`${t!.cls}-${t!.target}`, passageTexts))) {
			return;
		}

		const decls = declarations(css, rule);
		const parsed = decls.map(parseDeclaration);

		// Переносим правило, только если понятно всё (иначе оно остаётся у
		// автора целиком, как было).
		if (decls.length === 0 || parsed.some(p => p === undefined)) {
			return;
		}

		const partial: Partial_ = Object.assign({}, ...parsed);

		targets.forEach(t => {
			// Дубль переносится, только если у вида нет «настоящего» правила.
			if (t!.dup && hasPlain.has(`${t!.cls}/${t!.target}`)) {
				return;
			}
			if (t!.cls !== '' && !classes.includes(t!.cls)) {
				classes.push(t!.cls);
			}
			found.push({t: t!, p: partial, order});
		});

		moved.push(rule.selector);
		cutRule(css, rule, cuts);
	});

	function look(cls: string, target: 'link' | 'button'): Look {
		const own = (c: string, state: TargetState) =>
			found
				.filter(f => f.t.cls === c && f.t.target === target && f.t.state === state)
				.sort((a, b) => a.order - b.order)
				.map(f => f.p);
		const base = sugarcubeBase[target];
		const classOwn = (state: TargetState) => (cls === '' ? [] : own(cls, state));
		// Каскад как в браузере (по весу правил): SugarCube a → автор a →
		// SugarCube a:hover → автор a:hover → .X a → .X a:hover → :active.
		const normal: Partial_ = Object.assign(
			{},
			base.normal,
			...own('', 'normal'),
			...classOwn('normal')
		);
		const hover: Partial_ = Object.assign(
			{},
			base.normal,
			...own('', 'normal'),
			base.hover,
			...own('', 'hover'),
			...classOwn('normal'),
			...classOwn('hover')
		);
		const activeParts = [...own('', 'active'), ...classOwn('active')];
		const active: Partial_ | null =
			activeParts.length === 0 ? null : Object.assign({}, hover, ...activeParts);

		return {
			normal: toState(normal),
			hover: toState(hover),
			active: active ? toState(active) : null,
			padV: normal.padV ?? 0,
			padH: normal.padH ?? 0,
			size: normal.size ?? 100,
			transition: normal.transition ?? 0.2
		};
	}

	const kinds: Kind[] = ['', ...classes].map(cls => {
		const hasButton = found.some(f => f.t.cls === cls && f.t.target === 'button');
		const hasLink = found.some(f => f.t.cls === cls && f.t.target === 'link');
		const link = look(cls, 'link');
		let button = look(cls, 'button');

		// У вида нет своих кнопок (фиолетовый) — кнопки в рамке его цвета.
		if (cls !== '' && !hasButton && hasLink) {
			button = framedLook(link.normal.color);
		}
		return {
			cls,
			name: knownNames[cls] ?? cls,
			link,
			button,
			buttonAsLink: false
		};
	});

	return {
		kinds: {kinds, places: []},
		stylesheet: cutTidy(css, mergeCuts(cuts)),
		moved
	};
}

/** Вырезает куски; на стыке оставляет не больше двух пустых строк. */
function cutTidy(css: string, cuts: Array<{from: number; to: number}>) {
	let result = css;

	[...cuts]
		.sort((a, b) => b.from - a.from)
		.forEach(({from, to}) => {
			const left = result.slice(0, from).replace(/\s+$/, '');
			const right = result.slice(to).replace(/^\s+/, '');
			const gap = result.slice(left.length, from) + result.slice(to, result.length - right.length);
			const lines = Math.min((gap.match(/\n/g) ?? []).length, 3);

			result = left + (left && right ? '\n'.repeat(Math.max(lines, 1)) : '') + right;
		});
	return result;
}

/** Убирает правило целиком — с комментариями прямо над ним и пустыми строками за ним. */
function cutRule(
	css: string,
	rule: CssRule,
	cuts: Array<{from: number; to: number}>
) {
	let from = rule.from;
	let to = rule.to;

	for (;;) {
		const comment = /\/\*(?:(?!\*\/)[\s\S])*\*\/[ \t]*\n?[ \t]*$/.exec(
			css.slice(0, from)
		);

		if (!comment || /СИГНАЛЫ: (конец|виды|оформление)/.test(comment[0])) {
			break;
		}
		from = comment.index;
	}
	// Хвост: пробелы, перевод строки и следующие пустые строки.
	const tail = /^[ \t]*(?:\n[ \t]*)*(?=\n|$)/.exec(css.slice(to));

	to += tail ? tail[0].length : 0;
	cuts.push({from, to});
}

function mergeCuts(cuts: Array<{from: number; to: number}>) {
	const sorted = [...cuts].sort((a, b) => a.from - b.from || b.to - a.to);
	const result: Array<{from: number; to: number}> = [];

	sorted.forEach(cut => {
		const last = result[result.length - 1];

		if (last && cut.from < last.to) {
			last.to = Math.max(last.to, cut.to);
		} else {
			result.push({...cut});
		}
	});
	return result;
}

/* ----- Подготовка истории ----- */

export interface PreparedKinds {
	kinds: SignalyKinds;
	stylesheet: string;
	moved: string[];
}

/** Готовит таблицу стилей к окну видов: если блока нет — переносит правила автора. */
export function prepareKinds(
	stylesheet: string,
	passageTexts: string[]
): PreparedKinds {
	const existing = readKinds(stylesheet);

	if (existing) {
		return {kinds: existing, stylesheet, moved: []};
	}

	const migration = migrateKinds(stylesheet, passageTexts);

	return {
		kinds: migration.kinds,
		stylesheet: migration.stylesheet,
		moved: migration.moved
	};
}

/* ----- Помощники для окна и панели ----- */

const translit: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
	и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
	с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
	щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

/** Название по-русски → имя класса латиницей («Синий» → «siniy»). */
export function slugify(name: string) {
	const slug = name
		.toLowerCase()
		.split('')
		.map(c => translit[c] ?? c)
		.join('')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return /^[a-z]/.test(slug) ? slug : `vid-${slug || '1'}`;
}

/** Свободное имя класса, не совпадающее с занятыми. */
export function uniqueName(base: string, taken: string[]) {
	if (!taken.includes(base)) {
		return base;
	}

	let n = 2;

	while (taken.includes(`${base}-${n}`)) {
		n++;
	}
	return `${base}-${n}`;
}

/** Классы, которые стоят в атрибуте class="…" (и в разметке @@.класс;) текста. */
export function classesIn(text: string): string[] {
	const result: string[] = [];

	for (const match of text.matchAll(/class\s*=\s*["']([^"']*)["']/g)) {
		result.push(...match[1].split(/\s+/).filter(Boolean));
	}
	for (const match of text.matchAll(/@@((?:[#.][\w-]+;)+)/g)) {
		match[1]
			.split(';')
			.filter(part => part.startsWith('.'))
			.forEach(part => result.push(part.slice(1)));
	}
	return result;
}

/** В скольких пассажах встречается класс. */
export function classUseCount(cls: string, texts: string[]) {
	return texts.filter(text => classesIn(text).includes(cls)).length;
}
