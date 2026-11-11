// «Twine СИГНАЛЫ»: картинки SSTV для радио с декодером (сессия 30) — где лежат и как записаны.
//
// Игра, открытая из папки, звук своих файлов прочитать не может, поэтому при «Сохранить» в окне
// «Музыка» программа разбирает помехи и передачи (signaly-sstv.ts) и кладёт картинки в папку игры:
//   media/audio/air/sos.mp3 → media/img/sstv/air/sos-1.png, -2.png …
// а в пассаж «SSTV» (тег sg-sstv; обычный текст, работает в обычном Twine) — где картинка в звуке:
//   <<sg-sstv "media/audio/air/sos.mp3" stamp "1731300000000-48213" img "media/img/sstv/air/sos-1.png"
//     mode "Robot 36" at 4.911 line 0.15 rows 240 per 1 width 320 height 240>>
//   <<sg-sstv "media/audio/jam/a.wav" stamp "…" none>>       — картинок нет
// stamp — «время изменения-размер» файла: изменился файл — программа разбирает его заново.
// Движок набирает картинку в такт звуку: строка r видна с at + (⌊r / per⌋ + 1) · line секунд.

import {arg} from './signaly-link-form';
import {commentRanges, MusicCatalog} from './signaly-music';
import {scanArgs} from './signaly-screen-blocks';

export const sstvTag = 'sg-sstv';
export const sstvPassageName = 'SSTV';
export const sstvFolder = 'media/img/sstv/';

export const sstvHeader =
	'/* СИГНАЛЫ: картинки SSTV для радио с декодером — пишет программа при «Сохранить» в окне\n' +
	'   «Музыка» (из помех и передач). Править руками не нужно. */\n';

export interface SstvRecord {
	img: string;
	mode: string;
	at: number;
	line: number;
	rows: number;
	per: number;
	width: number;
	height: number;
}

export interface SstvFile {
	src: string;
	stamp: string;
	images: SstvRecord[];
}

/** Куда программа кладёт n-ю (с 1) картинку из звука. */
export function sstvImagePath(src: string, n: number) {
	const clean = src.replace(/^\.\//, '');
	const rel = clean.startsWith('media/audio/') ? clean.slice(12) : clean.startsWith('media/') ? clean.slice(6) : clean;

	return `${sstvFolder}${rel.replace(/\.[^./]*$/, '')}-${n}.png`;
}

/** Звуки, в которых могут быть картинки: помехи (раздел «Помехи») и передачи эфира. */
export function sstvSources(catalog: MusicCatalog): string[] {
	const out = new Set<string>();

	for (const f of catalog.folders) {
		if (f.section === 'jam' || f.section === 'air') {
			for (const t of f.tracks) {
				if (t.src) {
					out.add(t.src);
				}
			}
		}
	}
	return [...out];
}

/** Нужны ли картинки: в истории есть радио с декодером. */
export const needsSstv = (views: Array<{type: string}>) => views.some(v => v.type === 'decoder');

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

const num = (value: string | undefined) => {
	const n = Number(String(value ?? '').replace(',', '.'));

	return isFinite(n) ? n : 0;
};

function find(text: string) {
	const re = /<<sg-sstv(?=[\s>])/g;
	const comments = commentRanges(text);
	const out: Array<{from: number; to: number; tokens: string[]}> = [];
	let m: RegExpExecArray | null;

	while ((m = re.exec(text))) {
		const at = m.index;

		if (comments.some(c => at >= c.from && at < c.to)) {
			continue;
		}

		const scan = scanArgs(text, at + '<<sg-sstv'.length);

		if (scan) {
			out.push({from: at, to: scan.end, tokens: scan.tokens});
			re.lastIndex = scan.end;
		}
	}
	return out;
}

/** Записи пассажа «SSTV»: по файлу — отметка и картинки. */
export function readSstv(text: string): Map<string, SstvFile> {
	const out = new Map<string, SstvFile>();

	for (const f of find(text)) {
		const src = unquote(f.tokens[0] ?? '');
		const values: Record<string, string> = {};

		for (let i = 1; i < f.tokens.length; i++) {
			if (f.tokens[i] === 'none') {
				continue;
			}
			values[f.tokens[i]] = unquote(f.tokens[i + 1] ?? '');
			i++;
		}

		const file: SstvFile = out.get(src) ?? {src, stamp: values.stamp ?? '', images: []};

		if (values.img) {
			file.images.push({
				img: values.img,
				mode: values.mode ?? '',
				at: num(values.at),
				line: num(values.line),
				rows: Math.round(num(values.rows)),
				per: Math.max(1, Math.round(num(values.per))),
				width: Math.round(num(values.width)),
				height: Math.round(num(values.height))
			});
		}
		out.set(src, file);
	}
	return out;
}

const fixed = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** Строки одного файла. */
export function writeSstvFile(file: SstvFile) {
	if (!file.images.length) {
		return [`<<sg-sstv ${arg(file.src)} stamp ${arg(file.stamp)} none>>`];
	}
	return file.images.map(
		r =>
			`<<sg-sstv ${arg(file.src)} stamp ${arg(file.stamp)} img ${arg(r.img)} mode ${arg(r.mode)} at ${fixed(r.at, 4)} line ${fixed(r.line, 6)} ` +
			`rows ${r.rows} per ${r.per} width ${r.width} height ${r.height}>>`
	);
}

/** Записать пассаж: всё, кроме строк <<sg-sstv>>, остаётся; файлы — по алфавиту. */
export function writeSstv(text: string, files: Map<string, SstvFile>) {
	let rest = text;

	for (const f of find(text).reverse()) {
		let to = f.to;

		while (rest[to] === '\n') {
			to++;
		}
		rest = rest.slice(0, f.from) + rest.slice(to);
	}
	if (rest.trim() === '') {
		rest = sstvHeader;
	}

	const lines = [...files.values()].sort((a, b) => a.src.localeCompare(b.src)).flatMap(writeSstvFile);

	return rest.replace(/\s*$/, '\n') + lines.join('\n') + (lines.length ? '\n' : '');
}
