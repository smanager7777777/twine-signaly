// «Twine СИГНАЛЫ»: статьи (шаг 4.4, решение 83, ответы 1А–6А).
// Экран-статья — обычный пассаж с тегом sg-article; первой строкой:
//   <<sg-article title "Гибернация" section "ПЕРСЕФОНА" order 3 back "К списку">>\
// title — название в списке (нет — имя экрана), section — раздел, order — порядок,
// back — своя надпись ссылки «Назад» (нет — общая из «Оформления терминала»).
// Закрывается статья обычным «Доступом» (шаг 4.3).
// Список — блок на любом экране: <<sg-articles sections "ПЕРСЕФОНА, ИНТЕРКОМ"
// form button kind "amber" columns 2 headings>>. Нет sections — все статьи.
// Новая статья попадает в список сама: движок собирает его при показе экрана.

import {Passage} from '../../store/stories';
import {plain} from './signaly-link-form';
import {findBlocks, quote, scanArgs, Values} from './signaly-screen-blocks';

export const articleTag = 'sg-article';

export interface ArticleData {
	/** Название в списке; пусто — имя экрана. */
	title: string;
	section: string;
	order: number;
	/** Своя надпись ссылки «Назад»; пусто — общая. */
	back: string;
	/** Непонятые слова команды — сохраняются как есть. */
	extra: string[];
}

export interface ArticleHead extends ArticleData {
	from: number;
	to: number;
}

export function newArticle(): ArticleData {
	return {title: '', section: '', order: 0, back: '', extra: []};
}

function findHead(text: string) {
	const open = /<<sg-article(?=[\s>])/.exec(text);
	const scan = open && scanArgs(text, open.index + open[0].length);

	return open && scan ? {from: open.index, to: scan.end, tokens: scan.tokens} : undefined;
}

/** Команда статьи в тексте пассажа. */
export function findArticle(text: string): ArticleHead | undefined {
	const head = findHead(text);

	if (!head) {
		return undefined;
	}

	const article = newArticle();
	const {tokens} = head;

	for (let i = 0; i < tokens.length; i++) {
		const value = tokens[i + 1];
		const known = value !== undefined && ['title', 'section', 'order', 'back'].includes(tokens[i]);

		if (!known) {
			article.extra.push(tokens[i]);
			continue;
		}
		i++;
		if (tokens[i - 1] === 'order') {
			const n = Number(plain(value) ?? value);

			article.order = isFinite(n) ? n : 0;
		} else {
			article[tokens[i - 1] as 'title' | 'section' | 'back'] = plain(value) ?? value;
		}
	}
	return {...article, from: head.from, to: head.to};
}

export function writeArticle(a: ArticleData) {
	const words = [
		a.title ? `title ${quote(a.title)}` : '',
		a.section ? `section ${quote(a.section)}` : '',
		a.order ? `order ${a.order}` : '',
		a.back ? `back ${quote(a.back)}` : '',
		...a.extra
	].filter(Boolean);

	return `<<sg-article${words.length ? ' ' + words.join(' ') : ''}>>`;
}

/**
 * Поставить, заменить или убрать команду статьи. Новая — первой строкой; \ в
 * конце строки не оставляет на экране пустой строки. Убирается вместе с ним.
 */
export function setArticle(text: string, article: ArticleData | undefined) {
	const found = findArticle(text);

	if (!article) {
		return found ? text.slice(0, found.from) + text.slice(found.to).replace(/^\\?\r?\n/, '') : text;
	}

	const written = writeArticle(article);

	if (found) {
		return text.slice(0, found.from) + written + text.slice(found.to);
	}
	return text === '' ? written : `${written}\\\n${text}`;
}

export interface ArticleItem {
	/** Имя экрана. */
	name: string;
	title: string;
	section: string;
	order: number;
}

/** Все статьи истории: по порядку, потом по названию (как в игре). */
export function readArticles(passages: Passage[]) {
	return passages
		.filter(p => p.tags.includes(articleTag))
		.map<ArticleItem>(p => {
			const a = findArticle(p.text) ?? newArticle();

			return {name: p.name, title: a.title || p.name, section: a.section, order: a.order};
		})
		.sort((x, y) => x.order - y.order || x.title.localeCompare(y.title, 'ru'));
}

/** Разделы: по наименьшему порядку статьи в них, потом по названию. */
export function articleSections(items: ArticleItem[]) {
	const orders = new Map<string, number>();

	items.forEach(a => {
		if (a.section && (!orders.has(a.section) || a.order < orders.get(a.section)!)) {
			orders.set(a.section, a.order);
		}
	});
	return [...orders.keys()].sort((x, y) => orders.get(x)! - orders.get(y)! || x.localeCompare(y, 'ru'));
}

/** Разделы, выбранные в блоке «Список статей»; пусто — все статьи. */
export function listSections(sections: Values[string]) {
	return String(sections ?? '')
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
}

/** Статьи, которые показывает блок «Список статей». */
export function listItems(items: ArticleItem[], sections: Values[string]) {
	const picked = listSections(sections);

	return picked.length ? items.filter(a => picked.includes(a.section)) : items;
}

/** Списки статей на экране: для меню «Что ведёт на этот экран». */
export function articleLists(text: string) {
	return findBlocks(text).filter(b => b.type === 'articles');
}
