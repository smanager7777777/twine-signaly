// «Twine СИГНАЛЫ»: переименование экрана (ответ 7А к шагу 4.4). Twine сам чинит
// только ссылки [[…]]. Здесь — всё остальное, где имя экрана записано в команде:
// goto, passage, lock, правила «Доступа», строка событий, <<link>>, <<button>>,
// <<goto>>, <<include>> и условие setup.visits("Экран").

import {plain} from './signaly-link-form';
import {quote, scanArgs} from './signaly-screen-blocks';

/** Слова, за которыми в команде СИГНАЛОВ стоит имя экрана. */
function screenWords(macro: string) {
	return [
		'goto',
		'passage',
		...(macro === 'sg-access' || macro === 'sg-entry' ? ['lock'] : []),
		...(macro === 'sg-rule' ? ['from', 'to'] : []),
		...(macro === 'sg-ticker' ? ['screen'] : []),
		...(macro === 'sg-hack' ? ['win', 'fail'] : [])
	];
}

/** Значение слова команды; переменная ($x, _x) — не имя экрана. */
function tokenValue(token: string | undefined) {
	if (token === undefined || /^[$_]/.test(token)) {
		return undefined;
	}
	return plain(token) ?? token;
}

/**
 * Обходит все места, где в командах записано имя экрана (кроме [[…]]): visit
 * получает имя, место слова в тексте и приставку (alarm:, chain:, hack: у
 * правил «Доступа»; у setup.visits — «visits»).
 */
function walkScreens(
	text: string,
	visit: (name: string, from: number, to: number, prefix: string) => void
) {
	const command = /<<(sg-[a-z0-9-]+|link|button|goto|include)(?=[\s>])/g;
	let match: RegExpExecArray | null;

	while ((match = command.exec(text))) {
		const macro = match[1];
		const start = match.index + match[0].length;
		const scan = scanArgs(text, start);

		if (!scan) {
			continue;
		}

		const {tokens} = scan;
		// Слова идут подряд через пробелы, поэтому indexOf находит каждое на своём месте.
		const places: number[] = [];
		let at = start;

		tokens.forEach(token => {
			at = text.indexOf(token, at);
			places.push(at);
			at += token.length;
		});

		const take = (i: number) => {
			const value = tokenValue(tokens[i]);

			if (value !== undefined) {
				visit(value, places[i], places[i] + tokens[i].length, '');
			}
		};

		if (macro === 'link' || macro === 'button') {
			take(1);
		} else if (macro === 'goto' || macro === 'include') {
			take(0);
		} else {
			tokens.forEach((token, i) => {
				if (screenWords(macro).includes(token)) {
					take(i + 1);
				}
			});
			if (macro === 'sg-rule' && tokens[0] === 'auto') {
				const id = tokenValue(tokens[1]) ?? '';
				const kind = /^(alarm|chain|hack):/.exec(id);

				if (kind) {
					visit(id.slice(kind[0].length), places[1], places[1] + tokens[1].length, kind[0]);
				}
			}
		}
	}

	const visits = /setup\.visits\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\)/g;

	while ((match = visits.exec(text))) {
		const value = tokenValue(match[1]);

		if (value !== undefined) {
			visit(value, match.index, match.index + match[0].length, 'visits');
		}
	}
}

/** Имена экранов, записанные в командах текста (для проверки истории). */
export function screenMentions(text: string) {
	const names: string[] = [];

	walkScreens(text, name => {
		if (name !== '' && !names.includes(name)) {
			names.push(name);
		}
	});
	return names;
}

/** Текст с новым именем экрана; без упоминаний — тот же текст. */
export function renameScreen(text: string, oldName: string, newName: string) {
	const edits: Array<{from: number; to: number; insert: string}> = [];

	walkScreens(text, (name, from, to, prefix) => {
		if (name === oldName) {
			edits.push({
				from,
				to,
				insert: prefix === 'visits' ? `setup.visits(${quote(newName)})` : quote(prefix + newName)
			});
		}
	});

	return edits
		.sort((a, b) => b.from - a.from)
		.reduce((result, e) => result.slice(0, e.from) + e.insert + result.slice(e.to), text);
}
