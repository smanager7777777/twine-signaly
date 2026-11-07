// «Twine СИГНАЛЫ»: развёрнутые копии треков при «Сохранить» в окнах «Музыка» и «Радио»
// (шаг 7.4, ответ 1А). Что и куда — signaly-reverse.ts; чтение и запись файлов — папка игры
// через Electron; разворот — здесь, в Chromium программы.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {TwineElectronWindow} from '../electron/shared';
import {Story} from '../store/stories';
import {useGameFolder} from '../store/use-game-folder';
import {MusicCatalog} from '../util/signaly/signaly-music';
import {RadioView} from '../util/signaly/signaly-radio';
import {encodeWav, needsReverse, reverseChannels, reverseJobs, reverseRate} from '../util/signaly/signaly-reverse';

export interface ReverseResult {
	made: number;
	failed: string[];
}

/** Сделать недостающие и устаревшие копии; onProgress(сделано, всего). */
export async function makeReverseCopies(
	folder: string,
	catalog: MusicCatalog,
	onProgress?: (done: number, total: number) => void
): Promise<ReverseResult> {
	const bridge = (window as TwineElectronWindow).twineElectron;
	const result: ReverseResult = {made: 0, failed: []};

	if (!bridge?.signalyReverseNeeded) {
		return result;
	}

	const todo = await bridge.signalyReverseNeeded(folder, reverseJobs(catalog));
	// OfflineAudioContext приводит звук к своей частоте — копии все 44,1 кГц.
	const context = new OfflineAudioContext(2, 1, reverseRate);

	onProgress?.(0, todo.length);
	for (const [i, job] of todo.entries()) {
		try {
			const bytes = await bridge.signalyReadMedia(folder, job.src);
			const audio = await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
			const channels = Array.from({length: audio.numberOfChannels}, (_, c) => audio.getChannelData(c));

			await bridge.signalyWriteReverse(folder, job.out, encodeWav(reverseChannels(channels), audio.sampleRate));
			result.made++;
		} catch (e) {
			console.warn('СИГНАЛЫ: развёрнутая копия', job.src, e);
			result.failed.push(job.src);
		}
		onProgress?.(i + 1, todo.length);
	}
	return result;
}

/** Состояние копий для строки в шапке окна и запуск после «Сохранить». */
export function useReverseCopies(story: Story) {
	const {t} = useTranslation();
	const {available, gameFolder} = useGameFolder();
	const [status, setStatus] = React.useState('');
	const alive = React.useRef(true);

	React.useEffect(
		() => () => {
			alive.current = false;
		},
		[]
	);

	const show = (text: string) => alive.current && setStatus(text);

	function run(catalog: MusicCatalog, views: RadioView[]) {
		if (!available || !needsReverse(views) || reverseJobs(catalog).length === 0) {
			return;
		}

		const folder = gameFolder(story.id);

		if (!folder) {
			show(t('signaly.reverse.noFolder'));
			return;
		}
		makeReverseCopies(folder, catalog, (done, total) => total > 0 && show(t('signaly.reverse.working', {done, total})))
			.then(r => show(r.failed.length ? t('signaly.reverse.failed', {files: r.failed.join(', ')}) : r.made ? t('signaly.reverse.done', {count: r.made}) : ''))
			.catch(e => show(t('signaly.reverse.failed', {files: String(e)})));
	}

	return {status, run};
}
