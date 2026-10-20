// «Twine СИГНАЛЫ»: оформление терминала (окно «Оформление терминала»).
//
// Настройки хранятся в самой истории — в «Таблице стилей», в блоке между
// метками. В блоке две части:
// - строка-комментарий «СИГНАЛЫ-настройки: {…}» — её читает программа;
// - обычный CSS (переменные --sg-… и правила body, #passages, мерцание,
//   стартовый экран, эффекты) — его читает браузер, поэтому история
//   выглядит так же и в обычном Twine.

import {BlockMarkers, findBlock, putBlock} from './signaly-blocks';
import {
	cutRanges,
	CssDeclaration,
	CssRule,
	declarations,
	normalizeHex,
	parsePx,
	parseSeconds,
	topLevelRules
} from './signaly-css';
import {
	signalyEngineBlock,
	signalyEngineEnd,
	signalyEngineStart,
	signalyEngineVersion
} from './signaly-engine';

export interface SignalyAppearance {
	/** Экран (вся страница). */
	pageBg: string;
	textColor: string;
	/** Системный шрифт («Courier New») — если не выбран файл. */
	font: string;
	/** Файл шрифта из папки игры: «media/fonts/…» или ''. */
	fontFile: string;
	fontSize: number;
	/** Окно терминала (#passages). */
	winWidth: number;
	winHeight: number;
	winPadding: number;
	winOffsetX: number;
	winOffsetY: number;
	winBg: string;
	borderWidth: number;
	borderColor: string;
	glowColor: string;
	/** Радиус свечения, px; второе кольцо — вдвое шире. 0 — без свечения. */
	glowSize: number;
	/** Мерцание всего экрана. */
	flicker: boolean;
	/** Период мерцания, секунды. */
	flickerPeriod: number;
	/** Глубина мерцания, % (яркость падает до 100 − глубина). */
	flickerDepth: number;
	/** Эффекты старого монитора, % (0 — выключено). Только на терминале. */
	vignette: number;
	noise: number;
	/** Защита экрана. */
	noSelect: boolean;
	noContextMenu: boolean;
	noZoom: boolean;
	/** Скрывать курсор через N секунд без движения мыши; 0 — не скрывать. */
	hideCursor: number;
	/** Колесо мыши прокручивает текст по одной строке, без плавности. */
	lineScroll: boolean;
	/** Стартовый экран. */
	startText: string;
	startSound: string;
	/** Громкость звука запуска, %. */
	startVolume: number;
	/** Сохранённые цвета этой истории. */
	savedColors: string[];
}

/** Значения по умолчанию — как в шаблоне автора 27_03_2025. */
export const defaultAppearance: SignalyAppearance = {
	pageBg: '#000000',
	textColor: '#00cc00',
	font: 'Courier New',
	fontFile: '',
	fontSize: 25,
	winWidth: 1050,
	winHeight: 1050,
	winPadding: 20,
	winOffsetX: 0,
	winOffsetY: 0,
	winBg: '#000000',
	borderWidth: 2,
	borderColor: '#00cc00',
	glowColor: '#00cc00',
	glowSize: 10,
	flicker: true,
	flickerPeriod: 0.1,
	flickerDepth: 5,
	vignette: 0,
	noise: 0,
	noSelect: false,
	noContextMenu: false,
	noZoom: false,
	hideCursor: 0,
	lineScroll: false,
	startText: 'Нажмите, чтобы запустить систему',
	startSound: '',
	startVolume: 100,
	savedColors: [
		'#00cc00',
		'#ffbf00',
		'#cc0000',
		'#cccc00',
		'#cc00cc',
		'#000000'
	]
};

/** Системные моноширинные шрифты Windows 11. */
export const systemFonts = [
	'Courier New',
	'Consolas',
	'Lucida Console',
	'Cascadia Mono'
];

export const appearanceMarkers: BlockMarkers = {
	start:
		'/* ===== СИГНАЛЫ: оформление терминала — не редактировать вручную ===== */',
	end: '/* ===== СИГНАЛЫ: конец оформления терминала ===== */'
};

export const engineMarkers: BlockMarkers = {
	start: signalyEngineStart,
	end: signalyEngineEnd
};

const dataPrefix = '/* СИГНАЛЫ-настройки: ';

