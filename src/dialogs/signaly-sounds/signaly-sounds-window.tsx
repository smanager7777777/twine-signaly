// «Twine СИГНАЛЫ»: окно «Звуки» (шаг 2.2, ответы автора 1А–6А). Вкладки:
// «Наборы» — звуки наведения и нажатия для видов кнопок и ссылок (файлы,
// громкость, задержка); «Файлы» — звуки с короткими именами для <<audio>>;
// «Группы» и «Плейлисты». Наборы лежат в «JavaScript истории» (блок звуков),
// файлы, группы и плейлисты — обычными командами SugarCube в StoryInit.
// Ничего не записывается в историю до «Сохранить».

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {withEngine} from '../../util/signaly/signaly-appearance';
import {
	AudioInit,
	emptySounds,
	findAudioInit,
	freeName,
	readSounds,
	removeSet,
	renameSet,
	renameSetInText,
	SignalySounds,
	SoundSet,
	withAudioInit,
	withSounds
} from '../../util/signaly/signaly-sounds';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import {ChoiceField, RangeField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {playSet, playSound, stopSound} from './signaly-sound-player';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import './signaly-sounds.css';

export interface SignalySoundsWindowProps {
	onClose: () => void;
	story: Story;
}

type Tab = 'sets' | 'tracks' | 'groups' | 'lists';

const initName = 'StoryInit';

/** Имя файла без папки и расширения — короткое имя по умолчанию. */
function baseName(path: string) {
	return path.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
}

function prepare(story: Story) {
	const script = withEngine(story.script);
	const passage = story.passages.find(p => p.name === initName);

	return {
		script,
		sounds: readSounds(script) ?? emptySounds,
		init: findAudioInit(passage?.text ?? '').init,
		hasInitCommands: findAudioInit(passage?.text ?? '').ranges.length > 0
	};
}

export const SignalySoundsWindow: React.FC<SignalySoundsWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.sounds.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {available, chooseGameFolder, gameFolder, listMedia} = useGameFolder();
	const [prepared] = React.useState(() => prepare(story));
	const [sounds, setSounds] = React.useState<SignalySounds>(prepared.sounds);
	const [init, setInit] = React.useState<AudioInit>(prepared.init);
	const [saved, setSaved] = React.useState(false);
	// Переименованные наборы: прежнее имя → новое (для кнопок на экране).
	const [renames, setRenames] = React.useState<Record<string, string>>({});
	const [tab, setTab] = React.useState<Tab>('sets');
	const [selected, setSelected] = React.useState<Record<Tab, number>>({sets: 0, tracks: 0, groups: 0, lists: 0});
	const [files, setFiles] = React.useState<string[]>([]);
	const folder = gameFolder(story.id);

	React.useEffect(() => {
		listMedia(story.id, 'audio').then(setFiles);
	}, [folder]); // eslint-disable-line

	React.useEffect(() => () => stopSound(), []);

	const others = React.useMemo(
		() => story.passages.filter(p => p.name !== initName && !p.tags.includes('script') && !p.tags.includes('stylesheet')),
		[story.passages]
	);

	/** Сколько экранов упоминают имя в кавычках (команды <<audio>> и т. п.). */
	function usedIn(name: string) {
		return others.filter(p => p.text.includes(`"${name}"`) || p.text.includes(`'${name}'`)).length;
	}

	function changeSounds(next: SignalySounds) {
		setSounds(next);
		setSaved(false);
	}

	function changeInit(next: AudioInit) {
		setInit(next);
		setSaved(false);
	}

	// Ошибки, при которых сохранять нельзя.
	const problems: string[] = [];
	const dup = (names: string[]) => names.filter((n, i) => names.indexOf(n) !== i);

	if (sounds.sets.some(s => s.name.trim() === '') || dup(sounds.sets.map(s => s.name)).length) {
		problems.push(l('problems.sets'));
	}
	// Как требует SugarCube: в именах звуков и плейлистов — ни пробелов, ни двоеточий.
	const badId = (id: string) => id === '' || /[:\s]/.test(id);

	if (init.tracks.some(tr => badId(tr.id)) || dup(init.tracks.map(tr => tr.id)).length) {
		problems.push(l('problems.tracks'));
	}
	if (init.groups.some(g => !/^:[^:\s]+$/.test(g.id)) || dup(init.groups.map(g => g.id)).length) {
		problems.push(l('problems.groups'));
	}
	if (init.lists.some(li => badId(li.id)) || dup(init.lists.map(li => li.id)).length) {
		problems.push(l('problems.lists'));
	}

	function save() {
		saveStoryWithUpgrade(dispatch, stories, story, {script: withSounds(prepared.script, sounds)});

		// Переименованные наборы — и в кнопках на экране.
		Object.keys(renames)
			.filter(from => renames[from] !== from)
			.forEach(from =>
				story.passages.forEach(p => {
					const text = renameSetInText(p.text, from, renames[from]);

					if (text !== p.text) {
						dispatch(updatePassage(story, p, {text}));
					}
				})
			);
		setRenames({});

		const passage = story.passages.find(p => p.name === initName);
		const changed = JSON.stringify(init) !== JSON.stringify(prepared.init);

		if (passage && (changed || prepared.hasInitCommands)) {
			const text = withAudioInit(passage.text, init);

			if (text !== passage.text) {
				dispatch(updatePassage(story, passage, {text}));
			}
		} else if (!passage && changed) {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: initName, story: story.id, text: withAudioInit('', init), left: 0, top: 0}
			});
		}
		setSaved(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			stopSound();
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

	const index = selected[tab];
	const select = (i: number) => setSelected({...selected, [tab]: i});

	/* ----- Списки слева ----- */

	const items: string[] =
		tab === 'sets'
			? sounds.sets.map(s => s.name)
			: tab === 'tracks'
			? init.tracks.map(tr => tr.id)
			: tab === 'groups'
			? init.groups.map(g => g.id)
			: init.lists.map(li => li.id);

	function add() {
		if (tab === 'sets') {
			const name = freeName(l('newSet'), sounds.sets.map(s => s.name));

			changeSounds({...sounds, sets: [...sounds.sets, {name, files: [], volume: 100, delay: 0}]});
			select(sounds.sets.length);
		} else if (tab === 'tracks') {
			const used = init.tracks.map(tr => tr.sources[0]);
			const file = files.find(f => !used.includes(f)) ?? files[0] ?? '';
			const id = freeName(file ? baseName(file) : l('newTrack'), init.tracks.map(tr => tr.id)).replace(/\s+/g, '_');

			changeInit({...init, tracks: [...init.tracks, {id, sources: file ? [file] : []}]});
			select(init.tracks.length);
		} else if (tab === 'groups') {
			const id = freeName(':' + l('newGroup'), init.groups.map(g => g.id)).replace(/\s+/g, '_');

			changeInit({...init, groups: [...init.groups, {id, tracks: []}]});
			select(init.groups.length);
		} else {
			const id = freeName(l('newList'), init.lists.map(li => li.id)).replace(/\s+/g, '_');

			changeInit({...init, lists: [...init.lists, {id, tracks: []}]});
			select(init.lists.length);
		}
	}

	function remove() {
		if (tab === 'sets') {
			const set = sounds.sets[index];

			if (set && window.confirm(l('confirmDelete', {name: set.name}))) {
				changeSounds(removeSet(sounds, set.name));
				select(0);
			}
		} else if (tab === 'tracks') {
			const track = init.tracks[index];

			if (track && window.confirm(l('confirmDelete', {name: track.id}))) {
				changeInit({
					tracks: init.tracks.filter((_, i) => i !== index),
					groups: init.groups.map(g => ({...g, tracks: g.tracks.filter(id => id !== track.id)})),
					lists: init.lists.map(li => ({...li, tracks: li.tracks.filter(x => x.id !== track.id)}))
				});
				select(0);
			}
		} else if (tab === 'groups') {
			if (init.groups[index] && window.confirm(l('confirmDelete', {name: init.groups[index].id}))) {
				changeInit({...init, groups: init.groups.filter((_, i) => i !== index)});
				select(0);
			}
		} else if (init.lists[index] && window.confirm(l('confirmDelete', {name: init.lists[index].id}))) {
			changeInit({...init, lists: init.lists.filter((_, i) => i !== index)});
			select(0);
		}
	}

	/* ----- Общие куски ----- */

	const fileOptions = (value: string) =>
		[...new Set([...(value ? [value] : []), ...files])].map(f => ({label: f, value: f}));

	const listen = (onClick: () => void, disabled = false) => (
		<button
			className="signaly-small-button"
			disabled={disabled || !folder}
			onClick={onClick}
			title={folder ? l('listen') : l('noFolder')}
			type="button"
		>
			▶
		</button>
	);

	const removeButton = (onClick: () => void) => (
		<button className="signaly-small-button" onClick={onClick} title={l('removeRow')} type="button">
			✕
		</button>
	);

	/* ----- Справа: выбранный набор, файл, группа, плейлист ----- */

	function setEditor(set: SoundSet) {
		const change = (changes: Partial<SoundSet>) =>
			changeSounds({...sounds, sets: sounds.sets.map((s, i) => (i === index ? {...s, ...changes} : s))});
		const kinds = Object.keys(sounds.kinds).filter(
			cls => sounds.kinds[cls].hover === set.name || sounds.kinds[cls].click === set.name
		);

		return (
			<>
				<TextField
					label={l('name')}
					onChange={name => {
						const origin = Object.keys(renames).find(key => renames[key] === set.name) ?? set.name;

						setRenames({...renames, [origin]: name});
						changeSounds(renameSet(sounds, set.name, name));
					}}
					value={set.name}
				/>
				<RangeField
					label={l('volume')}
					max={100}
					min={0}
					onChange={volume => change({volume: Math.min(100, volume)})}
					unit="%"
					value={set.volume}
				/>
				<RangeField
					hint={l('delayHint')}
					label={l('delay')}
					max={500}
					min={0}
					onChange={delay => change({delay: Math.min(500, Math.round(delay))})}
					step={10}
					unit={l('ms')}
					value={set.delay}
				/>
				<h3>{l('setFiles')}</h3>
				<p className="signaly-field-hint">{l('setFilesHint')}</p>
				{set.files.map((file, i) => (
					<div className="signaly-sound-row" key={i}>
						<select
							aria-label={l('file')}
							className="signaly-select"
							onChange={e => change({files: set.files.map((f, j) => (j === i ? e.target.value : f))})}
							value={file}
						>
							{fileOptions(file).map(o => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
						{listen(() => playSound(folder, file, set.volume / 100))}
						{removeButton(() => change({files: set.files.filter((_, j) => j !== i)}))}
					</div>
				))}
				<div className="signaly-sound-actions">
					<button
						className="signaly-button"
						disabled={files.length === 0}
						onClick={() => change({files: [...set.files, files.find(f => !set.files.includes(f)) ?? files[0]]})}
						type="button"
					>
						{l('addFile')}
					</button>
					<button
						className="signaly-button"
						disabled={!folder || set.files.length === 0}
						onClick={() => playSet(folder, set)}
						type="button"
					>
						▶ {l('listenSet')}
					</button>
				</div>
				<p className="signaly-field-hint">
					{kinds.length
						? l('setUsed', {list: kinds.map(cls => (cls === '' ? l('baseKind') : cls)).join(', ')})
						: l('setUnused')}
				</p>
			</>
		);
	}

	function trackEditor() {
		const track = init.tracks[index];
		const rename = (id: string) => {
			const old = track.id;

			changeInit({
				tracks: init.tracks.map((tr, i) => (i === index ? {...tr, id} : tr)),
				groups: init.groups.map(g => ({...g, tracks: g.tracks.map(x => (x === old ? id : x))})),
				lists: init.lists.map(li => ({...li, tracks: li.tracks.map(x => (x.id === old ? {...x, id} : x))}))
			});
		};
		const original = prepared.init.tracks.find(tr => tr.sources[0] === track.sources[0])?.id;
		const count = usedIn(track.id);

		return (
			<>
				<TextField hint={l('trackNameHint')} label={l('trackName')} onChange={rename} value={track.id} />
				<div className="signaly-sound-row">
					<ChoiceField
						label={l('file')}
						onChange={file =>
							changeInit({
								...init,
								tracks: init.tracks.map((tr, i) => (i === index ? {...tr, sources: [file, ...tr.sources.slice(1)]} : tr))
							})
						}
						options={fileOptions(track.sources[0] ?? '')}
						value={track.sources[0] ?? ''}
					/>
					{listen(() => playSound(folder, track.sources[0] ?? '', 1), !track.sources[0])}
				</div>
				<p className="signaly-field-hint">{l('trackUsed', {count, code: `<<audio "${track.id}" play>>`})}</p>
				{original !== undefined && original !== track.id && usedIn(original) > 0 && (
					<div className="signaly-notice">{l('renamed', {name: original, count: usedIn(original)})}</div>
				)}
			</>
		);
	}

	function groupEditor() {
		const group = init.groups[index];
		const change = (changes: Partial<typeof group>) =>
			changeInit({...init, groups: init.groups.map((g, i) => (i === index ? {...g, ...changes} : g))});

		return (
			<>
				<TextField hint={l('groupNameHint')} label={l('groupName')} onChange={id => change({id})} value={group.id} />
				<h3>{l('groupTracks')}</h3>
				<div className="signaly-sound-checks">
					{init.tracks.map(tr => (
						<label key={tr.id}>
							<input
								checked={group.tracks.includes(tr.id)}
								onChange={e =>
									change({
										tracks: e.target.checked
											? init.tracks.map(x => x.id).filter(id => id === tr.id || group.tracks.includes(id))
											: group.tracks.filter(id => id !== tr.id)
									})
								}
								type="checkbox"
							/>{' '}
							{tr.id}
						</label>
					))}
				</div>
				<p className="signaly-field-hint">{l('groupUsed', {count: usedIn(group.id), code: `<<audio "${group.id}" stop>>`})}</p>
			</>
		);
	}

	function listEditor() {
		const list = init.lists[index];
		const change = (changes: Partial<typeof list>) =>
			changeInit({...init, lists: init.lists.map((li, i) => (i === index ? {...li, ...changes} : li))});
		const setTrack = (i: number, changes: Partial<(typeof list.tracks)[number]>) =>
			change({tracks: list.tracks.map((x, j) => (j === i ? {...x, ...changes} : x))});
		const move = (i: number, by: number) => {
			const tracks = [...list.tracks];
			const [item] = tracks.splice(i, 1);

			tracks.splice(i + by, 0, item);
			change({tracks});
		};

		return (
			<>
				<TextField label={l('listName')} onChange={id => change({id})} value={list.id} />
				<h3>{l('listTracks')}</h3>
				{list.tracks.map((x, i) => {
					const source = init.tracks.find(tr => tr.id === x.id)?.sources[0] ?? '';
					const percent = Math.round((x.volume ?? 1) * 1000) / 10;

					return (
						<div className="signaly-sound-list-row" key={i}>
							<div className="signaly-sound-row">
								<select
									aria-label={l('trackName')}
									className="signaly-select"
									onChange={e => setTrack(i, {id: e.target.value})}
									value={x.id}
								>
									{[...new Set([x.id, ...init.tracks.map(tr => tr.id)])].map(id => (
										<option key={id} value={id}>
											{id}
										</option>
									))}
								</select>
								{listen(() => playSound(folder, source, x.volume ?? 1), !source)}
								<button className="signaly-small-button" disabled={i === 0} onClick={() => move(i, -1)} title={l('up')} type="button">
									▲
								</button>
								<button
									className="signaly-small-button"
									disabled={i === list.tracks.length - 1}
									onClick={() => move(i, 1)}
									title={l('down')}
									type="button"
								>
									▼
								</button>
								{removeButton(() => change({tracks: list.tracks.filter((_, j) => j !== i)}))}
							</div>
							<RangeField
								label={l('volume')}
								max={100}
								min={0}
								onChange={value => setTrack(i, {volume: Math.min(100, value) / 100})}
								step={0.5}
								unit="%"
								value={percent}
							/>
						</div>
					);
				})}
				<button
					className="signaly-button"
					disabled={init.tracks.length === 0}
					onClick={() => change({tracks: [...list.tracks, {id: init.tracks[0].id, volume: 1}]})}
					type="button"
				>
					{l('addTrack')}
				</button>
				<p className="signaly-field-hint">{l('listUsed', {count: usedIn(list.id), code: `<<playlist "${list.id}" play>>`})}</p>
			</>
		);
	}

	const editor =
		index >= items.length ? (
			<p className="signaly-field-hint">{l(`empty.${tab}`)}</p>
		) : tab === 'sets' ? (
			setEditor(sounds.sets[index])
		) : tab === 'tracks' ? (
			trackEditor()
		) : tab === 'groups' ? (
			groupEditor()
		) : (
			listEditor()
		);

	return (
		<div aria-label={l('title')} aria-modal="true" className="signaly-appearance-window signaly-sounds-window" role="dialog">
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved ? t('signaly.appearance.saved') : t('signaly.appearance.unsaved')}
				</span>
				<button className="signaly-button" onClick={stopSound} type="button">
					■ {l('stop')}
				</button>
				<button className="signaly-button primary" disabled={saved || problems.length > 0} onClick={save} type="button">
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body signaly-sounds-body">
				<div className="signaly-appearance-settings">
					{available && !folder && (
						<div className="signaly-notice">
							{l('noFolder')}{' '}
							<button className="signaly-button" onClick={() => chooseGameFolder(story.id)} type="button">
								{t('signaly.appearance.preview.chooseFolder')}
							</button>
						</div>
					)}
					<div className="signaly-tabs" role="tablist">
						{(['sets', 'tracks', 'groups', 'lists'] as const).map(name => (
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
					<div className="signaly-kinds-list">
						{items.map((name, i) => (
							<button
								aria-pressed={i === index}
								className="signaly-kinds-item"
								key={i}
								onClick={() => select(i)}
								type="button"
							>
								{name || '—'}
								{tab === 'tracks' && <span className="signaly-sound-file">{init.tracks[i].sources[0]}</span>}
							</button>
						))}
					</div>
					<div className="signaly-sound-actions">
						<button className="signaly-button" onClick={add} type="button">
							{l(`add.${tab}`)}
						</button>
						<button className="signaly-button" disabled={index >= items.length} onClick={remove} type="button">
							{l('delete')}
						</button>
					</div>
				</div>
				<div className="signaly-sounds-editor">
					{problems.map(p => (
						<div className="signaly-notice" key={p}>
							{p}
						</div>
					))}
					{editor}
				</div>
			</div>
		</div>
	);
};
