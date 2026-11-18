// «Twine СИГНАЛЫ», сессия 33 (этап Т3): формы приложения — первая строка блока, картинки и
// звук блока, телефонная часть кодов и персонажей; пакет после правки формами собирается.

import {readFileSync} from 'fs';
import {join} from 'path';
import {appBlockTag, gameToStory, jsonText, readBlock, readSgpack, storyToGame, StoryPassage} from '../signaly-app';
import {
	accountsOf,
	addBlockMedia,
	appRefs,
	blockMedia,
	codesOpening,
	hasBlockHead,
	newAccount,
	newBlockId,
	readBlockHead,
	removeBlockHead,
	setBlockMedia,
	voiceHints,
	writeBlockHead
} from '../signaly-app-model';
import {codesTag, newEntry, readCodes, writeCodes} from '../signaly-codes';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

describe('первая строка блока', () => {
	const text = '<<app-block "b1" who "1, 3" chapter 2 start title "План" more \'{"x":1}\'>>\nТекст блока\n<<app-img "media/app/plan.png" "Схема">>\nещё';

	it('читается и пишется без потерь', () => {
		const head = readBlockHead(text)!;

		expect(head).toEqual({
			id: 'b1',
			who: ['1', '3'],
			chapter: 2,
			start: true,
			share: false,
			garble: 0,
			rest: ['title', '"План"', 'more', '\'{"x":1}\'']
		});
		expect(writeBlockHead(text, head)).toBe(text);
	});

	it('правка формы меняет только первую строку, readBlock видит то же', () => {
		const head = readBlockHead(text)!;
		const next = writeBlockHead(text, {...head, who: [], chapter: 1, share: true, garble: 3});

		expect(next.split('\n').slice(1)).toEqual(text.split('\n').slice(1));
		expect(next.split('\n')[0]).toBe('<<app-block "b1" start share garble 3 title "План" more \'{"x":1}\'>>');

		const block = readBlock('Папка/Имя', next, n => `a${n}`)!;

		expect(block).toMatchObject({id: 'b1', title: 'План', section: 'Папка', who: [], chapter: 1, share: true, garble: 3, x: 1});
	});

	it('добавляется в пустой пассаж и в пассаж с текстом, убирается', () => {
		const head = {id: 'bX', who: [], chapter: 1, start: false, share: false, garble: 0, rest: []};

		expect(writeBlockHead('', head)).toBe('<<app-block "bX">>\n');
		expect(writeBlockHead('Старый текст', head)).toBe('<<app-block "bX">>\nСтарый текст');
		expect(hasBlockHead('Старый текст')).toBe(false);
		expect(removeBlockHead('<<app-block "bX">>\nСтарый текст')).toBe('Старый текст');
	});

	it('новый id не совпадает с уже занятыми', () => {
		const passages: StoryPassage[] = [{name: 'A', tags: [appBlockTag], text: '<<app-block "b1">>'}];

		expect(newBlockId(passages)).not.toBe('b1');
	});
});

describe('картинки и звук блока', () => {
	const text = '<<app-block "b1">>\nТекст\n<<app-img "media/app/plan.png" "Схема">>\n<<app-audio "media/app/s.mp3" "Запись" more \'{"loop":true}\'>>';

	it('строки читаются, правятся и убираются', () => {
		const media = blockMedia(text);

		expect(media.map(m => [m.line, m.type, m.file, m.caption])).toEqual([
			[2, 'image', 'plan.png', 'Схема'],
			[3, 'audio', 's.mp3', 'Запись']
		]);

		const edited = setBlockMedia(text, 3, {...media[1], caption: 'Эфир'});

		expect(edited.split('\n')[3]).toBe('<<app-audio "media/app/s.mp3" "Эфир" more \'{"loop":true}\'>>');
		expect(readBlock('X', edited, n => n)!.items[2]).toEqual({type: 'audio', file: 's.mp3', title: 'Эфир', loop: true});
		expect(setBlockMedia(text, 2, undefined).includes('plan.png')).toBe(false);
	});

	it('новая строка — в конец текста', () => {
		const next = addBlockMedia('<<app-block "b1">>\nТекст', {type: 'image', file: 'x.jpg', caption: ''});

		expect(next).toBe('<<app-block "b1">>\nТекст\n<<app-img "media/app/x.jpg" "">>\n');
		expect(readBlock('X', next, n => n)!.items).toEqual([
			{type: 'text', text: 'Текст'},
			{type: 'image', file: 'x.jpg', caption: ''}
		]);
	});
});

describe('телефон в «Кодах» и сборка пакета', () => {
	const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
	const r = gameToStory([], pack.game, Object.keys(pack.files));
	const passages: StoryPassage[] = [
		{name: 'Коды', tags: [codesTag], text: r.codesText},
		{name: 'Приложение', tags: ['app-settings'], text: r.settingsText},
		...r.blocks.map(b => ({name: b.name, tags: [appBlockTag], text: b.text}))
	];

	it('персонажи и списки для форм', () => {
		const table = readCodes(r.codesText);
		const refs = appRefs(passages, table);

		expect(accountsOf(table).map(a => a.name)).toEqual(pack.game.accounts.map((a: {name: string}) => a.name));
		expect(refs.chapters.length).toBe(pack.game.chapters.length);
		expect(refs.blocks.length).toBe(pack.game.blocks.length);
		expect(refs.glitches.map(g => g.name)).toEqual(pack.game.glitches.map((g: {name: string}) => g.name));
	});

	it('правка формой: код «только телефон», новый персонаж — попадают в пакет', () => {
		const table = readCodes(r.codesText);
		const acc = newAccount(new Set());

		table.people.push({id: '9', pin: '', variable: '', extra: [], phone: jsonText({...acc, name: 'Новый'})});
		table.codes.push({
			...newEntry(),
			code: '9090',
			label: 'новый код',
			where: 'phone',
			phone: jsonText({id: 'k9', answer: 'Ответ <b>[[x]]</b>', who: [acc.id], opens: [pack.game.blocks[0].id], limit: 1})
		});

		const text = writeCodes(r.codesText, table);
		const built = storyToGame(passages.map(p => (p.name === 'Коды' ? {...p, text} : p))).game;
		const code = built.codes.find((c: {code: string}) => c.code === '9090');

		expect(text.includes('[[')).toBe(false);
		expect(code).toMatchObject({id: 'k9', comment: 'новый код', answer: 'Ответ <b>[[x]]</b>', who: [acc.id], limit: 1});
		expect(built.accounts.find((a: {name: string}) => a.name === 'Новый')).toMatchObject({num: '9', id: acc.id});
		expect(codesOpening(readCodes(text), pack.game.blocks[0].id).some(s => s.startsWith('9090'))).toBe(true);
	});
});

describe('подсказки к словам фразы', () => {
	it('как у редактора приложения', () => {
		expect(voiceHints('стлрт', 'слава СТЛРТ lider 42 пркл').map(h => h.why)).toEqual(['unknown', 'latin', 'digits', 'abbr']);
	});
});
