// «Twine СИГНАЛЫ», сессия 29: цвета частей радио, реверс (шаг 7.4).
import {readMusic, writeMusic, writeTrack, trackDefaults} from '../signaly-music';
import {radioDefaults, radioReady, readRadios, writeView} from '../signaly-radio';
import {encodeWav, needsReverse, reverseChannels, reverseJobs, reversePath} from '../signaly-reverse';

describe('radio part colours (session 29)', () => {
	it('reads and writes own colours; empty stays out of the text', () => {
		const [v] = readRadios('<<sg-radio-view "А" type fixed frame "#111111" elements "#222222" label "Х" buttons "#ff0000" inner "#00ff00">>');

		expect(v.buttons).toBe('#ff0000');
		expect(v.inner).toBe('#00ff00');
		expect(v.power).toBe('');
		expect(v.extra).toEqual([]);

		const text = writeView(v);

		expect(text).toContain('buttons "#ff0000"');
		expect(text).toContain('inner "#00ff00"');
		expect(text).not.toContain('power');
		expect(readRadios(text)[0]).toEqual(v);
	});

	it('old views get no colours and are written as before', () => {
		const old = '<<sg-radio-view "Сломанное" type broken frame "#c9a24a" elements "#39ff7a" label "ОРБИТА-3" sparks 30>>';
		const [v] = readRadios(old);

		expect([v.buttons, v.power, v.scale, v.catalog, v.inner]).toEqual(['', '', '', '', '']);
		expect(writeView(v)).toBe(old);
	});

	it('reverse radio is ready and keeps the air band', () => {
		expect(radioReady).toContain('reverse');

		const view = {...radioDefaults, name: 'Р', type: 'reverse' as const, noise: 'media/audio/шум.wav', jams: [{src: 'a.wav', width: 1, volume: 80}]};
		const text = writeView(view);

		expect(text).toContain('type reverse');
		expect(text).toContain('noise "media/audio/шум.wav"');
		expect(readRadios(text)[0].jams).toEqual(view.jams);
		expect(needsReverse([view])).toBe(true);
		expect(needsReverse([{...view, type: 'fixed'}])).toBe(false);
	});
});

describe('reversed copies (step 7.4)', () => {
	it('puts the copy into media/audio/reverse with the same inner path', () => {
		expect(reversePath('media/audio/radio/x.mp3')).toBe('media/audio/reverse/radio/x.wav');
		expect(reversePath('./media/audio/Трек 1.ogg')).toBe('media/audio/reverse/Трек 1.wav');
		expect(reversePath('media/music/a.b.mp3')).toBe('media/audio/reverse/music/a.b.wav');
		expect(reversePath('song.mp3')).toBe('media/audio/reverse/song.wav');
	});

	it('own reverse file is read and written on the track', () => {
		const track = {...trackDefaults, name: 'Т', src: 'media/audio/t.mp3', reverse: 'media/audio/послание.wav'};
		const text = writeMusic('', {settings: {volume: 30, spin: 0.8, auto: true}, folders: [{name: 'Р', section: 'radio', tip: '', tracks: [track]}]});

		expect(writeTrack(track)).toContain('reverse "media/audio/послание.wav"');
		expect(readMusic(text).folders[0].tracks[0].reverse).toBe('media/audio/послание.wav');
	});

	it('copies only radio tracks and caught broadcasts, without own file, once per file', () => {
		const catalog = readMusic(
			'<<sg-folder "Атм" section ambient>>\n<<sg-track "А" "media/audio/a.mp3">><</sg-track>>\n' +
				'<<sg-folder "Р" section radio>>\n<<sg-track "Б" "media/audio/b.mp3">><</sg-track>>\n' +
				'<<sg-track "В" "media/audio/c.mp3" reverse "media/audio/c-back.wav">><</sg-track>>\n' +
				'<<sg-track "Б2" "media/audio/b.mp3">><</sg-track>>\n' +
				'<<sg-folder "Эфир" section air>>\n<<sg-track "Перехват" "media/audio/d.mp3" to "Р">><</sg-track>>\n' +
				'<<sg-track "Помеха" "media/audio/e.mp3">><</sg-track>>'
		);

		expect(reverseJobs(catalog)).toEqual([
			{src: 'media/audio/b.mp3', out: 'media/audio/reverse/b.wav'},
			{src: 'media/audio/d.mp3', out: 'media/audio/reverse/d.wav'}
		]);
	});

	it('reverses samples of every channel', () => {
		const [l, r] = reverseChannels([new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])]);

		expect(Array.from(l)).toEqual([3, 2, 1]);
		expect(Array.from(r)).toEqual([6, 5, 4]);
	});

	it('writes a 16-bit WAV with interleaved channels', () => {
		const wav = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0.5, -0.5, 2])], 44100);
		const view = new DataView(wav.buffer);
		const text = (at: number, n: number) => String.fromCharCode(...wav.slice(at, at + n));

		expect(text(0, 4)).toBe('RIFF');
		expect(text(8, 4)).toBe('WAVE');
		expect(view.getUint16(22, true)).toBe(2);
		expect(view.getUint32(24, true)).toBe(44100);
		expect(view.getUint16(34, true)).toBe(16);
		expect(view.getUint32(40, true)).toBe(12);
		expect(wav.length).toBe(56);
		expect([0, 1, 2, 3, 4, 5].map(i => view.getInt16(44 + i * 2, true))).toEqual([0, 16384, 32767, -16384, -32768, 32767]);
	});
});
