import {readFileSync} from 'fs';
import {
	knownVariables,
	parseLiteral,
	readVariables,
	renameVariable,
	variableUsage,
	withVariables
} from '../signaly-variables';

const init = `<<waitforaudio>>
/* ===== СИГНАЛЫ: звуки — правьте в окне «Звуки» ===== */
<<cacheaudio "a" "media/audio/a.mp3">>
/* ===== СИГНАЛЫ: конец звуков ===== */

<<set $inputCode to "">>
<<set $buttoner to 0>>
<<set $playingtrack to "Ничего">>
<<set $x to $buttoner + 1>>
<<set $twice to 1>>
<<set $twice to 2>>


<<set $terraformrepair to 0>>
`;

describe('окно «Переменные»: StoryInit', () => {
	it('читает простые <<set>>, сложные и повторные оставляет коду', () => {
		const read = readVariables(init);

		expect(read.variables).toEqual([
			{name: 'inputCode', label: '', value: ''},
			{name: 'buttoner', label: '', value: 0},
			{name: 'playingtrack', label: '', value: 'Ничего'},
			{name: 'terraformrepair', label: '', value: 0}
		]);
		expect(read.byCode).toEqual(['twice', 'x']);
	});

	it('переносит их в раздел на место первой, остальной код не трогает', () => {
		const text = withVariables(init, [
			...readVariables(init).variables,
			{name: 'chapter', label: 'Глава', value: 1},
			{name: 'flightlog1', label: 'Журнал полёта 1', value: false}
		]);

		expect(text).toBe(`<<waitforaudio>>
/* ===== СИГНАЛЫ: звуки — правьте в окне «Звуки» ===== */
<<cacheaudio "a" "media/audio/a.mp3">>
/* ===== СИГНАЛЫ: конец звуков ===== */

/* ===== СИГНАЛЫ: переменные — правьте в окне «Переменные» ===== */
<<set $inputCode to "">>
<<set $buttoner to 0>>
<<set $playingtrack to "Ничего">>
<<set $terraformrepair to 0>>
<<set $chapter to 1>> /* Глава */
<<set $flightlog1 to false>> /* Журнал полёта 1 */
/* ===== СИГНАЛЫ: конец переменных ===== */

<<set $x to $buttoner + 1>>
<<set $twice to 1>>
<<set $twice to 2>>


`);

		const again = readVariables(text);

		expect(again.variables[4]).toEqual({name: 'chapter', label: 'Глава', value: 1});
		expect(again.variables[5]).toEqual({name: 'flightlog1', label: 'Журнал полёта 1', value: false});
		// Повторная запись тех же значений ничего не меняет.
		expect(withVariables(text, again.variables)).toBe(text);
	});

	it('пустой StoryInit и удаление всех переменных', () => {
		expect(withVariables('', [{name: 'a', label: '', value: true}])).toBe(
			'/* ===== СИГНАЛЫ: переменные — правьте в окне «Переменные» ===== */\n<<set $a to true>>\n/* ===== СИГНАЛЫ: конец переменных ===== */\n'
		);
		expect(withVariables(withVariables('<<set $b to 2>>', [{name: 'b', label: '', value: 2}]), [])).toBe('');
	});

	it('значения: числа, да-нет, текст с кавычками', () => {
		expect(parseLiteral('-2.5')).toBe(-2.5);
		expect(parseLiteral('true')).toBe(true);
		expect(parseLiteral("'Привет'")).toBe('Привет');
		expect(parseLiteral('"a\\"b"')).toBe('a"b');
		expect(parseLiteral('"a" + "b"')).toBeUndefined();

		const text = withVariables('', [{name: 't', label: '', value: 'Сказал "да"'}]);

		expect(readVariables(text).variables[0].value).toBe('Сказал "да"');
	});

	it('где используется, переименование, список для форм', () => {
		const passages = [
			{name: 'Start', text: 'Глава: $chapter. <<if $chapters>>…<</if>>'},
			{name: 'Архив', text: '<<set $chapter to $chapter + 1>>'},
			{name: 'StoryInit', text: '<<set $chapter to 1>> /* Глава */'}
		];

		expect(variableUsage('chapter', passages.slice(0, 2), 'State.variables.chapter = 2;', 'JS')).toEqual(['Start', 'Архив', 'JS']);
		expect(renameVariable(passages[1].text, 'chapter', 'glava')).toBe('<<set $glava to $glava + 1>>');
		expect(renameVariable('State.variables.chapter; $chapters', 'chapter', 'g')).toBe('State.variables.g; $chapters');
		expect(knownVariables([...passages, {name: 'X', text: '$sgTimers $z'}])).toEqual([
			{name: 'chapter', label: 'Глава', type: 'number'},
			{name: 'chapters', label: ''},
			{name: 'z', label: ''}
		]);
	});

	it('StoryInit шаблона: все начальные значения сохраняются', () => {
		const twee = readFileSync('signaly/template/27_03_2025.twee', 'utf8');
		const text = /:: StoryInit[^\n]*\n([^]*?)\n:: /.exec(twee)![1];
		const read = readVariables(text);
		const after = withVariables(text, read.variables);
		const sets = (s: string) => (s.match(/<<set [^>]*>>/g) ?? []).sort();

		expect(read.variables.length).toBeGreaterThan(5);
		expect(sets(after)).toEqual(sets(text));
		expect(after.replace(/<<set [^>]*>>|\/\*[^]*?\*\/|\s/g, '')).toBe(text.replace(/<<set [^>]*>>|\/\*[^]*?\*\/|\s/g, ''));
	});
});
