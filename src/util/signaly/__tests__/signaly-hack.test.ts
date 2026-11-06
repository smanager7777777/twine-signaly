import fs from 'fs';
import path from 'path';
import {accessSources} from '../signaly-access';
import {hackLengths, hackWords, moveTemplateHack} from '../signaly-hack';
import {renameScreen} from '../signaly-rename';
import {
	findBlocks,
	gridSpots,
	hackDefaults,
	listMissing,
	newBlock,
	writeBlock
} from '../signaly-screen-blocks';
import {fakePassage} from '../../../test-util';

const sample = `Перед
<<sg-hack words "РАДАР, ОТСЕК" key "РАДАР" count 2 attempts 4 columns 3 hint "left" win "Успех" fail "Провал" missfx "ripple" frame usedglitch>>
<<sg-hack-win>><<set $ok to 1>>
<<sg-hack-fail>><<set $fails += 1>>
<<sg-hack-miss>><<set $errors += 1>>
<</sg-hack>>
После`;

describe('блок «Терминал взлома»', () => {
	it('читает настройки и действия', () => {
		const [block] = findBlocks(sample);

		expect(block.type).toBe('hack');
		expect(block.values).toMatchObject({key: 'РАДАР', count: 2, columns: 3, hint: 'left', win: 'Успех', frame: true, usedglitch: true});
		expect(block.hack).toEqual({win: '<<set $ok to 1>>', fail: '<<set $fails += 1>>', miss: '<<set $errors += 1>>'});
		expect(block.extra).toEqual([]);
	});

	it('запись повторяет блок', () => {
		const [block] = findBlocks(sample);
		const again = findBlocks(writeBlock(block))[0];

		expect(again.values).toEqual(block.values);
		expect(again.hack).toEqual(block.hack);
	});

	it('пустые действия не пишутся, новая строка в надписи сохраняется', () => {
		const text = writeBlock({
			type: 'hack',
			values: {wintext: 'Один\nДва'},
			extra: [],
			hack: {win: '', fail: '', miss: ''}
		});

		expect(text).not.toContain('sg-hack-win');
		expect(findBlocks(text)[0].values.wintext).toBe('Один\nДва');
	});

	it('части блока — не отдельные блоки', () => {
		expect(findBlocks(sample)).toHaveLength(1);
	});

	it('заготовка: столбцы, квадратики, глитч', () => {
		const block = newBlock('hack');

		expect(block.values).toMatchObject({columns: 2, triesshow: 'boxes', usedglitch: true, frame: true});
		expect(hackWords(block.values.words)).toHaveLength(6);
	});

	it('значения по умолчанию — как в «Хактесте»', () => {
		expect(hackDefaults).toMatchObject({attempts: 3, rows: 10, cols: 60, delay: 1});
		expect(hackDefaults.wintext).toBe('Доступ разрешён!\nПароль: {слово}');
	});
});

describe('слова', () => {
	it('разделяются запятой, пробелом, новой строкой, без повторов', () => {
		expect(hackWords('А, Б В\nГ;Д А')).toEqual(['А', 'Б', 'В', 'Г', 'Д']);
		expect(hackWords(undefined)).toEqual([]);
	});

	it('длина без нужного числа слов не выпадает', () => {
		expect(hackLengths(hackWords('ДОМ ЛЕС ОКНО СТОЛ ПАРК'), 3)).toEqual([
			{size: 3, found: 2, usable: false},
			{size: 4, found: 3, usable: true}
		]);
	});

	it('слов меньше, чем вариантов: берётся самая полная длина', () => {
		expect(hackLengths(hackWords('ДОМ ЛЕС ОКНО'), 5).map(l => l.usable)).toEqual([true, false]);
	});
});

describe('перенос «Хактеста»', () => {
	const original = fs.readFileSync(path.join(__dirname, 'fixtures/template-hack.txt'), 'utf8').replace(/\s+$/, '');

	it('весь код совпал — блок, текст под ним остаётся', () => {
		const moved = moveTemplateHack(original);
		const [block] = findBlocks(moved);

		expect(block.values).toMatchObject({
			words: 'ЧЕХИЯ, ХУЙНЯ, ПАРИЯ, СОННЯ, КУХНЯ',
			count: 5,
			attempts: 3,
			rows: 10,
			cols: 60,
			win: 'Start',
			fail: 'Blocktest'
		});
		// Ключевое слово случайное (ответ 6).
		expect(block.values.key).toBeUndefined();
		expect(moved.endsWith('<</sg-hack>>\\\nТекст под таймером')).toBe(true);
		expect(moveTemplateHack(moved)).toBe(moved);
	});

	it('другой код не трогается', () => {
		const changed = original.replace('attemptsLeft--', 'attemptsLeft -= 2');

		expect(moveTemplateHack(changed)).toBe(changed);
	});

	it('экраны берутся из кода', () => {
		const other = original.replace('Engine.play("Start")', 'Engine.play("Дальше")');

		expect(findBlocks(moveTemplateHack(other))[0].values.win).toBe('Дальше');
	});
});

describe('связи с другими частями', () => {
	it('«Доступ» видит терминал взлома', () => {
		const list = accessSources([fakePassage({name: 'Взлом', text: sample})], 'Успех');

		expect(list).toEqual([{kind: 'auto', id: 'hack:Взлом', label: 'Взлом', note: 'hack'}]);
	});

	it('переименование меняет экраны блока и правило «Доступа»', () => {
		expect(renameScreen(sample, 'Успех', 'Победа')).toContain('win "Победа"');
		expect(renameScreen(sample, 'Провал', 'Конец')).toContain('fail "Конец"');
		expect(renameScreen('<<sg-rule auto "hack:Взлом" do stay>>', 'Взлом', 'Сейф')).toContain('"hack:Сейф"');
	});
});

describe('недостающие экраны списка', () => {
	const rows = ['А', 'Б', '', 'Б', 'В'].map(passage => ({values: {passage: passage || undefined}, extra: []}));

	it('только те, которых нет, без повторов', () => {
		expect(listMissing(rows, ['А'])).toEqual(['Б', 'В']);
		expect(listMissing(rows, ['А', 'Б', 'В'])).toEqual([]);
	});

	it('сетка по 10 в ряд', () => {
		const spots = gridSpots({left: 1000, top: 0}, 12);

		expect(spots[0]).toEqual({left: 1000, top: 0});
		expect(spots[9]).toEqual({left: 2125, top: 0});
		expect(spots[10]).toEqual({left: 1000, top: 125});
	});
});