/** Строка для CSS: "текст" с экранированием. */
function cssString(value: string) {
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

function cssUrl(path: string) {
	return `url(${cssString(path)})`;
}

function fontFamily(a: SignalyAppearance) {
	const fallback = `${cssString(a.font || 'Courier New')}, monospace`;

	return a.fontFile ? `"sg-font", ${fallback}` : fallback;
}

function round(value: number) {
	return Math.round(value * 1000) / 1000;
}

function noiseImage() {
	return cssUrl(
		"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
			"<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
			"<feColorMatrix type='saturate' values='0'/></filter>" +
			"<rect width='100%' height='100%' filter='url(%23n)'/></svg>"
	);
}

/** CSS блока оформления (без меток). */
export function appearanceCss(a: SignalyAppearance): string {
	const lines: string[] = [];
	const data = JSON.stringify({v: 1, ...a}).replace(/\*\//g, '*\\/');

	lines.push(
		'/* Меняется в окне «Оформление терминала» программы «Twine СИГНАЛЫ».',
		'   В своих стилях можно брать эти значения: var(--sg-text), var(--sg-font-size) и т. д. */',
		`${dataPrefix}${data} */`
	);

	if (a.fontFile) {
		lines.push(
			'@font-face {',
			'\tfont-family: "sg-font";',
			`\tsrc: ${cssUrl(a.fontFile)};`,
			'}'
		);
	}

	lines.push(
		':root {',
		`\t--sg-page-bg: ${a.pageBg};`,
		`\t--sg-text: ${a.textColor};`,
		`\t--sg-font: ${fontFamily(a)};`,
		`\t--sg-font-size: ${round(a.fontSize)}px;`,
		`\t--sg-win-bg: ${a.winBg};`,
		`\t--sg-win-width: ${round(a.winWidth)}px;`,
		`\t--sg-win-height: ${round(a.winHeight)}px;`,
		`\t--sg-win-padding: ${round(a.winPadding)}px;`,
		`\t--sg-win-offset-x: ${round(a.winOffsetX)}px;`,
		`\t--sg-win-offset-y: ${round(a.winOffsetY)}px;`,
		`\t--sg-border-width: ${round(a.borderWidth)}px;`,
		`\t--sg-border-color: ${a.borderColor};`,
		`\t--sg-glow-color: ${a.glowColor};`,
		`\t--sg-glow-size: ${round(a.glowSize)}px;`,
		`\t--sg-start-text: ${cssString(a.startText)};`,
		`\t--sg-start-sound: ${cssString(a.startSound)};`,
		`\t--sg-start-volume: ${round(a.startVolume / 100)};`,
		`\t--sg-protect-menu: ${a.noContextMenu ? 1 : 0};`,
		`\t--sg-protect-zoom: ${a.noZoom ? 1 : 0};`,
		`\t--sg-hide-cursor: ${round(a.hideCursor)};`,
		`\t--sg-line-scroll: ${a.lineScroll ? 1 : 0};`,
		'}'
	);

	// Экран.
	lines.push('body {', '\tbackground-color: var(--sg-page-bg);');
	lines.push(
		'\tcolor: var(--sg-text);',
		'\tfont-family: var(--sg-font);',
		'\tfont-size: var(--sg-font-size);',
		'\tmargin: 0;',
		'\theight: 100vh;',
		'\tdisplay: flex;',
		'\tjustify-content: center;',
		'\talign-items: center;',
		'\tposition: relative;'
	);
	if (a.noSelect) {
		lines.push('\tuser-select: none;');
	}
	lines.push('}');

	// Окно терминала.
	lines.push('#passages {', '\tbackground-color: var(--sg-win-bg);');
	lines.push(
		'\tborder: var(--sg-border-width) solid var(--sg-border-color);',
		a.glowSize > 0
			? '\tbox-shadow: 0 0 var(--sg-glow-size) var(--sg-glow-color), 0 0 calc(var(--sg-glow-size) * 2) var(--sg-glow-color);'
			: '\tbox-shadow: none;',
		'\twidth: var(--sg-win-width);',
		'\theight: var(--sg-win-height);',
		'\tpadding: var(--sg-win-padding);',
		'\tbox-sizing: border-box;',
		'\toverflow: auto;'
	);
	if (a.winOffsetX !== 0 || a.winOffsetY !== 0) {
		lines.push(
			'\tposition: relative;',
			'\tleft: var(--sg-win-offset-x);',
			'\ttop: var(--sg-win-offset-y);'
		);
	}
	// Мерцает только терминал (рамка и всё внутри), вокруг — ровный фон.
	if (a.flicker) {
		lines.push(`\tanimation: sg-flicker ${round(a.flickerPeriod)}s infinite;`);
	}
	lines.push('}');

	if (a.flicker) {
		lines.push(
			'@keyframes sg-flicker {',
			'\t0% { opacity: 1; }',
			`\t50% { opacity: ${round(1 - a.flickerDepth / 100)}; }`,
			'\t100% { opacity: 1; }',
			'}'
		);
	}

	if (a.noSelect) {
		lines.push('input, textarea { user-select: text; }');
	}
	lines.push(
		'html.sg-cursor-hidden, html.sg-cursor-hidden * { cursor: none !important; }'
	);

	// Эффекты старого монитора — слой #sg-fx поверх терминала (его ставит
	// движок точно по рамке), сквозь него можно кликать. Экран тревоги
	// (#blockscreen, z-index 1002) остаётся над ним.
	lines.push(
		'#sg-fx {',
		'\tposition: fixed;',
		'\tpointer-events: none;',
		'\tz-index: 1000;',
		'\toverflow: hidden;',
		'}'
	);
	if (a.vignette > 0) {
		lines.push(
			'#sg-fx::before {',
			'\tcontent: "";',
			'\tposition: absolute;',
			'\tinset: 0;',
			'\tpointer-events: none;',
			`\tbackground: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, ${round(
				a.vignette / 100
			)}) 100%);`,
			'}'
		);
	}
	if (a.noise > 0) {
		lines.push(
			'#sg-fx::after {',
			'\tcontent: "";',
			'\tposition: absolute;',
			'\tinset: 0;',
			'\tpointer-events: none;',
			`\tbackground-image: ${noiseImage()};`,
			`\topacity: ${round(a.noise / 100)};`,
			'\tanimation: sg-noise 0.4s steps(1, end) infinite;',
			'}',
			'@keyframes sg-noise {',
			'\t0% { background-position: 0 0; }',
			'\t25% { background-position: -97px 53px; }',
			'\t50% { background-position: 61px -89px; }',
			'\t75% { background-position: -43px -127px; }',
			'}'
		);
	}

	// Стартовый экран.
	lines.push(
		'#sg-start {',
		'\tposition: fixed;',
		'\tinset: 0;',
		'\tz-index: 2147483647;',
		'\tdisplay: flex;',
		'\talign-items: center;',
		'\tjustify-content: center;',
		'\tpadding: 1em;',
		'\tbox-sizing: border-box;',
		'\tbackground-color: var(--sg-page-bg);',
		'\tcolor: var(--sg-text);',
		'\tfont-family: var(--sg-font);',
		'\tfont-size: var(--sg-font-size);',
		'\ttext-align: center;',
		'\tcursor: pointer;',
		'\tuser-select: none;',
		'}',
		'#sg-start::after {',
		'\tcontent: var(--sg-start-text);',
		'\tanimation: sg-blink 1.2s steps(1, end) infinite;',
		'}',
		'@keyframes sg-blink {',
		'\t50% { opacity: 0; }',
		'}'
	);

	return lines.join('\n');
}

export function appearanceBlock(a: SignalyAppearance) {
	return `${appearanceMarkers.start}\n${appearanceCss(a)}\n${appearanceMarkers.end}`;
}

/** Настройки из блока оформления или undefined, если блока нет. */
export function readAppearance(
	stylesheet: string
): SignalyAppearance | undefined {
	const block = findBlock(stylesheet, appearanceMarkers);

	if (!block) {
		return undefined;
	}

	const at = block.inner.indexOf(dataPrefix);

	if (at === -1) {
		return {...defaultAppearance};
	}

	const end = block.inner.indexOf(' */', at);

	try {
		const data = JSON.parse(
			block.inner.slice(at + dataPrefix.length, end === -1 ? undefined : end)
		);

		return sanitizeAppearance(data);
	} catch {
		return {...defaultAppearance};
	}
}

/** Приводит данные к нужным типам; неизвестное заменяет значениями по умолчанию. */
export function sanitizeAppearance(data: any): SignalyAppearance {
	const result = {...defaultAppearance};

	if (!data || typeof data !== 'object') {
		return result;
	}
	(Object.keys(defaultAppearance) as Array<keyof SignalyAppearance>).forEach(
		key => {
			const value = data[key];
			const fallback = defaultAppearance[key];

			if (Array.isArray(fallback)) {
				if (Array.isArray(value)) {
					(result as any)[key] = value
						.map(item => normalizeHex(String(item)))
						.filter(Boolean);
				}
			} else if (typeof value === typeof fallback) {
				if (typeof value === 'number' && !isFinite(value)) {
					return;
				}
				if (
					typeof value === 'string' &&
					/(Bg|Color)$/.test(key) &&
					!normalizeHex(value)
				) {
					return;
				}
				(result as any)[key] = value;
			}
		}
	);
	return result;
}

/* ----- Перенос настроек из таблицы стилей автора ----- */

export interface MigrationResult {
	appearance: SignalyAppearance;
	/** Таблица стилей без перенесённого (блок ещё не вставлен). */
	stylesheet: string;
	/** Что перенесено — для отчёта. */
	moved: string[];
}

function ruleBySelector(rules: CssRule[], selector: string) {
	return rules.find(rule => !rule.at && rule.selector === selector);
}

/**
 * Переносит общие настройки шаблона в настройки оформления: body, #passages,
 * @keyframes flicker. Окна-сообщения и поля ввода не трогаются (ответ 5б).
 * Объявления, которые программа не понимает, остаются в правилах автора.
 */
export function migrateStylesheet(css: string): MigrationResult {
	const a: SignalyAppearance = {...defaultAppearance, flicker: false};
	const rules = topLevelRules(css);
	const cuts: Array<{from: number; to: number}> = [];
	const moved: string[] = [];
	let flickerName: string | undefined;

	function take(
		rule: CssRule | undefined,
		handler: (decl: CssDeclaration) => boolean
	) {
		if (!rule) {
			return;
		}

		const decls = declarations(css, rule);
		const taken = decls.filter(handler);

		if (taken.length === 0) {
			return;
		}
		moved.push(rule.selector);

		const remaining = cutRanges(
			css.slice(rule.bodyFrom, rule.bodyTo),
			taken.map(d => ({from: d.from - rule.bodyFrom, to: d.to - rule.bodyFrom}))
		);

		if (taken.length === decls.length && /^[\s;]*$/.test(remaining)) {
			// Правило опустело — убираем целиком вместе с переводом строки.
			let to = rule.to;

			while (to < css.length && /[ \t]/.test(css[to])) {
				to++;
			}
			if (css[to] === '\n') {
				to++;
			}
			cuts.push({from: rule.from, to});
		} else {
			taken.forEach(d => cuts.push({from: d.from, to: d.to}));
		}
	}

	const body = ruleBySelector(rules, 'body');

	take(body, d => {
		const hex = normalizeHex(d.value);
		const px = parsePx(d.value);

		switch (d.property) {
			case 'background-color':
				if (hex) {
					a.pageBg = hex;
					return true;
				}
				return false;
			case 'color':
				if (hex) {
					a.textColor = hex;
					return true;
				}
				return false;
			case 'font-family': {
				const first =
					/^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))\s*(?:,\s*monospace\s*)?$/i.exec(
						d.value
					);

				if (first) {
					a.font = (first[1] ?? first[2] ?? first[3]).trim();
					return true;
				}
				return false;
			}
			case 'font-size':
				if (px !== undefined) {
					a.fontSize = px;
					return true;
				}
				return false;
			case 'margin':
				return d.value === '0' || d.value === '0px';
			case 'height':
				return d.value === '100vh';
			case 'display':
				return d.value === 'flex';
			case 'justify-content':
			case 'align-items':
				return d.value === 'center';
			case 'position':
				return d.value === 'relative';
			case 'animation': {
				const match = /^([\w-]+)\s+(\S+)\s+infinite$/.exec(d.value);
				const seconds = match ? parseSeconds(match[2]) : undefined;
				const depth = match ? flickerDepth(css, rules, match[1]) : undefined;

				// Переносим только «своё» мерцание: opacity 1 → x → 1.
				if (match && seconds !== undefined && depth !== undefined) {
					flickerName = match[1];
					a.flicker = true;
					a.flickerPeriod = seconds;
					a.flickerDepth = depth;
					return true;
				}
				return false;
			}
		}
		return false;
	});

	const passages = ruleBySelector(rules, '#passages');

	take(passages, d => {
		const hex = normalizeHex(d.value);
		const px = parsePx(d.value);

		switch (d.property) {
			case 'background-color':
				if (hex) {
					a.winBg = hex;
					return true;
				}
				return false;
			case 'border': {
				const match = /^(\d+(?:\.\d+)?)px solid (#[0-9a-f]{3,6})$/i.exec(
					d.value
				);

				if (match && normalizeHex(match[2])) {
					a.borderWidth = Number(match[1]);
					a.borderColor = normalizeHex(match[2])!;
					return true;
				}
				return false;
			}
			case 'box-shadow': {
				const match =
					/^0 0 (\d+(?:\.\d+)?)px (#[0-9a-f]{3,6}), 0 0 (\d+(?:\.\d+)?)px (#[0-9a-f]{3,6})$/i.exec(
						d.value
					);

				if (
					match &&
					Number(match[3]) === Number(match[1]) * 2 &&
					normalizeHex(match[2]) === normalizeHex(match[4])
				) {
					a.glowSize = Number(match[1]);
					a.glowColor = normalizeHex(match[2])!;
					return true;
				}
				if (d.value === 'none') {
					a.glowSize = 0;
					return true;
				}
				return false;
			}
			case 'width':
				if (px !== undefined) {
					a.winWidth = px;
					return true;
				}
				return false;
			case 'height':
				if (px !== undefined) {
					a.winHeight = px;
					return true;
				}
				return false;
			case 'padding':
				if (px !== undefined) {
					a.winPadding = px;
					return true;
				}
				return false;
			case 'box-sizing':
				return d.value === 'border-box';
			case 'overflow':
				return d.value === 'auto';
		}
		return false;
	});

	// Анимацию мерцания убираем, только если её больше никто не использует.
	if (flickerName) {
		const keyframes = rules.find(r => r.at === `@keyframes ${flickerName}`)!;

		if (namedOnlyInBody(css, flickerName, keyframes, body)) {
			cuts.push(wholeRule(css, keyframes));
			moved.push(`@keyframes ${flickerName}`);
		}
	}

	return {
		appearance: a,
		stylesheet: cutRanges(css, mergeCuts(cuts)),
		moved
	};
}

