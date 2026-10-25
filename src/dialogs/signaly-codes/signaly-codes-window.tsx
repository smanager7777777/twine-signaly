// «Twine СИГНАЛЫ»: окно «Коды» — общая таблица кодов игры (шаг 3.4, ответы
// автора 1А–6А). Вкладки «Коды» (код, подпись, кто может ввести, одноразовый,
// действия, ответ, переход), «Сотрудники» (номер или имя, личный код,
// переменная прогресса) и «Тексты ошибок». Таблица хранится в пассаже «Коды» с
// тегом sg-codes (signaly-codes.ts). Ничего не записывается в историю до
// «Сохранить».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {engineVersionIn, withEngine} from '../../util/signaly/signaly-appearance';
import {
	CodeTable,
	codesPassageName,
	codesTag,
	duplicates,
	needsPin,
	newEntry,
	newPerson,
	Once,
	Person,
	readCodes,
	TableCode,
	textKeys,
	writeCodes
} from '../../util/signaly/signaly-codes';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {findAudioInit} from '../../util/signaly/signaly-sounds';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {ActionList} from '../passage-edit/signaly-action-list';
import {AreaField, useLists} from '../passage-edit/signaly-block-panel';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';
import '../signaly-keys/signaly-keys.css';

export interface SignalyCodesWindowProps {
	onClose: () => void;
	story: Story;
}

type Tab = 'codes' | 'people' | 'texts';

/** Экраны, где поле кода проверяет по общей таблице. */
function fieldsWithTable(story: Story) {
	return story.passages
		.filter(p => /<<sg-code(?=[\s>])[^>]*?\stable(?=[\s>])/.test(p.text))
		.map(p => p.name)
		.sort();
}

