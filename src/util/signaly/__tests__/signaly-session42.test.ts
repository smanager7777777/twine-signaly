// «Twine СИГНАЛЫ», сессия 42 (= П23): Т32-1 А — «Опубликовать пакет» кладёт в пакет окна «за N мин» из условий
// терминала (sgPersonalWin), центр считает их точно (app/05 П-81, П-82); модуль сети — снова копия signaly-app.

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
	StoryPassage,
	terminalWindows,
	writeSettings
} from '../signaly-app';
import {codesPassageName, codesTag} from '../signaly-codes';
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

describe('окна «за N мин» из условий терминала (Т32-1 А)', () => {
	it('находятся во всех пассажах: кавычки, номер числом, повторы — одним, 0 мин — нет', () => {
		const p = (text: string) => ({name: 'x', tags: [], text});
		const w = terminalWindows(
			[
				p('<<if sgPersonalWin("hacks", "3", 5) gte 2>>…<</if>> <<if sgPersonalWin("hacks", "3", 5) lt 4>>'),
				p("<<if sgPersonalWin('$hacks', 4, 2) gte 1>> <<if sgPersonalWin(\"power\", \"\", 3) gte 1>>"),
				p('<<if sgPersonalWin("hacks", "3", 0) gte 1>> sgPersonal("hacks", "3")')
			],
			who => (who === '3' ? 'aX' : who === '4' ? 'aY' : who)
		);

		expect(w).toEqual([
			{var: 'hacks', min: 5, acc: 'aX'},
			{var: 'hacks', min: 2, acc: 'aY'},
			{var: 'power', min: 3, acc: ''}
		]);
	});

	it('пакет П20: номер сотрудника → id персонажа; в настройках не пишется; отличие видно', () => {
		const pack = readSgpack(fixture('app-test-net-pack-p20.sgpack'));
		const {passages} = apply([], pack.game, Object.keys(pack.files));
		const before = storyToGame(passages).game;
		const tester = before.accounts.find((a: AppGame) => a.tester);
		const term = {name: 'Взлом', tags: [], text: `<<if sgPersonalWin("hacks", "${tester.num}", 5) gte 3>>ПЕРЕГРЕВ<</if>>`};
		const built = storyToGame([...passages, term]).game;

		expect(before.termWins).toBeUndefined();
		expect(built.termWins).toEqual([{var: 'hacks', min: 5, acc: tester.id}]);
		expect(writeSettings(built)).not.toContain('termWins');
		expect(diffGames(before, built)).toEqual([
			{section: 'Окна терминала «за N мин»', added: [`$hacks у ${tester.id} — 5 мин`], removed: [], changed: []}
		]);
		// пакет с окнами → история: окна не попадают в «Настройки приложения» (их источник — условия терминала)
		expect(gameToStory(passages, built, []).settingsText).not.toContain('termWins');
	});

	it('модуль сети — копия sg-term-net.js signaly-app (withAcc, force у главы)', () => {
		expect(signalyNetModule).toContain('function withAcc(o)');
		expect(signalyNetModule).toContain('force: true');
	});
});
