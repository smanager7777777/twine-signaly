// «Twine СИГНАЛЫ»: закрытые экраны (шаг 4.3, решение 83; ответы 1А, 2Б, 3А–6А).
// Экран с тегом sg-access начинается с команды
//   <<sg-access lock "Рано" links off codes wrong>>$open<</sg-access>>\
// Внутри — условие: когда оно верно, экран открыт. Слова команды:
//   lock "Экран" — свой пассаж блокировки (иначе — общий, с тегом sg-lock);
//   links, codes, keys, events, auto — что по умолчанию делают ссылки, коды,
//   клавиши мастера, событие и всё остальное (таймер, тревога, цепочка видео),
//   пока экран закрыт.
// Отдельному источнику — своё поведение:
//   <<sg-access>>$open
//   <<sg-rule link "Назад" from "Start" do off>>
//   <<sg-rule code "205" do block to "Рано">>
//   <<sg-rule key "Shift+Z+A" do pass>>
//   <<sg-rule auto "timer:Clocks" do stay>>
//   <</sg-access>>\
// Движок читает эти команды по тегу; на самом экране они ничего не выводят.

import {Passage} from '../../store/stories';
import {plain} from './signaly-link-form';
import {Cond, parseExpr} from './signaly-logic';
import {findLinks} from './signaly-actions';
import {articleLists, articleTag, listItems, readArticles} from './signaly-articles';
import {codesTag, readCodes} from './signaly-codes';
import {keysTag, normalCombo, readKeys} from './signaly-keys';
import {findBlocks, findClose, quote, scanArgs} from './signaly-screen-blocks';

export const accessTag = 'sg-access';
/** Общий пассаж блокировки (ответ 5А) — обычный пассаж с этим тегом. */
export const lockTag = 'sg-lock';
/** Цвета тегов на карте (ответ 6А). */
export const accessTagColor = 'red';
export const lockTagColor = 'orange';

export type AccessKind = 'link' | 'code' | 'key' | 'event' | 'auto';
export type AccessAction = 'hide' | 'off' | 'block' | 'pass' | 'wrong' | 'denied' | 'stay';

export const accessKinds: AccessKind[] = ['link', 'code', 'key', 'event', 'auto'];

/** Что можно выбрать у каждого вида источников. */
export const accessActions: Record<AccessKind, AccessAction[]> = {
	link: ['hide', 'off', 'block', 'pass'],
	code: ['block', 'wrong', 'denied', 'pass'],
	key: ['pass', 'block', 'stay'],
	event: ['pass', 'block', 'stay'],
	auto: ['pass', 'block', 'stay']
};

/** По умолчанию (ответ 3А): клавиши, события и таймеры проходят всегда. */
export const accessDefaults: Record<AccessKind, AccessAction> = {
	link: 'hide',
	code: 'block',
	key: 'pass',
	event: 'pass',
	auto: 'pass'
};

const groupWords: Record<AccessKind, string> = {
	link: 'links',
	code: 'codes',
	key: 'keys',
	event: 'events',
	auto: 'auto'
};

export interface AccessRule {
	kind: AccessKind;
	/** Надпись ссылки, код, комбинация, «timer:Имя», «alarm:Экран», «chain:Экран». */
	id: string;
	/** Экран, на котором стоит ссылка. */
	from?: string;
	action: AccessAction;
	/** Свой пассаж блокировки этого источника. */
	to?: string;
}

export interface AccessHead {
	/** Где команда в тексте (вместе с закрывающей). */
	from: number;
	to: number;
	/** Условие, как написано: верно — экран открыт. */
	expr: string;
	/** Разобранное условие или undefined, если оно записано кодом. */
	conds?: Cond[];
	join: 'and' | 'or';
	/** Свой пассаж блокировки экрана. */
	lock: string;
	groups: Record<AccessKind, AccessAction>;
	rules: AccessRule[];
}

export type AccessData = Pick<AccessHead, 'expr' | 'lock' | 'groups' | 'rules'>;

