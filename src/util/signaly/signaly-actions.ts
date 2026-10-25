// «Twine СИГНАЛЫ»: действия ссылок и кнопок (шаг 3.2, ответы автора 1А–6А).
// Ссылка или кнопка — обычная команда SugarCube 2.37:
//   <<link "Надпись" "Экран">>действия<</link>>, <<button …>>…<</button>>,
//   [[Надпись|Экран]] и [[Надпись|Экран][$x to 1]].
// Действия — команды внутри, по порядку; потом переход на экран (если задан):
//   изменить переменную  — <<set $x to 2>>, <<set $x += 1>>, <<set $x -= 1>>, <<set $x to !$x>>
//   звук                 — <<audio "кто" volume 0.1 loop play>>, <<playlist "имя" skip>>
//   открыть окно         — <<sg-open "Заголовок" passage "Экран">>текст<</sg-open>>
//   запустить таймер     — <<sg-timer "Имя" minutes 1 goto "Экран" hidden>>
//   остановить таймер    — <<sg-timer-stop "Имя">>
//   звук-сигнал          — <<sg-sound "media/audio/x.wav" volume 100 [keep]>> (шаг 3.3)
//   если … то … иначе    — <<if $x is 1>>действия<<else>>действия<</if>> (шаг 3.3)
//   через N секунд       — <<timed 8s>>действия<</timed>> (шаг 3.3)
// Чего форма не понимает, остаётся строкой «код» как есть. Нетронутое действие
// записывается дословно (raw), поэтому открыть и закрыть форму ничего не меняет.

import {arg, markupSafe, parseMarkup, plain} from './signaly-link-form';
import {findConditions} from './signaly-logic';
import {findBlocks, findClose, scanArgs, Values, writeBlockHead} from './signaly-screen-blocks';
import {literal, parseLiteral, VarValue} from './signaly-variables';

/* ----- Действия ----- */

export type SetOp = 'to' | 'add' | 'sub' | 'toggle';

export interface SetAction {
	type: 'set';
	/** Имя переменной без «$». */
	name: string;
	op: SetOp;
	value?: VarValue;
	raw?: string;
}

/** Кто звучит: файл, группа, плейлист или «все играющие / на паузе, кроме группы». */
export type AudioWho =
	| {kind: 'track' | 'group' | 'playlist'; id: string}
	| {kind: 'playing' | 'paused' | 'all'; except?: string}
	| {kind: 'other'; selector: string};

/** play, pause, stop; fade — плавно к уровню; skip — следующий трек плейлиста; '' — только настройки. */
export type AudioAct = 'play' | 'pause' | 'stop' | 'fade' | 'skip' | '';

export interface AudioAction {
	type: 'audio';
	who: AudioWho;
	act: AudioAct;
	/** Уровень 0–1 для fade. */
	level?: number;
	/** За сколько секунд (fade); нет — 5 с, как в SugarCube. */
	over?: number;
	/** Громкость 0–1. */
	volume?: number;
	/** Перемотать на секунду (только файлы и группы). */
	time?: number;
	loop?: boolean;
	raw?: string;
}

export type DialogClose = '' | 'ok' | 'time';

export interface DialogAction {
	type: 'dialog';
	title: string;
	passage: string;
	text: string;
	close: DialogClose;
	seconds?: number;
	ok?: string;
	raw?: string;
}

export interface TimerAction {
	type: 'timer';
	/** Слова блока «Таймер» (имя, время, что по окончании). */
	values: Values;
	extra: string[];
	raw?: string;
}

export interface TimerStopAction {
	type: 'stop';
	name: string;
	raw?: string;
}

export interface CodeAction {
	type: 'code';
	code: string;
	raw?: string;
}

/**
 * Звук-сигнал (шаг 3.3, ответ 3А): файл из папки игры мимо групп и громкости
 * A–E. keep — не начинать заново, если ещё звучит.
 */
export interface SignalAction {
	type: 'signal';
	src: string;
	/** Громкость 0–100 %. */
	volume: number;
	keep: boolean;
	raw?: string;
}

/** «Если … то … иначе …» (шаг 3.3, ответ 7А). */
export interface IfAction {
	type: 'if';
	/** Условие, как написано после if. */
	expr: string;
	then: Action[];
	/** «Иначе»; undefined — его нет. */
	else?: Action[];
	multiline: boolean;
	raw?: string;
}

