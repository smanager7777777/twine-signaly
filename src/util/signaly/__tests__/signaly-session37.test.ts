// «Twine СИГНАЛЫ», сессия 37 (= П15): окно-сообщение события — свой заголовок и «Принято» (Т6-2 Б),
// шапка по главам (Т6-3 Б), порог тревоги и вид шкалы (Т6-4 Б), меню с главы и кому (Т6-5 Б),
// режим отказа «когда» (Т6-7 Б), пределы общих переменных и правило «упёрлась в предел».

import {TextDecoder, TextEncoder} from 'util';
import {diffGames} from '../signaly-app';
import {appProblems} from '../signaly-app-check';
import {fullMenu, menuValue} from '../signaly-app-model';
import {findEvent, parseEventArgs, setEventHead, writeEventHead} from '../signaly-events';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

describe('окно-сообщение: заголовок и «Принято»', () => {
	it('слова title "…" и ack читаются и пишутся', () => {
		expect(parseEventArgs('popup title "Тревога \\"А\\"" ack repeat $a gt 1')).toMatchObject({
			expr: '$a gt 1',
			popup: true,
			repeat: true,
			title: 'Тревога "А"',
			ack: true
		});
		const head = {expr: '$p', repeat: false, popup: true, title: 'ВНИМАНИЕ "Э"', ack: true, delay: 0, priority: 0};

		expect(writeEventHead(head)).toBe('<<sg-event popup title "ВНИМАНИЕ \\"Э\\"" ack $p>>');
		const text = setEventHead('Давление.', head);

		expect(findEvent(text)).toMatchObject({title: 'ВНИМАНИЕ "Э"', ack: true, popup: true, expr: '$p'});
		// без popup заголовок и ack не пишутся
		expect(writeEventHead({...head, popup: false})).toBe('<<sg-event $p>>');
		expect(writeEventHead({...head, title: ' ', ack: false})).toBe('<<sg-event popup $p>>');
	});

	it('движок 33: свой заголовок и закрытие только «Принято»', () => {
		expect(signalyEngineVersion).toBe(33);
		const engine = signalyEngineBlock();

		expect(engine).toContain("close: pop.ack ? 'ok' : ''");
		expect(engine).toContain('a.title = t[1]');
	});
});

describe('меню с главы и кому, шапка по главам', () => {
	it('меню: с главы и кому — не «как было»', () => {
		const full = fullMenu([{tab: 'scan', chapter: 2, who: ['aA']}]);

		expect(full[0]).toEqual({tab: 'scan', label: '', hidden: false, chapter: 2, who: ['aA'], def: 'СКАНЕР'});
		expect(menuValue(full)[0]).toEqual({tab: 'scan', label: '', hidden: false, chapter: 2, who: ['aA']});
		expect(menuValue(fullMenu([{tab: 'data'}]))).toEqual([]);
	});

	it('новые поля по умолчанию — не отличие', () => {
		const a = {header: {items: [{id: 'h1', var: 'power'}]}, menu: [{tab: 'code', label: 'ВВОД', hidden: false}], codes: [{id: 'k', code: '1'}]};
		const b = {
			header: {items: [{id: 'h1', var: 'power', low: '', lowColor: '', look: 'cell', fit: false, over: false}], chapters: []},
			menu: [{tab: 'code', label: 'ВВОД', hidden: false, chapter: 1, who: []}],
			codes: [{id: 'k', code: '1', whenMode: ''}],
			limits: []
		};

		expect(diffGames(a, b)).toEqual([]);
		expect(diffGames(a, {...b, limits: [{var: 'power', min: 0, max: 10}]}).length).toBe(1);
		expect(diffGames(a, {...b, header: {...b.header, chapters: [{id: 'c', chapter: 2, title: 'X'}]}})[0].changed).toContain('header');
	});
});

describe('пределы и правило «упёрлась в предел»', () => {
	const g = (limits: unknown[], rules: unknown[] = []) => ({shared: [{name: 'power', label: 'Энергия', value: 5}], limits, rules});

	it('проверка истории', () => {
		const texts = (x: Record<string, unknown>) => appProblems(x).map(p => p.text).filter(t => /Предел|Правило|Шапка/.test(t));

		expect(texts(g([{var: 'power', min: 0, max: 10}]))).toEqual([]);
		expect(texts(g([{var: 'nope', min: 0, max: 10}]))).toContain('Предел общей переменной «nope»: такой общей переменной нет');
		expect(texts(g([{var: 'power', min: 5, max: 1}]))).toContain('Предел общей переменной «power»: наименьшее больше наибольшего');
		expect(texts(g([], [{id: 'r', name: 'Полон', on: 'limit', var: 'power', side: 'max', actions: []}]))).toContain(
			'Правило «Полон»: у переменной «power» нет предела — правило не сработает'
		);
		expect(texts(g([{var: 'power', max: 10, min: ''}], [{id: 'r', name: 'Полон', on: 'limit', var: 'power', side: 'max', actions: []}]))).toEqual([]);
		expect(texts({...g([]), header: {chapters: [{chapter: 2, title: '{{x}}'}]}}).some(t => t.includes('Шапка главы 2'))).toBe(true);
	});
});
