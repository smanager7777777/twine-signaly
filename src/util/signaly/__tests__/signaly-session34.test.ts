// «Twine СИГНАЛЫ», сессия 34 (= П12, этап Т3 — окончание): «+ Картинка» туда, где курсор (Т3-10 А),
// папки блоков деревом (Т3-11 А), проверка данных приложения, QR и код звуком (Т3-8 А).

import {readFileSync} from 'fs';
import {join} from 'path';
import {TextDecoder, TextEncoder} from 'util';
import {appBlockTag, gameToStory, readSgpack, storyToGame} from '../signaly-app';
import {appProblems, storyAppProblems} from '../signaly-app-check';
import {addBlockMedia, blockTree, newBlockIn, readBlockHead, renameFolder} from '../signaly-app-model';
import {qrCaption, qrFileName, qrList, qrMatrix, defaultQrLook} from '../signaly-app-qr';
import {decodeModem, encodeModem} from '../signaly-modem';
import {checkStory} from '../signaly-check';
import {codesTag, readCodes} from '../signaly-codes';

Object.assign(globalThis, {TextEncoder, TextDecoder});   // jsdom без них

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

describe('«+ Картинка» туда, где курсор', () => {
	const text = '<<app-block "b1">>\nпервая\nвторая\nтретья';
	const item = {type: 'image' as const, file: 'p.png', caption: ''};

	it('курсор внутри строки — после неё, в начале строки — перед ней', () => {
		expect(addBlockMedia(text, item, {line: 1, ch: 3}).split('\n')).toEqual(['<<app-block "b1">>', 'первая', '<<app-img "media/app/p.png" "">>', 'вторая', 'третья']);
		expect(addBlockMedia(text, item, {line: 2, ch: 0}).split('\n')).toEqual(['<<app-block "b1">>', 'первая', '<<app-img "media/app/p.png" "">>', 'вторая', 'третья']);
	});

	it('не выше первой строки блока; в конце — как раньше', () => {
		expect(addBlockMedia(text, item, {line: 0, ch: 0}).split('\n')[1]).toBe('<<app-img "media/app/p.png" "">>');
		expect(addBlockMedia(text, item, {line: 3, ch: 6})).toBe(text + '\n<<app-img "media/app/p.png" "">>');
		expect(addBlockMedia(text, item)).toBe(text + '\n<<app-img "media/app/p.png" "">>\n');
	});
});

describe('папки блоков', () => {
	const head = (id: string, rest = '') => `<<app-block "${id}"${rest}>>\nтекст`;
	const passages = [
		{id: 'p1', name: 'Схемы/Отсек 1/План', tags: [appBlockTag], text: head('b1')},
		{id: 'p2', name: 'Схемы/Отсек 1/Двери', tags: [appBlockTag], text: head('b2', ' start')},
		{id: 'p3', name: 'Схемы/Общая', tags: [appBlockTag], text: head('b3')},
		{id: 'p4', name: 'Сводка', tags: [appBlockTag], text: head('b4')},
		{id: 'p5', name: 'Повтор (2)', tags: [appBlockTag], text: head('b5', ' title "План" folder "Схемы/Отсек 1"')},
		{id: 'p6', name: 'Архив/План', tags: [appBlockTag], text: head('b6')},
		{id: 'p7', name: 'Экран', tags: [], text: 'не блок'}
	];

	it('дерево со счётчиками; папка из слова folder', () => {
		const t = blockTree(passages);

		expect(t.count).toBe(6);
		expect(t.blocks.map(b => b.title)).toEqual(['Сводка']);
		expect(t.folders.map(f => [f.name, f.count])).toEqual([['Архив', 1], ['Схемы', 4]]);
		const schemes = t.folders.find(f => f.name === 'Схемы')!;

		expect(schemes.count).toBe(4);
		expect(schemes.folders[0]).toMatchObject({path: 'Схемы/Отсек 1', count: 3});
		expect(schemes.folders[0].blocks.map(b => b.title)).toEqual(['Двери', 'План', 'План']);
	});

	it('переименование папки целиком: имена пассажей, слово folder, занятое имя — « (2)» и слова', () => {
		const ch = renameFolder(passages, 'Схемы/Отсек 1', 'Архив');
		const by = (id: string) => ch.find(c => c.id === id)!;

		expect(ch.length).toBe(3);
		expect(by('p2')).toEqual({id: 'p2', name: 'Архив/Двери'});
		expect(by('p1').name).toBe('Архив/План (2)');
		expect(readBlockHead(by('p1').text!)!.rest).toEqual(['title', '"План"', 'folder', '"Архив"']);
		expect(by('p5').name).toBeUndefined();
		expect(readBlockHead(by('p5').text!)!.rest).toEqual(['title', '"План"', 'folder', '"Архив"']);
		expect(renameFolder(passages, 'Схемы', 'Схемы')).toEqual([]);
		expect(renameFolder(passages, 'Схемы', 'Планы').map(c => c.name).filter(Boolean).sort()).toEqual(['Планы/Общая', 'Планы/Отсек 1/Двери', 'Планы/Отсек 1/План']);
	});

	it('новый блок в папке — свободное имя и новый номер', () => {
		const b = newBlockIn(passages, 'Схемы/Отсек 1', 'План');

		expect(b.name).toBe('Схемы/Отсек 1/План (2)');
		expect(readBlockHead(b.text)).toMatchObject({id: b.id, rest: ['title', '"План"', 'folder', '"Схемы/Отсек 1"']});
		expect(newBlockIn(passages, '', '').name).toBe('Новый блок');
	});
});

