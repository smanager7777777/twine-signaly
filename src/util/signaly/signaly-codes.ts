// «Twine СИГНАЛЫ»: общая таблица кодов (шаг 3.4, ответы автора 1А–7А).
// Таблица — обычный пассаж «Коды» с тегом sg-codes (виден на карте, правится и
// в обычном Twine):
//   <<sg-replies title "Ошибка" wrong "Неверный код" denied "Нет доступа"
//     badpin "Неверный личный код" used "Пусто" ask "Введите личный код">>
//   <<sg-person "3" pin "417" var "$progress3">>          — сотрудник
//   <<sg-entry "205" "Препарат" decoder who "3, 5" once each title "Медблок" goto "Экран">>
//   действия — те же команды, что внутри ссылки (signaly-actions.ts),
//   и <<sg-progress 1>> — «прогресс вводящего +1»
//   <<sg-answer>>Сотрудник <<= _who>>, откройте конверт 3-2
//   <<sg-when>>$chapter gte 2 (когда можно ввести; раньше — пассаж блокировки lock)
//   <</sg-entry>>
// decoder — метка «ДЕШИФРАТОР»: только для порядка в окне (ответы 2А, 3Б), на ввод
// не влияет.
// Движок (с версии 9) проверяет по ней блок «Поле кода» со словом table:
// сначала свои коды поля, потом общая таблица; если коду важно, кто вводит
// (права, «для каждого», прогресс, _who), — просит личный код во втором поле.

import {Action, parseAction, splitBody, writeAction, writeActions} from './signaly-actions';
import {arg, plain} from './signaly-link-form';
import {findClose, scanArgs} from './signaly-screen-blocks';

export const codesTag = 'sg-codes';
export const codesPassageName = 'Коды';

export const codesHeader =
	'/* СИГНАЛЫ: общая таблица кодов — правьте в окне «Коды» (вкладка «История»).\n' +
	'   Коды проверяет блок «Поле кода» с галочкой «Проверять по общей таблице кодов».\n' +
	'   Этот экран игрокам не показывается. */';

/** Сотрудник: номер или имя, личный код, своя переменная прогресса. */
export interface Person {
	id: string;
	pin: string;
	/** Имя переменной прогресса без $; '' — нет. */
	variable: string;
	extra: string[];
	raw?: string;
}

/** Одноразовый: '' — нет, all — для всех, each — для каждого сотрудника. */
export type Once = '' | 'all' | 'each';

export interface TableCode {
	code: string;
	/** Подпись для себя. */
	label: string;
	/** Метка «ДЕШИФРАТОР»: для фильтра в окне, на ввод не влияет. */
	decoder: boolean;
	/** Кто может ввести; пусто — все. */
	who: string[];
	once: Once;
	/** Ответ на экране: заголовок окна и текст (пусто — без окна). */
	title: string;
	answer: string;
	/** Экран после действий и ответа; '' — остаться. */
	goto: string;
	/** Свои тексты «нет доступа» и «уже использован»; '' — общие. */
	denied: string;
	used: string;
	/** Когда код можно ввести (как в <<if>>); '' — всегда. */
	when: string;
	/** Куда уводит код раньше времени; '' — общий пассаж блокировки. */
	lock: string;
	actions: Action[];
	multiline: boolean;
	extra: string[];
	raw?: string;
}

/** Общие тексты (ответ 6А) и подсказка второго поля. */
export interface CodeTexts {
	title: string;
	wrong: string;
	denied: string;
	badpin: string;
	used: string;
	ask: string;
}

export const textKeys: Array<keyof CodeTexts> = ['title', 'wrong', 'denied', 'badpin', 'used', 'ask'];

export const defaultTexts: CodeTexts = {
	title: 'Ошибка',
	wrong: 'Неверный код',
	denied: 'Нет доступа',
	badpin: 'Неверный личный код',
	used: 'Пусто',
	ask: 'Введите личный код'
};

export interface CodeTable {
	people: Person[];
	codes: TableCode[];
	texts: CodeTexts;
	/** Как была записана строка общих текстов (без правок — дословно). */
	textsRaw?: string;
}

interface Found {
	from: number;
	to: number;
}

function head(text: string, name: string, at: number) {
	return scanArgs(text, at + name.length + 2);
}

