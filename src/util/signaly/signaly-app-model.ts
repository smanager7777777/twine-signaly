// «Twine СИГНАЛЫ»: данные приложения для форм (сессия 33, этап Т3 — claude/13 раздел 6б;
// решения app/05 П-59, П-61, twine/05 149). Хранение — signaly-app.ts и 11_APP_IN_STORY.md.
//
// Значения по умолчанию и списки (функции, действия, эффекты сбоев) — как в приложении:
// signaly-app, src/common/logic.js (SG.normalize, MODULES, ACTIONS; MIT — перенос в GPL
// разрешён, П-59). Формы показывают значение по умолчанию, а пишут только то, что поменяли.

import {CodeTable} from './signaly-codes';
import {arg, plain} from './signaly-link-form';
import {scanArgs} from './signaly-screen-blocks';
import {sharedVariables} from './signaly-variables';
import {
	AppGame,
	appBlockTag,
	appMediaDir,
	blockPassageName,
	readBlock,
	readSettings,
	settingsPassageOf,
	StoryPassage
} from './signaly-app';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const defaultTexts: Record<string, string> = {
	loginTitle: 'ВВЕДИТЕ КОД ДОСТУПА',
	wrongCode: 'КОД НЕ РАСПОЗНАН',
	denied: 'НЕТ ДОСТУПА',
	already: 'ДАННЫЕ УЖЕ ПОЛУЧЕНЫ',
	tooEarly: 'КОД ПОКА НЕ АКТИВЕН',
	opened: 'ДОСТУП ОТКРЫТ',
	chapter: 'ПЕРЕХОД',
	empty: 'РЕСУРС ИСЧЕРПАН',
	mine: 'ВЫ УЖЕ ПОЛУЧИЛИ СВОЮ ДОЛЮ',
	offline: 'НЕТ СВЯЗИ С ЦЕНТРОМ — ПОВТОРИТЕ',
	sign: 'НУЖНА ЕЩЁ ПОДПИСЬ',
	signed: 'ПОДТВЕРЖДЕНО',
	unknown: 'НЕТ ДАННЫХ',
	used: 'ПРИБОР ИСЧЕРПАН',
	broken: 'ПОВРЕЖДЕНО',
	alarm: 'АВАРИЙНЫЙ РЕЖИМ',
	scanFail: 'СКАНЕР НЕ ОТВЕЧАЕТ',
	busy: 'ЭТОТ ПЕРСОНАЖ УЖЕ В СЕТИ',
	noPaste: 'ВСТАВКА НЕДОСТУПНА — НАБЕРИТЕ ВРУЧНУЮ'
};

export const defaultChat: AppGame = {
	master: 'Руководитель',
	masterProf: '',
	anon: 'НЕИЗВЕСТНЫЙ',
	noPaste: true,
	delayMax: 60,
	masterContact: false,
	auto: true,
	bossColor: '',
	anonColor: ''
};

/** Сессия 36 (Т4-6 Б): шапка и нижнее меню телефона (как SG.normHeader и MENU_TABS приложения). */
export const defaultHeader: AppGame = {title: '', sub: '', chapter: true, infoTitle: '', items: [], info: [], chapters: []};
export const menuTabs: Array<[string, string]> = [
	['data', 'ДАННЫЕ'],
	['code', 'КОД'],
	['scan', 'СКАНЕР'],
	['chat', 'СВЯЗЬ'],
	['apps', 'ПРИБОРЫ'],
	['photo', 'КАМЕРА'],
	['notes', 'ЗАМЕТКИ']
];

/** Нижнее меню по порядку (заданные — первыми, остальные — по умолчанию). */
export interface MenuRow {
	tab: string;
	label: string;
	hidden: boolean;
	/** Сессия 37 (Т6-5 Б): с главы и кому (id персонажей; пусто — всем). */
	chapter: number;
	who: string[];
	def: string;
}

