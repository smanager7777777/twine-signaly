// «Twine СИГНАЛЫ»: окно «События» (сессия 35, этап Т4 — ответ Т4-4 А, claude/13 раздел 6б).
// Одна форма «когда X → сделать Y» для терминала и телефонов:
//  - условие на терминале (переменные, «Пришло с телефона», заходы на экраны…) — пассаж-событие
//    с тегом sg-event; выполняет терминал: переходит на экран события (или нет — stay) и делает
//    действия <<sg-event-do>> (в том числе «Телефонам: …»);
//  - условие на телефонах (событие с терминала или кода, глава + N минут, каждые N минут, общая
//    переменная) — правило центра в пассаже «Приложение»; выполняет центр сети на телефоне мастера,
//    действия — как у кодов телефона (в том числе «Переменная терминала» и «Событие»).
// Ничего не пишется в историю до «Сохранить».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, useStoriesContext} from '../../store/stories';
import {
	engineVersionIn,
	withEngine
} from '../../util/signaly/signaly-appearance';
import {
	AppGame,
	appBlockColor,
	appBlockTag,
	appSettingsColor,
	appSettingsName,
	appSettingsTag,
	codesPassageOf,
	readSettings,
	settingsPassageOf,
	writeSettings
} from '../../util/signaly/signaly-app';
import {
	appRefs,
	newItem,
	newSettings
} from '../../util/signaly/signaly-app-model';
import {readCodes} from '../../util/signaly/signaly-codes';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {
	eventTag,
	findEvent,
	setEventHead
} from '../../util/signaly/signaly-events';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {findAudioInit} from '../../util/signaly/signaly-sounds';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {TextField} from '../signaly-appearance/signaly-appearance-fields';
import {AppRefsContext, usePhoneL} from '../signaly-app/signaly-app-fields';
import {PhoneRuleForm, ruleLabel} from '../signaly-app/signaly-app-tabs';
import {addPassageEditors, useDialogsContext} from '../context';
import {useLists} from '../passage-edit/signaly-block-panel';
import {EventForm} from '../passage-edit/signaly-event-form';
import {
	CondListsContext,
	useCondLists
} from '../passage-edit/signaly-logic-form';
import {ChoiceField} from '../signaly-appearance/signaly-appearance-fields';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-check/signaly-check.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-keys/signaly-keys.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';
import '../signaly-app/signaly-app.css';

export interface SignalyEventsWindowProps {
	onClose: () => void;
	story: Story;
}

/** Событие терминала в окне: пассаж (id) или новый (id — «new:N»). */
interface TermItem {
	id: string;
	name: string;
	text: string;
	tagged: boolean;
}

type Sel = {kind: 'term'; id: string} | {kind: 'rule'; i: number} | undefined;

export const SignalyEventsWindow: React.FC<
	SignalyEventsWindowProps
> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) =>
		t(`signaly.eventsWindow.${key}`, options);
	const pl = usePhoneL();
	const {dispatch, stories} = useStoriesContext();
	const dialogs = useDialogsContext();
	const {media, passages} = useLists(story);
	const condLists = useCondLists(story);
	const settingsPassage = settingsPassageOf(story.passages);
	const codesPassage = codesPassageOf(story.passages);
	const fromStory = React.useCallback(
		() =>
			story.passages
				.filter(p => !!findEvent(p.text))
				.map(p => ({
					id: p.id,
					name: p.name,
					text: p.text,
					tagged: p.tags.includes(eventTag)
				}))
				.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
		[story.passages]
	);
	const [terms, setTerms] = React.useState<TermItem[]>(fromStory);
	const [rules, setRules] = React.useState<AppGame[]>(() =>
		settingsPassage ? (readSettings(settingsPassage.text).game.rules ?? []) : []
	);
	const [dirty, setDirty] = React.useState({
		terms: new Set<string>(),
		rules: false
	});
	const [sel, setSel] = React.useState<Sel>(() => {
		const first = fromStory()[0];

		return first
			? {kind: 'term', id: first.id}
			: rules.length
				? {kind: 'rule', i: 0}
				: undefined;
	});
	const [newName, setNewName] = React.useState('');
	const saved = dirty.terms.size === 0 && !dirty.rules;
	const settingsGame = React.useMemo(
		() => ({
			...(settingsPassage ? readSettings(settingsPassage.text).game : {}),
			rules
		}),
		[settingsPassage, rules]
	);
	const refs = React.useMemo(
		() =>
			appRefs(
				story.passages,
				readCodes(codesPassage?.text ?? ''),
				settingsGame
			),
		[story.passages, codesPassage, settingsGame]
	);
	const variables = React.useMemo(
		() => knownVariables(story.passages),
		[story.passages]
	);
	const audio = React.useMemo(
		() =>
			findAudioInit(
				story.passages.find(p => p.name === 'StoryInit')?.text ?? ''
			).init,
		[story.passages]
	);
	const fileChoice = (
		label: string,
		value: string,
		files: string[],
		onChange: (value: string) => void,
		none?: string
	) => (
		<ChoiceField
			label={label}
			onChange={onChange}
			options={[
				...(none !== undefined ? [{label: none, value: ''}] : []),
				...files.map(f => ({label: f, value: f}))
			]}
			value={value}
		/>
	);

	const setTerm = (id: string, patch: Partial<TermItem>) => {
		setTerms(list => list.map(x => (x.id === id ? {...x, ...patch} : x)));
		setDirty(d => ({...d, terms: new Set([...d.terms, id])}));
	};
	const setRule = (i: number, patch: AppGame) => {
		setRules(list => list.map((r, k) => (k === i ? {...r, ...patch} : r)));
		setDirty(d => ({...d, rules: true}));
	};

	/* ----- новые ----- */

	const nameTaken = (name: string) =>
		story.passages.some(p => p.name === name) ||
		terms.some(x => x.name === name);

	function addTerm() {
		const base = newName.trim() || l('newName');
		let name = base;
		let n = 2;

		while (nameTaken(name)) {
			name = `${base} (${n++})`;
		}

		const id = `new:${Date.now()}`;
		const first = variables[0];
		const text = setEventHead('', {
			expr: first ? `$${first.name} is true` : 'true',
			repeat: false,
			delay: 0,
			priority: 0
		});

		setTerms(list => [...list, {id, name, text, tagged: true}]);
		setDirty(d => ({...d, terms: new Set([...d.terms, id])}));
		setSel({kind: 'term', id});
		setNewName('');
	}

	function addRule() {
		setRules(list => [...list, newItem.rules()]);
		setDirty(d => ({...d, rules: true}));
		setSel({kind: 'rule', i: rules.length});
	}

	function removeRule(i: number) {
		if (
			!window.confirm(
				pl('confirmDelete', {name: rules[i]?.name || rules[i]?.id})
			)
		) {
			return;
		}
		setRules(list => list.filter((_, k) => k !== i));
		setDirty(d => ({...d, rules: true}));
		setSel(
			rules.length > 1
				? {kind: 'rule', i: Math.max(0, i - 1)}
				: terms[0]
					? {kind: 'term', id: terms[0].id}
					: undefined
		);
	}

	/* ----- запись ----- */

	function save() {
		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {
				script: withEngine(story.script)
			});
		}

		let spot = freeSpot(story.passages);

		terms
			.filter(x => dirty.terms.has(x.id))
			.forEach(x => {
				const p = story.passages.find(y => y.id === x.id);

				if (p) {
					dispatch({
						type: 'updatePassage',
						storyId: story.id,
						passageId: p.id,
						props: {
							text: x.text,
							tags: x.tagged
								? p.tags.includes(eventTag)
									? p.tags
									: [...p.tags, eventTag]
								: p.tags.filter(tag => tag !== eventTag)
						}
					});
				} else {
					dispatch({
						type: 'createPassage',
						storyId: story.id,
						props: {
							name: x.name,
							story: story.id,
							tags: [eventTag],
							text: x.text,
							...spot
						}
					});
					spot = {left: spot.left, top: spot.top + 125};
				}
			});
		if (dirty.rules) {
			const current = settingsPassageOf(story.passages);
			const game = current
				? readSettings(current.text).game
				: newSettings(story.name);
			const text = writeSettings({...game, rules});

			if (current) {
				dispatch({
					type: 'updatePassage',
					storyId: story.id,
					passageId: current.id,
					props: {text}
				});
			} else {
				dispatch({
					type: 'createPassage',
					storyId: story.id,
					props: {
						name: story.passages.some(p => p.name === appSettingsName)
							? `${appSettingsName} (пакет)`
							: appSettingsName,
						story: story.id,
						tags: [appSettingsTag],
						text,
						...spot
					}
				});
				dispatch({
					type: 'updateStory',
					storyId: story.id,
					props: {
						tagColors: {
							...story.tagColors,
							[appBlockTag]: story.tagColors[appBlockTag] ?? appBlockColor,
							[appSettingsTag]:
								story.tagColors[appSettingsTag] ?? appSettingsColor
						}
					}
				});
			}
		}
		setDirty({terms: new Set(), rules: false});
	}

	// Новые пассажи получили id — взять их из истории (после «Сохранить»).
	React.useEffect(() => {
		if (saved) {
			const next = fromStory();

			setTerms(next);
			setSel(s =>
				s?.kind === 'term' && s.id.startsWith('new:')
					? next.length
						? {kind: 'term', id: next[next.length - 1].id}
						: undefined
					: s
			);
		}
	}, [story.passages]); // eslint-disable-line

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
			return true;
		}
		return false;
	}

	function openPassage(id: string) {
		if (close()) {
			dialogs.dispatch(addPassageEditors(story.id, [id]));
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

	/* ----- форма ----- */

	function form() {
		if (!sel) {
			return <p className="signaly-field-hint">{l('none')}</p>;
		}
		if (sel.kind === 'term') {
			const x = terms.find(y => y.id === sel.id);
			const head = x ? findEvent(x.text) : undefined;

			if (!x) {
				return null;
			}
			return (
				<>
					<div className="signaly-notice signaly-events-who">
						{l('whoTerm')}
					</div>
					<h3>{x.name}</h3>
					{head ? (
						<EventForm
							actions={{
								audio,
								audioFiles: media.audio,
								current: x.name,
								fileChoice,
								passages
							}}
							head={head}
							onRemove={() =>
								setTerm(x.id, {
									text: setEventHead(x.text, undefined),
									tagged: false
								})
							}
							onTag={() => setTerm(x.id, {tagged: true})}
							onText={text => setTerm(x.id, {text})}
							tagged={x.tagged}
							text={x.text}
							variables={variables}
						/>
					) : (
						<p className="signaly-field-hint">{l('removed')}</p>
					)}
					<div className="signaly-block-buttons">
						<button
							className="signaly-button"
							disabled={x.id.startsWith('new:')}
							onClick={() => openPassage(x.id)}
							title={x.id.startsWith('new:') ? l('saveFirst') : undefined}
							type="button"
						>
							{l('openScreen')}
						</button>
					</div>
				</>
			);
		}

		const rule = rules[sel.i];

		if (!rule) {
			return null;
		}
		return (
			<>
				<div className="signaly-notice signaly-events-who">
					{l(rule.on === 'phone' ? 'whoPhone' : 'whoCenter')}
				</div>
				<PhoneRuleForm rule={rule} set={patch => setRule(sel.i, patch)} />
				<div className="signaly-block-buttons">
					<button
						className="signaly-button"
						onClick={() => removeRule(sel.i)}
						type="button"
					>
						{l('removeRule')}
					</button>
				</div>
			</>
		);
	}

	const termLabel = (x: TermItem) => {
		const head = findEvent(x.text);

		return `${head?.stay ? '⚡' : head?.popup ? '💬' : '▶'} ${x.name}${head ? ` · ${head.expr.length > 40 ? head.expr.slice(0, 40) + '…' : head.expr}` : ''}`;
	};

	return (
		<div
			aria-label={l('title')}
			aria-modal="true"
			className="signaly-appearance-window signaly-check-window signaly-app-window signaly-events-window"
			role="dialog"
		>
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
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
			<div className="signaly-app-main">
				<p className="signaly-field-hint">{l('intro')}</p>
				<AppRefsContext.Provider value={refs}>
					<CondListsContext.Provider value={condLists}>
						<div className="signaly-phone-split">
							<div className="signaly-phone-list">
								<h3>{l('termGroup', {n: terms.length})}</h3>
								<div className="signaly-field-hint">{l('termGroupHint')}</div>
								<div className="signaly-kinds-list">
									{terms.map(x => (
										<button
											aria-pressed={sel?.kind === 'term' && sel.id === x.id}
											className="signaly-kinds-item"
											key={x.id}
											onClick={() => setSel({kind: 'term', id: x.id})}
											type="button"
										>
											{termLabel(x)}
										</button>
									))}
								</div>
								<TextField
									label={l('newTermName')}
									onChange={setNewName}
									value={newName}
								/>
								<div className="signaly-sound-actions">
									<button
										className="signaly-button"
										onClick={addTerm}
										type="button"
									>
										{l('addTerm')}
									</button>
								</div>
								<h3>{l('ruleGroup', {n: rules.length})}</h3>
								<div className="signaly-field-hint">{l('ruleGroupHint')}</div>
								<div className="signaly-kinds-list">
									{rules.map((r, i) => (
										<button
											aria-pressed={sel?.kind === 'rule' && sel.i === i}
											className="signaly-kinds-item"
											key={String(r.id ?? i)}
											onClick={() => setSel({kind: 'rule', i})}
											type="button"
										>
											{`📱 ${ruleLabel(r, pl)}`}
										</button>
									))}
								</div>
								<div className="signaly-sound-actions">
									<button
										className="signaly-button"
										onClick={addRule}
										type="button"
									>
										{l('addRule')}
									</button>
								</div>
							</div>
							<div className="signaly-phone-form">{form()}</div>
						</div>
					</CondListsContext.Provider>
				</AppRefsContext.Provider>
			</div>
		</div>
	);
};
