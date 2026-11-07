// «Twine СИГНАЛЫ»: музыка — каталог, общий плеер, «Музыка экрана» (этап 7, шаг 7.1).
//
// Каталог — пассаж «Музыка» с тегом sg-music (обычный текст, работает в обычном Twine):
//   <<sg-music volume 30 spin 0.8 [auto]>>                 — общие настройки
//   <<sg-folder "Классика" section ambient|radio [tip "Подсказка"]>> — папка (раздел «Атмосфера» или «Радио»);
//                                                          tip — подсказка альбома в «Каталоге Атмосферы» (шаг 7.2)
//   <<sg-track "Название" "media/audio/x.mp3" [pre "media/audio/игла.wav" wait 3 tail 2 prevolume 100]
//     [start 40]>>условие<</sg-track>>                     — трек папки (идёт после своей папки)
// Условие пустое — трек есть всегда; иначе — как в <<if>>.
//
// Музыка экрана — первая строка экрана:
//   <<sg-screen-music [delay 5] [now stop|fade] [fade 3] [play track "Папка/Трек" | folder "Папка" | ambient]
//     [after 1.5] [rise 2]>>\
// Действия ссылок, кнопок, клавиш — <<sg-mus …>> (signaly-actions.ts).

import {arg} from './signaly-link-form';
import {findClose, scanArgs} from './signaly-screen-blocks';

export const musicTag = 'sg-music';
export const musicPassageName = 'Музыка';

export type MusicSection = 'ambient' | 'radio';
export const musicSections: MusicSection[] = ['ambient', 'radio'];

export interface MusicTrack {
	name: string;
	src: string;
	/** Предзвук: файл, через сколько секунд начинается трек, сколько ещё звучит предзвук. */
	pre: string;
	wait: number;
	tail: number;
	preVolume: number;
	/** Начальная громкость 0–99 при первом включении; undefined — не задана. */
	start?: number;
	/** Условие как в <<if>>; '' — всегда. */
	when: string;
}

export interface MusicFolder {
	name: string;
	section: MusicSection;
	/** Подсказка при наведении на альбом в «Каталоге Атмосферы» (шаг 7.2, ответ 6А). */
	tip: string;
	tracks: MusicTrack[];
}

export interface MusicSettings {
	/** Громкость в начале игры, 0–99. */
	volume: number;
	/** Сколько секунд крутятся цифры громкости. */
	spin: number;
	/** «АВТО» включено в начале игры. */
	auto: boolean;
}

export interface MusicCatalog {
	settings: MusicSettings;
	folders: MusicFolder[];
}

export const musicDefaults: MusicSettings = {volume: 30, spin: 0.8, auto: true};

export const trackDefaults: Omit<MusicTrack, 'name' | 'src'> = {pre: '', wait: 3, tail: 2, preVolume: 100, when: ''};

export const musicHeader =
	'/* СИГНАЛЫ: музыка — правьте в окне «Музыка» (вкладка «История»). Папки и треки идут\n' +
	'   по порядку; трек относится к папке выше. Условие трека — внутри <<sg-track>>…<</sg-track>>. */\n';

interface Found {
	from: number;
	to: number;
	tokens: string[];
	content: string;
}

