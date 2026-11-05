import {fakePassage} from '../../../test-util';
import {
	accessDefaults,
	accessSources,
	findAccess,
	newAccess,
	setAccess,
	withRule,
	writeAccess
} from '../signaly-access';
import {signalyEngineBlock} from '../signaly-engine';

const data = (patch = {}) => ({...newAccess('$open'), ...patch});

describe('команда доступа', () => {
	it('читается и пишется без потерь', () => {
		const a = data({
			lock: 'Рано',
			groups: {...accessDefaults, link: 'off', code: 'wrong'},
			rules: [
				{kind: 'link', id: 'Назад', from: 'Start', action: 'off'},
				{kind: 'code', id: '205', action: 'block', to: 'Рано 2'},
				{kind: 'key', id: 'Shift+Z+A', action: 'stay'},
				{kind: 'auto', id: 'timer:Clocks', action: 'block'}
			]
		});
		const written = writeAccess(a as any);

		expect(written).toBe(
			'<<sg-access lock "Рано" links off codes wrong>>$open\n' +
				'<<sg-rule link "Назад" from "Start" do off>>\n' +
				'<<sg-rule code "205" do block to "Рано 2">>\n' +
				'<<sg-rule key "Shift+Z+A" do stay>>\n' +
				'<<sg-rule auto "timer:Clocks" do block>>\n' +
				'<</sg-access>>'
		);

		const read = findAccess(written)!;

		expect(read.expr).toBe('$open');
		expect(read.lock).toBe('Рано');
		expect(read.groups.link).toBe('off');
		expect(read.groups.code).toBe('wrong');
		expect(read.groups.key).toBe('pass');
		expect(read.rules).toEqual(a.rules);
	});

	it('значения по умолчанию не пишутся', () => {
		expect(writeAccess(data())).toBe('<<sg-access>>$open<</sg-access>>');
	});

	it('условие понимается формой; код остаётся кодом', () => {
		const simple = findAccess('<<sg-access>>$a gt 1 and $b<</sg-access>>')!;

		expect(simple.conds).toHaveLength(2);
		expect(simple.join).toBe('and');
		expect(findAccess('<<sg-access>>Math.random() > 0.5 ? $a : $b<</sg-access>>')!.conds).toBeUndefined();
	});

	it('незнакомое поведение остаётся значением по умолчанию', () => {
		const read = findAccess('<<sg-access links fly>>$a<<sg-rule key "A" do hide>><</sg-access>>')!;

		expect(read.groups.link).toBe('hide');
		expect(read.rules[0].action).toBe('pass');
	});

	it('нет закрывающей команды — команды нет', () => {
		expect(findAccess('<<sg-access>>$a')).toBeUndefined();
		expect(findAccess('просто текст')).toBeUndefined();
	});
});

describe('setAccess', () => {
	it('новая команда — первой строкой, без пустой строки на экране', () => {
		expect(setAccess('Текст', data())).toBe('<<sg-access>>$open<</sg-access>>\\\nТекст');
		expect(setAccess('', data())).toBe('<<sg-access>>$open<</sg-access>>');
	});

	it('замена оставляет остальной текст', () => {
		const once = setAccess('Текст', data());
		const twice = setAccess(once, data({expr: '$other'}));

		expect(twice).toBe('<<sg-access>>$other<</sg-access>>\\\nТекст');
	});

	it('снятие возвращает текст как был', () => {
		expect(setAccess(setAccess('Текст\nещё', data()), undefined)).toBe('Текст\nещё');
		expect(setAccess('Текст', undefined)).toBe('Текст');
		expect(setAccess(setAccess('', data()), undefined)).toBe('');
	});

	it('с правилами команда в несколько строк снимается целиком', () => {
		const text = setAccess('Текст', data({rules: [{kind: 'code', id: '1', action: 'wrong'}]}));

		expect(text.split('\n')).toHaveLength(4);
		expect(setAccess(text, undefined)).toBe('Текст');
	});
});

