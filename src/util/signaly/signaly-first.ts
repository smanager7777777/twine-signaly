// «Twine СИГНАЛЫ»: первое посещение экрана (шаг 4.5, ответ 6А с дополнением
// автора). Способ появления — именованная заготовка: как при первом заходе на
// экран возникают его элементы (плавно, из белого шума, сквозь помехи, через
// глитч). Заготовки хранятся в строке настроек блока оформления, в таблице
// стилей — переменная --sg-first-<id>. На экране — обычный тег пассажа
// sg-first-<id>, поэтому способ ставится не всем экранам подряд, а только нужным.
// Эффект показывает движок (с версии 15), только при самом первом заходе.

import {normalizeHex} from './signaly-css';
import {slugify, uniqueName} from './signaly-kinds';

export const firstTagPrefix = 'sg-first-';

export const firstModes = ['fade', 'noise', 'wave', 'glitch'] as const;
export type FirstMode = typeof firstModes[number];

/** Своё поведение части экрана: '' — как у всего способа, now — сразу, без эффекта. */
export type FirstPartMode = '' | 'now' | FirstMode;

export const firstParts = ['text', 'links', 'media', 'fields'] as const;
export type FirstPart = typeof firstParts[number];

export interface FirstWay extends Record<FirstPart, FirstPartMode> {
	/** Название по-русски. */
	name: string;
	/** Часть тега латиницей: не меняется при переименовании. */
	id: string;
	mode: FirstMode;
	/** Сколько возникает один элемент, с. */
	time: number;
	/** Пауза между началом соседних элементов, с; 0 — все вместе. */
	step: number;
	/** Пауза перед первым элементом, с. */
	delay: number;
	/** Сила шума и помех, %. */
	power: number;
	/** Цвет шума и полос помех. */
	color: string;
	/** Щелчок показывает всё сразу. */
	skip: boolean;
	/** Звук эффекта (шаг 5.4, ответ 1А): файл, '' — без звука. */
	sound: string;
	/** Громкость звука, %. */
	volume: number;
}

export function firstTag(way: Pick<FirstWay, 'id'>) {
	return firstTagPrefix + way.id;
}

export function newFirstWay(ways: FirstWay[], base: string): FirstWay {
	const names = ways.map(w => w.name);
	let n = ways.length + 1;

	while (names.includes(`${base} ${n}`)) {
		n++;
	}

	const name = `${base} ${n}`;

	return {
		name,
		id: uniqueName(slugify(name), ways.map(w => w.id)),
		mode: 'noise',
		text: '',
		links: '',
		media: '',
		fields: '',
		time: 1,
		step: 0.25,
		delay: 0,
		power: 80,
		color: '#ffffff',
		skip: true,
		sound: '',
		volume: 100
	};
}

/** Способ, который стоит на экране. */
export function wayOfTags(tags: string[], ways: FirstWay[]) {
	return ways.find(w => tags.includes(firstTag(w)));
}

/** Теги экрана с другим способом (undefined — обычное появление). */
export function tagsWithWay(tags: string[], way: FirstWay | undefined) {
	const rest = tags.filter(tag => !tag.startsWith(firstTagPrefix));

	return way ? [...rest, firstTag(way)] : rest;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

// В имени файла бывают пробелы и скобки: в значении переменной они ломают CSS.
function encodeFile(file: string) {
	return encodeURIComponent(file).replace(/[!'()*~]/g, c => `%${c.charCodeAt(0).toString(16)}`);
}

/** Значение переменной --sg-first-<id>: его разбирает движок (fvParse). */
export function firstValue(w: FirstWay) {
	return [
		w.mode,
		round(w.time),
		round(w.step),
		round(w.delay),
		round(w.power),
		w.color,
		w.skip ? 1 : 0,
		...firstParts.map(part => w[part] || '-'),
		...(w.sound ? [round(w.volume), encodeFile(w.sound)] : [])
	].join(' ');
}

/** Правило блока оформления: способы и цвета «теней» для глитча. */
export function firstCss(ways: FirstWay[], shadow1: string, shadow2: string) {
	if (ways.length === 0) {
		return [];
	}
	return [
		'html {',
		`\t--sg-fvs-1: ${shadow1};`,
		`\t--sg-fvs-2: ${shadow2};`,
		...ways.map(w => `\t--${firstTag(w)}: ${firstValue(w)};`),
		'}'
	];
}

function number(value: unknown, fallback: number, min: number, max: number) {
	return typeof value === 'number' && isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function partMode(value: unknown): FirstPartMode {
	return value === 'now' || firstModes.includes(value as FirstMode) ? (value as FirstPartMode) : '';
}

/** Способы из строки настроек: неизвестное заменяется значениями по умолчанию. */
export function sanitizeWays(value: unknown): FirstWay[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const ways: FirstWay[] = [];

	value.forEach(item => {
		if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
			return;
		}

		const id = item.id.replace(/[^a-z0-9-]/g, '');

		if (id === '' || ways.some(w => w.id === id)) {
			return;
		}
		ways.push({
			name: typeof item.name === 'string' ? item.name : id,
			id,
			mode: firstModes.includes(item.mode) ? item.mode : 'noise',
			text: partMode(item.text),
			links: partMode(item.links),
			media: partMode(item.media),
			fields: partMode(item.fields),
			time: number(item.time, 1, 0.1, 30),
			step: number(item.step, 0.25, 0, 30),
			delay: number(item.delay, 0, 0, 60),
			power: number(item.power, 80, 0, 100),
			color: normalizeHex(typeof item.color === 'string' ? item.color : '') ?? '#ffffff',
			skip: item.skip !== false,
			sound: typeof item.sound === 'string' ? item.sound : '',
			volume: number(item.volume, 100, 0, 100)
		});
	});
	return ways;
}
