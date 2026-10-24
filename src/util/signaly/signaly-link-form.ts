// «Twine СИГНАЛЫ»: ссылка ↔ кнопка того же вида (замечание автора к build-10,
// решение 66). Вид (класс обёртки <span class="red-big">) остаётся, меняется
// только то, чем сделан элемент:
//   <<link "Текст" …>>…<</link>>    ↔  <<button "Текст" …>>…<</button>>
//   [[Текст|Экран]], [[Экран]], [[Текст|Экран][$x to 1]]
//                                    →  <<button "Текст" "Экран">><<set $x to 1>><</button>>
//   <<sg-dialog "Надпись" …>>        ↔  <<sg-dialog "Надпись" … button>>
// Кнопка без своего кода с экраном назначения обратно становится разметкой
// [[Текст|Экран]] — у неё на карте Twine снова рисуется стрелка.
// Всё — обычная разметка SugarCube 2.37.

import {Edit} from './signaly-format';
import {
	findBlocks,
	findClose,
	scanArgs,
	writeBlockHead
} from './signaly-screen-blocks';

export type LinkForm = 'link' | 'button';

interface Item {
	/** Где элемент в тексте (весь, с закрывающей командой). */
	from: number;
	to: number;
	form: LinkForm;
	/** Текст элемента в другом виде. */
	other: () => string;
}

const macroRe = /<<(link|button)(?=[\s>])/g;

