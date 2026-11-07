import {findLinks, parseAction, replaceLink, writeAction} from '../signaly-actions';
import {
	findScreenMusic,
	folderLeaf,
	folderParent,
	musicProblems,
	readMusic,
	screenMusicDefaults,
	setScreenMusic,
	treeOrder,
	writeMusic
} from '../signaly-music';
import {findBlocks, writeBlock} from '../signaly-screen-blocks';
import {readTicker, writeTicker} from '../signaly-ticker';

describe('каталог «Музыка» (шаг 7.1)', () => {
	const text =
		'/* пояснение */\n<<sg-music volume 40 spin 1 auto>>\n<<sg-folder "Классика" section ambient>>\n' +
		'<<sg-track "Галл" "media/audio/a.mp3" start 10>><</sg-track>>\n' +
		'<<sg-track "Люди" "media/audio/b.mp3" pre "media/audio/игла.wav" wait 8 tail 2>>$found is 1<</sg-track>>\n' +
		'<<sg-folder "Эфир" section radio>>\n';

	it('читает настройки, папки и треки', () => {
		const c = readMusic(text);

		expect(c.settings).toEqual({volume: 40, spin: 1, auto: true});
		expect(c.folders.map(f => [f.name, f.section, f.tracks.length])).toEqual([
			['Классика', 'ambient', 2],
			['Эфир', 'radio', 0]
		]);
		expect(c.folders[0].tracks[0].start).toBe(10);
		expect(c.folders[0].tracks[1]).toMatchObject({pre: 'media/audio/игла.wav', wait: 8, tail: 2, when: '$found is 1'});
	});

	it('запись и повторное чтение дают то же; пояснение остаётся', () => {
		const c = readMusic(text);
		const out = writeMusic(text, c);

		expect(out.startsWith('/* пояснение */')).toBe(true);
		expect(readMusic(out)).toEqual(c);
		expect(writeMusic(out, c)).toBe(out);
	});

	it('повторы и пустые имена не дают сохранить', () => {
		const c = readMusic(text);

		expect(Object.values(musicProblems(c)).some(Boolean)).toBe(false);
		c.folders[1].name = 'Классика';
		expect(musicProblems(c).repeatedFolder).toBe(true);
	});
});

describe('шаг 7.3: вложенные папки, громкость файла, эфир', () => {
	const text =
		'<<sg-music volume 30 spin 0.8>>\n<<sg-folder "Дневники" section radio>>\n' +
		'<<sg-track "Запись 1" "media/audio/d1.mp3" gain 40>><</sg-track>>\n' +
		'<<sg-folder "Глава 1" section radio>>\n' +
		'<<sg-folder "Дневники/Капитан" section ambient>>\n' +
		'<<sg-track "Запись 2" "media/audio/d2.mp3">><</sg-track>>\n' +
		'<<sg-folder "Эфир" section air>>\n' +
		'<<sg-track "Перехват" "media/audio/p.mp3" to "Дневники/Капитан" width 0.8 text "СИГНАЛ SOS">>$chapter gte 2<</sg-track>>\n' +
		'<<sg-track "Морзе" "media/audio/m.mp3">><</sg-track>>\n';

	it('путь папки, порядок дерева, раздел вложенной — как у верхней', () => {
		const c = readMusic(text);

		expect(folderParent('Дневники/Капитан')).toBe('Дневники');
		expect(folderParent('Дневники')).toBe('');
		expect(folderLeaf('Дневники/Капитан')).toBe('Капитан');
		expect(treeOrder(c.folders).map(f => [f.name, f.section])).toEqual([
			['Дневники', 'radio'],
			['Дневники/Капитан', 'radio'],
			['Глава 1', 'radio'],
			['Эфир', 'air']
		]);
	});

	it('громкость файла и передачи эфира пишутся и читаются', () => {
		const c = readMusic(text);
		const out = writeMusic('', c);

		expect(c.folders[0].tracks[0].gain).toBe(40);
		expect(c.folders[1].tracks[0].gain).toBe(100);
		expect(c.folders[3].tracks[0]).toMatchObject({to: 'Дневники/Капитан', width: 0.8, text: 'СИГНАЛ SOS', when: '$chapter gte 2'});
		expect(c.folders[3].tracks[1]).toMatchObject({to: '', width: 1.5, text: ''});
		expect(out).toContain('<<sg-track "Запись 1" "media/audio/d1.mp3" gain 40>>');
		expect(out).toContain('<<sg-track "Перехват" "media/audio/p.mp3" to "Дневники/Капитан" width 0.8 text "СИГНАЛ SOS">>');
		expect(out).toContain('<<sg-track "Морзе" "media/audio/m.mp3">>');
		// Вложенная папка записывается сразу за своей и с разделом верхней.
		expect(out.indexOf('"Дневники/Капитан" section radio')).toBeGreaterThan(out.indexOf('"Дневники" section radio'));
		expect(out.indexOf('"Дневники/Капитан"')).toBeLessThan(out.indexOf('"Глава 1"'));
		expect(writeMusic(out, readMusic(out))).toBe(out);
	});

	it('передача в папку, которой нет, и пустая часть пути не дают сохранить', () => {
		const c = readMusic(text);

		expect(Object.values(musicProblems(c)).some(Boolean)).toBe(false);
		c.folders[3].tracks[0].to = 'Нет такой';
		expect(musicProblems(c).noTarget).toBe(true);
		c.folders[3].tracks[0].to = '';
		c.folders[1].name = 'Глава 1/';
		expect(musicProblems(c).emptyFolder).toBe(true);
	});
});

