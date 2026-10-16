import {usePublishing} from './use-publishing';
import {playFileName, testFileName, useGameFolder} from './use-game-folder';
import {isElectronRenderer} from '../util/is-electron';
import {TwineElectronWindow} from '../electron/shared';

export interface UseStoryLaunchProps {
	playStory: (storyId: string) => Promise<void>;
	proofStory: (storyId: string) => Promise<void>;
	testStory: (storyId: string, startPassageId?: string) => Promise<void>;
}

/**
 * Provides functions to launch a story that include the correct handling for
 * both web and Electron contexts.
 */
export function useStoryLaunch(): UseStoryLaunchProps {
	const {proofStory, publishStory} = usePublishing();
	const {chooseGameFolder, gameFolder, writeGameFile} = useGameFolder();

	if (isElectronRenderer()) {
		const {twineElectron} = window as TwineElectronWindow;

		if (!twineElectron) {
			throw new Error('Electron bridge is not present on window.');
		}

		// These are async to match the type in the browser context.

		return {
			// «Twine СИГНАЛЫ»: «Играть» и «Тест» пишут игру в папку игры, чтобы
			// пути media/... работали. Если папка не выбрана, программа
			// предлагает её выбрать; при отмене — старое поведение Twine.

			playStory: async storyId => {
				const html = await publishStory(storyId);
				const folder = gameFolder(storyId) ?? (await chooseGameFolder(storyId));

				if (folder) {
					await writeGameFile(folder, playFileName, html, true);
				} else {
					twineElectron.openHtmlWithScratchFile(html, `play-${storyId}.html`);
				}
			},
			proofStory: async storyId => {
				twineElectron.openHtmlWithScratchFile(
					await proofStory(storyId),
					`proof-${storyId}.html`
				);
			},
			testStory: async (storyId, startPassageId) => {
				const html = await publishStory(storyId, {
					formatOptions: 'debug',
					startId: startPassageId
				});
				const folder = gameFolder(storyId) ?? (await chooseGameFolder(storyId));

				if (folder) {
					await writeGameFile(folder, testFileName, html, true);
				} else {
					twineElectron.openHtmlWithScratchFile(html, `test-${storyId}.html`);
				}
			}
		};
	}

	return {
		playStory: async storyId => {
			window.open(`#/stories/${storyId}/play`, '_blank');
		},
		proofStory: async storyId => {
			window.open(`#/stories/${storyId}/proof`, '_blank');
		},
		testStory: async (storyId, startPassageId) => {
			window.open(
				startPassageId
					? `#/stories/${storyId}/test/${startPassageId}`
					: `#/stories/${storyId}/test`,
				'_blank'
			);
		}
	};
}
