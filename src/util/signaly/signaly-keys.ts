// «Twine СИГНАЛЫ»: горячие клавиши мастера (шаг 3.3, ответы автора 1А–7А, 5Б, 6Б).
// Таблица «комбинация → действия» — обычный пассаж «Горячие клавиши» с тегом
// sg-keys (виден на карте, правится и в обычном Twine):
//   <<sg-key "Shift+Z+A" "Мастерское сообщение" [goto "Экран"] [ask]>>
//   действия — те же команды, что внутри ссылки (signaly-actions.ts)
//   <</sg-key>>
//   <<sg-key "Shift+Z+N" "Новая игра" builtin newgame>><</sg-key>>
// Движок (с версии 8) читает этот пассаж и выполняет действия при нажатии:
// удерживать Z и нажать Shift + букву или цифру.

import {Action, parseAction, splitBody, writeActions} from './signaly-actions';
import {arg, plain} from './signaly-link-form';
import {findClose, scanArgs} from './signaly-screen-blocks';

export const keysTag = 'sg-keys';
export const keysPassageName = 'Горячие клавиши';

/** Встроенные в движок действия: новая игра и «закрыть экран тревоги». */
export type Builtin = 'newgame' | 'alarm';
export const builtins: Builtin[] = ['newgame', 'alarm'];
export const builtinCombos: Record<Builtin, string> = {newgame: 'Shift+Z+N', alarm: 'Shift+Z+X'};

/** Подписи встроенных строк в тексте пассажа. */
export const builtinLabels: Record<Builtin, string> = {newgame: 'Новая игра', alarm: 'Закрыть экран тревоги'};

export const keysHeader =
	'/* СИГНАЛЫ: горячие клавиши мастера — правьте в окне «Горячие клавиши» (вкладка «История»).\n' +
	'   Удерживать Z и нажать Shift + букву или цифру. Этот экран игрокам не показывается. */';

export interface HotKey {
	/** Комбинация, например Shift+Z+A. */
	combo: string;
	/** Подпись по-русски. */
	label: string;
	/** Экран после действий; '' — остаться. */
	goto: string;
	/** Спросить «Да / Нет» перед выполнением (ответ 4А). */
	ask: boolean;
	builtin?: Builtin;
	actions: Action[];
	multiline: boolean;
	/** Слова, которых форма не понимает (сохраняются). */
	extra: string[];
	/** Как было написано: без правок записывается дословно. */
	raw?: string;
}

export interface FoundKey extends HotKey {
	from: number;
	to: number;
}

/** Комбинация в одном виде: Shift+Z+A. */
export function normalCombo(combo: string) {
	const parts = combo.replace(/\s+/g, '').split('+').filter(Boolean);
	const last = (parts.pop() ?? '').toUpperCase();

	return [...parts.map(p => (p.toLowerCase() === 'shift' ? 'Shift' : p.toUpperCase())), last].join('+');
}

/** Комбинация из нажатия клавиш: Z держат, Shift + буква или цифра; иначе undefined. */
export function comboFromKey(code: string, shift: boolean, zDown: boolean) {
	const m = /^(?:Key([A-Y])|Digit([0-9]))$/.exec(code);

	return m && shift && zDown ? `Shift+Z+${m[1] ?? m[2]}` : undefined;
}

export function validCombo(combo: string) {
	return /^Shift\+Z\+[A-Y0-9]$/.test(normalCombo(combo));
}

