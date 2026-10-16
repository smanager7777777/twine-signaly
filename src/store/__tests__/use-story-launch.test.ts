import {renderHook} from '@testing-library/react-hooks';
import {useStoryLaunch} from '../use-story-launch';
import {isElectronRenderer} from '../../util/is-electron';
import {usePublishing} from '../use-publishing';
import {useGameFolder} from '../use-game-folder';

jest.mock('../use-publishing');
jest.mock('../use-game-folder', () => ({
	...jest.requireActual('../use-game-folder'),
	useGameFolder: jest.fn()
}));
jest.mock('../../util/is-electron');

describe('useStoryLaunch', () => {
	const isElectronRendererMock = isElectronRenderer as jest.Mock;
	const usePublishingMock = usePublishing as jest.Mock;
	const useGameFolderMock = useGameFolder as jest.Mock;
	let chooseGameFolder: jest.Mock;
	let gameFolder: jest.Mock;
	let writeGameFile: jest.Mock;
	let openSpy: jest.SpyInstance;

	beforeEach(() => {
		chooseGameFolder = jest.fn().mockResolvedValue(undefined);
		gameFolder = jest.fn().mockReturnValue(undefined);
		writeGameFile = jest.fn().mockResolvedValue('mock-path');
		useGameFolderMock.mockReturnValue({
			available: true,
			chooseGameFolder,
			gameFolder,
			showGameFolder: jest.fn(),
			writeGameFile
		});
		usePublishingMock.mockReturnValue({
			proofStory: (storyId: string) =>
				Promise.resolve(`mock-proofed-story-${storyId}`),
			publishStory: (storyId: string, options: any) =>
				Promise.resolve(
					`mock-published-story-${storyId}-${JSON.stringify(options)}`
				)
		});
	});

	describe('in a browser context', () => {
		beforeEach(() => {
			openSpy = jest.fn();
			isElectronRendererMock.mockReturnValue(false);
			(window as any).open = openSpy;
		});

		it('opens a new browser window when playing a story', () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openSpy).not.toHaveBeenCalled();
			result.current.playStory('mock-story-id');
			expect(openSpy.mock.calls).toEqual([
				['#/stories/mock-story-id/play', '_blank']
			]);
		});

		it('opens a new browser window when proofing a story', () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openSpy).not.toHaveBeenCalled();
			result.current.proofStory('mock-story-id');
			expect(openSpy.mock.calls).toEqual([
				['#/stories/mock-story-id/proof', '_blank']
			]);
		});

		it('opens a new browser window when testing a story', () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openSpy).not.toHaveBeenCalled();
			result.current.testStory('mock-story-id');
			expect(openSpy.mock.calls).toEqual([
				['#/stories/mock-story-id/test', '_blank']
			]);
		});
	});

	describe('in an Electron context', () => {
		let openHtmlWithScratchFile: jest.SpyInstance;

		beforeEach(() => {
			openHtmlWithScratchFile = jest.fn();
			isElectronRendererMock.mockReturnValue(true);
			(window as any).twineElectron = {openHtmlWithScratchFile};
		});

		it('calls openHtmlWithScratchFile() on the twineElectron global when playing a story', async () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openHtmlWithScratchFile).not.toHaveBeenCalled();
			await result.current.playStory('mock-story-id');
			expect(openHtmlWithScratchFile.mock.calls).toEqual([
				[
					'mock-published-story-mock-story-id-undefined',
					'play-mock-story-id.html'
				]
			]);
		});

		it('asks for a game folder and falls back to scratch if none is chosen', async () => {
			const {result} = renderHook(() => useStoryLaunch());

			await result.current.playStory('mock-story-id');
			expect(chooseGameFolder.mock.calls).toEqual([['mock-story-id']]);
			expect(writeGameFile).not.toHaveBeenCalled();
		});

		it('writes the story to the game folder when playing, if one is set', async () => {
			gameFolder.mockReturnValue('/mock/game');

			const {result} = renderHook(() => useStoryLaunch());

			await result.current.playStory('mock-story-id');
			expect(chooseGameFolder).not.toHaveBeenCalled();
			expect(openHtmlWithScratchFile).not.toHaveBeenCalled();
			expect(writeGameFile.mock.calls).toEqual([
				[
					'/mock/game',
					'_играть.html',
					'mock-published-story-mock-story-id-undefined',
					true
				]
			]);
		});

		it('writes the story to the game folder when testing, if one is set', async () => {
			gameFolder.mockReturnValue('/mock/game');

			const {result} = renderHook(() => useStoryLaunch());

			await result.current.testStory('mock-story-id');
			expect(openHtmlWithScratchFile).not.toHaveBeenCalled();
			expect(writeGameFile.mock.calls).toEqual([
				[
					'/mock/game',
					'_тест.html',
					'mock-published-story-mock-story-id-{"formatOptions":"debug"}',
					true
				]
			]);
		});

		it('throws an error when playing a story if the twineElectron global is not present', () => {
			delete (window as any).twineElectron;

			const {result} = renderHook(() => useStoryLaunch());

			expect(() => result.current.playStory('mock-story-id')).toThrow();
		});

		it('calls openHtmlWithScratchFile() on the twineElectron global when proofing a story', async () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openHtmlWithScratchFile).not.toHaveBeenCalled();
			await result.current.proofStory('mock-story-id');
			expect(openHtmlWithScratchFile.mock.calls).toEqual([
				['mock-proofed-story-mock-story-id', 'proof-mock-story-id.html']
			]);
		});

		it('throws an error when proofing a story if the twineElectron global is not present', () => {
			delete (window as any).twineElectron;

			const {result} = renderHook(() => useStoryLaunch());

			expect(() => result.current.proofStory('mock-story-id')).toThrow();
		});

		it('calls openHtmlWithScratchFile() on the twineElectron global when testing a story', async () => {
			const {result} = renderHook(() => useStoryLaunch());

			expect(openHtmlWithScratchFile).not.toHaveBeenCalled();
			await result.current.testStory('mock-story-id');
			expect(openHtmlWithScratchFile.mock.calls).toEqual([
				[
					'mock-published-story-mock-story-id-{"formatOptions":"debug"}',
					'test-mock-story-id.html'
				]
			]);
		});

		it('throws an error when testing a story if the twineElectron global is not present', () => {
			delete (window as any).twineElectron;

			const {result} = renderHook(() => useStoryLaunch());

			expect(() => result.current.testStory('mock-story-id')).toThrow();
		});
	});
});