describe('withRule', () => {
	const source = {kind: 'link', id: 'А', from: 'Б'} as const;

	it('ставит, заменяет и снимает', () => {
		const one = withRule([], source, 'off');

		expect(one).toEqual([{...source, action: 'off'}]);
		expect(withRule(one, source, 'block', 'Рано')).toEqual([{...source, action: 'block', to: 'Рано'}]);
		expect(withRule(one, source, undefined)).toEqual([]);
	});

	it('свой пассаж — только у блокировки', () => {
		expect(withRule([], source, 'off', 'Рано')).toEqual([{...source, action: 'off'}]);
	});

	it('та же надпись на другом экране — другой источник', () => {
		const one = withRule([], source, 'off');

		expect(withRule(one, {...source, from: 'В'}, 'hide')).toHaveLength(2);
	});
});

describe('accessSources', () => {
	const passages = [
		fakePassage({name: 'Start', text: '[[Вперёд|Цель]]\n<<button "Кнопка" "Цель">><</button>>\n[[Мимо|Другой]]', tags: []}),
		fakePassage({name: 'Боковой', text: '<<link "Вперёд" "Цель">><<set $x to 1>><</link>>', tags: []}),
		fakePassage({
			name: 'Поле',
			text: '<<sg-code table>><<sg-case "301" goto "Цель">>Да<<sg-case "302" goto "Другой">>Нет<</sg-code>>\n<<sg-timer "Часы" seconds 5 goto "Цель">>',
			tags: []
		}),
		fakePassage({name: 'Тревога', text: '<<sg-alarm close click goto "Цель">>Ой<</sg-alarm>>', tags: []}),
		fakePassage({
			name: 'Коды',
			text: '<<sg-entry "205" "Конверт" goto "Цель">><</sg-entry>>\n<<sg-entry "206" "" goto "Другой">><</sg-entry>>',
			tags: ['sg-codes']
		}),
		fakePassage({
			name: 'Горячие клавиши',
			text: '<<sg-key "Shift+Z+A" "Мастер" goto "Цель">><</sg-key>>\n[[Служебная|Цель]]',
			tags: ['sg-keys']
		}),
		fakePassage({name: 'Цель', text: 'Экран', tags: []})
	];
	const found = accessSources(passages as any, 'Цель');

	it('находит ссылки, кнопки, коды, клавиши, таймер и тревогу', () => {
		expect(found.map(s => `${s.kind}:${s.from ?? ''}:${s.id}`).sort()).toEqual(
			[
				'link:Start:Вперёд',
				'link:Start:Кнопка',
				'link:Боковой:Вперёд',
				'code::301',
				'code::205',
				'key::Shift+Z+A',
				'auto::timer:Часы',
				'auto::alarm:Тревога'
			].sort()
		);
	});

	it('подписывает код и клавишу, отмечает кнопку', () => {
		expect(found.find(s => s.id === '205')!.label).toBe('205 — Конверт');
		expect(found.find(s => s.kind === 'key')!.label).toBe('Shift+Z+A — Мастер');
		expect(found.find(s => s.id === 'Кнопка')!.note).toBe('button');
	});

	it('одинаковое не повторяется', () => {
		const twice = accessSources(
			[fakePassage({name: 'А', text: '[[Да|Цель]] и [[Да|Цель]]', tags: []})] as any,
			'Цель'
		);

		expect(twice).toHaveLength(1);
	});
});

describe('движок', () => {
	it('имена раздела доступа не занимают чужие функции', () => {
		const names = (signalyEngineBlock().match(/\bfunction (\w+)\(/g) ?? []).map(s => s.slice(9, -1));

		expect(new Set(names.filter(n => n.startsWith('access'))).size).toBe(names.filter(n => n.startsWith('access')).length);
		expect(names.filter(n => n === 'isBr')).toHaveLength(1);
	});

	it('команда доступа объявлена до выхода из предпросмотра', () => {
		const engine = signalyEngineBlock();

		expect(engine.indexOf("Macro.add('sg-access'")).toBeLessThan(engine.lastIndexOf('if (preview) {'));
	});
});
