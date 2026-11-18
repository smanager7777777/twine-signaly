// «Twine СИГНАЛЫ», сессия 32 (этап Т2): данные приложения в истории — пакет .sgpack
// «туда и обратно без потерь» (пакеты — тестовые из релиза signaly-app build-38).

import {readFileSync} from 'fs';
import {join} from 'path';
import {
	AppGame,
	appBlockTag,
	appSettingsName,
	appSettingsTag,
	diffGames,
	gameToStory,
	hasAppData,
	jsonText,
	readBlock,
	readSgpack,
	sameGame,
	storyToGame,
	StoryPassage,
	withDefaults,
	writeBlock,
	writeSgpack
} from '../signaly-app';
import {
	codesPassageName,
	codesTag,
	readCodes,
	writeCodes
} from '../signaly-codes';

const fixture = (name: string) =>
	new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

/** Применить загрузку пакета к списку пассажей (как окно «Приложение»). */
function apply(passages: StoryPassage[], game: AppGame, files: string[]) {
	const r = gameToStory(passages, game, files);
	let out = passages.filter(p => !r.removeBlocks.includes(p.name));
	const put = (
		name: string,
		tags: string[],
		text: string,
		existing?: string
	) => {
		const at = out.findIndex(p => p.name === (existing ?? name));

		if (at === -1) {
			out = [...out, {name, tags, text}];
		} else {
			out[at] = {
				...out[at],
				name,
				text,
				tags: out[at].tags.includes(tags[0])
					? out[at].tags
					: [...out[at].tags, ...tags]
			};
		}
	};

	put(
		appSettingsName,
		[appSettingsTag],
		r.settingsText,
		passages.find(p => p.tags.includes(appSettingsTag))?.name
	);
	put(
		codesPassageName,
		[codesTag],
		r.codesText,
		passages.find(p => p.tags.includes(codesTag))?.name
	);
	r.blocks.forEach(b => put(b.name, [appBlockTag], b.text, b.existing));
	return {passages: out, result: r};
}

/** Номера персонажей, которых не было в пакете, — как их раздаёт загрузка. */
function withNums(game: AppGame, built: AppGame) {
	return {
		...game,
		accounts: game.accounts.map((a: AppGame) => ({
			...a,
			num: built.accounts.find((b: AppGame) => b.id === a.id).num
		}))
	};
}

