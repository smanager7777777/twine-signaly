// «Twine СИГНАЛЫ»: запись истории с переносом старых «кнопок на экране» в
// элементы (сессия 6). Вызывается везде, где ставится свежий движок: окна
// оформления и видов («Сохранить») и панель над текстом (первый блок).
// Шаг 2.3: заодно таймеры и иллюминатор шаблона становятся блоками.

import {
	Story,
	StoriesDispatch,
	updatePassage,
	updateStory
} from '../store/stories';
import {upgradePlaces} from '../util/signaly/signaly-places';
import {moveTemplateTimers} from '../util/signaly/signaly-timers';

/** Записывает изменения истории; возвращает, сколько кнопок на экране перенесено. */
export function saveStoryWithUpgrade(
	dispatch: StoriesDispatch,
	stories: Story[],
	story: Story,
	changes: Partial<Pick<Story, 'script' | 'stylesheet'>>,
	/** Пассаж, открытый в редакторе: его текст сейчас правит автор. */
	exclude?: string
) {
	const stylesheet = changes.stylesheet ?? story.stylesheet;
	const upgrade = upgradePlaces(stylesheet, story.passages);
	const texts = new Map(story.passages.map(p => [p, p.text]));

	upgrade?.passages.forEach(({passage, text}) => texts.set(passage, text));

	const timers = moveTemplateTimers(
		changes.script ?? story.script,
		story.passages.map(p => ({name: p.name, text: texts.get(p)!})),
		exclude
	);

	timers.texts.forEach((text, index) => texts.set(story.passages[index], text));
	dispatch(
		updateStory(stories, story, {
			...changes,
			...(timers.script !== (changes.script ?? story.script) ? {script: timers.script} : {}),
			stylesheet: upgrade ? upgrade.stylesheet : stylesheet
		})
	);
	story.passages.forEach(passage => {
		const text = texts.get(passage)!;

		if (text !== passage.text) {
			dispatch(updatePassage(story, passage, {text}));
		}
	});
	return upgrade?.count ?? 0;
}
