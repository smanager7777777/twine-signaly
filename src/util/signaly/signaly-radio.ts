// «Twine СИГНАЛЫ»: виды радио (этап 7, шаг 7.2, ответ 1).
//
// Виды хранятся в пассаже «Радио» с тегом sg-radio (обычный текст, работает в обычном Twine):
//   <<sg-radio-view "Сломанное" type broken frame "#c9a24a" elements "#39ff7a" label "ОРБИТА-3"
//     sparks 30 [sparksound "media/audio/искра.wav" sparkvolume 80]>>
// На экране — блок <<sg-radio "Сломанное" [size 900]>> (signaly-screen-blocks.ts): радио рисует движок.
// Каркас у вида один (решение 125): сломанное — С2, отремонтированное — Р2, с реверсом — В2;
// в шаге 7.2 есть только сломанное, в шаге 7.3 — отремонтированное с эфиром:
//   <<sg-radio-view "Эфир" type fixed … [noise "шум.wav" noisevolume 60 noiseranges "88-95, 101-108"]
//     [jam "a.wav|1|80; b.wav|0.8|100" jamsmin 4 jamsmax 5] [incoming "ВХОДЯЩАЯ ПЕРЕДАЧА"] [catch 10]>>
// noise — белый шум и где он звучит; jam — помехи (файл | сколько МГц в каждую сторону слышно | громкость, %),
// из них при каждом входе на экран выпадает от jamsmin до jamsmax штук в случайных местах шкалы (ответ 6);
// incoming — сообщение строки, пока в эфире есть непойманная передача (ответ 5А); catch — сколько секунд
// держать точную настройку, чтобы поймать передачу (ответ 4А). Передачи — раздел «Эфир» окна «Музыка».

import {arg} from './signaly-link-form';
import {commentRanges} from './signaly-music';
import {findBlocks, replaceBlock, scanArgs} from './signaly-screen-blocks';

export const radioTag = 'sg-radio';
export const radioPassageName = 'Радио';

export type RadioType = 'broken' | 'fixed' | 'reverse';
export const radioTypes: RadioType[] = ['broken', 'fixed', 'reverse'];
/** Типы, которые уже рисует движок. */
export const radioReady: RadioType[] = ['broken', 'fixed'];

/** Шкала эфира: 88,0–108,0 МГц, шаг 0,1. */
export const airMin = 88;
export const airMax = 108;

export interface RadioJam {
	src: string;
	/** Сколько МГц в каждую сторону от точки слышно. */
	width: number;
	/** Громкость, %. */
	volume: number;
}
export const radioFrames: Record<RadioType, string> = {broken: 'С2', fixed: 'Р2', reverse: 'В2'};

export interface RadioView {
	name: string;
	type: RadioType;
	/** Цвет каркаса. */
	frame: string;
	/** Цвет кнопок, окон, строки, каталога. */
	elements: string;
	/** Надпись на каркасе ('' — без надписи). */
	label: string;
	/** Искры сломанного радио: 0 — нет, 100 — часто. */
	sparks: number;
	sparkSound: string;
	sparkVolume: number;
	/** Эфир (отремонтированное радио): белый шум, его громкость и диапазоны «88-95, 101-108». */
	noise: string;
	noiseVolume: number;
	noiseRanges: string;
	/** Помехи и сколько их выпадает за раз. */
	jams: RadioJam[];
	jamsMin: number;
	jamsMax: number;
	/** Сообщение строки, пока в эфире есть непойманная передача. */
	incoming: string;
	/** Сколько секунд держать точную настройку, чтобы поймать передачу. */
	catchTime: number;
	/** Непонятые слова — сохраняются. */
	extra: string[];
}

