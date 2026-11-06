import {readFileSync} from 'fs';
import {join} from 'path';
import {
	composeEffect,
	findEffects,
	freeSwapId,
	idsIn,
	newEffect,
	newLinesEffect,
	parseTime,
	replaceEffect,
	visibleText,
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

	// Сессия 7: «после эффектов выше», начало глитча и мигания, слои.
	it('после эффектов выше и начало глитча и мигания', () => {
		const text =
			'<<type 40ms after>>А<</type>><<timed 2s t8n after>>Б<</timed>>' +
			'<span class="glitchy" data-text="В" data-sg-start="1.5s" data-sg-after="1">В</span>' +
			'<span class="sg-blink" data-sg-start="2s">Г</span>';
		const effects = findEffects(text);

		expect(effects.map(e => [e.type, !!e.after, e.start])).toEqual([
			['type', true, undefined],
			['timed', true, undefined],
			['glitch', true, 1.5],
			['blink', false, 2]
		]);
		effects.forEach(e =>
			expect(writeEffect(e, text.slice(e.contentFrom, e.contentTo))).toBe(text.slice(e.from, e.to))
		);

		const [type, timed] = effects;

		expect(replaceEffect(text, type, {...type, after: false}).startsWith('<<type 40ms>>А')).toBe(true);
		// t8n у SugarCube — только вторым словом, after — после него.
		expect(writeEffect({...timed, fade: false}, '')).toBe('<<timed 2s after>>Б<</timed>>');
	});

	it('видимый текст для «тени» глитча', () => {
		expect(visibleText('Дальше: [[Открыть дверь|Дверь]]')).toBe('Дальше: Открыть дверь');
		expect(visibleText('<<link "Нажми" "Start">><<set $a to 1>><</link>>')).toBe('Нажми');
		expect(visibleText('<<type 40ms>>Привет<</type>>')).toBe('Привет');
		expect(visibleText('[[Назад->Start]] и [[Start<-Вперёд]]')).toBe('Назад и Вперёд');
	});

	const samples = {text: 'Текст', next: 'Новый текст', lines: 'а\nб'};
	const apply = (text: string, from: number, to: number, type: Parameters<typeof composeEffect>[0]) => {
		const made = composeEffect(type, text, from, to, samples);

		return text.slice(0, made.from) + made.insert + text.slice(made.to);
	};
	const sel = (text: string, part: string) => [text.indexOf(part), text.indexOf(part) + part.length] as const;

	it('второй эффект на тот же текст встаёт в свой слой', () => {
		const typed = '<<type 40ms>>Привет<</type>>';
		// Глитч — внутрь печати, «тень» — видимый текст.
		expect(apply(typed, ...sel(typed, 'Привет'), 'glitch')).toBe(
			'<<type 40ms>><span class="glitchy" data-text="Привет">Привет</span><</type>>'
		);
		// Появление — снаружи печати, даже если выделен только текст.
		expect(apply(typed, ...sel(typed, 'Привет'), 'timed')).toBe('<<timed 3s>>' + typed + '<</timed>>');
		// Выделено вместе с командами — то же самое.
		expect(apply(typed, 0, typed.length, 'timed')).toBe('<<timed 3s>>' + typed + '<</timed>>');

		const glitch = '<span class="glitchy" data-text="Х">Х</span>';
		// Печать — снаружи глитча.
		expect(apply(glitch, ...sel(glitch, '>Х<').map((v, i) => v + (i ? -1 : 1)) as [number, number], 'type')).toBe(
			'<<type 40ms>>' + glitch + '<</type>>'
		);

		const both = '<<timed 1s>><<type 40ms>>Х<</type>><</timed>>';
		// Глитч — в самую глубину, печать — между появлением и глитчем.
		expect(apply(both, ...sel(both, 'Х'), 'glitch')).toBe(
			'<<timed 1s>><<type 40ms>><span class="glitchy" data-text="Х">Х</span><</type>><</timed>>'
		);
	});

	it('смена текста поверх печати', () => {
		const text = '<span id="sg-swap1"><<type 40ms>>Старый<</type>></span><<timed 3s>><<replace "#sg-swap1">>Новый<</replace>><</timed>>';
		const made = apply(text, ...sel(text, 'Старый'), 'blink');

		expect(made).toBe(text.replace('>Старый<', '><span class="sg-blink">Старый</span><'));

		const typed = '<<type 40ms>>Старый<</type>>';

		expect(apply(typed, ...sel(typed, 'Старый'), 'swap')).toBe(
			'<span id="sg-swap1">' + typed + '</span><<timed 3s>><<replace "#sg-swap1">>Новый текст<</replace>><</timed>>'
		);
	});

	it('глитч на ссылке: «тень» — надпись ссылки', () => {
		const text = 'Иди [[Открыть дверь|Дверь]] сюда';

		expect(apply(text, ...sel(text, '[[Открыть дверь|Дверь]]'), 'glitch')).toBe(
			'Иди <span class="glitchy" data-text="Открыть дверь">[[Открыть дверь|Дверь]]</span> сюда'
		);
	});

	it('по очереди не режет команды пополам', () => {
		const lines = 'а\nб';

		expect(apply(lines, 0, 3, 'lines')).toBe('<<timed 1s>>а\n<<next>>б<</timed>>');

		const typed = '<<type 40ms>>а\nб<</type>>';

		expect(apply(typed, 0, typed.length, 'lines')).toBe('<<timed 1s>>' + typed + '<</timed>>');
	});

	describe('раскрытие по щелчку (этап 6)', () => {
		const samples = {text: 'Текст', next: 'Новый', lines: 'а\nб', label: '[РАСШИФРОВАТЬ]'};

		it('выделенный текст становится текстом раскрытия', () => {
			const made = composeEffect('reveal', 'до Тайна после', 3, 8, samples);

			expect(made.insert).toBe(
				'<span id="sg-reveal1"><<button "[РАСШИФРОВАТЬ]">><<replace "#sg-reveal1">>Тайна<</replace>><</button>></span>'
			);
			expect(made.from).toBe(3);
			expect(made.to).toBe(8);
		});

		it('без выделения — образец, номер свободный', () => {
			const text = '<span id="sg-reveal1">x</span>';

			expect(composeEffect('reveal', text, 0, 0, samples).insert).toContain('id="sg-reveal2"');
			expect(composeEffect('reveal', text, 0, 0, samples).insert).toContain('>>Текст<</replace>>');
		});

		it('читает и записывает обратно дословно', () => {
			const text =
				'а <span id="sg-reveal1"><span class="amber"><<link "[ОТКРЫТЬ \\"Х\\"]">><<replace "#sg-reveal1">>Тайна<</replace>><</link>></span></span> б';
			const [effect] = findEffects(text);

			expect(effect).toMatchObject({type: 'reveal', label: '[ОТКРЫТЬ "Х"]', kind: 'amber', button: false, target: 'sg-reveal1'});
			expect(text.slice(effect.contentFrom, effect.contentTo)).toBe('Тайна');
			expect(replaceEffect(text, effect, effect)).toBe(text);
			expect(text.slice(effect.linkFrom!).startsWith('<<link')).toBe(true);
		});

		it('меняет форму и вид, текст остаётся', () => {
			const text = '<span id="sg-reveal1"><<button "x">><<replace "#sg-reveal1">>Тайна<</replace>><</button>></span>';
			const [effect] = findEffects(text);

			expect(replaceEffect(text, effect, {...effect, button: false, kind: 'red-big'})).toBe(
				'<span id="sg-reveal1"><span class="red-big"><<link "x">><<replace "#sg-reveal1">>Тайна<</replace>><</link>></span></span>'
			);
		});

		it('эффекты внутри раскрытия видны отдельно, новый встаёт внутрь', () => {
			const inner = '<span class="sg-blink">Тайна</span>';
			const text = `<span id="sg-reveal1"><<button "x">><<replace "#sg-reveal1">>${inner}<</replace>><</button>></span>`;

			expect(findEffects(text).map(e => e.type)).toEqual(['reveal', 'blink']);

			const plain = '<span id="sg-reveal1"><<button "x">><<replace "#sg-reveal1">>Тайна<</replace>><</button>></span>';
			const at = plain.indexOf('Тайна');
			const made = composeEffect('type', plain, at, at + 5, samples);

			expect(made.from).toBe(at);
			expect(made.insert).toContain('<<type');
		});

		it('чужая разметка раскрытием не считается', () => {
			expect(findEffects('<span id="sg-reveal1"><<link "x">><<replace "#другой">>т<</replace>><</link>></span>')).toEqual([]);
			expect(findEffects('<span id="sg-reveal1"><<link "x">><<replace "#sg-reveal1">>т<</replace>>ещё<</link>></span>')).toEqual([]);
		});
	});
});