function isAction(kind: AccessKind, word: string | undefined): word is AccessAction {
	return accessActions[kind].includes(word as AccessAction);
}

/** Значение слова команды: в кавычках или без них. */
function word(token: string | undefined) {
	return plain(token) ?? token;
}

function parseRule(tokens: string[]): AccessRule | undefined {
	const kind = tokens[0] as AccessKind;

	if (!accessKinds.includes(kind)) {
		return undefined;
	}

	const rule: AccessRule = {kind, id: word(tokens[1]) ?? '', action: accessDefaults[kind]};

	for (let i = 2; i < tokens.length - 1; i += 2) {
		const value = word(tokens[i + 1]);

		if (tokens[i] === 'from') {
			rule.from = value;
		} else if (tokens[i] === 'to') {
			rule.to = value;
		} else if (tokens[i] === 'do' && isAction(kind, value)) {
			rule.action = value;
		}
	}
	return rule;
}

/** Команда доступа в тексте пассажа. */
export function findAccess(text: string): AccessHead | undefined {
	const open = /<<sg-access(?=[\s>])/.exec(text);

	if (!open) {
		return undefined;
	}

	const head = scanArgs(text, open.index + open[0].length);
	const close = head && findClose(text, 'sg-access', head.end);

	if (!head || !close) {
		return undefined;
	}

	const groups = {...accessDefaults};
	let lock = '';

	for (let i = 0; i < head.tokens.length - 1; i += 2) {
		const value = word(head.tokens[i + 1]);
		const kind = accessKinds.find(k => groupWords[k] === head.tokens[i]);

		if (head.tokens[i] === 'lock') {
			lock = value ?? '';
		} else if (kind && isAction(kind, value)) {
			groups[kind] = value;
		}
	}

	const body = text.slice(head.end, close.at);
	const first = /<<sg-rule(?=[\s>])/.exec(body);
	const expr = (first ? body.slice(0, first.index) : body).trim();
	const rules: AccessRule[] = [];
	const re = /<<sg-rule(?=[\s>])/g;
	let match: RegExpExecArray | null;

	while ((match = re.exec(body))) {
		const scan = scanArgs(body, match.index + match[0].length);
		const rule = scan && parseRule(scan.tokens);

		if (rule) {
			rules.push(rule);
		}
	}

	const parsed = expr === '' ? undefined : parseExpr(expr);

	return {
		from: open.index,
		to: close.end,
		expr,
		conds: parsed?.conds,
		join: parsed?.join ?? 'and',
		lock,
		groups,
		rules
	};
}

function writeRule(r: AccessRule) {
	return [
		`<<sg-rule ${r.kind} ${quote(r.id)}`,
		r.from !== undefined ? `from ${quote(r.from)}` : '',
		`do ${r.action}`,
		r.to ? `to ${quote(r.to)}>>` : '>>'
	]
		.filter(Boolean)
		.join(' ')
		.replace(' >>', '>>');
}

export function writeAccess(a: AccessData) {
	const words = [
		a.lock ? `lock ${quote(a.lock)}` : '',
		...accessKinds.map(k => (a.groups[k] !== accessDefaults[k] ? `${groupWords[k]} ${a.groups[k]}` : ''))
	].filter(Boolean);
	const head = `<<sg-access${words.length ? ' ' + words.join(' ') : ''}>>${a.expr.trim()}`;

	return a.rules.length === 0
		? `${head}<</sg-access>>`
		: `${head}\n${a.rules.map(writeRule).join('\n')}\n<</sg-access>>`;
}

/**
 * Поставить, заменить или убрать команду доступа. Новая — первой строкой; \ в
 * конце строки не оставляет на экране пустой строки. Убирается вместе с ним.
 */
export function setAccess(text: string, access: AccessData | undefined) {
	const found = findAccess(text);

	if (!access) {
		if (!found) {
			return text;
		}
		return text.slice(0, found.from) + text.slice(found.to).replace(/^\\?\r?\n/, '');
	}

	const written = writeAccess(access);

	if (found) {
		return text.slice(0, found.from) + written + text.slice(found.to);
	}
	return text === '' ? written : `${written}\\\n${text}`;
}

