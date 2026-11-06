// «Twine СИГНАЛЫ»: терминал взлома (шаг 5.2, ответы автора — решение 103).
// Блок <<sg-hack>> разбирает и пишет signaly-screen-blocks.ts, в игре работает
// движок. Здесь — разбор списка слов для формы и перенос экрана «Хактест»
// шаблона в блок: только если весь код совпадает (как у горячих клавиш).

import {writeBlock} from './signaly-screen-blocks';

/** Слова из строки: через запятую, пробел или с новой строки, без повторов. */
export function hackWords(value: string | number | boolean | undefined) {
	return [
		...new Set(
			String(value ?? '')
				.split(/[\s,;]+/)
				.filter(Boolean)
		)
	];
}

/** Сколько слов каждой длины. Длина выпадает, только если слов хватает. */
export function hackLengths(words: string[], count: number) {
	const sizes = new Map<number, number>();

	words.forEach(word => {
		const size = Array.from(word).length;

		sizes.set(size, (sizes.get(size) ?? 0) + 1);
	});

	const most = Math.max(0, ...sizes.values());
	const enough = Math.min(count, most);

	return [...sizes.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([size, found]) => ({size, found, usable: found >= enough}));
}

/** Текст кода шаблона без значений, которые переносятся в блок. */
function scriptHash(code: string) {
	let hash = 5381;

	for (let i = 0; i < code.length; i++) {
		hash = (hash * 33 + code.charCodeAt(i)) % 4294967291;
	}
	return hash;
}

// Контрольное число кода экрана «Хактест» шаблона 27_03_2025 (без Engine.play).
const templateScript = 772289850;

const templateRe = new RegExp(
	[
		String.raw`^\\<<set \$attemptsLeft = (\d+)>>.*`,
		String.raw`\\<<set \$wordList = \[(.*)\]>>.*`,
		String.raw`\\<<set \$correctPassword = ".*">>.*`,
		String.raw`\\<<set \$usedAttempts = \[\]>>.*`,
		String.raw`\\<<set \$likenessDisplay = "">>.*`,
		String.raw`\\<<set \$rows = (\d+)>>.*`,
		String.raw`\\<<set \$charsPerRow = (\d+)>>.*`,
		String.raw`\\`,
		String.raw`\\(<<script>>[^]*?<<\/script>>)`,
		String.raw`\\`,
		String.raw`\\<div id="terminalWindow">`,
		String.raw` *\\<div id="terminalDisplay"><\/div>`,
		String.raw` *\\<div id="likenessDisplay"><\/div>`,
		String.raw` *\\<div id="attemptsLeft"><\/div>`,
		String.raw`\\<\/div>`,
		String.raw`([^]*)$`
	].join('\n')
);

/**
 * Экран «Хактест» шаблона → блок. Ключевое слово становится случайным (ответ 6),
 * попытки, слова, размеры и экраны — те же. Чужой код не трогается.
 */
export function moveTemplateHack(text: string) {
	const match = templateRe.exec(text);

	if (!match) {
		return text;
	}

	const [, attempts, list, rows, cols, script, rest] = match;
	const plays = [...script.matchAll(/Engine\.play\("([^"]*)"\)/g)].map(m => m[1]);

	if (plays.length !== 2 || scriptHash(script.replace(/Engine\.play\("[^"]*"\)/g, 'Engine.play()')) !== templateScript) {
		return text;
	}

	const words = [...list.matchAll(/"([^"]*)"/g)].map(m => m[1]);

	if (!words.length) {
		return text;
	}

	const block = writeBlock({
		type: 'hack',
		values: {
			words: words.join(', '),
			count: words.length,
			attempts: Number(attempts),
			rows: Number(rows),
			cols: Number(cols),
			win: plays[0],
			fail: plays[1]
		},
		extra: [],
		hack: {win: '', fail: '', miss: ''}
	});

	return `${block}\\\n${rest.replace(/^\\/, '')}`;
}