export function fullMenu(menu: unknown): MenuRow[] {
	const given = (Array.isArray(menu) ? menu : []).filter(m => m && menuTabs.some(t => t[0] === m.tab));
	const out: MenuRow[] = given.map(m => ({
		tab: String(m.tab),
		label: String(m.label ?? ''),
		hidden: !!m.hidden,
		chapter: Number(m.chapter) || 1,
		who: Array.isArray(m.who) ? m.who.map(String) : [],
		def: ''
	}));

	menuTabs.forEach(([tab]) => {
		if (!out.some(m => m.tab === tab)) {
			out.push({tab, label: '', hidden: false, chapter: 1, who: [], def: ''});
		}
	});
	return out.map(m => ({...m, def: menuTabs.find(t => t[0] === m.tab)![1]}));
}

/** Меню без изменений — пустой список (как «Как было» в редакторе приложения). */
export function menuValue(list: Array<{tab: string; label: string; hidden: boolean; chapter?: number; who?: string[]}>) {
	const out = list.map(m => ({tab: m.tab, label: m.label, hidden: m.hidden, chapter: Number(m.chapter) || 1, who: m.who ?? []}));

	return out.every((m, i) => !m.label && !m.hidden && m.chapter === 1 && !m.who.length && m.tab === menuTabs[i][0]) ? [] : out;
}

export const defaultVoice: AppGame = {minConf: 0.6, digits: true, sens: 1, comment: '', unknown: ''};

export const defaultPhoto: AppGame = {
	tint: '#33ff66',
	pixel: 3,
	grain: true,
	scan: true,
	stamp: true,
	stampText: 'КАМЕРА 01',
	mono: true
};

export const defaultTheme: AppGame = {
	bg: '#030803',
	panel: '#071407',
	text: '#33ff66',
	dim: '#1d8a3a',
	accent: '#a8ffbf',
	warn: '#ff4d4d',
	scanlines: true,
	glow: true,
	flicker: false,
	font: 'mono'
};

export const defaultPalette: AppGame[] = [
	{id: 'green', name: 'Зелёный', color: '#33ff66'},
	{id: 'lightgreen', name: 'Светло-зелёный', color: '#9dffb8'},
	{id: 'darkgreen', name: 'Тёмно-зелёный', color: '#22b84e'},
	{id: 'pink', name: 'Розовый', color: '#ff66c4'},
	{id: 'amber', name: 'Янтарный', color: '#ffb43a'},
	{id: 'blue', name: 'Голубой', color: '#4fd2ff'},
	{id: 'violet', name: 'Фиолетовый', color: '#b58cff'},
	{id: 'red', name: 'Красный', color: '#ff5a4a'},
	{id: 'white', name: 'Белый', color: '#dfe9df'}
];

/** Функции приложения у персонажа (MODULES_ON; «Приём сигналов» убран — П-45). */
export const appModules = ['chat', 'anon', 'delay', 'photo', 'notes', 'voice'];
/** Что видно без функции (MOD_OFF). */
export const moduleOff = ['hidden', 'denied', 'broken'];
export const voiceModes = ['off', 'button', 'screen', 'always'];
/** Действия кода и правила (ACTIONS). */
/** Сессия 38 (П16, основа 2): события самого телефона (правило on: 'phone', как SG.PHONE_SENSORS приложения). */
export const phoneSensors = ['shake', 'facedown', 'faceup', 'flip', 'locked', 'unlocked', 'away', 'photo', 'scan'];
/** Сессия 39 (П17, Т8-6 Б): когда работает правило «на телефоне» (следит служба Android — и в фоне). */
export const phoneScreens = ['', 'on', 'off'];

export const actionTypes = [
	'open',
	'notify',
	'alarm',
	'glitch',
	'fix',
	'module',
	'app',
	'chapter',
	'term',
	'event',
	'countdown',
	'vote',
	'color',
	// Сессия 38 (П16, основа 2): вспышка и короткий сигнал
	'torch',
	'beep'
];
/** Эффекты сбоя «искажение экрана». */
export const glitchEffects = [
	'noise',
	'shift',
	'blur',
	'shake',
	'tunnel',
	'dark',
	'bright',
	'tint',
	'invert',
	'scramble',
	'jam'
];
export const themeColors = ['bg', 'panel', 'text', 'dim', 'accent', 'warn'];

