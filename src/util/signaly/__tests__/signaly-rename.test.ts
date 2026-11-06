import {renameScreen} from '../signaly-rename';

const rename = (text: string, from = 'Старый', to = 'Новый экран') => renameScreen(text, from, to);

describe('переименование экрана в командах', () => {
	it.each([
		['<<link "Надпись" "Старый">><</link>>', '<<link "Надпись" "Новый экран">><</link>>'],
		['<<button "Надпись" "Старый">><</button>>', '<<button "Надпись" "Новый экран">><</button>>'],
		['<<goto "Старый">>', '<<goto "Новый экран">>'],
		['<<include "Старый">>', '<<include "Новый экран">>'],
		['<<sg-timer "Т" seconds 5 goto "Старый">>', '<<sg-timer "Т" seconds 5 goto "Новый экран">>'],
		['<<sg-alarm close time goto "Старый">>x<</sg-alarm>>', '<<sg-alarm close time goto "Новый экран">>x<</sg-alarm>>'],
		['<<sg-chain goto "Старый">>', '<<sg-chain goto "Новый экран">>'],
		['<<sg-case "1" goto "Старый">>', '<<sg-case "1" goto "Новый экран">>'],
		['<<sg-wrong passage "Старый">>', '<<sg-wrong passage "Новый экран">>'],
		['<<sg-dialog "Н" passage "Старый">><</sg-dialog>>', '<<sg-dialog "Н" passage "Новый экран">><</sg-dialog>>'],
		['<<sg-open "Н" passage "Старый">><</sg-open>>', '<<sg-open "Н" passage "Новый экран">><</sg-open>>'],
		['<<sg-key "Shift+Z+A" "П" goto "Старый">><</sg-key>>', '<<sg-key "Shift+Z+A" "П" goto "Новый экран">><</sg-key>>'],
		['<<sg-entry "1" "П" goto "Старый">><</sg-entry>>', '<<sg-entry "1" "П" goto "Новый экран">><</sg-entry>>'],
		['<<sg-access lock "Старый">>$a<</sg-access>>', '<<sg-access lock "Новый экран">>$a<</sg-access>>'],
		['<<sg-rule link "Н" from "Старый" do block to "Старый">>', '<<sg-rule link "Н" from "Новый экран" do block to "Новый экран">>'],
		['<<sg-rule auto "alarm:Старый" do stay>>', '<<sg-rule auto "alarm:Новый экран" do stay>>'],
		['<<sg-rule auto "chain:Старый" do stay>>', '<<sg-rule auto "chain:Новый экран" do stay>>'],
		['<<sg-ticker screen "Старый" height 48>>', '<<sg-ticker screen "Новый экран" height 48>>'],
		['<<if setup.visits("Старый") gt 0>>да<</if>>', '<<if setup.visits("Новый экран") gt 0>>да<</if>>'],
		['<<sg-event setup.visits(\'Старый\') is 0>>', '<<sg-event setup.visits("Новый экран") is 0>>']
	])('%s', (before, after) => {
		expect(rename(before)).toBe(after);
	});

	it('только это имя и только на местах экрана', () => {
		[
			'<<link "Старый" "Другой">><</link>>',
			'<<sg-timer "Старый" seconds 5 goto "Другой">>',
			'<<sg-entry "Старый" "Старый">><</sg-entry>>',
			'<<sg-cycle from "Старый" to "Старый">>',
			'<<set $x to "Старый">>',
			'Старый экран в тексте',
			'<<sg-dialog "Н" title "goto" ok "Старый">><</sg-dialog>>'
		].forEach(text => expect(rename(text)).toBe(text));
	});

	it('переменная не считается именем', () => {
		expect(renameScreen('<<include _prcd>><<goto $x>>', '_prcd', 'Новый')).toBe('<<include _prcd>><<goto $x>>');
	});

	it('несколько мест одного текста и кавычки в новом имени', () => {
		expect(rename('<<goto "Старый">> и <<goto "Старый">>', 'Старый', 'А"Б')).toBe('<<goto "А\\"Б">> и <<goto "А\\"Б">>');
	});

	it('имя со знаками регулярных выражений', () => {
		expect(renameScreen('<<goto "a.b$">><<goto "aXb$">>', 'a.b$', 'c')).toBe('<<goto "c">><<goto "aXb$">>');
	});
});
