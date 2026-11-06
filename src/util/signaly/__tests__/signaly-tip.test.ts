import {readFileSync} from 'fs';
import {join} from 'path';
import {
	findTips,
	moveTemplateTips,
	removeTip,
	setTip,
	tipContent,
	tipMovedNote,
	tipStyleNote,
	wrapTip
} from '../signaly-tip';
import {tipCss} from '../signaly-screens';
import {defaultAppearance, sanitizeAppearance} from '../signaly-appearance';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8').replace(/\n$/, '');

describe('findTips', () => {
	it('находит команду, текст подсказки, ширину и текст на экране', () => {
		const text = 'а <<hovertip "Назад \\"в\\" меню" 400>>\\[[Назад|Start]]<</hovertip>> б';
		const [tip] = findTips(text);

		expect(tip.tip).toBe('Назад "в" меню');
		expect(tip.width).toBe(400);
		expect(tipContent(text, tip)).toBe('\\[[Назад|Start]]');
		expect(text.slice(tip.from, tip.to).endsWith('<</hovertip>>')).toBe(true);
	});

	it('без ширины — 0, команда без закрытия не считается', () => {
		expect(findTips('<<hovertip "а">>б<</hovertip>>')[0].width).toBe(0);
		expect(findTips('<<hovertip "а">>б')).toEqual([]);
	});

	it('не путает с другой командой', () => {
		expect(findTips('<<hovertipper "а">>б<</hovertipper>>')).toEqual([]);
	});
});

describe('setTip и removeTip', () => {
	const text = 'до <<hovertip "старая" 300>>на экране<</hovertip>> после';
	const [tip] = findTips(text);

	it('меняет только заданное', () => {
		expect(setTip(text, tip, {tip: 'новая'})).toBe('до <<hovertip "новая" 300>>на экране<</hovertip>> после');
		expect(setTip(text, tip, {width: 0})).toBe('до <<hovertip "старая">>на экране<</hovertip>> после');
		expect(setTip(text, tip, {content: 'другое'})).toBe('до <<hovertip "старая" 300>>другое<</hovertip>> после');
	});

	it('кавычки и перевод строки в подсказке читаются обратно', () => {
		const next = setTip(text, tip, {tip: 'первая "строка"\nвторая'});

		expect(findTips(next)[0].tip).toBe('первая "строка"\nвторая');
	});

	it('убирает команду, текст на экране остаётся', () => {
		expect(removeTip(text, tip)).toBe('до на экране после');
	});
});

describe('wrapTip', () => {
	it('оборачивает выделенное и оставляет его выделенным', () => {
		const edit = wrapTip('раз два три', 4, 7, 'текст', 'Подсказка');

		expect(edit.insert).toBe('<<hovertip "Подсказка">>два<</hovertip>>');
		expect(edit.insert.slice(edit.selFrom - 4, edit.selTo - 4)).toBe('два');
	});

	it('без выделения вставляет образец', () => {
		expect(wrapTip('раз', 3, 3, 'текст', 'Подсказка').insert).toBe('<<hovertip "Подсказка">>текст<</hovertip>>');
	});
});

describe('moveTemplateTips', () => {
	const script = fixture('template-tip-script.txt');
	const style = fixture('template-tip-style.txt');

	it('убирает код шаблона, узнанный целиком', () => {
		const moved = moveTemplateTips(`до\n${script}\nпосле`, `а\n${style}\nб`);

		expect(moved.script).toBe(`до\n${tipMovedNote}\nпосле`);
		expect(moved.stylesheet).toBe(`а\n${tipStyleNote}\nб`);
	});

	it('понимает переводы строк Windows', () => {
		expect(moveTemplateTips(script.replace(/\n/g, '\r\n'), '').script).toBe(tipMovedNote);
	});

	it('изменённый код остаётся как есть, скрипт и стили — независимо', () => {
		const own = script.replace('- 6)', '- 7)');
		const moved = moveTemplateTips(own, style);

		expect(moved.script).toBe(own);
		expect(moved.stylesheet).toBe(tipStyleNote);
	});

	it('повторный перенос ничего не меняет', () => {
		const once = moveTemplateTips(script, style);

		expect(moveTemplateTips(once.script, once.stylesheet)).toEqual(once);
	});
});

describe('вид подсказки', () => {
	it('значения по умолчанию — как в стилях автора', () => {
		const css = tipCss(defaultAppearance).join('\n');

		expect(css).toContain('--sg-tip-bg: #000000;');
		expect(css).toContain('--sg-tip-color: #00cc00;');
		expect(css).toContain('--sg-tip-border: 2px;');
		expect(css).toContain('--sg-tip-radius: 6px;');
		expect(css).toContain('--sg-tip-width: 333px;');
		expect(css).not.toContain('--sg-tip-size');
		expect(css).not.toContain('--sg-tip-font');
	});

	it('шрифт файлом и размер', () => {
		const css = tipCss({...defaultAppearance, tipFont: 'media/fonts/a.woff2', tipSize: 30}).join('\n');

		expect(css).toContain('@font-face');
		expect(css).toContain('--sg-tip-size: 30px;');
	});

	it('история без этих настроек получает значения по умолчанию, плохой цвет отбрасывается', () => {
		const a = sanitizeAppearance({tipBg: 'нет', tipRadius: 9});

		expect(a.tipBg).toBe('#000000');
		expect(a.tipRadius).toBe(9);
		expect(a.tipColor).toBe('#00cc00');
	});
});
