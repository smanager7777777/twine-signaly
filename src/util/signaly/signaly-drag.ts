// «Twine СИГНАЛЫ»: перетаскивание мышью в предпросмотре (шаг 1.4, ответ 2а).
// Картинку и видео «на экране» и кнопки на экране можно перетащить, у картинки
// и видео ширина меняется за правый нижний уголок. Во время перетаскивания
// элемент едет сразу; когда кнопку мыши отпустили, программа записывает новые
// числа (в команду блока или в «кнопки на экране») и предпросмотр обновляется.
// Галочка «Закрепить» (решение 52) отключает всё это.
//
// Работает с документом фрейма предпросмотра: координаты мыши там — пиксели
// игры 1920×1080, независимо от уменьшения фрейма.

import {placePrefix, PlaceCorner} from './signaly-kinds';
import {findBlocks} from './signaly-screen-blocks';

export type DragResult =
	| {
			kind: 'block';
			/** Текст команды блока, как он стоит в пассаже. */
			source: string;
			x?: number;
			y?: number;
			width?: number;
	  }
	| {kind: 'place'; id: string; x: number; y: number};

export interface DragOptions {
	locked: () => boolean;
	/** Отступы кнопки на экране (из «Кнопок на экране»). */
	place: (id: string) => {corner: PlaceCorner; x: number; y: number} | undefined;
	onDrop: (result: DragResult) => void;
}

const handle = 16;
const styleId = 'sg-drag-style';

interface Target {
	el: HTMLElement;
	result: DragResult;
	corner: PlaceCorner;
	x: number;
	y: number;
	width: number;
	movable: boolean;
	resizable: boolean;
}

function placeIdOf(el: Element) {
	const cls = [...el.classList].find(c => c.startsWith(placePrefix));

	return cls ? cls.slice(placePrefix.length) : undefined;
}

function findTarget(start: EventTarget | null, options: DragOptions): Target | undefined {
	// instanceof не годится: у фрейма свои конструкторы.
	let el = start && (start as Node).nodeType === 1 ? (start as HTMLElement) : null;

	while (el && el.tagName !== 'BODY') {
		const source = el.getAttribute('data-sg-src');

		if (source) {
			const block = findBlocks(source)[0];

			if (!block || (block.type !== 'image' && block.type !== 'video')) {
				return undefined;
			}

			const v = block.values;

			return {
				el,
				result: {kind: 'block', source},
				corner: (['tl', 'tr', 'bl', 'br'].includes(String(v.corner)) ? v.corner : 'tl') as PlaceCorner,
				x: Number(v.x) || 0,
				y: Number(v.y) || 0,
				width: contentWidth(el),
				movable: v.place === 'screen',
				resizable: true
			};
		}

		const id = placeIdOf(el);
		const place = id ? options.place(id) : undefined;

		if (id && place) {
			return {
				el,
				result: {kind: 'place', id, x: place.x, y: place.y},
				corner: place.corner,
				x: place.x,
				y: place.y,
				width: 0,
				movable: true,
				resizable: false
			};
		}
		el = el.parentElement;
	}
	return undefined;
}

/** Ширина без рамки — то, что пишется в команду. */
function contentWidth(el: HTMLElement) {
	if (el.tagName === 'VIDEO') {
		return Number(el.getAttribute('width')) || el.clientWidth;
	}
	return parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).width) || el.clientWidth;
}

function nearCorner(el: HTMLElement, ev: MouseEvent) {
	const r = el.getBoundingClientRect();

	return ev.clientX > r.right - handle && ev.clientY > r.bottom - handle;
}

