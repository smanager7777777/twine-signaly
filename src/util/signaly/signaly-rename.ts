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
		...(macro === 'sg-ticker' ? ['screen'] : [])
	];
}

/** Значение слова команды; переменная ($x, _x) — не имя экрана. */
function tokenValue(token: string | undefined) {
	if (token === undefined || /^[$_]/.test(token)) {
		return undefined;
	}
	return plain(token) ?? token;
}

/** Текст с новым именем экрана; без упоминаний — тот же текст. */
export function renameScreen(text: string, oldName: string, newName: string) {
	const edits: Array<{from: number; to: number; insert: string}> = [];
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

		const swap = (i: number) => {
			if (tokenValue(tokens[i]) === oldName) {
				edits.push({from: places[i], to: places[i] + tokens[i].length, insert: quote(newName)});
			}
		};

		if (macro === 'link' || macro === 'button') {
			swap(1);
		} else if (macro === 'goto' || macro === 'include') {
			swap(0);
		} else {
			tokens.forEach((token, i) => {
				if (screenWords(macro).includes(token)) {
					swap(i + 1);
				}
			});
			if (macro === 'sg-rule' && tokens[0] === 'auto') {
				const id = tokenValue(tokens[1]) ?? '';
				const kind = /^(alarm|chain):/.exec(id);

				if (kind && id.slice(kind[0].length) === oldName) {
					edits.push({from: places[1], to: places[1] + tokens[1].length, insert: quote(kind[0] + newName)});
				}
			}
		}
	}

	const visits = /setup\.visits\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\)/g;

	while ((match = visits.exec(text))) {
		if (tokenValue(match[1]) === oldName) {
			edits.push({from: match.index, to: match.index + match[0].length, insert: `setup.visits(${quote(newName)})`});
		}
	}

	return edits
		.sort((a, b) => b.from - a.from)
		.reduce((result, e) => result.slice(0, e.from) + e.insert + result.slice(e.to), text);
}
