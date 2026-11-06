// «Twine СИГНАЛЫ»: панель форматирования над текстом пассажа (шаг 1.3, ответы
// автора 3а и 5а). Вставляет обычную разметку SugarCube и HTML (см.
// util/signaly/signaly-format.ts), поэтому текст читается и работает в обычном
// Twine. Если курсор стоит внутри оформленного текста, панель показывает, как
// он оформлен (вид, место на экране, выравнивание, цвет, размер).

import {
	IconAlignCenter,
	IconArrowFork,
	IconArticle,
	IconBolt,
	IconLock,
	IconAlignRight,
	IconBold,
	IconClick,
	IconHeading,
	IconItalic,
	IconLayout,
	IconLetterCase,
	IconList,
	IconPalette,
	IconWand,
	IconSquarePlus,
	IconSeparatorHorizontal,
	IconStrikethrough,
	IconTextSize,
	IconUnderline,
	IconWaveSine
} from '@tabler/icons';
import CodeMirror from 'codemirror';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {ButtonBar} from '../../components/container/button-bar';
import {CardButton} from '../../components/control/card-button';
import {IconButton} from '../../components/control/icon-button';
import {MenuButton} from '../../components/control/menu-button';
import {
	Passage,
	setTagColor,
	Story,
	updatePassage,
	updateStory,
	useStoriesContext
} from '../../store/stories';
import {
	defaultAppearance,
	engineVersionIn,
	readAppearance,
	signalyEngineVersion,
	withEngine
} from '../../util/signaly/signaly-appearance';
import {normalizeHex} from '../../util/signaly/signaly-css';
import {ScreenView, tagsWithView, textStyleClass, viewOfTags} from '../../util/signaly/signaly-screens';
import {FirstWay, tagsWithWay, wayOfTags} from '../../util/signaly/signaly-first';
import {
	Align,
	alignAt,
	applyAlign,
	applyKind,
	applyTextStyle,
	Edit,
	enclosingTag,
	insertRule,
	kindAt,
	Mark,
	missingAlignCss,
	setStyle,
	styleAt,
	toggleHeading,
	toggleList,
	toggleMark
} from '../../util/signaly/signaly-format';
import {readKinds} from '../../util/signaly/signaly-kinds';
import {
	applyLinkForm,
	LinkForm,
	linkFormAt
} from '../../util/signaly/signaly-link-form';
import {arg as linkArg} from '../../util/signaly/signaly-link-form';
import {findLinks} from '../../util/signaly/signaly-actions';
import {
	BlockType,
	findBlocks,
	gridSpots,
	newStateList,
	innermostAt,
	kr2Tag,
	newBlock,
	writeBlock
} from '../../util/signaly/signaly-screen-blocks';
import {
	composeEffect,
	EffectType,
	findEffects
} from '../../util/signaly/signaly-effects';
import {
	findConditions,
	findStates,
	findValues,
	wrapCondition,
	writeStates,
	writeValue
} from '../../util/signaly/signaly-logic';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {SignalyPreviewButton} from '../signaly-passage-preview';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import {PanelTarget, SignalyBlockPanel} from './signaly-block-panel';
import {
	accessTag,
	accessTagColor,
	findAccess,
	lockTag,
	lockTagColor,
	newAccess,
	setAccess
} from '../../util/signaly/signaly-access';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {articleTag, findArticle, newArticle, setArticle} from '../../util/signaly/signaly-articles';
import {eventTag, findEvent, setEventHead} from '../../util/signaly/signaly-events';
import './signaly-format-toolbar.css';

export interface SignalyFormatToolbarProps {
	disabled?: boolean;
	editor?: CodeMirror.Editor;
	passage: Passage;
	story: Story;
}

interface CursorInfo {
	kind: string;
	/** Ссылка или кнопка под курсором ('' — нет или разные). */
	form?: LinkForm | '';
	align: Align | '';
	color?: string;
	size?: string;
	textStyle?: string;
}

const sizes = ['50%', '75%', '125%', '150%', '200%', '300%'];

/** Порядок пунктов «Добавить блок» (решение 52). */
const addable: Array<BlockType | 'kr2' | 'states' | 'value' | 'tiles'> = [
	'alarm',
	'dialog',
	'code',
	'image',
	'video',
	'chain',
	'timer',
	'place',
	'kr2',
	'states',
	'value',
	'articles',
	'list',
	'tiles',
	'hack'
];

