import {parseAction, writeAction} from '../signaly-actions';
import {
	codesHeader,
	defaultTexts,
	duplicates,
	needsPin,
	newEntry,
	newPerson,
	readCodes,
	writeCodes,
	writeEntry
} from '../signaly-codes';

const sample = `/* мой комментарий */
<<sg-replies title "Ошибка" wrong "Неверный код" denied "Нет доступа" badpin "Неверный личный код" used "Пусто" ask "Введите личный код">>
<<sg-person "3" pin "417" var "$progress3">>
<<sg-person "Иванов" pin "101">>
<<sg-entry "205" "Препарат" who "3, Иванов" once each title "Медблок" goto "Start" used "Уже принят">>
<<sg-progress 1>>
<<set $med to true>>
<<sg-answer>>Сотрудник <<= _who>>, откройте конверт 3-2
<</sg-entry>>
<<sg-entry "777" "Сирена">><<sg-sound "media/audio/siren.wav" volume 80>><</sg-entry>>`;

describe('общая таблица кодов (шаг 3.4)', () => {
	it('читает сотрудников, коды и общие тексты', () => {
		const table = readCodes(sample);

		expect(table.people.map(p => [p.id, p.pin, p.variable])).toEqual([
			['3', '417', 'progress3'],
			['Иванов', '101', '']
		]);
		expect(table.texts).toEqual(defaultTexts);

		const [med, siren] = table.codes;

		expect(med).toMatchObject({
			code: '205',
			label: 'Препарат',
			who: ['3', 'Иванов'],
			once: 'each',
			title: 'Медблок',
			goto: 'Start',
			used: 'Уже принят',
			answer: 'Сотрудник <<= _who>>, откройте конверт 3-2'
		});
		expect(med.actions.map(a => a.type)).toEqual(['progress', 'set']);
		expect(siren).toMatchObject({code: '777', who: [], once: '', answer: ''});
		expect(siren.actions[0]).toMatchObject({type: 'signal', src: 'media/audio/siren.wav', volume: 80});
	});

	it('без правок записывает текст дословно', () => {
		expect(writeCodes(sample, readCodes(sample))).toBe(sample);
	});

	it('правка переписывает только изменённую строку; свой текст пассажа остаётся', () => {
		const table = readCodes(sample);
		const next = {
			...table,
			codes: [{...table.codes[0], once: 'all' as const, raw: undefined}, table.codes[1]],
			people: [...table.people, {...newPerson(table.people), pin: '555'}]
		};
		const text = writeCodes(sample, next);

		expect(text.startsWith('/* мой комментарий */\n<<sg-replies')).toBe(true);
		expect(text).toContain('<<sg-entry "205" "Препарат" who "3, Иванов" once all title "Медблок" goto "Start" used "Уже принят">>\n<<sg-progress 1>>\n<<set $med to true>>\n<<sg-answer>>Сотрудник <<= _who>>, откройте конверт 3-2\n<</sg-entry>>');
		expect(text).toContain('<<sg-person "4" pin "555" var "$progress4">>');
		expect(text).toContain('<<sg-entry "777" "Сирена">><<sg-sound "media/audio/siren.wav" volume 80>><</sg-entry>>');

		const again = readCodes(text);

		expect(again.codes[0].once).toBe('all');
		expect(again.codes[0].answer).toBe(table.codes[0].answer);
		expect(again.people).toHaveLength(3);
	});

	it('новый пассаж — с пояснением и общими текстами', () => {
		const text = writeCodes('', {
			people: [{id: '1', pin: '111', variable: 'progress1', extra: []}],
			codes: [{...newEntry(), code: '42', label: 'Тест', answer: 'Готово', multiline: false}],
			texts: {...defaultTexts, used: 'Код уже использован'}
		});

		expect(text.startsWith(codesHeader)).toBe(true);
		expect(text).toContain('<<sg-replies title "Ошибка" wrong "Неверный код" denied "Нет доступа" badpin "Неверный личный код" used "Код уже использован" ask "Введите личный код">>');
		expect(text).toContain('<<sg-person "1" pin "111" var "$progress1">>');
		expect(text).toContain('<<sg-entry "42" "Тест">><<sg-answer>>Готово<</sg-entry>>');
		expect(readCodes(text).codes[0]).toMatchObject({code: '42', answer: 'Готово', actions: []});
	});

	it('личный код нужен, когда коду важно, кто вводит', () => {
		const base = {...newEntry(), code: '1'};

		expect(needsPin(base)).toBe(false);
		expect(needsPin({...base, who: ['3']})).toBe(true);
		expect(needsPin({...base, once: 'all'})).toBe(false);
		expect(needsPin({...base, once: 'each'})).toBe(true);
		expect(needsPin({...base, answer: 'Сотрудник <<= _who>>'})).toBe(true);
		expect(needsPin({...base, actions: [{type: 'if', expr: '$x', then: [{type: 'progress', amount: 2}], multiline: false}]})).toBe(true);
	});

	it('«Прогресс вводящего +N» — действие <<sg-progress N>>', () => {
		expect(parseAction('<<sg-progress 2>>')).toMatchObject({type: 'progress', amount: 2});
		expect(parseAction('<<sg-progress>>')).toMatchObject({type: 'progress', amount: 1});
		expect(writeAction({type: 'progress', amount: -1})).toBe('<<sg-progress -1>>');
	});

	it('метка «ДЕШИФРАТОР»: читается, пишется, не занимает место подписи', () => {
		const [marked, plainCode, noLabel] = readCodes(
			'<<sg-entry "1" "Блок" decoder goto "Экран" once all>><</sg-entry>>\n<<sg-entry "2" "Конверт">><</sg-entry>>\n<<sg-entry "3" decoder>><</sg-entry>>'
		).codes;

		expect(marked).toMatchObject({code: '1', label: 'Блок', decoder: true, goto: 'Экран', once: 'all', extra: []});
		expect(plainCode.decoder).toBe(false);
		expect(noLabel).toMatchObject({label: '', decoder: true});
		expect(writeEntry({...newEntry(), code: '7', label: 'Блок', decoder: true, goto: 'Э', multiline: false})).toBe(
			'<<sg-entry "7" "Блок" decoder goto "Э">><</sg-entry>>'
		);
	});

	it('когда можно ввести: условие и пассаж блокировки', () => {
		const [early] = readCodes(
			'<<sg-entry "1" "Конверт" lock "Рано">><<set $x to 1>><<sg-answer>>Откройте<<sg-when>>setup.visits("Э") gt 0<</sg-entry>>'
		).codes;

		expect(early).toMatchObject({when: 'setup.visits("Э") gt 0', lock: 'Рано', answer: 'Откройте'});
		expect(early.actions).toHaveLength(1);

		const written = writeEntry({...early, raw: undefined, multiline: false});

		expect(written).toBe('<<sg-entry "1" "Конверт" lock "Рано"><<set $x to 1>><<sg-answer>>Откройте<<sg-when>>setup.visits("Э") gt 0<</sg-entry>>'.replace('"Рано">', '"Рано">>'));
		expect(readCodes(written).codes[0]).toMatchObject({when: 'setup.visits("Э") gt 0', lock: 'Рано', answer: 'Откройте'});
		expect(readCodes('<<sg-entry "2" "Б">><<sg-when>>$a<</sg-entry>>').codes[0]).toMatchObject({when: '$a', answer: ''});
	});

	it('повторы и новые строки', () => {
		expect(duplicates(['1', '2', ' 1', ''])).toEqual(['1']);
		expect(newPerson([{id: '1', pin: '', variable: '', extra: []}])).toMatchObject({id: '2', variable: 'progress2'});
		expect(writeEntry({...newEntry(), code: 'x"y', label: ''})).toBe(`<<sg-entry 'x"y' "">>\n<</sg-entry>>`);
	});
});
