// «Twine СИГНАЛЫ»: окно «Музыка» (шаг 7.1, ответы 3А, 4А). Каталог общего плеера:
// разделы «Атмосфера» и «Радио», в них папки, в папках треки (файл, условие,
// предзвук, начальная громкость); общие настройки — громкость в начале игры,
// время кручения цифр, «АВТО». Хранится в пассаже «Музыка» с тегом sg-music
// (signaly-music.ts). Ничего не записывается в историю до «Сохранить».
// Шаг 7.3: папки внутри папок (ответ 1Б), громкость файла (2А), раздел «Эфир» —
// передачи отремонтированного радио: куда после поимки, ширина, своё сообщение (3А, 5А, 6).
// Шаг 7.4: у треков радио и передач — «Файл задом наперёд» (свой, ответ 2А); «Сохранить» делает
// развёрнутые копии остальных (ответ 1А), если в истории есть радио с реверсом.
// Сессия 30: раздел «Помехи» — папки по видам радио с эфиром (по порядку окна «Радио»), папки сами не
// создаются; старые помехи видов переносятся сюда при открытии окна. «Сохранить» ещё разбирает помехи
// и передачи на картинки SSTV (для радио с декодером).

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
	folderDepth,
	folderInside,
	folderLeaf,
	folderParent,
	folderSections,
	jamWidth,
	MusicCatalog,
	MusicFolder,
	musicPassageName,
	musicProblems,
	musicSections,
	musicTag,
	MusicTrack,
	readMusic,
	syncJamFolders,
	trackDefaults,
	treeOrder,
	writeMusic
} from '../../util/signaly/signaly-music';
import {radioTag, readRadios, withoutLegacyJams} from '../../util/signaly/signaly-radio';
import {needsReverse} from '../../util/signaly/signaly-reverse';
import {newsConds} from '../../util/signaly/signaly-ticker';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {CheckField, ChoiceField, RangeField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {CondListsContext, CondRows, useCondLists} from '../passage-edit/signaly-logic-form';
import {useLists} from '../passage-edit/signaly-block-panel';
import {useReverseCopies} from '../signaly-reverse-copies';
import {useSstvImages} from '../signaly-sstv-images';
import {pendingTemplateMusic, saveStoryWithUpgrade} from '../signaly-upgrade';
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

/** Где кончается папка вместе со вложенными (список — в порядке дерева). */
function blockEnd(folders: MusicFolder[], index: number) {
	let end = index + 1;

	while (end < folders.length && folderInside(folders[end].name, folders[index].name)) {
		end++;
	}
	return end;
}

/** Соседняя папка того же уровня выше (-1) или ниже (+1); -1 — нет. */
function sibling(folders: MusicFolder[], index: number, by: -1 | 1) {
	const f = folders[index];
	const parent = folderParent(f.name);
	const same = (g: MusicFolder) => folderParent(g.name) === parent && g.section === f.section;

	if (by < 0) {
		for (let i = index - 1; i >= 0; i--) {
			if (same(folders[i])) {
				return i;
			}
			if (!folderInside(folders[i].name, parent) && parent) {
				return -1;
			}
		}
		return -1;
	}
	for (let i = blockEnd(folders, index); i < folders.length; i++) {
		if (same(folders[i])) {
			return i;
		}
		if (parent && !folderInside(folders[i].name, parent)) {
			return -1;
		}
	}
	return -1;
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
	// Виды радио истории: есть радио с реверсом — нужны развёрнутые копии (шаг 7.4); радио с эфиром —
	// папки раздела «Помехи» (сессия 30).
	const radioPassage = story.passages.find(p => p.tags.includes(radioTag));
	const radioViews = React.useMemo(
		() => readRadios(radioPassage?.text ?? (pendingTemplateMusic(story)?.radio || '')),
		[radioPassage, story]
	);
	// Шаг 7.2: шаблон ещё на старой музыке — начать с каталога, который даст перенос.
	const [start] = React.useState(() =>
		syncJamFolders(readMusic(musicPassage?.text ?? (pendingTemplateMusic(story)?.music || '')), radioViews)
	);
	const [catalog, setCatalog] = React.useState<MusicCatalog>(start.catalog);
	const [selected, setSelected] = React.useState(0);
	// Старые помехи видов перенесены сюда — их нужно сохранить.
	const [saved, setSaved] = React.useState(start.migrated.length === 0);
	const [migrated, setMigrated] = React.useState(start.migrated);
	const folder = catalog.folders[selected];
	const jamFolder = folder?.section === 'jam';
	const orphan = jamFolder && !radioViews.some(v => v.type !== 'broken' && v.name === folder.name);
	const s = t('signaly.appearance.units.seconds');
	const reversing = needsReverse(radioViews);
	const copies = useReverseCopies(story);
	// Сессия 30: радио с декодером — картинки SSTV из помех и передач.
	const sstv = useSstvImages(story);

	function change(next: MusicCatalog) {
		setCatalog(next);
		setSaved(false);
	}

	const setFolders = (folders: MusicFolder[]) => change({...catalog, folders});
	const setFolder = (patch: Partial<MusicFolder>) =>
		setFolders(catalog.folders.map((f, i) => (i === selected ? {...f, ...patch} : f)));
	const radioFolders = catalog.folders.filter(f => f.section === 'radio').map(f => f.name);

	// Переименовать папку: свои вложенные и передачи эфира, которые ведут в неё, — тоже.
	function renameFolder(leaf: string) {
		const old = folder.name;
		const parent = folderParent(old);
		const name = parent ? `${parent}/${leaf}` : leaf;
		const moved = (n: string) => (n === old ? name : folderInside(n, old) ? name + n.slice(old.length) : n);

		setFolders(
			catalog.folders.map(f => ({
				...f,
				name: moved(f.name),
				tracks: f.section === 'air' ? f.tracks.map(tr => (tr.to ? {...tr, to: moved(tr.to)} : tr)) : f.tracks
			}))
		);
	}

	// Раздел меняется у верхней папки — у вложенных он тот же.
	function setSection(section: MusicFolder['section']) {
		setFolders(catalog.folders.map(f => (f === folder || folderInside(f.name, folder.name) ? {...f, section} : f)));
	}

	function moveFolder(by: -1 | 1) {
		const other = sibling(catalog.folders, selected, by);

		if (other < 0) {
			return;
		}

		const [a, b] = by < 0 ? [other, selected] : [selected, other];
		const list = catalog.folders;
		const next = [...list.slice(0, a), ...list.slice(b, blockEnd(list, b)), ...list.slice(a, b), ...list.slice(blockEnd(list, b))];

		setFolders(next);
		setSelected(next.indexOf(folder));
	}
	const setTracks = (tracks: MusicTrack[]) => setFolder({tracks});
	const setTrack = (index: number, patch: Partial<MusicTrack>) =>
		setTracks(folder.tracks.map((tr, i) => (i === index ? {...tr, ...patch} : tr)));

	const p = musicProblems(catalog);
	const problems = (Object.keys(p) as Array<keyof typeof p>).filter(key => p[key]).map(key => l(`problems.${key}`));

	function save() {
		const text = writeMusic(musicPassage?.text ?? '', catalog);

		const pending = !musicPassage && pendingTemplateMusic(story);

		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {script: withEngine(story.script)}, undefined, {music: text});
		}
		if (pending) {
			// Пассаж «Музыка» создал перенос музыки шаблона — с текстом окна.
		} else if (musicPassage) {
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
		// Сессия 30: помехи вида теперь здесь — убрать старую запись у вида.
		if (radioPassage) {
			const radioText = withoutLegacyJams(
				radioPassage.text,
				catalog.folders.filter(f => f.section === 'jam').map(f => f.name)
			);

			if (radioText !== radioPassage.text) {
				dispatch(updatePassage(story, radioPassage, {text: radioText}));
			}
		}
		setSaved(true);
		setMigrated([]);
		copies.run(catalog, radioViews);
		sstv.run(catalog, radioViews);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	// Новая папка — в конце раздела; вложенная (inside) — в конце выбранной папки.
	function addFolder(section: MusicFolder['section'], inside?: MusicFolder) {
		const prefix = inside ? inside.name + '/' : '';
		let n = 1;

		while (catalog.folders.some(f => f.name === prefix + l('newFolder', {n}))) {
			n++;
		}

		const fresh: MusicFolder = {name: prefix + l('newFolder', {n}), section: inside ? inside.section : section, tip: '', tracks: []};
		const next = inside
			? [...catalog.folders.slice(0, blockEnd(catalog.folders, selected)), fresh, ...catalog.folders.slice(blockEnd(catalog.folders, selected))]
			: treeOrder([...catalog.folders, fresh]);

		change({...catalog, folders: next});
		setSelected(next.indexOf(fresh));
	}

	function removeFolder() {
		const end = blockEnd(catalog.folders, selected);

		if (folder && window.confirm(l(end - selected > 1 ? 'confirmDeleteNested' : 'confirmDelete', {name: folder.name, nested: end - selected - 1}))) {
			setFolders(catalog.folders.filter((_, i) => i < selected || i >= end));
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
		const air = folder.section === 'air';
		const jam = folder.section === 'jam';

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
				<RangeField hint={l('gainHint')} label={l('gain')} max={100} min={1} onChange={gain => setTrack(index, {gain})} unit="%" value={track.gain} />
				{jam && (
					<RangeField
						hint={l('jamWidthHint')}
						label={l('width')}
						max={10}
						min={0.1}
						onChange={width => setTrack(index, {width})}
						step={0.1}
						unit={l('mhz')}
						value={track.width}
					/>
				)}
				{air && (
					<>
						<ChoiceField
							hint={l('toHint')}
							label={l('to')}
							onChange={to => setTrack(index, {to})}
							options={[
								{label: l('toNone'), value: ''},
								...[...new Set([...radioFolders, ...(track.to ? [track.to] : [])])].map(name => ({label: name, value: name}))
							]}
							value={track.to}
						/>
						<RangeField
							hint={l('widthHint')}
							label={l('width')}
							max={10}
							min={0.1}
							onChange={width => setTrack(index, {width})}
							step={0.1}
							unit={l('mhz')}
							value={track.width}
						/>
						{track.to !== '' && <TextField hint={l('textHint')} label={l('text')} onChange={text => setTrack(index, {text})} value={track.text} />}
					</>
				)}
				<h4 className="signaly-block-subtitle">{air ? l('whenAir') : jam ? l('whenJam') : l('when')}</h4>
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
				{reversing && folder.section !== 'ambient' && (!air || track.to !== '') && (
					<ChoiceField
						hint={l('reverseHint')}
						label={l('reverse')}
						onChange={reverse => setTrack(index, {reverse})}
						options={[
							{label: l('reverseAuto'), value: ''},
							...[...new Set([track.reverse, ...media.audio])].filter(Boolean).map(f => ({label: f, value: f}))
						]}
						value={track.reverse}
					/>
				)}
				{!air && (
					<CheckField
						hint={l('preHint')}
						label={l('pre')}
						onChange={on => setTrack(index, on ? {pre: media.audio[0] ?? 'media/audio/'} : {pre: ''})}
						value={track.pre !== ''}
					/>
				)}
				{!air && track.pre !== '' && (
					<>
						{audioChoice(l('preFile'), track.pre, pre => setTrack(index, {pre}))}
						<RangeField label={l('wait')} max={30} min={0} onChange={wait => setTrack(index, {wait})} step={0.5} unit={s} value={track.wait} />
						<RangeField label={l('tail')} max={30} min={0} onChange={tail => setTrack(index, {tail})} step={0.5} unit={s} value={track.tail} />
						<RangeField label={l('preVolume')} max={100} min={0} onChange={preVolume => setTrack(index, {preVolume})} unit="%" value={track.preVolume} />
					</>
				)}
				{!air && (
					<CheckField
						hint={l('startHint')}
						label={l('start')}
						onChange={on => setTrack(index, {start: on ? catalog.settings.volume : undefined})}
						value={track.start !== undefined}
					/>
				)}
				{!air && track.start !== undefined && (
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
				{copies.status && <span className="signaly-appearance-status signaly-reverse-status">{copies.status}</span>}
				{sstv.status && <span className="signaly-appearance-status signaly-reverse-status signaly-sstv-status">{sstv.status}</span>}
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
							{section === 'air' && <p className="signaly-field-hint">{l('airHint')}</p>}
							{section === 'jam' && <p className="signaly-field-hint">{l('jamHint')}</p>}
							{section === 'jam' && migrated.length > 0 && (
								<div className="signaly-notice">{l('jamMigrated', {names: migrated.join(', ')})}</div>
							)}
							<div className="signaly-kinds-list">
								{catalog.folders.map((f, i) =>
									f.section !== section ? null : (
										<button
											aria-label={f.name || l('noName')}
											aria-pressed={i === selected}
											className="signaly-kinds-item"
											key={i}
											onClick={() => setSelected(i)}
											style={{paddingLeft: `${0.6 + folderDepth(f.name) * 1.4}em`}}
											type="button"
										>
											{folderDepth(f.name) > 0 ? '└ ' : ''}
											{folderLeaf(f.name) || l('noName')}
											<span className="signaly-sound-file">{l('count', {count: f.tracks.length})}</span>
										</button>
									)
								)}
							</div>
							{section !== 'jam' && (
								<div className="signaly-sound-actions">
									<button className="signaly-button" onClick={() => addFolder(section)} type="button">
										{l('addFolder')}
									</button>
								</div>
							)}
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
							{jamFolder ? (
								<>
									<h3>{l('jamFolder', {name: folder.name})}</h3>
									<p className="signaly-field-hint">{orphan ? l('jamOrphan') : l('jamFolderHint')}</p>
								</>
							) : (
								<TextField
									hint={folderParent(folder.name) ? l('folderInHint', {parent: folderParent(folder.name)}) : l('folderHint')}
									label={l('folderName')}
									onChange={renameFolder}
									value={folderLeaf(folder.name)}
								/>
							)}
							{!folderParent(folder.name) && !jamFolder && (
								<ChoiceField
									label={l('section')}
									onChange={section => setSection(section as MusicFolder['section'])}
									options={folderSections.map(v => ({label: l(`sections.${v}`), value: v}))}
									value={folder.section}
								/>
							)}
							{folder.section === 'ambient' && (
								<TextField hint={l('tipHint')} label={l('tip')} onChange={tip => setFolder({tip})} value={folder.tip} />
							)}
							<div className="signaly-sound-actions" hidden={jamFolder && !orphan}>
								<button
									className="signaly-button"
									hidden={jamFolder}
									disabled={sibling(catalog.folders, selected, -1) < 0}
									onClick={() => moveFolder(-1)}
									type="button"
								>
									{l('up')}
								</button>
								<button
									className="signaly-button"
									hidden={jamFolder}
									disabled={sibling(catalog.folders, selected, 1) < 0}
									onClick={() => moveFolder(1)}
									type="button"
								>
									{l('down')}
								</button>
								<button className="signaly-button" hidden={jamFolder} onClick={() => addFolder(folder.section, folder)} type="button">
									{l('addSubfolder')}
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
										setTracks([
								...folder.tracks,
								{...trackDefaults, ...(jamFolder ? {width: jamWidth} : {}), name: l('newTrack', {n: folder.tracks.length + 1}), src: ''}
							])
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
