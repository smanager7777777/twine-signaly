// «Twine СИГНАЛЫ»: папка игры для истории.
//
// Путь хранится в настройках программы (prefs.gameFolders), а не в самой
// истории: это место на конкретном компьютере, и обычному Twine оно не нужно.
// Ключ — IFID истории: внутренний id Twine выдаёт заново при каждом запуске
// программы (src/util/import.ts), поэтому папка, записанная по id, терялась
// после перезапуска (замечание автора к build-10, решение 65).

import {setPref, usePrefsContext} from './prefs';
import {useStoriesContext} from './stories';
import {isElectronRenderer} from '../util/is-electron';
import {MediaKind, TwineElectronWindow} from '../electron/shared';

/** Служебный файл для «Играть». */
export const playFileName = '_играть.html';

/** Служебный файл для «Тест». */
export const testFileName = '_тест.html';

function bridge() {
	const {twineElectron} = window as TwineElectronWindow;

	if (!twineElectron) {
		throw new Error('Electron bridge is not present on window.');
	}

	return twineElectron;
}

export interface UseGameFolderProps {
	/** Доступна ли папка игры (только в программе, не в веб-версии). */
	available: boolean;
	/**
	 * Показывает выбор папки и запоминает её для истории. Возвращает путь или
	 * undefined, если выбор отменён.
	 */
	chooseGameFolder: (storyId: string) => Promise<string | undefined>;
	/** Папка игры истории или undefined, если не выбрана. */
	gameFolder: (storyId: string) => string | undefined;
	/** Файлы из media/<kind> папки игры: «media/audio/старт.wav» и т. п. */
	listMedia: (
		storyId: string,
		kind: MediaKind
	) => Promise<string[]>;
	/** Открыть папку игры в проводнике. */
	showGameFolder: (storyId: string) => void;
	/** Записать HTML в папку игры; при open — открыть в Chrome. */
	writeGameFile: (
		folder: string,
		filename: string,
		data: string,
		open: boolean
	) => Promise<string>;
}

export function useGameFolder(): UseGameFolderProps {
	const {dispatch, prefs} = usePrefsContext();
	const available = isElectronRenderer();
	const {stories} = useStoriesContext();
	const folders = prefs.gameFolders ?? {};

	/** Постоянный ключ истории — IFID (id меняется при каждом запуске). */
	function folderKey(storyId: string) {
		return stories.find(story => story.id === storyId)?.ifid ?? storyId;
	}

	function gameFolder(storyId: string) {
		const result = folders[folderKey(storyId)] ?? folders[storyId];

		return typeof result === 'string' && result !== '' ? result : undefined;
	}

	return {
		available,
		gameFolder,
		async chooseGameFolder(storyId) {
			const folder = await bridge().signalyChooseGameFolder(
				gameFolder(storyId)
			);

			if (folder) {
				dispatch(
					setPref('gameFolders', {...folders, [folderKey(storyId)]: folder})
				);
			}

			return folder;
		},
		async listMedia(storyId, kind) {
			const folder = gameFolder(storyId);

			return available && folder ? bridge().signalyListMedia(folder, kind) : [];
		},
		showGameFolder(storyId) {
			const folder = gameFolder(storyId);

			if (folder) {
				bridge().signalyShowGameFolder(folder);
			}
		},
		writeGameFile(folder, filename, data, open) {
			return bridge().signalyWriteGameFile(folder, filename, data, open);
		}
	};
}
