import {Story} from '../../store/stories/stories.types';

/** «Twine СИГНАЛЫ»: подпапки media/ папки игры. */
export type MediaKind = 'audio' | 'fonts' | 'img' | 'video';

export interface TwineElectronWindow extends Window {
	twineElectron?: {
		deleteStory(story: Story): void;
		loadPrefs(): Promise<any>;
		loadStories(): Promise<any>;
		loadStoryFormats(): Promise<any>;
		onceStoryRenamed(callback: () => void): void;
		openHtmlWithScratchFile(data: string, filename: string): void;
		signalyChooseGameFolder(currentPath?: string): Promise<string | undefined>;
		signalyListMedia(
			folder: string,
			kind: MediaKind
		): Promise<string[]>;
		signalyShowGameFolder(folder: string): void;
		/** Шаг 7.4: какие развёрнутые копии нужно сделать (копии нет или она старше трека). */
		signalyReverseNeeded(
			folder: string,
			jobs: Array<{src: string; out: string}>
		): Promise<Array<{src: string; out: string}>>;
		signalyReadMedia(folder: string, path: string): Promise<Uint8Array>;
		/** Сессия 30: отметки файлов «время-размер» ('' — файла нет). */
		signalyMediaStamps(folder: string, paths: string[]): Promise<Record<string, string>>;
		/** Сессия 30: записать картинку SSTV (только .png в media/img/sstv/). */
		signalyWriteSstv(folder: string, path: string, data: Uint8Array): Promise<string>;
		signalyWriteReverse(
			folder: string,
			path: string,
			data: Uint8Array
		): Promise<string>;
		signalyWriteGameFile(
			folder: string,
			filename: string,
			data: string,
			open: boolean
		): Promise<string>;
		renameStory(oldStory: Story, newStory: Story): void;
		saveStoryHtml(story: Story, data: string): void;
		saveJson(filename: string, data: any): void;
	};
}