/** Все <<sg-key>> текста. */
export function findKeys(text: string): FoundKey[] {
	const result: FoundKey[] = [];
	const re = /<<sg-key(?=[\s>])/g;
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const head = scanArgs(text, m.index + m[0].length);
		const close = head && findClose(text, 'sg-key', head.end);

		if (!head || !close) {
			continue;
		}

		const tokens = head.tokens.slice();
		const combo = plain(tokens.shift());

		if (combo === undefined) {
			continue;
		}

		const key: FoundKey = {
			from: m.index,
			to: close.end,
			combo,
			label: '',
			goto: '',
			ask: false,
			actions: [],
			multiline: false,
			extra: [],
			raw: text.slice(m.index, close.end)
		};

		if (tokens.length && !['goto', 'ask', 'builtin'].includes(tokens[0])) {
			key.label = plain(tokens[0]) ?? tokens[0];
			tokens.shift();
		}
		while (tokens.length) {
			const word = tokens.shift()!;

			if (word === 'ask') {
				key.ask = true;
			} else if (word === 'goto' && tokens.length) {
				key.goto = plain(tokens.shift()) ?? '';
			} else if (word === 'builtin' && tokens.length && builtins.includes((plain(tokens[0]) ?? tokens[0]) as Builtin)) {
				const name = tokens.shift()!;

				key.builtin = (plain(name) ?? name) as Builtin;
			} else {
				key.extra.push(word);
			}
		}

		const body = text.slice(head.end, close.at);

		key.actions = splitBody(body).map(parseAction);
		key.multiline = body.includes('\n');
		result.push(key);
		re.lastIndex = close.end;
	}
	return result;
}

export function writeKey(key: HotKey) {
	if (key.raw !== undefined) {
		return key.raw;
	}

	const words = [arg(normalCombo(key.combo)), arg(key.label)];

	if (key.goto && !key.builtin) {
		words.push('goto', arg(key.goto));
	}
	if (key.ask && !key.builtin) {
		words.push('ask');
	}
	if (key.builtin) {
		words.push('builtin', key.builtin);
	}
	words.push(...key.extra);

	const body = key.builtin || key.actions.length === 0 ? '' : writeActions(key.actions, key.multiline);

	return `<<sg-key ${words.join(' ')}>>${body}<</sg-key>>`;
}

/** Таблица целиком: встроенные — всегда (если их нет в тексте — на своих клавишах). */
export function readKeys(text: string): HotKey[] {
	const found: HotKey[] = findKeys(text).map(key => {
		const copy: Partial<FoundKey> = {...key};

		delete copy.from;
		delete copy.to;
		return copy as HotKey;
	});

	builtins.forEach(name => {
		if (!found.some(k => k.builtin === name)) {
			found.unshift({
				combo: builtinCombos[name],
				label: '',
				goto: '',
				ask: false,
				builtin: name,
				actions: [],
				multiline: false,
				extra: []
			});
		}
	});
	// Встроенные — первыми, в постоянном порядке.
	return [
		...builtins.map(name => found.find(k => k.builtin === name)!),
		...found.filter(k => !k.builtin)
	];
}

/**
 * Новый текст пассажа: всё, кроме команд <<sg-key>>, остаётся как было (у
 * нового пассажа — пояснение), затем таблица по порядку.
 */
export function writeKeys(text: string, keys: HotKey[], labels: Record<Builtin, string> = builtinLabels) {
	let rest = text;

	findKeys(text)
		.reverse()
		.forEach(k => {
			rest = rest.slice(0, k.from) + rest.slice(k.to).replace(/^[ \t]*\\?[ \t]*\n?/, '');
		});
	rest = rest.replace(/\s+$/, '');
	if (rest.trim() === '') {
		rest = keysHeader;
	}
	return (
		rest +
		'\n' +
		keys
			.map(k =>
				writeKey(k.builtin && k.raw === undefined && k.label === '' ? {...k, label: labels[k.builtin]} : k)
			)
			.join('\n')
	);
}

/** Повторы комбинаций: комбинация → сколько раз. */
export function duplicateCombos(keys: Pick<HotKey, 'combo'>[]) {
	const counts = new Map<string, number>();

	keys.forEach(k => counts.set(normalCombo(k.combo), (counts.get(normalCombo(k.combo)) ?? 0) + 1));
	return [...counts].filter(([, n]) => n > 1).map(([combo]) => combo);
}

/* ----- Перенос кода шаблона (ответ 3А) ----- */

