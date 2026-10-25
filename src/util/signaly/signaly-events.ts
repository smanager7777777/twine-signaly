// «Twine СИГНАЛЫ»: события (шаг 3.5, решения 77, 78; ответы 1А–6А).
// Событие — обычный пассаж с тегом sg-event; первой строкой его текста стоит
//   <<sg-event $chapter is 2 and $repaired>>
// с необязательными словами перед условием:
//   <<sg-event repeat delay 5 priority 1 $chapter is 2>>
//   repeat     — повторять, когда условие снова станет верным (было ложным,
//                стало верным); без него — один раз;
//   delay N    — через N секунд после того, как условие стало верным;
//   priority N — важность: из нескольких готовых событий первым идёт то, у
//                кого число больше.
// Движок терминала сам переходит на такой пассаж, когда условие станет верным.

import {Cond, parseExpr} from './signaly-logic';

export const eventTag = 'sg-event';

export interface EventHead {
	/** Где команда <<sg-event …>> в тексте. */
	from: number;
	to: number;
	/** Условие, как написано. */
	expr: string;
	repeat: boolean;
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
	let delay = 0;
	let priority = 0;

	for (;;) {
		const m = /^(repeat|delay|priority)(?:\s+(-?\d+(?:[.,]\d+)?))?(?:\s+|$)/.exec(rest);

		if (!m || (m[1] !== 'repeat' && m[2] === undefined)) {
			break;
		}
		if (m[1] === 'repeat') {
			repeat = true;
		} else if (m[1] === 'delay') {
			delay = Math.max(0, Number(m[2].replace(',', '.')));
		} else {
			priority = Number(m[2].replace(',', '.'));
		}
		rest = rest.slice(m[0].length);
	}
	return {expr: rest.trim(), repeat, delay, priority};
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

export function writeEventHead(e: Pick<EventHead, 'expr' | 'repeat' | 'delay' | 'priority'>) {
	const words = [
		e.repeat ? 'repeat' : '',
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
	head: Pick<EventHead, 'expr' | 'repeat' | 'delay' | 'priority'> | undefined
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