describe('проверка данных приложения', () => {
	const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
	const r = gameToStory([], pack.game, Object.keys(pack.files));
	const passages = [
		{name: 'Коды', tags: [codesTag], text: r.codesText},
		{name: 'Приложение', tags: ['app-settings'], text: r.settingsText},
		...r.blocks.map(b => ({name: b.name, tags: [appBlockTag], text: b.text}))
	];

	it('то же, что «Проверка» редактора приложения (SG.problems) на test-pack и test-net-pack', () => {
		// Ожидаемое — из signaly-app (сессия П12): SG.problems(SG.normalize(game.json), files).
		for (const name of ['app-test-pack', 'app-test-net-pack']) {
			const p = readSgpack(fixture(`${name}.sgpack`));
			const s = gameToStory([], p.game, Object.keys(p.files));
			const list = [
				{name: 'Коды', tags: [codesTag], text: s.codesText},
				{name: 'Приложение', tags: ['app-settings'], text: s.settingsText},
				...s.blocks.map(b => ({name: b.name, tags: [appBlockTag], text: b.text}))
			];
			const got = appProblems(storyToGame(list).game, new Set(Object.keys(p.files))).map(x => `${x.level}: ${x.text}`);

			expect(got).toEqual(expected(name));
		}
	});

	it('ошибки: повтор кода, пустой вход, удалённый блок, нет файла; место — пассаж', () => {
		const game = storyToGame(passages).game;

		game.accounts[1].login = game.accounts[0].login;
		game.accounts[0].items = [{type: 'image', file: 'нет.png'}];
		game.codes.push({id: 'kx', code: '', voice: '', opens: ['b-нет'], comment: 'сломанный'});

		const texts = appProblems(game, new Set()).map(p => p.text);

		expect(texts.some(t => /повторяется: вход/.test(t))).toBe(true);
		expect(texts).toContain('Пустой код телефона («сломанный»)');
		expect(texts).toContain('Код «сломанный» открывает удалённый блок');
		expect(texts.some(t => /нет файла media\/app\/нет\.png/.test(t))).toBe(true);

		const story = storyAppProblems(passages, []);

		expect(story.every(p => passages.some(x => x.name === p.passage))).toBe(true);
	});

	it('в «Проверке истории» — раздел «Приложение для телефонов»', () => {
		const list = checkStory({passages, script: '', stylesheet: ''}).filter(p => p.kind === 'app');

		expect(list.length).toBe(expected('app-test-net-pack').length);
		expect(list.every(p => p.level === 'error' || p.level === 'warn')).toBe(true);
	});
});

describe('QR и код звуком', () => {
	const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
	const r = gameToStory([], pack.game, Object.keys(pack.files));

	it('список кодов для QR: коды, приборы, входы, главы, мастер', () => {
		const list = qrList(pack.game, readCodes(r.codesText));
		const groups = new Set(list.map(x => x.group));

		expect([...groups].sort()).toEqual(['chapters', 'codes', 'devices', 'logins', 'master'].filter(g => groups.has(g as never)).sort());
		expect(list.filter(x => x.group === 'logins').length).toBe(pack.game.accounts.length);
		expect(list.some(x => x.group === 'master' && x.code === pack.game.masterCode)).toBe(true);
		expect(new Set(list.map(x => x.key)).size).toBe(list.length);
	});

	it('матрица QR, подпись, имя файла', () => {
		const m = qrMatrix('4242');

		expect(m.length).toBeGreaterThanOrEqual(21);
		expect(m[0][0] && m[0][6] && !m[1][1]).toBe(true);   // угловой квадрат
		expect(qrCaption({...defaultQrLook, caption: 'label'}, '4242', '')).toBe('4242');
		expect(qrFileName('A/B', 'Дверь: 1')).toBe('QR-A_B-Дверь_ 1.jpg');
	});

	it('код звуком — туда и обратно (формат приложения)', () => {
		for (const code of ['4242', 'СЛАВА ЛИДЕРУ']) {
			const lead = new Float32Array(4410);
			const snd = encodeModem(code, 44100, 0.7);
			const all = new Float32Array(lead.length * 2 + snd.length);

			all.set(snd, lead.length);
			expect(decodeModem(all, 44100)).toEqual([code]);
		}
	});
});

function expected(name: string): string[] {
	return JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.problems.json`), 'utf8'));
}
