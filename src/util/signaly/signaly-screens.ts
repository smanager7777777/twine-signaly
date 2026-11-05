// «Twine СИГНАЛЫ»: нестандартные экраны и текст (шаг 4.2, решение 87).
//
// Вид экрана — именованная заготовка: что отличается от общего оформления
// (рамка, окно, цвета, шрифт, положение текста, эффекты). Заготовки хранятся
// в строке настроек блока оформления, а в истории это обычный тег пассажа
// sg-scr-<id>: SugarCube ставит теги пассажа на <html data-tags>, поэтому всё
// работает на обычном CSS и в обычном Twine, без движка.
//
// Стиль текста — заготовка для выделенного текста: <span class="sg-ts-<id>">.
//
// Места «на экране» (кнопки РАД, АТМ, A–E, картинки) считаются от --sg-win-width,
// --sg-win-height и --sg-win-offset-…. Вид экрана их не меняет (задаёт ширину
// и высоту прямо в #passages), поэтому кнопки не прыгают (ответ 4А).

import {cssString, cssUrl, normalizeHex} from './signaly-css';
import {slugify, uniqueName} from './signaly-kinds';

export const screenTagPrefix = 'sg-scr-';
export const textStylePrefix = 'sg-ts-';

/** Девять мест текста на экране; '' — как обычно (сверху слева, без правил). */
export const textPlaces = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'] as const;
export type TextPlace = typeof textPlaces[number] | '';

export type Switch = 'same' | 'on' | 'off';

export interface ScreenView {
	/** Название по-русски. */
	name: string;
	/** Часть тега латиницей: не меняется при переименовании. */
	id: string;
	frame: 'same' | 'none' | 'own';
	borderWidth: number;
	borderColor: string;
	glowSize: number;
	glowColor: string;
	size: 'same' | 'full' | 'own';
	winWidth: number;
	winHeight: number;
	winOffsetX: number;
	winOffsetY: number;
	/** Внутренний отступ окна; null — как обычно. */
	padding: number | null;
	/** Цвета; '' — как обычно. */
	pageBg: string;
	winBg: string;
	textColor: string;
	/** Системный шрифт или файл media/fonts/…; '' — как обычно. */
	font: string;
	/** Размер текста; null — как обычно. */
	fontSize: number | null;
	textPlace: TextPlace;
	flicker: Switch;
	vignette: Switch;
	vignetteValue: number;
	noise: Switch;
	noiseValue: number;
}

export interface TextStyle {
	name: string;
	id: string;
	/** Системный шрифт или файл media/fonts/…; '' — как у текста вокруг. */
	font: string;
	/** Размер, px; null — как у текста вокруг. */
	size: number | null;
	/** Цвет; '' — как у текста вокруг. */
	color: string;
	/** Радиус свечения, px; 0 — без свечения. */
	glow: number;
	/** Цвет свечения; '' — цвет текста. */
	glowColor: string;
	/** Межстрочный интервал, разы; null — как у текста вокруг. */
	lineHeight: number | null;
}

/** Что нужно из общего оформления, чтобы включить эффект, выключенный в общем. */
export interface ScreensBase {
	flicker: boolean;
	flickerPeriod: number;
	flickerDepth: number;
	noise: number;
	fontSize: number;
	fontFamily: string;
}

export function isFontFile(font: string) {
	return font.startsWith('media/');
}

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

export function screenTag(view: Pick<ScreenView, 'id'>) {
	return screenTagPrefix + view.id;
}

export function textStyleClass(style: Pick<TextStyle, 'id'>) {
	return textStylePrefix + style.id;
}

function freeName(base: string, names: string[]) {
	let n = names.length + 1;

	while (names.includes(`${base} ${n}`)) {
		n++;
	}
	return `${base} ${n}`;
}

function freeId(name: string, ids: string[]) {
	return uniqueName(slugify(name), ids);
}

export function newScreenView(views: ScreenView[], base: string): ScreenView {
	const name = freeName(base, views.map(v => v.name));

	return {
		name,
		id: freeId(name, views.map(v => v.id)),
		frame: 'same',
		borderWidth: 2,
		borderColor: '#00cc00',
		glowSize: 10,
		glowColor: '#00cc00',
		size: 'same',
		winWidth: 1050,
		winHeight: 1050,
		winOffsetX: 0,
		winOffsetY: 0,
		padding: null,
		pageBg: '',
		winBg: '',
		textColor: '',
		font: '',
		fontSize: null,
		textPlace: '',
		flicker: 'same',
		vignette: 'same',
		vignetteValue: 40,
		noise: 'same',
		noiseValue: 20
	};
}

