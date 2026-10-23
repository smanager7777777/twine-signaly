// «Twine СИГНАЛЫ»: перенос общих настроек .twee-истории в блок оформления и
// установка движка — то же, что делает окно «Оформление терминала» при первом
// открытии. Используется для шаблона в репозитории и в проверках.
//
// Сборка и запуск:
//   npx tsc -p signaly/tools/tsconfig.json
//   node .signaly-tools/signaly/tools/migrate-twee.js вход.twee выход.twee ['{"noise":20}'] ['{"places":[…]}']
// Третий параметр (для проверок) — настройки оформления, которые поменять после
// переноса; четвёртый — данные видов кнопок. Старые «кнопки на экране» (места
// в блоке видов, <span class="sg-place-…">) становятся элементами <<sg-place>>
// (сессия 6).

import {readFileSync, writeFileSync} from 'fs';
import {
	appearanceMarkers,
	prepareStory,
	sanitizeAppearance,
	withAppearance
} from '../../src/util/signaly/signaly-appearance';
import {
	prepareKinds,
	sanitizeKinds,
	withKinds
} from '../../src/util/signaly/signaly-kinds';
import {movePlacesInTexts, withoutPlaces} from '../../src/util/signaly/signaly-places';

function section(source: string, header: RegExp) {
	const match = header.exec(source);

	if (!match) {
		return undefined;
	}

	const from = match.index + match[0].length;
	const next = source.slice(from).search(/\n:: /);
	const to = next === -1 ? source.length : from + next + 1;

	return {from, to, text: source.slice(from, to).replace(/\s+$/, '')};
}

function replaceSection(
	source: string,
	found: {from: number; to: number},
	text: string,
	last: boolean
) {
	return (
		source.slice(0, found.from) +
		text +
		(last ? '\n' : '\n\n\n') +
		source.slice(found.to)
	);
}

const [input, output, overrides, kindsOverrides] = process.argv.slice(2);

if (!input || !output) {
	console.error('Использование: migrate-twee.js вход.twee выход.twee');
	process.exit(1);
}

let twee = readFileSync(input, 'utf8');
const scriptHeader = /^:: StoryScript \[script\][^\n]*\n/m;
const styleHeader = /^:: StoryStylesheet \[stylesheet\][^\n]*\n/m;
const script = section(twee, scriptHeader);
const style = section(twee, styleHeader);

if (!script || !style) {
	console.error('В истории нет StoryScript или StoryStylesheet');
	process.exit(1);
}

const result = prepareStory(script.text, style.text);

if (overrides) {
	result.appearance = sanitizeAppearance({
		...result.appearance,
		...JSON.parse(overrides)
	});
}
// Блок оформления пишется заново, как при «Сохранить» в окне оформления.
result.stylesheet = withAppearance(result.stylesheet, result.appearance);

// Виды кнопок и ссылок (шаг 1.3): перенос правил автора в блок видов.
const passageTexts = twee
	.split(/^:: /m)
	.filter(p => !/^Story(Script|Stylesheet) /.test(p));
const kinds = prepareKinds(result.stylesheet, passageTexts);

if (kindsOverrides) {
	kinds.kinds = sanitizeKinds({...kinds.kinds, ...JSON.parse(kindsOverrides)});
}
const places = kinds.kinds.places;

result.stylesheet = withKinds(kinds.stylesheet, withoutPlaces(kinds.kinds), appearanceMarkers);
result.moved.push(...kinds.moved);

// Сначала то, что ниже по тексту, чтобы позиции не сдвинулись.
const parts = [
	{found: script, text: result.script},
	{found: style, text: result.stylesheet}
].sort((a, b) => b.found.from - a.found.from);

parts.forEach(({found, text}) => {
	twee = replaceSection(twee, found, text, found.to >= twee.length);
});

// Кнопки на экране → элементы <<sg-place>> в текстах пассажей.
if (places.length) {
	const chunks = twee.split(/^(?=:: )/m);
	const bodies = chunks.map(chunk => {
		const nl = chunk.indexOf('\n');

		return /^:: Story(Script|Stylesheet) /.test(chunk) || nl === -1 ? '' : chunk.slice(nl + 1);
	});
	const moved = movePlacesInTexts(bodies, places);

	moved.texts.forEach((text, index) => {
		const chunk = chunks[index];

		chunks[index] = chunk.slice(0, chunk.indexOf('\n') + 1) + text;
	});
	twee = chunks.join('');
	result.moved.push(`кнопки на экране → элементы (${moved.count})`);
}

writeFileSync(output, twee);
console.log('Перенесено:', result.moved.join('; ') || 'ничего');
