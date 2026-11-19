// «Twine СИГНАЛЫ»: события (шаг 3.5, решения 77, 78; ответы 1А–6А).
// Событие — обычный пассаж с тегом sg-event; первой строкой его текста стоит
//   <<sg-event $chapter is 2 and $repaired>>
// с необязательными словами перед условием:
//   <<sg-event repeat delay 5 priority 1 $chapter is 2>>
//   repeat     — повторять, когда условие снова станет верным (было ложным,
//                стало верным); без него — один раз;
//   delay N    — через N секунд после того, как условие стало верным;
//   priority N — важность: из нескольких готовых событий первым идёт то, у
//                кого число больше;
//   stay       — (сессия 35) не переходить на экран события, только действия;
//   popup      — (сессия 36, Т4-8 Б) не переходить, а показать текст пассажа окном-сообщением
//                поверх экрана (заголовок — название пассажа);
//   title "…"  — (сессия 37, Т6-2 Б) свой заголовок окна-сообщения;
//   ack        — (сессия 37, Т6-2 Б) окно закрывается только кнопкой «Принято».
// Движок терминала сам переходит на такой пассаж, когда условие станет верным.
// Сессия 35 (Т4-4 А): действия при срабатывании — строкой после первой:
//   <<sg-event-do>>действия (как у ссылки)<</sg-event-do>>
// движок выполняет их один раз, когда событие сработало (на экране их не видно).

import {Cond, parseExpr} from './signaly-logic';

export const eventTag = 'sg-event';

export interface EventHead {
	/** Где команда <<sg-event …>> в тексте. */
	from: number;
	to: number;
	/** Условие, как написано. */
	expr: string;
	repeat: boolean;
	/** Не переходить на экран события — только действия (сессия 35). */
	stay: boolean;
	/** Показать текст пассажа окном-сообщением поверх экрана (сессия 36). */
	popup: boolean;
	/** Сессия 37 (Т6-2 Б): свой заголовок окна-сообщения (пусто — название пассажа). */
	title: string;
	/** Сессия 37 (Т6-2 Б): закрыть окно только кнопкой «Принято». */
	ack: boolean;
	/** Секунды задержки (0 — сразу). */
	delay: number;
	/** Важность (0 по умолчанию). */
	priority: number;
	/** Разобранное условие или undefined, если оно записано кодом. */
	conds?: Cond[];
	join: 'and' | 'or';
}

/** Конец команды «>>» вне кавычек. */
function headEnd(text: string, from: number) {
	let quote = '';

	for (let i = from; i < text.length - 1; i++) {
		const ch = text[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			} else if (ch === quote) {
				quote = '';
			}
		} else if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === '>' && text[i + 1] === '>') {
			return i;
		}
	}
	return -1;
}

/** Слова перед условием и само условие. */
export function parseEventArgs(args: string) {
	let rest = args.trim();
	let repeat = false;
	let stay = false;
	let popup = false;
	let title = '';
	let ack = false;
	let delay = 0;
	let priority = 0;

	for (;;) {
		const t = /^title\s+"((?:[^"\\]|\\.)*)"(?:\s+|$)/.exec(rest);

		if (t) {
			title = t[1].replace(/\\(.)/g, '$1');
			rest = rest.slice(t[0].length);
			continue;
		}

		const m = /^(repeat|stay|popup|ack|delay|priority)(?:\s+(-?\d+(?:[.,]\d+)?))?(?:\s+|$)/.exec(rest);

		if (!m || (m[1] !== 'repeat' && m[1] !== 'stay' && m[1] !== 'popup' && m[1] !== 'ack' && m[2] === undefined)) {
			break;
		}
		if (m[1] === 'repeat') {
			repeat = true;
		} else if (m[1] === 'ack') {
			ack = true;
		} else if (m[1] === 'stay') {
			stay = true;
		} else if (m[1] === 'popup') {
			popup = true;
		} else if (m[1] === 'delay') {
			delay = Math.max(0, Number(m[2].replace(',', '.')));
		} else {
			priority = Number(m[2].replace(',', '.'));
		}
		rest = rest.slice(m[0].length);
	}
	return {expr: rest.trim(), repeat, stay, popup, title, ack, delay, priority};
}