/** Глубина мерцания, %, если @keyframes name — это opacity 1 → x → 1. */
function flickerDepth(css: string, rules: CssRule[], name: string) {
	const keyframes = rules.find(r => r.at === `@keyframes ${name}`);

	if (!keyframes) {
		return undefined;
	}

	const inner = css
		.slice(keyframes.bodyFrom, keyframes.bodyTo)
		.replace(/\s+/g, '');
	const match =
		/^0%\{opacity:1;?\}50%\{opacity:(0?\.\d+|1);?\}100%\{opacity:1;?\}$/.exec(
			inner
		);

	return match ? Math.round((1 - Number(match[1])) * 100) : undefined;
}

function wholeRule(css: string, rule: CssRule) {
	let to = rule.to;

	while (to < css.length && /[ \t]/.test(css[to])) {
		to++;
	}
	if (css[to] === '\n') {
		to++;
	}
	return {from: rule.from, to};
}

function namedOnlyInBody(
	css: string,
	name: string,
	keyframes: CssRule,
	body: CssRule | undefined
) {
	if (!body) {
		return false;
	}

	const re = new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`);
	const [first, second] = [keyframes, body].sort((x, y) => x.from - y.from);
	const outside =
		css.slice(0, first.from) +
		css.slice(first.to, second.from) +
		css.slice(second.to);

	return !re.test(outside);
}

/** Убирает вырезы, вложенные в другие (объявление внутри удалённого правила). */
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

/* ----- Применение к истории ----- */

const oldSettingsBlock =
	/\/\* ===== СИГНАЛЫ: общие настройки ===== \*\/[\s\S]*?\/\* ===== КОНЕЦ: общие настройки ===== \*\/\s*/;

/** Есть ли в истории блок оформления. */
export function hasAppearance(stylesheet: string) {
	return findBlock(stylesheet, appearanceMarkers) !== undefined;
}

/** Версия движка в JavaScript истории (0 — движка нет). */
export function engineVersionIn(script: string) {
	const block = findBlock(script, engineMarkers);

	if (!block) {
		return 0;
	}

	const match = /Версия движка: (\d+)/.exec(block.inner);

	return match ? Number(match[1]) : 0;
}

/** JavaScript истории со свежим движком (старый блок «общие настройки» убирается). */
export function withEngine(script: string) {
	return putBlock(
		script.replace(oldSettingsBlock, ''),
		engineMarkers,
		signalyEngineBlock()
	);
}

/** Таблица стилей с новым блоком оформления. */
export function withAppearance(stylesheet: string, a: SignalyAppearance) {
	return putBlock(stylesheet, appearanceMarkers, appearanceBlock(a));
}

export interface AppliedStory {
	script: string;
	stylesheet: string;
	appearance: SignalyAppearance;
	/** Что перенесено из стилей автора при первом открытии. */
	moved: string[];
}

/**
 * Готовит историю к окну оформления: если блока ещё нет, переносит настройки из
 * стилей автора; ставит или обновляет движок.
 */
export function prepareStory(script: string, stylesheet: string): AppliedStory {
	const existing = readAppearance(stylesheet);

	if (existing) {
		return {
			appearance: existing,
			moved: [],
			script: withEngine(script),
			stylesheet
		};
	}

	const migration = migrateStylesheet(stylesheet);

	return {
		appearance: migration.appearance,
		moved: migration.moved,
		script: withEngine(script),
		stylesheet: withAppearance(migration.stylesheet, migration.appearance)
	};
}

export {signalyEngineVersion};