/**
 * «Прогресс вводящего +N» (шаг 3.4, ответ 4А) — только в общей таблице кодов:
 * прибавляет N к переменной прогресса того сотрудника, кто ввёл код.
 */
export interface ProgressAction {
	type: 'progress';
	amount: number;
	raw?: string;
}

/** «Через N секунд» (шаг 3.3, ответ 7А) — <<timed>>. */
export interface DelayAction {
	type: 'delay';
	seconds: number;
	actions: Action[];
	multiline: boolean;
	raw?: string;
}

export type Action =
	| SetAction
	| AudioAction
	| SignalAction
	| DialogAction
	| TimerAction
	| TimerStopAction
	| IfAction
	| DelayAction
	| ProgressAction
	| CodeAction;
export type ActionType = Action['type'];

/* ----- Разбор действий ----- */

const name = '([A-Za-z_]\\w*)';
const setRe = new RegExp(`^<<set\\s+\\$${name}\\s+(to|=|\\+=|-=)\\s+([^]*?)\\s*>>$`);

function parseSet(piece: string): SetAction | undefined {
	const m = setRe.exec(piece);

	if (!m) {
		return undefined;
	}

	const [, n, op, rest] = m;
	const toggle = new RegExp(`^(?:!\\s*|not\\s+)\\$${n}$`).exec(rest);

	if ((op === 'to' || op === '=') && toggle) {
		return {type: 'set', name: n, op: 'toggle', raw: piece};
	}

	const value = parseLiteral(rest);

	if (value === undefined) {
		return undefined;
	}
	if (op === '+=' || op === '-=') {
		return typeof value === 'number'
			? {type: 'set', name: n, op: op === '+=' ? 'add' : 'sub', value, raw: piece}
			: undefined;
	}
	return {type: 'set', name: n, op: 'to', value, raw: piece};
}

/** Выражение из [[…][выражение]] — то же, что в <<set>>. */
function parseSetter(setter: string): SetAction | undefined {
	const set = parseSet(`<<set ${setter.trim()}>>`);

	return set && {...set, raw: undefined};
}

export function parseWho(selector: string, playlist: boolean): AudioWho {
	if (playlist) {
		return {kind: 'playlist', id: selector};
	}

	const multi = /^:(playing|paused|all)(?::not\(:([^\s:()]+)\))?$/.exec(selector);

	if (multi) {
		return {kind: multi[1] as 'playing' | 'paused' | 'all', ...(multi[2] ? {except: ':' + multi[2]} : {})};
	}
	if (/^:[^\s:()]+$/.test(selector) && !/^:(playing|paused|stopped|all|looped|muted)$/.test(selector)) {
		return {kind: 'group', id: selector};
	}
	// Имя файла в окне «Звуки» — любое, без пробелов, двоеточий и скобок.
	if (/^[^\s:()]*$/.test(selector)) {
		return {kind: 'track', id: selector};
	}
	return {kind: 'other', selector};
}

export function writeWho(who: AudioWho) {
	switch (who.kind) {
		case 'track':
		case 'group':
		case 'playlist':
			return who.id;
		case 'other':
			return who.selector;
		default:
			return `:${who.kind}${who.except ? `:not(${who.except})` : ''}`;
	}
}

function parseAudio(piece: string): AudioAction | undefined {
	const m = /^<<(audio|playlist)\s/.exec(piece);

	if (!m) {
		return undefined;
	}

	const head = scanArgs(piece, m[0].length - 1);

	if (!head || head.end !== piece.length || head.tokens.length < 2) {
		return undefined;
	}

	const selector = plain(head.tokens[0]);

	if (selector === undefined) {
		return undefined;
	}

	const playlist = m[1] === 'playlist';
	const action: AudioAction = {type: 'audio', who: parseWho(selector, playlist), act: '', raw: piece};
	const words = head.tokens.slice(1);
	const num = () => {
		const n = Number(words.shift());

		return isFinite(n) ? n : NaN;
	};
	const setAct = (act: AudioAct) => {
		if (action.act !== '') {
			return false;
		}
		action.act = act;
		return true;
	};

	while (words.length) {
		const word = words.shift()!;
		let ok = true;

		switch (word) {
			case 'play':
			case 'pause':
			case 'stop':
				ok = setAct(word);
				break;
			case 'skip':
				ok = playlist && setAct('skip');
				break;
			case 'fadein':
			case 'fadeout':
				ok = setAct('fade');
				action.level = word === 'fadein' ? 1 : 0;
				break;
			case 'fadeto':
				ok = setAct('fade');
				action.level = num();
				break;
			case 'fadeoverto':
				ok = setAct('fade');
				action.over = num();
				action.level = num();
				break;
			case 'volume':
				action.volume = num();
				break;
			case 'time':
				ok = !playlist;
				action.time = num();
				break;
			case 'loop':
			case 'unloop':
				action.loop = word === 'loop';
				break;
			default:
				ok = false;
		}
		if (!ok || [action.level, action.over, action.volume, action.time].some(v => v !== undefined && isNaN(v))) {
			return undefined;
		}
	}
	return action;
}

