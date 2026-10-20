import {readFileSync} from 'fs';
import {join} from 'path';
import {appearanceMarkers} from '../signaly-appearance';
import {findBlock} from '../signaly-blocks';
import {
	demoStatesCss,
	kindsBlock,
	kindsMarkers,
	migrateKinds,
	placeCss,
	prepareKinds,
	readKinds,
	sanitizeKinds,
	slugify,
	uniqueName,
	withKinds
} from '../signaly-kinds';

const twee = readFileSync(
	join(__dirname, '../../../../signaly/template/27_03_2025.twee'),
	'utf8'
);

function section(name: string) {
	const start = twee.indexOf(`:: ${name}`);
	const from = twee.indexOf('\n', start) + 1;
	const next = twee.indexOf('\n:: ', from);

	return twee.slice(from, next === -1 ? undefined : next).trimEnd();
}

const templateCss = section('StoryStylesheet');

// Стили шаблона до шага 1.3 — как у автора (часть с кнопками).
const authorCss = `a {
    color: #00cc00;
    text-decoration: none
}

a:hover {
    color: #00ff00;
    text-decoration: underline;
}

/* Зелёная кнопка по дефолту */
button {
    background-color: #000000;
    color: #00cc00;
    border: 1px solid #00cc00;
    box-shadow: 0 0 5px #00cc00;
    padding: 5px 10px;
    transition: background-color 0.3s, color 0.3s;
}

button:hover {
    background-color: #00cc00;
    color: #000000;
        border: #00cc00;
}

.ui-dialog {
    color: #00cc00;
}

.amber-button,
.amber a,
.amber button {
    background-color: #000000;
    color: #FFBF00;
    border: 2px solid #FFBF00;
    box-shadow: 0 0 5px #FFBF00;
    padding: 4px 9px;
      font-size: 1.2em;
    transition: background-color 0.3s, color 0.3s;
}

.amber-button:hover,
.amber a:hover,
.amber button:hover {
    background-color: #FFBF00;
    color: #000000;
        border: 2px solid #FFBF00;
      text-decoration: none;
}

.purple-link {
    color: #cc00cc !important; /* Убедимся, что цвет приоритетен */
    text-decoration: none;
    transition: color 0.3s;
}
.purple-link:hover {
    color: #ff00ff !important;
    text-decoration: underline;
}

.hoverBox a {
	transition-duration: unset;
}
`;