/** Пункты «Эффект» (шаг 2.1, ответ 5А); lines — появление строк по очереди. */
const effectItems: Array<EffectType | 'lines'> = ['type', 'timed', 'lines', 'swap', 'blink', 'glitch'];

/**
 * Где в тексте щелчок открывает форму: блоки — целиком, эффекты — по своим
 * командам (по тексту внутри эффекта щёлкать можно свободно), смена — целиком.
 */
function clickTargets(value: string) {
	const targets: Array<{from: number; to: number; target: PanelTarget}> = [];

	// Шаг 3.2: ссылка или кнопка целиком — форма с действиями.
	findLinks(value).forEach((link, index) =>
		targets.push({from: link.from, to: link.to, target: {kind: 'link', index}})
	);

	findBlocks(value).forEach((b, index) =>
		targets.push({from: b.from, to: b.to, target: {kind: 'block', index}})
	);
	findEffects(value).forEach((e, index) => {
		const target: PanelTarget = {kind: 'effect', index};

		if (e.type === 'swap') {
			targets.push({from: e.from, to: e.to, target});
		} else {
			targets.push({from: e.from, to: e.contentFrom, target});
			targets.push({from: e.contentTo, to: e.to, target});
		}
	});
	// Условия и состояния — по своим командам, значение — целиком (шаг 3.1).
	findConditions(value).forEach((c, index) => {
		const target: PanelTarget = {kind: 'condition', index};

		targets.push({from: c.from, to: c.headTo, target});
		if (c.elseFrom !== undefined) {
			targets.push({from: c.elseFrom, to: c.elseContentFrom!, target});
		}
		targets.push({from: c.to - '<</if>>'.length, to: c.to, target});
	});
	findStates(value).forEach((st, index) => {
		const target: PanelTarget = {kind: 'states', index};
		const body = value.slice(st.from, st.to);

		for (const m of body.matchAll(/<<(?:switch|case|default)(?=[\s>])[^]*?>>|<<\/switch>>/g)) {
			targets.push({from: st.from + m.index!, to: st.from + m.index! + m[0].length, target});
		}
	});
	findValues(value).forEach((v, index) =>
		targets.push({from: v.from, to: v.to, target: {kind: 'value', index}})
	);
	// Шаг 3.5: команда события.
	const event = findEvent(value);

	if (event) {
		targets.push({from: event.from, to: event.to, target: {kind: 'event'}});
	}
	// Шаг 4.3: команда доступа.
	const access = findAccess(value);

	if (access) {
		targets.push({from: access.from, to: access.to, target: {kind: 'access'}});
	}
	// Шаг 4.4: команда статьи.
	const article = findArticle(value);

	if (article) {
		targets.push({from: article.from, to: article.to, target: {kind: 'article'}});
	}
	return targets;
}

// Команды окна KR2 в тексте — тоже открывают форму.
const kr2Command = /<<\/?kr2(?:image|layout|vars|main)(?=[\s>])[^]*?>>/g;

/** Минимальная правка: заменить только то, что отличается. */
function diffEdit(before: string, after: string) {
	let start = 0;

	while (start < before.length && start < after.length && before[start] === after[start]) {
		start++;
	}

	let endBefore = before.length;
	let endAfter = after.length;

	while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
		endBefore--;
		endAfter--;
	}
	return {from: start, to: endBefore, insert: after.slice(start, endAfter)};
}

