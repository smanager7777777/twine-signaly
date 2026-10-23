import {
	alignAt,
	applyAlign,
	applyKind,
	Edit,
	insertRule,
	kindAt,
	missingAlignCss,
	setStyle,
	styleAt,
	toggleHeading,
	toggleList,
	toggleMark
} from '../signaly-format';

function apply(text: string, edit: Edit | undefined) {
	if (!edit) {
		return {text, sel: ''};
	}

	const result = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

	return {text: result, sel: result.slice(edit.selFrom, edit.selTo)};
}

/** «до ‹выделение› после» → текст и смещения. */
function sel(marked: string) {
	const from = marked.indexOf('‹');
	const to = marked.indexOf('›') - 1;

	return {text: marked.replace('‹', '').replace('›', ''), from, to};
}

describe('signaly-format', () => {
	it('жирный: обернуть и снять', () => {
		const s = sel('Это ‹важно› тут');
		const once = apply(s.text, toggleMark(s.text, s.from, s.to, 'bold'));

		expect(once).toEqual({text: "Это ''важно'' тут", sel: 'важно'});

		const from = once.text.indexOf('важно');
		const twice = apply(once.text, toggleMark(once.text, from, from + 5, 'bold'));

		expect(twice).toEqual({text: 'Это важно тут', sel: 'важно'});
	});

	it('цвет: обернуть, сменить, убрать', () => {
		const s = sel('‹Тревога›!');
		const red = apply(s.text, setStyle(s.text, s.from, s.to, 'color', '#cc0000'));

		expect(red).toEqual({text: '@@color:#cc0000;Тревога@@!', sel: 'Тревога'});

		const at = red.text.indexOf('Тревога');

		expect(styleAt(red.text, at, at + 7, 'color')).toBe('#cc0000');

		const big = apply(red.text, setStyle(red.text, at, at + 7, 'font-size', '150%'));

		expect(big.text).toBe('@@color:#cc0000;font-size:150%;Тревога@@!');

		const at2 = big.text.indexOf('Тревога');
		const plain = apply(big.text, setStyle(big.text, at2, at2 + 7, 'color', null));

		expect(plain.text).toBe('@@font-size:150%;Тревога@@!');

		const at3 = plain.text.indexOf('Тревога');

		expect(apply(plain.text, setStyle(plain.text, at3, at3 + 7, 'font-size', null))).toEqual({
			text: 'Тревога!',
			sel: 'Тревога'
		});
	});

	it('вид: обернуть, узнать, сменить, снять', () => {
		const kinds = ['amber', 'red-big'];
		const s = sel('‹[[Назад|Start]]›');
		const amber = apply(s.text, applyKind(s.text, s.from, s.to, 'amber', kinds, 'Ссылка'));

		expect(amber.text).toBe('<span class="amber">[[Назад|Start]]</span>');

		const at = amber.text.indexOf('Назад');

		expect(kindAt(amber.text, at, at, kinds)).toBe('amber');

		const red = apply(amber.text, applyKind(amber.text, at, at, 'red-big', kinds, ''));

		expect(red.text).toBe('<span class="red-big">[[Назад|Start]]</span>');
		expect(apply(red.text, applyKind(red.text, at + 2, at + 2, '', kinds, '')).text).toBe(
			'[[Назад|Start]]'
		);
		// Кнопка на экране сохраняется, снимается только вид.
		const both = '<span class="sg-place-rad amber"><<link "РАД">><</link>></span>';

		expect(apply(both, applyKind(both, 40, 40, '', kinds, '')).text).toBe(
			'<span class="sg-place-rad"><<link "РАД">><</link>></span>'
		);
	});

	it('вид без выделения вставляет образец ссылки', () => {
		const result = apply('', applyKind('', 0, 0, 'amber', ['amber'], 'Ссылка'));

		expect(result).toEqual({
			text: '<span class="amber"><<link "Ссылка">><</link>></span>',
			sel: 'Ссылка'
		});
	});

	it('выравнивание', () => {
		const text = 'первая\nвторая';
		const centered = apply(text, applyAlign(text, 9, 9, 'center'));

		expect(centered.text).toBe('первая\n<div class="center-text">вторая</div>');
		const at = centered.text.indexOf('вторая');

		expect(alignAt(centered.text, at, at)).toBe('center');
		expect(apply(centered.text, applyAlign(centered.text, at, at, 'center')).text).toBe(text);
		expect(missingAlignCss('.center-text {\n}', 'center')).toBe('');
		expect(missingAlignCss('', 'right')).toContain('.side-text');
	});

	it('заголовок, список, линия', () => {
		expect(apply('Раздел', toggleHeading('Раздел', 2, 2, 2)).text).toBe('!!Раздел');
		expect(apply('!!Раздел', toggleHeading('!!Раздел', 2, 2, 2)).text).toBe('Раздел');
		expect(apply('а\nб', toggleList('а\nб', 0, 3)).text).toBe('* а\n* б');
		expect(apply('* а\n* б', toggleList('* а\n* б', 0, 7)).text).toBe('а\nб');
		expect(apply('аб', insertRule('аб', 1)).text).toBe('а\n----\nб');
	});
});