/** Подключает перетаскивание к документу фрейма. Возвращает «отключить». */
export function attachDrag(doc: Document, options: DragOptions) {
	const win = doc.defaultView!;
	let drag:
		| {target: Target; startX: number; startY: number; resize: boolean; moved: boolean}
		| undefined;

	function setStyle() {
		let style = doc.getElementById(styleId);

		if (options.locked()) {
			style?.remove();
			return;
		}
		if (!style) {
			style = doc.createElement('style');
			style.id = styleId;
			(doc.head ?? doc.documentElement).appendChild(style);
		}
		style.textContent =
			'[data-sg-src]:hover, [class*="' +
			placePrefix +
			'"]:hover { outline: 3px dashed #ffff00 !important; outline-offset: 2px; }';
	}

	function onMove(ev: MouseEvent) {
		if (!drag) {
			// Подсказка курсором: двигать или менять размер.
			if (options.locked()) {
				return;
			}

			const target = findTarget(ev.target, options);

			if (target) {
				target.el.style.cursor =
					target.resizable && nearCorner(target.el, ev)
						? 'nwse-resize'
						: target.movable
						? 'move'
						: '';
			}
			return;
		}

		const dx = ev.clientX - drag.startX;
		const dy = ev.clientY - drag.startY;

		if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) {
			return;
		}
		drag.moved = true;
		ev.preventDefault();

		const {target} = drag;

		if (drag.resize) {
			const width = Math.max(20, Math.round(target.width + dx));

			if (target.el.tagName === 'VIDEO') {
				target.el.setAttribute('width', String(width));
			} else {
				target.el.style.width = width + 'px';
			}
		} else {
			target.el.style.translate = `${dx}px ${dy}px`;
		}
	}

	function onUp(ev: MouseEvent) {
		if (!drag) {
			return;
		}

		const {target, moved, resize} = drag;
		const dx = Math.round(ev.clientX - drag.startX);
		const dy = Math.round(ev.clientY - drag.startY);

		drag = undefined;
		target.el.style.translate = '';
		if (!moved) {
			return;
		}

		// Щелчок после перетаскивания не должен сработать как нажатие ссылки.
		doc.addEventListener(
			'click',
			e => {
				e.preventDefault();
				e.stopPropagation();
			},
			{capture: true, once: true}
		);

		if (resize) {
			if (target.result.kind === 'block') {
				options.onDrop({...target.result, width: Math.max(20, Math.round(target.width + dx))});
			}
			return;
		}

		const right = target.corner === 'tr' || target.corner === 'br';
		const bottom = target.corner === 'bl' || target.corner === 'br';
		const x = target.x + (right ? -dx : dx);
		const y = target.y + (bottom ? -dy : dy);

		options.onDrop({...target.result, x, y} as DragResult);
	}

	function onDown(ev: MouseEvent) {
		if (ev.button !== 0 || options.locked()) {
			return;
		}

		const target = findTarget(ev.target, options);

		if (!target) {
			return;
		}

		const resize = target.resizable && nearCorner(target.el, ev);

		if (!resize && !target.movable) {
			return;
		}
		// Без этого браузер начинает «перетаскивать картинку» сам.
		ev.preventDefault();
		drag = {target, startX: ev.clientX, startY: ev.clientY, resize, moved: false};
	}

	setStyle();
	doc.addEventListener('mousedown', onDown, true);
	doc.addEventListener('mousemove', onMove, true);
	doc.addEventListener('mouseup', onUp, true);
	win.addEventListener('blur', () => {
		if (drag) {
			drag.target.el.style.translate = '';
			drag = undefined;
		}
	});

	return {
		/** Галочка «Закрепить» изменилась. */
		update: setStyle,
		detach() {
			doc.removeEventListener('mousedown', onDown, true);
			doc.removeEventListener('mousemove', onMove, true);
			doc.removeEventListener('mouseup', onUp, true);
			doc.getElementById(styleId)?.remove();
		}
	};
}

/** Новая команда блока после перетаскивания (или undefined, если не нашлась). */
export function blockAfterDrop(
	text: string,
	result: Extract<DragResult, {kind: 'block'}>
) {
	const block = findBlocks(text).find(
		b => text.slice(b.from, b.to) === result.source
	);

	if (!block) {
		return undefined;
	}

	const values = {...block.values};

	if (result.x !== undefined) {
		values.x = result.x;
	}
	if (result.y !== undefined) {
		values.y = result.y;
	}
	if (result.width !== undefined) {
		values.width = result.width;
	}
	return {block, changed: {...block, values}};
}