export function newAccess(expr: string): AccessData {
	return {expr, lock: '', groups: {...accessDefaults}, rules: []};
}

export function sameSource(a: Pick<AccessRule, 'kind' | 'id' | 'from'>, b: Pick<AccessRule, 'kind' | 'id' | 'from'>) {
	return a.kind === b.kind && a.id === b.id && (a.from ?? '') === (b.from ?? '');
}

/** Поставить или снять поведение отдельного источника (action undefined — как у всех). */
export function withRule(
	rules: AccessRule[],
	source: Pick<AccessRule, 'kind' | 'id' | 'from'>,
	action: AccessAction | undefined,
	to?: string
) {
	const rest = rules.filter(r => !sameSource(r, source));

	return action
		? [...rest, {...source, action, ...(action === 'block' && to ? {to} : {})}]
		: rest;
}

/** Откуда можно попасть на экран. */
export interface AccessSource {
	kind: AccessKind;
	id: string;
	from?: string;
	/** Подпись в списке: код с подписью, комбинация с подписью и т. п. */
	label: string;
	/** Подвид для подписи: button — кнопка, timer, alarm, chain. */
	note?: 'button' | 'timer' | 'alarm' | 'chain';
}

/** Всё, что ведёт на экран target: ссылки, коды, клавиши, таймеры (ответ 2Б). */
export function accessSources(passages: Passage[], target: string) {
	const list: AccessSource[] = [];
	const add = (s: AccessSource) => {
		if (!list.some(o => sameSource(o, s))) {
			list.push(s);
		}
	};

	// Шаг 4.4: статья в блоке «Список статей» — такая же ссылка.
	const article = passages.some(p => p.name === target && p.tags.includes(articleTag))
		? readArticles(passages).find(a => a.name === target)
		: undefined;

	passages.forEach(p => {
		if (p.tags.includes('script') || p.tags.includes('stylesheet')) {
			return;
		}
		if (p.tags.includes(codesTag)) {
			readCodes(p.text)
				.codes.filter(c => c.goto === target)
				.forEach(c => add({kind: 'code', id: c.code, label: c.label ? `${c.code} — ${c.label}` : c.code}));
			return;
		}
		if (p.tags.includes(keysTag)) {
			readKeys(p.text)
				.filter(k => k.goto === target)
				.forEach(k => {
					const combo = normalCombo(k.combo);

					add({kind: 'key', id: combo, label: k.label ? `${combo} — ${k.label}` : combo});
				});
			return;
		}
		findLinks(p.text)
			.filter(l => l.passage === target && l.label !== undefined)
			.forEach(l =>
				add({
					kind: 'link',
					id: (l.label as string).replace(/\s+/g, ' ').trim(),
					from: p.name,
					label: (l.label as string).trim(),
					note: l.form === 'button' ? 'button' : undefined
				})
			);
		if (article) {
			articleLists(p.text)
				.filter(list => listItems([article], list.values.sections).length > 0)
				.forEach(list =>
					add({
						kind: 'link',
						id: article.title.replace(/\s+/g, ' ').trim(),
						from: p.name,
						label: article.title.trim(),
						note: list.values.form === 'button' ? 'button' : undefined
					})
				);
		}
		findBlocks(p.text).forEach(b => {
			if (b.type === 'code') {
				(b.cases ?? [])
					.filter(c => c.kind === 'case' && c.values.goto === target)
					.forEach(c => add({kind: 'code', id: String(c.values.code), label: String(c.values.code)}));
			} else if (b.values.goto === target && (b.type === 'timer' || b.type === 'alarm' || b.type === 'chain')) {
				const name = b.type === 'timer' ? String(b.values.name) : p.name;

				add({kind: 'auto', id: `${b.type}:${name}`, label: name, note: b.type});
			}
		});
	});
	return list;
}