/** Все команды name в тексте: позиция и слова. */
function findAll(text: string, name: string, container: boolean) {
	const result: Array<Found & {tokens: string[]; bodyFrom: number; bodyTo: number}> = [];
	const re = new RegExp(`<<${name}(?=[\\s>])`, 'g');
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const h = head(text, name, m.index);

		if (!h) {
			continue;
		}

		const close = container ? findClose(text, name, h.end) : undefined;

		if (container && !close) {
			continue;
		}
		result.push({
			from: m.index,
			to: close ? close.end : h.end,
			tokens: h.tokens,
			bodyFrom: h.end,
			bodyTo: close ? close.at : h.end
		});
		re.lastIndex = close ? close.end : h.end;
	}
	return result;
}

const value = (token: string | undefined) => (token === undefined ? undefined : plain(token) ?? token);

/** Список «кто может ввести» из строки "3, 5". */
export function splitWho(list: string) {
	return list
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
}

function parsePerson(tokens: string[], raw: string): Person | undefined {
	const words = tokens.slice();
	const id = value(words.shift());

	if (id === undefined) {
		return undefined;
	}

	const person: Person = {id, pin: '', variable: '', extra: [], raw};

	while (words.length) {
		const word = words.shift()!;

		if (word === 'pin' && words.length) {
			person.pin = value(words.shift()) ?? '';
		} else if (word === 'var' && words.length) {
			person.variable = (value(words.shift()) ?? '').replace(/^\$/, '');
		} else {
			person.extra.push(word);
		}
	}
	return person;
}

function parseEntry(tokens: string[], body: string, raw: string): TableCode | undefined {
	const words = tokens.slice();
	const code = value(words.shift());

	if (code === undefined) {
		return undefined;
	}

	const entry: TableCode = {
		code,
		label: '',
		decoder: false,
		who: [],
		once: '',
		title: '',
		answer: '',
		goto: '',
		denied: '',
		used: '',
		when: '',
		lock: '',
		actions: [],
		multiline: false,
		extra: [],
		raw
	};
	const keys = ['who', 'once', 'title', 'goto', 'denied', 'used', 'lock'];

	if (words.length && !keys.includes(words[0]) && words[0] !== 'decoder') {
		entry.label = value(words.shift()) ?? '';
	}
	while (words.length) {
		const word = words.shift()!;

		if (word === 'decoder') {
			entry.decoder = true;
		} else if (keys.includes(word) && words.length) {
			const v = value(words.shift()) ?? '';

			if (word === 'who') {
				entry.who = splitWho(v);
			} else if (word === 'once') {
				entry.once = v === 'all' || v === 'each' ? v : '';
			} else {
				(entry as unknown as Record<string, string>)[word] = v;
			}
		} else {
			entry.extra.push(word);
		}
	}

	const whenAt = body.lastIndexOf('<<sg-when>>');
	const main = whenAt === -1 ? body : body.slice(0, whenAt);
	const split = main.indexOf('<<sg-answer>>');
	const actions = split === -1 ? main : main.slice(0, split);

	entry.when = whenAt === -1 ? '' : body.slice(whenAt + '<<sg-when>>'.length).trim();
	entry.answer = split === -1 ? '' : main.slice(split + '<<sg-answer>>'.length).replace(/^[ \t]*\n/, '').replace(/\n\s*$/, '');
	entry.actions = splitBody(actions).map(parseAction);
	entry.multiline = actions.includes('\n');
	return entry;
}

/** Таблица целиком из текста пассажа. */
export function readCodes(text: string): CodeTable {
	const people = findAll(text, 'sg-person', false)
		.map(f => parsePerson(f.tokens, text.slice(f.from, f.to)))
		.filter((p): p is Person => !!p);
	const codes = findAll(text, 'sg-entry', true)
		.map(f => parseEntry(f.tokens, text.slice(f.bodyFrom, f.bodyTo), text.slice(f.from, f.to)))
		.filter((c): c is TableCode => !!c);
	const replies = findAll(text, 'sg-replies', false)[0];
	const texts = {...defaultTexts};

	if (replies) {
		const words = replies.tokens.slice();

		while (words.length) {
			const word = words.shift() as keyof CodeTexts;

			if (textKeys.includes(word) && words.length) {
				texts[word] = value(words.shift()) ?? '';
			}
		}
	}
	return {people, codes, texts, textsRaw: replies && text.slice(replies.from, replies.to)};
}