/** Окно-сообщение, как в PRCDTEST шаблона: <<script>>Dialog.create(…) … Dialog.open();<</script>>. */
const scriptDialogRe =
	/^<<script>>\s*Dialog\.create\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*\);?\s*Dialog\.(wikiPassage|wiki)\(\s*(["'])((?:\\.|(?!\4).)*)\4\s*\);?\s*Dialog\.open\(\s*\);?\s*<<\/script>>$/;

function unescape(s: string) {
	return s.replace(/\\(.)/g, '$1');
}

function parseDialog(piece: string): DialogAction | undefined {
	const script = scriptDialogRe.exec(piece);

	if (script) {
		const passage = script[3] === 'wikiPassage';

		return {
			type: 'dialog',
			title: unescape(script[2]),
			passage: passage ? unescape(script[5]) : '',
			text: passage ? '' : unescape(script[5]),
			close: '',
			raw: piece
		};
	}
	if (!piece.startsWith('<<sg-open')) {
		return undefined;
	}

	const head = scanArgs(piece, '<<sg-open'.length);
	const close = head && findClose(piece, 'sg-open', head.end);

	if (!head || !close || close.end !== piece.length) {
		return undefined;
	}

	const tokens = head.tokens.slice();
	const result: DialogAction = {type: 'dialog', title: '', passage: '', text: '', close: '', raw: piece};

	if (tokens.length && !['passage', 'close', 'seconds', 'ok'].includes(tokens[0])) {
		const title = plain(tokens.shift());

		if (title === undefined) {
			return undefined;
		}
		result.title = title;
	}
	while (tokens.length) {
		const word = tokens.shift()!;
		const value = tokens.shift();

		if (value === undefined) {
			return undefined;
		}
		if (word === 'passage' || word === 'ok') {
			const v = plain(value);

			if (v === undefined) {
				return undefined;
			}
			result[word] = v;
		} else if (word === 'close' && (value === 'ok' || value === 'time')) {
			result.close = value;
		} else if (word === 'seconds' && isFinite(Number(value))) {
			result.seconds = Number(value);
		} else {
			return undefined;
		}
	}
	result.text = piece
		.slice(head.end, close.at)
		.replace(/^[ \t]*\n/, '')
		.replace(/\n\s*$/, '');
	return result;
}

function parseTimer(piece: string): TimerAction | TimerStopAction | undefined {
	const stop = /^<<sg-timer-stop\s+(["'][^]*["'])\s*>>$/.exec(piece);

	if (stop) {
		const n = plain(stop[1]);

		return n === undefined ? undefined : {type: 'stop', name: n, raw: piece};
	}

	const blocks = findBlocks(piece);
	const block = blocks[0];

	if (
		blocks.length !== 1 ||
		block.type !== 'timer' ||
		block.from !== 0 ||
		block.to !== piece.length ||
		block.values.start === 'running'
	) {
		return undefined;
	}
	return {type: 'timer', values: block.values, extra: block.extra, raw: piece};
}

function parseSignal(piece: string): SignalAction | undefined {
	if (!/^<<sg-sound\s/.test(piece)) {
		return undefined;
	}

	const head = scanArgs(piece, '<<sg-sound'.length);
	const src = head && plain(head.tokens[0]);

	if (!head || head.end !== piece.length || src === undefined) {
		return undefined;
	}

	const result: SignalAction = {type: 'signal', src, volume: 100, keep: false, raw: piece};
	const words = head.tokens.slice(1);

	while (words.length) {
		const word = words.shift();

		if (word === 'keep') {
			result.keep = true;
		} else if (word === 'volume' && words.length && isFinite(Number(words[0]))) {
			result.volume = Number(words.shift());
		} else {
			return undefined;
		}
	}
	return result;
}

function parseIf(piece: string): IfAction | undefined {
	if (!/^<<if\s/.test(piece)) {
		return undefined;
	}

	const cond = findConditions(piece).find(c => c.from === 0);

	if (!cond || cond.to !== piece.length) {
		return undefined;
	}

	const end = piece.length - '<</if>>'.length;

	return {
		type: 'if',
		expr: cond.expr,
		then: splitBody(piece.slice(cond.contentFrom, cond.contentTo)).map(parseAction),
		...(cond.elseContentFrom !== undefined
			? {else: splitBody(piece.slice(cond.elseContentFrom, end)).map(parseAction)}
			: {}),
		multiline: piece.includes('\n'),
		raw: piece
	};
}

/** Время <<timed>> в секундах: 8s, 1.5s, 500ms; undefined — не понять. */
export function timeSeconds(word: string) {
	const m = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/i.exec(word);

	return m ? Number(m[1]) / (m[2].toLowerCase() === 'ms' ? 1000 : 1) : undefined;
}

function parseDelay(piece: string): DelayAction | undefined {
	if (!/^<<timed\s/.test(piece)) {
		return undefined;
	}

	const head = scanArgs(piece, '<<timed'.length);
	const close = head && findClose(piece, 'timed', head.end);
	const seconds = head && head.tokens.length === 1 ? timeSeconds(head.tokens[0]) : undefined;

	if (!head || !close || close.end !== piece.length || seconds === undefined) {
		return undefined;
	}

	const pieces = splitBody(piece.slice(head.end, close.at));

	// <<next>> — цепочка «через N, потом через M» — пока строкой «Код».
	if (pieces.some(p => /^<<next[\s>]/.test(p))) {
		return undefined;
	}
	return {type: 'delay', seconds, actions: pieces.map(parseAction), multiline: piece.includes('\n'), raw: piece};
}

function parseProgress(piece: string): ProgressAction | undefined {
	const m = /^<<sg-progress(?:\s+(-?\d+(?:\.\d+)?))?\s*>>$/.exec(piece);

	return m ? {type: 'progress', amount: m[1] === undefined ? 1 : Number(m[1]), raw: piece} : undefined;
}

/** Одна команда (или кусок кода) внутри ссылки → действие. */
export function parseAction(piece: string): Action {
	return (
		parseSet(piece) ??
		parseAudio(piece) ??
		parseSignal(piece) ??
		parseDialog(piece) ??
		parseTimer(piece) ??
		parseIf(piece) ??
		parseDelay(piece) ??
		parseProgress(piece) ?? {type: 'code', code: piece, raw: piece}
	);
}

/** Список действий в тексте: по одному на строке или подряд. */
export function writeActions(actions: Action[], multiline: boolean) {
	const list = actions.map(writeAction);

	if (multiline || list.length > 1) {
		return list.length ? `\n${list.join('\n')}\n` : '\n';
	}
	return list.join('');
}

/** Куски тела ссылки: команды (парные — вместе с закрывающей) и прочий текст. */
export function splitBody(body: string): string[] {
	const pieces: string[] = [];
	let i = 0;

	while (i < body.length) {
		if (/\s/.test(body[i])) {
			i++;
			continue;
		}

		const start = i;

		if (body.startsWith('/*', i)) {
			const end = body.indexOf('*/', i + 2);

			i = end === -1 ? body.length : end + 2;
		} else if (body.startsWith('<!--', i)) {
			const end = body.indexOf('-->', i + 4);

			i = end === -1 ? body.length : end + 3;
		} else {
			const macro = /^<<([A-Za-z][\w-]*|=|-)/.exec(body.slice(i));
			const head = macro && scanArgs(body, i + macro[0].length);

			if (macro && head) {
				const close = findClose(body, macro[1].replace(/[-=]/g, '\\$&'), head.end);

				i = close ? close.end : head.end;
			} else {
				// Обычный текст — до следующей команды.
				const next = ['<<', '/*', '<!--']
					.map(m => body.indexOf(m, i + 1))
					.filter(n => n !== -1);

				i = next.length ? Math.min(...next) : body.length;
				while (i > start && /\s/.test(body[i - 1])) {
					i--;
				}
			}
		}
		pieces.push(body.slice(start, i));
	}
	return pieces;
}

/* ----- Запись действий ----- */

function percent(level: number) {
	return Number(level.toFixed(4));
}

export function writeAction(action: Action): string {
	if (action.raw !== undefined) {
		return action.raw;
	}
	switch (action.type) {
		case 'set': {
			const v = `$${action.name}`;

			if (action.op === 'toggle') {
				return `<<set ${v} to !${v}>>`;
			}
			if (action.op === 'add' || action.op === 'sub') {
				return `<<set ${v} ${action.op === 'add' ? '+=' : '-='} ${Number(action.value) || 0}>>`;
			}
			return `<<set ${v} to ${literal(action.value ?? 0)}>>`;
		}
		case 'audio': {
			const playlist = action.who.kind === 'playlist';
			const words = [arg(writeWho(action.who))];

			if (action.volume !== undefined) {
				words.push('volume', String(percent(action.volume)));
			}
			if (action.time !== undefined && !playlist) {
				words.push('time', String(action.time));
			}
			if (action.loop !== undefined) {
				words.push(action.loop ? 'loop' : 'unloop');
			}
			if (action.act === 'fade') {
				const level = String(percent(action.level ?? 1));

				words.push(...(action.over !== undefined ? ['fadeoverto', String(action.over), level] : ['fadeto', level]));
			} else if (action.act !== '' && (action.act !== 'skip' || playlist)) {
				words.push(action.act);
			}
			return `<<${playlist ? 'playlist' : 'audio'} ${words.join(' ')}>>`;
		}
		case 'dialog': {
			const words = [arg(action.title)];

			if (action.passage) {
				words.push('passage', arg(action.passage));
			}
			if (action.close) {
				words.push('close', action.close);
			}
			if (action.close === 'ok' && action.ok) {
				words.push('ok', arg(action.ok));
			}
			if (action.close === 'time' && action.seconds !== undefined) {
				words.push('seconds', String(action.seconds));
			}
			return `<<sg-open ${words.join(' ')}>>${action.passage ? '' : action.text}<</sg-open>>`;
		}
		case 'timer':
			return writeBlockHead('timer', {...action.values, start: undefined, hidden: true}, action.extra);
		case 'stop':
			return `<<sg-timer-stop ${arg(action.name)}>>`;
		case 'signal':
			return `<<sg-sound ${arg(action.src)} volume ${Number(action.volume.toFixed(1))}${action.keep ? ' keep' : ''}>>`;
		case 'if': {
			const multiline =
				action.multiline || action.then.length > 1 || (action.else !== undefined && action.else.length > 1);

			return (
				`<<if ${action.expr.trim()}>>${writeActions(action.then, multiline)}` +
				(action.else !== undefined ? `<<else>>${writeActions(action.else, multiline)}` : '') +
				'<</if>>'
			);
		}
		case 'delay':
			return `<<timed ${Number(action.seconds.toFixed(3))}s>>${writeActions(action.actions, action.multiline)}<</timed>>`;
		case 'progress':
			return `<<sg-progress ${Number(action.amount) || 0}>>`;
		default:
			return action.code;
	}
}

/** Выражение для [[…][…]]; undefined — действие так не записать. */
function writeSetter(action: Action) {
	if (action.type !== 'set') {
		return undefined;
	}
	if (action.raw !== undefined) {
		const m = /^<<set\s+([^]*?)\s*>>$/.exec(action.raw);

		return m ? m[1] : undefined;
	}
	return writeAction(action).slice('<<set '.length, -2);
}

/* ----- Ссылки и кнопки ----- */

export interface LinkItem {
	/** Где ссылка в тексте (целиком, с закрывающей командой). */
	from: number;
	to: number;
	/** Записана разметкой [[…]]. */
	markup: boolean;
	form: 'link' | 'button';
	/** Надпись; undefined — задана кодом (переменной, картинкой). */
	label?: string;
	/** Экран после действий; '' — остаться. */
	passage: string;
	/** Голова записана кодом, который форма не меняет (надпись и экран не правятся). */
	headCode?: string;
	actions: Action[];
	/** Действия — каждое на своей строке. */
	multiline: boolean;
	/** Где начинаются действия (для щелчка по ссылке в тексте). */
	bodyFrom?: number;
	/** Разметка была без «|» ([[Экран]]). */
	samePassage?: boolean;
	/** Как было написано: без правок ссылка записывается дословно. */
	source?: {
		raw: string;
		head: string;
		body: string;
		pieces: string[];
		form: 'link' | 'button';
		label?: string;
		passage: string;
	};
}

const linkRe = /<<(link|button)(?=[\s>])/g;

function parseMacroLink(text: string, match: RegExpExecArray): LinkItem | undefined {
	const form = match[1] as 'link' | 'button';
	const head = scanArgs(text, match.index + match[0].length);

	if (!head) {
		return undefined;
	}

	const close = findClose(text, form, head.end);

	if (!close) {
		return undefined;
	}

	const body = text.slice(head.end, close.at);
	const pieces = splitBody(body);
	const item: LinkItem = {
		from: match.index,
		to: close.end,
		markup: false,
		form,
		passage: '',
		actions: pieces.map(parseAction),
		multiline: body.includes('\n'),
		bodyFrom: head.end
	};
	const tokens = head.tokens;
	const label = plain(tokens[0]);
	const passage = tokens.length > 1 ? plain(tokens[1]) : '';

	if (tokens.length >= 1 && tokens.length <= 2 && label !== undefined && passage !== undefined) {
		item.label = label;
		item.passage = passage;
	} else if (tokens.length === 1 && tokens[0].startsWith('[[')) {
		// <<link [[Надпись|Экран]]>>
		const markup = parseMarkup(tokens[0], 0);

		if (markup && markup.setters.length === 0 && markup.end === tokens[0].length) {
			item.label = markup.label;
			item.passage = markup.passage;
		} else {
			item.headCode = text.slice(match.index, head.end);
		}
	} else {
		item.headCode = text.slice(match.index, head.end);
	}
	item.source = {
		raw: text.slice(item.from, item.to),
		head: text.slice(match.index, head.end),
		body,
		pieces,
		form,
		label: item.label,
		passage: item.passage
	};
	return item;
}

/** Все ссылки и кнопки текста (и вложенные). */
export function findLinks(text: string): LinkItem[] {
	const items: LinkItem[] = [];
	let match: RegExpExecArray | null;

	linkRe.lastIndex = 0;
	while ((match = linkRe.exec(text))) {
		const item = parseMacroLink(text, match);

		if (item) {
			items.push(item);
		}
	}

	const markupRe = /\[\[/g;

	while ((match = markupRe.exec(text))) {
		const at = match.index;

		// [[…]] внутри <<link [[…]]>> — часть головы.
		if (items.some(item => at > item.from && item.bodyFrom !== undefined && at < item.bodyFrom)) {
			continue;
		}

		const parsed = parseMarkup(text, at);

		if (!parsed) {
			continue;
		}

		const setters = parsed.setters.map(parseSetter);
		const raw = text.slice(at, parsed.end);
		const link = raw.slice(2, raw.indexOf(']'));

		items.push({
			from: at,
			to: parsed.end,
			markup: true,
			form: 'link',
			label: parsed.label,
			passage: parsed.passage,
			actions: parsed.setters.map(
				(s, i): Action =>
					setters[i] ? {...setters[i]!, raw: `<<set ${s}>>`} : {type: 'code', code: `<<set ${s}>>`}
			),
			multiline: false,
			samePassage: !/\||->|<-/.test(link),
			source: {
				raw,
				head: raw,
				body: '',
				pieces: parsed.setters.map(s => `<<set ${s}>>`),
				form: 'link',
				label: parsed.label,
				passage: parsed.passage
			}
		});
		markupRe.lastIndex = parsed.end;
	}
	return items.sort((a, b) => a.from - b.from);
}

/** Можно ли записать ссылку разметкой [[…]] (ответ 6А). */
export function fitsMarkup(item: Pick<LinkItem, 'label' | 'passage' | 'actions' | 'form' | 'headCode'>) {
	return (
		item.form === 'link' &&
		item.headCode === undefined &&
		item.label !== undefined &&
		markupSafe(item.label) &&
		markupSafe(item.passage) &&
		item.actions.length <= 1 &&
		item.actions.every(a => writeSetter(a) !== undefined)
	);
}

/** Текст ссылки по её описанию. */
export function writeLink(item: Omit<LinkItem, 'from' | 'to'>) {
	const src = item.source;
	const actions = item.actions.map(writeAction);
	const sameHead =
		src !== undefined && src.form === item.form && src.label === item.label && src.passage === item.passage;
	const sameBody = src !== undefined && actions.length === src.pieces.length && actions.every((a, i) => a === src.pieces[i]);

	if (item.markup && sameHead && sameBody) {
		return src!.raw;
	}
	if (item.markup && fitsMarkup(item)) {
		const link =
			item.label === item.passage && item.samePassage !== false ? item.passage : `${item.label}|${item.passage}`;
		const setter = item.actions.length ? `[${writeSetter(item.actions[0])}]` : '';

		return `[[${link}]${setter}]`;
	}

	const head =
		sameHead && !item.markup
			? src!.head
			: item.headCode !== undefined
			? `<<${item.form}${item.headCode.replace(/^<<(?:link|button)/, '')}`
			: `<<${item.form} ${arg(item.label ?? '')}${item.passage ? ` ${arg(item.passage)}` : ''}>>`;
	const multiline = item.multiline || actions.length > 1;
	const body =
		sameBody && !item.markup
			? src!.body
			: actions.length === 0
			? ''
			: multiline
			? `\n${actions.join('\n')}\n`
			: actions.join('');

	return `${head}${body}<</${item.form}>>`;
}

/** Заменить ссылку в тексте. */
export function replaceLink(text: string, item: LinkItem, next: Omit<LinkItem, 'from' | 'to'>) {
	return text.slice(0, item.from) + writeLink(next) + text.slice(item.to);
}

/* ----- Новые действия для формы ----- */

export function newAction(type: ActionType, variable?: {name: string; type?: string}): Action {
	switch (type) {
		case 'set':
			return variable?.type === 'bool'
				? {type: 'set', name: variable.name, op: 'toggle'}
				: {type: 'set', name: variable?.name ?? 'x', op: 'to', value: variable?.type === 'text' ? '' : 1};
		case 'audio':
			return {type: 'audio', who: {kind: 'track', id: ''}, act: 'play'};
		case 'dialog':
			return {type: 'dialog', title: '', passage: '', text: '', close: ''};
		case 'timer':
			return {type: 'timer', values: {name: 'Таймер', minutes: 1, seconds: 0}, extra: []};
		case 'stop':
			return {type: 'stop', name: 'Таймер'};
		case 'signal':
			return {type: 'signal', src: '', volume: 100, keep: false};
		case 'if':
			return {type: 'if', expr: `$${variable?.name ?? 'x'}`, then: [], multiline: true};
		case 'delay':
			return {type: 'delay', seconds: 1, actions: [], multiline: false};
		case 'progress':
			return {type: 'progress', amount: 1};
		default:
			return {type: 'code', code: ''};
	}
}

/* ----- Перенос шаблона (ответ 5А) ----- */

/**
 * Окна-сообщения, открытые кодом <<script>>Dialog.create…<</script>> внутри
 * ссылок и кнопок, → действие <<sg-open>>. Поведение то же: заголовок и
 * пассаж или текст, закрытие крестиком.
 */
export function moveScriptDialogs(text: string) {
	const edits: Array<{from: number; to: number; insert: string}> = [];

	for (const link of findLinks(text)) {
		if (link.markup || link.bodyFrom === undefined) {
			continue;
		}

		const body = text.slice(link.bodyFrom, link.to - `<</${link.form}>>`.length);
		let at = 0;

		for (const piece of splitBody(body)) {
			const start = body.indexOf(piece, at);

			at = start + piece.length;
			if (!scriptDialogRe.test(piece)) {
				continue;
			}

			const dialog = parseDialog(piece)!;

			edits.push({
				from: link.bodyFrom + start,
				to: link.bodyFrom + at,
				insert: writeAction({...dialog, raw: undefined})
			});
		}
	}

	// Вложенные ссылки дают одну и ту же правку дважды.
	const unique = edits.filter((e, i) => edits.findIndex(o => o.from === e.from) === i);

	return unique
		.sort((a, b) => b.from - a.from)
		.reduce((result, e) => result.slice(0, e.from) + e.insert + result.slice(e.to), text);
}
