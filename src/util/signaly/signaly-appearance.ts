// «Twine СИГНАЛЫ»: оформление терминала (окно «Оформление терминала»).
//
// Настройки хранятся в самой истории — в «Таблице стилей», в блоке между
// метками. В блоке две части:
// - строка-комментарий «СИГНАЛЫ-настройки: {…}» — её читает программа;
// - обычный CSS (переменные --sg-… и правила body, #passages, мерцание,
//   стартовый экран, эффекты) — его читает браузер, поэтому история
//   выглядит так же и в обычном Twine.

import {moveTemplateSounds} from './signaly-sounds';
import {cssColor, defaultGlitch, glitchKeyframes, glitchRules, GlitchSettings} from './signaly-glitch';
import {BlockMarkers, findBlock, putBlock} from './signaly-blocks';
import {
	cutRanges,
	CssDeclaration,
	CssRule,
	cssString,
	cssUrl,
	declarations,
	normalizeHex,
	parsePx,
	parseSeconds,
	topLevelRules
} from './signaly-css';
import {firstCss, FirstWay, sanitizeWays} from './signaly-first';
import {
	flickerKeyframes,
	inputCss,
	InputLook,
	noiseKeyframes,
	noiseRule,
	sanitizeStyles,
	sanitizeViews,
	screensCss,
	ScreenView,
	TextStyle,
	textStylesCss,
	vignetteRule
} from './signaly-screens';
import {
	signalyEngineBlock,
	signalyEngineEnd,
	signalyEngineStart,
	signalyEngineVersion
} from './signaly-engine';

export interface SignalyAppearance extends GlitchSettings, InputLook {
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
	/**
	 * Окна-сообщения (шаг 1.4, ответ 4а). Выключено — окна как у SugarCube
	 * (так они выглядели в шаблоне: правила автора .ui-dialog не действовали).
	 */
	dialogOn: boolean;
	dialogBg: string;
	dialogColor: string;
	dialogSize: number;
	dialogBorderColor: string;
	dialogBorderWidth: number;
	dialogGlow: number;
	dialogTitleBg: string;
	dialogTitleColor: string;
	dialogTitleSize: number;
	/** Линия под заголовком, px. */
	dialogTitleLine: number;
	/**
	 * Печать текста (шаг 2.1, ответ 6А): щелчок мышью допечатывает сразу;
	 * при возврате на уже виденный экран текст показывается целиком.
	 * Глитч — поля GlitchSettings (ответ 7А).
	 */
	typeClick: boolean;
	typeSeen: boolean;
	/**
	 * Поля ввода (шаг 4.2, ответ 6А). Выключено — как в стилях автора; значения
	 * по умолчанию — из правила input, textarea шаблона.
	 */
	inputOn: boolean;
	/** Ссылка «Назад» внизу статьи (шаг 4.4, ответ 5А): надпись, вид, кнопкой. */
	articleBack: string;
	articleBackKind: string;
	articleBackButton: boolean;
	/** Виды экранов и стили текста (шаг 4.2, ответы 1А, 2А, 5А). */
	screens: ScreenView[];
	textStyles: TextStyle[];
	/** Способы появления при первом посещении (шаг 4.5). */
	firstWays: FirstWay[];
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
	],
	// Как задумано в правилах автора .ui-dialog шаблона.
	dialogOn: false,
	dialogBg: '#000000',
	dialogColor: '#00cc00',
	dialogSize: 25,
	dialogBorderColor: '#00cc00',
	dialogBorderWidth: 2,
	dialogGlow: 10,
	dialogTitleBg: '#000000',
	dialogTitleColor: '#00cc00',
	dialogTitleSize: 25,
	dialogTitleLine: 1,
	typeClick: true,
	typeSeen: true,
	inputOn: false,
	inputBg: '#000000',
	inputColor: '#00cc00',
	inputBorderColor: '#00cc00',
	inputHoverBg: '#333333',
	inputHoverBorderColor: '#eeeeee',
	inputBorderWidth: 1,
	inputGlow: 5,
	inputFont: '',
	inputSize: 25,
	inputWidth: 0,
	articleBack: 'Назад',
	articleBackKind: '',
	articleBackButton: false,
	screens: [],
	textStyles: [],
	firstWays: [],
	...defaultGlitch
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

function fontFamily(a: SignalyAppearance) {
	const fallback = `${cssString(a.font || 'Courier New')}, monospace`;

	return a.fontFile ? `"sg-font", ${fallback}` : fallback;
}

