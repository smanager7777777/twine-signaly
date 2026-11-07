// «Twine СИГНАЛЫ»: виды радио (этап 7, шаг 7.2, ответ 1).
//
// Виды хранятся в пассаже «Радио» с тегом sg-radio (обычный текст, работает в обычном Twine):
//   <<sg-radio-view "Сломанное" type broken frame "#c9a24a" elements "#39ff7a" label "ОРБИТА-3"
//     sparks 30 [sparksound "media/audio/искра.wav" sparkvolume 80]>>
// На экране — блок <<sg-radio "Сломанное" [size 900]>> (signaly-screen-blocks.ts): радио рисует движок.
// Каркас у вида один (решение 125): сломанное — С2, отремонтированное — Р2, с реверсом — В2;
// в шаге 7.2 есть только сломанное.

import {arg} from './signaly-link-form';
import {commentRanges} from './signaly-music';
import {findBlocks, replaceBlock, scanArgs} from './signaly-screen-blocks';

export const radioTag = 'sg-radio';
export const radioPassageName = 'Радио';

export type RadioType = 'broken' | 'fixed' | 'reverse';
export const radioTypes: RadioType[] = ['broken', 'fixed', 'reverse'];
/** Типы, которые уже рисует движок. */
export const radioReady: RadioType[] = ['broken'];
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
	extra: []
};

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

const keys = ['type', 'frame', 'elements', 'label', 'sparks', 'sparksound', 'sparkvolume'];

function readView(tokens: string[]): RadioView {
	const view: RadioView = {...radioDefaults, name: unquote(tokens[0] ?? ''), extra: []};

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
	return {...radioDefaults, name, extra: []};
}

export function radioProblems(views: RadioView[]) {
	const names = views.map(v => v.name.trim());

	return {
		emptyName: names.some(n => n === ''),
		repeatedName: new Set(names).size !== names.length
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
