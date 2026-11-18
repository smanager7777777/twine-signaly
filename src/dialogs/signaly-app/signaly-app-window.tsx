// «Twine СИГНАЛЫ»: окно «Приложение» (сессия 32, этап Т2 — claude/13 раздел 6б).
// Пакет приложения .sgpack загружается в историю (пассаж «Приложение», блоки
// app-block, персонажи и коды телефона в «Кодах», файлы — media/app/ папки игры) и
// собирается из неё обратно. Повторная загрузка сначала показывает, что поменяется
// (П-61 Т2-11).
// Сессия 33 (этап Т3): вкладки с формами — Общее, Главы и стили, Приборы, Сеть и события,
// Голос (signaly-app-tabs.tsx) и предпросмотр телефона справа (signaly-app-preview.tsx).
// Формы ничего не пишут в историю до «Сохранить»; пока есть несохранённое, «Загрузить» и
// «Собрать» недоступны (собирается то, что в истории).

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {TwineElectronWindow} from '../../electron/shared';
import {Passage, Story, useStoriesContext} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {
	engineVersionIn,
	withEngine
} from '../../util/signaly/signaly-appearance';
import {
	AppDiff,
	AppFiles,
	AppGame,
	appBlockColor,
	appBlockTag,
	appSections,
	appSettingsColor,
	appSettingsName,
	appSettingsTag,
	codesPassageOf,
	diffGames,
	gameToStory,
	hasAppData,
	readSgpack,
	settingsPassageOf,
	storyToGame,
	writeSettings,
	writeSgpack
} from '../../util/signaly/signaly-app';
import {codesHeader, codesPassageName, codesTag, readCodes, writeCodes} from '../../util/signaly/signaly-codes';
import {readSettings} from '../../util/signaly/signaly-app';
import {appRefs, newSettings} from '../../util/signaly/signaly-app-model';
import {AppRefsContext, usePhoneL} from './signaly-app-fields';
import {AppPreview} from './signaly-app-preview';
import {BlocksTab} from './signaly-app-blocks';
import {QrTab, SstvTab} from './signaly-app-media-tabs';
import {addPassageEditors, useDialogsContext} from '../context';
import {
	AppTab,
	appTabs,
	ChaptersTab,
	DevicesTab,
	EventsSub,
	EventsTab,
	GeneralTab,
	TabProps,
	VoiceTab
} from './signaly-app-tabs';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-keys/signaly-keys.css';
import '../signaly-sounds/signaly-sounds.css';
import '../passage-edit/signaly-format-toolbar.css';
import './signaly-app.css';
import {signalyEngineVersion} from '../../util/signaly/signaly-engine';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-check/signaly-check.css';

export interface SignalyAppWindowProps {
	onClose: () => void;
	story: Story;
}

interface Pending {
	name: string;
	game: AppGame;
	files: AppFiles;
	diff: AppDiff[];
	first: boolean;
}

function bridge() {
	return (window as TwineElectronWindow).twineElectron;
}

