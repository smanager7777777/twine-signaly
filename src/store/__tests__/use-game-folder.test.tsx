// «Twine СИГНАЛЫ»: папка игры привязана к IFID истории, а не к id, который
// Twine выдаёт заново при каждом запуске (решение 65).

import * as React from 'react';
import {act, renderHook} from '@testing-library/react-hooks';
import {useGameFolder} from '../use-game-folder';
import {FakeStateProvider, fakeStory} from '../../test-util';
import {usePrefsContext} from '../prefs';

describe('useGameFolder', () => {
	const story = fakeStory();

	function render(gameFolders: Record<string, string>) {
		return renderHook(
			() => ({folder: useGameFolder(), prefs: usePrefsContext().prefs}),
			{
				wrapper: ({children}) => (
					<FakeStateProvider prefs={{gameFolders}} stories={[story]}>
						{children}
					</FakeStateProvider>
				)
			}
		);
	}

	beforeEach(() => {
		(window as any).twineElectron = {
			signalyChooseGameFolder: jest.fn().mockResolvedValue('C:\\Игра')
		};
	});

	afterEach(() => {
		delete (window as any).twineElectron;
	});

	it('находит папку по IFID, даже если id истории другой', () => {
		const {result} = render({[story.ifid]: 'C:\\СИГНАЛЫ'});

		expect(result.current.folder.gameFolder(story.id)).toBe('C:\\СИГНАЛЫ');
	});

	it('запоминает выбранную папку по IFID', async () => {
		const {result} = render({});

		await act(async () => {
			await result.current.folder.chooseGameFolder(story.id);
		});
		expect(result.current.prefs.gameFolders).toEqual({
			[story.ifid]: 'C:\\Игра'
		});
		expect(result.current.folder.gameFolder(story.id)).toBe('C:\\Игра');
	});

	it('понимает и старую запись по id', () => {
		const {result} = render({[story.id]: 'C:\\Старое'});

		expect(result.current.folder.gameFolder(story.id)).toBe('C:\\Старое');
	});
});
