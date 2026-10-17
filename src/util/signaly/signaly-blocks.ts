// «Twine СИГНАЛЫ»: служебные блоки между метками «СИГНАЛЫ: … не редактировать
// вручную» в «JavaScript истории» и «Таблице стилей». Всё, что вне блока, —
// код автора, программа его не трогает.

export interface BlockMarkers {
	start: string;
	end: string;
}

export interface FoundBlock {
	/** Позиция начала метки начала. */
	from: number;
	/** Позиция сразу за меткой конца. */
	to: number;
	/** Текст между метками (без них). */
	inner: string;
}

export function findBlock(
	source: string,
	markers: BlockMarkers
): FoundBlock | undefined {
	const from = source.indexOf(markers.start);

	if (from === -1) {
		return undefined;
	}

	const innerFrom = from + markers.start.length;
	const endAt = source.indexOf(markers.end, innerFrom);

	if (endAt === -1) {
		return undefined;
	}

	return {
		from,
		to: endAt + markers.end.length,
		inner: source.slice(innerFrom, endAt)
	};
}

/**
 * Заменяет блок новым (block — целиком, с метками). Если блока нет, ставит его
 * в начало, отделив от остального кода пустой строкой.
 */
export function putBlock(
	source: string,
	markers: BlockMarkers,
	block: string
): string {
	const found = findBlock(source, markers);

	if (found) {
		return source.slice(0, found.from) + block + source.slice(found.to);
	}

	const rest = source.replace(/^\s+/, '');

	return rest === '' ? block + '\n' : `${block}\n\n\n${rest}`;
}
