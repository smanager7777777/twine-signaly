import {accessSources} from '../signaly-access';
import {renameScreen} from '../signaly-rename';
import {
	findBlocks,
	listRowId,
	listRowsFill,
	newBlock,
	newStateList,
	writeBlock
} from '../signaly-screen-blocks';
import {knownVariables} from '../signaly-variables';
import {fakePassage} from '../../../test-util';

const sample = `Перед
<<sg-list form button columns 3>>
<<sg-state 0 label "{номер}. Данные повреждены" color "#cc0000" keykind "purple">><<set $seen to 1>>
<<sg-state 1 label "Нужен пароль" goto "Пароль">>
<<sg-state 3 label "{название}" do window title "Процедура {номер}">>
<<sg-row "001" "Гибернация" var "$prcd1" passage "PRCD001" key>>
<<sg-row "002" "Шлюз" var "$prcd2">>
<</sg-list>>
После`;

describe('блок «Список состояний»', () => {
	it('читает состояния и строки', () => {
		const [block] = findBlocks(sample);

		expect(block.type).toBe('list');
		expect(block.values).toEqual({form: 'button', columns: 3});
		expect(block.states!.map(st => st.values.value)).toEqual([0, 1, 3]);
		expect(block.states![0].content).toBe('<<set $seen to 1>>');
		expect(block.states![1].values.goto).toBe('Пароль');
		expect(block.states![2].values.do).toBe('window');
		expect(block.rows!.map(r => r.values.num)).toEqual(['001', '002']);
		expect(block.rows![0].values).toMatchObject({name: 'Гибернация', var: '$prcd1', passage: 'PRCD001', key: true});
	});

	it('запись повторяет текст', () => {
		const [block] = findBlocks(sample);

		expect(sample.slice(0, block.from) + writeBlock(block) + sample.slice(block.to)).toBe(sample);
	});

	it('номер остаётся строкой с нулями', () => {
		const [block] = findBlocks(writeBlock(newStateList(false)));

		expect(block.rows![0].values.num).toBe('001');
		expect(block.states![0].values.value).toBe(0);
	});

	it('непонятые слова сохраняются', () => {
		const text = '<<sg-list form tile wide>>\n<<sg-state 0 label "x" odd>>\n<<sg-row "1" "A" other>>\n<</sg-list>>';

		expect(writeBlock(findBlocks(text)[0])).toBe(text);
	});

	it('заготовки: кнопки и плитка', () => {
		expect(newBlock('list').values.form).toBe('button');
		expect(newStateList(true).values.form).toBe('tile');
		expect(newStateList(false).states).toHaveLength(4);
		expect(newStateList(false).states!.every(st => st.values.keykind === 'purple')).toBe(true);
	});

	it('много строк: номера, переменные, экраны', () => {
		const rows = listRowsFill({count: 99, first: 1, digits: 3, name: 'Процедура {номер}', variable: '$prcd', screen: 'PRCD'});

		expect(rows).toHaveLength(99);
		expect(rows[0].values).toEqual({num: '001', name: 'Процедура 001', var: '$prcd1', passage: 'PRCD001'});
		expect(rows[98].values).toEqual({num: '099', name: 'Процедура 099', var: '$prcd99', passage: 'PRCD099'});
	});

	it('много строк: без экрана и без переменной', () => {
		const [row] = listRowsFill({count: 1, first: 7, digits: 1, name: 'С', variable: '', screen: ''});

		expect(row.values).toEqual({num: '7', name: 'С', var: undefined});
	});

	it('имя строки для «Доступа»', () => {
		expect(listRowId({values: {num: '1', name: 'А  Б'}, extra: []})).toBe('А Б');
		expect(listRowId({values: {num: '1', name: ''}, extra: []})).toBe('1');
	});

	it('переименование экрана меняет строки и состояния', () => {
		expect(renameScreen(sample, 'PRCD001', 'Новый')).toContain('passage "Новый" key');
		expect(renameScreen(sample, 'Пароль', 'Код')).toContain('goto "Код"');
	});

	it('переменные строк видны в списке переменных', () => {
		const names = knownVariables([fakePassage({name: 'Э', text: sample})]).map(v => v.name);

		expect(names).toEqual(expect.arrayContaining(['prcd1', 'prcd2']));
	});

	it('строки и состояния попадают в меню «Доступа»', () => {
		const passages = [
			fakePassage({name: 'Список', text: sample.replace('do window title "Процедура {номер}"', 'do row')})
		];
		const toRow = accessSources(passages, 'PRCD001');
		const toState = accessSources(passages, 'Пароль');

		expect(toRow).toEqual([expect.objectContaining({kind: 'link', id: 'Гибернация', from: 'Список', note: 'button'})]);
		expect(toState).toEqual([expect.objectContaining({kind: 'link', id: 'Нужен пароль', from: 'Список'})]);
	});

	it('окно с экраном строки — не переход', () => {
		expect(accessSources([fakePassage({name: 'Список', text: sample})], 'PRCD001')).toEqual([]);
	});
});
