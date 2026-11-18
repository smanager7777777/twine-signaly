// «Twine СИГНАЛЫ»: проверка истории перед игрой (сессия 25, ответ 2А). Ищет то,
// что в живой игре всплывёт ошибкой: переходы на несуществующие экраны, файлы
// media/…, которых нет в папке игры, переменные без начального значения и коды
// таблицы, которые ничего не делают.

import {parseLinks} from '../parse-links';
import {codesTag, readCodes} from './signaly-codes';
import {hasAppData, storyToGame} from './signaly-app';
import {screenMentions} from './signaly-rename';
import {readVariables, variablesInTexts} from './signaly-variables';

export type CheckKind = 'screen' | 'media' | 'variable' | 'code' | 'phone';

export interface CheckProblem {
	kind: CheckKind;
	/** Экран, где найдено (для «Код» — пассаж таблицы кодов). */
	passage: string;
	/** Что именно: имя экрана, путь к файлу, имя переменной, код. */
	detail: string;
}

export interface CheckPassage {
	name: string;
	tags: string[];
	text: string;
}

export interface CheckInput {
	passages: CheckPassage[];
	script: string;
	stylesheet: string;
	/**
	 * Файлы папки игры («media/img/x.jpg»). undefined — папка не выбрана, файлы
	 * не проверяются.
	 */
	media?: string[];
}

/** Папки media/, которые программа видит в папке игры. */
export const checkedMediaFolders = ['img', 'audio', 'video', 'fonts'];

/** Пути media/… в тексте: в кавычках, в url(…), в [img[…]]. С переменной — пропуск. */
export function mediaPaths(text: string) {
	const found: string[] = [];
	const patterns = [
		/["'](media\/[^"'\n]+?)["']/g,
		/url\(\s*(media\/[^)"'\n]+?)\s*\)/g,
		/\[img\[(?:[^\]|]*\|)?(media\/[^\]\n]+)\]/g
	];

	patterns.forEach(re => {
		let match: RegExpExecArray | null;

		while ((match = re.exec(text))) {
			const path = match[1].trim();

			if (!/[$+`{}]/.test(path) && !found.includes(path)) {
				found.push(path);
			}
		}
	});
	return found;
}

/** Текст без комментариев: в них пути — примеры, а не файлы игры. */
export function withoutComments(text: string, script = false) {
	const plain = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

	return script ? plain.replace(/(^|[^:\\])\/\/[^\n]*/g, '$1') : plain;
}

function mediaKey(path: string) {
	return path.replace(/\\/g, '/').toLowerCase();
}

/** Все замечания по истории, в порядке: экраны, файлы, переменные, коды. */
export function checkStory(input: CheckInput): CheckProblem[] {
	const problems: CheckProblem[] = [];
	const {passages} = input;
	const names = new Set(passages.map(p => p.name));
	// Сессия 32: пассажи приложения для телефонов (app-block, app-settings) — не экраны терминала.
	const screens = passages.filter(
		p => !p.tags.includes('script') && !p.tags.includes('stylesheet') && !p.tags.includes('app-block') && !p.tags.includes('app-settings')
	);
	const push = (kind: CheckKind, passage: string, detail: string) => {
		if (!problems.some(p => p.kind === kind && p.passage === passage && p.detail === detail)) {
			problems.push({kind, passage, detail});
		}
	};

	// Переходы и упоминания экранов.
	screens.forEach(p => {
		[...parseLinks(p.text, true), ...screenMentions(p.text)].forEach(name => {
			if (!names.has(name) && !/^[$_]/.test(name)) {
				push('screen', p.name, name);
			}
		});
	});

	// Файлы.
	if (input.media) {
		const have = new Set(input.media.map(mediaKey));
		const sources = [
			...screens.map(p => ({name: p.name, text: withoutComments(p.text)})),
			{name: 'JavaScript истории', text: withoutComments(input.script, true)},
			{name: 'Таблица стилей', text: withoutComments(input.stylesheet)}
		];

		sources.forEach(source => {
			mediaPaths(source.text).forEach(path => {
				const folder = path.split('/')[1];

				if (checkedMediaFolders.includes(folder) && !have.has(mediaKey(path))) {
					push('media', source.name, path);
				}
			});
		});
	}

	// Переменные без начального значения в StoryInit.
	const init = passages.find(p => p.name === 'StoryInit');
	const read = readVariables(init?.text ?? '');
	const known = new Set([...read.variables.map(v => v.name), ...read.byCode]);
	const used = new Map<string, string>();

	screens
		.filter(p => p.name !== 'StoryInit')
		.forEach(p => {
			variablesInTexts([p.text]).forEach(name => {
				if (!used.has(name)) {
					used.set(name, p.name);
				}
			});
		});
	used.forEach((passage, name) => {
		if (!known.has(name) && !/^sg[A-Z]/.test(name)) {
			push('variable', passage, '$' + name);
		}
	});

	// Коды таблицы, у которых нет ни действий, ни ответа, ни перехода.
	passages
		.filter(p => p.tags.includes(codesTag))
		.forEach(p => {
			readCodes(p.text).codes.forEach(code => {
				if (code.where !== 'phone' && code.actions.length === 0 && code.answer.trim() === '' && code.goto.trim() === '') {
					push('code', p.name, code.code);
				}
			});
		});

	// Сессия 32: «Телефонам: сбой / снять сбой / открыть блоки» — названия, которых нет в данных приложения.
	if (hasAppData(passages)) {
		const game = storyToGame(passages).game;
		const known = (list: unknown, key: string) =>
			new Set(
				(Array.isArray(list) ? list : []).flatMap((x: Record<string, unknown>) => [String(x.id ?? ''), String(x[key] ?? '').trim().toLowerCase()])
			);
		const glitches = known(game.glitches, 'name');
		const blocks = known(game.blocks, 'title');
		const re = /<<sg-net\s+(glitch|fix|open)\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;

		[...screens, ...passages.filter(p => p.tags.includes(codesTag))].forEach(p => {
			let m: RegExpExecArray | null;

			while ((m = re.exec(p.text))) {
				const names = m[2]
					.slice(1, -1)
					.replace(/\\(.)/g, '$1')
					.split(m[1] === 'open' ? ',' : '\u0000')
					.map(x => x.trim())
					.filter(Boolean);
				const set = m[1] === 'open' ? blocks : glitches;

				names.forEach(name => {
					if (!set.has(name) && !set.has(name.toLowerCase())) {
						push('phone', p.name, `${m![1] === 'open' ? 'блок' : 'сбой'} «${name}»`);
					}
				});
			}
		});
	}

	return problems;
}
