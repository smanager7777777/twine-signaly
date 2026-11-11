// «Twine СИГНАЛЫ»: окно «Радио» (шаг 7.2, ответ 1). Виды радио: тип (каркас один
// на тип, решение 125), цвет каркаса и элементов, надпись на каркасе, искры
// сломанного радио. Хранится в пассаже «Радио» с тегом sg-radio (signaly-radio.ts);
// справа — предпросмотр настоящим SugarCube. Ничего не пишется до «Сохранить».
// Шаг 7.3: отремонтированное радио — эфир: белый шум и его диапазоны, помехи (файл,
// ширина, громкость) и сколько их выпадает за раз, сообщение строки, время поимки.
// Сессия 29: свои цвета кнопок, выключателя, шкалы, каталога, внутреннего каркаса; предпросмотр —
// само радио во всё место справа. Шаг 7.4: тип «С реверсом» (каркас В2); «Сохранить» делает
// развёрнутые копии треков, если есть радио с реверсом.
// Сессия 30: порядок видов (▲▼) — порядок радио в игре (помехи прошлых радио выпадают и у следующих);
// помехи — в окне «Музыка», раздел «Помехи»; свои цвета лампочки и декодера; тип «С декодером» (Д2).

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, updatePassage, useStoriesContext} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {defaultAppearance, engineVersionIn, readAppearance, withEngine} from '../../util/signaly/signaly-appearance';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';
import {musicTag, readMusic, renameJamFolder, syncJamFolders} from '../../util/signaly/signaly-music';
import {
	newRadioView,
	radioFrames,
	RadioPartColor,
	radioPartColors,
	radioPartFor,
	radioPassageName,
	radioProblems,
	radioReady,
	radioTag,
	radioTypes,
	RadioView,
	readRadios,
	renameRadioView,
	writeRadios
} from '../../util/signaly/signaly-radio';
import {findBlocks} from '../../util/signaly/signaly-screen-blocks';
import {useLists} from '../passage-edit/signaly-block-panel';
import {SignalyAppearancePreview, SignalyPreviewMute} from '../signaly-appearance/signaly-appearance-preview';
import {ButtonsField, ChoiceField, ColorField, RangeField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {useReverseCopies} from '../signaly-reverse-copies';
import {pendingTemplateMusic, saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import '../signaly-ticker/signaly-ticker.css';

interface Row {
	key: number;
	/** Имя при открытии окна — чтобы при переименовании поправить блоки на экранах. */
	was: string;
	view: RadioView;
}

const previewName = 'СИГНАЛЫ: предпросмотр радио';

export const SignalyRadioWindow: React.FC<{onClose: () => void; story: Story}> = ({onClose, story}) => {
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.radio.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {gameFolder} = useGameFolder();
	const folder = gameFolder(story.id);
	const {media} = useLists(story);
	const passage = story.passages.find(p => p.tags.includes(radioTag)) ?? story.passages.find(p => p.name === radioPassageName);
	const keyRef = React.useRef(0);
	// Шаблон ещё на старой музыке: начать с вида, который даст перенос (шаг 7.2, ответ 5А).
	const [rows, setRows] = React.useState<Row[]>(() =>
		readRadios(passage?.text ?? (pendingTemplateMusic(story)?.radio || '')).map(view => ({key: keyRef.current++, was: view.name, view}))
	);
	const [selected, setSelected] = React.useState(0);
	const [saved, setSaved] = React.useState(true);
	const [refresh, setRefresh] = React.useState(0);
	const row = rows[selected];
	const savedColors = React.useMemo(() => (readAppearance(story.stylesheet) ?? defaultAppearance).savedColors, [story.stylesheet]);
	const views = rows.map(r => r.view);
	const copies = useReverseCopies(story);
	const p = radioProblems(views);
	const problems = (Object.keys(p) as Array<keyof typeof p>).filter(key => p[key]).map(key => l(`problems.${key}`));

	function used(name: string) {
		return story.passages.filter(ps => findBlocks(ps.text).some(b => b.type === 'radio' && b.values.view === name)).length;
	}

	function change(next: Row[]) {
		setRows(next);
		setSaved(false);
	}

	const setView = (patch: Partial<RadioView>) =>
		change(rows.map((r, i) => (i === selected ? {...r, view: {...r.view, ...patch}} : r)));

	function add(copy: boolean) {
		const base = copy && row ? row.view : undefined;
		const fresh = newRadioView(
			views.map(v => v.name),
			base ? base.name : l('newName')
		);

		change([...rows, {key: keyRef.current++, was: '', view: base ? {...base, extra: [...base.extra], name: fresh.name} : fresh}]);
		setSelected(rows.length);
	}

	// Порядок видов — порядок радио в игре (сессия 30): помехи радио выше выпадают и у радио ниже.
	function moveView(by: -1 | 1) {
		const next = [...rows];
		const [r] = next.splice(selected, 1);

		next.splice(selected + by, 0, r);
		change(next);
		setSelected(selected + by);
	}

	function remove() {
		const count = used(row.was);

		if (window.confirm(count > 0 ? l('confirmDeleteUsed', {name: row.view.name, count}) : l('confirmDelete', {name: row.view.name}))) {
			change(rows.filter((_, i) => i !== selected));
			setSelected(Math.max(0, selected - 1));
		}
	}

	function save() {
		const text = writeRadios(passage?.text ?? '', views);

		const pending = !passage && pendingTemplateMusic(story);

		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {script: withEngine(story.script)}, undefined, {radio: text});
		}
		if (pending) {
			// Пассаж «Радио» создал перенос музыки шаблона — с текстом окна.
		} else if (passage) {
			const tags = passage.tags.includes(radioTag) ? passage.tags : [...passage.tags, radioTag];

			if (text !== passage.text || tags !== passage.tags) {
				dispatch(updatePassage(story, passage, {text, tags}));
			}
		} else {
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name: radioPassageName, story: story.id, tags: [radioTag], text, ...freeSpot(story.passages)}
			});
		}
		// Переименованный вид — поправить блоки «Радио» на экранах и папку его помех в «Музыке».
		const musicPassage = story.passages.find(ps => ps.tags.includes(musicTag));
		let musicText = musicPassage?.text;

		for (const r of rows) {
			if (r.was && r.was !== r.view.name) {
				if (musicText !== undefined) {
					musicText = renameJamFolder(musicText, r.was, r.view.name);
				}
				for (const ps of story.passages) {
					const next = renameRadioView(ps.text, r.was, r.view.name);

					if (next !== ps.text) {
						dispatch({type: 'updatePassage', passageId: ps.id, storyId: story.id, props: {text: next}});
					}
				}
			}
		}
		if (musicPassage && musicText !== undefined && musicText !== musicPassage.text) {
			dispatch(updatePassage(story, musicPassage, {text: musicText}));
		}
		setRows(rows.map(r => ({...r, was: r.view.name})));
		setSaved(true);

		// Шаг 7.4: радио с реверсом — развёрнутые копии треков каталога (и помех, сессия 30).
		copies.run(
			syncJamFolders(readMusic(musicText ?? (pendingTemplateMusic(story)?.music || '')), views).catalog,
			views
		);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
		}
	}

	/* ----- Предпросмотр: экран с одним блоком «Радио» и несохранёнными видами ----- */

	const previewText = writeRadios(passage?.text ?? '', views);
	const pendingMusic = React.useMemo(() => (passage ? undefined : pendingTemplateMusic(story)?.music), [passage, story]);
	const previewStory = React.useMemo(() => {
		const others = story.passages.filter(ps => ps !== passage);
		const base = passage ?? story.passages[0];

		return {
			...story,
			script: engineVersionIn(story.script) < signalyEngineVersion ? withEngine(story.script) : story.script,
			passages: [
				...others,
				{...base, id: passage?.id ?? 'signaly-radio', name: passage?.name ?? radioPassageName, tags: [radioTag], text: previewText},
				// Шаблон ещё не переведён: каталог «Музыки», который даст перенос.
				...(pendingMusic ? [{...base, id: 'signaly-radio-music', name: 'Музыка', tags: ['sg-music'], text: pendingMusic}] : []),
				{
					...base,
					id: 'signaly-radio-preview',
					name: previewName,
					tags: [],
					text: row ? `<<sg-radio ${JSON.stringify(row.view.name)}>>` : ''
				}
			]
		};
	}, [passage, pendingMusic, previewText, row, story]);

	React.useEffect(() => {
		const timer = setTimeout(() => setRefresh(n => n + 1), 500);

		return () => clearTimeout(timer);
	}, [previewText, selected]);

	const s = t('signaly.appearance.units.seconds');
	// Помехи вида — папка раздела «Помехи» окна «Музыка» (сессия 30).
	const jamCount = React.useMemo(() => {
		const music = story.passages.find(ps => ps.tags.includes(musicTag));
		const catalog = syncJamFolders(readMusic(music?.text ?? ''), views).catalog;

		return (name: string) => catalog.folders.find(f => f.section === 'jam' && f.name === name)?.tracks.length ?? 0;
	}, [story.passages, views]);

	const audioOptions = (value: string) => [
		{label: l('noSound'), value: ''},
		...[...new Set([value, ...media.audio])].filter(Boolean).map(f => ({label: f, value: f}))
	];

	// Свой цвет части (сессия 29): пусто — как у элементов (внутренний каркас — как у каркаса).
	function partColor(v: RadioView, key: RadioPartColor) {
		if (!radioPartFor(key, v.type)) {
			return null;
		}

		// Лампочка по умолчанию — как шкала (сессия 30, ответ 6Б).
		const base = key === 'inner' ? v.frame : key === 'lamp' ? v.scale || v.elements : v.elements;

		return (
			<div className="signaly-radio-part" key={key}>
				<ColorField
					hint={v[key] ? undefined : l(key === 'inner' ? 'asFrame' : key === 'lamp' ? 'asScale' : 'asElements')}
					label={l(`parts.${key}`)}
					onChange={value => setView({[key]: value} as Partial<RadioView>)}
					onSaveColor={() => {}}
					savedColors={savedColors}
					value={v[key] || base}
				/>
				{v[key] && (
					<button className="signaly-small-button" onClick={() => setView({[key]: ''} as Partial<RadioView>)} type="button">
						{l(key === 'inner' ? 'resetFrame' : key === 'lamp' ? 'resetScale' : 'resetElements')}
					</button>
				)}
			</div>
		);
	}

	function editor(v: RadioView) {
		return (
			<>
				<TextField hint={l('nameHint')} label={l('name')} onChange={name => setView({name})} value={v.name} />
				<ButtonsField
					hint={l('typeHint')}
					label={l('type')}
					onChange={type => radioReady.includes(type as RadioView['type']) && setView({type: type as RadioView['type']})}
					options={radioTypes.map(type => ({
						label: l(`types.${type}`, {frame: radioFrames[type]}) + (radioReady.includes(type) ? '' : ` — ${l('later')}`),
						value: type
					}))}
					value={v.type}
				/>
				<h3>{l('colors')}</h3>
				<ColorField label={l('frame')} onChange={frame => setView({frame})} onSaveColor={() => {}} savedColors={savedColors} value={v.frame} />
				<ColorField
					hint={l('elementsHint')}
					label={l('elements')}
					onChange={elements => setView({elements})}
					onSaveColor={() => {}}
					savedColors={savedColors}
					value={v.elements}
				/>
				{radioPartColors.map(key => partColor(v, key))}
				<TextField hint={l('labelHint')} label={l('label')} onChange={label => setView({label})} value={v.label} />
				{(v.type === 'reverse' || v.type === 'decoder') && (
					<>
						<h3>{l('reverseTitle')}</h3>
						<p className="signaly-field-hint">{l('reverseHint')}</p>
					</>
				)}
				{v.type === 'decoder' && (
					<>
						<h3>{l('decoderTitle')}</h3>
						<p className="signaly-field-hint">{l('decoderHint')}</p>
					</>
				)}
				{v.type !== 'broken' && (
					<>
						<h3>{l('airTitle')}</h3>
						<p className="signaly-field-hint">{l('airHint')}</p>
						<TextField hint={l('incomingHint')} label={l('incoming')} onChange={incoming => setView({incoming})} value={v.incoming} />
						<RangeField
							hint={l('catchHint')}
							label={l('catch')}
							max={60}
							min={1}
							onChange={catchTime => setView({catchTime})}
							unit={s}
							value={v.catchTime}
						/>
						<h3>{l('noiseTitle')}</h3>
						<ChoiceField
							hint={media.audio.length === 0 ? t('signaly.blocks.noFiles') : l('noiseHint')}
							label={l('noise')}
							onChange={noise => setView({noise})}
							options={audioOptions(v.noise)}
							value={v.noise}
						/>
						{v.noise !== '' && (
							<>
								<RangeField label={l('noiseVolume')} max={100} min={0} onChange={noiseVolume => setView({noiseVolume})} unit="%" value={v.noiseVolume} />
								<TextField hint={l('noiseRangesHint')} label={l('noiseRanges')} onChange={noiseRanges => setView({noiseRanges})} value={v.noiseRanges} />
							</>
						)}
						<h3>{l('jamsTitle')}</h3>
						<p className="signaly-field-hint">{l('jamsMoved', {name: v.name, count: jamCount(row.was || v.name)})}</p>
						<RangeField label={l('jamsMin')} max={50} min={0} onChange={jamsMin => setView({jamsMin})} unit="" value={v.jamsMin} />
						<RangeField hint={l('jamsMaxHint', {files: jamCount(row.was || v.name)})} label={l('jamsMax')} max={50} min={0} onChange={jamsMax => setView({jamsMax})} unit="" value={v.jamsMax} />
					</>
				)}
				{v.type === 'broken' && (
					<>
						<h3>{l('sparksTitle')}</h3>
						<RangeField hint={l('sparksHint')} label={l('sparks')} max={100} min={0} onChange={sparks => setView({sparks})} unit="" value={v.sparks} />
						<ChoiceField
							hint={media.audio.length === 0 ? t('signaly.blocks.noFiles') : undefined}
							label={l('sparkSound')}
							onChange={sparkSound => setView({sparkSound})}
							options={audioOptions(v.sparkSound)}
							value={v.sparkSound}
						/>
						{v.sparkSound !== '' && (
							<RangeField
								label={l('sparkVolume')}
								max={100}
								min={0}
								onChange={sparkVolume => setView({sparkVolume})}
								unit="%"
								value={v.sparkVolume}
							/>
						)}
					</>
				)}
				<p className="signaly-field-hint">{l('used', {count: used(row.was)})}</p>
			</>
		);
	}

	return (
		<div aria-label={l('title')} aria-modal="true" className="signaly-appearance-window signaly-ticker-window signaly-radio-window" role="dialog">
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved ? t('signaly.appearance.saved') : t('signaly.appearance.unsaved')}
				</span>
				{copies.status && <span className="signaly-appearance-status signaly-reverse-status">{copies.status}</span>}
				<button className="signaly-button primary" disabled={saved || problems.length > 0} onClick={save} type="button">
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body">
				<div className="signaly-appearance-settings">
					<p className="signaly-field-hint">{l('intro')}</p>
					{problems.map(text => (
						<div className="signaly-notice" key={text}>
							{text}
						</div>
					))}
					<p className="signaly-field-hint">{l('orderHint')}</p>
					<div className="signaly-kinds-list">
						{rows.map((r, i) => (
							<button aria-pressed={i === selected} className="signaly-kinds-item" key={r.key} onClick={() => setSelected(i)} type="button">
								{r.view.name || l('noName')}
							</button>
						))}
					</div>
					<div className="signaly-sound-actions">
						<button className="signaly-button" onClick={() => add(false)} type="button">
							{l('add')}
						</button>
						<button className="signaly-button" disabled={!row} onClick={() => add(true)} type="button">
							{l('copy')}
						</button>
						<button className="signaly-button" disabled={!row} onClick={remove} type="button">
							{l('delete')}
						</button>
						<button className="signaly-button" disabled={!row || selected === 0} onClick={() => moveView(-1)} type="button">
							{l('up')}
						</button>
						<button className="signaly-button" disabled={!row || selected >= rows.length - 1} onClick={() => moveView(1)} type="button">
							{l('down')}
						</button>
					</div>
					{row ? editor(row.view) : <p className="signaly-field-hint">{l('empty')}</p>}
					<p className="signaly-field-hint">{l('where', {name: passage?.name ?? radioPassageName})}</p>
				</div>
				<div className="signaly-ticker-preview">
					<div className="signaly-ticker-preview-bar">
						<SignalyPreviewMute />
						<span className="signaly-field-hint">{l('previewHint')}</span>
					</div>
					{row && (
						<SignalyAppearancePreview
							baseUrl={folder ? folderToFileUrl(folder) : undefined}
							mode="passage"
							passageId="signaly-radio-preview"
							refresh={refresh}
							story={previewStory}
							zoom=".sg-radio"
						/>
					)}
				</div>
			</div>
		</div>
	);
};