/** Строка в кавычках для аргумента SugarCube. */
export function arg(value: string) {
	if (/^[$_][\w.]*$/.test(value)) {
		return value;
	}
	if (!value.includes('"')) {
		return `"${value}"`;
	}
	if (!value.includes("'")) {
		return `'${value}'`;
	}
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Значение аргумента без кавычек или undefined, если это не простая строка. */
export function plain(token: string | undefined) {
	if (!token) {
		return undefined;
	}

	const q = token[0];

	if ((q === '"' || q === "'") && token[token.length - 1] === q) {
		return token.slice(1, -1).replace(/\\(.)/g, '$1');
	}
	return undefined;
}

/** Части разметки [[…]]: текст, экран, код. */
export function parseMarkup(text: string, at: number) {
	let i = at + 2;
	const linkStart = i;

	while (i < text.length && text[i] !== ']') {
		if (text[i] === '\n') {
			return undefined;
		}
		i++;
	}

	const link = text.slice(linkStart, i);
	const setters: string[] = [];

	i++;
	while (text[i] === '[') {
		const close = text.indexOf(']', i);

		if (close === -1) {
			return undefined;
		}
		setters.push(text.slice(i + 1, close));
		i = close + 1;
	}
	if (text[i] !== ']') {
		return undefined;
	}

	let label = link;
	let passage = link;
	const pipe = link.lastIndexOf('|');
	const right = link.indexOf('->');
	const left = link.indexOf('<-');

	if (pipe !== -1) {
		label = link.slice(0, pipe);
		passage = link.slice(pipe + 1);
	} else if (right !== -1) {
		label = link.slice(0, right);
		passage = link.slice(right + 2);
	} else if (left !== -1) {
		passage = link.slice(0, left);
		label = link.slice(left + 2);
	}
	if (label === '' || passage === '') {
		return undefined;
	}
	return {end: i + 1, label, passage, setters};
}

/** Можно ли записать текст или экран внутри [[…]]. */
export function markupSafe(value: string) {
	return value !== '' && !/[[\]|\n]|->|<-/.test(value) && !/^[$_]/.test(value);
}

function findItems(text: string): Item[] {
	const items: Item[] = [];
	let match: RegExpExecArray | null;

	// <<link>> и <<button>>.
	macroRe.lastIndex = 0;
	while ((match = macroRe.exec(text))) {
		const name = match[1] as 'link' | 'button';
		const head = scanArgs(text, match.index + match[0].length);

		if (!head) {
			break;
		}

		const close = findClose(text, name, head.end);

		if (!close) {
			continue;
		}

		const from = match.index;
		const headStart = from + match[0].length;
		const to = close.end;
		const tokens = head.tokens;
		const body = text.slice(head.end, close.at);

		items.push({
			from,
			to,
			form: name,
			other: () => {
				const target = name === 'link' ? 'button' : 'link';

				// Кнопка «Текст» → «Экран» без своего кода — снова [[…]].
				if (target === 'link' && tokens.length === 2) {
					const label = plain(tokens[0]);
					const passage = plain(tokens[1]);
					const setter = /^\s*(?:<<set\s+([^>]*?)>>\s*)?$/.exec(body);

					if (label && passage && markupSafe(label) && markupSafe(passage) && setter) {
						const link = label === passage ? passage : `${label}|${passage}`;

						return `[[${link}]${setter[1] ? `[${setter[1]}]` : ''}]`;
					}
				}
				return (
					`<<${target}` +
					text.slice(headStart, close.at) +
					`<</${target}>>`
				);
			}
		});
	}

	// [[…]] вне команд <<link [[…]]>>.
	const markupRe = /\[\[/g;

	while ((match = markupRe.exec(text))) {
		const at = match.index;

		if (items.some(item => at > item.from && at < item.to && /^<<(?:link|button)\s+$/.test(text.slice(item.from, at)))) {
			continue;
		}

		const parsed = parseMarkup(text, at);

		if (!parsed) {
			continue;
		}

		const {label, passage, setters} = parsed;

		items.push({
			from: at,
			to: parsed.end,
			form: 'link',
			other: () =>
				`<<button ${arg(label)} ${arg(passage)}>>` +
				setters.map(s => `<<set ${s}>>`).join('') +
				'<</button>>'
		});
		markupRe.lastIndex = parsed.end;
	}

	// Окна-сообщения: надпись ссылкой или кнопкой.
	findBlocks(text)
		.filter(block => block.type === 'dialog')
		.forEach(block => {
			const button = block.values.button === true;

			items.push({
				from: block.from,
				to: block.headTo!,
				form: button ? 'button' : 'link',
				other: () =>
					writeBlockHead('dialog', {...block.values, button: !button}, block.extra)
			});
		});

	return items.sort((a, b) => a.from - b.from);
}

/**
 * Элементы, к которым относится выделение: попавшие в выделение целиком или
 * частично, а без выделения — самый внутренний под курсором. Если курсор
 * внутри обёртки вида и не на элементе — все элементы этой обёртки (range).
 */
function targets(text: string, from: number, to: number, range?: {from: number; to: number}) {
	const items = findItems(text);

	if (from !== to) {
		return items.filter(item => item.from < to && item.to > from);
	}

	const under = items.filter(item => from > item.from && from < item.to);

	if (under.length > 0) {
		return [under.reduce((a, b) => (b.from >= a.from ? b : a))];
	}
	if (range) {
		return items.filter(item => item.from >= range.from && item.to <= range.to);
	}
	return [];
}

/** Без вложенных: если элемент внутри другого найденного — берём внешний. */
function outermost(items: Item[]) {
	return items.filter(
		item => !items.some(other => other !== item && other.from <= item.from && other.to >= item.to)
	);
}

/**
 * Чем сделаны элементы под курсором: 'link', 'button', '' — разные,
 * undefined — ни ссылки, ни кнопки нет.
 */
export function linkFormAt(
	text: string,
	from: number,
	to: number,
	range?: {from: number; to: number}
): LinkForm | '' | undefined {
	const found = targets(text, from, to, range);

	if (found.length === 0) {
		return undefined;
	}
	return found.every(item => item.form === found[0].form) ? found[0].form : '';
}

/** Сделать элементы под курсором ссылками или кнопками. */
export function applyLinkForm(
	text: string,
	from: number,
	to: number,
	form: LinkForm,
	range?: {from: number; to: number}
): Edit | undefined {
	const changed = outermost(targets(text, from, to, range)).filter(
		item => item.form !== form
	);

	if (changed.length === 0) {
		return undefined;
	}

	const start = changed[0].from;
	const end = changed[changed.length - 1].to;
	let insert = '';
	let at = start;
	const others = changed.map(item => item.other());

	changed.forEach((item, i) => {
		insert += text.slice(at, item.from) + others[i];
		at = item.to;
	});

	/** Где окажется смещение pos после правки. */
	const map = (pos: number) => {
		let shift = 0;

		for (let i = 0; i < changed.length; i++) {
			const item = changed[i];

			if (pos >= item.to) {
				shift += others[i].length - (item.to - item.from);
			} else if (pos > item.from) {
				return item.from + shift + Math.min(pos - item.from, others[i].length);
			}
		}
		return pos + shift;
	};

	insert += text.slice(at, end);
	return {from: start, to: end, insert, selFrom: map(from), selTo: map(to)};
}
