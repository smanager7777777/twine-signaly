// «Twine СИГНАЛЫ», сессия 36 (= П14): событие «окно-сообщение» (Т4-8 Б), условие «когда» у кода
// телефона (Т4-5 А), шапка и меню телефона (Т4-6 Б), «телефон сам ищет центр» (П-62).

import {TextDecoder, TextEncoder} from 'util';
import {diffGames} from '../signaly-app';
import {appProblems} from '../signaly-app-check';
import {defaultChat, fullMenu, menuValue} from '../signaly-app-model';
import {findEvent, parseEventArgs, setEventHead, writeEventHead} from '../signaly-events';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

describe('событие «окно-сообщение» (popup)', () => {
	it('читается и пишется; stay важнее popup', () => {
		expect(parseEventArgs('popup repeat $a gt 1')).toEqual({expr: '$a gt 1', repeat: true, stay: false, popup: true, title: '', ack: false, delay: 0, priority: 0});
		expect(writeEventHead({expr: '$a', repeat: false, popup: true, delay: 2, priority: 0})).toBe('<<sg-event popup delay 2 $a>>');
		expect(writeEventHead({expr: '$a', repeat: false, stay: true, popup: true, delay: 0, priority: 0})).toBe('<<sg-event stay $a>>');
		const text = setEventHead('Давление падает.', {expr: '$p', repeat: false, popup: true, delay: 0, priority: 0});

		expect(text).toBe('<<sg-event popup $p>>\nДавление падает.');
		expect(findEvent(text)?.popup).toBe(true);
		expect(findEvent('<<sg-event popupX>>')?.popup).toBe(false);
	});

	it('движок 33 знает слово popup и показывает окно', () => {
		expect(signalyEngineVersion).toBe(35);
		const engine = signalyEngineBlock();

		expect(engine).toContain('(repeat|stay|popup|ack|delay|priority)');
		expect(engine).toContain("setup.signaly.openDialog({title: pop.title || pop.name, passage: pop.name, close: pop.ack ? 'ok' : ''})");
	});
});

describe('код телефона: «когда» по общим переменным', () => {
	const game = (when: unknown[], shared = [{name: 'power', label: 'Энергия', value: 5}]) => ({
		shared,
		codes: [{id: 'k1', code: '11', answer: 'ок', when, whenText: 'Мало: {{power}} {{nope}}'}]
	});

	it('без такой переменной — ошибка; в ответе «нет доступа» — {{имя}} проверяется', () => {
		expect(appProblems(game([{var: 'power', op: '>=', value: '8'}])).filter(p => p.text.includes('когда'))).toEqual([]);
		expect(appProblems(game([{var: 'nope', op: '>=', value: '8'}])).map(p => p.text)).toContain('Код «11»: в условии «когда» общей переменной «nope» нет');
		expect(appProblems(game([])).some(p => p.text.includes('{{nope}}'))).toBe(true);
	});

	it('пакет без «когда» и пакет с пустым «когда» не отличаются', () => {
		const a = {codes: [{id: 'k1', code: '11'}]};
		const b = {codes: [{id: 'k1', code: '11', when: [], whenText: ''}]};

		expect(diffGames(a, b)).toEqual([]);
	});
});

describe('шапка и меню телефона', () => {
	it('меню: заданные — первыми, без изменений — пусто', () => {
		const full = fullMenu([{tab: 'code', label: 'ВВОД'}, {tab: 'scan', hidden: true}, {tab: 'xx'}]);

		expect(full.map(m => m.tab)).toEqual(['code', 'scan', 'data', 'chat', 'apps', 'photo', 'notes']);
		expect(full[0]).toEqual({tab: 'code', label: 'ВВОД', hidden: false, chapter: 1, who: [], def: 'КОД'});
		expect(menuValue(fullMenu([]))).toEqual([]);
		expect(menuValue(full)).toHaveLength(7);
	});

	it('проверка: показатель без общей переменной, все вкладки скрыты, {{имя}} в разделах', () => {
		const g = {
			shared: [{name: 'power', label: '', value: 1}],
			header: {items: [{var: 'power'}, {var: 'o2', label: 'O2'}], info: [{title: 'Сводка', text: '{{power}} {{x}}'}]},
			menu: ['data', 'code', 'scan', 'chat', 'apps', 'photo', 'notes'].map(tab => ({tab, hidden: true}))
		};
		const texts = appProblems(g).map(p => p.text);

		expect(texts).toContain('Шапка, показатель 2 «O2»: общей переменной «o2» нет');
		expect(texts).toContain('Меню: скрыты все вкладки');
		expect(texts.some(t => t.includes('Шапка, раздел «Сводка»') && t.includes('{{x}}'))).toBe(true);
		expect(texts.some(t => t.includes('показатель 1'))).toBe(false);
	});

	it('пакет без шапки и пакет с пустой шапкой и меню не отличаются', () => {
		expect(diffGames({}, {header: {title: '', sub: '', chapter: true, infoTitle: '', items: [], info: []}, menu: []})).toEqual([]);
		expect(diffGames({}, {header: {title: 'X'}})[0].changed).toContain('header');
	});

	it('«телефон сам ищет центр» — по умолчанию включено', () => {
		expect(defaultChat.auto).toBe(true);
	});
});