export const SignalyFormatToolbar: React.FC<SignalyFormatToolbarProps> = props => {
	const {disabled, editor, passage, story} = props;
	const {t} = useTranslation();
	const {dispatch, stories} = useStoriesContext();
	const [info, setInfo] = React.useState<CursorInfo>({kind: '', align: ''});
	const [colorOpen, setColorOpen] = React.useState(false);
	const [pickerColor, setPickerColor] = React.useState('#cc0000');
	const data = React.useMemo(() => readKinds(story.stylesheet), [story.stylesheet]);
	const kinds = React.useMemo(
		() => (data?.kinds ?? []).filter(k => k.cls !== ''),
		[data]
	);
	const look = React.useMemo(() => readAppearance(story.stylesheet) ?? defaultAppearance, [story.stylesheet]);
	const savedColors = look.savedColors;
	const views = look.screens;
	const textStyles = look.textStyles;
	const ways = look.firstWays;
	const styleClasses = React.useMemo(() => textStyles.map(textStyleClass), [textStyles]);
	const kindClasses = React.useMemo(() => kinds.map(k => k.cls), [kinds]);
	const [panel, setPanel] = React.useState<PanelTarget>();
	const [text, setText] = React.useState('');
	const [engineUpdated, setEngineUpdated] = React.useState(false);

	const selection = React.useCallback(() => {
		const doc = editor!.getDoc();

		return {
			text: doc.getValue(),
			from: doc.indexFromPos(doc.getCursor('from')),
			to: doc.indexFromPos(doc.getCursor('to'))
		};
	}, [editor]);

	/** Обёртка вида вокруг курсора — без выделения ссылка ↔ кнопка для всех её элементов. */
	const kindRange = React.useCallback(
		(text: string, from: number, to: number) => {
			const run = enclosingTag(text, from, to, r =>
				r.classes.some(c => kindClasses.includes(c))
			);

			return run ? {from: run.openTo, to: run.closeFrom} : undefined;
		},
		[kindClasses]
	);

	const updateInfo = React.useCallback(() => {
		if (!editor) {
			return;
		}

		const {text, from, to} = selection();

		setInfo({
			kind: kindAt(text, from, to, kindClasses),
			form: linkFormAt(text, from, to, kindRange(text, from, to)),
			align: alignAt(text, from, to),
			color: styleAt(text, from, to, 'color'),
			size: styleAt(text, from, to, 'font-size'),
			textStyle: kindAt(text, from, to, styleClasses)
		});
	}, [editor, kindClasses, kindRange, selection, styleClasses]);

	React.useEffect(() => {
		if (!editor) {
			return;
		}
		updateInfo();
		editor.on('cursorActivity', updateInfo);
		return () => editor.off('cursorActivity', updateInfo);
	}, [editor, updateInfo]);

	// Блоки в тексте подсвечены; щелчок по команде открывает её форму.
	React.useEffect(() => {
		if (!editor) {
			return;
		}

		const doc = editor.getDoc();
		const title = t('signaly.blocks.markHint');
		let marks: CodeMirror.TextMarker[] = [];
		let timer: number | undefined;

		const refresh = () => {
			const value = doc.getValue();
			const ranges = clickTargets(value).map(c => [c.from, c.to]);

			for (const match of value.matchAll(kr2Command)) {
				ranges.push([match.index!, match.index! + match[0].length]);
			}
			marks.forEach(m => m.clear());
			marks = ranges.map(([from, to]) =>
				doc.markText(doc.posFromIndex(from), doc.posFromIndex(to), {
					attributes: {title},
					className: 'signaly-block-mark'
				})
			);
			setText(value);
		};
		const schedule = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(refresh, 120);
		};
		const onDown = () => {
			window.setTimeout(() => {
				if (doc.somethingSelected()) {
					return;
				}

				const value = doc.getValue();
				const at = doc.indexFromPos(doc.getCursor());
				const targets = clickTargets(value);
				const index = innermostAt(targets, at);

				if (index !== -1) {
					setPanel(targets[index].target);
					return;
				}
				for (const match of value.matchAll(kr2Command)) {
					if (at > match.index! && at < match.index! + match[0].length) {
						setPanel({kind: 'kr2'});
						return;
					}
				}
			}, 0);
		};

		refresh();
		editor.on('change', schedule);
		editor.on('mousedown', onDown);
		return () => {
			window.clearTimeout(timer);
			editor.off('change', schedule);
			editor.off('mousedown', onDown);
			marks.forEach(m => m.clear());
		};
	}, [editor, t]);

	function run(make: (text: string, from: number, to: number) => Edit | undefined) {
		if (!editor) {
			return;
		}

		const doc = editor.getDoc();
		const {text, from, to} = selection();
		const edit = make(text, from, to);

		if (!edit) {
			editor.focus();
			return;
		}
		const expected = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

		editor.operation(() => {
			doc.replaceRange(edit.insert, doc.posFromIndex(edit.from), doc.posFromIndex(edit.to));
		});
		editor.focus();

		// Редактор Twine «управляемый»: правка доходит до текста не сразу, а после
		// обновления React, и курсор при этом сбрасывается. Ставим выделение,
		// когда новый текст уже в редакторе.
		let tries = 0;
		const select = () => {
			if (doc.getValue() !== expected && tries++ < 20) {
				window.setTimeout(select, 10);
				return;
			}
			doc.setSelection(doc.posFromIndex(edit.selFrom), doc.posFromIndex(edit.selTo));
			updateInfo();
		};

		Promise.resolve().then(select);
	}

	const mark = (m: Mark) => () => run((text, from, to) => toggleMark(text, from, to, m));

	function align(value: Align) {
		const css = missingAlignCss(story.stylesheet, value);

		if (css && info.align !== value) {
			// В таблице стилей нет класса выравнивания — добавляем его в конец.
			dispatch(
				updateStory(stories, story, {stylesheet: story.stylesheet.replace(/\s*$/, '') + css})
			);
		}
		run((text, from, to) => applyAlign(text, from, to, value));
	}

	function color(value: string | null) {
		run((text, from, to) => setStyle(text, from, to, 'color', value));
		setColorOpen(false);
	}

	// Блоки понимает движок — при первом блоке он ставится или обновляется.
	function ensureEngine() {
		if (engineVersionIn(story.script) < signalyEngineVersion) {
			// Заодно старые кнопки на экране становятся элементами (сессия 6).
			saveStoryWithUpgrade(dispatch, stories, story, {script: withEngine(story.script)}, passage.name);
			setEngineUpdated(true);
		}
	}

	function setView(view: ScreenView | undefined) {
		dispatch(updatePassage(story, passage, {tags: tagsWithView(passage.tags, view)}));
	}

	// Первое посещение (шаг 4.5): способ — тег экрана, показывает движок.
	function setWay(way: FirstWay | undefined) {
		ensureEngine();
		dispatch(updatePassage(story, passage, {tags: tagsWithWay(passage.tags, way)}));
	}

	function setEventTag(on: boolean) {
		const tags = passage.tags.filter(tag => tag !== eventTag);

		dispatch(updatePassage(story, passage, {tags: on ? [...tags, eventTag] : tags}));
	}

	// Тег sg-access с цветом на карте (шаг 4.3, ответ 6А).
	// Шаг 5.2 (ответ 2А): пустые экраны строк списка — сеткой правее карты.
	function createPassages(names: string[]) {
		const spots = gridSpots(freeSpot(story.passages), names.length);

		names.forEach((name, i) => {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name, story: story.id, tags: [], text: '', ...spots[i]}
			});
		});
	}

	function setAccessTag(on: boolean) {
		const tags = passage.tags.filter(tag => tag !== accessTag);

		dispatch(updatePassage(story, passage, {tags: on ? [...tags, accessTag] : tags}));
		if (on && !story.tagColors[accessTag]) {
			dispatch(setTagColor(story, accessTag, accessTagColor));
		}
	}

	// Общий пассаж блокировки — обычный пассаж с тегом sg-lock (ответ 5А).
	function setSharedLock(name: string) {
		story.passages.forEach(p => {
			const has = p.tags.includes(lockTag);

			if (has && p.name !== name) {
				dispatch(updatePassage(story, p, {tags: p.tags.filter(tag => tag !== lockTag)}));
			} else if (!has && p.name === name) {
				dispatch(updatePassage(story, p, {tags: [...p.tags, lockTag]}));
			}
		});
		if (name && !story.tagColors[lockTag]) {
			dispatch(setTagColor(story, lockTag, lockTagColor));
		}
	}

	function setArticleTag(on: boolean) {
		const tags = passage.tags.filter(tag => tag !== articleTag);

		dispatch(updatePassage(story, passage, {tags: on ? [...tags, articleTag] : tags}));
	}

	// «Статья» (шаг 4.4, ответ 1А): первой строкой <<sg-article>>, тег sg-article;
	// если экран уже статья — открыть форму.
	function addArticle() {
		if (!editor) {
			return;
		}

		const value = editor.getDoc().getValue();

		if (!findArticle(value)) {
			writeText(setArticle(value, newArticle()));
		}
		if (!passage.tags.includes(articleTag)) {
			setArticleTag(true);
		}
		setPanel({kind: 'article'});
	}

	// «Доступ» (шаг 4.3, ответ 1А): первой строкой <<sg-access условие>>, тег
	// sg-access; если у экрана он уже есть — открыть форму.
	function addAccess() {
		if (!editor) {
			return;
		}

		const value = editor.getDoc().getValue();

		if (!findAccess(value)) {
			writeText(setAccess(value, newAccess(`$${firstVariable().name}`)));
		}
		if (!passage.tags.includes(accessTag)) {
			setAccessTag(true);
		}
		setPanel({kind: 'access'});
	}

	// «Событие» (шаг 3.5, ответ 1А): первой строкой <<sg-event условие>>, тег
	// sg-event; если пассаж уже событие — открыть форму.
	function addEvent() {
		if (!editor) {
			return;
		}

		const value = editor.getDoc().getValue();

		if (!findEvent(value)) {
			writeText(setEventHead(value, {expr: `$${firstVariable().name}`, repeat: false, delay: 0, priority: 0}));
		}
		if (!passage.tags.includes(eventTag)) {
			setEventTag(true);
		}
		setPanel({kind: 'event'});
	}

	function setKr2Tag(on: boolean) {
		const tags = passage.tags.filter(tag => tag !== kr2Tag);

		dispatch(updatePassage(story, passage, {tags: on ? [...tags, kr2Tag] : tags}));
	}

	function addBlock(type: BlockType | 'kr2' | 'states' | 'value' | 'tiles') {
		if (!editor) {
			return;
		}
		if (type === 'states' || type === 'value') {
			addLogic(type);
			return;
		}
		ensureEngine();
		if (type === 'kr2') {
			if (!passage.tags.includes(kr2Tag)) {
				setKr2Tag(true);
			}
			setPanel({kind: 'kr2'});
			return;
		}

		const {text: value, from, to} = selection();
		const block = type === 'tiles' ? newStateList(true) : newBlock(type);
		const selected = value.slice(from, to);

		// Выделенный текст становится текстом тревоги или окна, а выделенная
		// ссылка или кнопка — кнопкой на экране.
		if (selected.trim() !== '' && (type === 'alarm' || type === 'dialog' || type === 'place')) {
			block.content = selected;
		}

		const insert = writeBlock(block);

		run(() => ({from, to, insert, selFrom: from, selTo: from}));

		const after = value.slice(0, from) + insert + value.slice(to);

		setPanel({
			kind: 'block',
			index: findBlocks(after).findIndex(b => b.from === from)
		});
	}

	// Условие, состояния и значение — обычные команды SugarCube, движок им не
	// нужен (шаг 3.1). Выделенный текст становится текстом условия или
	// первого состояния.
	function firstVariable() {
		return knownVariables(story.passages)[0] ?? {name: 'variable', label: ''};
	}

	function addCondition() {
		if (!editor) {
			return;
		}

		const {text: value, from, to} = selection();
		const made = wrapCondition(value, from, to, `$${firstVariable().name}`, label('logicSample'));

		run(() => ({...made, selFrom: from, selTo: from}));
		setPanel({kind: 'condition', index: findConditions(value.slice(0, from) + made.insert + value.slice(to)).findIndex(c => c.from === from)});
	}

	// «Действие» (шаг 3.2, ответ 1А): форма ссылки под курсором; выделенный
	// текст без ссылки становится ссылкой <<link "текст">><</link>>.
	function addAction() {
		if (!editor) {
			return;
		}

		const {text: value, from, to} = selection();
		const links = findLinks(value);
		const inside = links
			.map((link, index) => ({link, index}))
			.filter(({link}) =>
				from === to ? from > link.from && from < link.to : (link.from <= from && link.to >= to) || (link.from >= from && link.to <= to)
			);

		if (inside.length) {
			setPanel({kind: 'link', index: inside.reduce((a, b) => (b.link.from >= a.link.from && b.link.to <= a.link.to ? b : a)).index});
			return;
		}

		const selected = value.slice(from, to);
		const caption = selected.trim() !== '' && !selected.includes('\n') ? selected.trim() : label('sampleLink');
		const insert = `<<link ${linkArg(caption)}>><</link>>`;

		run(() => ({from, to, insert, selFrom: from, selTo: from}));
		setPanel({kind: 'link', index: findLinks(value.slice(0, from) + insert + value.slice(to)).findIndex(l => l.from === from)});
	}

	function addLogic(type: 'states' | 'value') {
		const {text: value, from, to} = selection();
		const v = firstVariable();
		const selected = value.slice(from, to);
		const insert =
			type === 'states'
				? writeStates({
						expr: `$${v.name}`,
						cases: [
							{value: v.type === 'bool' ? 'false' : '0', content: selected || label('logicSample'), kind: ''},
							{value: v.type === 'bool' ? 'true' : '1', content: label('logicSample'), kind: ''}
						]
				  })
				: writeValue({
						name: v.name,
						label: v.label,
						...(v.type === 'bool' ? {yes: t('signaly.logic.yes'), no: t('signaly.logic.no')} : {})
				  });
		const after = value.slice(0, from) + insert + value.slice(to);

		run(() => ({from, to, insert, selFrom: from, selTo: from}));
		setPanel(
			type === 'states'
				? {kind: 'states', index: findStates(after).findIndex(st => st.from === from)}
				: {kind: 'value', index: findValues(after).findIndex(x => x.from === from)}
		);
	}

	// Эффект на выделенный текст (без выделения — образец текста).
	function addEffect(type: EffectType | 'lines') {
		if (!editor) {
			return;
		}
		ensureEngine();

		const {text: value, from, to} = selection();
		// У текста уже есть эффекты — новый встаёт в свой слой (сессия 7).
		const made = composeEffect(type, value, from, to, {
			text: t('signaly.effects.sample'),
			next: t('signaly.effects.sampleNew'),
			lines: t('signaly.effects.sampleLines')
		});

		run(() => ({from: made.from, to: made.to, insert: made.insert, selFrom: made.from, selTo: made.from}));

		const after = value.slice(0, made.from) + made.insert + value.slice(made.to);

		setPanel({
			kind: 'effect',
			index: findEffects(after).findIndex(e => e.from === made.from + made.at)
		});
	}

	// Форма блока меняет текст: правим только изменившийся кусок, курсор и
	// фокус остаются в форме.
	function writeText(after: string) {
		if (!editor) {
			return;
		}

		const doc = editor.getDoc();
		const edit = diffEdit(doc.getValue(), after);

		if (edit.from === edit.to && edit.insert === '') {
			return;
		}
		// Действия «окно», «таймер», «остановить таймер» (шаг 3.2) — команды движка.
		if (/<<sg-/.test(edit.insert)) {
			ensureEngine();
		}
		editor.operation(() =>
			doc.replaceRange(edit.insert, doc.posFromIndex(edit.from), doc.posFromIndex(edit.to))
		);
		setText(after);
	}

	const label = (key: string) => t(`signaly.format.${key}`);
	const kindName = kinds.find(k => k.cls === info.kind)?.name;
	const currentView = viewOfTags(passage.tags, views);
	const currentWay = wayOfTags(passage.tags, ways);
	const textStyleName = textStyles.find(s => textStyleClass(s) === info.textStyle)?.name;
	const off = disabled || !editor;
	const accessExpr = text.includes('<<sg-access') ? findAccess(text)?.expr ?? '' : '';
	const accessLabel = accessExpr
		? `${t('signaly.access.button')}: ${accessExpr.length > 24 ? accessExpr.slice(0, 24) + '…' : accessExpr}`
		: t('signaly.access.button');

	return (
		<div className="signaly-format-toolbar">
			<ButtonBar>
				<IconButton disabled={off} icon={<IconBold />} iconOnly label={label('bold')} onClick={mark('bold')} />
				<IconButton disabled={off} icon={<IconItalic />} iconOnly label={label('italic')} onClick={mark('italic')} />
				<IconButton disabled={off} icon={<IconUnderline />} iconOnly label={label('underline')} onClick={mark('underline')} />
				<IconButton disabled={off} icon={<IconStrikethrough />} iconOnly label={label('strike')} onClick={mark('strike')} />
				<CardButton
					ariaLabel={label('color')}
					disabled={off}
					icon={
						<span className="signaly-format-color-icon">
							<IconPalette />
							<span style={{background: info.color ?? 'transparent'}} />
						</span>
					}
					iconOnly
					label={info.color ? `${label('color')}: ${info.color}` : label('color')}
					onChangeOpen={setColorOpen}
					open={colorOpen}
				>
					<div className="signaly-format-color-card">
						<p>{label('colorHint')}</p>
						<div className="signaly-swatches">
							{savedColors.map(c => (
								<button
									aria-label={c}
									className={c === info.color ? 'signaly-swatch selected' : 'signaly-swatch'}
									key={c}
									onClick={() => color(c)}
									style={{background: c}}
									title={c}
									type="button"
								/>
							))}
						</div>
						<div className="signaly-color">
							<input
								aria-label={label('otherColor')}
								className="signaly-color-picker"
								onChange={e => setPickerColor(e.target.value)}
								type="color"
								value={normalizeHex(pickerColor) ?? '#cc0000'}
							/>
							<button className="signaly-button" onClick={() => color(pickerColor)} type="button">
								{label('applyColor')}
							</button>
							<button
								className="signaly-button"
								disabled={!info.color}
								onClick={() => color(null)}
								type="button"
							>
								{label('removeColor')}
							</button>
						</div>
					</div>
				</CardButton>
				<MenuButton
					disabled={off}
					icon={<IconTextSize />}
					iconOnly
					items={[
						...sizes.map(size => ({
							checkable: true as const,
							checked: info.size === size,
							label: size,
							onClick: () =>
								run((text, from, to) => setStyle(text, from, to, 'font-size', size))
						})),
						{separator: true as const},
						{
							disabled: !info.size,
							label: label('normalSize'),
							onClick: () =>
								run((text, from, to) => setStyle(text, from, to, 'font-size', null))
						}
					]}
					label={info.size ? `${label('size')}: ${info.size}` : label('size')}
				/>
				<IconButton
					disabled={off}
					icon={<IconAlignCenter />}
					iconOnly
					label={label('center')}
					onClick={() => align('center')}
					selectable
					selected={info.align === 'center'}
				/>
				<IconButton
					disabled={off}
					icon={<IconAlignRight />}
					iconOnly
					label={label('right')}
					onClick={() => align('right')}
					selectable
					selected={info.align === 'right'}
				/>
				<MenuButton
					disabled={off}
					icon={<IconHeading />}
					iconOnly
					items={[1, 2, 3].map(level => ({
						label: label(`heading${level}`),
						onClick: () =>
							run((text, from, to) => toggleHeading(text, from, to, level))
					}))}
					label={label('heading')}
				/>
				<IconButton
					disabled={off}
					icon={<IconList />}
					iconOnly
					label={label('list')}
					onClick={() => run(toggleList)}
				/>
				<IconButton
					disabled={off}
					icon={<IconSeparatorHorizontal />}
					iconOnly
					label={label('rule')}
					onClick={() => run((text, from) => insertRule(text, from))}
				/>
				<MenuButton
					disabled={off}
					icon={<IconClick />}
					items={
						kinds.length === 0
							? [{disabled: true, label: label('noKinds'), onClick: () => {}}]
							: [
									...kinds.map(k => ({
										checkable: true as const,
										checked: info.kind === k.cls,
										label: k.name,
										onClick: () =>
											run((text, from, to) =>
												applyKind(text, from, to, k.cls, kindClasses, label('sampleLink'))
											)
									})),
									{separator: true as const},
									...(['link', 'button'] as const).map(form => ({
										checkable: true as const,
										checked: info.form === form,
										disabled: info.form === undefined,
										label: label(form === 'link' ? 'asLink' : 'asButton'),
										onClick: () =>
											run((text, from, to) =>
												applyLinkForm(text, from, to, form, kindRange(text, from, to))
											)
									})),
									{separator: true as const},
									{
										disabled: info.kind === '',
										label: label('noKind'),
										onClick: () =>
											run((text, from, to) =>
												applyKind(text, from, to, '', kindClasses, '')
											)
									}
							  ]
					}
					label={
						(kindName ? `${label('kind')}: ${kindName}` : label('kind')) +
						(info.form ? ` · ${label(info.form === 'link' ? 'formLink' : 'formButton')}` : '')
					}
				/>
				<MenuButton
					disabled={off}
					icon={<IconLetterCase />}
					items={
						textStyles.length === 0
							? [{disabled: true, label: t('signaly.textStyles.none'), onClick: () => {}}]
							: [
									...textStyles.map(s => ({
										checkable: true as const,
										checked: info.textStyle === textStyleClass(s),
										label: s.name,
										onClick: () =>
											run((text, from, to) =>
												applyTextStyle(text, from, to, textStyleClass(s), styleClasses, t('signaly.textStyles.sampleWord'))
											)
									})),
									{separator: true as const},
									{
										disabled: !info.textStyle,
										label: t('signaly.textStyles.remove'),
										onClick: () => run((text, from, to) => applyTextStyle(text, from, to, '', styleClasses, ''))
									}
							  ]
					}
					label={textStyleName ? `${t('signaly.textStyles.button')}: ${textStyleName}` : t('signaly.textStyles.button')}
				/>
				<MenuButton
					disabled={off}
					icon={<IconWand />}
					items={effectItems.map(type => ({
						label: t(`signaly.effects.add.${type}`),
						onClick: () => addEffect(type)
					}))}
					label={t('signaly.effects.button')}
				/>
				<IconButton disabled={off} icon={<IconClick />} label={t('signaly.actions.button')} onClick={addAction} />
				<IconButton disabled={off} icon={<IconArrowFork />} label={label('condition')} onClick={addCondition} />
				<IconButton disabled={off} icon={<IconBolt />} label={t('signaly.events.button')} onClick={addEvent} />
				<IconButton disabled={off} icon={<IconLock />} label={accessLabel} onClick={addAccess} />
				<IconButton disabled={off} icon={<IconArticle />} label={t('signaly.articles.button')} onClick={addArticle} />
				<MenuButton
					disabled={off}
					icon={<IconSquarePlus />}
					items={addable.map(type => ({
						label: type === 'states' || type === 'value' ? t(`signaly.logic.add.${type}`) : t(`signaly.blocks.add.${type}`),
						onClick: () => addBlock(type)
					}))}
					label={t('signaly.blocks.add.button')}
				/>
				<MenuButton
					disabled={off}
					icon={<IconLayout />}
					items={
						views.length === 0
							? [{disabled: true, label: t('signaly.screens.none'), onClick: () => {}}]
							: [
									{
										checkable: true as const,
										checked: !currentView,
										label: t('signaly.screens.plain'),
										onClick: () => setView(undefined)
									},
									{separator: true as const},
									...views.map(v => ({
										checkable: true as const,
										checked: currentView === v,
										label: v.name,
										onClick: () => setView(v)
									}))
							  ]
					}
					label={currentView ? `${t('signaly.screens.button')}: ${currentView.name}` : t('signaly.screens.button')}
				/>
				<MenuButton
					disabled={off}
					icon={<IconWaveSine />}
					items={
						ways.length === 0
							? [{disabled: true, label: t('signaly.first.none'), onClick: () => {}}]
							: [
									{
										checkable: true as const,
										checked: !currentWay,
										label: t('signaly.first.plain'),
										onClick: () => setWay(undefined)
									},
									{separator: true as const},
									...ways.map(w => ({
										checkable: true as const,
										checked: currentWay === w,
										label: w.name,
										onClick: () => setWay(w)
									}))
							  ]
					}
					label={currentWay ? `${t('signaly.first.button')}: ${currentWay.name}` : t('signaly.first.button')}
				/>
				<SignalyPreviewButton passageId={passage.id} />
			</ButtonBar>
			{engineUpdated && (
				<div className="signaly-notice signaly-block-notice">
					{t('signaly.blocks.engineUpdated', {version: signalyEngineVersion})}
				</div>
			)}
			{panel && editor && (
				<SignalyBlockPanel
					onAccessTag={setAccessTag}
					onArticleTag={setArticleTag}
					onClose={() => setPanel(undefined)}
					onCreatePassages={createPassages}
					onEventTag={setEventTag}
					onKr2Tag={setKr2Tag}
					onSharedLock={setSharedLock}
					onText={writeText}
					passage={passage}
					story={story}
					target={panel}
					text={text || editor.getDoc().getValue()}
				/>
			)}
		</div>
	);
};