function round(value: number) {
	return Math.round(value * 1000) / 1000;
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
		`\t--sg-type-click: ${a.typeClick ? 1 : 0};`,
		`\t--sg-type-seen: ${a.typeSeen ? 1 : 0};`,
		`\t--sg-article-back: ${cssString(a.articleBack)};`,
		`\t--sg-article-kind: ${cssString(a.articleBackKind)};`,
		`\t--sg-article-button: ${a.articleBackButton ? 1 : 0};`,
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
		// У SugarCube max-width: 54em — окно не должно зависеть от размера текста.
		'\tmax-width: none;',
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
		lines.push(...flickerKeyframes(a.flickerDepth));
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
		lines.push(...vignetteRule('#sg-fx::before', a.vignette));
	}
	if (a.noise > 0) {
		lines.push(...noiseRule('#sg-fx::after', a.noise), ...noiseKeyframes);
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

	if (a.dialogOn) {
		lines.push(...dialogCss(a));
	}

	if (a.inputOn) {
		lines.push(...inputCss(a));
	}

	// Глитч-текст (шаг 2.1): правила сильнее правил .glitchy автора.
	lines.push(...glitchRules(a, 'html .glitchy'), glitchKeyframes);

	// Виды экранов и стили текста (шаг 4.2) — сильнее общих правил.
	lines.push(
		...screensCss(a.screens, {...a, fontFamily: fontFamily(a)}),
		...textStylesCss(a.textStyles),
		...firstCss(a.firstWays, a.glitchShadow1, a.glitchShadow2)
	);

	return lines.join('\n');
}

/** Оформление окон-сообщений SugarCube (#ui-dialog). */
function dialogCss(a: SignalyAppearance) {
	const glow = round(a.dialogGlow);
	const shadow =
		a.dialogGlow > 0
			? `0 0 ${glow}px ${a.dialogBorderColor}, 0 0 ${round(a.dialogGlow * 2)}px ${a.dialogBorderColor}`
			: 'none';

	return [
		'#ui-dialog {',
		`\tbackground-color: ${a.dialogBg};`,
		`\tborder: ${round(a.dialogBorderWidth)}px solid ${a.dialogBorderColor};`,
		`\tbox-shadow: ${shadow};`,
		`\tcolor: ${a.dialogColor};`,
		`\tfont-size: ${round(a.dialogSize)}px;`,
		'}',
		'#ui-dialog-titlebar {',
		`\tbackground-color: ${a.dialogTitleBg};`,
		`\tcolor: ${a.dialogTitleColor};`,
		`\tborder-bottom: ${round(a.dialogTitleLine)}px solid ${a.dialogBorderColor};`,
		`\tfont-size: ${round(a.dialogTitleSize)}px;`,
		'}',
		'#ui-dialog-close {',
		`\tcolor: ${a.dialogTitleColor};`,
		'}',
		'#ui-dialog-body {',
		`\tbackground-color: ${a.dialogBg};`,
		'\tborder: none;',
		`\tcolor: ${a.dialogColor};`,
		`\tfont-size: ${round(a.dialogSize)}px;`,
		'}'
	];
}

/**
 * Значения окон-сообщений из правил автора .ui-dialog, .ui-dialog-titlebar,
 * .ui-dialog-body (в шаблоне они не действовали — SugarCube 2.37 называет окно
 * #ui-dialog). Берётся только то, что удалось понять.
 */
