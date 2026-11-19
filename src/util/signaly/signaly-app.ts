// «Twine СИГНАЛЫ»: данные приложения для телефонов в истории (сессия 32, этап Т2,
// claude/13 раздел 6б; решения автора app/05 П-59, П-61).
//
// Пакет приложения .sgpack (game.json + media/) живёт в истории так:
//   - пассаж «Приложение» с тегом app-settings — общие настройки, палитра, главы
//     и стили, приборы, уведомления, аварии, сбои, правила, голосования; по строке
//     на запись: <<app-general>>{…}<</app-general>>, <<app-chapter>>{…}<</app-chapter>>,
//     <<app-device>>, <<app-notice>>, <<app-alarm>>, <<app-glitch>>, <<app-rule>>, <<app-vote>>;
//   - блоки данных — пассажи с тегом app-block: название пассажа — «Папка/Подпапка/Блок»,
//     первая строка <<app-block "id" who "1, 3" chapter 2 start share garble 2>>, дальше
//     текст блока; картинки и звук — строками <<app-img "media/app/x.jpg" "подпись">> и
//     <<app-audio "media/app/x.mp3" "название">> (файлы — в папке игры media/app/);
//   - персонажи — сотрудники таблицы «Коды»: <<sg-person "1" pin "417" phone '{…}'>>
//     (номер сотрудника = «Номер на терминале», П-61 Т2-7);
//   - коды телефона — в той же таблице: <<sg-entry "4242" "Подпись" where phone|both>>
//     …<<sg-phone>>{…}<</sg-entry>> (код «оба» — два набора действий, П-59 А4).
// В JSON внутри пассажей знаки < > [ ] в строках записаны как \u003c и т. п.: так ни
// SugarCube, ни карта Twine не примут их за команды и ссылки.
//
// Код только для программы (не движок): сборка пакета из истории, загрузка пакета в
// историю, отличия, zip.

import {strFromU8, strToU8, unzipSync, zipSync, Zippable} from 'fflate';
import {
	CodeTable,
	codesHeader,
	codesPassageName,
	codesTag,
	jsonArg,
	Person,
	readCodes,
	TableCode,
	writeCodes
} from './signaly-codes';
import {arg, plain} from './signaly-link-form';
import {scanArgs} from './signaly-screen-blocks';
import {sharedVariables, withShared} from './signaly-variables';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AppGame = Record<string, any>;
export type AppFiles = Record<string, Uint8Array>;

export const appSettingsTag = 'app-settings';
export const appSettingsName = 'Приложение';
export const appBlockTag = 'app-block';
export const appMediaDir = 'media/app/';
/** Цвет тега блоков на карте (П-61 Т2-8). */
export const appBlockColor = 'blue';
export const appSettingsColor = 'purple';

export const appSettingsHeader =
	'/* СИГНАЛЫ: приложение для телефонов игроков — общие настройки пакета (.sgpack).\n' +
	'   Правьте в окне «Приложение» или в редакторе приложения (затем «Загрузить пакет»).\n' +
	'   Блоки данных — пассажи с тегом app-block, персонажи и коды — в «Кодах».\n' +
	'   Этот экран игрокам не показывается. */';

/** Списки настроек: ключ game.json → команда пассажа «Приложение». */
export const appLists: Array<[string, string]> = [
	['chapters', 'app-chapter'],
	['apps', 'app-device'],
	['notices', 'app-notice'],
	['alarms', 'app-alarm'],
	['glitches', 'app-glitch'],
	['rules', 'app-rule'],
	['votes', 'app-vote']
];
const ownKeys = [
	'accounts',
	'blocks',
	'codes',
	// Сессия 35 (Т4-3): общие переменные — из StoryInit (галочка в окне «Переменные»).
	'shared',
	...appLists.map(([key]) => key)
];

/* ----- JSON внутри пассажей ----- */

const safeChar: Record<string, string> = {
	'<': '\\u003c',
	'>': '\\u003e',
	'[': '\\u005b',
	']': '\\u005d'
};

