import {readFileSync} from 'fs';
import {join} from 'path';
import {
	findEffects,
	freeSwapId,
	idsIn,
	newEffect,
	newLinesEffect,
	parseTime,
	replaceEffect,
	writeEffect
} from '../signaly-effects';

const twee = readFileSync(
	join(__dirname, '../../../../signaly/template/27_03_2025.twee'),
	'utf8'
);

describe('signaly-effects', () => {
	it('читает время', () => {
		expect(parseTime('40ms')).toBe(0.04);
		expect(parseTime('2s')).toBe(2);
		expect(parseTime('"0.5s"')).toBe(0.5);
		expect(parseTime('t8n')).toBeUndefined();
	});

	it('печать: значения и непонятые слова', () => {
		const text = '<<type 40ms start 2s element "span" keep class "menu">>Текст<</type>>';
		const [effect] = findEffects(text);

		expect(effect.type).toBe('type');
		expect(effect.type_).toEqual({speed: 40, start: 2, cursor: 'keep', inline: true});
		expect(effect.extra).toEqual(['class', '"menu"']);
		expect(text.slice(effect.contentFrom, effect.contentTo)).toBe('Текст');

		const faster = replaceEffect(text, effect, {...effect, type_: {...effect.type_!, speed: 20}});

		expect(faster).toBe('<<type 20ms start 2s element "span" keep class "menu">>Текст<</type>>');
	});

	it('появление по очереди и смена текста', () => {
		const lines = newLinesEffect('а\nб\nв', '').insert;

		expect(lines).toBe('<<timed 1s>>а\n<<next>>б\n<<next>>в<</timed>>');

		const [timed] = findEffects(lines);

		expect(timed.type).toBe('timed');
		expect(timed.sections!.map(s => s.content)).toEqual(['а\n', 'б\n', 'в']);

		const slower = {...timed, sections: timed.sections!.map((s, i) => (i === 2 ? {...s, delay: 2.5} : s))};

		expect(replaceEffect(lines, timed, slower)).toBe(
			'<<timed 1s>>а\n<<next>>б\n<<next 2.5s>>в<</timed>>'
		);

		const swap = newEffect('swap', 'старый', 'текст', '', 'новый').insert;

		expect(swap).toBe(
			'<span id="sg-swap1">старый</span><<timed 3s>><<replace "#sg-swap1">>новый<</replace>><</timed>>'
		);

		const [effect] = findEffects(swap);

		expect(effect).toMatchObject({type: 'swap', target: 'sg-swap1', replacement: 'новый'});
		expect(freeSwapId(swap)).toBe('sg-swap2');
		expect(idsIn(swap)).toEqual(['sg-swap1']);
	});

	it('мигание и глитч', () => {
		const blink = newEffect('blink', 'Тревога', '', '', '').insert;
		const [b] = findEffects(blink);

		expect(blink).toBe('<span class="sg-blink">Тревога</span>');
		expect(replaceEffect(blink, b, {...b, period: 0.5})).toBe(
			'<span class="sg-blink" style="animation-duration: 0.5s">Тревога</span>'
		);

		const glitch = '<span class="glitchy" data-text="КУПИ МОЛОКО!!!">Навязчивая мысль...</span>';
		const [g] = findEffects(glitch);

		expect(g.shadow).toBe('КУПИ МОЛОКО!!!');
		expect(replaceEffect(glitch, g, {...g, shadow: 'Скажи "да"'})).toBe(
			'<span class="glitchy" data-text="Скажи &quot;да&quot;">Навязчивая мысль...</span>'
		);
	});

	it('вложенные эффекты находятся отдельно', () => {
		const text =
			'<<timed 5s>><<replace "#x">><<type 200ms none>>Почти<</type>><</replace>><</timed>>';
		const effects = findEffects(text);

		expect(effects.map(e => e.type)).toEqual(['swap', 'type']);
	});

	it('все эффекты шаблона записываются обратно без изменений', () => {
		const effects = findEffects(twee);

		expect(effects.length).toBeGreaterThan(15);
		effects.forEach(effect => {
			const content = twee.slice(effect.contentFrom, effect.contentTo);

			expect(writeEffect(effect, content)).toBe(twee.slice(effect.from, effect.to));
		});
	});
});
