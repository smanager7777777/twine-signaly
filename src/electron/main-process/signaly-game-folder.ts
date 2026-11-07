// «Twine СИГНАЛЫ»: папка игры.
//
// Игра для «Играть», «Тест» и «Опубликовать в папку игры» пишется не во
// временную папку Twine (Документы\Twine\Scratch), а в папку игры, которую
// автор выбирает в подробностях истории. Тогда короткие пути вида
// media/img/... работают одинаково и при проверке, и в готовой игре.

import {BrowserWindow, dialog, shell} from 'electron';
import {spawn} from 'child_process';
import {existsSync} from 'fs';
import {mkdirp, readdir, readFile, stat, writeFile} from 'fs-extra';
import {basename, dirname, extname, isAbsolute, join, normalize, sep} from 'path';
import {i18n} from './locales';

/**
 * Показывает окно выбора папки. Возвращает путь или undefined, если автор
 * нажал «Отмена».
 */
export async function chooseGameFolder(
	window: BrowserWindow | null,
	currentPath?: string
): Promise<string | undefined> {
	const options: Electron.OpenDialogOptions = {
		defaultPath: currentPath,
		properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
		title: i18n.t('electron.signaly.chooseGameFolder')
	};
	const result = window
		? await dialog.showOpenDialog(window, options)
		: await dialog.showOpenDialog(options);

	if (result.canceled || result.filePaths.length === 0) {
		return undefined;
	}

	return result.filePaths[0];
}

/**
 * Возможные пути к Chrome в Windows. Игра открывается в Chrome (решение
 * автора 19); если Chrome не найден — в браузере по умолчанию.
 */
function chromePath(): string | undefined {
	if (process.platform !== 'win32') {
		return undefined;
	}

	const roots = [
		process.env['PROGRAMFILES'],
		process.env['PROGRAMFILES(X86)'],
		process.env['LOCALAPPDATA']
	];

	for (const root of roots) {
		if (root) {
			const candidate = join(
				root,
				'Google',
				'Chrome',
				'Application',
				'chrome.exe'
			);

			if (existsSync(candidate)) {
				return candidate;
			}
		}
	}

	return undefined;
}

export function openInChrome(filePath: string) {
	const chrome = chromePath();

	if (chrome) {
		try {
			const child = spawn(chrome, [filePath], {
				detached: true,
				stdio: 'ignore'
			});

			child.on('error', () => shell.openPath(filePath));
			child.unref();
			return;
		} catch (error) {
			console.warn(`Не удалось запустить Chrome: ${error}`);
		}
	}

	shell.openPath(filePath);
}

/**
 * Записывает HTML игры в папку игры и, если нужно, открывает его в Chrome.
 * Разрешены только .html-файлы прямо в папке игры (без подпапок).
 * Возвращает полный путь к записанному файлу.
 */
export async function writeGameFile(
	folder: string,
	filename: string,
	data: string,
	open: boolean
): Promise<string> {
	if (typeof folder !== 'string' || !isAbsolute(folder)) {
		throw new Error(i18n.t('electron.signaly.errors.noFolder'));
	}

	if (basename(filename) !== filename || extname(filename) !== '.html') {
		throw new Error('Only .html files directly inside the game folder.');
	}

	if (typeof data !== 'string' || data.trim() === '') {
		throw new Error('Asked to write empty game HTML');
	}

	await mkdirp(folder);

	if (!(await stat(folder)).isDirectory()) {
		throw new Error(i18n.t('electron.signaly.errors.noFolder'));
	}

	const filePath = join(folder, filename);

	await writeFile(filePath, data, 'utf8');

	if (open) {
		openInChrome(filePath);
	}

	return filePath;
}

export function showGameFolder(folder: string) {
	if (typeof folder === 'string' && isAbsolute(folder)) {
		shell.openPath(folder);
	}
}

const mediaKinds: Record<string, string[]> = {
	audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.weba'],
	fonts: ['.woff2', '.woff', '.ttf', '.otf'],
	img: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
	video: ['.mp4', '.webm', '.ogv', '.ogg', '.mov', '.m4v']
};

/**
 * Список файлов в папке игры media/<kind> (с подпапками), пути вида
 * «media/fonts/DSEG7.woff2». Для окна «Оформление терминала».
 */
export async function listGameMedia(
	folder: string,
	kind: string
): Promise<string[]> {
	const extensions = mediaKinds[kind];

	if (typeof folder !== 'string' || !isAbsolute(folder) || !extensions) {
		return [];
	}

	const result: string[] = [];

	async function walk(relative: string, depth: number) {
		let entries;

		try {
			entries = await readdir(join(folder, relative), {withFileTypes: true});
		} catch {
			return;
		}

		for (const entry of entries) {
			const path = `${relative}/${entry.name}`;

			// Шаг 7.4: развёрнутые копии программы в списках файлов не нужны.
			if (entry.isDirectory() && path === 'media/audio/reverse') {
				continue;
			}
			if (entry.isDirectory() && depth < 4) {
				await walk(path, depth + 1);
			} else if (
				entry.isFile() &&
				extensions.includes(extname(entry.name).toLowerCase())
			) {
				result.push(path);
			}
		}
	}

	await walk(`media/${kind}`, 0);
	return result.sort((a, b) => a.localeCompare(b, 'ru'));
}

/* ----- Шаг 7.4: развёрнутые копии треков (ответ 1А) ----- */

/** Путь файла внутри media/ папки игры; иначе — ошибка (никаких «..» и абсолютных путей). */
function mediaFile(folder: string, relative: string) {
	if (typeof folder !== 'string' || !isAbsolute(folder) || typeof relative !== 'string') {
		throw new Error(i18n.t('electron.signaly.errors.noFolder'));
	}

	const clean = normalize(relative.replace(/^\.\//, '')).split(sep).join('/');

	if (!clean.startsWith('media/') || clean.split('/').includes('..')) {
		throw new Error(`Not a media file: ${relative}`);
	}
	return join(folder, ...clean.split('/'));
}

async function mtime(path: string) {
	try {
		return (await stat(path)).mtimeMs;
	} catch {
		return undefined;
	}
}

/**
 * Какие копии нужно сделать: исходный файл есть, а копии нет или она старше.
 */
export async function reverseNeeded(
	folder: string,
	jobs: Array<{src: string; out: string}>
): Promise<Array<{src: string; out: string}>> {
	const out = [];

	for (const job of Array.isArray(jobs) ? jobs : []) {
		try {
			const from = await mtime(mediaFile(folder, job.src));
			const to = await mtime(mediaFile(folder, job.out));

			if (from !== undefined && (to === undefined || to < from)) {
				out.push(job);
			}
		} catch {
			// путь не в media/ — пропустить
		}
	}
	return out;
}

/** Прочитать файл из media/ папки игры. */
export async function readMediaFile(folder: string, relative: string) {
	return new Uint8Array(await readFile(mediaFile(folder, relative)));
}

/** Записать развёрнутую копию: только .wav в media/audio/reverse/. */
export async function writeReverseFile(
	folder: string,
	relative: string,
	data: Uint8Array
) {
	const path = mediaFile(folder, relative);

	if (!relative.startsWith('media/audio/reverse/') || extname(path).toLowerCase() !== '.wav' || !(data instanceof Uint8Array)) {
		throw new Error(`Only .wav inside media/audio/reverse: ${relative}`);
	}
	await mkdirp(dirname(path));
	await writeFile(path, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
	return path;
}
