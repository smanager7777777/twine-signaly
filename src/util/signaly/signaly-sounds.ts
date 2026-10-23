// «Twine СИГНАЛЫ»: звуки (шаг 2.2, ответы автора 1А–7А).
//
// 1. Наборы звуков наведения и нажатия — блок «СИГНАЛЫ: звуки наведения и
//    нажатия» в «JavaScript истории»: setup.signalySounds = {sets, kinds}.
//    sets — наборы (файлы, громкость 0–100 %, задержка 0–500 мс), kinds — какой
//    набор у вида ('' — «Обычный»; у вида без своего — как у «Обычного»).
//    Движок играет случайный файл набора при наведении и нажатии на любую ссылку
//    или кнопку. Свой звук у кнопки на экране — <<sg-place … hover "Набор"
//    click none>>.
// 2. Звуковые файлы с короткими именами, группы и плейлисты — обычные команды
//    SugarCube в пассаже StoryInit (<<cacheaudio>>, <<createaudiogroup>>,
//    <<createplaylist>>). Окно «Звуки» читает их и пишет одним разделом между
//    метками — история по-прежнему работает в обычном Twine.

import {BlockMarkers, findBlock, putBlock} from './signaly-blocks';

export interface SoundSet {
	name: string;
	/** Пути от папки игры: «media/audio/hover1.wav». */
	files: string[];
	/** Громкость, % (0–100). */
	volume: number;
	/** Задержка перед звуком, мс (0–500). */
	delay: number;
}

/** Набор у вида: имя набора, '' — без звука, нет поля — как у «Обычного». */
export interface KindSounds {
	hover?: string;
	click?: string;
}

export interface SignalySounds {
	sets: SoundSet[];
	/** Класс вида → наборы ('' — вид «Обычный»). */
	kinds: Record<string, KindSounds>;
}

export const soundsMarkers: BlockMarkers = {
	start: '/* ===== СИГНАЛЫ: звуки наведения и нажатия — не редактировать вручную ===== */',
	end: '/* ===== СИГНАЛЫ: конец звуков наведения и нажатия ===== */'
};

export const emptySounds: SignalySounds = {sets: [], kinds: {}};

function clamp(value: unknown, min: number, max: number, fallback: number) {
	const n = Number(value);

	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalize(raw: any): SignalySounds {
	const sets: SoundSet[] = Array.isArray(raw?.sets)
		? raw.sets
				.filter((s: any) => s && typeof s.name === 'string')
				.map((s: any) => ({
					name: s.name,
					files: Array.isArray(s.files) ? s.files.filter((f: unknown) => typeof f === 'string') : [],
					volume: clamp(s.volume, 0, 100, 100),
					delay: clamp(s.delay, 0, 500, 0)
				}))
		: [];
	const kinds: Record<string, KindSounds> = {};

	if (raw?.kinds && typeof raw.kinds === 'object') {
		Object.keys(raw.kinds).forEach(cls => {
			const k = raw.kinds[cls] ?? {};
			const entry: KindSounds = {};

			if (typeof k.hover === 'string') {
				entry.hover = k.hover;
			}
			if (typeof k.click === 'string') {
				entry.click = k.click;
			}
			kinds[cls] = entry;
		});
	}
	return {sets, kinds};
}

/** Наборы из «JavaScript истории»; undefined — блока нет. */
export function readSounds(script: string): SignalySounds | undefined {
	const block = findBlock(script, soundsMarkers);

	if (!block) {
		return undefined;
	}

	const match = /setup\.signalySounds\s*=\s*([\s\S]*?);\s*$/.exec(block.inner);

	if (!match) {
		return undefined;
	}
	try {
		return normalize(JSON.parse(match[1]));
	} catch {
		return undefined;
	}
}

/** Лишнее убираем: пустые записи видов. */
function compact(sounds: SignalySounds): SignalySounds {
	const kinds: Record<string, KindSounds> = {};

	Object.keys(sounds.kinds).forEach(cls => {
		const k = sounds.kinds[cls];

		if (k.hover !== undefined || k.click !== undefined) {
			kinds[cls] = k;
		}
	});
	return {sets: sounds.sets, kinds};
}

export function soundsBlock(sounds: SignalySounds) {
	return [
		soundsMarkers.start,
		'/* Наборы звуков — в окне «Звуки», звуки видов — в окне «Виды кнопок и ссылок». */',
		`setup.signalySounds = ${JSON.stringify(compact(sounds), null, '\t')};`,
		soundsMarkers.end
	].join('\n');
}

export function withSounds(script: string, sounds: SignalySounds) {
	return putBlock(script, soundsMarkers, soundsBlock(sounds));
}

/* ----- Звуки шаблона автора (ответ 4А) ----- */

// Код «Звуки наведения и нажатия на ссылки и кнопки» шаблона: с шага 2.2 то
// же самое делает движок по наборам. Переносится, только если код узнаваемый.
const templateSoundsRe =
	/\/\* ===== Звуки наведения и нажатия на ссылки и кнопки ===== \*\/\s*\(function\s*\(\)\s*\{[\s\S]*?\$\(document\)\.on\('click',\s*'a, button'[\s\S]*?\}\);\s*\}\)\(\);\n?/;

