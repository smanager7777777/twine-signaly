import {checkStory, mediaPaths} from '../signaly-check';

const p = (name: string, text: string, tags: string[] = []) => ({name, tags, text});

describe('checkStory', () => {
	it('находит переходы на несуществующие экраны', () => {
		const problems = checkStory({
			passages: [
				p('Start', '[[Есть]] [[Нет]] [[Ход|$куда]] <<link "Х" "Пропал">><</link>> <<sg-open "О" passage "Окно">><</sg-open>> <<include "Кусок">>'),
				p('Есть', '<<if setup.visits("Где") gt 0>>да<</if>>')
			],
			script: '',
			stylesheet: ''
		});

		expect(problems.filter(x => x.kind === 'screen').map(x => x.detail)).toEqual([
			'Нет',
			'Пропал',
			'Окно',
			'Кусок',
			'Где'
		]);
	});

	it('проверяет файлы, только когда папка выбрана', () => {
		const passages = [p('Start', '<<sg-image "media/img/A.jpg">> <img src="media/img/b.jpg"> <<audio "x" play>> "media/other/c.txt" "media/img/$x.jpg"')];
		const input = {passages, script: '/* пример: "media/audio/x.wav" */ new Audio("media/audio/s.wav") // "media/audio/y.wav"', stylesheet: 'body {background: url(media/img/fon.png)}'};

		expect(checkStory(input).filter(x => x.kind === 'media')).toEqual([]);
		expect(
			checkStory({...input, media: ['media/img/a.jpg']})
				.filter(x => x.kind === 'media')
				.map(x => `${x.passage}: ${x.detail}`)
		).toEqual(['Start: media/img/b.jpg', 'JavaScript истории: media/audio/s.wav', 'Таблица стилей: media/img/fon.png']);
	});

	it('находит переменные без начального значения', () => {
		const problems = checkStory({
			passages: [
				p('StoryInit', '<<set $a to 1>>\n<<set $b to $a + 1>>'),
				p('Start', '$a $b $c <<set $sgUsed to {}>> <<if $d>><</if>>')
			],
			script: '',
			stylesheet: ''
		});

		expect(problems.filter(x => x.kind === 'variable').map(x => x.detail)).toEqual(['$c', '$d']);
	});

	it('находит коды без действия, ответа и перехода', () => {
		const problems = checkStory({
			passages: [
				p(
					'Коды',
					'<<sg-entry "100" "Пусто">><</sg-entry>>\n<<sg-entry "200" "Ответ">><<sg-answer>>Привет<</sg-entry>>\n<<sg-entry "300" "Переход" goto "Start">><</sg-entry>>\n<<sg-entry "400" "Действие">><<set $a to 1>><</sg-entry>>',
					['sg-codes']
				),
				p('Start', '')
			],
			script: '',
			stylesheet: ''
		});

		expect(problems.filter(x => x.kind === 'code').map(x => x.detail)).toEqual(['100']);
	});
});

describe('mediaPaths', () => {
	it('понимает кавычки, url() и [img[]], пропускает пути с переменной', () => {
		expect(mediaPaths(`"media/a b (1).wav" url( media/img/x.png ) [img[Подпись|media/img/y.jpg]] 'media/$x.jpg'`)).toEqual([
			'media/a b (1).wav',
			'media/img/x.png',
			'media/img/y.jpg'
		]);
	});
});
