// Exposes a limited set of Electron modules to a renderer process. Because the
// renderer processes load remote content (e.g. story formats), they must be
// isolated.
//
// For now, we cannot use context isolation here because of jsonp. For jsonp
// loading to work, it expects a global property to be set--but because it
// crosses a context boundary, that global is in the wrong place. For now, we
// place a privileged jsonp function into renderer context.

import {contextBridge, ipcRenderer} from 'electron';
import {Story} from '../../store/stories/stories.types';

contextBridge.exposeInMainWorld('twineElectron', {
	deleteStory(story: Story) {
		ipcRenderer.send('delete-story', story);
	},
	loadPrefs() {
		return ipcRenderer.invoke('load-prefs');
	},
	loadStories() {
		return ipcRenderer.invoke('load-stories');
	},
	loadStoryFormats() {
		return ipcRenderer.invoke('load-story-formats');
	},
	onceStoryRenamed(callback: () => void): void {
		ipcRenderer.once('story-renamed', callback);
	},
	openHtmlWithScratchFile(data: string, filename: string) {
		ipcRenderer.send('open-html-with-scratch-file', data, filename);
	},
	signalyChooseGameFolder(currentPath?: string) {
		return ipcRenderer.invoke('signaly-choose-game-folder', currentPath);
	},
	signalyListMedia(folder: string, kind: string) {
		return ipcRenderer.invoke('signaly-list-media', folder, kind);
	},
	signalyShowGameFolder(folder: string) {
		ipcRenderer.send('signaly-show-game-folder', folder);
	},
	signalyWriteGameFile(
		folder: string,
		filename: string,
		data: string,
		open: boolean
	) {
		return ipcRenderer.invoke(
			'signaly-write-game-file',
			folder,
			filename,
			data,
			open
		);
	},
	renameStory(oldStory: Story, newStory: Story) {
		ipcRenderer.send('rename-story', oldStory, newStory);
	},
	saveJson(filename: string, data: any) {
		ipcRenderer.send('save-json', filename, data);
	},
	saveStoryHtml(story: Story, data: string) {
		ipcRenderer.send('save-story-html', story, data);
	}
});
