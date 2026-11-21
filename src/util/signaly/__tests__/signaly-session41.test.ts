// «Twine СИГНАЛЫ», сессия 41 (= П22): замечания автора к build-44 — «кому: №N» до настоящего телефона (к num:N — acc:<id>),
// «Глава N» с терминала — с force; ответ Т32-3 А — своя картинка окна декодера (show у <<sg-sstv>>). Движок 36.

import {readFileSync} from 'fs';
import {join} from 'path';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';
import {signalyNetModule} from '../signaly-net-module';
import {readSstv, writeSstv} from '../signaly-sstv-store';

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadModule() {
	const w = window as any;

	delete w.SgTermNet;
	delete w.SgAccHint;
	localStorage.clear();
	// eslint-disable-next-line no-new-func
	new Function(signalyNetModule)();
	return w.SgTermNet;
}

describe('модуль сети: «кому: №N» (замечания 1–3 к build-44)', () => {
	it('к num:7 добавляется acc: по персонажам центра (accs)', () => {
		const N = loadModule();

		N.state = {accs: [{id: 'aT', num: '7', name: 'Психолог Тест'}, {id: 'aA', num: '1', name: 'Инженер Тест'}]};
		expect(N.withAcc({t: 'msg', to: N.to(['7'])}).to).toEqual(['num:7', 'acc:aT']);
		expect(N.withAcc({t: 'msg', to: N.to(['all'])}).to).toEqual(['all']);
		expect(N.withAcc({t: 'msg', to: ['num:7', 'acc:aT']}).to).toEqual(['num:7', 'acc:aT']);
		expect(N.withAcc({t: 'msg', to: N.to(['9'])}).to).toEqual(['num:9']);
		expect(N.withAcc({t: 'set', key: 'x'})).toEqual({t: 'set', key: 'x'});
	});

	it('без связи и без accs — по таблице кодов истории (SgAccHint)', () => {
		const N = loadModule();

		(window as any).SgAccHint = (n: string) => (n === '7' ? 'aT' : '');
		N.state = {};
		expect(N.withAcc({t: 'msg', to: N.to(['7', '1'])}).to).toEqual(['num:7', 'num:1', 'acc:aT']);
	});

	it('сообщение из очереди (без связи) уходит с acc: — добавляется при отправке', () => {
		const N = loadModule();

		N.notify('Т', 'текст', ['7']);
		const q = JSON.parse(localStorage.getItem('sg-term-net-queue') || '[]');

		expect(q[q.length - 1].to).toEqual(['num:7']);
		expect(signalyNetModule).toContain('ws.send(JSON.stringify(withAcc(o)))');
	});

	it('«Глава N» — с force (телефон принимает и главу назад)', () => {
		const N = loadModule();

		N.chapter(1);
		const q = JSON.parse(localStorage.getItem('sg-term-net-queue') || '[]');

		expect(q[q.length - 1]).toMatchObject({t: 'set', key: 'chapter', value: {n: 1, force: true}});
	});

	it('движок 36: SgAccHint по таблице кодов, без обратных кавычек', () => {
		expect(signalyEngineVersion).toBe(36);
		expect(signalyEngineBlock()).toContain('window.SgAccHint = function (num)');
		// замечание автора: «Радио» → «Добавить вид» — «macro <<sg-shared>> does not exist» в предпросмотре
		const e = signalyEngineBlock();
		const stub = e.indexOf("['sg-shared', 'sg-personal', 'sg-personal-add', 'sg-personal-set'].forEach");

		expect(stub).toBeGreaterThan(-1);
		expect(stub).toBeLessThan(e.indexOf("Macro.add('sg-shared'"));
		expect(signalyNetModule).not.toMatch(/`|\$\{/);
	});
});

describe('своя картинка окна декодера (Т32-3 А, П-28)', () => {
	const line =
		'<<sg-sstv "media/audio/air/sos.mp3" stamp "1-2" img "media/img/sstv/air/sos-1.png" mode "Robot 36" at 4.911 line 0.15 rows 240 per 1 width 320 height 240>>';

	it('show — туда и обратно; без show строка прежняя', () => {
		const files = readSstv(line);
		const f = files.get('media/audio/air/sos.mp3')!;

		expect(f.images[0].show).toBeUndefined();
		expect(writeSstv(line, files).trim().endsWith(line)).toBe(true);
		files.set(f.src, {...f, images: [{...f.images[0], show: 'media/img/clean.png'}]});

		const text = writeSstv(line, files);

		expect(text).toContain('height 240 show "media/img/clean.png">>');
		expect(readSstv(text).get(f.src)!.images[0].show).toBe('media/img/clean.png');
	});

	it('движок: show в таблице SSTV, своя картинка в размер передачи', () => {
		const e = signalyEngineBlock();

		expect(e).toContain("'height', 'show'], ['none']");
		expect(e).toContain('e.el.src = e.show || e.img;');
		expect(e).toContain('function sstvRows(ctx, img, e, y, n)');
	});

	it('«Тест терминала»: сборка 41, экран Т11 наверху', () => {
		const twee = readFileSync(join(__dirname, '../../../../signaly/tests/test-terminal/test-terminal.twee'), 'utf8');

		expect(twee).toContain(`Версия движка: ${signalyEngineVersion}.`);
		expect(twee).toContain(':: Т11 Номер');
		expect(twee.indexOf('1. Команды «кому: №7»')).toBeLessThan(twee.indexOf('2. Личные'));
	});
});
