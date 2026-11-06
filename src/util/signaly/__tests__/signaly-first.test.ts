import {appearanceCss, defaultAppearance, readAppearance, withAppearance} from '../signaly-appearance';
import {
	firstCss,
	firstTag,
	firstValue,
	FirstWay,
	newFirstWay,
	sanitizeWays,
	tagsWithWay,
	wayOfTags
} from '../signaly-first';
import {copyNamed} from '../signaly-screens';

const way = (patch: Partial<FirstWay> = {}): FirstWay => ({...newFirstWay([], 'Способ'), ...patch});

describe('signaly-first', () => {
	it('новый способ: имя и тег свободны', () => {
		const first = newFirstWay([], 'Появление');
		const second = newFirstWay([first], 'Появление');

		expect(first.name).toBe('Появление 1');
		expect(first.mode).toBe('noise');
		expect(second.name).toBe('Появление 2');
		expect(second.id).not.toBe(first.id);
		expect(firstTag(first)).toBe(`sg-first-${first.id}`);
	});

	it('копия получает свой тег', () => {
		const first = way({id: 'shum', name: 'Шум'});
		const copy = copyNamed([first], first, 'копия');

		expect(copy.id).not.toBe(first.id);
		expect(copy.mode).toBe(first.mode);
	});

	it('значение для движка: режим, числа, цвет, щелчок, части', () => {
		expect(firstValue(way({mode: 'wave', time: 1.5, step: 0, delay: 2, power: 40, color: '#00ff00', skip: false, links: 'now', media: 'glitch'}))).toBe(
			'wave 1.5 0 2 40 #00ff00 0 - now glitch -'
		);
	});

	it('правила пишутся, только когда есть способы', () => {
		expect(firstCss([], '#0000ff', '#ff0000')).toEqual([]);

		const css = firstCss([way({id: 'a'})], '#0000ff', '#ff0000').join('\n');

		expect(css).toContain('--sg-fvs-1: #0000ff;');
		expect(css).toContain('--sg-first-a: noise 1 0.25 0 80 #ffffff 1 - - - -;');
	});

	it('тег ставится один, снимается только свой', () => {
		const a = way({id: 'a'});
		const b = way({id: 'b'});
		const tags = tagsWithWay(['kr2', 'sg-first-a'], b);

		expect(tags).toEqual(['kr2', 'sg-first-b']);
		expect(wayOfTags(tags, [a, b])).toBe(b);
		expect(tagsWithWay(tags, undefined)).toEqual(['kr2']);
		expect(wayOfTags(['kr2'], [a, b])).toBeUndefined();
	});

	it('разбор: чужое отбрасывается, числа в границах', () => {
		const list = sanitizeWays([
			{id: 'a', name: 'А', mode: 'nope', text: 'nope', links: 'now', time: 999, power: -5, color: 'x', skip: false},
			{id: 'a', name: 'повтор'},
			{name: 'без id'},
			'мусор'
		]);

		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({mode: 'noise', text: '', links: 'now', time: 30, power: 0, color: '#ffffff', skip: false});
		expect(sanitizeWays(undefined)).toEqual([]);
	});

	it('способы живут в блоке оформления и читаются обратно', () => {
		const a = {...defaultAppearance, firstWays: [way({id: 'a', name: 'Шум', links: 'now'})]};
		const css = withAppearance('', a);

		expect(appearanceCss(a)).toContain('--sg-first-a:');
		expect(readAppearance(css)?.firstWays).toEqual(a.firstWays);
		expect(readAppearance(withAppearance('', defaultAppearance))?.firstWays).toEqual([]);
	});
});
