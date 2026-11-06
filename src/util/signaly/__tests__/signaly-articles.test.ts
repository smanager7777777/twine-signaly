import {fakePassage} from '../../../test-util';
import {accessSources} from '../signaly-access';
import {
	articleLists,
	articleSections,
	findArticle,
	listItems,
	listSections,
	newArticle,
	readArticles,
	setArticle,
	writeArticle
} from '../signaly-articles';
import {findBlocks, newBlock, writeBlock} from '../signaly-screen-blocks';

const passage = (name: string, text: string, tags: string[] = []) => ({...fakePassage({name, text}), tags});
const article = (name: string, words = '', text = '') =>
	passage(name, `<<sg-article${words}>>\\\n${text}`, ['sg-article']);

describe('команда статьи', () => {
	it('читает все слова', () => {
		expect(findArticle('<<sg-article title "Гибернация" section "ПЕРСЕФОНА" order 3 back "К списку">>\\\nТекст')).toMatchObject({
			title: 'Гибернация',
			section: 'ПЕРСЕФОНА',
			order: 3,
			back: 'К списку',
			extra: [],
			from: 0
		});
	});

	it('команда без слов — статья с именем экрана', () => {
		expect(findArticle('<<sg-article>>')).toMatchObject(newArticle());
	});

	it('блок списка не считается статьёй', () => {
		expect(findArticle('<<sg-articles columns 2>>')).toBeUndefined();
	});

	it('запись и чтение сходятся, значения по умолчанию не пишутся', () => {
		const data = {title: 'А "б"', section: 'Р', order: -2.5, back: '', extra: []};

		expect(findArticle(writeArticle(data))).toMatchObject(data);
		expect(writeArticle(newArticle())).toBe('<<sg-article>>');
	});

	it('непонятые слова сохраняются', () => {
		const head = findArticle('<<sg-article title "А" pinned>>')!;

		expect(head.extra).toEqual(['pinned']);
		expect(writeArticle(head)).toBe('<<sg-article title "А" pinned>>');
	});

	it('новая — первой строкой, убирается вместе со своей строкой', () => {
		const text = setArticle('Текст', {...newArticle(), title: 'А'});

		expect(text).toBe('<<sg-article title "А">>\\\nТекст');
		expect(setArticle(text, undefined)).toBe('Текст');
		expect(setArticle('', newArticle())).toBe('<<sg-article>>');
	});

	it('стоит и рядом с «Доступом», замена не трогает остальное', () => {
		const text = '<<sg-access>>$a<</sg-access>>\\\n<<sg-article order 1>>\\\nТекст';

		expect(setArticle(text, {...newArticle(), order: 2})).toBe(
			'<<sg-access>>$a<</sg-access>>\\\n<<sg-article order 2>>\\\nТекст'
		);
	});
});

describe('список статей', () => {
	const passages = [
		article('b', ' title "Бета" section "Р2" order 5'),
		article('a', ' title "Альфа" section "Р2" order 5'),
		article('c', ' section "Р1" order 9'),
		article('d', ' title "Гамма" section "Р3" order 1'),
		passage('e', '<<sg-article title "Без тега">>')
	];

	it('читает только экраны с тегом, по порядку и названию', () => {
		expect(readArticles(passages).map(a => a.name)).toEqual(['d', 'a', 'b', 'c']);
		expect(readArticles(passages)[3].title).toBe('c');
	});

	it('разделы — по самой верхней статье', () => {
		expect(articleSections(readArticles(passages))).toEqual(['Р3', 'Р2', 'Р1']);
	});

	it('выбранные разделы; пусто — все', () => {
		const items = readArticles(passages);

		expect(listSections(' Р1 , Р3,')).toEqual(['Р1', 'Р3']);
		expect(listItems(items, undefined)).toHaveLength(4);
		expect(listItems(items, 'Р2').map(a => a.name)).toEqual(['a', 'b']);
	});

	it('блок читается и пишется', () => {
		const text = writeBlock({
			...newBlock('articles'),
			values: {sections: 'Р1, Р2', form: 'button', kind: 'amber', columns: 2, headings: true}
		});

		expect(text).toBe('<<sg-articles sections "Р1, Р2" form button kind amber columns 2 headings>>');
		expect(findBlocks(text)[0]).toMatchObject({type: 'articles', values: {columns: 2, form: 'button', headings: true}});
		expect(articleLists(`Текст ${text}`)).toHaveLength(1);
	});

	it('статья в списке — источник в меню «Доступа»', () => {
		const list = [
			article('a', ' title "Альфа" section "Р1"'),
			passage('Меню', '<<sg-articles form "button" sections "Р1">>'),
			passage('Другое', '<<sg-articles sections "Р2">>')
		];

		expect(accessSources(list, 'a')).toEqual([
			{kind: 'link', id: 'Альфа', from: 'Меню', label: 'Альфа', note: 'button'}
		]);
		expect(accessSources(list, 'Меню')).toEqual([]);
	});
});
