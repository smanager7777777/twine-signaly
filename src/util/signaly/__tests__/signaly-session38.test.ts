// «Twine СИГНАЛЫ», сессия 38 (= П16): слои перезаполнения шкалы (предел — деления × слои),
// нажатие на части шапки (Т6-8 Б: имя, глава, показатель), текст окна главы.

import {TextDecoder, TextEncoder} from 'util';
import {diffGames} from '../signaly-app';
import {appProblems} from '../signaly-app-check';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

const TAP0 = {kind: 'auto', title: '', text: '', block: ''};

describe('слои шкалы и нажатие на шапку', () => {
	it('новые поля по умолчанию — не отличие (пакет старого редактора)', () => {
		const a = {header: {items: [{id: 'h1', var: 'power'}], chapters: [{id: 'c', chapter: 2, title: 'X'}]}, limits: []};
		const b = {
			header: {
				items: [{id: 'h1', var: 'power', low: '', lowColor: '', look: 'cell', fit: false, over: false, layers: [], tap: TAP0}],
				chapters: [{id: 'c', chapter: 2, title: 'X', about: ''}],
				taps: {who: TAP0, chapter: TAP0}
			},
			limits: []
		};

		expect(diffGames(a, b)).toEqual([]);
		const layered = {...b, header: {...b.header, items: [{...b.header.items[0], layers: [{fx: 'fill', color: ''}, {fx: 'glitch', color: ''}]}]}};

		expect(diffGames(a, layered)[0].changed).toContain('header');
		const tapped = {...b, header: {...b.header, taps: {who: {...TAP0, kind: 'info'}, chapter: TAP0}}};

		expect(diffGames(a, tapped)[0].changed).toContain('header');
		const about = {...b, header: {...b.header, chapters: [{id: 'c', chapter: 2, title: 'X', about: 'Аварийный режим'}]}};

		expect(diffGames(a, about)[0].changed).toContain('header');
	});

	it('проверка истории: предел по слоям и блок по нажатию', () => {
		const g = (header: unknown, rules: unknown[] = []) => ({shared: [{name: 'charge', label: 'Заряд', value: 0}], limits: [], blocks: [{id: 'b1', title: 'Реактор'}], header, rules});
		const texts = (x: Record<string, unknown>) => appProblems(x).map(p => p.text).filter(t => /Правило|Шапка/.test(t));
		const rule = [{id: 'r', name: 'Полон', on: 'limit', var: 'charge', side: 'max', actions: []}];
		const item = {var: 'charge', show: 'cells', max: 10};

		expect(texts(g({items: [item]}, rule))).toContain('Правило «Полон»: у переменной «charge» нет предела — правило не сработает');
		expect(texts(g({items: [{...item, layers: [{fx: 'fill'}, {fx: 'color', color: '#ffaa00'}]}]}, rule))).toEqual([]);
		expect(texts(g({items: [{...item, tap: {kind: 'block', block: 'b1'}}], taps: {who: {kind: 'block', block: 'b1'}}}))).toEqual([]);
		expect(texts(g({items: [{...item, tap: {kind: 'block', block: 'nope'}}], taps: {chapter: {kind: 'block', block: ''}}}))).toEqual([
			'Шапка, глава: по нажатию открывается блок, которого нет',
			'Шапка, показатель 1: по нажатию открывается блок, которого нет'
		]);
	});
});