/** JSON одной строкой: в строках < > [ ] — через \u, между скобками массивов — пробел. */
export function jsonText(value: unknown) {
	const json = JSON.stringify(value) ?? 'null';
	let out = '';
	let inString = false;

	for (let i = 0; i < json.length; i++) {
		const ch = json[i];

		if (inString) {
			if (ch === '\\') {
				out += ch + json[i + 1];
				i++;
				continue;
			}
			if (ch === '"') {
				inString = false;
			}
			out += safeChar[ch] ?? ch;
			continue;
		}
		if (ch === '"') {
			inString = true;
		}
		out += ch;
		if (
			(ch === '[' && json[i + 1] === '[') ||
			(ch === ']' && json[i + 1] === ']')
		) {
			out += ' ';
		}
	}
	return out;
}

function parseJson(text: string | undefined): any {
	if (!text || !text.trim()) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

const isObject = (v: unknown): v is Record<string, any> =>
	!!v && typeof v === 'object' && !Array.isArray(v);

/* ----- пассаж «Приложение» ----- */

export function writeSettings(game: AppGame) {
	const general: AppGame = {};

	Object.keys(game).forEach(key => {
		if (!ownKeys.includes(key)) {
			general[key] = game[key];
		}
	});

	const lines = [
		appSettingsHeader,
		`<<app-general>>${jsonText(general)}<</app-general>>`
	];

	appLists.forEach(([key, macro]) => {
		(Array.isArray(game[key]) ? game[key] : []).forEach((item: unknown) => {
			lines.push(`<<${macro}>>${jsonText(item)}<</${macro}>>`);
		});
	});
	return lines.join('\n');
}

/** Настройки из пассажа: общие ключи и списки (пустые списки — []). */
export function readSettings(text: string) {
	const game: AppGame = {};
	const problems: string[] = [];

	appLists.forEach(([key]) => (game[key] = []));

	const re = /<<(app-[a-z]+)>>(.*?)<<\/\1>>/g;
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const value = parseJson(m[2]);

		if (value === undefined) {
			problems.push(`${m[1]}: ${m[2].slice(0, 60)}`);
			continue;
		}
		if (m[1] === 'app-general') {
			if (isObject(value)) {
				Object.assign(game, value);
			}
			continue;
		}

		const list = appLists.find(([, macro]) => macro === m![1]);

		if (list) {
			game[list[0]].push(value);
		}
	}
	return {game, problems};
}

/* ----- номера персонажей (П-61 Т2-7: персонаж в окнах — по номеру) ----- */

interface PhonePerson {
	person: Person;
	data: AppGame;
}

function phonePeople(table: CodeTable): PhonePerson[] {
	return table.people
		.filter(p => p.phone)
		.map(person => ({person, data: parseJson(person.phone)}))
		.filter((x): x is PhonePerson => isObject(x.data));
}

/** Аккаунт приложения из сотрудника: id из JSON (или n<номер>), номер — номер сотрудника. */
function accountOf(x: PhonePerson): AppGame {
	return {...x.data, id: x.data.id || `n${x.person.id}`, num: x.person.id};
}

/* ----- пассажи блоков ----- */

const blockOwn = [
	'id',
	'title',
	'section',
	'who',
	'chapter',
	'start',
	'share',
	'garble',
	'items'
];

/** Название пассажа блока: «Папка/Подпапка/Название». */
export function blockPassageName(block: AppGame) {
	const title = String(block.title ?? '').trim() || `Блок ${block.id}`;
	const section = String(block.section ?? '').trim();

	return section ? `${section}/${title}` : title;
}

function itemLine(item: AppGame) {
	const more: AppGame = {};
	const known =
		item.type === 'image'
			? ['type', 'file', 'caption']
			: item.type === 'audio'
				? ['type', 'file', 'title']
				: ['type', 'text'];

	Object.keys(item).forEach(k => {
		if (!known.includes(k)) {
			more[k] = item[k];
		}
	});

	const extra = Object.keys(more).length
		? ` more ${jsonArg(jsonText(more))}`
		: '';
	const path = (file: unknown) => arg(file ? appMediaDir + String(file) : '');

	if (item.type === 'image') {
		return `<<app-img ${path(item.file)} ${arg(String(item.caption ?? ''))}${extra}>>`;
	}
	if (item.type === 'audio') {
		return `<<app-audio ${path(item.file)} ${arg(String(item.title ?? ''))}${extra}>>`;
	}
	return `<<app-text${extra}>>`;
}

