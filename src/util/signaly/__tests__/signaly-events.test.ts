import {findEvent, parseEventArgs, setEventHead, writeEventHead} from '../signaly-events';
import {enteredCodes, findValues, parseExpr, writeExpr, writeValue} from '../signaly-logic';
import {needsPin} from '../signaly-codes';
import {parseAction, writeAction} from '../signaly-actions';

describe('событие', () => {
	it('разбирает слова перед условием', () => {
		expect(parseEventArgs(' $chapter is 2 and $repaired ')).toEqual({
			expr: '$chapter is 2 and $repaired',
			repeat: false,
			delay: 0,
			priority: 0
		});
		expect(parseEventArgs('repeat delay 5 priority -1 $x')).toEqual({expr: '$x', repeat: true, delay: 5, priority: -1});
		expect(parseEventArgs('delay 2,5 $x')).toMatchObject({delay: 2.5, expr: '$x'});
	});

	it('находит команду и разбирает условие', () => {
		const text = '<<sg-event priority 2 $a is ">>" and setup.visits("Реактор") gt 0>>\nТекст';
		const ev = findEvent(text)!;

		expect(ev.from).toBe(0);
		expect(text.slice(ev.to)).toBe('\nТекст');
		expect(ev.priority).toBe(2);
		expect(ev.conds).toEqual([
			{name: 'a', op: 'eq', value: '>>'},
			{name: '', kind: 'visits', screen: 'Реактор', op: 'on'}
		]);
		expect(findEvent('Просто текст')).toBeUndefined();
	});

	it('пишет, ставит первой строкой, меняет и убирает', () => {
		const head = {expr: '$x', repeat: false, delay: 0, priority: 0};

		expect(writeEventHead(head)).toBe('<<sg-event $x>>');
		expect(writeEventHead({...head, repeat: true, delay: 1.5, priority: 3})).toBe(
			'<<sg-event repeat delay 1.5 priority 3 $x>>'
		);

		const text = setEventHead('Экран события', head);

		expect(text).toBe('<<sg-event $x>>\nЭкран события');
		expect(setEventHead(text, {...head, delay: 5})).toBe('<<sg-event delay 5 $x>>\nЭкран события');
		expect(setEventHead(text, undefined)).toBe('Экран события');
		expect(setEventHead('', head)).toBe('<<sg-event $x>>');
	});
});

describe('условия заходов и кодов', () => {
	it('разбирает и записывает', () => {
		const expr =
			'setup.visits("A and B") gt 0 and setup.visits("B") is 0 and setup.visits("C") gte 3 and ' +
			'setup.visits("D") is 2 and setup.entered("2", "101") and not setup.entered("Иванов", "303")';
		const parsed = parseExpr(expr)!;

		expect(parsed.conds).toEqual([
			{name: '', kind: 'visits', screen: 'A and B', op: 'on'},
			{name: '', kind: 'visits', screen: 'B', op: 'off'},
			{name: '', kind: 'visits', screen: 'C', op: 'ge', value: 3},
			{name: '', kind: 'visits', screen: 'D', op: 'eq', value: 2},
			{name: '', kind: 'entered', person: '2', code: '101', op: 'on'},
			{name: '', kind: 'entered', person: 'Иванов', code: '303', op: 'off'}
		]);
		expect(writeExpr(parsed.conds, parsed.join)).toBe(expr);
		expect(parseExpr('setup.visits("A") lt 2')).toBeUndefined();
		// Строка в кавычках с « or » не режется.
		expect(parseExpr('$a is "x or y"')).toEqual({conds: [{name: 'a', op: 'eq', value: 'x or y'}], join: 'and'});
	});

	it('коды из условий спрашивают личный код', () => {
		const refs = enteredCodes(['<<if setup.entered("2", "101")>>', '<<sg-event not setup.entered(\'3\', \' 303 \')>>']);

		expect([...refs].sort()).toEqual(['101', '303']);

		const base = {who: [], once: '' as const, actions: [], answer: '', title: ''};

		expect(needsPin({...base, code: '101'}, refs)).toBe(true);
		expect(needsPin({...base, code: '205'}, refs)).toBe(false);
		expect(needsPin({...base, code: '101'})).toBe(false);
	});

	it('значение — число заходов', () => {
		const shown = writeValue({name: '', screen: 'Реактор', label: 'Заходов'});

		expect(shown).toBe('<span class="sg-value">Заходов: <<= setup.visits("Реактор")>></span>');
		expect(findValues(`x ${shown} y`)).toEqual([
			{from: 2, to: 2 + shown.length, label: 'Заходов', name: '', screen: 'Реактор', yes: undefined, no: undefined, of: undefined}
		]);
		expect(findValues('<span class="sg-value">Глава: <<= $chapter>> из 5</span>')[0]).toMatchObject({
			name: 'chapter',
			screen: undefined,
			of: 5
		});
	});

	it('действие «Вернуться»', () => {
		expect(parseAction('<<sg-back>>')).toEqual({type: 'back', raw: '<<sg-back>>'});
		expect(writeAction({type: 'back'})).toBe('<<sg-back>>');
	});
});
