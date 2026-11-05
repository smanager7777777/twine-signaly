import {signalyEngineBlock} from '../signaly-engine';
import {
	copyNews,
	defaultCycle,
	defaultLine,
	newNews,
	newsConds,
	readTicker,
	TickerData,
	tickerHeader,
	tickerProblems,
	validCycle,
	writeNews,
	writeTicker
} from '../signaly-ticker';

const sample: TickerData = {
	line: {...defaultLine('Start'), height: 60, font: 'media/fonts/a b.woff2', mode: 'scroll', order: ['general', 'new', 'seen']},
	cycle: {...defaultCycle, variable: 'progress', spin: 4, rate: 30, sound: 'media/audio/c.wav', volume: 70, rows: [{progress: 0, value: '00012'}, {progress: 7, value: '00487'}]},
	news: [
		{...newNews([]), name: 'Общее "1"', text: 'Текст <<= $x>> и "кавычки"', general: true},
		{
			...newNews([]),
			name: 'ВИП',
			text: 'Для ВИП',
			expr: '$vip and setup.visits("Экран >> 1") gt 0',
			priority: 2,
			minutes: 10,
			times: 3,
			color: '#ff0000',
			bold: true,
			italic: true,
			effect: 'glitch'
		}
	]
};

describe('строка событий', () => {
	it('запись и чтение возвращают то же самое', () => {
		const text = writeTicker('', sample);

		expect(text.startsWith(tickerHeader)).toBe(true);
		expect(readTicker(text, 'Другой')).toEqual(sample);
	});

	it('пишет понятные движку команды', () => {
		const text = writeTicker('', sample);

		expect(text).toContain('<<sg-ticker screen "Start" height 60 size 22 font "media/fonts/a b.woff2" speed 60 pause 2 hold 8 change 1.5 mode scroll order "general,new,seen">>');
		expect(text).toContain('<<sg-cycle var "$progress" spin 4 rate 30 sound "media/audio/c.wav" volume 70>>');
		expect(text).toContain('<<sg-cycle-at 7 "00487">>');
		expect(writeNews(sample.news[1])).toBe(
			'<<sg-news "ВИП" priority 2 minutes 10 times 3 color "#ff0000" bold italic effect glitch>>$vip and setup.visits("Экран >> 1") gt 0<<sg-text>>Для ВИП<</sg-news>>'
		);
	});

	it('без настроек — значения по умолчанию, главный экран — стартовый', () => {
		const data = readTicker('', 'Start');

		expect(data.line).toEqual(defaultLine('Start'));
		expect(data.cycle).toEqual(defaultCycle);
		expect(data.news).toEqual([]);
	});

	it('повторная запись не копит строки и оставляет чужой текст', () => {
		const once = writeTicker('Заметка автора\n', sample);
		const twice = writeTicker(once, readTicker(once, 'Start'));

		expect(twice).toBe(once);
		expect(once.startsWith('Заметка автора\n')).toBe(true);
		expect(once.match(/<<sg-ticker/g)).toHaveLength(1);
	});

	it('без переменной цикл не записывается', () => {
		const text = writeTicker('', {...sample, cycle: {...sample.cycle, variable: ''}});

		expect(text).not.toContain('<<sg-cycle');
	});

	it('неверный порядок показа заменяется обычным', () => {
		expect(readTicker('<<sg-ticker screen "S" order "new,new">>', 'S').line.order).toEqual(['new', 'general', 'seen']);
	});

	it('копия получает своё название', () => {
		const a = {...newNews([]), name: 'А'};
		const b = copyNews([a], a);

		expect(b.name).toBe('А (копия)');
		expect(copyNews([a, b], a).name).toBe('А (копия 2)');
		expect(newNews([a, {...a, name: 'Сообщение 3'}]).name).toBe('Сообщение 4');
	});

	it('условие: пусто, строки, код', () => {
		expect(newsConds('')).toEqual({conds: [], join: 'and'});
		expect(newsConds('$a gt 1')?.conds).toHaveLength(1);
		expect(newsConds('$a gt 1 or ($b and $c)')).toBeUndefined();
	});

	it('находит ошибки', () => {
		const p = tickerProblems({
			...sample,
			news: [{...sample.news[0], name: 'А'}, {...sample.news[1], name: 'А'}, {...sample.news[1], name: ' '}],
			cycle: {...sample.cycle, rows: [{progress: 1, value: '12a'}, {progress: 1, value: '1'}]}
		});

		expect(p).toEqual({emptyName: true, duplicateNames: ['А'], badCycle: true, duplicateProgress: [1]});
		expect(validCycle('00487')).toBe(true);
		expect(validCycle('004870')).toBe(false);
	});
});

describe('движок: код строки событий', () => {
	it('не перекрывает имена функций и переменных остального движка', () => {
		const block = signalyEngineBlock();
		const from = block.indexOf('/* ----- Строка событий и цикл');
		const to = block.indexOf('// Всегда с выбранного экрана');
		const section = block.slice(from, to);
		const names = [...section.matchAll(/^\t(?:function|var) (\w+)/gm)].map(m => m[1]);
		const rest = block.slice(0, from) + block.slice(to);

		expect(names.length).toBeGreaterThan(20);
		expect(names.filter(n => new RegExp(`(?:function|var) ${n}\\b`).test(rest))).toEqual([]);
	});
});
