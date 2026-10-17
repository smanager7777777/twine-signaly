import {readFileSync} from 'fs';
import {join} from 'path';
import {
	appearanceBlock,
	appearanceMarkers,
	defaultAppearance,
	engineVersionIn,
	migrateStylesheet,
	prepareStory,
	readAppearance,
	sanitizeAppearance,
	withAppearance,
	withEngine
} from '../signaly-appearance';
import {findBlock, putBlock} from '../signaly-blocks';
import {declarations, topLevelRules} from '../signaly-css';
import {signalyEngineBlock, signalyEngineVersion} from '../signaly-engine';
import {folderToFileUrl, previewHtml} from '../signaly-preview';

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
const templateJs = section('StoryScript');

describe('signaly-blocks', () => {
	const markers = {start: '/* S */', end: '/* E */'};

	it('puts a block on top when there is none', () => {
		expect(putBlock('\n\nauthor();', markers, '/* S */x/* E */')).toBe(
			'/* S */x/* E */\n\n\nauthor();'
		);
	});

	it('replaces an existing block and keeps the rest', () => {
		const source = 'a();\n/* S */old/* E */\nb();';

		expect(putBlock(source, markers, '/* S */new/* E */')).toBe(
			'a();\n/* S */new/* E */\nb();'
		);
		expect(findBlock(source, markers)?.inner).toBe('old');
	});
});

describe('signaly-css', () => {
	it('finds top-level rules, at-rules and declarations', () => {
		const css = '/* c */ body { color: red; /* x */ margin: 0 }\n@keyframes f { 0% { opacity: 1; } }\na:hover{color:#fff}';
		const rules = topLevelRules(css);

		expect(rules.map(r => r.selector)).toEqual([
			'body',
			'@keyframes f',
			'a:hover'
		]);
		expect(
			declarations(css, rules[0]).map(d => [d.property, d.value])
		).toEqual([
			['color', 'red'],
			['margin', '0']
		]);
	});
});

describe('migrateStylesheet() on the author template', () => {
	const result = migrateStylesheet(templateCss);

	it('reads the template values', () => {
		expect(result.appearance).toEqual({...defaultAppearance});
		expect(result.moved).toEqual(['body', '#passages', '@keyframes flicker']);
	});

	it('removes moved rules and keeps the rest of the author code', () => {
		const rules = topLevelRules(result.stylesheet).map(r => r.selector);

		expect(rules).not.toContain('body');
		expect(rules).not.toContain('#passages');
		expect(rules).not.toContain('@keyframes flicker');
		expect(rules).toContain('#passages.kr2-layout');
		expect(rules).toContain('.ui-dialog');
		expect(rules).toContain('@keyframes noise-animY');
		// Окна-сообщения не трогаются (ответ автора 5б).
		expect(result.stylesheet).toContain(
			'.ui-dialog-body {\n    color: #00cc00;\n     font-size: 25px;\n}'
		);
	});

	it('keeps declarations it does not understand', () => {
		const migrated = migrateStylesheet(
			'body { color: #111; cursor: crosshair; }\n#passages { width: 50%; height: 600px; }'
		);

		expect(migrated.appearance.textColor).toBe('#111111');
		expect(migrated.appearance.winHeight).toBe(600);
		expect(migrated.appearance.flicker).toBe(false);
		expect(migrated.stylesheet).toBe(
			'body { cursor: crosshair; }\n#passages { width: 50%; }'
		);
	});

	it('leaves a foreign animation alone', () => {
		const css = 'body { animation: pulse 2s infinite; }\n@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.2; transform: scale(2); } 100% { opacity: 1; } }';
		const migrated = migrateStylesheet(css);

		expect(migrated.appearance.flicker).toBe(false);
		expect(migrated.stylesheet).toBe(css);
	});
});

describe('appearance block', () => {
	it('round-trips settings through the stylesheet', () => {
		const a = {
			...defaultAppearance,
			textColor: '#ffbf00',
			startText: 'Пуск */ "кавычки"',
			fontFile: 'media/fonts/x.woff2',
			noise: 20,
			savedColors: ['#123456']
		};
		const css = withAppearance('a { color: red; }', a);

		expect(readAppearance(css)).toEqual(a);
		expect(css).toContain('--sg-start-text: "Пуск */ \\"кавычки\\"";');
		expect(css).toContain('@font-face');
		// Повторная запись заменяет блок, а не добавляет второй.
		expect(
			withAppearance(css, defaultAppearance).split(appearanceMarkers.start)
		).toHaveLength(2);
	});

	it('writes the template look exactly', () => {
		const css = appearanceBlock(defaultAppearance);

		expect(css).toContain('animation: sg-flicker 0.1s infinite;');
		expect(css).toContain('50% { opacity: 0.95; }');
		expect(css).toContain('--sg-font: "Courier New", monospace;');
		expect(css).not.toContain('body::before');
		expect(css).not.toContain('position: relative;\n\tleft');
	});

	it('sanitizes damaged data', () => {
		expect(
			sanitizeAppearance({textColor: 'red', fontSize: 'big', flicker: false})
		).toEqual({...defaultAppearance, flicker: false});
	});
});

describe('engine', () => {
	it('replaces the old settings block and is idempotent', () => {
		const once = withEngine(templateJs);

		expect(once).not.toContain('СИГНАЛЫ: общие настройки');
		expect(once.startsWith(signalyEngineBlock())).toBe(true);
		expect(withEngine(once)).toBe(once);
		expect(engineVersionIn(once)).toBe(signalyEngineVersion);
		expect(engineVersionIn(templateJs)).toBe(0);
	});

	it('is valid JavaScript', () => {
		expect(() => new Function(signalyEngineBlock())).not.toThrow();
	});

	it('prepareStory keeps an existing block untouched', () => {
		const first = prepareStory(templateJs, templateCss);
		const second = prepareStory(first.script, first.stylesheet);

		expect(second.moved).toEqual([]);
		expect(second.stylesheet).toBe(first.stylesheet);
		expect(second.script).toBe(first.script);
	});
});

describe('preview', () => {
	it('makes file URLs for Windows and Linux folders', () => {
		expect(folderToFileUrl('C:\\Игры\\СИГНАЛЫ')).toBe(
			'file:///C:/%D0%98%D0%B3%D1%80%D1%8B/%D0%A1%D0%98%D0%93%D0%9D%D0%90%D0%9B%D0%AB/'
		);
		expect(folderToFileUrl('/home/a b/')).toBe('file:///home/a%20b/');
	});

	it('injects base and preview mode into head', () => {
		const html = previewHtml('<html><head><meta></head></html>', {
			baseUrl: 'file:///C:/g/',
			mode: 'start'
		});

		expect(html).toMatch(
			/^<html><head><base href="file:\/\/\/C:\/g\/"><script>window\.SIGNALY_PREVIEW = "start";/
		);
	});
});