describe('музыка экрана', () => {
	it('ставит, читает и убирает первую строку', () => {
		const text = 'Текст экрана';
		const on = setScreenMusic(text, {...screenMusicDefaults, delay: 5, play: 'folder', target: 'Классика', after: 1, rise: 2});

		expect(on).toBe('<<sg-screen-music delay 5 now fade fade 3 play folder "Классика" after 1 rise 2>>\\\nТекст экрана');
		expect(findScreenMusic(on)).toMatchObject({delay: 5, now: 'fade', fade: 3, play: 'folder', target: 'Классика', after: 1, rise: 2});
		expect(setScreenMusic(on, undefined)).toBe(text);
		expect(findScreenMusic('<<sg-screen-music play ambient>>')).toMatchObject({now: '', play: 'ambient'});
	});
});

describe('действие «Музыка»', () => {
	it.each([
		'<<sg-mus play track "Классика/Галл">>',
		'<<sg-mus play folder "Классика">>',
		'<<sg-mus toggle radio>>',
		'<<sg-mus pause>>',
		'<<sg-mus resume>>',
		'<<sg-mus stop>>',
		'<<sg-mus next>>',
		'<<sg-mus volume 30>>',
		'<<sg-mus volume +5>>',
		'<<sg-mus volume -5>>',
		'<<sg-mus auto toggle>>'
	])('%s понимается и пишется так же', piece => {
		const a = parseAction(piece);

		expect(a.type).toBe('music');
		expect(writeAction({...a, raw: undefined})).toBe(piece);
	});
});

describe('порция 2', () => {
	it('старый блок «Окно-сообщение» — ссылка с действием «Открыть окно»; без правок не меняется', () => {
		const text = 'А <<sg-dialog "Кнопка" title "Заголовок" button>>Текст.<</sg-dialog>> Б';
		const links = findLinks(text);

		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({form: 'button', label: 'Кнопка', passage: ''});
		expect(links[0].actions[0]).toMatchObject({type: 'dialog', title: 'Заголовок', text: 'Текст.'});
		expect(replaceLink(text, links[0], links[0])).toBe(text);
		expect(replaceLink(text, links[0], {...links[0], label: 'Новая'})).toBe(
			'А <<button "Новая">><<sg-open "Заголовок">>Текст.<</sg-open>><</button>> Б'
		);
	});

	it('перебор картинками: слова пишутся и читаются', () => {
		const text =
			'<<sg-pick var "$lamp" form image width 300 sound "media/audio/c.wav" volume 80>>\n<<sg-opt "Выкл" 0 img "media/img/off.jpg">>\n<<sg-opt "Вкл" 1 img "media/img/on.jpg">>\n<</sg-pick>>';
		const [block] = findBlocks(text);

		expect(block.values).toMatchObject({form: 'image', width: 300, sound: 'media/audio/c.wav', volume: 80});
		expect(block.options![1].values).toMatchObject({label: 'Вкл', value: 1, img: 'media/img/on.jpg'});
		expect(writeBlock(block)).toBe(text);
	});

	it('цифры цикла: по умолчанию DSEG7, «как у строки» пишется словом none', () => {
		const text = '<<sg-ticker screen "Start">>\n<<sg-cycle var "$p" spin 10 gap 0.5 from "20,20,20,20,20" to "2,2,2,2,2">>\n';
		const data = readTicker(text, 'Start');

		expect(data.cycle.font).toBe('media/fonts/DSEG7Classic-Regular.woff2');
		expect(writeTicker(text, data)).not.toContain('font "');
		expect(writeTicker(text, {...data, cycle: {...data.cycle, font: 'none'}})).toContain('font "none"');
		expect(readTicker(writeTicker(text, {...data, cycle: {...data.cycle, font: 'none'}}), 'Start').cycle.font).toBe('none');
	});
});