/** Текст пассажа блока; numOf — номер персонажа по id аккаунта. */
export function writeBlock(
	block: AppGame,
	numOf: (id: string) => string,
	name = blockPassageName(block)
) {
	const words = [arg(String(block.id))];
	const who: string[] = Array.isArray(block.who)
		? block.who.map((id: string) => numOf(String(id)))
		: [];
	const more: AppGame = {};

	if (who.length) {
		words.push('who', arg(who.join(', ')));
	}
	if (block.chapter !== undefined && block.chapter !== 1) {
		words.push('chapter', String(block.chapter));
	}
	if (block.start) {
		words.push('start');
	}
	if (block.share) {
		words.push('share');
	}
	if (block.garble) {
		words.push('garble', String(block.garble));
	}
	// Название и папка — из названия пассажа; если пассаж назван иначе (повтор) — явно.
	const title = String(block.title ?? '');
	const section = String(block.section ?? '');
	const fromName = splitName(name);

	if (fromName.title !== title) {
		words.push('title', arg(title));
	}
	if (fromName.section !== section) {
		words.push('folder', arg(section));
	}
	Object.keys(block).forEach(k => {
		if (!blockOwn.includes(k)) {
			more[k] = block[k];
		}
	});
	if (Object.keys(more).length) {
		words.push('more', jsonArg(jsonText(more)));
	}

	const lines = [`<<app-block ${words.join(' ')}>>`];
	const items: AppGame[] = Array.isArray(block.items) ? block.items : [];

	items.forEach((item, i) => {
		if (item.type === 'image' || item.type === 'audio') {
			lines.push(itemLine(item));
			return;
		}

		const text = String(item.text ?? '');
		const prev = items[i - 1];
		const plainText =
			Object.keys(item).every(k => k === 'type' || k === 'text') &&
			item.type === 'text';

		// Свой знак начала: пустой текст, два текста подряд, лишние поля.
		if (
			!plainText ||
			text.trim() === '' ||
			(prev && prev.type !== 'image' && prev.type !== 'audio')
		) {
			lines.push(itemLine(item));
		}
		// Строка текста, похожая на команду блока, — с лишней «\\» впереди.
		lines.push(text.replace(/^(\\*<<app-(?:img|audio|text))/gm, '\\$1'));
	});
	return lines.join('\n');
}

function splitName(name: string) {
	const parts = name.split('/');
	const title = parts.pop() ?? '';

	return {title, section: parts.join('/')};
}

const itemRe = /^<<app-(img|audio|text)(\s[^\n]*)?>>[ \t]*$/;

function tokensOf(line: string, at: number) {
	return scanArgs(line, at)?.tokens ?? [];
}

const val = (t: string | undefined) =>
	t === undefined ? undefined : (plain(t) ?? t);