describe('signaly-kinds: перенос', () => {
	const m = migrateKinds(authorCss, ['<span class="amber">[[x]]</span>']);
	const byCls = (cls: string) => m.kinds.kinds.find(k => k.cls === cls)!;

	it('переносит основной вид, янтарный и фиолетовый', () => {
		expect(m.kinds.kinds.map(k => k.cls)).toEqual(['', 'amber', 'purple']);
		expect(byCls('').link.normal.color).toBe('#00cc00');
		expect(byCls('').link.hover).toMatchObject({color: '#00ff00', underline: true});
		expect(byCls('').button.normal).toMatchObject({
			bg: '#000000',
			borderWidth: 1,
			glow: 5
		});
		// «border: #00cc00» — рамки нет.
		expect(byCls('').button.hover.borderWidth).toBe(0);
		expect(byCls('amber').link).toMatchObject({padV: 4, padH: 9, size: 120, transition: 0.3});
		expect(byCls('amber').link.hover).toMatchObject({
			color: '#000000',
			bg: '#ffbf00',
			underline: false
		});
		expect(byCls('purple').link.normal.color).toBe('#cc00cc');
		expect(byCls('purple').name).toBe('Фиолетовый');
	});

	it('оставляет непонятные правила и всё остальное у автора', () => {
		expect(m.stylesheet).toContain('.ui-dialog');
		expect(m.stylesheet).toContain('.hoverBox a');
		expect(m.stylesheet).not.toMatch(/^a \{/m);
		expect(m.stylesheet).not.toContain('amber');
		expect(m.stylesheet).not.toContain('purple-link');
		expect(m.stylesheet).not.toContain('Зелёная кнопка');
	});

	it('не трогает дубль, если он используется в пассаже', () => {
		const used = migrateKinds(authorCss, ['<span class="purple-link">x</span>']);

		expect(used.stylesheet).toContain('.purple-link');
		expect(used.kinds.kinds.map(k => k.cls)).not.toContain('purple');
	});

	it('пишет CSS с теми же правилами', () => {
		const block = kindsBlock(m.kinds);

		expect(block).toContain('a {\n\tcolor: #00cc00;\n\ttext-decoration: none;');
		expect(block).toContain('a:hover {\n\tcolor: #00ff00;\n\ttext-decoration: underline;\n}');
		expect(block).toContain('button:hover {\n\tcolor: #000000;\n\tbackground-color: #00cc00;\n\tborder: none;\n}');
		expect(block).toContain('.amber a {');
		expect(block).toContain('\tfont-size: 1.2em;');
		expect(readKinds(block)).toEqual(m.kinds);
	});
});

describe('signaly-kinds: блок в таблице стилей', () => {
	it('в шаблоне блок видов стоит сразу после блока оформления', () => {
		const appearance = findBlock(templateCss, appearanceMarkers)!;
		const kinds = findBlock(templateCss, kindsMarkers)!;

		expect(kinds.from).toBeGreaterThan(appearance.to);
		expect(templateCss.slice(appearance.to, kinds.from).trim()).toBe('');
	});

	it('в шаблоне — пять видов и семь кнопок на экране', () => {
		const data = readKinds(templateCss)!;

		expect(data.kinds.map(k => k.cls)).toEqual([
			'',
			'red-big',
			'yellow-small',
			'amber',
			'purple'
		]);
		expect(data.places.map(p => p.id)).toEqual(['rad', 'atm', 'a', 'b', 'c', 'd', 'e']);
		expect(templateCss).not.toContain('top-right-audio-buttons');
	});

	it('повторная подготовка ничего не меняет', () => {
		const prepared = prepareKinds(templateCss, []);

		expect(prepared.moved).toEqual([]);
		expect(withKinds(prepared.stylesheet, prepared.kinds, appearanceMarkers)).toBe(
			templateCss
		);
	});

	it('без блока оформления ставит блок в начало', () => {
		const result = withKinds('b { color: red; }', sanitizeKinds({}), appearanceMarkers);

		expect(result.startsWith(kindsMarkers.start)).toBe(true);
		expect(result).toContain('b { color: red; }');
	});
});

describe('signaly-kinds: кнопки на экране', () => {
	it('считает место от угла окна терминала', () => {
		const css = placeCss({id: 'rad', name: 'РАД', corner: 'tr', x: 5, y: 2.75, kind: 'amber'});

		expect(css).toContain('.sg-place-rad {');
		expect(css).toContain('position: fixed;');
		expect(css).toContain(
			'right: calc(50% - var(--sg-win-width, 1050px) / 2 - var(--sg-win-offset-x, 0px) + 5px);'
		);
		expect(css).toContain(
			'top: calc(50% - var(--sg-win-height, 1050px) / 2 + var(--sg-win-offset-y, 0px) + 2.75px);'
		);
		expect(placeCss({id: 'x', name: 'x', corner: 'bl', x: 0, y: 0, kind: ''})).toContain('bottom:');
	});

	it('отбрасывает неверные данные', () => {
		const data = sanitizeKinds({
			kinds: [{cls: 'bad class'}, {cls: 'ok', name: 'Хороший'}],
			places: [{id: 'Плохой'}, {id: 'ok', corner: 'zz', x: 'a'}]
		});

		expect(data.kinds.map(k => k.cls)).toEqual(['', 'ok']);
		expect(data.places).toEqual([
			{id: 'ok', name: 'ok', corner: 'tl', x: 0, y: 0, kind: ''}
		]);
	});
});

describe('signaly-kinds: помощники', () => {
	it('делает имя класса из русского названия', () => {
		expect(slugify('Синий большой')).toBe('siniy-bolshoy');
		expect(slugify('123')).toBe('vid-123');
		expect(uniqueName('amber', ['amber', 'amber-2'])).toBe('amber-3');
	});

	it('показывает наведение и нажатие в образцах', () => {
		const css = demoStatesCss(readKinds(templateCss)!);

		expect(css).toContain('.sg-demo-hover .amber a {');
		expect(css).toContain('background-color: #ffbf00 !important;');
	});
});
