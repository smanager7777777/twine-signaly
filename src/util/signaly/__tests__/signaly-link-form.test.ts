import {applyLinkForm, linkFormAt} from '../signaly-link-form';

function apply(text: string, from: number, to = from, form: 'link' | 'button' = 'button', range?: {from: number; to: number}) {
	const edit = applyLinkForm(text, from, to, form, range);

	if (!edit) {
		return undefined;
	}

	const result = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

	return {text: result, sel: result.slice(edit.selFrom, edit.selTo), selFrom: edit.selFrom};
}

describe('ссылка ↔ кнопка', () => {
	it('<<link>> под курсором становится <<button>> и обратно', () => {
		const text = '<span class="amber"><<link "ВКЛ">>\n<<audio "a" play>>\n<</link>></span>';
		const at = text.indexOf('ВКЛ');

		expect(linkFormAt(text, at, at)).toBe('link');

		const made = apply(text, at)!;

		expect(made.text).toBe(
			'<span class="amber"><<button "ВКЛ">>\n<<audio "a" play>>\n<</button>></span>'
		);
		expect(linkFormAt(made.text, made.selFrom, made.selFrom)).toBe('button');
		expect(apply(made.text, made.selFrom, made.selFrom, 'link')!.text).toBe(text);
	});

	it('вложенные <<link>> внутри кнопки не путают закрывающую команду', () => {
		const text = '<<link "A">><<link "B">><</link>><</link>> хвост';

		expect(apply(text, 3)!.text).toBe('<<button "A">><<link "B">><</link>><</button>> хвост');
	});

	it('[[Текст|Экран]] с кодом становится кнопкой, кнопка без кода — снова [[…]]', () => {
		const text = 'x [[ВКЛ|Start][$buttoner to 1]] y';
		const made = apply(text, 5)!;

		expect(made.text).toBe('x <<button "ВКЛ" "Start">><<set $buttoner to 1>><</button>> y');
		expect(apply(made.text, 5, 5, 'link')!.text).toBe(text);
		expect(apply('[[Clocks]]', 3)!.text).toBe('<<button "Clocks" "Clocks">><</button>>');
		expect(apply('<<button "Clocks" "Clocks">><</button>>', 3, 3, 'link')!.text).toBe('[[Clocks]]');
		expect(apply('[[Назад->Start]]', 3)!.text).toBe('<<button "Назад" "Start">><</button>>');
		expect(apply('[[Start<-Назад]]', 3)!.text).toBe('<<button "Назад" "Start">><</button>>');
	});

	it('кавычки в тексте ссылки', () => {
		expect(apply('[[Сказал "да"|P]]', 3)!.text).toBe(`<<button 'Сказал "да"' "P">><</button>>`);
	});

	it('кнопка со своим кодом остаётся командой <<link>>', () => {
		expect(apply('<<button "A" "P">><<audio "x" play>><</button>>', 3, 3, 'link')!.text).toBe(
			'<<link "A" "P">><<audio "x" play>><</link>>'
		);
	});

	it('окно-сообщение: галочка «кнопкой»', () => {
		const text = '<<sg-dialog "Надпись" title "З">>текст<</sg-dialog>>';
		const made = apply(text, 5)!;

		expect(made.text).toBe('<<sg-dialog "Надпись" title "З" button>>текст<</sg-dialog>>');
		expect(linkFormAt(made.text, 5, 5)).toBe('button');
		expect(apply(made.text, 5, 5, 'link')!.text).toBe(text);
	});

	it('в обёртке вида без выделения — все её элементы; выделение — только выделенные', () => {
		const text = '<span class="red-big">[[A|P]] и <<link "B">><</link>></span> [[C|Q]]';
		const range = {from: text.indexOf('>') + 1, to: text.indexOf('</span>')};
		const at = text.indexOf(' и ') + 1;

		expect(linkFormAt(text, at, at, range)).toBe('link');
		expect(apply(text, at, at, 'button', range)!.text).toBe(
			'<span class="red-big"><<button "A" "P">><</button>> и <<button "B">><</button>></span> [[C|Q]]'
		);

		const sel = apply(text, 0, text.length)!;

		expect(sel.text).toContain('<<button "C" "Q">>');
		expect(linkFormAt('просто текст', 3, 3)).toBeUndefined();
		expect(linkFormAt('[[A]] <<button "B">><</button>>', 0, 30)).toBe('');
	});

	it('уже нужный вид — правки нет', () => {
		expect(applyLinkForm('<<button "A">><</button>>', 3, 3, 'button')).toBeUndefined();
	});

	it('<<link [[…]]>> — меняется команда, а не разметка внутри', () => {
		expect(apply('<<link [[A|P]]>><</link>>', 10)!.text).toBe('<<button [[A|P]]>><</button>>');
	});
});