export const radioDefaults: Omit<RadioView, 'name'> = {
	type: 'broken',
	frame: '#c9a24a',
	elements: '#39ff7a',
	label: 'ОРБИТА-3',
	sparks: 30,
	sparkSound: '',
	sparkVolume: 80,
	noise: '',
	noiseVolume: 60,
	noiseRanges: '88-108',
	jams: [],
	jamsMin: 4,
	jamsMax: 5,
	incoming: 'ВХОДЯЩАЯ ПЕРЕДАЧА',
	catchTime: 10,
	extra: []
};

export const jamDefaults: Omit<RadioJam, 'src'> = {width: 1, volume: 80};

/** «a.wav|1|80; b.wav|0.8|100» → помехи. */
export function readJams(value: string): RadioJam[] {
	return value
		.split(';')
		.map(part => part.split('|').map(x => x.trim()))
		.filter(([src]) => src)
		.map(([src, width, volume]) => ({
			src,
			width: Math.max(0.1, Math.min(20, num(width, jamDefaults.width))),
			volume: Math.max(0, Math.min(100, Math.round(num(volume, jamDefaults.volume))))
		}));
}

export const writeJams = (jams: RadioJam[]) => jams.map(j => `${j.src}|${j.width}|${j.volume}`).join('; ');

/** «88-95, 101-108» → [[88, 95], [101, 108]] (дробная часть — через точку); непонятное пропускается. */
export function readRanges(value: string): Array<[number, number]> {
	return [...value.matchAll(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/g)]
		.map(m => [Number(m[1]), Number(m[2])] as [number, number])
		.filter(([a, b]) => b > a);
}

export const radioHeader =
	'/* СИГНАЛЫ: виды радио — правьте в окне «Радио» (вкладка «История»). На экран радио\n' +
	'   ставится блоком: «Добавить блок» → «Радио». */\n';

interface Found {
	from: number;
	to: number;
	tokens: string[];
}

