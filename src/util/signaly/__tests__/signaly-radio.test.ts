import {execSync} from 'child_process';
import path from 'path';
import {parseAction, writeAction} from '../signaly-actions';
import {musicHeader, readMusic, writeMusic} from '../signaly-music';
import {moveTemplateMusic} from '../signaly-music-template';
import {
	newRadioView,
	radioDefaults,
	radioHeader,
	radioProblems,
	readRadios,
	readRanges,
	renameRadioView,
	writeRadios,
	writeView
} from '../signaly-radio';
import {findBlocks, newBlock, writeBlock} from '../signaly-screen-blocks';
import {findAudioInit} from '../signaly-sounds';

const root = path.resolve(__dirname, '../../../..');

// Шаблон сессии 26 (build-28): музыка ещё на <<audio>> и плейлистах.
let oldTwee = '';

try {
	oldTwee = execSync('git show 4b9ae32:signaly/template/27_03_2025.twee', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
} catch {
	oldTwee = '';
}

function passagesOf(twee: string) {
	return twee
		.split(/^(?=:: )/m)
		.slice(1)
		.map(chunk => {
			const head = chunk.slice(0, chunk.indexOf('\n'));
			const m = /^:: ((?:\\.|[^\\[{])*?)\s*(?:\[([^\]]*)\])?\s*(\{.*\})?$/.exec(head)!;

			return {name: m[1], tags: (m[2] ?? '').split(/\s+/).filter(Boolean), text: chunk.slice(head.length + 1).replace(/\s+$/, '')};
		})
		.filter(p => !/^Story(Script|Stylesheet|Title|Data)$/.test(p.name));
}

describe('виды радио (шаг 7.2)', () => {
	it('читаются и пишутся, пояснение и непонятые слова остаются', () => {
		const text = radioHeader + '<<sg-radio-view "Старое" type broken frame "#111111" elements "#222222" label "" sparks 70 sparksound "media/audio/s.wav" sparkvolume 40 glow 3>>\n';
		const views = readRadios(text);

		expect(views).toEqual([
			{
				...radioDefaults,
				name: 'Старое',
				type: 'broken',
				frame: '#111111',
				elements: '#222222',
				label: '',
				sparks: 70,
				sparkSound: 'media/audio/s.wav',
				sparkVolume: 40,
				jams: [],
				extra: ['glow', '3']
			}
		]);

		const next = writeRadios(text, [...views, newRadioView(['Старое'], 'Радио')]);

		expect(next.startsWith(radioHeader)).toBe(true);
		expect(readRadios(next).map(v => v.name)).toEqual(['Старое', 'Радио']);
		expect(writeRadios(next, readRadios(next))).toBe(next);
	});

	it('образец в пояснении не считается видом', () => {
		expect(readRadios('/* <<sg-radio-view "Образец">> */\n')).toEqual([]);
	});

	it('пустое название и повтор — «Сохранить» недоступна', () => {
		const v = newRadioView([]);

		expect(radioProblems([v, {...v}])).toMatchObject({emptyName: false, repeatedName: true});
		expect(radioProblems([{...v, name: ' '}])).toMatchObject({emptyName: true, repeatedName: false});
	});

	it('эфир отремонтированного радио: шум, помехи, сообщение, поимка (шаг 7.3)', () => {
		const line =
			'<<sg-radio-view "Эфир" type fixed frame "#111111" elements "#222222" label "ОРБИТА-3М" noise "media/audio/шум.wav" noisevolume 50 ' +
			'noiseranges "88-95, 101.5-108" jam "media/audio/a.wav|1|80; media/audio/b.wav|0.6|100" jamsmin 6 jamsmax 9 incoming "СИГНАЛ" catch 12>>';
		const [v] = readRadios(line);

		expect(v).toMatchObject({
			type: 'fixed',
			noise: 'media/audio/шум.wav',
			noiseVolume: 50,
			noiseRanges: '88-95, 101.5-108',
			jams: [
				{src: 'media/audio/a.wav', width: 1, volume: 80},
				{src: 'media/audio/b.wav', width: 0.6, volume: 100}
			],
			jamsMin: 6,
			jamsMax: 9,
			incoming: 'СИГНАЛ',
			catchTime: 12,
			extra: []
		});
		expect(writeView(v)).toBe(line);
		expect(readRanges(v.noiseRanges)).toEqual([
			[88, 95],
			[101.5, 108]
		]);
		expect(readRanges('ерунда')).toEqual([]);
		expect(radioProblems([{...v, jamsMin: 10}])).toMatchObject({jamsOrder: true});
		expect(radioProblems([{...v, noiseRanges: 'везде'}])).toMatchObject({noiseRanges: true});
		// У сломанного радио эфира нет — слова эфира не пишутся.
		expect(writeView({...v, type: 'broken'})).not.toContain('jam');
	});

	it('переименование правит блоки на экранах', () => {
		const text = 'А\n<<sg-radio "Старое" size 800>>\n<<sg-radio "Другое">>';

		expect(renameRadioView(text, 'Старое', 'Новое')).toBe('А\n<<sg-radio "Новое" size 800>>\n<<sg-radio "Другое">>');
	});

	it('блоки «Радио» и «Каталог Атмосферы»', () => {
		const blocks = findBlocks('<<sg-radio "Вид">>\n<<sg-radio-view "не блок">>\n<<sg-ambient columns 2 kind "amber" buttons>>');

		expect(blocks.map(b => b.type)).toEqual(['radio', 'ambient']);
		expect(blocks[0].values).toEqual({view: 'Вид'});
		expect(blocks[1].values).toEqual({columns: 2, kind: 'amber', buttons: true});
		expect(writeBlock(newBlock('ambient'))).toBe('<<sg-ambient columns 3>>');
		expect(writeBlock({...newBlock('radio'), values: {view: 'Сломанное'}})).toBe('<<sg-radio "Сломанное">>');
	});
});

describe('музыка: подсказка папки, раздел, пояснение (шаг 7.2)', () => {
	it('подсказка альбома читается и пишется', () => {
		const text = writeMusic('', {
			settings: {volume: 30, spin: 0.8, auto: true},
			folders: [{name: 'Классика', section: 'ambient', tip: 'Спокойная «музыка»', tracks: []}]
		});

		expect(text).toContain('<<sg-folder "Классика" section ambient tip "Спокойная «музыка»">>');
		expect(readMusic(text).folders[0].tip).toBe('Спокойная «музыка»');
	});

	it('образец <<sg-track>> в пояснении не даёт пустой папки', () => {
		const text = writeMusic('', {settings: {volume: 30, spin: 0.8, auto: false}, folders: []});

		expect(text.startsWith(musicHeader)).toBe(true);
		expect(readMusic(text + '<<sg-folder "А" section radio>>\n').folders.map(f => f.name)).toEqual(['А']);
		expect(writeMusic(text, readMusic(text))).toBe(text);
	});

	it('действие «Включить раздел»', () => {
		const action = parseAction('<<sg-mus play section ambient>>');

		expect(action).toMatchObject({type: 'music', op: 'section', target: 'ambient'});
		expect(writeAction({...action, raw: undefined} as never)).toBe('<<sg-mus play section ambient>>');
	});
});

(oldTwee ? describe : describe.skip)('перевод музыки шаблона (шаг 7.2, ответ 5А)', () => {
	const passages = passagesOf(oldTwee);
	const moved = moveTemplateMusic(passages)!;
	const text = (name: string) => moved.texts.get(passages.findIndex(p => p.name === name));

	it('узнаёт шаблон целиком', () => {
		expect(moved).toBeDefined();
		expect([...moved.texts.keys()].map(i => passages[i].name).sort()).toEqual(['Start', 'StoryInit', 'audiobuttons', 'radio', 'Атмосфера'].sort());
	});

	it('каталог из плейлистов и треков радио', () => {
		const c = readMusic(moved.music);

		expect(c.settings).toEqual({volume: 10, spin: 0.8, auto: true});
		expect(c.folders.map(f => [f.name, f.section, f.tracks.length])).toEqual([
			['Классика', 'ambient', 3],
			['new', 'ambient', 3],
			['третья', 'ambient', 3],
			['Радио', 'radio', 3]
		]);
		expect(c.folders[3].tracks[0]).toMatchObject({
			name: 'Трек 1 radioRegentropfen',
			src: 'media/audio/radioRegentropfen.wav',
			pre: 'media/audio/radiovinyl.wav',
			wait: 8
		});
		expect(readRadios(moved.radio).map(v => v.name)).toEqual(['Сломанное']);
	});

	it('экраны: вид кнопок тот же, тела — действие «Музыка»', () => {
		expect(text('Start')!.startsWith('<<sg-screen-music play ambient>>\\\n\\<<include "audiobuttons">>')).toBe(true);
		expect(text('audiobuttons')).toContain('<<sg-place kind amber corner tr x 5 y 2.75>><<link "РАД">><<sg-mus toggle radio>><</link>><</sg-place>>\\');
		expect(text('audiobuttons')).toContain('<<link "E">><<sg-mus volume 99>><</link>>');
		expect(text('audiobuttons')).not.toContain('$radioplaying');
		expect(text('radio')).toBe('<<sg-radio "Сломанное">>\n');
		expect(text('Атмосфера')).toContain('<<link "ВКЛ">><<sg-mus play section ambient>><</link>>');
		expect(text('Атмосфера')).toContain('<<sg-ambient>>\n\n\n[[Назад|Start]]');
		expect(text('Атмосфера')).not.toMatch(/playingtrack|<<audio|<<playlist/);
	});

	it('StoryInit: плейлисты и треки музыки уходят, остальные звуки на месте', () => {
		const init = findAudioInit(text('StoryInit')!).init;

		expect(init.lists).toEqual([]);
		expect(init.tracks.map(t => t.id)).toEqual(['msgsoundA', 'startscreentape', 'loopcomputer', 'radioMoonlight', 'radiovinyl']);
		expect(text('StoryInit')).not.toMatch(/radioplaying|ambientplaying|playingtrack/);
		expect(text('StoryInit')).toContain('<<set $buttoner to 0>>');
	});

	it('второй раз и при изменённом коде ничего не трогает', () => {
		const after = passages.map((p, i) => ({...p, text: moved.texts.get(i) ?? p.text}));

		expect(moveTemplateMusic([...after, {name: 'Музыка', tags: ['sg-music'], text: moved.music}])).toBeUndefined();

		const changed = passages.map(p => (p.name === 'radio' ? {...p, text: p.text + '\nсвоё'} : p));

		expect(moveTemplateMusic(changed)).toBeUndefined();
		expect(moveTemplateMusic(passages, 'radio')).toBeUndefined();
	});
});
