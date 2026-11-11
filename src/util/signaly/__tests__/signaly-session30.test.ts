// Сессия 30: помехи в окне «Музыка», радио с декодером, копии реверса моно 22 кГц, картинки SSTV.

import {
	caughtJamsFolder,
	musicProblems,
	readMusic,
	renameJamFolder,
	syncJamFolders,
	treeOrder,
	writeMusic
} from '../signaly-music';
import {newRadioView, radioPartFor, radioProblems, readRadios, withoutLegacyJams, writeRadios} from '../signaly-radio';
import {mixMono, needsReverse, reverseJobs, reverseRate} from '../signaly-reverse';
import {decodeSstv, encodeSstv, sstvMode} from '../signaly-sstv';
import {needsSstv, readSstv, sstvImagePath, sstvSources, writeSstv} from '../signaly-sstv-store';

const music = `<<sg-music volume 30 spin 0.8 auto>>
<<sg-folder "Дневники" section radio>>
<<sg-track "Запись 1" "media/audio/d1.mp3">><</sg-track>>
<<sg-folder "Эфир" section air>>
<<sg-track "SOS" "media/audio/air/sos.mp3" to "Дневники">><</sg-track>>
<<sg-folder "Ремонт" section jam>>
<<sg-track "Треск" "media/audio/jam/a.wav" width 0.6 gain 70>>$power<</sg-track>>
<<sg-track "Шорох" "media/audio/jam/b.wav">><</sg-track>>
`;

describe('раздел «Помехи»', () => {
	it('читает и пишет папку помех с шириной', () => {
		const c = readMusic(music);
		const jam = c.folders.find(f => f.section === 'jam')!;

		expect(jam.name).toBe('Ремонт');
		expect(jam.tracks.map(t => [t.name, t.width, t.gain, t.when])).toEqual([
			['Треск', 0.6, 70, '$power'],
			['Шорох', 1, 100, '']
		]);
		expect(writeMusic('', c)).toContain('<<sg-track "Треск" "media/audio/jam/a.wav" gain 70 width 0.6>>$power<</sg-track>>');
		expect(writeMusic('', c)).toContain('<<sg-track "Шорох" "media/audio/jam/b.wav">><</sg-track>>');
		expect(readMusic(writeMusic('', c))).toEqual(c);
	});

	it('папки помех не вкладываются и идут в конце', () => {
		const c = readMusic(music.replace('"Ремонт" section jam', '"Дневники" section jam'));

		expect(treeOrder(c.folders).map(f => [f.name, f.section])).toEqual([
			['Дневники', 'radio'],
			['Эфир', 'air'],
			['Дневники', 'jam']
		]);
		// Имя папки помех (вид радио) не спорит с папкой радио.
		expect(musicProblems(c).repeatedFolder).toBe(false);
	});

	it('папки — по видам радио с эфиром, старые помехи вида переносятся', () => {
		const views = readRadios(
			'<<sg-radio-view "Сломанное" type broken>>\n' +
				'<<sg-radio-view "Эфир 1" type fixed jam "media/audio/x.wav|0.8|60; media/audio/x.wav|1|90">>\n' +
				'<<sg-radio-view "Ремонт" type reverse>>\n'
		);
		const sync = syncJamFolders(readMusic(music), views);
		const jams = sync.catalog.folders.filter(f => f.section === 'jam');

		expect(jams.map(f => f.name)).toEqual(['Эфир 1', 'Ремонт']);
		expect(sync.migrated).toEqual(['Эфир 1']);
		expect(jams[0].tracks.map(t => [t.name, t.src, t.width, t.gain])).toEqual([
			['x', 'media/audio/x.wav', 0.8, 60],
			['x 2', 'media/audio/x.wav', 1, 90]
		]);
		expect(jams[1].tracks).toHaveLength(2);
		// Вида больше нет — папка остаётся в конце.
		const orphan = syncJamFolders(readMusic(music), views.slice(0, 2));

		expect(orphan.orphans).toEqual(['Ремонт']);
		expect(orphan.catalog.folders.filter(f => f.section === 'jam').map(f => f.name)).toEqual(['Эфир 1', 'Ремонт']);
	});

	it('переименование вида переименовывает папку помех', () => {
		const text = renameJamFolder(music, 'Ремонт', 'Ремонт 2');

		expect(text).toContain('<<sg-folder "Ремонт 2" section jam>>');
		expect(renameJamFolder(music, 'Нет', 'Да')).toBe(music);
	});

	it('старая запись помех у вида убирается, когда помехи в «Музыке»', () => {
		const radio = '<<sg-radio-view "Эфир 1" type fixed jam "a.wav|1|80" jamsmin 2 jamsmax 3>>\n';

		expect(withoutLegacyJams(radio, ['Эфир 1'])).not.toContain('jam "');
		expect(withoutLegacyJams(radio, ['Эфир 1'])).toContain('jamsmin 2 jamsmax 3');
		expect(withoutLegacyJams(radio, ['Другое'])).toBe(radio);
	});

	it('пойманные помехи — в папке «Помехи» каталога радио', () => {
		expect(caughtJamsFolder).toBe('Помехи');
	});
});

