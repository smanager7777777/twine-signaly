import {readFileSync} from 'fs';
import {join} from 'path';
import {
	appearanceBlock,
	appearanceMarkers,
	defaultAppearance,
	dialogFromAuthor,
	engineVersionIn,
	hasAuthorKr2,
	kr2MovedNote,
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
		const css =
			'/* c */ body { color: red; /* x */ margin: 0 }\n@keyframes f { 0% { opacity: 1; } }\na:hover{color:#fff}';
		const rules = topLevelRules(css);

		expect(rules.map(r => r.selector)).toEqual([
			'body',
			'@keyframes f',
			'a:hover'
		]);
		expect(declarations(css, rules[0]).map(d => [d.property, d.value])).toEqual(
			[
				['color', 'red'],
				['margin', '0']
			]
		);
	});
});

// Стили шаблона автора до переноса (как в 27_03_2025.twee до шага 1.2).
const originalCss = `body {
      background-color: #000000;
  color: #00cc00;
    font-family: "Courier New", monospace;
    margin: 0;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
      animation: flicker 0.1s infinite;
    position: relative;
     font-size: 25px;
}

a {
    color: #00cc00;
    text-decoration: none
}

#passages {
      background-color: #000000;
  border: 2px solid #00cc00;
    box-shadow: 0 0 10px #00cc00, 0 0 20px #00cc00;
    width: 1050px;
    height: 1050px;
    padding: 20px;
    box-sizing: border-box;
    overflow: auto;
}

.ui-dialog-body {
    color: #00cc00;
     font-size: 25px;
}

@keyframes
 flicker {
    0% { opacity: 1; }
    50% { opacity: 0.95; }
    100% { opacity: 1; }
}

#passages.kr2-layout {
    padding: 0;
}`;

describe('migrateStylesheet() on the author template', () => {
	const result = migrateStylesheet(originalCss);

	it('reads the template values', () => {
		expect(result.appearance).toEqual({...defaultAppearance});
		expect(result.moved).toEqual(['body', '#passages', '@keyframes flicker']);
	});

	it('removes moved rules and keeps the rest of the author code', () => {
		expect(result.stylesheet).toBe(`
a {
    color: #00cc00;
    text-decoration: none
}


.ui-dialog-body {
    color: #00cc00;
     font-size: 25px;
}


#passages.kr2-layout {
    padding: 0;
}`);
	});

	it('the template in the repository already has the block', () => {
		expect(readAppearance(templateCss)).toEqual({...defaultAppearance});
		expect(engineVersionIn(templateJs)).toBe(signalyEngineVersion);
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
		const css =
			'body { animation: pulse 2s infinite; }\n@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.2; transform: scale(2); } 100% { opacity: 1; } }';
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

		// Мерцание и эффекты — только на терминале (#story), не на всём экране.
		expect(css).toContain(
			'\toverflow: auto;\n\tanimation: sg-flicker 0.1s infinite;\n}'
		);
		expect(css.split('#passages {')[0]).not.toContain('animation');
		expect(css).toContain('50% { opacity: 0.95; }');
		expect(css).toContain('--sg-font: "Courier New", monospace;');
		expect(css).not.toContain('body::before');
		expect(css).not.toContain('#sg-fx::before');
		expect(css).toContain('--sg-line-scroll: 0;');
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
		const old =
			'/* ===== СИГНАЛЫ: общие настройки ===== */\nConfig.history.maxStates = 1;\n/* ===== КОНЕЦ: общие настройки ===== */\n\n\nauthor();';
		const once = withEngine(old);

		expect(once).not.toContain('СИГНАЛЫ: общие настройки');
		expect(once).toBe(`${signalyEngineBlock()}\n\n\nauthor();`);
		expect(withEngine(once)).toBe(once);
		expect(engineVersionIn(once)).toBe(signalyEngineVersion);
		expect(engineVersionIn(old)).toBe(0);
	});

	it('is valid JavaScript', () => {
		expect(() => new Function(signalyEngineBlock())).not.toThrow();
	});

	it('prepareStory keeps an existing block untouched', () => {
		const first = prepareStory('author();', originalCss);
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

describe('step 1.4: message windows and KR2 in the engine', () => {
	it('message windows stay standard until turned on', () => {
		expect(appearanceBlock(defaultAppearance)).not.toContain('#ui-dialog');

		const css = appearanceBlock({...defaultAppearance, dialogOn: true});

		expect(css).toContain('#ui-dialog {');
		expect(css).toContain('box-shadow: 0 0 10px #00cc00, 0 0 20px #00cc00;');
		expect(css).toContain('border-bottom: 1px solid #00cc00;');
	});

	it('reads the dead .ui-dialog rules of the template', () => {
		expect(dialogFromAuthor(templateCss)).toEqual({
			dialogBg: '#000000',
			dialogColor: '#00cc00',
			dialogSize: 25,
			dialogBorderWidth: 2,
			dialogBorderColor: '#00cc00',
			dialogGlow: 10,
			dialogTitleBg: '#000000',
			dialogTitleColor: '#00cc00',
			dialogTitleSize: 25,
			dialogTitleLine: 1
		});
		expect(dialogFromAuthor('body { color: red; }')).toEqual({});
	});

	it('the engine takes over the KR2 code of the template', () => {
		const old =
			'author1();\n/* ===== KR2 INTERFACE ===== */\n(function() {\n    Macro.add(\'kr2image\', {});\n})();\n/* ===== END KR2 INTERFACE ===== */\nauthor2();';

		expect(hasAuthorKr2(old)).toBe(true);

		const result = withEngine(old);

		expect(result).toContain('author1();\n' + kr2MovedNote + 'author2();');
		expect(hasAuthorKr2(result)).toBe(false);
		expect(hasAuthorKr2(templateJs)).toBe(false);
		expect(templateJs).toContain(kr2MovedNote.trim());
	});
});