export function dialogFromAuthor(css: string): Partial<SignalyAppearance> {
	const result: Partial<SignalyAppearance> = {};
	const rules = topLevelRules(css);
	const read = (selector: string) => {
		const rule = rules.find(r => !r.at && r.selector === selector);
		const map: Record<string, string> = {};

		if (rule) {
			declarations(css, rule).forEach(d => (map[d.property] = d.value));
		}
		return map;
	};
	const dialog = read('.ui-dialog');
	const title = read('.ui-dialog-titlebar');
	const body = read('.ui-dialog-body');
	const color = (value: string | undefined) =>
		value === undefined ? undefined : normalizeHex(value);
	const border = /^(\d+(?:\.\d+)?)px\s+solid\s+(#[0-9a-f]{3,6})$/i;
	const set = <K extends keyof SignalyAppearance>(key: K, value: SignalyAppearance[K] | undefined) => {
		if (value !== undefined) {
			result[key] = value;
		}
	};

	set('dialogBg', color(dialog['background-color']));
	set('dialogColor', color(body.color ?? dialog.color));
	set('dialogSize', parsePx(body['font-size'] ?? dialog['font-size'] ?? ''));

	const b = border.exec(dialog.border ?? '');

	if (b) {
		set('dialogBorderWidth', Number(b[1]));
		set('dialogBorderColor', normalizeHex(b[2]));
	}

	const glow = /^0\s+0\s+(\d+(?:\.\d+)?)px/.exec(dialog['box-shadow'] ?? '');

	if (glow) {
		set('dialogGlow', Number(glow[1]));
	}
	set('dialogTitleBg', color(title['background-color']));
	set('dialogTitleColor', color(title.color));
	set('dialogTitleSize', parsePx(title['font-size'] ?? ''));

	const line = border.exec(title['border-bottom'] ?? '');

	if (line) {
		set('dialogTitleLine', Number(line[1]));
	}
	return result;
}

/** Значения полей ввода из правила автора input, textarea (шаг 4.2, ответ 6А). */
export function inputFromAuthor(css: string): Partial<SignalyAppearance> {
	const result: Partial<SignalyAppearance> = {};
	const rule = topLevelRules(css).find(r => !r.at && r.selector === 'input, textarea');
	const map: Record<string, string> = {};

	if (rule) {
		declarations(css, rule).forEach(d => (map[d.property] = d.value));
	}

	const bg = normalizeHex(map['background-color'] ?? '');
	const color = normalizeHex(map.color ?? '');
	const size = parsePx(map['font-size'] ?? '');
	const border = /^(\d+(?:\.\d+)?)px\s+solid\s+(#[0-9a-f]{3,6})$/i.exec(map.border ?? '');
	const glow = /^0\s+0\s+(\d+(?:\.\d+)?)px/.exec(map['box-shadow'] ?? '');

	if (bg) {
		result.inputBg = bg;
	}
	if (color) {
		result.inputColor = color;
	}
	if (size !== undefined) {
		result.inputSize = size;
	}
	if (border) {
		result.inputBorderWidth = Number(border[1]);
		result.inputBorderColor = normalizeHex(border[2]) ?? result.inputBorderColor;
	}
	if (glow) {
		result.inputGlow = Number(glow[1]);
	}
	return result;
}

/**
 * Настройки глитча из правил автора .glitchy, .glitchy::before, .glitchy::after
 * (шаг 2.1). Правила автора остаются: блок оформления их перекрывает.
 */
export function glitchFromAuthor(css: string): Partial<SignalyAppearance> {
	const result: Partial<SignalyAppearance> = {};
	const rules = topLevelRules(css);
	const read = (selector: string) => {
		const rule = rules.find(r => !r.at && r.selector === selector);
		const map: Record<string, string> = {};

		if (rule) {
			declarations(css, rule).forEach(d => (map[d.property] = d.value));
		}
		return map;
	};
	const main = read('.glitchy');
	const before = read('.glitchy::before');
	const after = read('.glitchy::after');
	const shadow = (value: string | undefined) =>
		cssColor(/^-?\d+px\s+0\s+(\S+)$/.exec(value ?? '')?.[1]);
	const set = <K extends keyof SignalyAppearance>(key: K, value: SignalyAppearance[K] | undefined) => {
		if (value !== undefined) {
			result[key] = value;
		}
	};

	set('glitchColor', cssColor(main.color ?? after.color));
	set('glitchBg', cssColor(after.background ?? before.background));
	set('glitchShadow1', shadow(before['text-shadow']));
	set('glitchShadow2', shadow(after['text-shadow']));

	const shift = parsePx(after.left ?? '');

	if (shift !== undefined && shift < 0) {
		set('glitchShift', -shift);
	}

	const speed = /\s(\d*\.?\d+)s\s/.exec(` ${after.animation ?? ''} `);

	if (speed) {
		set('glitchSpeed', Number(speed[1]));
	}
	return result;
}

/** Есть ли в строке настроек блока оформления поле key (блок новее шага key). */
function blockHasKey(stylesheet: string, key: string) {
	const block = findBlock(stylesheet, appearanceMarkers);

	return !!block && block.inner.includes(`"${key}":`);
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

			if (key === 'screens') {
				result.screens = sanitizeViews(value);
			} else if (key === 'textStyles') {
				result.textStyles = sanitizeStyles(value);
			} else if (key === 'firstWays') {
				result.firstWays = sanitizeWays(value);
			} else if (Array.isArray(fallback)) {
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

// Код окна KR2 из шаблона автора: с шага 1.4 то же самое делает движок (и
// ссылки в зоне статусов при этом работают). Убирается, только если это
// узнаваемый код шаблона.
const authorKr2Block =
	/\/\* ===== KR2 INTERFACE ===== \*\/\s*\(function\s*\(\)\s*\{[\s\S]*?Macro\.add\('kr2image'[\s\S]*?\/\* ===== END KR2 INTERFACE ===== \*\/\n?/;

export const kr2MovedNote =
	'/* СИГНАЛЫ: код окна KR2 перенесён в движок терминала (шаг 1.4). */\n';

/** Есть ли в JavaScript истории старый код KR2 автора. */
export function hasAuthorKr2(script: string) {
	return authorKr2Block.test(script);
}

/**
 * JavaScript истории со свежим движком (старый блок «общие настройки» и код
 * KR2 шаблона убираются, код звуков шаблона становится наборами).
 */
export function withEngine(script: string) {
	return putBlock(
		// Шаг 2.2: код звуков шаблона → наборы (вид «Обычный»).
		moveTemplateSounds(script.replace(oldSettingsBlock, '').replace(authorKr2Block, kr2MovedNote)),
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
			// Блок старше шага 2.1 — глитч берём из стилей автора.
			appearance: blockHasKey(stylesheet, 'glitchShift')
				? existing
				: {...existing, ...glitchFromAuthor(stylesheet)},
			moved: [],
			script: withEngine(script),
			stylesheet
		};
	}

	const migration = migrateStylesheet(stylesheet);

	const appearance = {...migration.appearance, ...glitchFromAuthor(stylesheet)};

	return {
		appearance,
		moved: migration.moved,
		script: withEngine(script),
		stylesheet: withAppearance(migration.stylesheet, appearance)
	};
}

export {signalyEngineVersion};
