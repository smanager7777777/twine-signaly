import {readFileSync} from 'fs';
import {join} from 'path';
import {
	comboFromKey,
	duplicateCombos,
	findKeys,
	hasTemplateKeys,
	keysHeader,
	keysMovedNote,
	normalCombo,
	readKeys,
	templateKeys,
	validCombo,
	writeKey,
	writeKeys
} from '../signaly-keys';

const labels = {newgame: 'Новая игра', alarm: 'Закрыть экран тревоги'};

/** Код горячих клавиш шаблона до переноса (сборка 12). */
function oldScript() {
	return readFileSync(join(__dirname, 'fixtures/template-keys.txt'), 'utf8');
}

describe('горячие клавиши', () => {
	it('комбинации', () => {
		expect(normalCombo(' shift + z + a ')).toBe('Shift+Z+A');
		expect(validCombo('Shift+Z+1')).toBe(true);
		expect(validCombo('Shift+Z+Z')).toBe(false);
		expect(validCombo('Ctrl+W')).toBe(false);
		expect(comboFromKey('KeyQ', true, true)).toBe('Shift+Z+Q');
		expect(comboFromKey('Digit5', true, true)).toBe('Shift+Z+5');
		expect(comboFromKey('KeyQ', false, true)).toBeUndefined();
		expect(comboFromKey('KeyQ', true, false)).toBeUndefined();
		expect(duplicateCombos([{combo: 'Shift+Z+A'}, {combo: 'shift+z+a'}, {combo: 'Shift+Z+B'}])).toEqual(['Shift+Z+A']);
	});

	it('разбор и запись строки таблицы', () => {
		const text =
			'<<sg-key "Shift+Z+C" "Глава 2" goto "Start" ask>>\n<<set $chapter to 2>>\n<<sg-sound "media/audio/a.wav" volume 50>>\n<</sg-key>>';
		const [key] = findKeys(text);

		expect(key).toMatchObject({combo: 'Shift+Z+C', label: 'Глава 2', goto: 'Start', ask: true, multiline: true});
		expect(key.actions.map(a => a.type)).toEqual(['set', 'signal']);
		expect(writeKey(key)).toBe(text);
		expect(writeKey({...key, raw: undefined})).toBe(text.replace(' goto "Start" ask', ' goto "Start" ask'));
		expect(writeKey({...key, raw: undefined, ask: false, goto: ''})).toBe(
			'<<sg-key "Shift+Z+C" "Глава 2">>\n<<set $chapter to 2>>\n<<sg-sound "media/audio/a.wav" volume 50>>\n<</sg-key>>'
		);
	});

	it('встроенные — всегда в таблице, их клавиши меняются', () => {
		const keys = readKeys('');

		expect(keys.map(k => [k.builtin, k.combo])).toEqual([
			['newgame', 'Shift+Z+N'],
			['alarm', 'Shift+Z+X']
		]);

		const text = writeKeys('', [{...keys[0], combo: 'Shift+Z+M'}, keys[1]], labels);

		expect(text.startsWith(keysHeader)).toBe(true);
		expect(text).toContain('<<sg-key "Shift+Z+M" "Новая игра" builtin newgame>><</sg-key>>');
		expect(readKeys(text).map(k => k.combo)).toEqual(['Shift+Z+M', 'Shift+Z+X']);
		// Повторная запись ничего не меняет.
		expect(writeKeys(text, readKeys(text), labels)).toBe(text);
	});

	it('свой текст пассажа сохраняется, удалённые строки уходят', () => {
		const text = 'Мой текст\n<<sg-key "Shift+Z+A" "А">><<set $a to 1>><</sg-key>>\n<<sg-key "Shift+Z+B" "Б">><</sg-key>>';
		const keys = readKeys(text).filter(k => k.combo !== 'Shift+Z+A');
		const next = writeKeys(text, keys, labels);

		expect(next.startsWith('Мой текст\n')).toBe(true);
		expect(next).not.toContain('"А"');
		expect(next).toContain('<<sg-key "Shift+Z+B" "Б">><</sg-key>>');
	});

	it('шаблон: Shift+Z+A/B/C переносятся в таблицу', () => {
		const script = oldScript();

		expect(hasTemplateKeys(script)).toBe(true);

		const moved = templateKeys(script)!;

		expect(moved).toBeDefined();
		expect(moved.script).not.toContain('Горячие клавиши мастера ===');
		expect(moved.script).toBe(
			script.replace(/\/\* ===== Горячие[^]*\}\)\(\);\n/, keysMovedNote + '\n')
		);
		expect(moved.keys.map(k => [k.combo, k.label, k.goto])).toEqual([
			['Shift+Z+A', 'Мастерское сообщение', ''],
			['Shift+Z+B', 'Переход на gotoPSG', 'gotoPSG'],
			['Shift+Z+C', 'Звук radiovinyl', '']
		]);
		expect(moved.keys[0].actions).toEqual([
			{type: 'dialog', title: 'Мастерское сообщение', passage: 'showPSGinfo', text: '', close: ''},
			{type: 'signal', src: 'media/audio/msgsoundA.wav', volume: 100, keep: false}
		]);
		expect(moved.keys[1].actions).toEqual([{type: 'signal', src: 'media/audio/click3.wav', volume: 100, keep: false}]);
		// C — без «currentTime = 0»: повторное нажатие не начинает звук заново.
		expect(moved.keys[2].actions).toEqual([{type: 'signal', src: 'media/audio/radiovinyl.wav', volume: 100, keep: true}]);

		const text = writeKeys('', [...readKeys(''), ...moved.keys], labels);

		expect(text).toContain(
			'<<sg-key "Shift+Z+A" "Мастерское сообщение">>\n<<sg-open "Мастерское сообщение" passage "showPSGinfo">><</sg-open>>\n<<sg-sound "media/audio/msgsoundA.wav" volume 100>>\n<</sg-key>>'
		);
		expect(text).toContain('<<sg-key "Shift+Z+B" "Переход на gotoPSG" goto "gotoPSG">>\n<<sg-sound "media/audio/click3.wav" volume 100>>\n<</sg-key>>');
		expect(text).toContain('<<sg-key "Shift+Z+C" "Звук radiovinyl">>\n<<sg-sound "media/audio/radiovinyl.wav" volume 100 keep>>\n<</sg-key>>');
	});

	it('изменённый код шаблона не трогается', () => {
		const script = oldScript();

		expect(templateKeys(script.replace("Engine.play(\"gotoPSG\");", 'Engine.play("gotoPSG"); alert(1);'))).toBeUndefined();
		expect(templateKeys(script.replace("zPressed = false;\n        }", 'zPressed = false; foo();\n        }'))).toBeUndefined();
	});
});
