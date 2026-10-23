import {PrefsState} from './prefs.types';

export const defaults = (): PrefsState => ({
	appTheme: 'system',
	codeEditorFontFamily: 'var(--font-monospaced)',
	codeEditorFontScale: 1,
	dialogWidth: 600,
	disabledStoryFormatEditorExtensions: [],
	donateShown: false,
	editorCursorBlinks: true,
	gameFolders: {},
	signalyDragLock: false,
	signalyPreviewMute: false,
	firstRunTime: new Date().getTime(),
	lastUpdateSeen: '',
	lastUpdateCheckTime: new Date().getTime(),
	// «Twine СИГНАЛЫ»: интерфейс по-русски по умолчанию.
	locale: 'ru',
	passageEditorFontFamily: 'var(--font-system)',
	passageEditorFontScale: 1,
	passageTagDisplay: 'color',
	proofingFormat: {
		name: 'Paperthin',
		version: '1.0.0'
	},
	// «Twine СИГНАЛЫ»: терминал игры сделан на SugarCube.
	storyFormat: {
		name: 'SugarCube',
		version: '2.37.3'
	},
	storyFormatListFilter: 'current',
	storyListSort: 'name',
	storyListTagFilter: [],
	storyTagColors: {},
	useCodeMirror: true,
	welcomeSeen: false
});
