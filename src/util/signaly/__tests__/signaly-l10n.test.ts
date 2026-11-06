import {readFileSync} from 'fs';
import {signalyEngineBlock} from '../signaly-engine';
import {signalyStrings} from '../signaly-l10n';

// Строки SugarCube — внутри format.js, в исходнике HTML как строка JSON.
function formatStrings() {
	const raw = readFileSync('public/story-formats/sugarcube-2.37.3/format.js', 'utf8');
	const source: string = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).source;
	const from = source.indexOf('l10nStrings={') + 'l10nStrings='.length;
	const to = source.indexOf('}', source.indexOf('shareTitle', from)) + 1;

	return new Function(`return (${source.slice(from, to)})`)() as Record<string, string>;
}

describe('русские служебные надписи SugarCube', () => {
	const english = formatStrings();

	it('переведены все строки SugarCube, лишних нет', () => {
		expect(Object.keys(signalyStrings).sort()).toEqual(Object.keys(english).sort());
	});

	it('все строки по-русски', () => {
		for (const [key, value] of Object.entries(signalyStrings)) {
			expect([key, /[А-Яа-яЁё]/.test(value)]).toEqual([key, true]);
		}
	});

	it('подстановка {passage} сохранена, {textIdentity} заменена словами', () => {
		expect(signalyStrings.errorNonexistentPassage).toContain('{passage}');
		for (const value of Object.values(signalyStrings)) {
			expect(value).not.toContain('{textIdentity}');
		}
	});

	it('надписи попадают в движок', () => {
		expect(signalyEngineBlock()).toContain('Object.assign(l10nStrings, {');
		expect(signalyEngineBlock()).toContain('"restartTitle":"Начать заново"');
	});
});
