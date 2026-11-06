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
// (сессия 6). С шага 2.2 — звуки наведения и нажатия шаблона → наборы, звуковые
// команды StoryInit → раздел окна «Звуки». С шага 2.3 — таймеры и иллюминатор
// шаблона → блоки «Таймер» и «Цепочка видео». С шага 3.2 — окна-сообщения,
// открытые кодом <<script>> в ссылках, → действие <<sg-open>>. С шага 3.3 —
// код горячих клавиш шаблона → пассаж «Горячие клавиши» (тег sg-keys).

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
import {findAudioInit, readSounds, templateSounds, withAudioInit} from '../../src/util/signaly/signaly-sounds';
import {moveTemplateTimers} from '../../src/util/signaly/signaly-timers';
import {moveScriptDialogs} from '../../src/util/signaly/signaly-actions';
import {moveTemplateHack} from '../../src/util/signaly/signaly-hack';
import {moveTemplateCamera} from '../../src/util/signaly/signaly-camera';
import {freeSpot, keysPassageName, keysTag, moveTemplateKeys} from '../../src/util/signaly/signaly-keys';

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

// Шаг 2.2: код звуков шаблона → наборы (это делает движок, prepareStory).
if (!readSounds(script.text) && templateSounds(script.text)) {
	result.moved.push('звуки наведения и нажатия → наборы');
}

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

// Звуки (шаг 2.2): файлы, группы и плейлисты StoryInit — разделом окна «Звуки».
const init = section(twee, /^:: StoryInit\b[^\n]*\n/m);

if (init && findAudioInit(init.text).ranges.length) {
	const text = withAudioInit(init.text, findAudioInit(init.text).init).replace(/\s+$/, '');

	if (text !== init.text) {
		twee = replaceSection(twee, init, text, init.to >= twee.length);
		result.moved.push('звуки StoryInit → раздел окна «Звуки»');
	}
}

// Таймеры и иллюминатор (шаг 2.3) — блоками.
{
	const chunks = twee.split(/^(?=:: )/m);
	const heads = chunks.map(chunk => chunk.slice(0, chunk.indexOf('\n') + 1));
	const names = heads.map(head => /^:: ((?:\\.|[^\\\[{\n])*?)\s*(?:\[|\{|\n)/.exec(head)?.[1] ?? '');
	// Текст пассажа без пустых строк в конце (они — разделитель .twee).
	const bodies = chunks.map((chunk, i) => chunk.slice(heads[i].length).replace(/\s+$/, ''));
	const scriptIndex = chunks.findIndex(chunk => /^:: StoryScript \[script\]/.test(chunk));
	const list = names.map((name, i) => ({index: i, name, text: bodies[i]})).filter(
		p => p.name && !/^:: Story(Script|Stylesheet) /.test(chunks[p.index]) && !/^:: Story(Title|Data)\b/.test(chunks[p.index])
	);
	const timers = moveTemplateTimers(bodies[scriptIndex], list.map(p => ({name: p.name, text: p.text})));
	const put = (index: number, text: string) => {
		// Пустые строки в конце — разделитель .twee, они остаются.
		chunks[index] = heads[index] + text + /\s*$/.exec(chunks[index])![0];
	};

	timers.texts.forEach((text, i) => put(list[i].index, text));
	// Шаг 3.2: окна <<script>>Dialog.create…<</script>> в ссылках → <<sg-open>>.
	list.forEach((p, i) => {
		const text = timers.texts.get(i) ?? p.text;
		const moved = moveScriptDialogs(text);

		if (moved !== text) {
			result.moved.push(`окна-сообщения в ссылках → действия (${p.name})`);
			put(p.index, moved);
		}

		// Шаг 5.2: экран «Хактест» → блок «Терминал взлома».
		const hack = moveTemplateHack(moved);

		if (hack !== moved) {
			result.moved.push(`терминал взлома → блок (${p.name})`);
			put(p.index, hack);
		}
	});
	// Шаг 5.3: камеры шаблона → блоки «Камера». Текст берётся уже перенесённый.
	const current = (i: number) => chunks[list[i].index].slice(heads[list[i].index].length).replace(/\s+$/, '');
	const camera = moveTemplateCamera(timers.script, list.map((p, i) => ({name: p.name, text: current(i)})));

	camera.texts.forEach((text, i) => {
		result.moved.push(`камера → блок (${list[i].name})`);
		put(list[i].index, text);
	});
	if (camera.script !== bodies[scriptIndex]) {
		put(scriptIndex, camera.script);
	}
	twee = chunks.join('');
	result.moved.push(...timers.moved);
}

// Горячие клавиши (шаг 3.3) — пассажем «Горячие клавиши».
{
	const script = section(twee, scriptHeader)!;
	const heads = [...twee.matchAll(/^:: ((?:\\.|[^\\[{\n])*?)\s*(?:\[([^\]]*)\])?\s*(\{[^\n]*\})?\s*$/gm)];
	const passages = heads.map(h => ({name: h[1], tags: (h[2] ?? '').split(/\s+/).filter(Boolean)}));
	const keys = moveTemplateKeys(script.text, passages);

	if (keys) {
		const spots = heads
			.map(h => {
				try {
					const meta = JSON.parse(h[3] ?? '{}');
					const [left, top] = String(meta.position ?? '0,0').split(',').map(Number);
					const [width] = String(meta.size ?? '100,100').split(',').map(Number);

					return {left, top, width};
				} catch {
					return {left: 0, top: 0, width: 100};
				}
			});
		const {left, top} = freeSpot(spots);
		const chunk = `:: ${keysPassageName} [${keysTag}] {"position":"${left},${top}","size":"100,100"}\n${keys.text}\n\n\n`;

		twee = replaceSection(twee, script, keys.script.replace(/\s+$/, ''), script.to >= twee.length);
		twee = twee.replace(scriptHeader, header => chunk + header);
		result.moved.push('горячие клавиши шаблона → пассаж «Горячие клавиши»');
	}
}

writeFileSync(output, twee);
console.log('Перенесено:', result.moved.join('; ') || 'ничего');