describe('радио с декодером', () => {
	it('тип, свои цвета лампочки и декодера, эфир', () => {
		const view = {...newRadioView([]), name: 'Д', type: 'decoder' as const, lamp: '#ff0000', decoder: '#00ffff', noise: 'n.wav'};
		const text = writeRadios('', [view]);

		expect(text).toContain('type decoder');
		expect(text).toContain('lamp "#ff0000"');
		expect(text).toContain('decoder "#00ffff"');
		expect(text).toContain('noise "n.wav"');
		expect(readRadios(text)[0]).toMatchObject({type: 'decoder', lamp: '#ff0000', decoder: '#00ffff'});
		expect(radioPartFor('decoder', 'decoder')).toBe(true);
		expect(radioPartFor('decoder', 'reverse')).toBe(false);
		expect(radioPartFor('lamp', 'broken')).toBe(false);
		expect(radioPartFor('lamp', 'fixed')).toBe(true);
		expect(needsReverse([view])).toBe(true);
		expect(needsSstv([view])).toBe(true);
		expect(needsSstv([{type: 'reverse'}])).toBe(false);
	});

	it('«/» в названии вида нельзя', () => {
		expect(radioProblems([{...newRadioView([]), name: 'А/Б'}]).slash).toBe(true);
	});
});

describe('копии реверса и помехи', () => {
	it('моно 22 050 Гц', () => {
		expect(reverseRate).toBe(22050);
		expect(Array.from(mixMono([new Float32Array([1, 0.5]), new Float32Array([0, -0.5])]))).toEqual([0.5, 0]);
	});

	it('помехи тоже разворачиваются (их можно поймать)', () => {
		expect(reverseJobs(readMusic(music)).map(j => j.src)).toEqual([
			'media/audio/d1.mp3',
			'media/audio/air/sos.mp3',
			'media/audio/jam/a.wav',
			'media/audio/jam/b.wav'
		]);
	});
});

describe('картинки SSTV', () => {
	it('где лежат и из каких звуков', () => {
		expect(sstvImagePath('media/audio/air/sos.mp3', 2)).toBe('media/img/sstv/air/sos-2.png');
		expect(sstvSources(readMusic(music))).toEqual(['media/audio/air/sos.mp3', 'media/audio/jam/a.wav', 'media/audio/jam/b.wav']);
	});

	it('пассаж «SSTV»: запись и чтение', () => {
		const files = new Map([
			[
				'media/audio/air/sos.mp3',
				{
					src: 'media/audio/air/sos.mp3',
					stamp: '17-48',
					images: [{img: 'media/img/sstv/air/sos-1.png', mode: 'Robot 36', at: 4.91123, line: 0.15, rows: 240, per: 1, width: 320, height: 240}]
				}
			],
			['media/audio/jam/a.wav', {src: 'media/audio/jam/a.wav', stamp: '5-9', images: []}]
		]);
		const text = writeSstv('', files);

		expect(text).toContain('<<sg-sstv "media/audio/jam/a.wav" stamp "5-9" none>>');
		expect(text).toContain('mode "Robot 36" at 4.9112 line 0.15 rows 240 per 1 width 320 height 240>>');
		expect(readSstv(text).get('media/audio/air/sos.mp3')!.images[0]).toMatchObject({mode: 'Robot 36', rows: 240, width: 320});
		expect(readSstv(text).get('media/audio/jam/a.wav')!.images).toEqual([]);
		// Пояснение остаётся, повтор записи ничего не меняет.
		expect(writeSstv(text, readSstv(text))).toBe(text);
	});

	it('кодировщик и декодер сходятся (Robot 36)', () => {
		const mode = sstvMode('Robot 36')!;
		const rgba = new Uint8ClampedArray(320 * 240 * 4);

		for (let y = 0; y < 240; y++) {
			for (let x = 0; x < 320; x++) {
				const i = (y * 320 + x) * 4;

				rgba[i] = x < 160 ? 230 : 20;
				rgba[i + 1] = y < 120 ? 200 : 40;
				rgba[i + 2] = 90;
				rgba[i + 3] = 255;
			}
		}

		const rate = 11025;
		const sound = encodeSstv(mode, rgba, 320, 240, rate, 1);
		const [image] = decodeSstv(sound, rate);

		expect(image.mode).toBe('Robot 36');
		expect(image.height).toBe(240);
		expect(Math.abs(image.at - 1.9)).toBeLessThan(0.3);
		expect(image.line).toBeCloseTo(0.15, 2);

		const px = (x: number, y: number) => Array.from(image.rgba.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 3));

		expect(px(60, 60)[0]).toBeGreaterThan(170);
		expect(px(260, 60)[0]).toBeLessThan(80);
		expect(px(60, 200)[1]).toBeLessThan(100);
	});
});
