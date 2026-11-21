// «Twine СИГНАЛЫ», сессия 35 (= П13, этап Т4): общие с телефонами переменные (Т4-3 А),
// одна форма «когда X → сделать Y» — stay и действия события (Т4-4 А), проверка перед публикацией (Т4-2 А).

import {readFileSync} from 'fs';
import {join} from 'path';
import {TextDecoder, TextEncoder} from 'util';
import {diffGames, gameToStory, readSgpack, storyToGame} from '../signaly-app';
import {appProblems} from '../signaly-app-check';
import {findEvent, findEventDo, setEventDo, setEventHead, writeEventHead} from '../signaly-events';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';
import {readVariables, sharedNames, sharedVariables, withShared, withVariables} from '../signaly-variables';
import {parseAction, splitBody, writeActions} from '../signaly-actions';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

const init = [
	'/* ===== СИГНАЛЫ: переменные — правьте в окне «Переменные» ===== */',
	'<<set $chapter to 1>> /* Глава */',
	'<<set $power to 5>> /* Энергия */',
	'<<set $door to false>>',
	'<<sg-shared "power">> /* общие с телефонами */',
	'/* ===== СИГНАЛЫ: конец переменных ===== */',
	'<<set $other to 2>>'
].join('\n');

describe('общие с телефонами переменные', () => {
	it('читаются из строки <<sg-shared>> раздела и пишутся обратно', () => {
		const {variables} = readVariables(init);

		expect(variables.map(v => [v.name, !!v.shared])).toEqual([
			['chapter', false],
			['power', true],
			['door', false],
			['other', false]
		]);
		expect(sharedNames('<<sg-shared "a" \'b\' c $d>>')).toEqual(['a', 'b', 'c', 'd']);
		expect(sharedVariables(init)).toEqual([{name: 'power', label: 'Энергия', value: 5}]);

		const again = withVariables(init, variables.map(v => (v.name === 'door' ? {...v, shared: true} : v)));

		expect(again).toContain('<<sg-shared "power" "door">> /* общие с телефонами */');
		expect(sharedVariables(again).map(v => v.name)).toEqual(['power', 'door']);
		expect(withVariables(again, readVariables(again).variables.map(v => ({...v, shared: false})))).not.toContain('sg-shared');
	});

	it('из пакета: галочки, новая переменная, без изменений — undefined', () => {
		expect(withShared(init, [{name: 'power', label: 'Энергия', value: 5}])).toBeUndefined();

		const marked = withShared(init, [
			{name: 'door', label: 'Шлюз', value: true},
			{name: 'oxygen', label: 'Кислород', value: 21}
		])!;

		expect(sharedVariables(marked)).toEqual([
			{name: 'door', label: 'Шлюз', value: true},
			{name: 'oxygen', label: 'Кислород', value: 21}
		]);
		expect(marked).toContain('<<set $power to 5>> /* Энергия */');
		expect(marked).not.toContain('"power"');
	});

	it('история → пакет → история: shared в пакете, StoryInit не меняется, отличий нет', () => {
		const passages = [{name: 'StoryInit', tags: [], text: init}];
		const built = storyToGame(passages).game;

		expect(built.shared).toEqual([{name: 'power', label: 'Энергия', value: 5}]);
		expect(gameToStory(passages, built, []).initText).toBeUndefined();
		expect(diffGames(built, JSON.parse(JSON.stringify(built)))).toEqual([]);
		expect(diffGames(built, {...built, shared: [{name: 'power', label: 'Энергия', value: 7}]})).toEqual([
			{section: 'Общие переменные', added: [], removed: [], changed: ['$power']}
		]);
	});

	it('старый пакет без shared — в истории ничего не меняется, отличий нет', () => {
		const pack = readSgpack(fixture('app-test-net-pack.sgpack'));
		const r = gameToStory([], pack.game, []);

		expect(r.initText).toBeUndefined();
		expect(storyToGame([]).game.shared).toBeUndefined();
		expect(diffGames(pack.game, {...pack.game, shared: []})).toEqual([]);
	});

	it('проверка: правило без общей переменной — ошибка, {{x}} без переменной — предупреждение', () => {
		const game = {
			masterCode: '98765432',
			chapters: [{name: 'Глава 1'}],
			accounts: [{id: 'a', name: 'А', login: '111111'}],
			shared: [{name: 'power', label: '', value: 5}],
			rules: [
				{id: 'r1', name: 'Норма', on: 'var', var: 'power', op: '>=', value: '8', actions: [{type: 'notify', title: 'x'}]},
				{id: 'r2', name: 'Кислород', on: 'var', var: 'oxygen', op: '<', value: '5', actions: []}
			],
			blocks: [{id: 'b1', title: 'Реактор', start: true, items: [{type: 'text', text: 'Энергия {{power}}, кислород {{oxygen}}'}]}],
			codes: [{id: 'k', code: '1234', answer: 'Сейчас {{ power }}'}]
		};
		const texts = appProblems(game).map(p => `${p.level}: ${p.text}`);

		expect(texts).toContain('error: Правило «Кислород»: общей переменной «oxygen» нет');
		expect(texts.filter(t => t.includes('{{'))).toEqual([
			'warn: Блок «Реактор»: {{oxygen}} — нет такой общей переменной (окно «Переменные», галочка «общая»)'
		]);
	});
});

describe('событие: «не переходить на экран» и действия при срабатывании', () => {
	const head = {expr: '$power lte 0', repeat: true, stay: true, delay: 0, priority: 0};

	it('слово stay пишется и читается', () => {
		expect(writeEventHead(head)).toBe('<<sg-event repeat stay $power lte 0>>');
		expect(findEvent('<<sg-event stay delay 2 $x>>\nтекст')).toMatchObject({stay: true, delay: 2, expr: '$x'});
		expect(findEvent('<<sg-event $x>>')!.stay).toBe(false);
	});

	it('действия — строка после первой; правятся и убираются', () => {
		const text = setEventHead('Экран', head);
		const actions = splitBody('<<set $power to 10>><<sg-net alarm "РЕАКТОР" "Энергия кончилась">>').map(parseAction);
		const withDo = setEventDo(text, writeActions(actions, true));

		expect(withDo.split('\n')[0]).toBe('<<sg-event repeat stay $power lte 0>>');
		expect(withDo.split('\n')[1]).toBe('<<sg-event-do>>');
		expect(withDo.endsWith('<</sg-event-do>>\nЭкран')).toBe(true);
		expect(splitBody(findEventDo(withDo)!.body).map(parseAction).map(a => a.type)).toEqual(['set', 'net']);

		const changed = setEventDo(withDo, writeActions([actions[1]], true));

		expect(changed).not.toContain('$power to 10');
		expect(setEventDo(changed, '')).toBe(text);
		expect(setEventDo('', '\n<<set $x to 1>>\n')).toBe('<<sg-event-do>>\n<<set $x to 1>>\n<</sg-event-do>>');
	});

	it('движок 31: общие переменные, stay и действия события', () => {
		const engine = signalyEngineBlock();

		expect(signalyEngineVersion).toBe(36);
		expect(engine).toContain("Macro.add('sg-shared'");
		expect(engine).toContain("Macro.add('sg-event-do'");
		expect(engine).toContain('eventRun(next)');
		expect(engine).toContain('N.shareAdd = function');
	});
});
