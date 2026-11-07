// «Twine СИГНАЛЫ»: развёрнутые копии треков для радио с реверсом (этап 7, шаг 7.4).
//
// Игра открывается в Chrome как файл, и браузер не даёт ей развернуть звук на лету,
// поэтому программа делает копию заранее (ответ 1А): при «Сохранить» в окнах «Музыка»
// и «Радио», если в истории есть вид радио с реверсом. Копия — WAV в папке игры:
//   media/audio/radio/x.mp3 → media/audio/reverse/radio/x.wav
// Свой файл «что слышно задом наперёд» (ответ 2А) — слово reverse у <<sg-track>>: тогда
// копию программа не делает. Разворот: Chromium программы раскладывает файл на отсчёты
// (AudioContext.decodeAudioData), отсчёты переставляются в обратном порядке и пишутся
// в WAV (16 бит). Тот же путь считает движок (musRevSrc в signaly-engine.ts).

import {MusicCatalog} from './signaly-music';
import {RadioView} from './signaly-radio';

export const reverseFolder = 'media/audio/reverse/';

/** Куда программа кладёт развёрнутую копию трека. */
export function reversePath(src: string) {
	const clean = src.replace(/^\.\//, '');
	const rel = clean.startsWith('media/audio/') ? clean.slice(12) : clean.startsWith('media/') ? clean.slice(6) : clean;

	return reverseFolder + rel.replace(/\.[^./]*$/, '') + '.wav';
}

export interface ReverseJob {
	/** Исходный файл трека. */
	src: string;
	/** Куда записать копию. */
	out: string;
}

/** Нужны ли копии: в истории есть вид радио с реверсом. */
export const needsReverse = (views: RadioView[]) => views.some(v => v.type === 'reverse');

/**
 * Треки, которым нужна копия: разделы «Радио» и «Эфир» (пойманная передача становится
 * треком радио), без своего файла задом наперёд. Повторы файлов — один раз.
 */
export function reverseJobs(catalog: MusicCatalog): ReverseJob[] {
	const seen = new Set<string>();
	const out: ReverseJob[] = [];

	for (const folder of catalog.folders) {
		if (folder.section === 'ambient') {
			continue;
		}
		for (const track of folder.tracks) {
			// Помеха (передача без папки радио) в каталог не попадает — разворачивать нечего.
			if (!track.src || track.reverse || (folder.section === 'air' && !track.to) || seen.has(track.src)) {
				continue;
			}
			seen.add(track.src);
			out.push({src: track.src, out: reversePath(track.src)});
		}
	}
	return out;
}

/** Отсчёты каждого канала — в обратном порядке (новые массивы). */
export function reverseChannels(channels: Float32Array[]): Float32Array[] {
	return channels.map(ch => {
		const out = new Float32Array(ch.length);

		for (let i = 0, n = ch.length; i < n; i++) {
			out[i] = ch[n - 1 - i];
		}
		return out;
	});
}

/** WAV, 16 бит: каналы чередуются. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
	const count = channels.length;
	const frames = count ? channels[0].length : 0;
	const dataSize = frames * count * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);
	const text = (at: number, s: string) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(at + i, s.charCodeAt(i));
		}
	};

	text(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, count, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * count * 2, true);
	view.setUint16(32, count * 2, true);
	view.setUint16(34, 16, true);
	text(36, 'data');
	view.setUint32(40, dataSize, true);

	let at = 44;

	for (let i = 0; i < frames; i++) {
		for (let c = 0; c < count; c++) {
			const v = Math.max(-1, Math.min(1, channels[c][i]));

			view.setInt16(at, v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff), true);
			at += 2;
		}
	}
	return new Uint8Array(buffer);
}

/** Частота копий: decodeAudioData приводит звук к частоте контекста. */
export const reverseRate = 44100;