/** Команда события в тексте пассажа (первая). */
export function findEvent(text: string): EventHead | undefined {
	const m = /<<sg-event(?=[\s>])/.exec(text);

	if (!m) {
		return undefined;
	}

	const end = headEnd(text, m.index + 2);

	if (end === -1) {
		return undefined;
	}

	const args = parseEventArgs(text.slice(m.index + '<<sg-event'.length, end));
	const parsed = args.expr === '' ? undefined : parseExpr(args.expr);

	return {
		from: m.index,
		to: end + 2,
		...args,
		conds: parsed?.conds,
		join: parsed?.join ?? 'and'
	};
}

function num(n: number) {
	return String(Number(n.toFixed(3)));
}

type HeadFields = Pick<EventHead, 'expr' | 'repeat' | 'delay' | 'priority'> & {
	stay?: boolean;
	popup?: boolean;
	title?: string;
	ack?: boolean;
};

export function writeEventHead(e: HeadFields) {
	const words = [
		e.repeat ? 'repeat' : '',
		e.stay ? 'stay' : '',
		e.popup && !e.stay ? 'popup' : '',
		e.popup && !e.stay && e.title?.trim() ? `title "${e.title.trim().replace(/["\\]/g, '\\$&')}"` : '',
		e.popup && !e.stay && e.ack ? 'ack' : '',
		e.delay > 0 ? `delay ${num(e.delay)}` : '',
		e.priority !== 0 && isFinite(e.priority) ? `priority ${num(e.priority)}` : ''
	].filter(Boolean);

	return `<<sg-event ${[...words, e.expr.trim()].join(' ')}>>`;
}

/**
 * Поставить, заменить или убрать команду события. Новая — первой строкой;
 * убирается вместе со своим переводом строки.
 */
export function setEventHead(
	text: string,
	head: HeadFields | undefined
) {
	const found = findEvent(text);

	if (!head) {
		if (!found) {
			return text;
		}

		const after = text.slice(found.to).replace(/^\r?\n/, '');

		return text.slice(0, found.from) + after;
	}

	const written = writeEventHead(head);

	if (found) {
		return text.slice(0, found.from) + written + text.slice(found.to);
	}
	return text === '' ? written : `${written}\n${text}`;
}

/* ----- Сессия 35 (Т4-4 А): действия при срабатывании ----- */

const doOpen = '<<sg-event-do>>';
const doClose = '<</sg-event-do>>';

/** Действия события: где строка <<sg-event-do>>…<</sg-event-do>> и что внутри. */
export function findEventDo(text: string) {
	const from = text.indexOf(doOpen);

	if (from === -1) {
		return undefined;
	}

	const end = text.indexOf(doClose, from + doOpen.length);

	if (end === -1) {
		return undefined;
	}
	return {from, to: end + doClose.length, body: text.slice(from + doOpen.length, end)};
}

/**
 * Поставить, заменить или убрать действия события. Новые — строкой сразу после первой строки
 * события (или в начало текста); пустое тело — строка убирается вместе с переводом строки.
 */
export function setEventDo(text: string, body: string) {
	const found = findEventDo(text);
	const empty = !/\S/.test(body);

	if (found) {
		if (empty) {
			return text.slice(0, found.from) + text.slice(found.to).replace(/^\r?\n/, '');
		}
		return text.slice(0, found.from) + doOpen + body + doClose + text.slice(found.to);
	}
	if (empty) {
		return text;
	}

	const head = findEvent(text);
	const line = doOpen + body + doClose;

	if (!head) {
		return text === '' ? line : `${line}\n${text}`;
	}

	const rest = text.slice(head.to);

	return text.slice(0, head.to) + '\n' + line + (rest.startsWith('\n') || rest === '' ? rest : '\n' + rest);
}
