// «Twine СИГНАЛЫ»: окно «Виды кнопок и ссылок» (шаг 1.3; ответы автора 1а–4а,
// 7а). Большое окно поверх карты: слева — виды (свои шаблоны с названием),
// справа — предпросмотр настоящим SugarCube: образцы всех видов в трёх
// состояниях или любой экран истории. Вкладки «Кнопки на экране» с сессии 6 нет:
// место кнопки задаётся у самого элемента (<<sg-place>>); старые кнопки
// переносятся в элементы при сохранении.
//
// Ничего не записывается в историю до «Сохранить». При сохранении в «Таблицу
// стилей» ставится блок видов (сразу после блока оформления); блок оформления
// и движок обновляются так же, как в окне «Оформление терминала».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {passageDefaults} from '../../store/stories/defaults';
import {
	Passage,
	Story,
	updatePassage,
	updateStory,
	useStoriesContext
} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {
	appearanceMarkers,
	prepareStory,
	SignalyAppearance,
	withAppearance
} from '../../util/signaly/signaly-appearance';
import {
	classUseCount,
	cloneLook,
	demoPassageText,
	demoStatesCss,
	Kind,
	Look,
	prepareKinds,
	SignalyKinds,
	slugify,
	uniqueName,
	withKinds
} from '../../util/signaly/signaly-kinds';
import {movePlacesInTexts, withoutPlaces} from '../../util/signaly/signaly-places';
import {
	emptySounds,
	KindSounds,
	readSounds,
	SignalySounds,
	withSounds
} from '../../util/signaly/signaly-sounds';
import {playSet} from '../signaly-sounds/signaly-sound-player';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';
import {
	CheckField,
	ChoiceField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {
	SignalyAppearancePreview,
	SignalyPreviewMute
} from '../signaly-appearance/signaly-appearance-preview';
import {LookEditor} from './signaly-kinds-look';
import '../signaly-appearance/signaly-appearance.css';
import './signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';

export interface SignalyKindsWindowProps {
	onClose: () => void;
	story: Story;
}

const demoId = '__sg-demo__';

/** Тексты пассажей (без JavaScript и стилей) — чтобы знать, где используются виды. */
export function passageTexts(story: Story) {
	return story.passages
		.filter(p => !p.tags.includes('script') && !p.tags.includes('stylesheet'))
		.map(p => p.text);
}

interface Prepared {
	script: string;
	/** Таблица стилей с готовым блоком оформления, без блока видов. */
	stylesheet: string;
	appearance: SignalyAppearance;
	kinds: SignalyKinds;
	moved: string[];
	/** Перенесено ли и оформление (окна оформления ещё не открывали). */
	movedAppearance: boolean;
	/** Старые кнопки на экране → элементы: новые тексты пассажей (по id). */
	placeTexts: Map<string, string>;
	placeCount: number;
	/** Звуки наведения и нажатия (шаг 2.2). */
	sounds: SignalySounds;
	hasSounds: boolean;
}

function prepare(story: Story): Prepared {
	const app = prepareStory(story.script, story.stylesheet);
	const base = withAppearance(app.stylesheet, app.appearance);
	const kinds = prepareKinds(base, passageTexts(story));
	const moved = movePlacesInTexts(
		story.passages.map(p => p.text),
		kinds.kinds.places
	);
	const placeTexts = new Map<string, string>();

	moved.texts.forEach((text, index) => placeTexts.set(story.passages[index].id, text));

	return {
		script: app.script,
		stylesheet: kinds.stylesheet,
		appearance: app.appearance,
		kinds: withoutPlaces(kinds.kinds),
		moved: kinds.moved,
		movedAppearance: app.moved.length > 0,
		placeTexts,
		placeCount: moved.count,
		sounds: readSounds(app.script) ?? emptySounds,
		hasSounds: readSounds(app.script) !== undefined
	};
}

/** JavaScript истории: блок звуков пишется, если он уже был или звуки меняли. */
function buildScript(prepared: Prepared, sounds: SignalySounds) {
	return prepared.hasSounds || JSON.stringify(sounds) !== JSON.stringify(prepared.sounds)
		? withSounds(prepared.script, sounds)
		: prepared.script;
}

function build(prepared: Prepared, kinds: SignalyKinds, savedColors: string[]) {
	return withKinds(
		withAppearance(prepared.stylesheet, {...prepared.appearance, savedColors}),
		kinds,
		appearanceMarkers
	);
}

export const SignalyKindsWindow: React.FC<SignalyKindsWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const {dispatch, stories} = useStoriesContext();
	const {available, chooseGameFolder, gameFolder} = useGameFolder();
	const [prepared] = React.useState(() => prepare(story));
	const [kinds, setKinds] = React.useState(prepared.kinds);
	const [savedColors, setSavedColors] = React.useState(
		prepared.appearance.savedColors
	);
	const [sounds, setSounds] = React.useState(prepared.sounds);
	const [upToDate] = React.useState(
		() =>
			buildScript(prepared, prepared.sounds) === story.script &&
			build(prepared, prepared.kinds, prepared.appearance.savedColors) ===
				story.stylesheet
	);
	const [saved, setSaved] = React.useState(upToDate);
	const [savedOnce, setSavedOnce] = React.useState(false);
	const [selectedKind, setSelectedKind] = React.useState('');
	const [target, setTarget] = React.useState<'link' | 'button' | 'sounds'>('link');
	const [newKindName, setNewKindName] = React.useState('');
	const [screen, setScreen] = React.useState(demoId);
	const [refresh, setRefresh] = React.useState(0);
	const folder = gameFolder(story.id);
	const texts = React.useMemo(() => passageTexts(story), [story]);
	const kind = kinds.kinds.find(k => k.cls === selectedKind) ?? kinds.kinds[0];

	const stylesheet = build(prepared, kinds, savedColors);
	const script = buildScript(prepared, sounds);
	const demoText = demoPassageText(kinds, {
		link: t('signaly.kinds.demo.link'),
		button: t('signaly.kinds.demo.button'),
		normal: t('signaly.kinds.sections.normal'),
		hover: t('signaly.kinds.sections.hover'),
		active: t('signaly.kinds.sections.active')
	});
	const previewStory = React.useMemo<Story>(() => {
		const demo: Passage = {
			...passageDefaults(),
			id: demoId,
			name: 'СИГНАЛЫ: образцы',
			story: story.id,
			text: demoText
		};

		return {
			...story,
			passages: [
				...story.passages.map(p =>
					prepared.placeTexts.has(p.id) ? {...p, text: prepared.placeTexts.get(p.id)!} : p
				),
				demo
			],
			script,
			stylesheet: `${stylesheet}\n${demoStatesCss(kinds)}`
		};
	}, [demoText, kinds, prepared, script, story, stylesheet]);

	// Образцы меняются (новый вид, название) — предпросмотр перезапускается.
	React.useEffect(() => {
		if (screen === demoId) {
			setRefresh(r => r + 1);
		}
	}, [demoText]); // eslint-disable-line

	function change(next: SignalyKinds) {
		setKinds(next);
		setSaved(false);
	}

	function changeKind(changes: Partial<Kind>) {
		change({
			...kinds,
			kinds: kinds.kinds.map(k => (k.cls === kind.cls ? {...k, ...changes} : k))
		});
	}

	function changeLook(look: Look) {
		changeKind(target === 'link' ? {link: look} : {button: look});
	}

	// Звуки вида (шаг 2.2, ответ 1А): '__base__' — как у «Обычного».
	function changeSound(which: keyof KindSounds, value: string) {
		const current = {...(sounds.kinds[kind.cls] ?? {})};

		if (value === '__base__') {
			delete current[which];
		} else {
			current[which] = value;
		}
		setSounds({...sounds, kinds: {...sounds.kinds, [kind.cls]: current}});
		setSaved(false);
	}

	function addKind() {
		const name = newKindName.trim();

		if (name === '') {
			return;
		}

		const cls = uniqueName(slugify(name), kinds.kinds.map(k => k.cls));

		change({
			...kinds,
			kinds: [
				...kinds.kinds,
				{
					cls,
					name,
					link: cloneLook(kind.link),
					button: cloneLook(kind.button),
					buttonAsLink: kind.buttonAsLink
				}
			]
		});
		setSelectedKind(cls);
		setNewKindName('');
	}

	function removeKind() {
		const count = classUseCount(kind.cls, texts);

		if (
			count > 0 &&
			!window.confirm(t('signaly.kinds.confirmDelete', {count, name: kind.name}))
		) {
			return;
		}
		change({...kinds, kinds: kinds.kinds.filter(k => k.cls !== kind.cls)});
		if (sounds.kinds[kind.cls]) {
			const rest = {...sounds.kinds};

			delete rest[kind.cls];
			setSounds({...sounds, kinds: rest});
		}
		setSelectedKind('');
	}

	function saveColor(color: string) {
		if (!savedColors.includes(color)) {
			setSavedColors([...savedColors, color]);
			setSaved(false);
		}
	}

	function save() {
		dispatch(
			updateStory(stories, story, {script, stylesheet})
		);
		// Старые кнопки на экране становятся элементами пассажей (один раз).
		if (!savedOnce) {
			story.passages.forEach(p => {
				const text = prepared.placeTexts.get(p.id);

				if (text !== undefined) {
					dispatch(updatePassage(story, p, {text}));
				}
			});
		}
		setSaved(true);
		setSavedOnce(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				close();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const passages = [...story.passages]
		.filter(p => !p.tags.includes('script') && !p.tags.includes('stylesheet'))
		.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
	const look = target === 'button' && !kind.buttonAsLink ? kind.button : kind.link;

	return (
		<div
			aria-label={t('signaly.kinds.title')}
			aria-modal="true"
			className="signaly-appearance-window signaly-kinds-window"
			role="dialog"
		>
			<header className="signaly-appearance-header">
				<h2>
					{t('signaly.kinds.title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved
						? t('signaly.appearance.saved')
						: t('signaly.appearance.unsaved')}
				</span>
				<button
					className="signaly-button primary"
					disabled={saved}
					onClick={save}
					type="button"
				>
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body signaly-kinds-body">
				<div className="signaly-appearance-settings">
					{!upToDate && prepared.moved.length === 0 && !prepared.movedAppearance && !savedOnce && (
						<div className="signaly-notice">{t('signaly.kinds.updated')}</div>
					)}
					{prepared.moved.length > 0 && !savedOnce && (
						<div className="signaly-notice">
							{t('signaly.kinds.migrated', {
								list: prepared.kinds.kinds.map(k => k.name).join(', ')
							})}
						</div>
					)}
					{prepared.movedAppearance && !savedOnce && (
						<div className="signaly-notice">{t('signaly.kinds.migratedAppearance')}</div>
					)}
					{prepared.placeCount > 0 && !savedOnce && (
						<div className="signaly-notice">
							{t('signaly.kinds.placesMoved', {count: prepared.placeCount})}
						</div>
					)}
					<>
							<section>
								<p className="signaly-field-hint">{t('signaly.kinds.intro')}</p>
								<div className="signaly-kinds-list">
									{kinds.kinds.map(k => (
										<button
											aria-pressed={k.cls === kind.cls}
											className="signaly-kinds-item"
											key={k.cls}
											onClick={() => setSelectedKind(k.cls)}
											type="button"
										>
											<span
												className="signaly-kinds-chip"
												style={{
													background: k.button.normal.bg || 'transparent',
													borderColor: k.button.normal.borderColor,
													color: k.link.normal.color
												}}
											>
												Аа
											</span>
											{k.name}
										</button>
									))}
								</div>
								<div className="signaly-kinds-add">
									<input
										aria-label={t('signaly.kinds.newName')}
										className="signaly-text"
										onChange={e => setNewKindName(e.target.value)}
										onKeyDown={e => e.key === 'Enter' && addKind()}
										placeholder={t('signaly.kinds.newName')}
										value={newKindName}
									/>
									<button
										className="signaly-button"
										disabled={newKindName.trim() === ''}
										onClick={addKind}
										type="button"
									>
										{t('signaly.kinds.add')}
									</button>
								</div>
								<p className="signaly-field-hint">{t('signaly.kinds.addHint')}</p>
							</section>
							<section>
								<h3>{kind.name}</h3>
								<TextField
									label={t('signaly.kinds.fields.name')}
									onChange={name => changeKind({name})}
									value={kind.name}
								/>
								<p className="signaly-field-hint">
									{kind.cls === ''
										? t('signaly.kinds.baseHint')
										: t('signaly.kinds.code', {
												code: `<span class="${kind.cls}">…</span>`,
												count: classUseCount(kind.cls, texts)
										  })}
								</p>
								{kind.cls !== '' && (
									<button
										className="signaly-button"
										onClick={removeKind}
										type="button"
									>
										{t('signaly.kinds.delete')}
									</button>
								)}
							</section>
							<div className="signaly-tabs" role="tablist">
								{(['link', 'button', 'sounds'] as const).map(name => (
									<button
										aria-selected={target === name}
										className="signaly-tab"
										key={name}
										onClick={() => setTarget(name)}
										role="tab"
										type="button"
									>
										{t(`signaly.kinds.targets.${name}`)}
									</button>
								))}
							</div>
							{target === 'button' && (
								<CheckField
									hint={t('signaly.kinds.hints.buttonAsLink')}
									label={t('signaly.kinds.fields.buttonAsLink')}
									onChange={value =>
										changeKind({
											buttonAsLink: value,
											// Отключили «как у ссылок» — начинаем с того, что было видно.
											...(value ? {} : {button: cloneLook(kind.link)})
										})
									}
									value={kind.buttonAsLink}
								/>
							)}
							{target === 'sounds' &&
								(['hover', 'click'] as const).map(which => {
									const own = sounds.kinds[kind.cls]?.[which];
									const value = own === undefined ? (kind.cls === '' ? '' : '__base__') : own;
									const name = value === '__base__' ? sounds.kinds['']?.[which] : value;

									return (
										<div className="signaly-sound-row" key={which}>
											<ChoiceField
												label={t(`signaly.sounds.kind.${which}`)}
												onChange={v => changeSound(which, v)}
												options={[
													...(kind.cls === '' ? [] : [{label: t('signaly.sounds.kind.base'), value: '__base__'}]),
													{label: t('signaly.sounds.kind.none'), value: ''},
													...sounds.sets.map(s => ({label: s.name, value: s.name}))
												]}
												value={value}
											/>
											<button
												className="signaly-small-button"
												disabled={!folder || !name}
												onClick={() => playSet(folder, sounds.sets.find(s => s.name === name))}
												title={t('signaly.sounds.listen')}
												type="button"
											>
												▶
											</button>
										</div>
									);
								})}
							{target === 'sounds' && (
								<p className="signaly-field-hint">
									{sounds.sets.length ? t('signaly.sounds.kind.hint') : t('signaly.sounds.kind.noSets')}
								</p>
							)}
							{target !== 'sounds' && !(target === 'button' && kind.buttonAsLink) && (
								<LookEditor
									key={`${kind.cls}/${target}`}
									onChange={changeLook}
									onSaveColor={saveColor}
									savedColors={savedColors}
									value={look}
								/>
							)}
						</>
				</div>

				<div className="signaly-appearance-preview">
					<div className="signaly-preview-toolbar">
						<label>
							{t('signaly.appearance.preview.screen')}{' '}
							<select onChange={e => setScreen(e.target.value)} value={screen}>
								<option value={demoId}>{t('signaly.kinds.demo.screen')}</option>
								{passages.map(p => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
						</label>
						<button
							className="signaly-button"
							onClick={() => setRefresh(r => r + 1)}
							type="button"
						>
							{t('signaly.appearance.preview.refresh')}
						</button>
						<SignalyPreviewMute />
						<span className="signaly-field-hint">
							{t('signaly.kinds.demo.hint')}
						</span>
					</div>
					{available && !folder && (
						<div className="signaly-notice">
							{t('signaly.appearance.preview.noFolder')}{' '}
							<button
								className="signaly-button"
								onClick={() => chooseGameFolder(story.id)}
								type="button"
							>
								{t('signaly.appearance.preview.chooseFolder')}
							</button>
						</div>
					)}
					<SignalyAppearancePreview
						baseUrl={folder ? folderToFileUrl(folder) : undefined}
						mode="passage"
						passageId={screen}
						refresh={refresh}
						sounds={sounds}
						story={previewStory}
					/>
				</div>
			</div>
		</div>
	);
};
