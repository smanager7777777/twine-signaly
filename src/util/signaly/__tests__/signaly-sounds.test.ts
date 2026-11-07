import {execSync} from 'child_process';
import {readFileSync} from 'fs';
import {join} from 'path';
import {
	audioInitMarkers,
	clickSetName,
	findAudioInit,
	hoverSetName,
	moveTemplateSounds,
	readSounds,
	removeSet,
	renameSet,
	renameSetInText,
	soundsMovedNote,
	templateSounds,
	withAudioInit,
	withSounds
} from '../signaly-sounds';

const root = join(__dirname, '../../../..');
const twee = readFileSync(join(root, 'signaly/template/27_03_2025.twee'), 'utf8');

function passage(source: string, name: string) {
	const at = source.indexOf(`:: ${name}`);
	const body = source.slice(source.indexOf('\n', at) + 1);

	return body.slice(0, body.search(/\n:: /));
}

// Шаблон до шага 2.2 (сессия 6, build-8): код звуков в JavaScript истории.
let oldTwee = '';

try {
	oldTwee = execSync('git show c6bc328:signaly/template/27_03_2025.twee', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
} catch {
	oldTwee = '';
}

describe('signaly-sounds', () => {
	it('блок наборов пишется и читается', () => {
		const sounds = {
			sets: [{name: 'Тихий', files: ['media/audio/a.wav'], volume: 30, delay: 120}],
			kinds: {'': {hover: 'Тихий'}, amber: {click: ''}, empty: {}}
		};
		const script = withSounds('// код автора\n', sounds);

		expect(readSounds(script)).toEqual({sets: sounds.sets, kinds: {'': {hover: 'Тихий'}, amber: {click: ''}}});
		expect(script.endsWith('// код автора\n')).toBe(true);
		expect(withSounds(script, sounds)).toBe(script);
	});

	it('шаблон: код звуков стал наборами вида «Обычный» с теми же файлами и громкостью', () => {
		const script = passage(twee, 'StoryScript');
		const sounds = readSounds(script)!;

		expect(sounds.sets.map(s => [s.name, s.files.length, s.volume, s.delay])).toEqual([
			[hoverSetName, 6, 5, 0],
			[clickSetName, 3, 5, 0]
		]);
		expect(sounds.sets[0].files[0]).toBe('media/audio/hover1.wav');
		expect(sounds.kinds['']).toEqual({hover: hoverSetName, click: clickSetName});
		expect(script).toContain(soundsMovedNote.trim());
		expect(script).not.toContain('Звуки наведения и нажатия на ссылки и кнопки =====');
		expect(script).not.toContain('var hoverSounds');
	});

	(oldTwee ? it : it.skip)('перенос кода шаблона build-8', () => {
		const script = passage(oldTwee, 'StoryScript');
		const found = templateSounds(script)!;

		expect(found.sounds.sets[1].files).toEqual(['media/audio/click1.wav', 'media/audio/click2.wav', 'media/audio/click3.wav']);

		const moved = moveTemplateSounds(script);

		expect(readSounds(moved)).toEqual(found.sounds);
		// Повторно — ничего не меняется (блок уже есть).
		expect(moveTemplateSounds(moved)).toBe(moved);
	});

	it('переименование и удаление набора', () => {
		const sounds = {
			sets: [
				{name: 'А', files: [], volume: 100, delay: 0},
				{name: 'Б', files: [], volume: 100, delay: 0}
			],
			kinds: {'': {hover: 'А', click: 'Б'}, amber: {hover: 'Б'}}
		};

		expect(renameSet(sounds, 'Б', 'В').kinds).toEqual({'': {hover: 'А', click: 'В'}, amber: {hover: 'В'}});
		expect(removeSet(sounds, 'Б')).toEqual({sets: [sounds.sets[0]], kinds: {'': {hover: 'А'}, amber: {}}});
		expect(renameSetInText('<<sg-place corner tr hover "Б" click none>>x<</sg-place>> hover "Б"', 'Б', 'В')).toBe(
			'<<sg-place corner tr hover "В" click none>>x<</sg-place>> hover "Б"'
		);
	});

	it('StoryInit шаблона: файлы, группы, плейлисты — те же, что были', () => {
		// Шаг 7.2: музыка шаблона ушла в каталог «Музыка»; здесь — StoryInit шаблона до перевода.
		const before = (() => {
			try {
				return execSync('git show 4b9ae32:signaly/template/27_03_2025.twee', {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
			} catch {
				return '';
			}
		})();

		if (!before) {
			return;
		}

		const init = findAudioInit(passage(before, 'StoryInit')).init;

		expect(init.tracks).toHaveLength(17);
		expect(init.tracks[0]).toEqual({id: 'msgsoundA', sources: ['media/audio/msgsoundA.wav']});
		expect(init.groups.map(g => [g.id, g.tracks.length])).toEqual([
			[':TERMINAL', 2],
			[':AMBIENT', 10],
			[':RADIO', 4]
		]);
		expect(init.lists[0]).toEqual({
			id: 'Классика',
			tracks: [
				{id: 'Классика1', volume: 0.1},
				{id: 'Классика2', volume: 0.02},
				{id: 'Классика3', volume: 0.3}
			]
		});
		if (oldTwee) {
			expect(findAudioInit(passage(oldTwee, 'StoryInit')).init).toEqual(init);
		}
	});

	it('раздел окна «Звуки»: на месте первой команды, остальное не трогается, повторно — без изменений', () => {
		const text = '<<waitforaudio>>\n<<cacheaudio "a" "media/audio/a.wav">>\n\n<<set $x to 1>>\n<<createplaylist "P">>\n  <<track "a" volume 0.5 own>>\n<</createplaylist>>\n<<set $y to 2>>';
		const found = findAudioInit(text);
		const once = withAudioInit(text, found.init);

		expect(once).toBe(
			'<<waitforaudio>>\n' +
				audioInitMarkers.start +
				'\n<<cacheaudio "a" "media/audio/a.wav">>\n\n<<createplaylist "P">>\n<<track "a" volume 0.5 own>>\n<</createplaylist>>\n' +
				audioInitMarkers.end +
				'\n\n<<set $x to 1>>\n<<set $y to 2>>'
		);
		expect(findAudioInit(once).init).toEqual(found.init);
		expect(withAudioInit(once, found.init)).toBe(once);

		const added = withAudioInit(once, {...found.init, groups: [{id: ':G', tracks: ['a']}]});

		expect(findAudioInit(added).init.groups).toEqual([{id: ':G', tracks: ['a']}]);
		expect(added.endsWith('<<set $x to 1>>\n<<set $y to 2>>')).toBe(true);
	});

	it('пустой StoryInit: раздел встаёт в начало', () => {
		const made = withAudioInit('', {tracks: [{id: 'a', sources: ['media/audio/a.wav']}], groups: [], lists: []});

		expect(findAudioInit(made).init.tracks).toEqual([{id: 'a', sources: ['media/audio/a.wav']}]);
	});
});
