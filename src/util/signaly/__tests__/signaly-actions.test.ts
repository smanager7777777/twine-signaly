import {execSync} from 'child_process';
import {readFileSync} from 'fs';
import {join, resolve} from 'path';
import {
	Action,
	findLinks,
	IfAction,
	fitsMarkup,
	moveScriptDialogs,
	parseAction,
	replaceLink,
	splitBody,
	writeAction,
	writeLink
} from '../signaly-actions';

const current = readFileSync(join(__dirname, '../../../../signaly/template/27_03_2025.twee'), 'utf8');
// Шаг 7.2: музыка шаблона переведена на общий плеер. Разбор старых ссылок (РАД, АТМ, A–E,
// треки радио на <<audio>>) проверяется на шаблоне сессии 26 — так он выглядит у тех, кто не перевёл.
let template = current;

try {
	template = execSync('git show 4b9ae32:signaly/template/27_03_2025.twee', {
		cwd: resolve(__dirname, '../../../..'),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
} catch {
	template = current;
}

function passage(name: string, source = template) {
	const at = source.indexOf(`:: ${name} {`);
	const from = source.indexOf('\n', at) + 1;
	const next = source.indexOf('\n:: ', from);

	return source.slice(from, next === -1 ? undefined : next);
}

describe('действия ссылок и кнопок', () => {
	it('разбирает переменные', () => {
		expect(parseAction('<<set $x to 2>>')).toMatchObject({type: 'set', name: 'x', op: 'to', value: 2});
		expect(parseAction('<<set $x += 1>>')).toMatchObject({type: 'set', op: 'add', value: 1});
		expect(parseAction('<<set $x -= 3>>')).toMatchObject({type: 'set', op: 'sub', value: 3});
		expect(parseAction('<<set $f to !$f>>')).toMatchObject({type: 'set', op: 'toggle'});
		expect(parseAction('<<set $f to not $f>>')).toMatchObject({type: 'set', op: 'toggle'});
		expect(parseAction('<<set $x to $y + 1>>')).toMatchObject({type: 'code'});
		expect(writeAction({type: 'set', name: 'x', op: 'add', value: 2})).toBe('<<set $x += 2>>');
		expect(writeAction({type: 'set', name: 'f', op: 'toggle'})).toBe('<<set $f to !$f>>');
		expect(writeAction({type: 'set', name: 's', op: 'to', value: 'да'})).toBe('<<set $s to "да">>');
	});

	it('разбирает звук', () => {
		expect(parseAction('<<audio ":playing:not(:TERMINAL)" fadeto 0.1>>')).toMatchObject({
			type: 'audio',
			who: {kind: 'playing', except: ':TERMINAL'},
			act: 'fade',
			level: 0.1
		});
		expect(parseAction('<<audio ":paused:not(:RADIO)" play>>')).toMatchObject({
			who: {kind: 'paused', except: ':RADIO'},
			act: 'play'
		});
		expect(parseAction('<<audio "loopcomputer" volume 0.05 loop play>>')).toMatchObject({
			who: {kind: 'track', id: 'loopcomputer'},
			act: 'play',
			volume: 0.05,
			loop: true
		});
		expect(parseAction('<<audio ":RADIO" pause>>')).toMatchObject({who: {kind: 'group', id: ':RADIO'}});
		expect(parseAction('<<audio "Классика1" stop>>')).toMatchObject({who: {kind: 'track', id: 'Классика1'}});
		expect(parseAction('<<audio ":playing" stop>>')).toMatchObject({who: {kind: 'playing'}});
		expect(parseAction('<<audio ":looped" stop>>')).toMatchObject({who: {kind: 'other', selector: ':looped'}});
		expect(parseAction('<<audio ":playing:not(:TERMINAL)" time 999>>')).toMatchObject({act: '', time: 999});
		expect(parseAction('<<playlist "radio" skip>>')).toMatchObject({who: {kind: 'playlist', id: 'radio'}, act: 'skip'});
		expect(parseAction('<<audio "a" play stop>>').type).toBe('code');
		expect(parseAction('<<audio "a" goto "Start">>').type).toBe('code');
		expect(
			writeAction({type: 'audio', who: {kind: 'track', id: 'a'}, act: 'fade', level: 0.3, over: 2, volume: 0.1, loop: false})
		).toBe('<<audio "a" volume 0.1 unloop fadeoverto 2 0.3>>');
		expect(writeAction({type: 'audio', who: {kind: 'playing', except: ':TERMINAL'}, act: 'fade', level: 0.5})).toBe(
			'<<audio ":playing:not(:TERMINAL)" fadeto 0.5>>'
		);
	});

	it('разбирает окно, таймер и остановку таймера', () => {
		expect(parseAction('<<sg-open "Заголовок" passage "P" close time seconds 3>><</sg-open>>')).toMatchObject({
			type: 'dialog',
			title: 'Заголовок',
			passage: 'P',
			close: 'time',
			seconds: 3
		});
		expect(parseAction('<<sg-open "Т">>\nтекст\n<</sg-open>>')).toMatchObject({type: 'dialog', text: 'текст'});
		expect(parseAction('<<sg-timer "T" minutes 1 goto "Start" hidden>>')).toMatchObject({
			type: 'timer',
			values: {name: 'T', minutes: 1, goto: 'Start', hidden: true}
		});
		expect(parseAction('<<sg-timer "T" start running>>').type).toBe('code');
		expect(parseAction('<<sg-timer-stop "T">>')).toMatchObject({type: 'stop', name: 'T'});
		expect(writeAction({type: 'stop', name: 'T'})).toBe('<<sg-timer-stop "T">>');
		expect(writeAction({type: 'timer', values: {name: 'T', seconds: 30, goto: 'Start'}, extra: []})).toBe(
			'<<sg-timer "T" seconds 30 goto "Start" hidden>>'
		);
		expect(writeAction({type: 'dialog', title: 'Т', passage: '', text: 'Привет', close: 'ok', ok: 'Да'})).toBe(
			'<<sg-open "Т" close ok ok "Да">>Привет<</sg-open>>'
		);
	});

	it('делит тело ссылки на команды', () => {
		expect(splitBody('\n<<set $a to 1>>\n<<if $b>>x<<else>>y<</if>>\n<<timed 5s>><<audio "a" play>><</timed>>\n')).toEqual([
			'<<set $a to 1>>',
			'<<if $b>>x<<else>>y<</if>>',
			'<<timed 5s>><<audio "a" play>><</timed>>'
		]);
		expect(splitBody('<<set $a to 1>> текст /* к */')).toEqual(['<<set $a to 1>>', 'текст', '/* к */']);
	});

	it('ссылки шаблона: без правок записываются дословно', () => {
		for (const name of ['audiobuttons', 'radio', 'Атмосфера', 'PRCDTEST', 'Start']) {
			const text = passage(name);
			const links = findLinks(text);

			expect(links.length).toBeGreaterThan(0);
			for (const link of links) {
				expect(writeLink(link)).toBe(text.slice(link.from, link.to));
			}
		}
	});

	it('шаг 7.2: кнопки шаблона — действие «Музыка», без правок записываются дословно', () => {
		const buttons = findLinks(passage('audiobuttons', current));

		expect(buttons.map(b => b.label)).toEqual(['РАД', 'АТМ', 'A', 'B', 'C', 'D', 'E']);
		expect(buttons.every(b => b.actions.length === 1 && b.actions[0].type === 'music')).toBe(true);
		for (const name of ['audiobuttons', 'Атмосфера']) {
			const text = passage(name, current);

			for (const link of findLinks(text)) {
				expect(writeLink(link)).toBe(text.slice(link.from, link.to));
			}
		}
	});

	it('ссылки шаблона понимаются формой', () => {
		const buttons = findLinks(passage('audiobuttons'));

		// РАД и АТМ — переключатель «если … то … иначе» (шаг 3.3), A–E — громкость.
		expect(buttons.map(b => b.label)).toEqual(['РАД', 'АТМ', 'A', 'B', 'C', 'D', 'E']);
		expect(buttons[0].actions.map(a => a.type)).toEqual(['if']);
		expect(buttons.slice(2).every(b => b.actions.length === 1 && b.actions[0].type === 'audio')).toBe(true);

		const radio = findLinks(passage('radio'));

		expect(radio[0].actions.map(a => a.type)).toEqual(['audio', 'audio', 'delay', 'set']);
		expect(radio[radio.length - 1]).toMatchObject({markup: true, label: 'Назад', passage: 'Start'});

		const prcd = findLinks(passage('PRCDTEST'));

		expect(prcd[0]).toMatchObject({form: 'button', label: '001'});
		expect(prcd[0].actions).toMatchObject([
			{type: 'set', name: 'PRCD', value: 1},
			{type: 'dialog', title: 'Процедура 001', passage: 'PRCDRESULT'}
		]);
	});

	it('шаг 3.3: «если … то … иначе», «через N секунд», «звук-сигнал»', () => {
		const rad = findLinks(passage('audiobuttons'))[0];
		const toggle = rad.actions[0] as IfAction;

		expect(toggle).toMatchObject({type: 'if', expr: '$radioplaying is 1', multiline: true});
		expect(toggle.then.map(a => a.type)).toEqual(['set', 'audio']);
		expect(toggle.else!.map(a => a.type)).toEqual(['set', 'set', 'audio', 'audio']);

		// Записанное формой заново (без «как было») совпадает с текстом шаблона.
		const fresh = (a: Action): Action => {
			const copy = {...a, raw: undefined} as Action;

			if (copy.type === 'if') {
				copy.then = copy.then.map(fresh);
				copy.else = copy.else?.map(fresh);
			}
			if (copy.type === 'delay') {
				copy.actions = copy.actions.map(fresh);
			}
			return copy;
		};

		for (const name of ['audiobuttons', 'radio']) {
			const text = passage(name);

			for (const link of findLinks(text)) {
				if (link.actions.some(a => a.type === 'if' || a.type === 'delay')) {
					expect(writeAction(fresh(link.actions.find(a => a.type === 'if' || a.type === 'delay')!))).toBe(
						link.actions.find(a => a.type === 'if' || a.type === 'delay')!.raw
					);
				}
			}
		}

		const tracks = findLinks(passage('radio')).filter(l => l.label?.startsWith('Трек'));

		expect(tracks).toHaveLength(3);
		for (const track of tracks) {
			expect(track.actions.map(a => a.type)).toEqual(['set', 'set', 'audio', 'audio', 'audio', 'delay']);
			expect(track.actions[5]).toMatchObject({type: 'delay', seconds: 8, actions: [{type: 'audio', act: 'play'}]});
		}

		expect(parseAction('<<timed 500ms>><<set $a to 1>><</timed>>')).toMatchObject({type: 'delay', seconds: 0.5});
		expect(parseAction('<<timed 1s t8n>>x<</timed>>').type).toBe('code');
		expect(parseAction('<<timed 1s>>a<<next>>b<</timed>>').type).toBe('code');
		expect(parseAction('<<if $a>>x<<elseif $b>>y<</if>>').type).toBe('code');
		expect(
			writeAction({
				type: 'delay',
				seconds: 2,
				multiline: false,
				actions: [{type: 'set', name: 'a', op: 'to', value: 1}]
			})
		).toBe('<<timed 2s>><<set $a to 1>><</timed>>');
		expect(
			writeAction({
				type: 'if',
				expr: '$chapter is 2',
				multiline: false,
				then: [{type: 'set', name: 'a', op: 'to', value: 1}],
				else: [{type: 'signal', src: 'media/audio/x.wav', volume: 100, keep: false}]
			})
		).toBe('<<if $chapter is 2>><<set $a to 1>><<else>><<sg-sound "media/audio/x.wav" volume 100>><</if>>');

		expect(parseAction('<<sg-sound "media/audio/radiovinyl.wav" volume 100 keep>>')).toMatchObject({
			type: 'signal',
			src: 'media/audio/radiovinyl.wav',
			volume: 100,
			keep: true
		});
		expect(parseAction('<<sg-sound "a.wav">>')).toMatchObject({type: 'signal', volume: 100, keep: false});
		expect(writeAction({type: 'signal', src: 'a.wav', volume: 40, keep: true})).toBe('<<sg-sound "a.wav" volume 40 keep>>');
		expect(parseAction('<<sg-sound "a.wav" loud>>').type).toBe('code');
		// Этап 6: приглушение на время файла.
		expect(parseAction('<<sg-sound "a.wav" volume 80 duck ":AMBIENT" to 25>>')).toMatchObject({
			type: 'signal',
			volume: 80,
			duck: ':AMBIENT',
			duckTo: 25
		});
		expect(writeAction({type: 'signal', src: 'a.wav', volume: 80, keep: true, duck: ':playing', duckTo: 15})).toBe(
			'<<sg-sound "a.wav" volume 80 keep duck ":playing" to 15>>'
		);
		expect(writeAction({type: 'signal', src: 'a.wav', volume: 80, keep: false, duck: ':AMBIENT'})).toBe(
			'<<sg-sound "a.wav" volume 80 duck ":AMBIENT" to 30>>'
		);
	});

	it('[[…]] остаётся разметкой, пока хватает', () => {
		const text = 'a [[Назад|Start][$x to 1]] b';
		const [link] = findLinks(text);

		expect(link).toMatchObject({markup: true, label: 'Назад', passage: 'Start'});
		expect(link.actions).toMatchObject([{type: 'set', name: 'x', value: 1}]);
		expect(replaceLink(text, link, {...link, actions: [{type: 'set', name: 'y', op: 'add', value: 2}]})).toBe(
			'a [[Назад|Start][$y += 2]] b'
		);
		expect(replaceLink(text, link, {...link, actions: []})).toBe('a [[Назад|Start]] b');
		// Звук в [[…]] не записать — становится <<link>>.
		const more = {
			...link,
			actions: [...link.actions, {type: 'audio' as const, who: {kind: 'track' as const, id: 'a'}, act: 'play' as const}]
		};

		expect(fitsMarkup(more)).toBe(false);
		expect(replaceLink(text, link, more)).toBe('a <<link "Назад" "Start">>\n<<set $x to 1>>\n<<audio "a" play>>\n<</link>> b');
		expect(writeLink({...findLinks('[[Start]]')[0]})).toBe('[[Start]]');
	});

	it('надпись, экран и кнопка', () => {
		const text = '<<link "Открыть">><<set $a to 1>><</link>>';
		const [link] = findLinks(text);

		expect(writeLink({...link, form: 'button', passage: 'Start', label: 'Ок'})).toBe(
			'<<button "Ок" "Start">><<set $a to 1>><</button>>'
		);
		expect(findLinks('<<link [[Надпись|Экран]]>><</link>>')[0]).toMatchObject({label: 'Надпись', passage: 'Экран'});
		expect(findLinks('<<link $x>><</link>>')[0].headCode).toBe('<<link $x>>');
	});

	it('PRCDTEST: окна <<script>> → <<sg-open>>, повторно ничего не меняет', () => {
		const text = passage('PRCDTEST');
		const moved = moveScriptDialogs(text);

		expect(moved).not.toContain('<<script>>');
		expect(moved).toContain('<<set $PRCD to 1>>\n<<sg-open "Процедура 001" passage "PRCDRESULT">><</sg-open>>\n<</button>>');
		expect(moveScriptDialogs(moved)).toBe(moved);
		expect(findLinks(moved)[2].actions).toMatchObject([
			{type: 'set', value: 3},
			{type: 'dialog', title: 'Процедура 003', passage: 'PRCDRESULT'}
		]);
	});
});
