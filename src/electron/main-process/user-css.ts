import {app} from 'electron';
import {readFile} from 'fs-extra';
import {join} from 'path';
import {i18n} from './locales';
import {signalyAppFolderName} from './signaly-app-folder';

export async function getUserCss(): Promise<string | undefined> {
	try {
		return await readFile(
			join(
				app.getPath('documents'),
				signalyAppFolderName,
				i18n.t('electron.userCss.filename')
			),
			'utf8'
		);
	} catch (error) {
		console.warn(
			`Error while loading user CSS, skipping: ${(error as Error).message}`
		);
	}
}
