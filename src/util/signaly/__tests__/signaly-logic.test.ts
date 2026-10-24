import {
	caseValue,
	findConditions,
	findStates,
	findValues,
	parseExpr,
	replaceConditionHead,
	setConditionElse,
	wrapCondition,
	writeExpr,
	writeStates,
	writeValue
} from '../signaly-logic';

describe('условие', () => {
	it('разбирает и записывает выражения', () => {
		expect(parseExpr('$log')).toEqual({conds: [{name: 'log', op: 'on'}], join: 'and'});
		expect(parseExpr('$a is 1 and $b gt 2 and $c lt "x"')).toEqual({
			conds: [
				{name: 'a', op: 'eq', value: 1},
				{name: 'b', op: 'gt', value: 2},
				{name: 'c', op: 'lt', value: 'x'}
			],
			join: 'and'
		});
		expect(parseExpr('$a or $b == true')!.join).toBe('or');
		expect(parseExpr('$a and $b or $c')).toBeUndefined();
		expect(parseExpr('$PRCD and Story.has(_prcd)')).toBeUndefined();
		expect(
			writeExpr(
				[
					{name: 'a', op: 'on'},
					{name: 'b', op: 'eq', value: 'да'}
				],
				'or'
			)
		).toBe('$a or $b is "да"');
	});

	it('находит <<if>> с «иначе», вложенные и пропускает <<elseif>>', () => {
		const text = '<<if $a>>A<<if $b>>B<<else>>b<</if>><<else>>нет<</if>> <<if $v is 1>>1<<elseif $v is 2>>2<</if>>';
		const found = findConditions(text);

		expect(found).toHaveLength(2);
		expect(text.slice(found[0].contentFrom, found[0].contentTo)).toBe('A<<if $b>>B<<else>>b<</if>>');
		expect(text.slice(found[0].elseContentFrom!, found[0].to - 7)).toBe('нет');
		expect(found[1].expr).toBe('$b');
	});

	it('голова, «иначе», обёртка выделения', () => {
		const text = 'x <<if $a>>A<</if>> y';
		const [c] = findConditions(text);

		expect(replaceConditionHead(text, c, '$a and $b is 2')).toBe('x <<if $a and $b is 2>>A<</if>> y');

		const withElse = setConditionElse(text, c, true, 'Б');

		expect(withElse).toBe('x <<if $a>>A<<else>>Б<</if>> y');
		expect(setConditionElse(withElse, findConditions(withElse)[0], false, '')).toBe(text);
		expect(wrapCondition('ab', 0, 1, '$a', 'T').insert).toBe('<<if $a>>a<</if>>');
		expect(wrapCondition('ab', 1, 1, '$a', 'T').insert).toBe('<<if $a>>T<</if>>');
	});
});

describe('состояния', () => {
	it('пишет и читает <<switch>> с видами и «в остальных случаях»', () => {
		const text = writeStates({
			expr: '$PRCD',
			cases: [
				{value: '0', content: 'Данные повреждены', kind: 'red-big'},
				{value: '1', content: 'Нужен <<link "пароль">><</link>>', kind: ''},
				{content: 'Готово', kind: 'amber'}
			]
		});

		expect(text).toBe(
			'<<switch $PRCD>>\n<<case 0>><span class="red-big">Данные повреждены</span>\\\n<<case 1>>Нужен <<link "пароль">><</link>>\\\n<<default>><span class="amber">Готово</span>\\\n<</switch>>'
		);

		const [st] = findStates('до ' + text + ' после', ['red-big', 'amber']);

		expect(st.expr).toBe('$PRCD');
		expect(st.cases).toEqual([
			{value: '0', content: 'Данные повреждены', kind: 'red-big'},
			{value: '1', content: 'Нужен <<link "пароль">><</link>>', kind: ''},
			{value: undefined, content: 'Готово', kind: 'amber'}
		]);
		expect(writeStates(st)).toBe(text);
		expect(caseValue('2')).toBe('2');
		expect(caseValue('красный')).toBe('"красный"');
	});

	it('вложенный <<switch>> не путает состояния', () => {
		const text = '<<switch $a>><<case 1>><<switch $b>><<case 2>>x<</switch>><<case 3>>y<</switch>>';
		const [outer] = findStates(text);

		expect(outer.cases.map(c => c.value)).toEqual(['1', '3']);
	});
});

describe('значение переменной', () => {
	it('число, «из N», да-нет словами', () => {
		const a = writeValue({name: 'chapter', label: 'Глава'});
		const b = writeValue({name: 'found', label: 'Найдено', of: 5});
		const c = writeValue({name: 'log', label: 'Журнал', yes: 'найден', no: 'не найден'});
		const d = writeValue({name: 'x', label: ''});

		expect(a).toBe('<span class="sg-value">Глава: <<= $chapter>></span>');
		expect(b).toBe('<span class="sg-value">Найдено: <<= $found>> из 5</span>');
		expect(c).toBe('<span class="sg-value">Журнал: <<= $log ? "найден" : "не найден">></span>');
		expect(d).toBe('<span class="sg-value"><<= $x>></span>');

		const found = findValues([a, b, c, d].join('<br>'));

		expect(found.map(v => ({name: v.name, label: v.label, yes: v.yes, no: v.no, of: v.of}))).toEqual([
			{name: 'chapter', label: 'Глава', yes: undefined, no: undefined, of: undefined},
			{name: 'found', label: 'Найдено', yes: undefined, no: undefined, of: 5},
			{name: 'log', label: 'Журнал', yes: 'найден', no: 'не найден', of: undefined},
			{name: 'x', label: '', yes: undefined, no: undefined, of: undefined}
		]);
	});
});
