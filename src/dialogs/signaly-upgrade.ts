// «Twine СИГНАЛЫ»: запись истории с переносом старых «кнопок на экране» в
// элементы (сессия 6). Вызывается везде, где ставится свежий движок: окна
// оформления и видов («Сохранить») и панель над текстом (первый блок).
// Шаг 2.3: заодно таймеры и иллюминатор шаблона становятся блоками.
// Шаг 3.2: окна <<script>>Dialog.create…<</script>> в ссылках — действием <<sg-open>>.
// Шаг 3.3: код горячих клавиш шаблона (Shift+Z+A/B/C) — пассажем «Горячие клавиши».
// Шаг 5.2: экран «Хактест» шаблона — блоком «Терминал взлома».
// Шаг 5.3: CAMERATEST, XIAOMICAM и код камер шаблона — блоками «Камера».
// Шаг 5.4: код подсказки шаблона — в движок, её вид — в оформление.

import {
	Story,
	StoriesDispatch,
	updatePassage,
	updateStory
} from '../store/stories';
import {upgradePlaces} from '../util/signaly/signaly-places';
import {moveTemplateTimers} from '../util/signaly/signaly-timers';
import {moveScriptDialogs} from '../util/signaly/signaly-actions';
import {moveTemplateCamera} from '../util/signaly/signaly-camera';
import {moveTemplateHack} from '../util/signaly/signaly-hack';
import {moveTemplateTips} from '../util/signaly/signaly-tip';
import {musicPassageName, musicTag} from '../util/signaly/signaly-music';
import {moveTemplateMusic} from '../util/signaly/signaly-music-template';
import {engineVersionIn} from '../util/signaly/signaly-appearance';
import {signalyEngineVersion} from '../util/signaly/signaly-engine';
import {radioPassageName, radioTag} from '../util/signaly/signaly-radio';
import {freeSpot, keysPassageName, keysTag, moveTemplateKeys} from '../util/signaly/signaly-keys';

/** Записывает изменения истории; возвращает, сколько кнопок на экране перенесено. */
export function saveStoryWithUpgrade(
	dispatch: StoriesDispatch,
	stories: Story[],
	story: Story,
	changes: Partial<Pick<Story, 'script' | 'stylesheet'>>,
	/** Пассаж, открытый в редакторе: его текст сейчас правит автор. */
	exclude?: string,
	/** Шаг 7.2: окно «Музыка» или «Радио» сохраняет свой текст новых пассажей вместо шаблонного. */
	own?: {music?: string; radio?: string}
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
			// Шаг 5.2: экран «Хактест» шаблона → блок «Терминал взлома».
			texts.set(passage, moveTemplateHack(moveScriptDialogs(texts.get(passage)!)));
		}
	});
	// Шаг 5.3: камеры шаблона → блоки «Камера».
	const camera = moveTemplateCamera(
		timers.script,
		story.passages.map(p => ({name: p.name, text: texts.get(p)!})),
		exclude
	);

	camera.texts.forEach((text, index) => texts.set(story.passages[index], text));
	// Шаг 7.2: музыка шаблона → общий плеер, пассажи «Музыка» и «Радио».
	const music = moveTemplateMusic(
		story.passages.map(p => ({name: p.name, tags: p.tags, text: texts.get(p)!})),
		exclude
	);

	music?.texts.forEach((text, index) => texts.set(story.passages[index], text));
	// Шаг 3.3: горячие клавиши шаблона → пассаж «Горячие клавиши».
	const keys = moveTemplateKeys(camera.script, story.passages);
	const tips = moveTemplateTips(keys ? keys.script : camera.script, upgrade ? upgrade.stylesheet : stylesheet);
	const {script} = tips;

	dispatch(
		updateStory(stories, story, {
			...changes,
			...(script !== (changes.script ?? story.script) ? {script} : {}),
			stylesheet: tips.stylesheet
		})
	);
	if (music) {
		const first = freeSpot(story.passages);

		dispatch({
			type: 'createPassage',
			storyId: story.id,
			props: {name: musicPassageName, story: story.id, tags: [musicTag], text: own?.music ?? music.music, ...first}
		});
		dispatch({
			type: 'createPassage',
			storyId: story.id,
			props: {
				name: radioPassageName,
				story: story.id,
				tags: [radioTag],
				text: own?.radio ?? music.radio,
				...freeSpot([...story.passages, {...first, width: 100}])
			}
		});
	}
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

/**
 * Шаг 7.2: переведёт ли ближайшая установка движка музыку шаблона (и создаст пассажи
 * «Музыка» и «Радио»). Окна «Музыка» и «Радио» тогда начинают с перенесённого каталога
 * и отдают свой текст в saveStoryWithUpgrade, а не создают пассаж второй раз.
 */
export function pendingTemplateMusic(story: Story) {
	if (engineVersionIn(story.script) >= signalyEngineVersion) {
		return undefined;
	}
	return moveTemplateMusic(story.passages.map(p => ({name: p.name, tags: p.tags, text: p.text})));
}
