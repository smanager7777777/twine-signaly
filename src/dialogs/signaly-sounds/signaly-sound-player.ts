// «Twine СИГНАЛЫ»: «прослушать» в окнах программы (шаг 2.2). Файл берётся из
// папки игры; одновременно звучит один файл.

import {SoundSet} from '../../util/signaly/signaly-sounds';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';

let current: HTMLAudioElement | undefined;
let timer: number | undefined;

export function stopSound() {
	window.clearTimeout(timer);
	current?.pause();
	current = undefined;
}

/** Адрес файла папки игры. */
export function soundUrl(folder: string, path: string) {
	return folderToFileUrl(folder) + path.split('/').map(encodeURIComponent).join('/');
}

/** Прослушать файл; volume — 0–1. */
export function playSound(folder: string | undefined, path: string, volume = 1) {
	stopSound();
	if (!folder || !path) {
		return;
	}
	current = new Audio(soundUrl(folder, path));
	current.volume = Math.max(0, Math.min(1, volume));
	current.play().catch(() => undefined);
}

/** Прослушать набор: случайный файл, громкость и задержка набора. */
export function playSet(folder: string | undefined, set: SoundSet | undefined) {
	stopSound();
	if (!set || set.files.length === 0) {
		return;
	}

	const file = set.files[Math.floor(Math.random() * set.files.length)];

	timer = window.setTimeout(() => playSound(folder, file, set.volume / 100), set.delay);
}