/** Блок из пассажа; idOf — id аккаунта по номеру персонажа. undefined — это не блок. */
export function readBlock(
	name: string,
	text: string,
	idOf: (num: string) => string
): AppGame | undefined {
	const nl = text.indexOf('\n');
	const head = nl === -1 ? text : text.slice(0, nl);
	const m = /^\s*<<app-block(?=[\s>])/.exec(head);

	if (!m) {
		return undefined;
	}

	const words = tokensOf(head, m[0].length);
	const fromName = splitName(name);
	const block: AppGame = {
		id: val(words.shift()) ?? '',
		title: fromName.title,
		section: fromName.section,
		who: [],
		chapter: 1,
		start: false,
		items: [],
		share: false,
		garble: 0
	};

	while (words.length) {
		const w = words.shift()!;

		if (w === 'start' || w === 'share') {
			block[w] = true;
		} else if (w === 'who' && words.length) {
			block.who = String(val(words.shift()) ?? '')
				.split(',')
				.map(s => s.trim())
				.filter(Boolean)
				.map(idOf);
		} else if ((w === 'chapter' || w === 'garble') && words.length) {
			const raw = String(val(words.shift()));
			const n = Number(raw);

			block[w] = raw.trim() !== '' && isFinite(n) ? n : raw;
		} else if (w === 'title' && words.length) {
			block.title = String(val(words.shift()) ?? '');
		} else if (w === 'folder' && words.length) {
			block.section = String(val(words.shift()) ?? '');
		} else if (w === 'more' && words.length) {
			const more = parseJson(val(words.shift()));

			if (isObject(more)) {
				Object.assign(block, more);
			}
		}
	}

	const lines = nl === -1 ? [] : text.slice(nl + 1).split('\n');
	let buffer: string[] = [];
	let open: AppGame | undefined;

	const flush = () => {
		if (open || buffer.some(l => l.trim() !== '')) {
			block.items.push({
				...(open ?? {type: 'text'}),
				type: 'text',
				text: buffer.join('\n')
			});
		}
		buffer = [];
		open = undefined;
	};

	lines.forEach(line => {
		const im = itemRe.exec(line);

		if (!im) {
			buffer.push(line.replace(/^\\(\\*<<app-(?:img|audio|text))/, '$1'));
			return;
		}
		flush();

		const t = tokensOf(line, line.indexOf(im[1]) + im[1].length);
		const moreAt = t.indexOf('more');
		const more = moreAt === -1 ? undefined : parseJson(val(t[moreAt + 1]));

		if (moreAt !== -1) {
			t.splice(moreAt, 2);
		}
		if (im[1] === 'text') {
			open = isObject(more) ? {type: 'text', ...more} : {type: 'text'};
			return;
		}

		const path = String(val(t[0]) ?? '');
		const file = path.startsWith(appMediaDir)
			? path.slice(appMediaDir.length)
			: path.replace(/^media\//, '');
		const item: AppGame =
			im[1] === 'img'
				? {type: 'image', file, caption: String(val(t[1]) ?? '')}
				: {type: 'audio', file, title: String(val(t[1]) ?? '')};

		block.items.push(
			isObject(more) ? {...item, ...more, type: item.type} : item
		);
	});
	flush();
	return block;
}

/** id блока из первой строки пассажа (без разбора остального). */
export function blockIdOf(text: string) {
	const m = /^\s*<<app-block\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/.exec(
		text
	);

	return m ? String(val(m[1].replace(/>>$/, ''))) : undefined;
}

/* ----- коды телефона ----- */

/** Код приложения → часть телефона (без самого кода; у кода «только телефон» подпись — комментарий). */
function phoneOfCode(code: AppGame, phoneOnly: boolean) {
	const rest: AppGame = {};

	Object.keys(code).forEach(k => {
		if (k !== 'code' && !(phoneOnly && k === 'comment')) {
			rest[k] = code[k];
		}
	});
	return jsonText(rest);
}

function codeOfEntry(entry: TableCode, index: number): AppGame {
	const data = parseJson(entry.phone);
	const code: AppGame = {
		id: `t${index + 1}`,
		...(isObject(data) ? data : {}),
		code: entry.code
	};

	if (entry.where === 'phone') {
		code.comment = entry.label;
	}
	return code;
}

const normCode = (code: unknown) =>
	String(code ?? '')
		.replace(/\s+/g, '')
		.toUpperCase();

/* ----- история → пакет ----- */

export interface StoryPassage {
	name: string;
	tags: string[];
	text: string;
}

export interface BuiltGame {
	game: AppGame;
	/** Файлы пакета: имя в media/ пакета → путь в папке игры. */
	files: Array<{name: string; path: string}>;
	problems: string[];
}

export function codesPassageOf<T extends StoryPassage>(passages: T[]) {
	return (
		passages.find(p => p.tags.includes(codesTag)) ??
		passages.find(p => p.name === codesPassageName)
	);
}

export function settingsPassageOf<T extends StoryPassage>(passages: T[]) {
	return passages.find(p => p.tags.includes(appSettingsTag));
}

/** Есть ли в истории данные приложения. */
export function hasAppData(passages: StoryPassage[]) {
	if (
		settingsPassageOf(passages) ||
		passages.some(p => p.tags.includes(appBlockTag))
	) {
		return true;
	}

	const codes = codesPassageOf(passages);

	return !!codes && /\sphone\s|\swhere\s+(phone|both)\b/.test(codes.text);
}

/**
 * Пакет из истории. appFiles — файлы папки игры media/app/ (пути «media/app/…»): все
 * попадают в пакет (как «Медиа» редактора приложения), а файлы блоков вне media/app/ —
 * тоже, под своим путём без «media/».
 */
export function storyToGame(
	passages: StoryPassage[],
	appFiles: string[] = []
): BuiltGame {
	const problems: string[] = [];
	const settings = settingsPassageOf(passages);
	const read = settings
		? readSettings(settings.text)
		: {game: {}, problems: []};
	const game: AppGame = read.game;

	problems.push(
		...read.problems.map(p => `«${settings!.name}»: не читается ${p}`)
	);
	appLists.forEach(([key]) => (game[key] = game[key] ?? []));

	const codesPassage = codesPassageOf(passages);
	const table = codesPassage ? readCodes(codesPassage.text) : undefined;
	const people = table ? phonePeople(table) : [];

	table?.people
		.filter(p => p.phone && !isObject(parseJson(p.phone)))
		.forEach(p =>
			problems.push(`«Коды»: сотрудник ${p.id} — данные телефона не читаются`)
		);
	game.accounts = people.map(accountOf);
	const shared = sharedVariables(passages.find(p => p.name === 'StoryInit')?.text ?? '');

	if (shared.length) {
		game.shared = shared;
	} else {
		delete game.shared;
	}

	const idOf = (num: string) =>
		people.find(x => x.person.id === num)?.data.id ||
		(people.some(x => x.person.id === num) ? `n${num}` : num);

	game.blocks = passages
		.filter(p => p.tags.includes(appBlockTag))
		.map(p => {
			const block = readBlock(p.name, p.text, idOf);

			if (!block) {
				problems.push(`«${p.name}»: нет первой строки <<app-block …>>`);
			}
			return block;
		})
		.filter(Boolean);
	game.codes = (table?.codes ?? [])
		.map((entry, i) => ({entry, i}))
		.filter(({entry}) => entry.where === 'phone' || entry.where === 'both')
		.map(({entry, i}) => {
			if (entry.phone && !isObject(parseJson(entry.phone))) {
				problems.push(`«Коды»: код ${entry.code} — часть телефона не читается`);
			}
			return codeOfEntry(entry, i);
		});

	const files = new Map<string, string>();

	appFiles.forEach(path => {
		if (path.startsWith(appMediaDir)) {
			files.set(path.slice(appMediaDir.length), path);
		}
	});
	[...game.accounts, ...game.blocks].forEach((owner: AppGame) =>
		(Array.isArray(owner.items) ? owner.items : []).forEach((it: AppGame) => {
			if (!it.file || files.has(it.file)) {
				return;
			}
			files.set(
				String(it.file),
				String(it.file).includes('/') && !String(it.file).startsWith('app/')
					? `media/${it.file}`
					: appMediaDir + it.file
			);
		})
	);
	return {
		game,
		files: [...files].map(([name, path]) => ({name, path})),
		problems
	};
}

/* ----- пакет → история ----- */

export interface AppImport {
	settingsText: string;
	codesText: string;
	/** Пассажи блоков: existing — нынешнее название (если пассаж уже есть). */
	blocks: Array<{id: string; name: string; text: string; existing?: string}>;
	/** Пассажи блоков, которых нет в пакете. */
	removeBlocks: string[];
	/** Файлы для media/app/ папки игры. */
	files: Array<{path: string; name: string}>;
	/** Персонажам без номера даны номера: «имя → номер». */
	numbered: string[];
	/** Сессия 35: новый текст StoryInit (общие переменные пакета) или undefined — без изменений. */
	initText?: string;
}

export function gameToStory(
	passages: StoryPassage[],
	game: AppGame,
	fileNames: string[]
): AppImport {
	const codesPassage = codesPassageOf(passages);
	const table = readCodes(codesPassage?.text ?? '');
	const numbered: string[] = [];
	const accounts: AppGame[] = Array.isArray(game.accounts) ? game.accounts : [];
	const people = table.people.map(p => ({...p}));
	const taken = new Set(people.map(p => p.id));
	const used = new Set<Person>();
	const numById = new Map<string, string>();
	const phoneId = (p: Person) => {
		const d = parseJson(p.phone);

		return isObject(d) ? String(d.id ?? `n${p.id}`) : undefined;
	};

	function freeNumber() {
		let n = 1;

		while (taken.has(String(n))) {
			n++;
		}
		return String(n);
	}

	accounts.forEach(acc => {
		const id = String(acc.id ?? '');
		let person =
			people.find(p => !used.has(p) && phoneId(p) === id) ??
			(acc.num
				? people.find(
						p =>
							!used.has(p) &&
							p.id === String(acc.num).trim() &&
							(!p.phone || phoneId(p) === id)
					)
				: undefined);
		const num = person
			? person.id
			: String(acc.num ?? '').trim() && !taken.has(String(acc.num).trim())
				? String(acc.num).trim()
				: freeNumber();

		if (!person) {
			person = {id: num, pin: '', variable: '', extra: []};
			people.push(person);
			taken.add(num);
		}
		if (!String(acc.num ?? '').trim() || String(acc.num).trim() !== num) {
			numbered.push(`${acc.name || id} → ${num}`);
		}

		const data: AppGame = {};

		Object.keys(acc).forEach(k => {
			if (k !== 'num') {
				data[k] = acc[k];
			}
		});
		person.phone = jsonText(data);
		delete person.raw;
		used.add(person);
		numById.set(id, num);
	});
	// Персонажи, которых нет в пакете: только для телефона — убрать, сотрудник терминала остаётся.
	const keptPeople = people.filter(p => {
		if (!p.phone || used.has(p)) {
			return true;
		}
		delete p.raw;
		p.phone = undefined;
		return p.pin !== '' || p.variable !== '' || p.extra.length > 0;
	});

	// Коды.
	const codes: AppGame[] = Array.isArray(game.codes) ? game.codes : [];
	const entries = table.codes.map(e => ({...e}));
	const entryId = (e: TableCode) => {
		const d = parseJson(e.phone);

		return isObject(d) ? String(d.id ?? '') : undefined;
	};
	const doneEntries = new Set<TableCode>();
	const added: TableCode[] = [];
	const countByCode = new Map<string, number>();

	codes.forEach(c =>
		countByCode.set(
			normCode(c.code),
			(countByCode.get(normCode(c.code)) ?? 0) + 1
		)
	);
	codes.forEach(code => {
		const id = String(code.id ?? '');
		let entry = entries.find(
			e =>
				!doneEntries.has(e) &&
				(e.where === 'phone' || e.where === 'both') &&
				entryId(e) === id
		);

		if (
			entry &&
			entry.where === 'both' &&
			normCode(entry.code) !== normCode(code.code)
		) {
			// Код на телефоне поменяли: терминальная часть остаётся, телефонная — отдельно.
			entry.where = '';
			entry.phone = undefined;
			delete entry.raw;
			entry = undefined;
		}
		if (
			!entry &&
			normCode(code.code) !== '' &&
			countByCode.get(normCode(code.code)) === 1
		) {
			// Первый раз: тот же код на терминале — один код «оба».
			entry = entries.find(
				e =>
					!doneEntries.has(e) &&
					!e.where &&
					!e.phone &&
					normCode(e.code) === normCode(code.code)
			);
			if (entry) {
				entry.where = 'both';
			}
		}
		if (entry) {
			if (entry.where === 'phone') {
				entry.code = String(code.code ?? '');
				entry.label = String(code.comment ?? '');
			}
			entry.phone = phoneOfCode(code, entry.where === 'phone');
			delete entry.raw;
			doneEntries.add(entry);
			return;
		}

		const fresh: TableCode = {
			code: String(code.code ?? ''),
			label: String(code.comment ?? ''),
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
			where: 'phone',
			phone: phoneOfCode(code, true),
			extra: []
		};

		added.push(fresh);
		doneEntries.add(fresh);
	});

	const keptEntries = entries.filter(e => {
		if (doneEntries.has(e) || (e.where !== 'phone' && e.where !== 'both')) {
			return true;
		}
		if (e.where === 'both') {
			e.where = '';
			e.phone = undefined;
			delete e.raw;
			return true;
		}
		return false;
	});
	const codesText = writeCodes(codesPassage?.text ?? codesHeader, {
		...table,
		people: keptPeople,
		codes: [...keptEntries, ...added]
	});

	// Блоки.
	const existing = new Map<string, StoryPassage>();

	passages
		.filter(p => p.tags.includes(appBlockTag))
		.forEach(p => {
			const id = blockIdOf(p.text);

			if (id !== undefined && !existing.has(id)) {
				existing.set(id, p);
			}
		});

	const blocks: AppGame[] = Array.isArray(game.blocks) ? game.blocks : [];
	const ids = new Set(blocks.map(b => String(b.id)));
	// Пассажи блоков с id либо получат новое название, либо уберутся — их имена свободны.
	const names = new Set(
		passages
			.filter(
				p => !(p.tags.includes(appBlockTag) && blockIdOf(p.text) !== undefined)
			)
			.map(p => p.name)
	);
	const numOf = (id: string) => numById.get(id) ?? id;
	const outBlocks = blocks.map(block => {
		let name = blockPassageName(block);

		if (names.has(name)) {
			let n = 2;

			while (names.has(`${name} (${n})`)) {
				n++;
			}
			name = `${name} (${n})`;
		}
		names.add(name);
		return {
			id: String(block.id),
			name,
			text: writeBlock(block, numOf, name),
			existing: existing.get(String(block.id))?.name
		};
	});
	const removeBlocks = [...existing]
		.filter(([id]) => !ids.has(id))
		.map(([, p]) => p.name);

	// Лишние пассажи с тегом app-block без первой строки — не трогаем.
	return {
		settingsText: writeSettings(game),
		codesText,
		blocks: outBlocks,
		removeBlocks,
		files: fileNames.map(name => ({name, path: appMediaDir + name})),
		numbered,
		initText: withShared(
			passages.find(p => p.name === 'StoryInit')?.text ?? '',
			(Array.isArray(game.shared) ? game.shared : [])
				.filter((v: AppGame) => isObject(v) && typeof v.name === 'string')
				.map((v: AppGame) => ({name: String(v.name).replace(/^\$/, ''), label: v.label, value: v.value}))
		)
	};
}

/* ----- отличия (П-61 Т2-11: изменённый в старом редакторе пакет — показать и спросить) ----- */

const same = (a: unknown, b: unknown) =>
	JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

function sortKeys(v: unknown): unknown {
	if (Array.isArray(v)) {
		return v.map(sortKeys);
	}
	if (isObject(v)) {
		return Object.keys(v)
			.sort()
			.reduce((o, k) => ({...o, [k]: sortKeys(v[k])}), {} as AppGame);
	}
	return v;
}

export const appSections: Array<[string, string, (x: AppGame) => string]> = [
	[
		'accounts',
		'Персонажи',
		x => `${x.name || x.id}${x.num ? ` (№${x.num})` : ''}`
	],
	['blocks', 'Блоки', x => blockPassageName(x)],
	[
		'codes',
		'Коды',
		x => `${x.code || x.voice || x.id}${x.comment ? ` — ${x.comment}` : ''}`
	],
	['chapters', 'Главы', x => x.name || x.id],
	['apps', 'Приборы', x => x.name || x.id],
	['notices', 'Уведомления', x => x.name || x.title || x.id],
	['alarms', 'Аварии', x => x.name || x.id],
	['glitches', 'Сбои', x => x.name || x.id],
	['rules', 'Правила', x => x.name || x.id],
	['votes', 'Голосования', x => x.name || x.id],
	['shared', 'Общие переменные', x => `$${x.name}`]
];

export interface AppDiff {
	section: string;
	added: string[];
	removed: string[];
	changed: string[];
}

const blockDefaults = {
	title: '',
	section: '',
	who: [],
	chapter: 1,
	start: false,
	items: [],
	share: false,
	garble: 0
};

/**
 * Значения по умолчанию там, где история их не пишет (как SG.normalize приложения): блок без
 * «главы» — глава 1 и т. п., у кода «только телефон» комментарий — подпись. Так пакет из
 * старого редактора и тот же пакет, прошедший через историю, совпадают.
 */
export function withDefaults(game: AppGame): AppGame {
	return {
		...game,
		blocks: (Array.isArray(game.blocks) ? game.blocks : []).map(
			(b: AppGame) => ({...blockDefaults, ...b})
		),
		codes: (Array.isArray(game.codes) ? game.codes : []).map((c: AppGame) => ({
			comment: '',
			...c
		})),
		...(Array.isArray(game.shared) && game.shared.length
			? {shared: game.shared.map((v: AppGame) => ({label: '', value: 0, ...v}))}
			: {})
	};
}

/** Что поменяется, если историю заменить пакетом: было (из истории) → станет (пакет). */
export function diffGames(
	wasGame: AppGame,
	nowGame: AppGame,
	wasFiles: AppFiles = {},
	nowFiles: AppFiles = {}
): AppDiff[] {
	const out: AppDiff[] = [];
	const was = withDefaults(wasGame);
	const now = withDefaults(nowGame);
	const general = (g: AppGame) =>
		Object.keys(g).filter(k => !ownKeys.includes(k));
	const keys = [...new Set([...general(was), ...general(now)])].filter(
		k => !same(was[k], now[k])
	);

	if (keys.length) {
		out.push({
			section: 'Общие настройки',
			added: [],
			removed: [],
			changed: keys
		});
	}
	appSections.forEach(([key, section, label]) => {
		const a: AppGame[] = Array.isArray(was[key]) ? was[key] : [];
		const b: AppGame[] = Array.isArray(now[key]) ? now[key] : [];
		// Общие переменные — по имени (у них нет id).
		const idOf = (x: AppGame) => (key === 'shared' ? x.name : x.id);
		const byId = (list: AppGame[], id: unknown) => list.find(x => idOf(x) === id);
		const d: AppDiff = {
			section,
			added: b.filter(x => !byId(a, idOf(x))).map(label),
			removed: a.filter(x => !byId(b, idOf(x))).map(label),
			changed: b
				.filter(x => byId(a, idOf(x)) && !same(byId(a, idOf(x)), x))
				.map(label)
		};

		if (d.added.length || d.removed.length || d.changed.length) {
			out.push(d);
		}
	});

	const files: AppDiff = {
		section: 'Файлы media/app',
		added: [],
		removed: [],
		changed: []
	};

	Object.keys(nowFiles).forEach(n => {
		if (!wasFiles[n]) {
			files.added.push(n);
		} else if (!sameBytes(wasFiles[n], nowFiles[n])) {
			files.changed.push(n);
		}
	});
	// Файлов, которых нет в пакете, программа из папки не удаляет — их не показываем.
	if (files.added.length || files.removed.length || files.changed.length) {
		out.push(files);
	}
	return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

/** Совпадают ли два пакета по смыслу (порядок ключей не важен). */
export function sameGame(a: AppGame, b: AppGame) {
	return same(a, b);
}

/* ----- zip ----- */

export function readSgpack(data: Uint8Array): {game: AppGame; files: AppFiles} {
	const all = unzipSync(data);
	const json = all['game.json'];

	if (!json) {
		throw new Error('В пакете нет game.json');
	}

	const files: AppFiles = {};

	Object.keys(all).forEach(name => {
		if (name.startsWith('media/') && !name.endsWith('/')) {
			files[name.slice('media/'.length)] = all[name];
		}
	});
	return {game: JSON.parse(strFromU8(all['game.json'])), files};
}

export function writeSgpack(game: AppGame, files: AppFiles) {
	const zip: Zippable = {'game.json': strToU8(JSON.stringify(game, null, 1))};

	Object.keys(files).forEach(
		name => (zip['media/' + name] = [files[name], {level: 0}])
	);
	return zipSync(zip, {level: 6});
}