function unquote(token: string) {
	if (/^(["']).*\1$/s.test(token)) {
		try {
			return token.startsWith('"') ? JSON.parse(token) : token.slice(1, -1);
		} catch {
			return token.slice(1, -1);
		}
	}
	return token;
}

function find(text: string): Found[] {
	const re = /<<sg-radio-view(?=[\s>])/g;
	const out: Found[] = [];
	const comments = commentRanges(text);
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const at = m.index;

		if (comments.some(c => at >= c.from && at < c.to)) {
			continue;
		}

		const scan = scanArgs(text, m.index + '<<sg-radio-view'.length);

		if (scan) {
			out.push({from: m.index, to: scan.end, tokens: scan.tokens});
			re.lastIndex = scan.end;
		}
	}
	return out;
}

const num = (value: string | undefined, fallback: number) => {
	const n = Number(String(value ?? '').replace(',', '.'));

	return value !== undefined && value !== '' && isFinite(n) ? n : fallback;
};

const keys = [
	'type',
	'frame',
	'elements',
	'label',
	'sparks',
	'sparksound',
	'sparkvolume',
	'noise',
	'noisevolume',
	'noiseranges',
	'jam',
	'jamsmin',
	'jamsmax',
	'incoming',
	'catch'
];

function readView(tokens: string[]): RadioView {
	const view: RadioView = {...radioDefaults, name: unquote(tokens[0] ?? ''), jams: [], extra: []};
	const pct = (value: string, fallback: number) => Math.max(0, Math.min(100, Math.round(num(value, fallback))));

	for (let i = 1; i < tokens.length; i++) {
		const key = tokens[i];

		if (!keys.includes(key) || i + 1 >= tokens.length) {
			view.extra.push(key);
			continue;
		}

		const value = unquote(tokens[++i]);

		switch (key) {
			case 'type':
				view.type = radioTypes.includes(value as RadioType) ? (value as RadioType) : 'broken';
				break;
			case 'frame':
				view.frame = value;
				break;
			case 'elements':
				view.elements = value;
				break;
			case 'label':
				view.label = value;
				break;
			case 'sparks':
				view.sparks = Math.max(0, Math.min(100, Math.round(num(value, radioDefaults.sparks))));
				break;
			case 'sparksound':
				view.sparkSound = value;
				break;
			case 'sparkvolume':
				view.sparkVolume = Math.max(0, Math.min(100, Math.round(num(value, radioDefaults.sparkVolume))));
				break;
			case 'noise':
				view.noise = value;
				break;
			case 'noisevolume':
				view.noiseVolume = pct(value, radioDefaults.noiseVolume);
				break;
			case 'noiseranges':
				view.noiseRanges = value;
				break;
			case 'jam':
				view.jams = readJams(value);
				break;
			case 'jamsmin':
				view.jamsMin = Math.max(0, Math.min(50, Math.round(num(value, radioDefaults.jamsMin))));
				break;
			case 'jamsmax':
				view.jamsMax = Math.max(0, Math.min(50, Math.round(num(value, radioDefaults.jamsMax))));
				break;
			case 'incoming':
				view.incoming = value;
				break;
			case 'catch':
				view.catchTime = Math.max(1, Math.min(120, num(value, radioDefaults.catchTime)));
				break;
		}
	}
	return view;
}

/** Виды радио из текста пассажа «Радио». */
export function readRadios(text: string): RadioView[] {
	return find(text).map(f => readView(f.tokens));
}

export function writeView(v: RadioView) {
	const w = [arg(v.name), 'type', v.type, 'frame', arg(v.frame), 'elements', arg(v.elements), 'label', arg(v.label)];

	if (v.type === 'broken') {
		w.push('sparks', String(v.sparks));
		if (v.sparkSound) {
			w.push('sparksound', arg(v.sparkSound), 'sparkvolume', String(v.sparkVolume));
		}
	}
	if (v.type === 'fixed' || v.type === 'reverse') {
		if (v.noise) {
			w.push('noise', arg(v.noise), 'noisevolume', String(v.noiseVolume), 'noiseranges', arg(v.noiseRanges));
		}
		if (v.jams.length) {
			w.push('jam', arg(writeJams(v.jams)));
		}
		w.push('jamsmin', String(v.jamsMin), 'jamsmax', String(v.jamsMax), 'incoming', arg(v.incoming), 'catch', String(v.catchTime));
	}
	return `<<sg-radio-view ${[...w, ...v.extra].join(' ')}>>`;
}

/** Записать виды: всё, кроме строк <<sg-radio-view>>, остаётся. */
export function writeRadios(text: string, views: RadioView[]) {
	let rest = text;

	for (const f of find(text).reverse()) {
		let to = f.to;

		while (rest[to] === '\n') {
			to++;
		}
		rest = rest.slice(0, f.from) + rest.slice(to);
	}
	if (rest.trim() === '') {
		rest = radioHeader;
	}
	return rest.replace(/\s*$/, '\n') + views.map(writeView).join('\n') + '\n';
}

export function newRadioView(names: string[], base = 'Радио'): RadioView {
	let n = 1;
	let name = base;

	while (names.includes(name)) {
		name = `${base} ${++n}`;
	}
	return {...radioDefaults, name, jams: [], extra: []};
}

export function radioProblems(views: RadioView[]) {
	const names = views.map(v => v.name.trim());

	return {
		emptyName: names.some(n => n === ''),
		repeatedName: new Set(names).size !== names.length,
		// Эфир: «от» больше «до» или диапазоны шума не разобрать.
		jamsOrder: views.some(v => v.type !== 'broken' && v.jamsMin > v.jamsMax),
		noiseRanges: views.some(v => v.type !== 'broken' && v.noise !== '' && readRanges(v.noiseRanges).length === 0)
	};
}

/** Переименовать вид в блоках «Радио» экрана: <<sg-radio "Старое">> → <<sg-radio "Новое">>. */
export function renameRadioView(text: string, from: string, to: string) {
	let out = text;

	for (const block of findBlocks(text).reverse()) {
		if (block.type === 'radio' && block.values.view === from) {
			out = replaceBlock(out, block, {...block, values: {...block.values, view: to}}).text;
		}
	}
	return out;
}