export function writePerson(person: Person) {
	if (person.raw !== undefined) {
		return person.raw;
	}

	const words = [arg(person.id), 'pin', `"${person.pin}"`];

	if (person.variable) {
		words.push('var', `"$${person.variable}"`);
	}
	words.push(...person.extra);
	return `<<sg-person ${words.join(' ')}>>`;
}

export function writeEntry(entry: TableCode) {
	if (entry.raw !== undefined) {
		return entry.raw;
	}

	const words = [arg(entry.code), arg(entry.label)];

	if (entry.decoder) {
		words.push('decoder');
	}
	if (entry.who.length) {
		words.push('who', arg(entry.who.join(', ')));
	}
	if (entry.once) {
		words.push('once', entry.once);
	}
	(['title', 'goto', 'denied', 'used', 'lock'] as const).forEach(key => {
		if (entry[key]) {
			words.push(key, arg(entry[key]));
		}
	});
	words.push(...entry.extra);

	const multiline = entry.multiline || entry.actions.length > 1 || entry.answer.includes('\n');
	const actions = entry.actions.length ? writeActions(entry.actions, multiline) : multiline ? '\n' : '';
	const answer = entry.answer.trim() === '' ? '' : `<<sg-answer>>${entry.answer}${multiline ? '\n' : ''}`;
	const when = entry.when.trim() === '' ? '' : `<<sg-when>>${entry.when.trim()}${multiline ? '\n' : ''}`;

	return `<<sg-entry ${words.join(' ')}>>${actions}${answer}${when}<</sg-entry>>`;
}

export function writeTexts(texts: CodeTexts) {
	return `<<sg-replies ${textKeys.map(key => `${key} ${arg(texts[key])}`).join(' ')}>>`;
}

/**
 * Новый текст пассажа: всё, кроме команд таблицы, остаётся как было (у нового
 * пассажа — пояснение), затем общие тексты, сотрудники и коды по порядку.
 */
export function writeCodes(text: string, table: CodeTable) {
	const found: Found[] = [
		...findAll(text, 'sg-replies', false),
		...findAll(text, 'sg-person', false),
		...findAll(text, 'sg-entry', true)
	].sort((a, b) => b.from - a.from);
	let rest = text;

	found.forEach(f => {
		rest = rest.slice(0, f.from) + rest.slice(f.to).replace(/^[ \t]*\\?[ \t]*\n?/, '');
	});
	rest = rest.replace(/\s+$/, '');
	if (rest.trim() === '') {
		rest = codesHeader;
	}

	const original = readCodes(text);
	const sameTexts =
		original.textsRaw !== undefined && textKeys.every(key => original.texts[key] === table.texts[key]);

	return [
		rest,
		sameTexts ? original.textsRaw! : writeTexts(table.texts),
		...table.people.map(writePerson),
		...table.codes.map(writeEntry)
	].join('\n');
}

/* ----- Проверки для окна ----- */

/** Нужен ли коду личный код (ответ 2А): права, «для каждого», прогресс или _who. */
export function needsPin(
	entry: Pick<TableCode, 'who' | 'once' | 'actions' | 'answer' | 'title'> & {code?: string},
	referenced?: Set<string>
) {
	const text = entry.answer + entry.title + entry.actions.map(writeAction).join('');

	return (
		entry.who.length > 0 ||
		entry.once === 'each' ||
		/<<sg-progress[\s>]|\b_who\b/.test(text) ||
		// Шаг 3.5: код упомянут в условии «сотрудник ввёл код» — нужно знать, кто ввёл.
		(entry.code !== undefined && referenced?.has(entry.code.trim()) === true)
	);
}

/** Повторы: значения, которые встречаются больше одного раза. */
export function duplicates(values: string[]) {
	const counts = new Map<string, number>();

	values.map(v => v.trim()).forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
	return [...counts].filter(([v, n]) => v !== '' && n > 1).map(([v]) => v);
}

export function newPerson(people: Person[]): Person {
	let n = people.length + 1;

	while (people.some(p => p.id === String(n))) {
		n++;
	}
	return {id: String(n), pin: '', variable: `progress${n}`, extra: []};
}

export function newEntry(): TableCode {
	return {
		code: '',
		label: '',
		decoder: false,
		who: [],
		once: '',
		title: '',
		answer: '',
		goto: '',
		denied: '',
		used: '',
		when: '',
		lock: '',
		actions: [],
		multiline: true,
		extra: []
	};
}