function unquote(token: string) {
	if (/^(["']).*\1$/s.test(token)) {
		try {
			return token.startsWith('"') ? JSON.parse(token) : token.slice(1, -1);
		} catch {
			return token.slice(1, -1);
		}
	}
	return token;
}

/** Куски /* … *\/ — команды в пояснениях не считаются (в заголовке пассажа есть образец). */
export function commentRanges(text: string) {
	return [...text.matchAll(/\/\*[^]*?\*\//g)].map(m => ({from: m.index!, to: m.index! + m[0].length}));
}

function find(text: string, name: string, container: boolean): Found[] {
	const re = new RegExp(`<<${name}(?=[\\s>])`, 'g');
	const out: Found[] = [];
	const comments = commentRanges(text);
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const at = m.index;

		if (comments.some(c => at >= c.from && at < c.to)) {
			continue;
		}

		const scan = scanArgs(text, m.index + name.length + 2);

		if (!scan) {
			continue;
		}

		let to = scan.end;
		let content = '';

		if (container) {
			const close = findClose(text, name, scan.end);

			if (close) {
				content = text.slice(scan.end, close.at);
				to = close.end;
			}
		}
		out.push({from: m.index, to, tokens: scan.tokens, content});
		re.lastIndex = to;
	}
	return out;
}

function words(tokens: string[], positional: number) {
	const pos: string[] = [];
	const values: Record<string, string> = {};
	const flags = new Set<string>();

	for (let i = 0; i < tokens.length; i++) {
		if (pos.length < positional) {
			pos.push(unquote(tokens[i]));
		} else if (i + 1 < tokens.length && !/^["']/.test(tokens[i]) && /^[a-z]+$/.test(tokens[i]) && tokens[i] !== 'auto') {
			values[tokens[i]] = unquote(tokens[i + 1]);
			i++;
		} else {
			flags.add(unquote(tokens[i]));
		}
	}
	return {pos, values, flags};
}

const num = (value: string | undefined, fallback: number) => {
	const n = Number(String(value ?? '').replace(',', '.'));

	return value !== undefined && value !== '' && isFinite(n) ? n : fallback;
};

export const clampVolume = (n: number) => Math.max(0, Math.min(99, Math.round(n)));

/** Прочитать каталог из текста пассажа «Музыка». */
export function readMusic(text: string): MusicCatalog {
	const settings = {...musicDefaults};
	const head = find(text, 'sg-music', false)[0];

	if (head) {
		const w = words(head.tokens, 0);

		settings.volume = clampVolume(num(w.values.volume, settings.volume));
		settings.spin = Math.max(0, num(w.values.spin, settings.spin));
		settings.auto = w.flags.has('auto') || head.tokens.includes('auto');
	}

	const items = [
		...find(text, 'sg-folder', false).map(f => ({kind: 'folder' as const, f})),
		...find(text, 'sg-track', true).map(f => ({kind: 'track' as const, f}))
	].sort((a, b) => a.f.from - b.f.from);
	const folders: MusicFolder[] = [];

	for (const item of items) {
		if (item.kind === 'folder') {
			const w = words(item.f.tokens, 1);

			folders.push({
				name: w.pos[0] ?? '',
				section: w.values.section === 'radio' ? 'radio' : 'ambient',
				tip: w.values.tip ?? '',
				tracks: []
			});
			continue;
		}

		const w = words(item.f.tokens, 2);

		if (!folders.length) {
			folders.push({name: 'Музыка', section: 'ambient', tip: '', tracks: []});
		}
		folders[folders.length - 1].tracks.push({
			name: w.pos[0] ?? '',
			src: w.pos[1] ?? '',
			pre: w.values.pre ?? '',
			wait: Math.max(0, num(w.values.wait, trackDefaults.wait)),
			tail: Math.max(0, num(w.values.tail, trackDefaults.tail)),
			preVolume: Math.max(0, Math.min(100, num(w.values.prevolume, trackDefaults.preVolume))),
			start: w.values.start !== undefined ? clampVolume(num(w.values.start, 0)) : undefined,
			when: item.f.content.trim()
		});
	}
	return {settings, folders};
}

export function writeTrack(t: MusicTrack) {
	const parts = [arg(t.name), arg(t.src)];

	if (t.pre) {
		parts.push('pre', arg(t.pre), 'wait', String(t.wait), 'tail', String(t.tail));
		if (t.preVolume !== 100) {
			parts.push('prevolume', String(t.preVolume));
		}
	}
	if (t.start !== undefined) {
		parts.push('start', String(clampVolume(t.start)));
	}
	return `<<sg-track ${parts.join(' ')}>>${t.when.trim()}<</sg-track>>`;
}

/** Записать каталог в текст пассажа: всё, кроме команд каталога, остаётся. */
export function writeMusic(text: string, catalog: MusicCatalog) {
	const s = catalog.settings;
	const lines = [
		`<<sg-music volume ${clampVolume(s.volume)} spin ${s.spin}${s.auto ? ' auto' : ''}>>`,
		...catalog.folders.flatMap(f => [
			`<<sg-folder ${arg(f.name)} section ${f.section}${f.tip.trim() ? ` tip ${arg(f.tip.trim())}` : ''}>>`,
			...f.tracks.map(writeTrack)
		])
	];
	const found = [...find(text, 'sg-music', false), ...find(text, 'sg-folder', false), ...find(text, 'sg-track', true)].sort(
		(a, b) => a.from - b.from
	);
	let rest = text;

	for (const f of [...found].reverse()) {
		let to = f.to;

		while (rest[to] === '\n') {
			to++;
		}
		rest = rest.slice(0, f.from) + rest.slice(to);
	}
	if (rest.trim() === '') {
		rest = musicHeader;
	}
	return rest.replace(/\s*$/, '\n') + lines.join('\n') + '\n';
}

/** Повторы имён папок и треков в папке — «Сохранить» недоступна. */
export function musicProblems(catalog: MusicCatalog) {
	const names = catalog.folders.map(f => f.name.trim());

	return {
		emptyFolder: names.some(n => n === ''),
		repeatedFolder: new Set(names).size !== names.length,
		emptyTrack: catalog.folders.some(f => f.tracks.some(t => !t.name.trim() || !t.src)),
		repeatedTrack: catalog.folders.some(f => new Set(f.tracks.map(t => t.name.trim())).size !== f.tracks.length),
		slash: catalog.folders.some(f => f.name.includes('/') || f.tracks.some(t => t.name.includes('/')))
	};
}

/* ----- Музыка экрана ----- */

export type ScreenMusicNow = '' | 'stop' | 'fade';
export type ScreenMusicPlay = '' | 'track' | 'folder' | 'ambient';

export interface ScreenMusic {
	from: number;
	to: number;
	/** Через сколько секунд после входа. */
	delay: number;
	/** Что с текущей музыкой: '' — оставить, stop — остановить сразу, fade — затухание. */
	now: ScreenMusicNow;
	fade: number;
	/** Что включить: трек, папку, «Атмосферу, если ничего не играет», ничего (''). */
	play: ScreenMusicPlay;
	/** Трек «Папка/Трек» или папка. */
	target: string;
	/** Через сколько секунд от начала затухания вступает новая. */
	after: number;
	/** Нарастание, секунд (0 — сразу на полную). */
	rise: number;
	extra: string[];
}

export const screenMusicDefaults: Omit<ScreenMusic, 'from' | 'to'> = {
	delay: 0,
	now: 'fade',
	fade: 3,
	play: '',
	target: '',
	after: 0,
	rise: 0,
	extra: []
};

/** Строка «Музыка экрана» в тексте (первая команда). */
export function findScreenMusic(text: string): ScreenMusic | undefined {
	const f = find(text, 'sg-screen-music', false)[0];

	if (!f) {
		return undefined;
	}

	const m: ScreenMusic = {...screenMusicDefaults, extra: [], from: f.from, to: f.to};
	const t = f.tokens;

	m.now = '';
	for (let i = 0; i < t.length; i++) {
		const key = t[i];
		const next = t[i + 1];

		if (key === 'delay' || key === 'fade' || key === 'after' || key === 'rise') {
			m[key] = Math.max(0, num(next, 0));
			i++;
		} else if (key === 'now' && (next === 'stop' || next === 'fade')) {
			m.now = next;
			i++;
		} else if (key === 'play' && (next === 'track' || next === 'folder')) {
			m.play = next;
			m.target = unquote(t[i + 2] ?? '');
			i += 2;
		} else if (key === 'play' && next === 'ambient') {
			m.play = 'ambient';
			i++;
		} else {
			m.extra.push(key);
		}
	}
	return m;
}

export function writeScreenMusic(m: Omit<ScreenMusic, 'from' | 'to'>) {
	const w: string[] = [];

	if (m.delay > 0) {
		w.push('delay', String(m.delay));
	}
	if (m.now) {
		w.push('now', m.now);
		if (m.now === 'fade') {
			w.push('fade', String(m.fade));
		}
	}
	if (m.play === 'track' || m.play === 'folder') {
		w.push('play', m.play, arg(m.target));
	} else if (m.play === 'ambient') {
		w.push('play', 'ambient');
	}
	if (m.play) {
		if (m.now === 'fade' && m.after > 0) {
			w.push('after', String(m.after));
		}
		if (m.rise > 0) {
			w.push('rise', String(m.rise));
		}
	}
	return `<<sg-screen-music${w.length ? ' ' + w.join(' ') : ''}${m.extra.length ? ' ' + m.extra.join(' ') : ''}>>`;
}

/** Поставить, заменить или убрать (undefined) «Музыку экрана»: первой строкой. */
export function setScreenMusic(text: string, m: Omit<ScreenMusic, 'from' | 'to'> | undefined) {
	const old = findScreenMusic(text);
	const line = m ? writeScreenMusic(m) : '';

	if (old) {
		let to = old.to;

		if (!m) {
			if (text[to] === '\\') {
				to++;
			}
			if (text[to] === '\n') {
				to++;
			}
		}
		return text.slice(0, old.from) + line + text.slice(to);
	}
	if (!m) {
		return text;
	}
	return text.trim() === '' ? line : `${line}\\\n${text}`;
}
