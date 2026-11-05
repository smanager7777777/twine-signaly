import {
	appearanceCss,
	defaultAppearance,
	inputFromAuthor,
	readAppearance,
	sanitizeAppearance,
	withAppearance
} from '../signaly-appearance';
import {applyTextStyle} from '../signaly-format';
import {
	copyNamed,
	inputCss,
	newScreenView,
	newTextStyle,
	sanitizeStyles,
	sanitizeViews,
	screensCss,
	screenTag,
	tagsWithView,
	textStyleClass,
	textStylesCss,
	viewOfTags
} from '../signaly-screens';

const base = {flicker: true, flickerPeriod: 0.1, flickerDepth: 5, noise: 0, fontSize: 25, fontFamily: '"Courier New", monospace'};
const view = (more = {}) => ({...newScreenView([], 'Вид экрана'), ...more});

describe('виды экранов', () => {
	it('новый вид ничего не меняет', () => {
		expect(screensCss([view()], base)).toEqual([]);
	});

	it('имя, тег латиницей, повторы', () => {
		const first = newScreenView([], 'Вид экрана');
		const second = newScreenView([first], 'Вид экрана');

		expect(first.name).toBe('Вид экрана 1');
		expect(screenTag(first)).toBe('sg-scr-vid-ekrana-1');
		expect(second.id).not.toBe(first.id);
	});

	it('копия — со своим тегом', () => {
		const a = view({name: 'Красный', id: 'krasnyy'});
		const b = copyNamed([a], a, 'копия');

		expect(b.name).toBe('Красный (копия)');
		expect(b.id).not.toBe(a.id);
		expect(copyNamed([a, b], a, 'копия').name).toBe('Красный (копия 2)');
	});

	it('без рамки, на весь экран, цвета — настройки вида, а ширина общая не меняется', () => {
		const css = screensCss([view({id: 'x', frame: 'none', size: 'full', winBg: '#cc0000', textColor: '#000000', fontSize: 100})], base).join('\n');

		expect(css).toContain('html[data-tags~="sg-scr-x"] {');
		expect(css).toContain('--sg-win-bg: #cc0000;');
		expect(css).toContain('--sg-border-width: 0px;');
		expect(css).toContain('box-shadow: none;');
		expect(css).toContain('width: 100vw;');
		// От этих переменных считаются места кнопок: они не должны меняться.
		expect(css).not.toContain('--sg-win-width');
		expect(css).not.toContain('--sg-win-height');
		expect(css).not.toContain('--sg-win-offset');
	});

	it('девять мест текста', () => {
		const place = (textPlace: string) => screensCss([view({id: 'x', textPlace})], base).join('\n');

		expect(place('tl')).toContain('margin: 0 auto auto 0;');
		expect(place('mc')).toContain('margin: auto auto auto auto;');
		expect(place('mc')).toContain('text-align: center;');
		expect(place('br')).toContain('margin: auto 0 0 auto;');
		expect(place('br')).toContain('text-align: right;');
	});

	it('эффект, выключенный в общем, приносит свои кадры', () => {
		const css = screensCss([view({id: 'x', noise: 'on', flicker: 'on'})], {...base, flicker: false}).join('\n');

		expect(css).toContain('html[data-tags~="sg-scr-x"] #sg-fx::after {');
		expect(css).toContain('@keyframes sg-noise');
		expect(css).toContain('@keyframes sg-flicker');
		expect(screensCss([view({id: 'x', flicker: 'on'})], base).join('\n')).not.toContain('@keyframes sg-flicker');
	});

	it('шрифт из файла — свой @font-face', () => {
		const css = screensCss([view({id: 'x', font: 'media/fonts/a.woff2'})], base).join('\n');

		expect(css).toContain('font-family: "sg-scr-font-x";');
		expect(css).toContain('--sg-font: "sg-scr-font-x", monospace;');
		expect(screensCss([view({id: 'x', font: 'Consolas'})], base).join('\n')).toContain('--sg-font: "Consolas", monospace;');
	});

	it('тег вида у пассажа один', () => {
		const a = view({id: 'a'});
		const b = view({id: 'b'});

		expect(tagsWithView(['kr2', 'sg-scr-a'], b)).toEqual(['kr2', 'sg-scr-b']);
		expect(tagsWithView(['kr2', 'sg-scr-a'], undefined)).toEqual(['kr2']);
		expect(viewOfTags(['sg-scr-b'], [a, b])).toBe(b);
		expect(viewOfTags(['sg-scr-z'], [a, b])).toBeUndefined();
	});

	it('мусор в настройках отбрасывается', () => {
		expect(sanitizeViews('x')).toEqual([]);
		expect(sanitizeViews([{id: 'Плохой'}, null])).toEqual([]);

		const [good] = sanitizeViews([{id: 'a', frame: 'странно', winBg: 'red', fontSize: 'x', textPlace: 'zz'}]);

		expect(good).toMatchObject({name: 'a', frame: 'same', winBg: '', fontSize: null, textPlace: ''});
		expect(sanitizeStyles([{id: 'a', size: 20, color: '#ABC'}])[0]).toMatchObject({size: 20, color: '#aabbcc', lineHeight: null});
	});
});

