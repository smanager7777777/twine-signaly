// «Twine СИГНАЛЫ»: картинки SSTV при «Сохранить» в окне «Музыка» (сессия 30, радио с декодером).
// Что и куда — signaly-sstv-store.ts; разбор звука — signaly-sstv.ts; звук раскладывает на отсчёты
// Chromium программы (как для реверса), картинку в PNG — canvas.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {TwineElectronWindow} from '../electron/shared';
import {Story, updatePassage, useStoriesContext} from '../store/stories';
import {useGameFolder} from '../store/use-game-folder';
import {freeSpot} from '../util/signaly/signaly-keys';
import {MusicCatalog} from '../util/signaly/signaly-music';
import {decodeSstv, SstvImage} from '../util/signaly/signaly-sstv';
import {
	needsSstv,
	readSstv,
	SstvFile,
	sstvImagePath,
	sstvPassageName,
	sstvSources,
	sstvTag,
	writeSstv
} from '../util/signaly/signaly-sstv-store';

/** Частота разбора: SSTV — до 2300 Гц, 22 050 Гц хватает с запасом. */
export const sstvRate = 22050;

async function png(image: SstvImage): Promise<Uint8Array> {
	const canvas = document.createElement('canvas');

	canvas.width = image.width;
	canvas.height = image.height;
	canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height), 0, 0);

	const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

	if (!blob) {
		throw new Error('PNG');
	}
	return new Uint8Array(await blob.arrayBuffer());
}

export interface SstvResult {
	/** Новый текст пассажа «SSTV» (undefined — менять нечего). */
	text?: string;
	files: number;
	images: number;
	failed: string[];
}

/** Разобрать изменившиеся помехи и передачи; onProgress(сделано, всего). */
export async function makeSstvImages(
	folder: string,
	catalog: MusicCatalog,
	oldText: string,
	onProgress?: (done: number, total: number) => void
): Promise<SstvResult> {
	const bridge = (window as TwineElectronWindow).twineElectron;
	const result: SstvResult = {files: 0, images: 0, failed: []};

	if (!bridge?.signalyMediaStamps) {
		return result;
	}

	const sources = sstvSources(catalog);
	const stamps = await bridge.signalyMediaStamps(folder, sources);
	const old = readSstv(oldText);
	const next = new Map<string, SstvFile>();
	const todo = sources.filter(src => stamps[src] && old.get(src)?.stamp !== stamps[src]);

	for (const src of sources) {
		const was = old.get(src);

		if (was && stamps[src] && was.stamp === stamps[src]) {
			next.set(src, was);
		}
	}
	onProgress?.(0, todo.length);

	const context = new OfflineAudioContext(1, 1, sstvRate);

	for (const [i, src] of todo.entries()) {
		try {
			const bytes = await bridge.signalyReadMedia(folder, src);
			const audio = await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
			const mono = new Float32Array(audio.length);

			for (let c = 0; c < audio.numberOfChannels; c++) {
				const ch = audio.getChannelData(c);

				for (let k = 0; k < mono.length; k++) {
					mono[k] += ch[k] / audio.numberOfChannels;
				}
			}
			// Дать окну перерисоваться между файлами: разбор длинного звука занимает секунды.
			await new Promise(resolve => setTimeout(resolve, 0));

			const images = decodeSstv(mono, audio.sampleRate);
			const file: SstvFile = {src, stamp: stamps[src], images: []};

			for (const [n, image] of images.entries()) {
				const path = sstvImagePath(src, n + 1);

				await bridge.signalyWriteSstv(folder, path, await png(image));
				file.images.push({
					img: path,
					mode: image.mode,
					at: image.at,
					line: image.line,
					rows: image.rows,
					per: image.per,
					width: image.width,
					height: image.height
				});
			}
			next.set(src, file);
			result.files++;
			result.images += images.length;
		} catch (e) {
			console.warn('СИГНАЛЫ: SSTV', src, e);
			result.failed.push(src);
		}
		onProgress?.(i + 1, todo.length);
	}

	const text = writeSstv(oldText, next);

	result.text = text !== oldText ? text : undefined;
	return result;
}

/** Строка в шапке окна и запуск после «Сохранить». */
export function useSstvImages(story: Story) {
	const {t} = useTranslation();
	const {dispatch} = useStoriesContext();
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

	function run(catalog: MusicCatalog, views: Array<{type: string}>) {
		if (!available || !needsSstv(views) || sstvSources(catalog).length === 0) {
			return;
		}

		const folder = gameFolder(story.id);

		if (!folder) {
			show(t('signaly.sstv.noFolder'));
			return;
		}

		const passage = story.passages.find(p => p.tags.includes(sstvTag)) ?? story.passages.find(p => p.name === sstvPassageName);

		makeSstvImages(folder, catalog, passage?.text ?? '', (done, total) => total > 0 && show(t('signaly.sstv.working', {done, total})))
			.then(r => {
				if (r.text !== undefined) {
					if (passage) {
						const tags = passage.tags.includes(sstvTag) ? passage.tags : [...passage.tags, sstvTag];

						dispatch(updatePassage(story, passage, {text: r.text, tags}));
					} else {
						dispatch({
							type: 'createPassage',
							storyId: story.id,
							props: {name: sstvPassageName, story: story.id, tags: [sstvTag], text: r.text, ...freeSpot(story.passages)}
						});
					}
				}
				show(
					r.failed.length
						? t('signaly.sstv.failed', {files: r.failed.join(', ')})
						: r.files
						? t('signaly.sstv.done', {count: r.images, files: r.files})
						: ''
				);
			})
			.catch(e => show(t('signaly.sstv.failed', {files: String(e)})));
	}

	return {status, run};
}
