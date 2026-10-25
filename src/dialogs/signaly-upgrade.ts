// «Twine СИГНАЛЫ»: запись истории с переносом старых «кнопок на экране» в
// элементы (сессия 6). Вызывается везде, где ставится свежий движок: окна
// оформления и видов («Сохранить») и панель над текстом (первый блок).
// Шаг 2.3: заодно таймеры и иллюминатор шаблона становятся блоками.
// Шаг 3.2: окна <<script>>Dialog.create…<</script>> в ссылках — действием <<sg-open>>.
// Шаг 3.3: код горячих клавиш шаблона (Shift+Z+A/B/C) — пассажем «Горячие клавиши».

import {
	Story,
	StoriesDispatch,
	updatePassage,
	updateStory
} from '../store/stories';
import {upgradePlaces} from '../util/signaly/signaly-places';
import {moveTemplateTimers} from '../util/signaly/signaly-timers';
import {moveScriptDialogs} from '../util/signaly/signaly-actions';
import {freeSpot, keysPassageName, keysTag, moveTemplateKeys} from '../util/signaly/signaly-keys';

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
	// Шаг 3.2: окна-сообщения, открытые кодом <<script>> в ссылках, → <<sg-open>>.
	story.passages.forEach(passage => {
		if (passage.name !== exclude) {
			texts.set(passage, moveScriptDialogs(texts.get(passage)!));
		}
	});
	// Шаг 3.3: горячие клавиши шаблона → пассаж «Горячие клавиши».
	const keys = moveTemplateKeys(timers.script, story.passages);
	const script = keys ? keys.script : timers.script;

	dispatch(
		updateStory(stories, story, {
			...changes,
			...(script !== (changes.script ?? story.script) ? {script} : {}),
			stylesheet: upgrade ? upgrade.stylesheet : stylesheet
		})
	);
	if (keys) {
		dispatch({
			type: 'createPassage',
			storyId: story.id,
			props: {name: keysPassageName, story: story.id, tags: [keysTag], text: keys.text, ...freeSpot(story.passages)}
		});
	}
	story.passages.forEach(passage => {
		const text = texts.get(passage)!;

		if (text !== passage.text) {
			dispatch(updatePassage(story, passage, {text}));
		}
	});
	return upgrade?.count ?? 0;
}