export const soundsMovedNote =
	'/* СИГНАЛЫ: звуки наведения и нажатия перенесены в наборы (окно «Звуки», вид «Обычный», шаг 2.2). */\n';

export const hoverSetName = 'Наведение';
export const clickSetName = 'Нажатие';

function quotedList(text: string) {
	return [...text.matchAll(/"([^"]*)"|'([^']*)'/g)].map(m => m[1] ?? m[2]);
}

/** Узнаёт код шаблона и делает из него два набора. */
export function templateSounds(script: string) {
	const match = templateSoundsRe.exec(script);

	if (!match) {
		return undefined;
	}

	const code = match[0];
	const volume = /var\s+volume\s*=\s*([\d.]+)/.exec(code);
	const prefix = /new Audio\(\s*"([^"]*)"\s*\+\s*file\s*\)/.exec(code);
	const hover = /hoverSounds\s*=\s*preload\(\[([\s\S]*?)\]\)/.exec(code);
	const click = /clickSounds\s*=\s*preload\(\[([\s\S]*?)\]\)/.exec(code);

	if (!volume || !prefix || !hover || !click) {
		return undefined;
	}

	const percent = Math.round(Number(volume[1]) * 1000) / 10;
	const set = (name: string, list: string): SoundSet => ({
		name,
		files: quotedList(list).map(file => prefix[1] + file),
		volume: percent,
		delay: 0
	});

	return {
		from: match.index,
		to: match.index + code.length,
		sounds: {
			sets: [set(hoverSetName, hover[1]), set(clickSetName, click[1])],
			kinds: {'': {hover: hoverSetName, click: clickSetName}}
		} as SignalySounds
	};
}

/**
 * Код звуков шаблона → наборы (только если блока звуков ещё нет — иначе
 * звучало бы дважды). Вызывается там же, где ставится движок.
 */
export function moveTemplateSounds(script: string) {
	if (findBlock(script, soundsMarkers)) {
		return script;
	}

	const found = templateSounds(script);

	if (!found) {
		return script;
	}
	return withSounds(
		script.slice(0, found.from) + soundsMovedNote + script.slice(found.to),
		found.sounds
	);
}

/* ----- Наборы: переименование и где используются ----- */

export function renameSet(sounds: SignalySounds, from: string, to: string): SignalySounds {
	const kinds: Record<string, KindSounds> = {};

	Object.keys(sounds.kinds).forEach(cls => {
		const k = sounds.kinds[cls];

		kinds[cls] = {
			...(k.hover !== undefined ? {hover: k.hover === from ? to : k.hover} : {}),
			...(k.click !== undefined ? {click: k.click === from ? to : k.click} : {})
		};
	});
	return {
		sets: sounds.sets.map(s => (s.name === from ? {...s, name: to} : s)),
		kinds
	};
}

/** Убирает набор; виды, где он стоял, звучат как «Обычный». */
export function removeSet(sounds: SignalySounds, name: string): SignalySounds {
	const kinds: Record<string, KindSounds> = {};

	Object.keys(sounds.kinds).forEach(cls => {
		const k = sounds.kinds[cls];
		const keep = (value?: string) => value !== undefined && value !== name;

		kinds[cls] = {
			...(keep(k.hover) ? {hover: k.hover} : {}),
			...(keep(k.click) ? {click: k.click} : {})
		};
	});
	return {sets: sounds.sets.filter(s => s.name !== name), kinds};
}

/** Переименование набора в кнопках на экране: <<sg-place … hover "Старое">>. */
export function renameSetInText(text: string, from: string, to: string) {
	const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

	return text.replace(/<<sg-place\b[^>]*>>/g, head =>
		head.replace(
			/(\b(?:hover|click)\s+)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
			(all, key: string, value: string) =>
				value.slice(1, -1).replace(/\\(.)/g, '$1') === from ? key + quoted(to) : all
		)
	);
}

/** Свободное имя («Набор 2», «Набор 3»…). */
export function freeName(base: string, taken: string[]) {
	if (!taken.includes(base)) {
		return base;
	}

	let n = 2;

	while (taken.includes(`${base} ${n}`)) {
		n++;
	}
	return `${base} ${n}`;
}

/* ----- Звуковые файлы, группы и плейлисты в StoryInit (ответ 6А) ----- */

export interface AudioTrack {
	/** Короткое имя (<<cacheaudio "имя" …>>). */
	id: string;
	/** Файлы (обычно один). */
	sources: string[];
}

export interface AudioGroup {
	/** Имя группы — с двоеточием («:AMBIENT»). */
	id: string;
	tracks: string[];
}

export interface ListTrack {
	id: string;
	/** Громкость 0–1; нет — как у файла. */
	volume?: number;
	own?: boolean;
}

export interface AudioList {
	id: string;
	tracks: ListTrack[];
}

export interface AudioInit {
	tracks: AudioTrack[];
	groups: AudioGroup[];
	lists: AudioList[];
}

