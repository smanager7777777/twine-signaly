// «Twine СИГНАЛЫ»: перевод музыки шаблона 27_03_2025 на общий плеер (шаг 7.2, ответ 5А).
//
// Переносится, только если узнано всё сразу: экраны Start, audiobuttons, radio, «Атмосфера»
// и плейлисты StoryInit. Иначе история не трогается (свой код автора работает как раньше).
//   - StoryInit: плейлисты «Классика», «new», «третья» → папки «Атмосферы», треки радио → папка «Радио»
//     с предзвуком radiovinyl через 8 с; эти треки и плейлисты уходят из раздела окна «Звуки»;
//     $radioplaying, $ambientplaying, $playingtrack уходят;
//   - Start: переключатель Атмосферы → «Музыка экрана: Атмосферу дальше»;
//   - audiobuttons: РАД, АТМ, A–E → действие «Музыка» (вид и места кнопок те же);
//   - radio → блок «Радио» (вид «Сломанное», каркас С2);
//   - «Атмосфера»: ВКЛ, ПАУЗА, Далее, A–E → действие «Музыка», плейлисты → «Каталог Атмосферы».

import {scriptHash} from './signaly-hack';
import {MusicCatalog, musicDefaults, screenMusicDefaults, setScreenMusic, writeMusic} from './signaly-music';
import {radioDefaults, writeRadios} from './signaly-radio';
import {findAudioInit, withAudioInit} from './signaly-sounds';

export const templateRadioView = 'Сломанное';

const startHead =
	'\\<<if $radioplaying is 0>>\n\\<<if $ambientplaying is 0>>\n\\<<set $ambientplaying to 1>>\n' +
	'\\<<audio ":paused:not(:RADIO)" play>>\n\\<</if>>\n\\<</if>>\n';

const radBody =
	'\n<<if $radioplaying is 1>>\n<<set $radioplaying to 0>>\n<<audio ":RADIO" pause>>\n<<else>>\n<<set $radioplaying to 1>>\n' +
	'<<set $ambientplaying to 0>>\n<<audio ":AMBIENT" pause>>\n<<audio ":paused:not(:AMBIENT)" play>>\n<</if>>\n';

const atmBody =
	'\n<<if $ambientplaying is 1>>\n<<set $ambientplaying to 0>>\n<<audio ":AMBIENT" pause>>\n<<else>>\n<<set $ambientplaying to 1>>\n' +
	'<<set $radioplaying to 0>>\n<<audio ":RADIO" pause>>\n<<audio ":paused:not(:RADIO)" play>>\n<</if>>\n';

const silentIf =
	'<<if $radioplaying is 0>>\n<<if $ambientplaying is 0>>\n<<audio ":paused:not(:RADIO)" play>>\n<<set $ambientplaying to 1>>\n<</if>>\n<</if>>\n';

/** A–E: громкость 0,1 … 1,0 → 10, 20, 30, 50, 99 (решение 128, п. 4). */
const volumes: Array<[string, string, number]> = [
	['A', '0.1', 10],
	['B', '0.2', 20],
	['C', '0.3', 30],
	['D', '0.5', 50],
	['E', '1.0', 99]
];

const aeBody = (level: string) => `\n<<audio ":playing:not(:TERMINAL)" fadeto ${level}>>\n`;

// Контрольные числа текста шаблона: экран radio целиком и «Атмосфера» до первого [[Назад|Start]].
const radioHash = 2296764883;
const ambientHash = 4001170201;
const ambientEnd = '\n\n\n[[Назад|Start]]';

const radioTracks: Array<[string, string]> = [
	['Трек 1 radioRegentropfen', 'radioRegentropfen'],
	['Трек 2 radioSchubert_serenade', 'radioSchubert_serenade'],
	['Трек 3 radioraindrop', 'radioraindrop']
];
const playlists = ['Классика', 'new', 'третья'];

/** Заменить тело ссылки <<link "Надпись">>…<</link>>; undefined — тело не то. */
function swapBody(text: string, label: string, body: string, to: string) {
	const head = `<<link "${label}">>`;
	const at = text.indexOf(head + body + '<</link>>');

	if (at === -1) {
		return undefined;
	}
	return text.slice(0, at) + head + to + text.slice(at + head.length + body.length);
}

export interface TemplateMusicPassage {
	name: string;
	tags: string[];
	text: string;
}

export interface TemplateMusic {
	/** Номер пассажа → новый текст (только изменённые). */
	texts: Map<number, string>;
	/** Тексты новых пассажей «Музыка» и «Радио». */
	music: string;
	radio: string;
}

