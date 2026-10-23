// «Twine СИГНАЛЫ»: запись истории с переносом старых «кнопок на экране» в
// элементы (сессия 6). Вызывается везде, где ставится свежий движок: окна
// оформления и видов («Сохранить») и панель над текстом (первый блок).

import {
	Story,
	StoriesDispatch,
	updatePassage,
	updateStory
} from '../store/stories';
import {upgradePlaces} from '../util/signaly/signaly-places';

/** Записывает изменения истории; возвращает, сколько кнопок на экране перенесено. */
export function saveStoryWithUpgrade(
	dispatch: StoriesDispatch,
	stories: Story[],
	story: Story,
	changes: Partial<Pick<Story, 'script' | 'stylesheet'>>
) {
	const stylesheet = changes.stylesheet ?? story.stylesheet;
	const upgrade = upgradePlaces(stylesheet, story.passages);

	dispatch(
		updateStory(stories, story, {
			...changes,
			stylesheet: upgrade ? upgrade.stylesheet : stylesheet
		})
	);
	upgrade?.passages.forEach(({passage, text}) =>
		dispatch(updatePassage(story, passage, {text}))
	);
	return upgrade?.count ?? 0;
}