export const audioInitMarkers: BlockMarkers = {
	start: '/* ===== СИГНАЛЫ: звуки — правьте в окне «Звуки» ===== */',
	end: '/* ===== СИГНАЛЫ: конец звуков ===== */'
};

function args(text: string) {
	return [...text.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g)].map(m =>
		m[3] !== undefined ? m[3] : (m[1] ?? m[2]).replace(/\\(.)/g, '$1')
	);
}

interface Found {
	init: AudioInit;
	/** Где в тексте стоят команды (их заменяет раздел окна). */
	ranges: Array<{from: number; to: number}>;
}

const audioCommandRe =
	/<<cacheaudio\s+([^>]*?)>>|<<createaudiogroup\s+([^>]*?)>>([\s\S]*?)<<\/createaudiogroup>>|<<createplaylist\s+([^>]*?)>>([\s\S]*?)<<\/createplaylist>>/g;

function trackLines(body: string) {
	return [...body.matchAll(/<<track\s+([^>]*?)>>/g)].map(m => args(m[1]));
}

/** Звуковые команды StoryInit (вне раздела окна — тоже). */
export function findAudioInit(text: string): Found {
	const init: AudioInit = {tracks: [], groups: [], lists: []};
	const ranges: Array<{from: number; to: number}> = [];

	for (const m of text.matchAll(audioCommandRe)) {
		ranges.push({from: m.index!, to: m.index! + m[0].length});
		if (m[1] !== undefined) {
			const [id, ...sources] = args(m[1]);

			init.tracks.push({id, sources});
		} else if (m[2] !== undefined) {
			init.groups.push({id: args(m[2])[0], tracks: trackLines(m[3]).map(a => a[0])});
		} else {
			init.lists.push({
				id: args(m[4])[0],
				tracks: trackLines(m[5]).map(a => {
					const track: ListTrack = {id: a[0]};
					const v = a.indexOf('volume');

					if (v !== -1 && a[v + 1] !== undefined && !isNaN(Number(a[v + 1]))) {
						track.volume = Number(a[v + 1]);
					}
					if (a.includes('own')) {
						track.own = true;
					}
					return track;
				})
			});
		}
	}
	return {init, ranges};
}

function q(value: string) {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function num(value: number) {
	return String(Math.round(value * 10000) / 10000);
}

/** Раздел окна «Звуки» для StoryInit. */
export function audioInitBlock(init: AudioInit) {
	const lines = [audioInitMarkers.start];

	init.tracks.forEach(t => lines.push(`<<cacheaudio ${[t.id, ...t.sources].map(q).join(' ')}>>`));
	init.groups.forEach(g => {
		lines.push('', `<<createaudiogroup ${q(g.id)}>>`);
		g.tracks.forEach(id => lines.push(`<<track ${q(id)}>>`));
		lines.push('<</createaudiogroup>>');
	});
	init.lists.forEach(l => {
		lines.push('', `<<createplaylist ${q(l.id)}>>`);
		l.tracks.forEach(t =>
			lines.push(
				`<<track ${q(t.id)}${t.volume !== undefined ? ` volume ${num(t.volume)}` : ''}${t.own ? ' own' : ''}>>`
			)
		);
		lines.push('<</createplaylist>>');
	});
	lines.push(audioInitMarkers.end);
	return lines.join('\n');
}

/**
 * Текст StoryInit с новым разделом: прежние звуковые команды убираются, раздел
 * встаёт на место первой из них (или в начало).
 */
export function withAudioInit(text: string, init: AudioInit) {
	const block = findBlock(text, audioInitMarkers);
	let rest = text;
	let at: number;

	if (block) {
		rest = text.slice(0, block.from) + text.slice(block.to);
		at = block.from;
	} else {
		at = -1;
	}

	const {ranges} = findAudioInit(rest);

	if (at === -1) {
		at = ranges.length ? ranges[0].from : 0;
	}

	// Убираем команды с конца, чтобы позиции не съезжали; вместе с ними — их
	// перевод строки и пустые строки между ними.
	let result = rest;

	[...ranges].reverse().forEach(r => {
		let to = r.to;

		while (result[to] === ' ' || result[to] === '\t') {
			to++;
		}
		if (result[to] === '\n') {
			to++;
		}

		let from = r.from;

		while (from > 0 && (result[from - 1] === ' ' || result[from - 1] === '\t')) {
			from--;
		}
		result = result.slice(0, from) + result.slice(to);
		if (from < at) {
			at -= Math.min(to, at) - from;
		}
	});

	// Пустые строки, оставшиеся на месте раздела, схлопываем.
	const before = result.slice(0, at).replace(/\n{2,}$/, '\n');
	const after = result.slice(at).replace(/^\n+/, '');
	const isEmpty = init.tracks.length + init.groups.length + init.lists.length === 0;

	if (isEmpty) {
		return before + (before && after ? '\n' : '') + after;
	}
	return `${before}${audioInitBlock(init)}\n${after ? '\n' + after : ''}`;
}