export function uid(prefix: string) {
	return prefix + Math.random().toString(36).slice(2, 8);
}

/** Случайный код из цифр, которого нет среди used (нормализованных). */
export function randomDigits(length: number, used: Set<string> = new Set()) {
	for (let i = 0; i < 200; i++) {
		let s = String(1 + Math.floor(Math.random() * 9));

		while (s.length < length) {
			s += String(Math.floor(Math.random() * 10));
		}
		if (!used.has(s)) {
			return s;
		}
	}
	return String(Date.now()).slice(-length);
}

export const normCode = (code: unknown) =>
	String(code ?? '')
		.replace(/\s+/g, '')
		.toUpperCase();

export function parseObject(text: string | undefined): AppGame | undefined {
	if (!text || !text.trim()) {
		return undefined;
	}
	try {
		const v = JSON.parse(text);

		return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
	} catch {
		return undefined;
	}
}

/* ----- новые записи (как «+ Добавить» в редакторе приложения) ----- */

export function newAccount(used: Set<string>): AppGame {
	return {
		id: uid('a'),
		name: '',
		profession: '',
		login: randomDigits(6, used),
		items: [],
		modules: ['chat', 'notes'],
		modState: {},
		modChapter: {},
		colors: {},
		comment: '',
		where: '',
		voiceMode: 'off'
	};
}

export function newPhoneCode(): AppGame {
	return {id: uid('k')};
}

export function newChapter(prev: AppGame | undefined, n: number, used: Set<string>): AppGame {
	return {
		id: uid('c'),
		name: `Глава ${n}`,
		code: randomDigits(5, used),
		message: '',
		theme: {...defaultTheme, ...(prev?.theme ?? {})},
		colors: Array.isArray(prev?.colors) ? [...prev!.colors] : [],
		senderColor: !!prev?.senderColor,
		colorReset: false,
		jam: 0,
		comment: '',
		where: ''
	};
}

export const newItem: Record<string, () => AppGame> = {
	apps: () => ({
		id: uid('p'),
		name: 'Градусник',
		title: '',
		hint: 'Наведите на бейдж пациента',
		who: [],
		chapter: 1,
		start: true,
		uses: 0,
		showUses: false,
		emptyText: '',
		unknown: '',
		color: ''
	}),
	notices: () => ({id: uid('n'), name: 'Уведомление', title: 'СООБЩЕНИЕ', text: '', to: [], chapter: 0, minutes: 0}),
	alarms: () => ({
		id: uid('r'),
		name: 'Авария',
		title: 'АВАРИЯ',
		text: '',
		red: true,
		full: true,
		siren: true,
		vibrate: true,
		torch: true,
		jam: true
	}),
	glitches: () => ({
		id: uid('g'),
		name: 'Сбой экрана',
		kind: 'visual',
		fx: ['noise', 'shift'],
		text: '',
		seconds: 20,
		fix: 'time',
		state: false,
		chapters: [],
		every: 0,
		who: []
	}),
	rules: () => ({id: uid('e'), name: 'Правило', on: 'event', event: '', chapter: 1, minutes: 0, chapters: [], actions: []}),
	votes: () => ({
		id: uid('v'),
		name: 'Голосование',
		title: '',
		options: ['Вариант 1', 'Вариант 2'],
		seconds: 120,
		to: [],
		every: 0,
		chapters: [],
		term: ''
	})
};

/** Пустые общие настройки для истории без приложения. */
export function newSettings(title: string): AppGame {
	return {
		format: 1,
		title,
		version: 1,
		masterCode: randomDigits(8),
		settingsCode: '0000',
		chapters: [{id: uid('c'), name: 'Глава 1', code: '', theme: {...defaultTheme}}],
		apps: [],
		notices: [],
		alarms: [],
		glitches: [],
		rules: [],
		votes: []
	};
}

/* ----- что можно выбрать в формах ----- */

export interface AppAccountRef {
	id: string;
	/** Номер сотрудника (= «Номер на терминале»). */
	num: string;
	name: string;
}