describe('пакет приложения в истории (Т2)', () => {
	it('JSON без < > [ ] в строках и без [[ между скобками', () => {
		const text = jsonText({
			a: 'x <<b>> [[c]]',
			b: [[1, 2]],
			c: '\\n "кавычки" \'апостроф\''
		});

		expect(text).not.toMatch(/[<>]|\[\[|\]\]/);
		expect(JSON.parse(text)).toEqual({
			a: 'x <<b>> [[c]]',
			b: [[1, 2]],
			c: '\\n "кавычки" \'апостроф\''
		});
	});

	it('test-pack: загрузка в пустую историю и сборка обратно — то же самое', () => {
		const pack = readSgpack(fixture('app-test-pack.sgpack'));
		const {passages, result} = apply([], pack.game, Object.keys(pack.files));
		const built = storyToGame(
			passages,
			result.files.map(f => f.path)
		);

		expect(built.problems).toEqual([]);
		expect(result.numbered).toEqual(['Медик Тест → 1']);
		expect(
			sameGame(built.game, withDefaults(withNums(pack.game, built.game)))
		).toBe(true);
		expect(built.files.map(f => f.name).sort()).toEqual([
			'plan.png',
			'signal.mp3'
		]);
		expect(
			passages.filter(p => p.tags.includes(appBlockTag)).map(p => p.name)
		).toEqual([
			'Находки/Повреждённое устройство',
			'Схемы/Отсек 1/План отсека',
			'Журнал планшета',
			'Схемы/Данные второй главы'
		]);
		expect(
			passages.find(p => p.name === 'Схемы/Отсек 1/План отсека')!.text
		).toContain('<<app-img "media/app/plan.png"');
		expect(hasAppData(passages)).toBe(true);
		expect(hasAppData([])).toBe(false);
	});

	it('test-net-pack: персонажам без номера даются номера, остальное то же', () => {
		const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
		const {passages, result} = apply([], pack.game, []);
		const built = storyToGame(passages, []).game;

		expect(result.numbered).toEqual([
			'Медик Тест → 2',
			'Пилот Тест → 3',
			'Связист Тест → 4'
		]);
		expect(sameGame(built, withDefaults(withNums(pack.game, built)))).toBe(
			true
		);
		// Код «для терминала», голосовые коды без цифр и одинаковые коды приборов — все на месте.
		expect(
			built.codes.filter((c: AppGame) => c.code === 'BADGE-A')
		).toHaveLength(3);
		expect(
			built.codes.find((c: AppGame) => c.voice === 'сигнал терминалу').term
		).toBe(true);
	});

	it('сотрудник терминала и персонаж — одна запись, тот же код на терминале — код «оба»', () => {
		const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
		const codes =
			'/* таблица */\n<<sg-person "1" pin "417" var "$progress1">>\n<<sg-person "7" pin "999">>\n' +
			'<<sg-entry "4242" "Терминальный">>\n<<set $x to 1>>\n<<sg-answer>>На терминале\n<</sg-entry>>';
		const {passages} = apply(
			[{name: 'Коды', tags: [codesTag], text: codes}],
			pack.game,
			[]
		);
		const table = readCodes(passages.find(p => p.name === 'Коды')!.text);

		expect(table.people.map(p => [p.id, p.pin, !!p.phone])).toEqual([
			['1', '417', true],
			['7', '999', false],
			['2', '', true],
			['3', '', true],
			['4', '', true]
		]);

		const both = table.codes.find(c => c.code === '4242')!;

		expect(both.where).toBe('both');
		expect(both.label).toBe('Терминальный');
		expect(both.answer).toBe('На терминале');
		expect(JSON.parse(both.phone!).answer).toBe('ГОЛОС: КОД ПРИНЯТ');

		// Окно «Коды» сохранило таблицу без правок — телефонная часть на месте.
		const again = writeCodes(
			passages.find(p => p.name === 'Коды')!.text,
			table
		);
		const built = storyToGame(
			passages.map(p => (p.name === 'Коды' ? {...p, text: again} : p))
		).game;

		expect(built.codes.find((c: AppGame) => c.code === '4242').answer).toBe(
			'ГОЛОС: КОД ПРИНЯТ'
		);
		expect(built.accounts.find((a: AppGame) => a.id === 'aA').num).toBe('1');

		// Правка в окне «Коды» (ответ терминала) — тоже без потерь.
		both.answer = 'Новое';
		delete both.raw;
		table.people[0].pin = '418';
		delete table.people[0].raw;

		const edited = writeCodes(
			passages.find(p => p.name === 'Коды')!.text,
			table
		);
		const t2 = readCodes(edited);

		expect(t2.codes.find(c => c.code === '4242')!.answer).toBe('Новое');
		expect(
			JSON.parse(t2.codes.find(c => c.code === '4242')!.phone!).answer
		).toBe('ГОЛОС: КОД ПРИНЯТ');
		expect(JSON.parse(t2.people[0].phone!).name).toBe('Инженер Тест');

		// Повторная загрузка: пакет без кода 4242 — на терминале код остаётся, без телефона.
		const fewer = {
			...pack.game,
			codes: pack.game.codes.filter((c: AppGame) => c.code !== '4242'),
			accounts: pack.game.accounts.slice(1)
		};
		const {passages: p2} = apply(passages, fewer, []);
		const t3 = readCodes(p2.find(p => p.name === 'Коды')!.text);

		expect(t3.codes.find(c => c.code === '4242')!.where).toBeFalsy();
		expect(t3.codes.find(c => c.code === '4242')!.phone).toBeUndefined();
		// Инженер ушёл из пакета — сотрудник №1 с личным кодом остался, без телефона.
		expect(t3.people.find(p => p.id === '1')!.phone).toBeUndefined();
		expect(t3.people.find(p => p.id === '1')!.pin).toBe('417');
	});

	it('повторная загрузка: блоки по id, лишние убираются, отличия видны', () => {
		const pack = readSgpack(fixture('app-test-pack.sgpack'));
		const first = apply([], pack.game, Object.keys(pack.files)).passages;
		const was = storyToGame(first).game;
		const next: AppGame = JSON.parse(JSON.stringify(pack.game));

		next.blocks[0].title = 'Разбитое устройство';
		next.blocks.splice(2, 1);
		next.glitches.push({
			id: 'gX',
			name: 'Новый сбой',
			kind: 'visual',
			fx: ['noise'],
			text: '',
			seconds: 5,
			fix: 'time',
			state: false,
			chapters: [],
			every: 0,
			who: []
		});
		next.title = 'Другое название';

		const diff = diffGames(was, withNums(next, was), {}, {});

		expect(diff.find(d => d.section === 'Общие настройки')!.changed).toEqual([
			'title'
		]);
		expect(diff.find(d => d.section === 'Блоки')).toEqual({
			section: 'Блоки',
			added: [],
			removed: ['Журнал планшета'],
			changed: ['Находки/Разбитое устройство']
		});
		expect(diff.find(d => d.section === 'Сбои')!.added).toEqual(['Новый сбой']);

		const {passages, result} = apply(first, next, []);

		expect(result.removeBlocks).toEqual(['Журнал планшета']);
		expect(
			passages.filter(p => p.tags.includes(appBlockTag)).map(p => p.name)
		).toEqual([
			'Находки/Разбитое устройство',
			'Схемы/Отсек 1/План отсека',
			'Схемы/Данные второй главы'
		]);
		expect(diffGames(storyToGame(passages).game, withNums(next, was))).toEqual(
			[]
		);
	});

	it('текст блока: пустой текст, два текста подряд, свои поля, повтор названия', () => {
		const block = {
			id: 'b1',
			title: 'Блок',
			section: 'А/Б',
			who: ['aA', 'zz'],
			chapter: 2,
			start: true,
			share: true,
			garble: 3,
			extraField: {x: 1},
			items: [
				{type: 'text', text: ''},
				{type: 'text', text: 'строка 1\n\nстрока 3\n'},
				{type: 'image', file: 'a b.png', caption: 'подпись "в кавычках"'},
				{type: 'text', text: '<<app-img "не команда">>'},
				{type: 'audio', file: 'x.mp3', title: '', loop: true},
				{type: 'text', text: 'конец', mark: 1}
			]
		};
		const nums: Record<string, string> = {aA: '1'};
		const text = writeBlock(block, id => nums[id] ?? id, 'А/Б/Блок (2)');

		expect(text.split('\n')[0]).toBe(
			'<<app-block "b1" who "1, zz" chapter 2 start share garble 3 title "Блок" more \'{"extraField":{"x":1}}\'>>'
		);
		expect(
			readBlock('А/Б/Блок (2)', text, n => (n === '1' ? 'aA' : n))
		).toEqual(block);
	});

	it('zip: пакет собирается и читается тем же', () => {
		const pack = readSgpack(fixture('app-test-pack.sgpack'));
		const again = readSgpack(writeSgpack(pack.game, pack.files));

		expect(again.game).toEqual(pack.game);
		expect(Object.keys(again.files).sort()).toEqual(['plan.png', 'signal.mp3']);
		expect(again.files['signal.mp3']).toEqual(pack.files['signal.mp3']);
	});
});

describe('проверка истории и пассажи приложения', () => {
	it('блоки, «Приложение» и коды телефона — не ошибки терминала', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const {checkStory} = require('../signaly-check');
		const pack = readSgpack(fixture('app-test-pack.sgpack'));
		const {passages} = apply([], pack.game, Object.keys(pack.files));

		expect(
			checkStory({passages, script: '', stylesheet: '', media: []})
		).toEqual([]);
	});
});

describe('«Телефонам: …» и названия из приложения', () => {
	it('сбой с неверным названием — в проверке истории', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const {checkStory} = require('../signaly-check');
		const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
		const {passages} = apply([], pack.game, []);
		const screen = {
			name: 'Экран',
			tags: [],
			text: '<<link "a">><<sg-net glitch "сбой экрана">><<sg-net glitch "Глитч">><<sg-net open "Секретный отчёт, Нет такого" "x">><</link>>'
		};

		expect(
			checkStory({passages: [...passages, screen], script: '', stylesheet: ''})
		).toEqual([
			{kind: 'phone', passage: 'Экран', detail: 'сбой «Глитч»'},
			{kind: 'phone', passage: 'Экран', detail: 'блок «Нет такого»'}
		]);
	});
});