export const SignalyAppWindow: React.FC<SignalyAppWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) =>
		t(`signaly.app.${key}`, options);
	const {dispatch, stories} = useStoriesContext();
	const {available, gameFolder} = useGameFolder();
	const folder = available ? gameFolder(story.id) : undefined;
	const [pending, setPending] = React.useState<Pending>();
	const [message, setMessage] = React.useState<string[]>([]);
	const [busy, setBusy] = React.useState(false);
	const fileInput = React.useRef<HTMLInputElement>(null);
	const current = React.useMemo(
		() => storyToGame(story.passages),
		[story.passages]
	);
	const has = hasAppData(story.passages);
	const pl = usePhoneL();
	const dialogs = useDialogsContext();

	/* ----- формы (сессия 33) ----- */

	const settingsPassage = settingsPassageOf(story.passages);
	const codesPassage = codesPassageOf(story.passages);
	const fresh = React.useCallback(
		() => ({
			game: settingsPassage ? readSettings(settingsPassage.text).game : newSettings(story.name),
			table: readCodes(codesPassage?.text ?? '')
		}),
		[codesPassage, settingsPassage, story.name]
	);
	const [work, setWork] = React.useState(fresh);
	const [dirty, setDirty] = React.useState({game: false, table: false});
	const [tab, setTab] = React.useState<AppTab>(has ? 'general' : 'pack');
	const [evSub, setEvSub] = React.useState<EventsSub>('notices');
	const [sel, setSelState] = React.useState<Record<string, number>>({});
	const [shown, setShown] = React.useState(0);
	const [phone, setPhone] = React.useState(true);
	const saved = !dirty.game && !dirty.table;
	const source = `${settingsPassage?.text ?? ''}\u0000${codesPassage?.text ?? ''}`;

	// Историю поменяли не формы (загрузка пакета, другое окно) — формы берут новое.
	React.useEffect(() => {
		if (saved) {
			setWork(fresh());
		}
	}, [source]); // eslint-disable-line

	const refs = React.useMemo(() => appRefs(story.passages, work.table, work.game), [story.passages, work]);
	const tabProps: TabProps = {
		game: work.game,
		setGame: game => {
			setWork(w => ({...w, game}));
			setDirty(d => ({...d, game: true}));
		},
		table: work.table,
		setTable: table => {
			setWork(w => ({...w, table}));
			setDirty(d => ({...d, table: true}));
		},
		sel,
		setSel: (key, i) => setSelState(x => ({...x, [key]: i}))
	};

	function save() {
		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {script: withEngine(story.script)});
		}
		if (dirty.game) {
			const text = writeSettings(work.game);

			if (settingsPassage) {
				dispatch({type: 'updatePassage', storyId: story.id, passageId: settingsPassage.id, props: {text}});
			} else {
				dispatch({
					type: 'createPassage',
					storyId: story.id,
					props: {
						name: story.passages.some(p => p.name === appSettingsName) ? `${appSettingsName} (пакет)` : appSettingsName,
						story: story.id,
						tags: [appSettingsTag],
						text,
						...freeSpot(story.passages)
					}
				});
				dispatch({
					type: 'updateStory',
					storyId: story.id,
					props: {
						tagColors: {
							...story.tagColors,
							[appBlockTag]: story.tagColors[appBlockTag] ?? appBlockColor,
							[appSettingsTag]: story.tagColors[appSettingsTag] ?? appSettingsColor
						}
					}
				});
			}
		}
		if (dirty.table) {
			if (codesPassage) {
				dispatch({type: 'updatePassage', storyId: story.id, passageId: codesPassage.id, props: {text: writeCodes(codesPassage.text, work.table)}});
			} else {
				dispatch({
					type: 'createPassage',
					storyId: story.id,
					props: {name: codesPassageName, story: story.id, tags: [codesTag], text: writeCodes(codesHeader, work.table), ...freeSpot(story.passages)}
				});
			}
		}
		setDirty({game: false, table: false});
		setShown(n => n + 1);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
			return true;
		}
		return false;
	}

	/** «Блоки» → блок: окно закрывается, открывается пассаж (сессия 34). */
	function openPassage(passageId: string) {
		if (close()) {
			dialogs.dispatch(addPassageEditors(story.id, [passageId]));
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

	function summary(game: AppGame) {
		return appSections
			.map(
				([key]) =>
					[key, Array.isArray(game[key]) ? game[key].length : 0] as const
			)
			.filter(([, n]) => n > 0)
			.map(([key, n]) => `${n} ${l(`sections.${key}`)}`)
			.join(', ');
	}

	async function appFiles() {
		const b = bridge();

		return folder && b?.signalyListAppFiles
			? b.signalyListAppFiles(folder)
			: [];
	}

	async function readFiles(list: Array<{name: string; path: string}>) {
		const b = bridge();
		const files: AppFiles = {};
		const missing: string[] = [];

		for (const f of list) {
			try {
				if (!folder || !b) {
					throw new Error('no folder');
				}
				files[f.name] = await b.signalyReadMedia(folder, f.path);
			} catch {
				missing.push(f.path);
			}
		}
		return {files, missing};
	}

	/* ----- загрузка пакета ----- */

	async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];

		event.target.value = '';
		if (!file) {
			return;
		}
		setBusy(true);
		setMessage([]);
		try {
			const pack = readSgpack(new Uint8Array(await file.arrayBuffer()));
			const was = has
				? storyToGame(story.passages, await appFiles())
				: undefined;
			const wasFiles = was ? (await readFiles(was.files)).files : {};

			setPending({
				name: file.name,
				game: pack.game,
				files: pack.files,
				diff: was ? diffGames(was.game, pack.game, wasFiles, pack.files) : [],
				first: !was
			});
		} catch (e) {
			setMessage([l('badPack', {error: String((e as Error).message ?? e)})]);
		} finally {
			setBusy(false);
		}
	}

	async function apply() {
		if (!pending) {
			return;
		}
		setBusy(true);
		// Движок с кодами «только телефон» (версия 29) — до правок пассажей.
		if (engineVersionIn(story.script) < signalyEngineVersion) {
			saveStoryWithUpgrade(dispatch, stories, story, {
				script: withEngine(story.script)
			});
		}

		const r = gameToStory(
			story.passages,
			pending.game,
			Object.keys(pending.files)
		);
		const byName = (name: string) => story.passages.find(p => p.name === name);
		const remove = r.removeBlocks.map(byName).filter((p): p is Passage => !!p);
		let spot = freeSpot(story.passages);
		const place = () => {
			const at = spot;

			spot = {left: spot.left, top: spot.top + 125};
			return at;
		};
		const update = (passage: Passage, changes: Partial<Passage>) =>
			dispatch({
				type: 'updatePassage',
				storyId: story.id,
				passageId: passage.id,
				props: changes
			});
		const create = (name: string, tags: string[], text: string) =>
			dispatch({
				type: 'createPassage',
				storyId: story.id,
				props: {name, story: story.id, tags, text, ...place()}
			});

		if (remove.length) {
			dispatch({
				type: 'deletePassages',
				storyId: story.id,
				passageIds: remove.map(p => p.id)
			});
		}

		// Блоки: сначала временные имена (два блока могут поменяться названиями).
		const renamed = r.blocks
			.filter(b => b.existing && b.existing !== b.name)
			.map(b => ({b, p: byName(b.existing!)!}));

		renamed.forEach(({p}) => update(p, {name: `${p.name} ~${p.id}`}));
		r.blocks.forEach(b => {
			const p = b.existing ? byName(b.existing) : undefined;

			if (p) {
				update(p, {
					name: b.name,
					text: b.text,
					tags: p.tags.includes(appBlockTag) ? p.tags : [...p.tags, appBlockTag]
				});
			} else {
				create(b.name, [appBlockTag], b.text);
			}
		});

		const settings = settingsPassageOf(story.passages);

		if (settings) {
			update(settings, {text: r.settingsText});
		} else {
			create(
				story.passages.some(p => p.name === appSettingsName)
					? `${appSettingsName} (пакет)`
					: appSettingsName,
				[appSettingsTag],
				r.settingsText
			);
		}

		const codes = codesPassageOf(story.passages);

		if (codes) {
			update(codes, {
				text: r.codesText,
				tags: codes.tags.includes(codesTag)
					? codes.tags
					: [...codes.tags, codesTag]
			});
		} else if (pending.game.accounts?.length || pending.game.codes?.length) {
			create(codesPassageName, [codesTag], r.codesText);
		}
		dispatch({
			type: 'updateStory',
			storyId: story.id,
			props: {
				tagColors: {
					...story.tagColors,
					[appBlockTag]: story.tagColors[appBlockTag] ?? appBlockColor,
					[appSettingsTag]: story.tagColors[appSettingsTag] ?? appSettingsColor
				}
			}
		});
		const notes = [l('applied', {summary: summary(pending.game) || '—'})];

		if (r.numbered.length) {
			notes.push(l('numbered', {list: r.numbered.join(', ')}));
		}

		const b = bridge();
		const names = Object.keys(pending.files);

		if (names.length && folder && b?.signalyWriteAppFile) {
			for (const f of r.files) {
				await b.signalyWriteAppFile(folder, f.path, pending.files[f.name]);
			}
			notes.push(l('filesWritten', {n: names.length}));
		} else if (names.length) {
			notes.push(l('filesSkipped', {n: names.length}));
		}
		setPending(undefined);
		setMessage(notes);
		setBusy(false);
	}

	/* ----- сборка пакета ----- */

	async function build() {
		setBusy(true);
		setMessage([]);
		try {
			const built = storyToGame(story.passages, await appFiles());
			const {files, missing} = await readFiles(built.files);
			const game: AppGame = {
				...built.game,
				version: (parseInt(String(built.game.version), 10) || 0) + 1
			};
			const data = writeSgpack(game, files);
			const name = `${String(game.title || story.name).replace(/[\\/:*?"<>|]+/g, '_')}-v${game.version}.sgpack`;
			const b = bridge();
			const notes: string[] = [];

			if (folder && b?.signalyWriteAppPack) {
				const path = await b.signalyWriteAppPack(folder, name, data);

				notes.push(
					l('built', {
						path,
						version: game.version,
						files: Object.keys(files).length
					})
				);
			} else {
				const {saveAs} = await import('file-saver');

				saveAs(new Blob([data], {type: 'application/zip'}), name);
				notes.push(
					l('builtDownload', {
						name,
						version: game.version,
						files: Object.keys(files).length
					})
				);
			}
			// Номер версии — в пассаж «Приложение» (как «Сохранить» в редакторе приложения).
			const settings = settingsPassageOf(story.passages);

			if (settings) {
				dispatch({
					type: 'updatePassage',
					storyId: story.id,
					passageId: settings.id,
					props: {text: writeSettings(game)}
				});
			}
			if (missing.length) {
				notes.push(l('missing', {list: missing.join(', ')}));
			}
			notes.push(...built.problems);
			setMessage(notes);
		} catch (e) {
			setMessage([String((e as Error).message ?? e)]);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			aria-label={l('title')}
			aria-modal="true"
			className="signaly-appearance-window signaly-check-window signaly-app-window"
			role="dialog"
		>
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved ? t('signaly.appearance.saved') : t('signaly.appearance.unsaved')}
				</span>
				<button className="signaly-button primary" disabled={saved} onClick={save} type="button">
					{t('signaly.appearance.save')}
				</button>
				<button
					className="signaly-button"
					disabled={busy || !saved}
					onClick={() => fileInput.current?.click()}
					title={saved ? undefined : pl('saveFirst')}
					type="button"
				>
					{l('load')}
				</button>
				<button
					className="signaly-button"
					disabled={busy || !has || !saved}
					onClick={build}
					title={saved ? undefined : pl('saveFirst')}
					type="button"
				>
					{l('build')}
				</button>
				<button aria-pressed={phone} className="signaly-button" onClick={() => setPhone(!phone)} type="button">
					{pl('preview.toggle')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
				<input
					accept=".sgpack,.zip"
					hidden
					onChange={chooseFile}
					ref={fileInput}
					type="file"
				/>
			</header>
			<div className={phone ? 'signaly-app-body with-phone' : 'signaly-app-body'}>
				<div className="signaly-app-main">
				<div className="signaly-tabs" role="tablist">
					{appTabs.map(name => (
						<button aria-selected={tab === name} className="signaly-tab" key={name} onClick={() => setTab(name)} role="tab" type="button">
							{pl(`tabs.${name}`)}
						</button>
					))}
				</div>
				<AppRefsContext.Provider value={refs}>
					{tab === 'general' && <GeneralTab {...tabProps} />}
					{tab === 'chapters' && <ChaptersTab {...tabProps} />}
					{tab === 'apps' && <DevicesTab {...tabProps} />}
					{tab === 'events' && <EventsTab {...tabProps} setSub={setEvSub} sub={evSub} />}
					{tab === 'voice' && <VoiceTab {...tabProps} />}
					{tab === 'blocks' && <BlocksTab onOpen={openPassage} story={story} />}
					{tab === 'qr' && <QrTab folder={folder} game={work.game} table={work.table} />}
					{tab === 'sstv' && <SstvTab folder={folder} story={story} />}
				</AppRefsContext.Provider>
				{tab === 'pack' && (
				<>
				<p className="signaly-field-hint">{l('intro')}</p>
				{available && !folder && (
					<div className="signaly-notice">{l('noFolder')}</div>
				)}
				{busy && <p>{l('working')}</p>}
				{message.length > 0 && (
					<div className="signaly-notice signaly-app-message">
						{message.map(m => (
							<p key={m}>{m}</p>
						))}
					</div>
				)}
				{pending && (
					<section className="signaly-check-group signaly-app-pending">
						<h3>
							{l('loaded', {
								name: pending.name,
								summary: summary(pending.game) || '—'
							})}
						</h3>
						{pending.first ? (
							<p>{l('firstLoad')}</p>
						) : pending.diff.length === 0 ? (
							<p>{l('same')}</p>
						) : (
							<>
								<p>
									<b>{l('diffTitle')}</b>
								</p>
								<ul>
									{pending.diff.map(d => (
										<li key={d.section}>
											<b>{d.section}:</b>
											{d.added.length > 0 &&
												` ${l('added')}: ${d.added.join(', ')};`}
											{d.removed.length > 0 &&
												` ${l('removed')}: ${d.removed.join(', ')};`}
											{d.changed.length > 0 &&
												` ${l('changed')}: ${d.changed.join(', ')}`}
										</li>
									))}
								</ul>
							</>
						)}
						<button
							className="signaly-button primary"
							disabled={busy}
							onClick={apply}
							type="button"
						>
							{pending.first ? l('apply') : l('replace')}
						</button>{' '}
						<button
							className="signaly-button"
							onClick={() => setPending(undefined)}
							type="button"
						>
							{l('cancel')}
						</button>
					</section>
				)}
				<section className="signaly-check-group">
					<h3>{l('inStory')}</h3>
					<p>{has ? summary(current.game) || '—' : l('empty')}</p>
					{current.problems.length > 0 && (
						<>
							<p>
								<b>{l('problems')}:</b>
							</p>
							<ul>
								{current.problems.map(p => (
									<li key={p}>{p}</li>
								))}
							</ul>
						</>
					)}
				</section>
				</>
				)}
				</div>
				{phone && (
					<AppPreview folder={folder} game={work.game} story={story} table={work.table} version={shown} />
				)}
			</div>
		</div>
	);
};
