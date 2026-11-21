// «Twine СИГНАЛЫ», сессия 40 (= П21): формы новых полей приложения П20 (app/05 П-79), личные переменные
// «у каждого своя» в окне «Переменные» (Т31-1 А), личные на терминале (Т31-2 А, Т31-3 А), бегущая строка
// с терминала (Т31-5 А). Движок 35. Пакет — test-net-pack из релиза signaly-app build-76 (П20).

import {readFileSync} from 'fs';
import {join} from 'path';
import {TextDecoder, TextEncoder} from 'util';
import {
	AppGame,
	appBlockTag,
	appSettingsName,
	appSettingsTag,
	diffGames,
	gameToStory,
	readSgpack,
	storyToGame,
	StoryPassage
} from '../signaly-app';
import {codesPassageName, codesTag} from '../signaly-codes';
import {parseAction, writeAction} from '../signaly-actions';
import {parseExpr, writeExpr} from '../signaly-logic';
import {readVariables, sharedVariables, Variable, withShared, withVariables} from '../signaly-variables';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';
import {signalyNetModule} from '../signaly-net-module';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

function apply(passages: StoryPassage[], game: AppGame, files: string[]) {
	const r = gameToStory(passages, game, files);
	let out = passages.filter(p => !r.removeBlocks.includes(p.name));
	const put = (name: string, tags: string[], text: string) => {
		const at = out.findIndex(p => p.name === name);

		out = at === -1 ? [...out, {name, tags, text}] : out.map((p, i) => (i === at ? {...p, text} : p));
	};

	put(appSettingsName, [appSettingsTag], r.settingsText);
	put(codesPassageName, [codesTag], r.codesText);
	r.blocks.forEach(b => put(b.name, [appBlockTag], b.text));
	if (r.initText !== undefined) {
		put('StoryInit', [], r.initText);
	}
	return {passages: out, result: r};
}

describe('личные переменные в окне «Переменные» (Т31-1 А)', () => {
	const vars: Variable[] = [
		{name: 'power', label: 'Энергия', value: 5, shared: true},
		{name: 'hacks', label: 'Взломы', value: 0, shared: true, personal: true, byAcc: {aT: 1}, maxBy: {aT: 5}},
		{name: 'note', label: '', value: "a'b <<c>> [[d]]", shared: true, personal: true, byAcc: {aA: "x'y [z]"}, maxBy: {}}
	];

	it('строки <<sg-shared>> и <<sg-personal>>: туда и обратно', () => {
		const text = withVariables('', vars);

		expect(text).toContain('<<sg-shared "power">> /* общие с телефонами */');
		expect(text).toContain('<<sg-personal "hacks" by \'{"aT":1}\' max \'{"aT":5}\'>> /* у каждого своя */');
		expect(/<<sg-personal "note" by '([^']*)'>>/.exec(text)![1]).not.toMatch(/[[\]<>]/);
		expect(readVariables(text).variables).toEqual(vars);
	});

	it('в пакете — personal, byAcc, maxBy; обычные общие — как раньше', () => {
		const text = withVariables('', vars);

		expect(sharedVariables(text)).toEqual([
			{name: 'power', label: 'Энергия', value: 5},
			{name: 'hacks', label: 'Взломы', value: 0, personal: true, byAcc: {aT: 1}, maxBy: {aT: 5}},
			{name: 'note', label: '', value: "a'b <<c>> [[d]]", personal: true, byAcc: {aA: "x'y [z]"}, maxBy: {}}
		]);
		expect(withShared(text, sharedVariables(text))).toBeUndefined();
		expect(withShared(text, [{name: 'hacks', label: 'Взломы', value: 0, personal: true, byAcc: {aT: 2}}])).toContain("by '{\"aT\":2}'");
	});
});

