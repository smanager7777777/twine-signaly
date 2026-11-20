// «Twine СИГНАЛЫ», сессия 39 (= П17): скрытые блоки, приборы и программы (Т8-5 А), заметки персонажа,
// правило «на телефоне» в фоне — «когда работает» и «не в приложении дольше N с» (Т8-6 Б). Движок 34 — сетевой модуль
// с запасным центром (поиск нового центра, поколение, stale).

import {TextDecoder, TextEncoder} from 'util';
import {diffGames, readBlock, writeBlock} from '../signaly-app';
import {blockHeadLine, phoneScreens, phoneSensors, readBlockHead} from '../signaly-app-model';
import {signalyNetModule} from '../signaly-net-module';
import {signalyEngineVersion} from '../signaly-engine';

Object.assign(globalThis, {TextEncoder, TextDecoder}); // jsdom без них

describe('скрытый блок', () => {
	it('слово hidden в первой строке — туда и обратно', () => {
		const text = writeBlock({id: 'b9', title: 'Тайный журнал', section: '', who: [], chapter: 1, start: false, share: false, hidden: true, garble: 0, items: []}, id => id);

		expect(text.split('\n')[0]).toBe('<<app-block "b9" hidden>>');
		expect(readBlock('Тайный журнал', text, n => n)?.hidden).toBe(true);
		expect(readBlock('Блок', '<<app-block "b1">>\nтекст', n => n)?.hidden).toBeUndefined();
	});

	it('форма блока: галочка «скрытый»', () => {
		const head = readBlockHead('<<app-block "b1" share hidden>>')!;

		expect(head.hidden).toBe(true);
		expect(blockHeadLine({...head, hidden: false})).toBe('<<app-block "b1" share>>');
		expect(blockHeadLine({...head, share: false})).toBe('<<app-block "b1" hidden>>');
	});
});

describe('новые поля по умолчанию — не отличие (пакет старого редактора)', () => {
	it('блок, прибор, персонаж, правило «на телефоне»', () => {
		const a = {
			blocks: [{id: 'b1', title: 'X'}],
			apps: [{id: 'p1', name: 'Градусник'}],
			accounts: [{id: 'a1', name: 'Инженер'}],
			rules: [{id: 'r', name: 'Вниз', on: 'phone', sensor: 'facedown', actions: []}]
		};
		const b = {
			blocks: [{id: 'b1', title: 'X', hidden: false}],
			apps: [{id: 'p1', name: 'Градусник', hidden: false}],
			accounts: [{id: 'a1', name: 'Инженер', notes: [], secret: []}],
			rules: [{id: 'r', name: 'Вниз', on: 'phone', sensor: 'facedown', actions: [], seconds: 0, every: 0, who: [], screen: ''}]
		};

		expect(diffGames(a, b)).toEqual([]);
		expect(diffGames(a, {...b, blocks: [{id: 'b1', title: 'X', hidden: true}]}).length).toBe(1);
		expect(diffGames(a, {...b, apps: [{id: 'p1', name: 'Градусник', hidden: true}]}).length).toBe(1);
		expect(diffGames(a, {...b, accounts: [{id: 'a1', name: 'Инженер', notes: [], secret: ['photo']}]}).length).toBe(1);
		expect(diffGames(a, {...b, rules: [{...b.rules[0], screen: 'off'}]}).length).toBe(1);
	});

	it('«не в приложении» и «когда работает» — в списках формы', () => {
		expect(phoneSensors).toContain('away');
		expect(phoneScreens).toEqual(['', 'on', 'off']);
	});
});

describe('движок 34: сетевой модуль с запасным центром', () => {
	it('модуль ищет новый центр, помнит поколение, уступивший центр — stale', () => {
		expect(signalyEngineVersion).toBe(34);
		expect(signalyNetModule).toContain("o.t === 'stale'");
		expect(signalyNetModule).toContain('N.searchList');
		expect(signalyNetModule).toContain('gen: N.gen');
		expect(signalyNetModule).not.toMatch(/`|\$\{/);
	});
});