export interface AppRefs {
	chapters: Array<{n: number; name: string}>;
	accounts: AppAccountRef[];
	blocks: Array<{id: string; name: string}>;
	notices: AppGame[];
	alarms: AppGame[];
	glitches: AppGame[];
	apps: AppGame[];
	votes: AppGame[];
	palette: AppGame[];
	voice: AppGame;
	/** Сессия 35 (Т4-3): общие с телефонами переменные (StoryInit). */
	shared: Array<{name: string; label: string; value: unknown}>;
}

/** Персонажи приложения из таблицы «Коды»: id аккаунта (или n<номер>), номер, имя. */
export function accountsOf(table: CodeTable): AppAccountRef[] {
	return table.people
		.map(p => ({p, data: parseObject(p.phone)}))
		.filter(x => !!x.data)
		.map(({p, data}) => ({
			id: String(data!.id || `n${p.id}`),
			num: p.id,
			name: String(data!.name || '')
		}));
}

/** Списки для форм: главы и прочее — из пассажа «Приложение» (или settings), персонажи — из table. */
export function appRefs(passages: StoryPassage[], table: CodeTable, settings?: AppGame): AppRefs {
	const game = settings ?? readSettings(settingsPassageOf(passages)?.text ?? '').game;
	const chapters: AppGame[] = Array.isArray(game.chapters) && game.chapters.length ? game.chapters : [{name: 'Глава 1'}];
	const list = (key: string) => (Array.isArray(game[key]) ? game[key] : []);

	return {
		chapters: chapters.map((c, i) => ({n: i + 1, name: String(c.name ?? `Глава ${i + 1}`)})),
		accounts: accountsOf(table),
		blocks: passages
			.filter(p => p.tags.includes(appBlockTag))
			.map(p => readBlock(p.name, p.text, n => n))
			.filter((b): b is AppGame => !!b)
			.map(b => ({id: String(b.id), name: blockPassageName(b)}))
			.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
		notices: list('notices'),
		alarms: list('alarms'),
		glitches: list('glitches'),
		apps: list('apps'),
		votes: list('votes'),
		palette: Array.isArray(game.palette) && game.palette.length ? game.palette : defaultPalette,
		voice: {...defaultVoice, ...(game.voice ?? {})},
		shared: sharedVariables(passages.find(p => p.name === 'StoryInit')?.text ?? '')
	};
}

/* ----- голос: подсказки к словам фразы (voiceWordHints приложения) ----- */