export function moveTemplateMusic(passages: TemplateMusicPassage[], exclude?: string): TemplateMusic | undefined {
	if (passages.some(p => p.tags.includes('sg-music') || p.tags.includes('sg-radio') || p.name === 'Музыка' || p.name === 'Радио')) {
		return undefined;
	}

	const index = (name: string) => passages.findIndex(p => p.name === name);
	const at = {
		init: passages.findIndex(p => p.tags.includes('StoryInit') || p.name === 'StoryInit'),
		start: index('Start'),
		buttons: index('audiobuttons'),
		radio: index('radio'),
		ambient: index('Атмосфера')
	};

	if (Object.values(at).some(i => i === -1) || Object.values(at).some(i => passages[i].name === exclude)) {
		return undefined;
	}

	const texts = new Map<number, string>();

	// Start: переключатель Атмосферы в начале экрана.
	const start = passages[at.start].text;

	if (!start.startsWith(startHead)) {
		return undefined;
	}
	texts.set(at.start, setScreenMusic(start.slice(startHead.length), {...screenMusicDefaults, now: '', play: 'ambient'}));

	// audiobuttons: РАД, АТМ, A–E и переключатель в <<silent>>.
	let buttons: string | undefined = passages[at.buttons].text;

	buttons = swapBody(buttons, 'РАД', radBody, '<<sg-mus toggle radio>>');
	buttons = buttons && swapBody(buttons, 'АТМ', atmBody, '<<sg-mus toggle ambient>>');
	for (const [label, level, volume] of volumes) {
		buttons = buttons && swapBody(buttons, label, aeBody(level), `<<sg-mus volume ${volume}>>`);
	}
	if (!buttons || !buttons.includes(silentIf)) {
		return undefined;
	}
	texts.set(at.buttons, buttons.replace(silentIf, ''));

	// radio — целиком блоком «Радио».
	if (scriptHash(passages[at.radio].text.replace(/\s+$/, '')) !== radioHash) {
		return undefined;
	}
	texts.set(at.radio, `<<sg-radio ${JSON.stringify(templateRadioView)}>>\n`);

	// «Атмосфера»: кнопки — действием «Музыка», плейлисты — «Каталогом Атмосферы».
	const ambient = passages[at.ambient].text;
	const end = ambient.indexOf(ambientEnd);

	if (end === -1 || scriptHash(ambient.slice(0, end)) !== ambientHash) {
		return undefined;
	}

	let head: string | undefined = ambient.slice(ambient.indexOf('\n') + 1, ambient.indexOf('<<link "Плейлист Классика">>'));

	head = swapBody(head, 'ВКЛ', '\n<<audio ":RADIO" pause>>\n<<audio ":paused:not(:RADIO)" play>>\n<<set $ambientplaying to 1>>\n', '<<sg-mus play section ambient>>');
	head =
		head &&
		swapBody(
			head,
			'ПАУЗА',
			'\n<<audio ":AMBIENT" pause>>\n<<audio ":RADIO" pause>>\n<<set $ambientplaying to 0>>\n<<set $radioplaying to 0>>\n',
			'<<sg-mus pause>>'
		);
	head = head && swapBody(head, 'Далее', '\n<<audio ":playing:not(:TERMINAL)" time 999>>\n', '<<sg-mus next>>');
	for (const [label, level, volume] of volumes) {
		head = head && swapBody(head, label, aeBody(level), `<<sg-mus volume ${volume}>>`);
	}
	if (!head) {
		return undefined;
	}
	texts.set(at.ambient, head + '<<sg-ambient>>' + ambient.slice(end));

	// StoryInit: каталог из плейлистов и треков радио; они уходят из раздела «Звуки».
	const initText = passages[at.init].text;
	const {init} = findAudioInit(initText);
	const src = (id: string) => init.tracks.find(t => t.id === id)?.sources[0];
	const catalog: MusicCatalog = {settings: {...musicDefaults, volume: 10, auto: true}, folders: []};
	const moved = new Set<string>();

	for (const name of playlists) {
		const list = init.lists.find(l => l.id === name);

		if (!list || list.tracks.some(t => !src(t.id))) {
			return undefined;
		}
		catalog.folders.push({
			name,
			section: 'ambient',
			tip: '',
			tracks: list.tracks.map(t => {
				moved.add(t.id);
				return {
					name: src(t.id)!.replace(/^.*\//, '').replace(/\.[^.]+$/, ''),
					src: src(t.id)!,
					pre: '',
					wait: 3,
					tail: 2,
					preVolume: 100,
					when: ''
				};
			})
		});
	}

	const vinyl = src('radiovinyl');

	if (!vinyl || radioTracks.some(([, id]) => !src(id))) {
		return undefined;
	}
	catalog.folders.push({
		name: 'Радио',
		section: 'radio',
		tip: '',
		tracks: radioTracks.map(([name, id]) => {
			moved.add(id);
			return {name, src: src(id)!, pre: vinyl, wait: 8, tail: 2, preVolume: 100, when: ''};
		})
	});

	const nextInit = withAudioInit(initText, {
		tracks: init.tracks.filter(t => !moved.has(t.id)),
		groups: init.groups.map(g => ({...g, tracks: g.tracks.filter(id => !moved.has(id))})),
		lists: init.lists.filter(l => !playlists.includes(l.id))
	}).replace(/^<<set \$(radioplaying|ambientplaying|playingtrack) to [^\n]*>>\n/gm, '');

	texts.set(at.init, nextInit);
	return {
		texts,
		music: writeMusic('', catalog),
		radio: writeRadios('', [{...radioDefaults, name: templateRadioView, extra: []}])
	};
}