describe('оформление: виды, стили, поля', () => {
	it('сохраняется и читается обратно', () => {
		const a = {
			...defaultAppearance,
			inputOn: true,
			inputWidth: 200,
			screens: [view({id: 'x', name: 'Красный', textPlace: 'mc', padding: 0})],
			textStyles: [{...newTextStyle([], 'Стиль'), id: 's', size: 30}]
		};

		expect(readAppearance(withAppearance('', a))).toEqual(a);
	});

	it('старый блок без новых полей читается', () => {
		const a = sanitizeAppearance({v: 1, pageBg: '#111111'});

		expect(a.screens).toEqual([]);
		expect(a.textStyles).toEqual([]);
		expect(a.inputOn).toBe(false);
	});

	it('без настройки полей правила полей нет', () => {
		expect(appearanceCss(defaultAppearance)).not.toContain('html input');
		expect(appearanceCss({...defaultAppearance, inputOn: true})).toContain('html input, html textarea {');
	});

	it('значения полей — из правила автора', () => {
		const css = 'input, textarea { background-color: #111111; color: #222222; border: 2px solid #333333; box-shadow: 0 0 7px #333333; padding: 5px; font-size: 19px; }';

		expect(inputFromAuthor(css)).toEqual({inputBg: '#111111', inputColor: '#222222', inputBorderWidth: 2, inputBorderColor: '#333333', inputGlow: 7, inputSize: 19});
		expect(inputFromAuthor('')).toEqual({});
	});

	it('ширина и шрифт поля — только если заданы', () => {
		const plain = inputCss(defaultAppearance).join('\n');

		expect(plain).not.toContain('width:');
		expect(plain).not.toContain('font-family');
		expect(plain).toContain('box-shadow: 0 0 5px #00cc00;');

		const own = inputCss({...defaultAppearance, inputWidth: 300, inputFont: 'media/fonts/a.woff2', inputGlow: 0}).join('\n');

		expect(own).toContain('width: 300px;');
		expect(own).toContain('"sg-input-font"');
		expect(own).toContain('box-shadow: none;');
	});
});

describe('стили текста', () => {
	const style = {...newTextStyle([], 'Стиль'), id: 's'};
	const classes = [textStyleClass(style), 'sg-ts-t'];

	it('в правиле только заданное', () => {
		expect(textStylesCss([style]).join('\n')).toBe('.sg-ts-s {\n}');

		const css = textStylesCss([{...style, size: 30, color: '#ff0000', glow: 5, lineHeight: 1.5}]).join('\n');

		expect(css).toContain('font-size: 30px;');
		expect(css).toContain('text-shadow: 0 0 5px #ff0000;');
		expect(css).toContain('line-height: 1.5;');
		expect(css).toContain('display: inline-block;');
	});

	it('выделенный текст оборачивается', () => {
		expect(applyTextStyle('один два', 0, 4, 'sg-ts-s', classes, 'текст')?.insert).toBe('<span class="sg-ts-s">один</span>');
	});

	it('без выделения вставляется образец, а не ссылка', () => {
		const edit = applyTextStyle('один', 4, 4, 'sg-ts-s', classes, 'текст');

		expect(edit?.insert).toBe('<span class="sg-ts-s">текст</span>');
		expect(applyTextStyle('один', 4, 4, '', classes, 'текст')).toBeUndefined();
	});

	it('другой стиль заменяет прежний, вид ссылки не трогается', () => {
		const text = '<span class="sg-ts-s">один</span>';

		expect(applyTextStyle(text, 23, 23, 'sg-ts-t', classes, 'текст')).toBeDefined();
		expect(applyTextStyle('<span class="amber">один</span>', 20, 24, 'sg-ts-s', classes, '')?.insert).toBe('<span class="sg-ts-s">один</span>');
	});
});