export const SignalyCodesWindow: React.FC<SignalyCodesWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.codes.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {media, passages} = useLists(story);
	const codesPassage =
		story.passages.find(p => p.tags.includes(codesTag)) ?? story.passages.find(p => p.name === codesPassageName);
	const [table, setTable] = React.useState<CodeTable>(() => readCodes(codesPassage?.text ?? ''));
	const [tab, setTab] = React.useState<Tab>('codes');
	const [selected, setSelected] = React.useState({codes: 0, people: 0});
	const [saved, setSaved] = React.useState(true);
	const variables = React.useMemo(() => knownVariables(story.passages), [story.passages]);
	const audio = React.useMemo(
		() => findAudioInit(story.passages.find(p => p.name === 'StoryInit')?.text ?? '').init,
		[story.passages]
	);
	const fields = React.useMemo(() => fieldsWithTable(story), [story]);

	function change(next: CodeTable) {
		setTable(next);
		setSaved(false);
	}

	const entry = table.codes[selected.codes];
	const person = table.people[selected.people];
	const setEntry = (patch: Partial<TableCode>) =>
		change({...table, codes: table.codes.map((c, i) => (i === selected.codes ? {...c, ...patch, raw: undefined} : c))});
	const setPerson = (patch: Partial<Person>) => {
		const next = {...person, ...patch, raw: undefined};
		// Новый номер или имя — и в списках «кто может ввести».
		const codes =
			patch.id !== undefined && patch.id !== person.id
				? table.codes.map(c =>
						c.who.includes(person.id) ? {...c, who: c.who.map(w => (w === person.id ? patch.id! : w)), raw: undefined} : c
				  )
				: table.codes;

		change({...table, codes, people: table.people.map((p, i) => (i === selected.people ? next : p))});
	};

	/* ----- Проверки ----- */

	const problems: string[] = [];
	const sameCodes = duplicates(table.codes.map(c => c.code));
	const samePins = duplicates(table.people.map(p => p.pin));
	const sameIds = duplicates(table.people.map(p => p.id));

	if (table.codes.some(c => c.code.trim() === '')) {
		problems.push(l('problems.emptyCode'));
	}
	if (sameCodes.length) {
		problems.push(l('problems.sameCode', {list: sameCodes.join(', ')}));
	}
	if (table.people.some(p => p.id.trim() === '' || p.id.includes(','))) {
		problems.push(l('problems.badId'));
	}
	if (sameIds.length) {
		problems.push(l('problems.sameId', {list: sameIds.join(', ')}));
	}
	if (table.people.some(p => p.pin.trim() === '')) {
		problems.push(l('problems.emptyPin'));
	}
	if (samePins.length) {
		problems.push(l('problems.samePin', {list: samePins.join(', ')}));
	}
	if (table.people.some(p => p.variable !== '' && !/^[A-Za-z_]\w*$/.test(p.variable))) {
		problems.push(l('problems.badVar'));
	}

	/* ----- Сохранить ----- */

	function save() {
		const text = writeCodes(codesPassage?.text ?? '', table);
		// Движок — версии с общей таблицей кодов.
		const script = engineVersionIn(story.script) < signalyEngineVersion ? withEngine(story.script) : story.script;

		if (script !== story.script) {
			saveStoryWithUpgrade(dispatch, stories, story, {script});
		}
		if (codesPassage) {
			const tags = codesPassage.tags.includes(codesTag) ? codesPassage.tags : [...codesPassage.tags, codesTag];

			if (text !== codesPassage.text || tags !== codesPassage.tags) {
				dispatch(updatePassage(story, codesPassage, {text, tags}));
			}
		} else {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: codesPassageName, story: story.id, tags: [codesTag], text, ...freeSpot(story.passages)}
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
			if (e.key === 'Escape') {
				close();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function add() {
		if (tab === 'codes') {
			change({...table, codes: [...table.codes, newEntry()]});
			setSelected({...selected, codes: table.codes.length});
		} else if (tab === 'people') {
			change({...table, people: [...table.people, newPerson(table.people)]});
			setSelected({...selected, people: table.people.length});
		}
	}

	function remove() {
		if (tab === 'codes' && entry && window.confirm(l('confirmDeleteCode', {code: entry.code || '—'}))) {
			change({...table, codes: table.codes.filter((_, i) => i !== selected.codes)});
			setSelected({...selected, codes: 0});
		} else if (tab === 'people' && person && window.confirm(l('confirmDeletePerson', {id: person.id || '—'}))) {
			change({
				...table,
				people: table.people.filter((_, i) => i !== selected.people),
				codes: table.codes.map(c =>
					c.who.includes(person.id) ? {...c, who: c.who.filter(w => w !== person.id), raw: undefined} : c
				)
			});
			setSelected({...selected, people: 0});
		}
	}

	const fileChoice = (label: string, value: string, files: string[], onChange: (value: string) => void, none?: string) => (
		<ChoiceField
			hint={files.length === 0 ? t('signaly.blocks.noFiles') : undefined}
			label={label}
			onChange={onChange}
			options={[...(none !== undefined ? [{label: none, value: ''}] : []), ...files.map(f => ({label: f, value: f}))]}
			value={value}
		/>
	);

	/* ----- Правая часть ----- */

	function codeEditor() {
		if (!entry) {
			return <p className="signaly-field-hint">{l('emptyCodes')}</p>;
		}

		const pin = needsPin(entry);
		const insert = (piece: string) =>
			setEntry({answer: entry.answer + (entry.answer === '' || /\s$/.test(entry.answer) ? '' : ' ') + piece});

		return (
			<>
				<TextField hint={l('codeHint')} label={l('code')} onChange={code => setEntry({code})} value={entry.code} />
				{sameCodes.includes(entry.code.trim()) && <div className="signaly-notice">{l('sameHere')}</div>}
				<TextField hint={l('labelHint')} label={l('label')} onChange={label => setEntry({label})} value={entry.label} />
				<ChoiceField
					label={l('who')}
					onChange={value =>
						setEntry({who: value === 'some' ? (table.people[0] ? [table.people[0].id] : []) : []})
					}
					options={[
						{label: l('whoAll'), value: 'all'},
						{label: l('whoSome'), value: 'some'}
					]}
					value={entry.who.length ? 'some' : 'all'}
				/>
				{entry.who.length > 0 && (
					<div className="signaly-codes-people">
						{table.people.length === 0 && <div className="signaly-field-hint">{l('noPeople')}</div>}
						{table.people.map(p => (
							<CheckField
								key={p.id}
								label={p.id}
								onChange={on =>
									setEntry({
										who: on ? [...entry.who, p.id] : entry.who.filter(w => w !== p.id)
									})
								}
								value={entry.who.includes(p.id)}
							/>
						))}
						{entry.who
							.filter(w => !table.people.some(p => p.id === w))
							.map(w => (
								<div className="signaly-notice" key={w}>
									{l('unknownPerson', {id: w})}
								</div>
							))}
					</div>
				)}
				<ChoiceField
					label={l('once')}
					onChange={once => setEntry({once: once as Once})}
					options={[
						{label: l('onceNo'), value: ''},
						{label: l('onceAll'), value: 'all'},
						{label: l('onceEach'), value: 'each'}
					]}
					value={entry.once}
				/>
				<div className="signaly-notice">{l(pin ? 'askPin' : 'oneStep')}</div>
				<h3>{t('signaly.actions.list')}</h3>
				<ActionList
					actions={entry.actions}
					audio={audio}
					audioFiles={media.audio}
					codes
					current=""
					fileChoice={fileChoice}
					onChange={actions => setEntry({actions})}
					passages={passages}
					variables={variables}
				/>
				<h3>{l('answer')}</h3>
				<TextField label={l('answerTitle')} onChange={title => setEntry({title})} value={entry.title} />
				<AreaField hint={l('answerHint')} label={l('answerText')} onChange={answer => setEntry({answer})} value={entry.answer} />
				<div className="signaly-sound-actions">
					<button className="signaly-button" onClick={() => insert('<<= _who>>')} type="button">
						{l('insertWho')}
					</button>
					<button className="signaly-button" onClick={() => insert('<<= _code>>')} type="button">
						{l('insertCode')}
					</button>
				</div>
				<ChoiceField
					label={t('signaly.actions.goto')}
					onChange={goto => setEntry({goto})}
					options={[{label: t('signaly.actions.gotoNone'), value: ''}, ...passages.map(p => ({label: p, value: p}))]}
					value={entry.goto}
				/>
				{entry.who.length > 0 && (
					<TextField
						hint={l('ownHint', {text: table.texts.denied})}
						label={l('ownDenied')}
						onChange={denied => setEntry({denied})}
						value={entry.denied}
					/>
				)}
				{entry.once && (
					<TextField
						hint={l('ownHint', {text: table.texts.used})}
						label={l('ownUsed')}
						onChange={used => setEntry({used})}
						value={entry.used}
					/>
				)}
				<p className="signaly-field-hint">{l('order')}</p>
			</>
		);
	}

	function personEditor() {
		if (!person) {
			return <p className="signaly-field-hint">{l('emptyPeople')}</p>;
		}
		return (
			<>
				<TextField hint={l('idHint')} label={l('id')} onChange={id => setPerson({id})} value={person.id} />
				{sameIds.includes(person.id.trim()) && <div className="signaly-notice">{l('sameIdHere')}</div>}
				<TextField hint={l('pinHint')} label={l('pin')} onChange={pin => setPerson({pin: pin.trim()})} value={person.pin} />
				{person.pin !== '' && !/^\d{3}$/.test(person.pin) && <div className="signaly-notice">{l('pinNot3')}</div>}
				{samePins.includes(person.pin.trim()) && <div className="signaly-notice">{l('samePinHere')}</div>}
				<TextField
					hint={l('varHint')}
					label={l('variable')}
					onChange={v => setPerson({variable: v.trim().replace(/^\$/, '')})}
					value={person.variable}
				/>
				{person.variable !== '' && !variables.some(v => v.name === person.variable) && (
					<div className="signaly-field-hint">{l('varNew', {name: person.variable})}</div>
				)}
			</>
		);
	}

	function textsEditor() {
		return (
			<>
				{textKeys.map(key => (
					<TextField
						hint={l(`textHints.${key}`)}
						key={key}
						label={l(`texts.${key}`)}
						onChange={value => change({...table, texts: {...table.texts, [key]: value}})}
						value={table.texts[key]}
					/>
				))}
			</>
		);
	}

	const items =
		tab === 'codes'
			? table.codes.map(c => (
					<>
						<span className="signaly-keys-item-combo">{c.code || '—'}</span>
						{c.label}
						{c.once && <span className="signaly-sound-file">{l(c.once === 'all' ? 'onceShortAll' : 'onceShortEach')}</span>}
					</>
			  ))
			: tab === 'people'
			? table.people.map(p => (
					<>
						<span className="signaly-keys-item-combo">{p.pin || '—'}</span>
						{p.id}
						{p.variable && <span className="signaly-sound-file">${p.variable}</span>}
					</>
			  ))
			: [];
	const index = tab === 'people' ? selected.people : selected.codes;

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
					<div className="signaly-tabs" role="tablist">
						{(['codes', 'people', 'texts'] as const).map(name => (
							<button
								aria-selected={tab === name}
								className="signaly-tab"
								key={name}
								onClick={() => setTab(name)}
								role="tab"
								type="button"
							>
								{l(`tabs.${name}`)}
							</button>
						))}
					</div>
					<p className="signaly-field-hint">{l(`intro.${tab}`)}</p>
					{tab !== 'texts' && (
						<>
							<div className="signaly-kinds-list">
								{items.map((item, i) => (
									<button
										aria-pressed={i === index}
										className="signaly-kinds-item"
										key={i}
										onClick={() => setSelected({...selected, [tab]: i})}
										type="button"
									>
										{item}
									</button>
								))}
							</div>
							<div className="signaly-sound-actions">
								<button className="signaly-button" onClick={add} type="button">
									{l(`add.${tab}`)}
								</button>
								<button
									className="signaly-button"
									disabled={tab === 'codes' ? !entry : !person}
									onClick={remove}
									type="button"
								>
									{l('delete')}
								</button>
							</div>
						</>
					)}
					<p className="signaly-field-hint">{l('where', {name: codesPassage?.name ?? codesPassageName})}</p>
					<p className="signaly-field-hint">
						{fields.length ? l('fields', {list: fields.join(', ')}) : l('noFields')}
					</p>
				</div>
				<div className="signaly-sounds-editor">
					{problems.map(p => (
						<div className="signaly-notice" key={p}>
							{p}
						</div>
					))}
					{tab === 'codes' ? codeEditor() : tab === 'people' ? personEditor() : textsEditor()}
				</div>
			</div>
		</div>
	);
};
