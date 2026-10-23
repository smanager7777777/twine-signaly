// «Twine СИГНАЛЫ»: перенос «кнопок на экране» в элементы (сессия 6, замечание
// автора к шагам 1.3–1.4). Раньше место кнопки было общим и хранилось в окне
// видов (вкладка «Кнопки на экране», классы sg-place-…). Теперь место — свойство
// самого элемента, как у картинки и видео:
//   <span class="sg-place-rad amber">…</span>
// превращается в
//   <<sg-place kind amber corner tr x 5 y 2.75>>…<</sg-place>>
// а места убираются из блока видов. Вид экрана не меняется.

import {TagRun, tagRuns} from './signaly-format';
import {Place, placePrefix, readKinds, SignalyKinds, withKinds} from './signaly-kinds';
import {writeBlock} from './signaly-screen-blocks';

export interface PlaceMove {
	/** Новые тексты пассажей (только изменившиеся), по индексу во входном списке. */
	texts: Map<number, string>;
	/** Сколько кнопок перенесено. */
	count: number;
}

function convertible(text: string, run: TagRun, places: Place[]) {
	const id = run.classes.find(c => c.startsWith(placePrefix));

	// Только простой тег <span class="…"> без других атрибутов, с известным
	// местом и не больше чем одним видом.
	return (
		id !== undefined &&
		places.some(p => placePrefix + p.id === id) &&
		run.classes.length <= 2 &&
		/^<span\s+class\s*=\s*(["'])[^"']*\1\s*>$/i.test(text.slice(run.openFrom, run.openTo))
	);
}

/** Тексты пассажей, где кнопки на экране стали элементами <<sg-place>>. */
export function movePlacesInTexts(texts: string[], places: Place[]): PlaceMove {
	const result = new Map<number, string>();
	let count = 0;

	if (places.length === 0) {
		return {texts: result, count};
	}
	texts.forEach((text, index) => {
		let next = text;

		// По одной кнопке, с конца текста; после каждой правки теги ищутся заново.
		for (;;) {
			const run = tagRuns(next)
				.filter(r => r.tag === 'span' && convertible(next, r, places))
				.sort((a, b) => b.openFrom - a.openFrom)[0];

			if (!run) {
				break;
			}

			const id = run.classes.find(c => c.startsWith(placePrefix))!.slice(placePrefix.length);
			const place = places.find(p => p.id === id)!;
			const others = run.classes.filter(c => !c.startsWith(placePrefix));
			const block = writeBlock({
				type: 'place',
				values: {kind: others[0], corner: place.corner, x: place.x, y: place.y},
				extra: [],
				content: next.slice(run.openTo, run.closeFrom)
			});

			next = next.slice(0, run.openFrom) + block + next.slice(run.closeTo);
			count++;
		}
		if (next !== text) {
			result.set(index, next);
		}
	});
	return {texts: result, count};
}

/** Блок видов без мест (после переноса). */
export function withoutPlaces(data: SignalyKinds): SignalyKinds {
	return {...data, places: []};
}

/** Есть ли в истории старые «кнопки на экране», которые надо перенести. */
export function hasOldPlaces(stylesheet: string) {
	return (readKinds(stylesheet)?.places.length ?? 0) > 0;
}

export interface PlacesUpgrade<P> {
	stylesheet: string;
	passages: Array<{passage: P; text: string}>;
	count: number;
}

/**
 * Переносит кнопки на экране во всей истории: новые тексты пассажей и таблица
 * стилей без мест. undefined — переносить нечего.
 */
export function upgradePlaces<P extends {text: string}>(
	stylesheet: string,
	passages: P[]
): PlacesUpgrade<P> | undefined {
	const data = readKinds(stylesheet);

	if (!data || data.places.length === 0) {
		return undefined;
	}

	const moved = movePlacesInTexts(
		passages.map(p => p.text),
		data.places
	);

	return {
		stylesheet: withKinds(stylesheet, withoutPlaces(data)),
		passages: [...moved.texts].map(([index, text]) => ({passage: passages[index], text})),
		count: moved.count
	};
}
