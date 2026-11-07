// «Twine СИГНАЛЫ»: окно «Музыка» (шаг 7.1, ответы 3А, 4А). Каталог общего плеера:
// разделы «Атмосфера» и «Радио», в них папки, в папках треки (файл, условие,
// предзвук, начальная громкость); общие настройки — громкость в начале игры,
// время кручения цифр, «АВТО». Хранится в пассаже «Музыка» с тегом sg-music
// (signaly-music.ts). Ничего не записывается в историю до «Сохранить».

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {engineVersionIn, withEngine} from '../../util/signaly/signaly-appearance';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {writeExpr} from '../../util/signaly/signaly-logic';
import {
	MusicCatalog,
	MusicFolder,
	musicPassageName,
	musicProblems,
	musicSections,
	musicTag,
	MusicTrack,
	readMusic,
	trackDefaults,
	writeMusic
} from '../../util/signaly/signaly-music';
import {newsConds} from '../../util/signaly/signaly-ticker';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {CheckField, ChoiceField, RangeField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {CondListsContext, CondRows, useCondLists} from '../passage-edit/signaly-logic-form';
import {useLists} from '../passage-edit/signaly-block-panel';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';

function move<T>(list: T[], index: number, by: number) {
	const next = [...list];
	const [item] = next.splice(index, 1);

	next.splice(index + by, 0, item);
	return next;
}

export const SignalyMusicWindow: React.FC<{onClose: () => void; story: Story}> = ({onClose, story}) => {
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.music.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {media} = useLists(story);
	const condLists = useCondLists(story);
	const variables = React.useMemo(() => knownVariables(story.passages), [story.passages]);
	const musicPassage =
		story.passages.find(p => p.tags.includes(musicTag)) ?? story.passages.find(p => p.name === musicPassageName);
	const [catalog, setCatalog] = React.useState<MusicCatalog>(() => readMusic(musicPassage?.text ?? ''));
	const [selected, setSelected] = React.useState(0);
	const [saved, setSaved] = React.useState(true);
	const folder = catalog.folders[selected];
	const s = t('signaly.appearance.units.seconds');

	function change(next: MusicCatalog) {
		setCatalog(next);
		setSaved(false);
	}

	const setFolders = (folders: MusicFolder[]) => change({...catalog, folders});
	const setFolder = (patch: Partial<MusicFolder>) =>
		setFolders(catalog.folders.map((f, i) => (i === selected ? {...f, ...patch} : f)));
	const setTracks = (tracks: MusicTrack[]) => setFolder({tracks});
	const setTrack = (index: number, patch: Partial<MusicTrack>) =>
		setTracks(folder.tracks.map((tr, i) => (i === index ? {...tr, ...patch} : tr)));

	const p = musicProblems(catalog);
	const problems = (Object.keys(p) as Array<keyof typeof p>).filter(key => p[key]).map(key => l(`problems.${key}`));

	function save() {
		const text = writeMusic(musicPassage?.text ?? '', catalog);

		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {script: withEngine(story.script)});
		}
		if (musicPassage) {
			const tags = musicPassage.tags.includes(musicTag) ? musicPassage.tags : [...musicPassage.tags, musicTag];

			if (text !== musicPassage.text || tags !== musicPassage.tags) {
				dispatch(updatePassage(story, musicPassage, {text, tags}));
			}
		} else {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: musicPassageName, story: story.id, tags: [musicTag], text, ...freeSpot(story.passages)}
			});
		}
		setSaved(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	function addFolder(section: MusicFolder['section']) {
		let n = catalog.folders.length + 1;

		while (catalog.folders.some(f => f.name === l('newFolder', {n}))) {
			n++;
		}
		change({...catalog, folders: [...catalog.folders, {name: l('newFolder', {n}), section, tracks: []}]});
		setSelected(catalog.folders.length);
	}

	function removeFolder() {
		if (folder && window.confirm(l('confirmDelete', {name: folder.name}))) {
			setFolders(catalog.folders.filter((_, i) => i !== selected));
			setSelected(Math.max(0, selected - 1));
		}
	}

	const audioChoice = (label: string, value: string, onChange: (v: string) => void, none?: string) => (
		<ChoiceField
			hint={media.audio.length === 0 ? t('signaly.blocks.noFiles') : undefined}
			label={label}
			onChange={onChange}
			options={[
				...(none !== undefined ? [{label: none, value: ''}] : []),
				...[...new Set([value, ...media.audio])].filter(Boolean).map(f => ({label: f, value: f}))
			]}
			value={value}
		/>
	);

	function trackEditor(track: MusicTrack, index: number) {
		const parsed = newsConds(track.when);

		return (
			<fieldset className="signaly-block-row" key={index}>
				<legend>
					{index + 1}
					<IconButton
						disabled={index === 0}
						icon={<IconArrowUp />}
						iconOnly
						label={l('up')}
						onClick={() => setTracks(move(folder.tracks, index, -1))}
					/>
					<IconButton
						disabled={index === folder.tracks.length - 1}
						icon={<IconArrowDown />}
						iconOnly
						label={l('down')}
						onClick={() => setTracks(move(folder.tracks, index, 1))}
					/>
					<IconButton
						icon={<IconTrash />}
						iconOnly
						label={l('removeTrack')}
						onClick={() => setTracks(folder.tracks.filter((_, i) => i !== index))}
					/>
				</legend>
				<TextField label={l('trackName')} onChange={name => setTrack(index, {name})} value={track.name} />
				{audioChoice(l('file'), track.src, src => setTrack(index, {src}), l('chooseFile'))}
				<h4 className="signaly-block-subtitle">{l('when')}</h4>
				{parsed ? (
					<CondListsContext.Provider value={condLists}>
						<div className="signaly-field-hint">{l('whenHint')}</div>
						<CondRows
							conds={parsed.conds}
							join={parsed.join}
							onChange={(conds, join) => setTrack(index, {when: writeExpr(conds, join)})}
							variables={variables}
						/>
					</CondListsContext.Provider>
				) : (
					<TextField label={t('signaly.logic.cond.expr')} onChange={when => setTrack(index, {when})} value={track.when} />
				)}
				<CheckField
					hint={l('preHint')}
					label={l('pre')}
					onChange={on => setTrack(index, on ? {pre: media.audio[0] ?? 'media/audio/'} : {pre: ''})}
					value={track.pre !== ''}
				/>
				{track.pre !== '' && (
					<>
						{audioChoice(l('preFile'), track.pre, pre => setTrack(index, {pre}))}
						<RangeField label={l('wait')} max={30} min={0} onChange={wait => setTrack(index, {wait})} step={0.5} unit={s} value={track.wait} />
						<RangeField label={l('tail')} max={30} min={0} onChange={tail => setTrack(index, {tail})} step={0.5} unit={s} value={track.tail} />
						<RangeField label={l('preVolume')} max={100} min={0} onChange={preVolume => setTrack(index, {preVolume})} unit="%" value={track.preVolume} />
					</>
				)}
				<CheckField
					hint={l('startHint')}
					label={l('start')}
					onChange={on => setTrack(index, {start: on ? catalog.settings.volume : undefined})}
					value={track.start !== undefined}
				/>
				{track.start !== undefined && (
					<RangeField label={l('startVolume')} max={99} min={0} onChange={start => setTrack(index, {start})} unit="" value={track.start} />
				)}
			</fieldset>
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
					<h3>{l('general')}</h3>
					<RangeField
						hint={l('volumeHint')}
						label={l('volume')}
						max={99}
						min={0}
						onChange={volume => change({...catalog, settings: {...catalog.settings, volume}})}
						unit=""
						value={catalog.settings.volume}
					/>
					<RangeField
						hint={l('spinHint')}
						label={l('spin')}
						max={5}
						min={0}
						onChange={spin => change({...catalog, settings: {...catalog.settings, spin}})}
						step={0.1}
						unit={s}
						value={catalog.settings.spin}
					/>
					<CheckField
						hint={l('autoHint')}
						label={l('auto')}
						onChange={auto => change({...catalog, settings: {...catalog.settings, auto}})}
						value={catalog.settings.auto}
					/>
					{musicSections.map(section => (
						<React.Fragment key={section}>
							<h3>{l(`sections.${section}`)}</h3>
							<div className="signaly-kinds-list">
								{catalog.folders.map((f, i) =>
									f.section !== section ? null : (
										<button
											aria-pressed={i === selected}
											className="signaly-kinds-item"
											key={i}
											onClick={() => setSelected(i)}
											type="button"
										>
											{f.name || l('noName')}
											<span className="signaly-sound-file">{l('count', {count: f.tracks.length})}</span>
										</button>
									)
								)}
							</div>
							<div className="signaly-sound-actions">
								<button className="signaly-button" onClick={() => addFolder(section)} type="button">
									{l('addFolder')}
								</button>
							</div>
						</React.Fragment>
					))}
					<p className="signaly-field-hint">{l('where', {name: musicPassage?.name ?? musicPassageName})}</p>
				</div>
				<div className="signaly-sounds-editor">
					{problems.map(text => (
						<div className="signaly-notice" key={text}>
							{text}
						</div>
					))}
					{!folder ? (
						<p className="signaly-field-hint">{l('empty')}</p>
					) : (
						<>
							<TextField hint={l('folderHint')} label={l('folderName')} onChange={name => setFolder({name})} value={folder.name} />
							<ChoiceField
								label={l('section')}
								onChange={section => setFolder({section: section as MusicFolder['section']})}
								options={musicSections.map(v => ({label: l(`sections.${v}`), value: v}))}
								value={folder.section}
							/>
							<div className="signaly-sound-actions">
								<button
									className="signaly-button"
									disabled={selected === 0}
									onClick={() => {
										setFolders(move(catalog.folders, selected, -1));
										setSelected(selected - 1);
									}}
									type="button"
								>
									{l('up')}
								</button>
								<button
									className="signaly-button"
									disabled={selected === catalog.folders.length - 1}
									onClick={() => {
										setFolders(move(catalog.folders, selected, 1));
										setSelected(selected + 1);
									}}
									type="button"
								>
									{l('down')}
								</button>
								<button className="signaly-button" onClick={removeFolder} type="button">
									{l('deleteFolder')}
								</button>
							</div>
							<h3>{l('tracks')}</h3>
							{folder.tracks.map(trackEditor)}
							<div className="signaly-sound-actions">
								<button
									className="signaly-button"
									onClick={() =>
										setTracks([...folder.tracks, {...trackDefaults, name: l('newTrack', {n: folder.tracks.length + 1}), src: ''}])
									}
									type="button"
								>
									{l('addTrack')}
								</button>
							</div>
							<p className="signaly-field-hint">{l('tracksHint')}</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
