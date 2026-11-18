// «Twine СИГНАЛЫ», сессия 31: действие «Телефонам: …» (<<sg-net>>), условие «Пришло с телефона», движок 28.
import {newAction, parseAction, writeAction} from '../signaly-actions';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';
import {signalyNetModule} from '../signaly-net-module';
import {parseExpr, writeExpr} from '../signaly-logic';

describe('<<sg-net>>', () => {
	const samples = [
		'<<sg-net notify "ТЕРМИНАЛ" "Шлюз открыт">>',
		'<<sg-net notify "ЛИЧНО" "Вам" to self>>',
		'<<sg-net open "Дневник, Схема" "НОВЫЕ ДАННЫЕ" to "3, 5">>',
		'<<sg-net glitch "Тьма" to "2">>',
		'<<sg-net fix "">>',
		'<<sg-net alarm "ТРЕВОГА" "Пробой">>',
		'<<sg-net alarm off>>',
		'<<sg-net chapter 2>>',
		'<<sg-net countdown 300 "ДО ВЗРЫВА">>',
		'<<sg-net countdown off>>',
		'<<sg-net module "chat" broken to "4">>',
		'<<sg-net event "breach">>'
	];

	it('разбирается формой и записывается так же', () => {
		for (const s of samples) {
			const a = parseAction(s);

			expect(a.type).toBe('net');
			expect(writeAction({...a, raw: undefined})).toBe(s);
		}
	});

	it('поля разбора', () => {
		expect(parseAction('<<sg-net open "Дневник, Схема" "НОВЫЕ" to "3, 5">>')).toMatchObject({op: 'open', a: 'Дневник, Схема', b: 'НОВЫЕ', to: '3, 5'});
		expect(parseAction('<<sg-net alarm off>>')).toMatchObject({op: 'alarmoff'});
		expect(parseAction('<<sg-net countdown 60 "Т">>')).toMatchObject({op: 'countdown', a: '60', b: 'Т'});
		expect(parseAction('<<sg-net notify "А" "Б" to self>>')).toMatchObject({to: 'self'});
	});

	it('непонятное остаётся кодом', () => {
		for (const s of ['<<sg-net>>', '<<sg-net jump "x">>', '<<sg-net chapter $x>>', '<<sg-net module "chat" sideways>>', '<<sg-net-notify "А" "Б">>']) {
			expect(parseAction(s).type).toBe('code');
		}
	});

	it('новое действие и «кому» только у личных команд', () => {
		expect(writeAction(newAction('net'))).toBe('<<sg-net notify "ТЕРМИНАЛ" "">>');
		expect(writeAction({type: 'net', op: 'chapter', a: '3', b: '', to: 'self'})).toBe('<<sg-net chapter 3>>');
	});
});

describe('условие «Пришло с телефона»', () => {
	it('разбор и запись', () => {
		const cases = [
			'setup.phone("code", "4242") gt 0',
			'setup.phone("code", "сигнал терминалу", "3") gt 0',
			'setup.phone("event", "breach") is 0',
			'setup.phone("code", "4242") gte 2',
			'setup.phone("event", "breach", "1") is 3'
		];

		for (const expr of cases) {
			const p = parseExpr(expr);

			expect(p?.conds[0].kind).toBe('phone');
			expect(writeExpr(p!.conds, p!.join)).toBe(expr);
		}
		expect(parseExpr('setup.phone("code", "4242", "3") gt 0')?.conds[0]).toMatchObject({phone: 'code', code: '4242', person: '3', op: 'on'});
		expect(parseExpr('setup.phone("vote", "x") gt 0')).toBeUndefined();
	});
});

describe('движок 29', () => {
	it('версия и сетевой модуль внутри части «только в игре»', () => {
		const block = signalyEngineBlock();

		expect(signalyEngineVersion).toBe(29);
		// Сессия 32: jsQR для QR «СЕТЬ» камерой ноутбука — до сетевого модуля.
		expect(block.indexOf('window.jsQR = module.exports')).toBeGreaterThan(block.indexOf('State.reset();'));
		expect(block.indexOf('window.jsQR = module.exports')).toBeLessThan(block.indexOf('var N = W.SgTermNet'));
		expect(block).toContain('SgTermNet');
		expect(block.indexOf('SG_TERM_NET_QUIET')).toBeGreaterThan(block.indexOf('State.reset();'));
		expect(block).toContain("Macro.add('sg-net'");
		expect(signalyNetModule).not.toMatch(/`|\$\{/);
	});
});
