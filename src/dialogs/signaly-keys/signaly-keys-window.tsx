// «Twine СИГНАЛЫ»: окно «Горячие клавиши» (шаг 3.3, ответы автора 1А, 2А, 3А,
// 4А, 6Б). Слева — комбинации с подписью, справа — выбранная: комбинация
// (нажатием клавиш или из списка), подпись, «спросить перед выполнением»,
// действия по порядку (как у ссылки) и переход. Таблица хранится в пассаже
// «Горячие клавиши» с тегом sg-keys (signaly-keys.ts). Ничего не записывается в
// историю до «Сохранить».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {engineVersionIn, withEngine} from '../../util/signaly/signaly-appearance';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {
	comboFromKey,
	duplicateCombos,
	freeSpot,
	hasTemplateKeys,
	HotKey,
	keysPassageName,
	keysTag,
	normalCombo,
	readKeys,
	templateKeys,
	validCombo,
	writeKeys
} from '../../util/signaly/signaly-keys';
import {findAudioInit} from '../../util/signaly/signaly-sounds';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {CondListsContext, useCondLists} from '../passage-edit/signaly-logic-form';
import {ActionList} from '../passage-edit/signaly-action-list';
import {useLists} from '../passage-edit/signaly-block-panel';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';
import './signaly-keys.css';

export interface SignalyKeysWindowProps {
	onClose: () => void;
	story: Story;
}

/** Клавиши, которые можно нажать вместе с Shift при зажатой Z. */
const keyChars = [...'ABCDEFGHIJKLMNOPQRSTUVWXY', ...'0123456789'];