export const keysMovedNote =
	'/* СИГНАЛЫ: горячие клавиши мастера перенесены в пассаж «Горячие клавиши» (окно «Горячие клавиши», шаг 3.3). */';

const templateBlockRe =
	/\n*\/\* ===== Горячие клавиши мастера ===== \*\/\n\(function\s*\(\)\s*\{([^]*?)\n\}\)\(\);[ \t]*\n?/;

/** Есть ли в JavaScript истории код горячих клавиш шаблона. */
export function hasTemplateKeys(script: string) {
	return templateBlockRe.test(script);
}

/**
 * Код «Горячие клавиши мастера» шаблона (Shift+Z+A/B/C: окно, переход, звуки
 * new Audio) → строки таблицы. undefined — код не такой, как в шаблоне
 * (тогда он остаётся в JavaScript истории как есть).
 */
export function templateKeys(script: string): {script: string; keys: HotKey[]} | undefined {
	const block = templateBlockRe.exec(script);

	if (!block) {
		return undefined;
	}

	const body = block[1];

	if (!/event\.key\.toLowerCase\(\)\s*===\s*'z'/.test(body) || !/event\.shiftKey\s*&&\s*zPressed/.test(body)) {
		return undefined;
	}

	const files = new Map<string, string>();
	const numbers = new Map<string, number>();
	let m: RegExpExecArray | null;
	const audioRe = /var\s+(\w+)\s*=\s*new Audio\(\s*(["'])(.*?)\2\s*\)/g;
	const numberRe = /var\s+(\w+)\s*=\s*(\d+(?:\.\d+)?)\s*;/g;

	while ((m = audioRe.exec(body))) {
		files.set(m[1], m[3]);
	}
	while ((m = numberRe.exec(body))) {
		numbers.set(m[1], Number(m[2]));
	}

	const sw = /switch\s*\(\s*event\.key\.toLowerCase\(\)\s*\)\s*\{/.exec(body);

	if (!sw) {
		return undefined;
	}

	const after = body.slice(sw.index + sw[0].length);
	const switchEnd = /\}\s*\}\s*\}\s*\)\s*;/.exec(after);

	if (!switchEnd) {
		return undefined;
	}

	// Всё, кроме вариантов switch, — ровно как в шаблоне (переменные, загрузка
	// звуков, отслеживание Z); иначе код не трогаем.
	const skeleton = (body.slice(0, sw.index) + '{}});' + after.slice(switchEnd.index + switchEnd[0].length))
		.replace(/\/\/[^\n]*/g, '')
		.replace(/\/\*[^]*?\*\//g, '')
		.replace(/var\s+\w+\s*=\s*[^;]*;/g, '')
		.replace(/\w+\.preload\s*=\s*(["'])auto\1\s*;/g, '')
		.replace(/\s+/g, '');

	if (
		skeleton !==
		"document.addEventListener('keydown',function(event){if(event.key.toLowerCase()==='z'){zPressed=true;}" +
			"if(event.shiftKey&&zPressed){{}});document.addEventListener('keyup',function(event){" +
			"if(event.key.toLowerCase()==='z'){zPressed=false;}});"
	) {
		return undefined;
	}

	const cases = after.slice(0, switchEnd.index).split(/\bcase\s+'([a-z0-9])'\s*:/);
	const keys: HotKey[] = [];

	if (cases[0].trim() !== '') {
		return undefined;
	}

	// cases: [до первого case, буква, тело, буква, тело, …]
	for (let i = 1; i < cases.length; i += 2) {
		let rest = cases[i + 1]
			.replace(/\/\/[^\n]*/g, '')
			.replace(/\/\*[^]*?\*\//g, '');

		const actions: Action[] = [];
		const volume = new Map<string, number>();
		const restart = new Set<string>();
		let dialog: {title: string; passage: string; text: string} | undefined;
		let goto = '';
		let done = false;
		const statements: Array<[RegExp, (x: RegExpExecArray) => void]> = [
			[/^Dialog\.create\(\s*(["'])(.*?)\1\s*\)\s*;/, x => (dialog = {title: x[2], passage: '', text: ''})],
			[
				/^Dialog\.wikiPassage\(\s*(["'])(.*?)\1\s*\)\s*;/,
				x => {
					if (!dialog) {
						throw new Error();
					}
					dialog.passage = x[2];
				}
			],
			[
				/^Dialog\.wiki\(\s*(["'])(.*?)\1\s*\)\s*;/,
				x => {
					if (!dialog) {
						throw new Error();
					}
					dialog.text = x[2];
				}
			],
			[
				/^Dialog\.open\(\s*\)\s*;/,
				() => {
					if (!dialog) {
						throw new Error();
					}
					actions.push({type: 'dialog', ...dialog, close: ''});
					dialog = undefined;
				}
			],
			[/^Engine\.play\(\s*(["'])(.*?)\1\s*\)\s*;/, x => (goto = x[2])],
			[
				/^(\w+)\.volume\s*=\s*(\w+|\d+(?:\.\d+)?)\s*;/,
				x => {
					const v = numbers.get(x[2]) ?? Number(x[2]);

					if (isNaN(v)) {
						throw new Error();
					}
					volume.set(x[1], v);
				}
			],
			[/^(\w+)\.currentTime\s*=\s*0\s*;/, x => restart.add(x[1])],
			[
				/^(\w+)\.play\(\)(?:\s*\.catch\(\s*function\s*\(\s*\w*\s*\)\s*\{[^{}]*\}\s*\))?\s*;/,
				x => {
					const src = files.get(x[1]);

					if (!src) {
						throw new Error();
					}
					actions.push({
						type: 'signal',
						src,
						volume: Math.round((volume.get(x[1]) ?? 1) * 100),
						keep: !restart.has(x[1])
					});
				}
			],
			[/^break\s*;/, () => (done = true)]
		];

		rest = rest.trim();
		try {
			while (rest !== '' && !done) {
				const hit = statements.map(([re, fn]) => ({x: re.exec(rest), fn})).find(s => s.x);

				if (!hit) {
					return undefined;
				}
				hit.fn(hit.x!);
				rest = rest.slice(hit.x![0].length).trim();
			}
		} catch {
			return undefined;
		}
		if (rest !== '' || dialog) {
			return undefined;
		}

		const firstDialog = actions.find(a => a.type === 'dialog');
		const firstSignal = actions.find(a => a.type === 'signal');
		const label =
			firstDialog?.type === 'dialog' && firstDialog.title
				? firstDialog.title
				: goto
				? `Переход на ${goto}`
				: firstSignal?.type === 'signal'
				? `Звук ${firstSignal.src.replace(/^.*\//, '').replace(/\.[^.]+$/, '')}`
				: '';

		keys.push({
			combo: `Shift+Z+${cases[i].toUpperCase()}`,
			label,
			goto,
			ask: false,
			actions,
			multiline: true,
			extra: []
		});
	}
	if (!keys.length) {
		return undefined;
	}
	return {script: script.replace(templateBlockRe, () => '\n\n\n' + keysMovedNote + '\n'), keys};
}

/** Место для нового пассажа на карте: правее всех остальных. */
export function freeSpot(passages: Array<{left: number; top: number; width: number}>) {
	const right = passages.reduce((max, p) => Math.max(max, p.left + p.width), 0);

	return {left: Math.ceil((right + 50) / 25) * 25, top: 0};
}

/**
 * Перенос кода шаблона в новый пассаж «Горячие клавиши» (если такого пассажа
 * ещё нет): новый код истории и текст пассажа; undefined — переносить нечего.
 */
export function moveTemplateKeys(script: string, passages: Array<{name: string; tags: string[]}>) {
	if (passages.some(p => p.tags.includes(keysTag) || p.name === keysPassageName)) {
		return undefined;
	}

	const moved = templateKeys(script);

	return moved && {script: moved.script, text: writeKeys('', [...readKeys(''), ...moved.keys])};
}
