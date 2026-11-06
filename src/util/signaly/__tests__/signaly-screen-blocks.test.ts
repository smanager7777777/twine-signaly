import {
	blockAt,
	findBlocks,
	newBlock,
	readKr2,
	replaceBlock,
	variablesIn,
	writeBlock,
	writeKr2
} from '../signaly-screen-blocks';

describe('findBlocks', () => {
	it('reads an image command with keys', () => {
		const text = 'До <<sg-image "media/img/a.jpg" width 400 place screen corner tr x 120 y -5>> после';
		const [block] = findBlocks(text);

		expect(block.type).toBe('image');
		expect(block.values).toEqual({
			src: 'media/img/a.jpg',
			width: 400,
			place: 'screen',
			corner: 'tr',
			x: 120,
			y: -5
		});
		expect(text.slice(block.from, block.to)).toBe(
			'<<sg-image "media/img/a.jpg" width 400 place screen corner tr x 120 y -5>>'
		);
	});

	it('keeps unknown words', () => {
		const [block] = findBlocks('<<sg-video "a.mp4" loop strange 5>>');

		expect(block.values.loop).toBe(true);
		expect(block.extra).toEqual(['strange', '5']);
		expect(writeBlock(block)).toBe('<<sg-video "a.mp4" loop strange 5>>');
	});

	it('reads containers with content', () => {
		const text = '<<sg-alarm bg "#cc0000" close click>>\nТревога <<type 100ms>>x<</type>><</sg-alarm>>';
		const [block] = findBlocks(text);

		expect(block.type).toBe('alarm');
		expect(block.content).toBe('\nТревога <<type 100ms>>x<</type>>');
		expect(block.to).toBe(text.length);
		expect(writeBlock(block)).toBe(text);
	});

	it('reads the code table', () => {
		const text = [
			'<<sg-code button "Подтвердить" gap 4 password focus clear>>',
			'<<sg-case "11111" goto "gotoPSG">>',
			'<<sg-case "33333" title "Инфо">>33333',
			'<<sg-wrong title "Ошибка">>Неверный код: <<= _code || "пусто">>',
			'<</sg-code>>'
		].join('\n');
		const [block] = findBlocks(text);

		expect(block.values).toEqual({
			button: 'Подтвердить',
			gap: 4,
			password: true,
			focus: true,
			clear: true
		});
		expect(block.cases).toEqual([
			{kind: 'case', values: {code: '11111', goto: 'gotoPSG'}, extra: [], content: ''},
			{kind: 'case', values: {code: '33333', title: 'Инфо'}, extra: [], content: '33333'},
			{
				kind: 'wrong',
				values: {title: 'Ошибка'},
				extra: [],
				content: 'Неверный код: <<= _code || "пусто">>'
			}
		]);
		expect(writeBlock(block)).toBe(text);
	});

	it('keeps codes as strings', () => {
		const [block] = findBlocks('<<sg-code>><<sg-case "007" goto "A">><</sg-code>>');

		expect(block.cases![0].values.code).toBe('007');
		// Код из цифр пишется обратно в кавычках, нули не теряются.
		expect(writeBlock(block)).toContain('<<sg-case "007"');
	});

	it('skips a container without its closing command', () => {
		expect(findBlocks('<<sg-dialog "a">> текст')).toEqual([]);
	});

	it('finds the block under the cursor', () => {
		const text = 'a <<sg-image "x.jpg">> b <<sg-image "y.jpg">>';

		expect(blockAt(text, 5)?.values.src).toBe('x.jpg');
		expect(blockAt(text, 23)).toBeUndefined();
		expect(blockAt(text, 30)?.values.src).toBe('y.jpg');
	});

	it('handles quotes and >> inside strings', () => {
		const [block] = findBlocks('<<sg-dialog "a >> b" title "say \\"hi\\"">>x<</sg-dialog>>');

		expect(block.values.label).toBe('a >> b');
		expect(block.values.title).toBe('say "hi"');
		expect(writeBlock(block)).toBe('<<sg-dialog "a >> b" title "say \\"hi\\"">>x<</sg-dialog>>');
	});
});

describe('картинка-переключатель (шаг 5.4)', () => {
	it('слова читаются и пишутся обратно', () => {
		const text = '<<sg-image "a.jpg" second "b.jpg" toggle "$lamp" sound "c.wav" volume 80 width 100>>';
		const [block] = findBlocks(text);

		expect(block.values).toMatchObject({second: 'b.jpg', toggle: '$lamp', sound: 'c.wav', volume: 80});
		expect(findBlocks(writeBlock(block))[0].values).toMatchObject(block.values);
		expect(writeBlock(block)).toContain('toggle "$lamp"');
	});
});

describe('replaceBlock', () => {
	it('replaces only the block', () => {
		const text = 'x <<sg-image "a.jpg" width 10>> y';
		const [block] = findBlocks(text);
		const result = replaceBlock(text, block, {...block, values: {...block.values, width: 20}});

		expect(result.text).toBe('x <<sg-image "a.jpg" width 20>> y');
	});
});