export const SignalyKeysWindow: React.FC<SignalyKeysWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.keys.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {media, passages} = useLists(story);
	const condLists = useCondLists(story);
	const keysPassage =
		story.passages.find(p => p.tags.includes(keysTag)) ?? story.passages.find(p => p.name === keysPassageName);
	// Код горячих клавиш шаблона в JavaScript истории — сразу в таблицу (ответ 3А).
	const [fromTemplate] = React.useState(() => (keysPassage ? undefined : templateKeys(story.script)));
	const [rows, setRows] = React.useState<HotKey[]>(() => [
		...readKeys(keysPassage?.text ?? ''),
		...(fromTemplate?.keys ?? [])
	]);
	const [selected, setSelected] = React.useState(0);
	const [saved, setSaved] = React.useState(!fromTemplate);
	const [capture, setCapture] = React.useState(false);
	const unknownCode = !fromTemplate && hasTemplateKeys(story.script) && !templateKeys(story.script);
	const variables = React.useMemo(() => knownVariables(story.passages), [story.passages]);
	const audio = React.useMemo(
		() => findAudioInit(story.passages.find(p => p.name === 'StoryInit')?.text ?? '').init,
		[story.passages]
	);

	function change(next: HotKey[]) {
		setRows(next);
		setSaved(false);
	}

	const row = rows[selected];
	const setRow = (patch: Partial<HotKey>) =>
		change(rows.map((r, i) => (i === selected ? {...r, ...patch, raw: undefined} : r)));

	const problems: string[] = [];
	const duplicates = duplicateCombos(rows);

	if (rows.some(r => !validCombo(r.combo))) {
		problems.push(l('problems.combo'));
	}
	if (duplicates.length) {
		problems.push(l('problems.duplicate', {combos: duplicates.join(', ')}));
	}

	/* ----- Комбинация нажатием клавиш ----- */

	React.useEffect(() => {
		if (!capture) {
			return;
		}

		let zDown = false;
		const onDown = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === 'Escape') {
				setCapture(false);
				return;
			}
			if (e.code === 'KeyZ') {
				zDown = true;
				return;
			}

			const combo = comboFromKey(e.code, e.shiftKey, zDown);

			if (combo) {
				setRow({combo});
				setCapture(false);
			}
		};
		const onUp = (e: KeyboardEvent) => {
			if (e.code === 'KeyZ') {
				zDown = false;
			}
		};

		window.addEventListener('keydown', onDown, true);
		window.addEventListener('keyup', onUp, true);
		return () => {
			window.removeEventListener('keydown', onDown, true);
			window.removeEventListener('keyup', onUp, true);
		};
	});

	/* ----- Сохранить ----- */

	function save() {
		const text = writeKeys(keysPassage?.text ?? '', rows);
		// Код шаблона уходит из JavaScript истории; движок — версии с горячими клавишами.
		let script = fromTemplate && hasTemplateKeys(story.script) ? templateKeys(story.script)?.script ?? story.script : story.script;

		if (engineVersionIn(script) < signalyEngineVersion) {
			script = withEngine(script);
		}
		if (script !== story.script) {
			saveStoryWithUpgrade(dispatch, stories, story, {script});
		}
		if (keysPassage) {
			const tags = keysPassage.tags.includes(keysTag) ? keysPassage.tags : [...keysPassage.tags, keysTag];

			if (text !== keysPassage.text || tags !== keysPassage.tags) {
				dispatch(updatePassage(story, keysPassage, {text, tags}));
			}
		} else {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: keysPassageName, story: story.id, tags: [keysTag], text, ...freeSpot(story.passages)}
			});
		}
		setSaved(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !capture) {
				close();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function add() {
		const free = keyChars.map(c => `Shift+Z+${c}`).find(c => !rows.some(r => normalCombo(r.combo) === c)) ?? 'Shift+Z+A';

		change([...rows, {combo: free, label: l('newLabel'), goto: '', ask: false, actions: [], multiline: true, extra: []}]);
		setSelected(rows.length);
	}

	function remove() {
		if (row && !row.builtin && window.confirm(l('confirmDelete', {combo: row.combo}))) {
			change(rows.filter((_, i) => i !== selected));
			setSelected(0);
		}
	}

	const title = (r: HotKey) => (r.builtin ? l(`builtins.${r.builtin}`) : r.label || l('noLabel'));
	const fileChoice = (label: string, value: string, files: string[], onChange: (value: string) => void, none?: string) => (
		<ChoiceField
			hint={files.length === 0 ? t('signaly.blocks.noFiles') : undefined}
			label={label}
			onChange={onChange}
			options={[...(none !== undefined ? [{label: none, value: ''}] : []), ...files.map(f => ({label: f, value: f}))]}
			value={value}
		/>
	);

	function editor() {
		if (!row) {
			return <p className="signaly-field-hint">{l('empty')}</p>;
		}

		const combo = normalCombo(row.combo);

		return (
			<>
				<div className="signaly-keys-combo">
					<span className="signaly-keys-combo-value">{capture ? l('pressNow') : combo}</span>
					<button className="signaly-button" onClick={() => setCapture(!capture)} type="button">
						{capture ? t('common.cancel') : l('press')}
					</button>
				</div>
				<ChoiceField
					hint={l('comboHint')}
					label={l('combo')}
					onChange={value => setRow({combo: value})}
					options={[
						...(keyChars.some(c => `Shift+Z+${c}` === combo) ? [] : [{label: combo, value: combo}]),
						...keyChars.map(c => ({label: `Shift+Z+${c}`, value: `Shift+Z+${c}`}))
					]}
					value={combo}
				/>
				{duplicates.includes(combo) && <div className="signaly-notice">{l('duplicateHere')}</div>}
				{row.builtin ? (
					<p className="signaly-field-hint">{l(`builtinHints.${row.builtin}`)}</p>
				) : (
					<>
						<TextField hint={l('labelHint')} label={l('label')} onChange={label => setRow({label})} value={row.label} />
						<CheckField hint={l('askHint')} label={l('ask')} onChange={ask => setRow({ask})} value={row.ask} />
						<h3>{t('signaly.actions.list')}</h3>
						<CondListsContext.Provider value={condLists}>
							<ActionList
								actions={row.actions}
								audio={audio}
								audioFiles={media.audio}
								current=""
								fileChoice={fileChoice}
								onChange={actions => setRow({actions})}
								passages={passages}
								variables={variables}
							/>
						</CondListsContext.Provider>
						<ChoiceField
							label={t('signaly.actions.goto')}
							onChange={goto => setRow({goto})}
							options={[
								{label: t('signaly.actions.gotoNone'), value: ''},
								...passages.map(p => ({label: p, value: p}))
							]}
							value={row.goto}
						/>
						<p className="signaly-field-hint">{l('hint')}</p>
					</>
				)}
			</>
		);
	}

	return (
		<div aria-label={l('title')} aria-modal="true" className="signaly-appearance-window signaly-sounds-window" role="dialog">
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved ? t('signaly.appearance.saved') : t('signaly.appearance.unsaved')}
				</span>
				<button className="signaly-button primary" disabled={saved || problems.length > 0} onClick={save} type="button">
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body signaly-sounds-body">
				<div className="signaly-appearance-settings">
					<p className="signaly-field-hint">{l('intro')}</p>
					{fromTemplate && <div className="signaly-notice">{l('fromTemplate')}</div>}
					{unknownCode && <div className="signaly-notice">{l('unknownCode')}</div>}
					<div className="signaly-kinds-list">
						{rows.map((r, i) => (
							<button
								aria-pressed={i === selected}
								className="signaly-kinds-item"
								key={i}
								onClick={() => {
									setSelected(i);
									setCapture(false);
								}}
								type="button"
							>
								<span className="signaly-keys-item-combo">{normalCombo(r.combo)}</span>
								{title(r)}
								{r.builtin && <span className="signaly-sound-file">{l('builtin')}</span>}
							</button>
						))}
					</div>
					<div className="signaly-sound-actions">
						<button className="signaly-button" onClick={add} type="button">
							{l('add')}
						</button>
						<button className="signaly-button" disabled={!row || !!row.builtin} onClick={remove} type="button">
							{l('delete')}
						</button>
					</div>
					<p className="signaly-field-hint">{l('where', {name: keysPassage?.name ?? keysPassageName})}</p>
				</div>
				<div className="signaly-sounds-editor">
					{problems.map(p => (
						<div className="signaly-notice" key={p}>
							{p}
						</div>
					))}
					{editor()}
				</div>
			</div>
		</div>
	);
};