describe('пакет П20 (test-net-pack build-76) — туда и обратно', () => {
	it('личные, события, бегущая строка, «После ввода», тестировщик, «за N мин» — без потерь', () => {
		const pack = readSgpack(fixture('app-test-net-pack-p20.sgpack'));
		const {passages, result} = apply([], pack.game, Object.keys(pack.files));
		const built = storyToGame(passages, result.files.map(f => f.path)).game;
		const nums = {...pack.game, accounts: pack.game.accounts.map((a: AppGame) => ({...a, num: built.accounts.find((b: AppGame) => b.id === a.id).num}))};

		expect(passages.find(p => p.name === 'StoryInit')!.text).toContain('<<sg-personal "hacks" by \'{"aT":1}\' max \'{"aT":5}\'>>');
		expect(built.shared.find((v: AppGame) => v.name === 'hacks')).toEqual({name: 'hacks', label: 'Взломы', value: 0, personal: true, byAcc: {aT: 1}, maxBy: {aT: 5}});
		expect(built.ticker).toEqual(pack.game.ticker);
		expect(built.notices.find((n: AppGame) => n.id === 'n3')).toMatchObject({img: 'ev.png', mp3: 'ev.mp3', playNow: true, folder: 'Объявления'});
		expect(built.codes.find((c: AppGame) => c.code === 'NOWB').after).toBe('now');
		expect(built.accounts.find((a: AppGame) => a.tester)?.name).toBe('Психолог Тест');
		expect(diffGames(built, nums)).toEqual([]);
	});

	it('новые поля по умолчанию — не отличие (пакет старого редактора)', () => {
		const a = {
			codes: [{id: 'k1', code: '1', when: [{var: 'x', op: '>=', value: '1'}]}],
			notices: [{id: 'n1', name: 'Н'}],
			rules: [{id: 'r', on: 'var', var: 'x', op: '=', value: '1', actions: []}],
			accounts: [{id: 'a1', name: 'И'}],
			header: {items: [{id: 'h', var: 'x'}]},
			shared: [{name: 'x', label: '', value: 0}]
		};
		const b = {
			codes: [{id: 'k1', code: '1', when: [{var: 'x', op: '>=', value: '1', win: 0, acc: ''}], after: ''}],
			notices: [{id: 'n1', name: 'Н', img: '', mp3: '', playNow: false, ticker: false, open: true, repeat: 0, leaveMin: 0, leaveOpen: false, leaveChapter: false, save: true, folder: ''}],
			rules: [{id: 'r', on: 'var', var: 'x', op: '=', value: '1', actions: [], win: 0, acc: ''}],
			accounts: [{id: 'a1', name: 'И', tester: false}],
			header: {items: [{id: 'h', var: 'x', win: 0}], size: 'normal', maxItems: 0},
			ticker: {speed: 60, color: '', k: 5, chapter: 1, who: [], adsEvery: 0, adsOrder: 'seq', ads: []},
			shared: [{name: 'x', label: '', value: 0, personal: false, byAcc: {}, maxBy: {}}]
		};

		expect(diffGames(a, b)).toEqual([]);
		expect(diffGames(a, {...b, header: {...b.header, size: 'compact'}}).length).toBe(1);
		expect(diffGames(a, {...b, ticker: {...b.ticker, k: 3}}).length).toBe(1);
	});
});

describe('терминал: личная переменная, бегущая строка, условия (Т31-2…Т31-5)', () => {
	it('действие «Личная переменная» — туда и обратно', () => {
		['<<sg-personal-add "hacks" 1>>', '<<sg-personal-add "hacks" -2 "3">>', '<<sg-personal-set "hacks" 0 "all">>', '<<sg-personal-set "flag" true "3">>'].forEach(s => {
			const a = parseAction(s);

			expect(a.type).toBe('personal');
			expect(writeAction({...a, raw: undefined})).toBe(s);
		});
		expect(parseAction('<<sg-personal-add "hacks" 1>>')).toMatchObject({name: 'hacks', op: 'add', value: 1, who: ''});
		expect(parseAction('<<sg-personal-add "hacks" "x">>').type).toBe('code');
	});

	it('уведомление: ticker и repeat', () => {
		const s = '<<sg-net notify "Новости" "Текст" ticker repeat 3 to "2, 3">>';
		const a = parseAction(s);

		expect(a).toMatchObject({type: 'net', op: 'notify', ticker: true, repeat: 3, to: '2, 3'});
		expect(writeAction({...a, raw: undefined})).toBe(s);
		expect(writeAction({...parseAction('<<sg-net notify "А" "Б" ticker>>'), raw: undefined})).toBe('<<sg-net notify "А" "Б" ticker>>');
		expect(parseAction('<<sg-net notify "А" "Б" repeat 3>>').type).toBe('code');
		expect(writeAction({...parseAction('<<sg-net notify "А" "Б">>'), raw: undefined})).toBe('<<sg-net notify "А" "Б">>');
	});

	it('условие sgPersonal / sgPersonalWin', () => {
		const p = parseExpr('sgPersonal("hacks", "3") gte 2 and sgPersonalWin("hacks", "3", 5) lt 3')!;

		expect(p.conds).toEqual([
			{name: 'hacks', kind: 'personal', person: '3', op: 'ge', value: 2},
			{name: 'hacks', kind: 'personal', person: '3', op: 'lt', value: 3, minutes: 5}
		]);
		expect(writeExpr(p.conds, p.join)).toBe('sgPersonal("hacks", "3") gte 2 and sgPersonalWin("hacks", "3", 5) lt 3');
		expect(parseExpr('sgPersonalWin("hacks", "3") gte 2')).toBeUndefined();
	});

	it('«Тест терминала» (Т30-1 А, Т31-4 А): движок в истории — нынешний', () => {
		const twee = readFileSync(join(__dirname, '../../../../signaly/tests/test-terminal/test-terminal.twee'), 'utf8');

		expect(twee).toContain(`Версия движка: ${signalyEngineVersion}.`);
		expect(twee).toContain('<<sg-personal "hacks"');
		expect(twee).toContain(':: Т1 Личные');
	});

	it('движок 36: личные, модуль сети П20', () => {
		expect(signalyEngineVersion).toBe(36);
		['sg-personal-add', 'sg-personal-set', "Macro.add('sg-personal'", 'window.sgPersonalWin', 'ticker: true'].forEach(s => expect(signalyEngineBlock()).toContain(s));
		['N.personalAdd', 'N.win', 'sg-net-padd'].forEach(s => expect(signalyNetModule).toContain(s));
	});
});