export function voiceNorm(s: string) {
	return String(s || '')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[^a-zа-я0-9[\] ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export type VoiceHint = 'unknown' | 'latin' | 'digits' | 'abbr';

export function voiceHints(unknown: string, text: string): Array<{word: string; why: VoiceHint}> {
	const unk = new Set(
		String(unknown || '')
			.toLowerCase()
			.replace(/ё/g, 'е')
			.split(/[^a-zа-я0-9]+/)
			.filter(Boolean)
	);
	const out: Array<{word: string; why: VoiceHint}> = [];

	String(text || '')
		.split(/\s+/)
		.forEach(raw => {
			const w = voiceNorm(raw);

			if (!w) {
				return;
			}
			if (unk.has(w)) {
				out.push({word: w, why: 'unknown'});
			} else if (/[a-z]/.test(w)) {
				out.push({word: w, why: 'latin'});
			} else if (/\d/.test(w)) {
				out.push({word: w, why: 'digits'});
			} else if (w.length >= 3 && !/[аеиоуыэюя]/.test(w)) {
				out.push({word: w, why: 'abbr'});
			}
		});
	return out;
}

/* ----- первая строка блока <<app-block …>> (кнопка «Блок приложения») ----- */

export interface BlockHead {
	id: string;
	/** Номера персонажей (П-61 Т2-7). */
	who: string[];
	chapter: number;
	start: boolean;
	share: boolean;
	/** Сессия 39 (П17, Т8-5 А): скрытый — только кодом, в списке не виден. */
	hidden?: boolean;
	garble: number;
	/** Остальные слова строки (title, folder, more) — без изменений. */
	rest: string[];
}

const headRe = /^\s*<<app-block(?=[\s>])/;

export function hasBlockHead(text: string) {
	return headRe.test(text.split('\n', 1)[0]);
}

const val = (t: string | undefined) => (t === undefined ? undefined : (plain(t) ?? t));

export function readBlockHead(text: string): BlockHead | undefined {
	const line = text.split('\n', 1)[0];
	const m = headRe.exec(line);

	if (!m) {
		return undefined;
	}

	const words = scanArgs(line, m[0].length)?.tokens ?? [];
	const head: BlockHead = {
		id: String(val(words.shift()) ?? ''),
		who: [],
		chapter: 1,
		start: false,
		share: false,
		garble: 0,
		rest: []
	};

	while (words.length) {
		const w = words.shift()!;

		if (w === 'start' || w === 'share' || w === 'hidden') {
			head[w] = true;
		} else if (w === 'who' && words.length) {
			head.who = String(val(words.shift()) ?? '')
				.split(',')
				.map(s => s.trim())
				.filter(Boolean);
		} else if ((w === 'chapter' || w === 'garble') && words.length) {
			head[w] = Number(val(words.shift())) || (w === 'chapter' ? 1 : 0);
		} else if ((w === 'title' || w === 'folder' || w === 'more') && words.length) {
			head.rest.push(w, words.shift()!);
		} else {
			head.rest.push(w);
		}
	}
	return head;
}

export function blockHeadLine(head: BlockHead) {
	const words = [arg(head.id)];

	if (head.who.length) {
		words.push('who', arg(head.who.join(', ')));
	}
	if (head.chapter > 1) {
		words.push('chapter', String(head.chapter));
	}
	if (head.start) {
		words.push('start');
	}
	if (head.share) {
		words.push('share');
	}
	if (head.hidden) {
		words.push('hidden');
	}
	if (head.garble) {
		words.push('garble', String(head.garble));
	}
	words.push(...head.rest);
	return `<<app-block ${words.join(' ')}>>`;
}

/** Текст пассажа с новой первой строкой блока (нет строки — добавляется сверху). */
export function writeBlockHead(text: string, head: BlockHead) {
	const line = blockHeadLine(head);

	if (hasBlockHead(text)) {
		const nl = text.indexOf('\n');

		return nl === -1 ? line : line + text.slice(nl);
	}
	return text === '' ? line + '\n' : `${line}\n${text}`;
}

/** Убрать первую строку блока (текст остаётся). */
export function removeBlockHead(text: string) {
	if (!hasBlockHead(text)) {
		return text;
	}

	const nl = text.indexOf('\n');

	return nl === -1 ? '' : text.slice(nl + 1);
}

/** id для нового блока, которого ещё нет в истории. */
export function newBlockId(passages: StoryPassage[]) {
	const taken = new Set(
		passages.filter(p => p.tags.includes(appBlockTag)).map(p => readBlockHead(p.text)?.id ?? '')
	);
	let id = uid('b');

	while (taken.has(id)) {
		id = uid('b');
	}
	return id;
}

/* ----- картинки и звук блока: строки <<app-img …>> и <<app-audio …>> ----- */

export interface BlockMedia {
	/** Номер строки в тексте пассажа. */
	line: number;
	type: 'image' | 'audio';
	/** Имя файла в media/app/ (или путь, как записан). */
	file: string;
	/** Подпись картинки или название звука. */
	caption: string;
	/** Слово more '{…}' — без изменений. */
	more: string[];
}

const mediaRe = /^<<app-(img|audio)(\s[^\n]*)?>>[ \t]*$/;

export function blockMedia(text: string): BlockMedia[] {
	const out: BlockMedia[] = [];

	text.split('\n').forEach((line, i) => {
		if (i === 0 && hasBlockHead(text)) {
			return;
		}

		const m = mediaRe.exec(line);

		if (!m) {
			return;
		}

		const t = scanArgs(line, line.indexOf(m[1]) + m[1].length)?.tokens ?? [];
		const moreAt = t.indexOf('more');
		const more = moreAt === -1 ? [] : t.splice(moreAt, 2);
		const path = String(val(t[0]) ?? '');

		out.push({
			line: i,
			type: m[1] === 'img' ? 'image' : 'audio',
			file: path.startsWith(appMediaDir) ? path.slice(appMediaDir.length) : path,
			caption: String(val(t[1]) ?? ''),
			more
		});
	});
	return out;
}

export function mediaLine(item: Pick<BlockMedia, 'type' | 'file' | 'caption' | 'more'>) {
	const path = item.file && !item.file.includes('/') ? appMediaDir + item.file : item.file;
	const words = [arg(path), arg(item.caption), ...item.more];

	return `<<app-${item.type === 'image' ? 'img' : 'audio'} ${words.join(' ')}>>`;
}

/** Заменить (item) или убрать (undefined) строку картинки или звука. */
export function setBlockMedia(text: string, line: number, item: BlockMedia | undefined) {
	const lines = text.split('\n');

	if (item) {
		lines[line] = mediaLine(item);
	} else {
		lines.splice(line, 1);
	}
	return lines.join('\n');
}

/** Добавить строку картинки или звука в конец текста. */
export function addBlockMedia(
	text: string,
	item: Pick<BlockMedia, 'type' | 'file' | 'caption'>,
	at?: {line: number; ch: number}
) {
	const line = mediaLine({...item, more: []});

	// Сессия 34 (ответ Т3-10 А): туда, где курсор — перед строкой, если курсор в её начале, иначе после неё;
	// не выше первой строки блока. Без курсора — в конец текста, как раньше.
	if (at && text !== '') {
		const lines = text.split('\n');
		let index = at.ch === 0 ? at.line : at.line + 1;

		if (index < 1) {
			index = 1;
		}
		if (index < lines.length || (index === lines.length && !text.endsWith('\n'))) {
			lines.splice(Math.min(index, lines.length), 0, line);
			return lines.join('\n');
		}
	}
	return text.endsWith('\n') || text === '' ? text + line + '\n' : `${text}\n${line}\n`;
}

/** Блоки, которые открывают коды телефона (по id блока): код → подпись. */
export function codesOpening(table: CodeTable, blockId: string) {
	return table.codes
		.filter(e => e.where === 'phone' || e.where === 'both')
		.filter(e => {
			const d = parseObject(e.phone);
			const has = (list: unknown) => Array.isArray(list) && list.includes(blockId);

			return (
				!!d &&
				(has(d.opens) ||
					has(d.deniedOpens) ||
					(Array.isArray(d.variants) && d.variants.some((v: AppGame) => has(v?.opens))) ||
					(Array.isArray(d.actions) && d.actions.some((a: AppGame) => a?.type === 'open' && has(a.blocks))))
			);
		})
		.map(e => (e.code || (parseObject(e.phone)?.voice ? `🎙 ${parseObject(e.phone)!.voice}` : '—')) + (e.label ? ` — ${e.label}` : ''));
}

/* ----- вкладка «Блоки»: папки блоков деревом (сессия 34, ответ Т3-11 А) ----- */

export interface BlockEntry<P extends StoryPassage = StoryPassage & {id: string}> {
	passage: P;
	id: string;
	/** Папка «А/Б» (из названия пассажа или слова folder). */
	folder: string;
	title: string;
	/** Папка задана словом folder в первой строке (не названием пассажа). */
	ownFolder: boolean;
}

export interface FolderNode {
	path: string;
	name: string;
	folders: FolderNode[];
	blocks: BlockEntry<StoryPassage & {id: string}>[];
	/** Блоков в папке со всеми подпапками. */
	count: number;
}

function restWord(rest: string[], word: string) {
	const i = rest.indexOf(word);

	return i >= 0 && i + 1 < rest.length ? String(val(rest[i + 1]) ?? '') : undefined;
}

export function blockEntries<P extends StoryPassage>(passages: P[]): BlockEntry<P>[] {
	return passages
		.filter(p => p.tags.includes(appBlockTag) && hasBlockHead(p.text))
		.map(p => {
			const head = readBlockHead(p.text)!;
			const parts = p.name.split('/');
			const fromName = parts.pop() ?? '';
			const folder = restWord(head.rest, 'folder');
			const title = restWord(head.rest, 'title');

			return {
				passage: p,
				id: head.id,
				folder: folder ?? parts.join('/'),
				title: title ?? fromName,
				ownFolder: folder !== undefined
			};
		});
}

/** Дерево папок; блоки внутри — по названию. */
export function blockTree(passages: Array<StoryPassage & {id: string}>): FolderNode {
	const root: FolderNode = {path: '', name: '', folders: [], blocks: [], count: 0};
	const node = (path: string): FolderNode => {
		let cur = root;

		path.split('/')
			.filter(Boolean)
			.forEach((name, i, all) => {
				const p = all.slice(0, i + 1).join('/');
				let next = cur.folders.find(f => f.path === p);

				if (!next) {
					next = {path: p, name, folders: [], blocks: [], count: 0};
					cur.folders.push(next);
				}
				cur = next;
			});
		return cur;
	};

	blockEntries(passages).forEach(b => node(b.folder).blocks.push(b));

	const finish = (n: FolderNode): number => {
		n.folders.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
		n.blocks.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
		n.count = n.blocks.length + n.folders.reduce((s, f) => s + finish(f), 0);
		return n.count;
	};

	finish(root);
	return root;
}

function withWord(rest: string[], word: string, value: string) {
	const out = rest.slice();
	const i = out.indexOf(word);

	if (i >= 0 && i + 1 < out.length) {
		out[i + 1] = arg(value);
	} else {
		out.push(word, arg(value));
	}
	return out;
}

/** Свободное имя пассажа: «имя», «имя (2)»… */
function freeName(name: string, taken: Set<string>) {
	if (!taken.has(name)) {
		return name;
	}

	let n = 2;

	while (taken.has(`${name} (${n})`)) {
		n++;
	}
	return `${name} (${n})`;
}

export interface PassageChange {
	id: string;
	name?: string;
	text?: string;
}

/** Переименовать папку целиком (с подпапками): названия пассажей или слово folder. */
export function renameFolder(passages: Array<StoryPassage & {id: string}>, from: string, to: string): PassageChange[] {
	const clean = (s: string) =>
		s
			.split('/')
			.map(x => x.trim())
			.filter(Boolean)
			.join('/');
	const src = clean(from);
	const dst = clean(to);

	if (!src || src === dst) {
		return [];
	}

	const inside = blockEntries(passages).filter(b => b.folder === src || b.folder.startsWith(src + '/'));
	const moving = new Set(inside.map(b => b.passage.id));
	const taken = new Set(passages.filter(p => !moving.has(p.id)).map(p => p.name));

	return inside.map(b => {
		const folder = dst + b.folder.slice(src.length);
		const head = readBlockHead(b.passage.text)!;

		if (b.ownFolder) {
			taken.add(b.passage.name);
			return {id: b.passage.id, text: writeBlockHead(b.passage.text, {...head, rest: withWord(head.rest, 'folder', folder)})};
		}

		const want = folder ? `${folder}/${b.title}` : b.title;
		const name = freeName(want, taken);

		taken.add(name);
		if (name === want) {
			return {id: b.passage.id, name};
		}
		// Имя занято — к названию « (2)», настоящие папка и название — словами (как при загрузке пакета).
		return {
			id: b.passage.id,
			name,
			text: writeBlockHead(b.passage.text, {...head, rest: withWord(withWord(head.rest, 'title', b.title), 'folder', folder)})
		};
	});
}

/** Новый блок в папке: имя пассажа и текст с первой строкой. */
export function newBlockIn(passages: StoryPassage[], folder: string, title: string) {
	const taken = new Set(passages.map(p => p.name));
	const t = title.trim() || 'Новый блок';
	const want = (folder ? `${folder}/` : '') + t;
	const id = newBlockId(passages);
	const name = freeName(want, taken);
	const rest = name === want ? [] : withWord(withWord([], 'title', t), 'folder', folder);

	return {name, id, text: blockHeadLine({id, who: [], chapter: 1, start: false, share: false, garble: 0, rest}) + '\n'};
}
