import {sanitizeKinds, withKinds} from '../signaly-kinds';
import {movePlacesInTexts, upgradePlaces} from '../signaly-places';

const places = [
	{id: 'rad', name: 'РАД', corner: 'tr' as const, x: 5, y: 2.75, kind: 'amber'},
	{id: 'e', name: 'E', corner: 'bl' as const, x: 41, y: 449, kind: 'amber'}
];

describe('signaly-places', () => {
	it('кнопки на экране становятся элементами <<sg-place>>', () => {
		const text =
			'<span class="sg-place-rad amber"><<link "РАД">>\n<<set $r to 1>>\n<</link>></span>\\\n' +
			'<span class="sg-place-e"><<link "E">><</link>></span>\n' +
			'<span class="sg-place-zzz">неизвестное место</span>\n' +
			'<span class="sg-place-rad" style="color:red">с другим атрибутом</span>';
		const moved = movePlacesInTexts(['без кнопок', text], places);

		expect(moved.count).toBe(2);
		expect(moved.texts.has(0)).toBe(false);
		expect(moved.texts.get(1)).toBe(
			'<<sg-place kind amber corner tr x 5 y 2.75>><<link "РАД">>\n<<set $r to 1>>\n<</link>><</sg-place>>\\\n' +
				'<<sg-place corner bl x 41 y 449>><<link "E">><</link>><</sg-place>>\n' +
				'<span class="sg-place-zzz">неизвестное место</span>\n' +
				'<span class="sg-place-rad" style="color:red">с другим атрибутом</span>'
		);
	});

	it('вся история: тексты и блок видов без мест', () => {
		const stylesheet = withKinds('', sanitizeKinds({kinds: [], places}));
		const passages = [{text: '<span class="sg-place-rad amber">x</span>'}, {text: 'y'}];
		const upgrade = upgradePlaces(stylesheet, passages)!;

		expect(upgrade.count).toBe(1);
		expect(upgrade.passages).toEqual([
			{passage: passages[0], text: '<<sg-place kind amber corner tr x 5 y 2.75>>x<</sg-place>>'}
		]);
		expect(upgrade.stylesheet).not.toContain('.sg-place-rad');
		expect(upgradePlaces(upgrade.stylesheet, passages)).toBeUndefined();
	});
});