describe('newBlock', () => {
	it('makes readable commands', () => {
		expect(writeBlock(newBlock('alarm'))).toBe(
			'<<sg-alarm bg "#cc0000" color "#000000" size 70 close click>>ТРЕВОГА<</sg-alarm>>'
		);
		for (const type of ['image', 'video', 'alarm', 'dialog', 'code'] as const) {
			const text = writeBlock(newBlock(type));

			expect(findBlocks(text)).toHaveLength(1);
			expect(writeBlock(findBlocks(text)[0])).toBe(text);
		}
	});
});

describe('KR2', () => {
	const passage =
		'<<kr2image "media/img/radio.jpg">>\n<<kr2vars>>Здоровье: $health<</kr2vars>>\n<<kr2main>>\nТекст\n<</kr2main>>\n\n[[Дверь]]';

	it('reads the template screen', () => {
		expect(readKr2(passage)).toEqual({
			image: 'media/img/radio.jpg',
			cols: 65,
			rows: 65,
			status: [{kind: 'text', text: 'Здоровье: $health'}],
			present: true
		});
		expect(readKr2('простой текст').present).toBe(false);
	});

	it('writes status rows and windows', () => {
		const kr2 = {
			...readKr2(passage),
			cols: 60,
			status: [
				{kind: 'text' as const, text: 'Реактор: $reactor'},
				{
					kind: 'window' as const,
					label: 'Подробно',
					title: 'Реактор',
					passage: 'REACTOR',
					button: true
				}
			]
		};
		const text = writeKr2(passage, kr2);

		expect(text).toContain(
			'<<kr2vars>>Реактор: $reactor\n<<sg-dialog "Подробно" title "Реактор" passage "REACTOR" button>><</sg-dialog>><</kr2vars>>'
		);
		expect(text.startsWith('<<kr2layout 60 65>>\n<<kr2image')).toBe(true);
		expect(readKr2(text)).toEqual({...kr2, present: true});
		// Без изменений текст тот же.
		expect(writeKr2(passage, readKr2(passage))).toBe(passage);
	});

	it('adds commands to a plain passage', () => {
		expect(
			writeKr2('Текст', {image: 'a.jpg', cols: 65, rows: 65, status: []})
		).toBe('<<kr2image "a.jpg">>\nТекст');
	});
});

describe('variablesIn', () => {
	it('lists variables once', () => {
		expect(variablesIn(['$b и $a', '<<set $a to 1>>'])).toEqual(['$a', '$b']);
	});
});

describe('кнопка на экране и вложенные блоки (сессия 6)', () => {
	it('читает и пишет <<sg-place>>', () => {
		const text = '<<sg-place kind amber corner tr x 5 y 2.75>><<link "РАД">><</link>><</sg-place>>';
		const [block] = findBlocks(text);

		expect(block.type).toBe('place');
		expect(block.values).toEqual({kind: 'amber', corner: 'tr', x: 5, y: 2.75});
		expect(block.content).toBe('<<link "РАД">><</link>>');
		expect(writeBlock(block)).toBe(text);
		expect(writeBlock({...block, values: {...block.values, kind: 'red-big'}})).toBe(
			'<<sg-place kind "red-big" corner tr x 5 y 2.75>><<link "РАД">><</link>><</sg-place>>'
		);
	});

	it('находит блоки внутри тревоги и выбирает самый внутренний', () => {
		const text = '<<sg-alarm close click>>А <<sg-dialog "Подробно">>Б<</sg-dialog>><</sg-alarm>>';
		const blocks = findBlocks(text);

		expect(blocks.map(b => b.type)).toEqual(['alarm', 'dialog']);
		expect(blockAt(text, text.indexOf('Подробно'))?.type).toBe('dialog');
		expect(blockAt(text, text.indexOf('А '))?.type).toBe('alarm');
	});

	it('условия у статусов KR2', () => {
		const text = writeKr2('', {
			image: '',
			cols: 65,
			rows: 65,
			status: [
				{kind: 'text', text: 'Журнал полёта: найден', when: {name: '$flightlog1'}},
				{kind: 'text', text: 'Глава 2', when: {name: '$chapter', value: '2'}},
				{kind: 'window', label: 'Реактор', title: '', passage: 'REACTOR', button: false, when: {name: '$room', value: 'реакторная'}}
			]
		});

		expect(text).toBe(
			'<<kr2vars>><<if $flightlog1>>Журнал полёта: найден<br><</if>>\\\n' +
				'<<if $chapter is 2>>Глава 2<br><</if>>\\\n' +
				'<<if $room is "реакторная">><<sg-dialog "Реактор" passage "REACTOR">><</sg-dialog>><br><</if>><</kr2vars>>\n'
		);
		expect(readKr2(text).status).toEqual([
			{kind: 'text', text: 'Журнал полёта: найден', when: {name: '$flightlog1', value: undefined}},
			{kind: 'text', text: 'Глава 2', when: {name: '$chapter', value: '2'}},
			{kind: 'window', label: 'Реактор', title: '', passage: 'REACTOR', button: false, when: {name: '$room', value: 'реакторная'}}
		]);
	});
});