export function newTextStyle(styles: TextStyle[], base: string): TextStyle {
	const name = freeName(base, styles.map(s => s.name));

	return {
		name,
		id: freeId(name, styles.map(s => s.id)),
		font: '',
		size: null,
		color: '',
		glow: 0,
		glowColor: '',
		lineHeight: null
	};
}

/** Копия с новым названием и своим тегом или классом. */
export function copyNamed<T extends {name: string; id: string}>(list: T[], item: T, suffix: string): T {
	let name = `${item.name} (${suffix})`;
	let n = 2;

	while (list.some(other => other.name === name)) {
		name = `${item.name} (${suffix} ${n++})`;
	}
	return {...item, name, id: freeId(name, list.map(other => other.id))};
}

/* ----- Настройки из строки блока оформления ----- */

function text(value: unknown, fallback = '') {
	return typeof value === 'string' ? value : fallback;
}

function count(value: unknown, fallback: number) {
	return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function optional(value: unknown) {
	return typeof value === 'number' && isFinite(value) ? value : null;
}

function color(value: unknown, fallback = '') {
	return normalizeHex(text(value)) ?? fallback;
}

function choice<T extends string>(value: unknown, list: readonly T[], fallback: T) {
	return list.includes(value as T) ? (value as T) : fallback;
}

const switches: readonly Switch[] = ['same', 'on', 'off'];

function safeId(value: unknown) {
	return /^[a-z][a-z0-9-]*$/.test(text(value)) ? (value as string) : '';
}

export function sanitizeViews(data: unknown): ScreenView[] {
	if (!Array.isArray(data)) {
		return [];
	}

	const blank = newScreenView([], '');

	return data
		.filter(v => v && typeof v === 'object' && safeId(v.id))
		.map(v => ({
			name: text(v.name, v.id),
			id: v.id,
			frame: choice(v.frame, ['same', 'none', 'own'] as const, 'same'),
			borderWidth: count(v.borderWidth, blank.borderWidth),
			borderColor: color(v.borderColor, blank.borderColor),
			glowSize: count(v.glowSize, blank.glowSize),
			glowColor: color(v.glowColor, blank.glowColor),
			size: choice(v.size, ['same', 'full', 'own'] as const, 'same'),
			winWidth: count(v.winWidth, blank.winWidth),
			winHeight: count(v.winHeight, blank.winHeight),
			winOffsetX: count(v.winOffsetX, 0),
			winOffsetY: count(v.winOffsetY, 0),
			padding: optional(v.padding),
			pageBg: color(v.pageBg),
			winBg: color(v.winBg),
			textColor: color(v.textColor),
			font: text(v.font),
			fontSize: optional(v.fontSize),
			textPlace: choice(v.textPlace, textPlaces, '' as TextPlace),
			flicker: choice(v.flicker, switches, 'same'),
			vignette: choice(v.vignette, switches, 'same'),
			vignetteValue: count(v.vignetteValue, blank.vignetteValue),
			noise: choice(v.noise, switches, 'same'),
			noiseValue: count(v.noiseValue, blank.noiseValue)
		}));
}

export function sanitizeStyles(data: unknown): TextStyle[] {
	if (!Array.isArray(data)) {
		return [];
	}
	return data
		.filter(s => s && typeof s === 'object' && safeId(s.id))
		.map(s => ({
			name: text(s.name, s.id),
			id: s.id,
			font: text(s.font),
			size: optional(s.size),
			color: color(s.color),
			glow: count(s.glow, 0),
			glowColor: color(s.glowColor),
			lineHeight: optional(s.lineHeight)
		}));
}

/* ----- CSS ----- */

function fontFace(family: string, file: string) {
	return ['@font-face {', `\tfont-family: ${cssString(family)};`, `\tsrc: ${cssUrl(file)};`, '}'];
}

function family(font: string, own: string) {
	return isFontFile(font) ? `${cssString(own)}, monospace` : `${cssString(font)}, monospace`;
}

function noiseImage() {
	return cssUrl(
		"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
			"<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
			"<feColorMatrix type='saturate' values='0'/></filter>" +
			"<rect width='100%' height='100%' filter='url(%23n)'/></svg>"
	);
}

export const flickerKeyframes = (depth: number) => [
	'@keyframes sg-flicker {',
	'\t0% { opacity: 1; }',
	`\t50% { opacity: ${round(1 - depth / 100)}; }`,
	'\t100% { opacity: 1; }',
	'}'
];

export function vignetteRule(selector: string, value: number) {
	return [
		`${selector} {`,
		'\tcontent: "";',
		'\tposition: absolute;',
		'\tinset: 0;',
		'\tpointer-events: none;',
		`\tbackground: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, ${round(value / 100)}) 100%);`,
		'}'
	];
}

export function noiseRule(selector: string, value: number) {
	return [
		`${selector} {`,
		'\tcontent: "";',
		'\tposition: absolute;',
		'\tinset: 0;',
		'\tpointer-events: none;',
		`\tbackground-image: ${noiseImage()};`,
		`\topacity: ${round(value / 100)};`,
		'\tanimation: sg-noise 0.4s steps(1, end) infinite;',
		'}'
	];
}

export const noiseKeyframes = [
	'@keyframes sg-noise {',
	'\t0% { background-position: 0 0; }',
	'\t25% { background-position: -97px 53px; }',
	'\t50% { background-position: 61px -89px; }',
	'\t75% { background-position: -43px -127px; }',
	'}'
];

function placeMargins(place: TextPlace) {
	const top = place[0] === 't' ? '0' : 'auto';
	const bottom = place[0] === 'b' ? '0' : 'auto';
	const left = place[1] === 'l' ? '0' : 'auto';
	const right = place[1] === 'r' ? '0' : 'auto';

	return {
		margin: `${top} ${right} ${bottom} ${left}`,
		align: place[1] === 'l' ? 'left' : place[1] === 'c' ? 'center' : 'right'
	};
}

function viewCss(v: ScreenView, base: ScreensBase) {
	const root = `html[data-tags~="${screenTag(v)}"]`;
	const vars: string[] = [];
	const win: string[] = [];
	const lines: string[] = [];
	const shadow = (size: number, c: string) => (size > 0 ? `0 0 ${round(size)}px ${c}, 0 0 ${round(size * 2)}px ${c}` : 'none');

	if (v.pageBg) {
		vars.push(`--sg-page-bg: ${v.pageBg}`);
	}
	if (v.textColor) {
		vars.push(`--sg-text: ${v.textColor}`);
	}
	if (v.winBg) {
		vars.push(`--sg-win-bg: ${v.winBg}`);
	}
	if (v.padding !== null) {
		vars.push(`--sg-win-padding: ${round(v.padding)}px`);
	}
	if (v.fontSize !== null) {
		vars.push(`--sg-font-size: ${round(v.fontSize)}px`);
	}
	if (v.font) {
		const own = `sg-scr-font-${v.id}`;

		if (isFontFile(v.font)) {
			lines.push(...fontFace(own, v.font));
		}
		vars.push(`--sg-font: ${family(v.font, own)}`);
	}
	if (v.frame === 'none') {
		vars.push('--sg-border-width: 0px', '--sg-glow-size: 0px');
		win.push('box-shadow: none');
	} else if (v.frame === 'own') {
		vars.push(
			`--sg-border-width: ${round(v.borderWidth)}px`,
			`--sg-border-color: ${v.borderColor}`,
			`--sg-glow-size: ${round(v.glowSize)}px`,
			`--sg-glow-color: ${v.glowColor}`
		);
		win.push(`box-shadow: ${shadow(v.glowSize, v.glowColor)}`);
	}
	if (v.size === 'full') {
		win.push('position: fixed', 'left: 0', 'top: 0', 'width: 100vw', 'height: 100vh');
	} else if (v.size === 'own') {
		win.push(
			'position: relative',
			`left: ${round(v.winOffsetX)}px`,
			`top: ${round(v.winOffsetY)}px`,
			`width: ${round(v.winWidth)}px`,
			`height: ${round(v.winHeight)}px`
		);
	}
	if (v.flicker === 'off') {
		win.push('animation: none');
	} else if (v.flicker === 'on') {
		win.push(`animation: sg-flicker ${round(base.flickerPeriod)}s infinite`);
	}
	if (v.textPlace) {
		win.push('display: flex', 'flex-direction: column');
	}
	if (vars.length) {
		lines.push(`${root} {`, ...vars.map(d => `\t${d};`), '}');
	}
	if (win.length) {
		lines.push(`${root} #passages {`, ...win.map(d => `\t${d};`), '}');
	}
	if (v.textPlace) {
		const {align, margin} = placeMargins(v.textPlace);

		lines.push(`${root} #passages > .passage {`, `\tmargin: ${margin};`, `\ttext-align: ${align};`, '}');
	}
	// Кнопки на экране не меняются вместе с текстом экрана (ответ 4А).
	if (v.fontSize !== null || v.font) {
		// :where — чтобы вид кнопки со своим размером оставался главнее.
		lines.push(`:where(${root}) .sg-place {`, `\tfont-size: ${round(base.fontSize)}px;`, `\tfont-family: ${base.fontFamily};`, '}');
	}
	if (v.vignette === 'off') {
		lines.push(`${root} #sg-fx::before { content: none; }`);
	} else if (v.vignette === 'on') {
		lines.push(...vignetteRule(`${root} #sg-fx::before`, v.vignetteValue));
	}
	if (v.noise === 'off') {
		lines.push(`${root} #sg-fx::after { content: none; }`);
	} else if (v.noise === 'on') {
		lines.push(...noiseRule(`${root} #sg-fx::after`, v.noiseValue));
	}
	return lines;
}

/** CSS видов экранов (идёт после общих правил блока оформления). */
export function screensCss(views: ScreenView[], base: ScreensBase) {
	const lines = views.flatMap(v => viewCss(v, base));

	if (!base.flicker && views.some(v => v.flicker === 'on')) {
		lines.push(...flickerKeyframes(base.flickerDepth));
	}
	if (base.noise <= 0 && views.some(v => v.noise === 'on')) {
		lines.push(...noiseKeyframes);
	}
	return lines;
}

function styleCss(s: TextStyle) {
	const own = `sg-ts-font-${s.id}`;
	const lines = s.font && isFontFile(s.font) ? fontFace(own, s.font) : [];
	const rules: string[] = [];

	if (s.font) {
		rules.push(`font-family: ${family(s.font, own)}`);
	}
	if (s.size !== null) {
		rules.push(`font-size: ${round(s.size)}px`);
	}
	if (s.color) {
		rules.push(`color: ${s.color}`);
	}
	if (s.glow > 0) {
		rules.push(`text-shadow: 0 0 ${round(s.glow)}px ${s.glowColor || s.color || 'currentColor'}`);
	}
	if (s.lineHeight !== null) {
		// Межстрочный интервал действует только на блок целиком.
		rules.push('display: inline-block', `line-height: ${round(s.lineHeight)}`);
	}
	lines.push(`.${textStyleClass(s)} {`, ...rules.map(d => `\t${d};`), '}');
	return lines;
}

export function textStylesCss(styles: TextStyle[]) {
	return styles.flatMap(styleCss);
}

export interface InputLook {
	inputBg: string;
	inputColor: string;
	inputBorderColor: string;
	inputHoverBg: string;
	inputHoverBorderColor: string;
	inputBorderWidth: number;
	inputGlow: number;
	inputFont: string;
	inputSize: number;
	inputWidth: number;
}

/** Поля ввода: html input сильнее правила автора input, textarea. */
export function inputCss(a: InputLook) {
	const own = 'sg-input-font';
	const lines = a.inputFont && isFontFile(a.inputFont) ? fontFace(own, a.inputFont) : [];

	lines.push(
		'html input, html textarea {',
		`\tbackground-color: ${a.inputBg};`,
		`\tcolor: ${a.inputColor};`,
		`\tborder: ${round(a.inputBorderWidth)}px solid ${a.inputBorderColor};`,
		`\tbox-shadow: ${a.inputGlow > 0 ? `0 0 ${round(a.inputGlow)}px ${a.inputBorderColor}` : 'none'};`,
		`\tfont-size: ${round(a.inputSize)}px;`,
		...(a.inputFont ? [`\tfont-family: ${family(a.inputFont, own)};`] : []),
		...(a.inputWidth > 0 ? [`\twidth: ${round(a.inputWidth)}px;`, '\tbox-sizing: border-box;'] : []),
		'}',
		// У SugarCube input[type=text] { min-width: 18em } сильнее простого правила.
		...(a.inputWidth > 0 ? ['html input[type] { min-width: 0; }'] : []),
		// Ответ 7А (шаг 4.3): SugarCube красит поле при наведении, а при вводе с
		// клавиатуры (data-outlines) — и в фокусе; своё правило сильнее.
		'html input:hover, html textarea:hover, html[data-outlines] input:focus, html[data-outlines] textarea:focus {',
		`\tbackground-color: ${a.inputHoverBg};`,
		`\tborder-color: ${a.inputHoverBorderColor};`,
		'}'
	);
	return lines;
}

/* ----- Какие пассажи чем пользуются ----- */

/** Вид экрана пассажа: первый тег sg-scr-…, который есть в списке. */
export function viewOfTags(tags: string[], views: ScreenView[]) {
	return views.find(v => tags.includes(screenTag(v)));
}

/** Теги пассажа с другим видом экрана (undefined — обычный экран). */
export function tagsWithView(tags: string[], view: ScreenView | undefined) {
	const rest = tags.filter(tag => !tag.startsWith(screenTagPrefix));

	return view ? [...rest, screenTag(view)] : rest;
}
