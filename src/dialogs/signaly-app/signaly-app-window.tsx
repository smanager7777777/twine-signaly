// «Twine СИГНАЛЫ»: окно «Приложение» (сессия 32, этап Т2 — claude/13 раздел 6б).
// Пакет приложения .sgpack загружается в историю (пассаж «Приложение», блоки
// app-block, персонажи и коды телефона в «Кодах», файлы — media/app/ папки игры) и
// собирается из неё обратно. Повторная загрузка сначала показывает, что поменяется
// (П-61 Т2-11). Вкладки с формами — этап Т3.

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
import {codesPassageName, codesTag} from '../../util/signaly/signaly-codes';
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

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

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
				<button
					className="signaly-button"
					disabled={busy}
					onClick={() => fileInput.current?.click()}
					type="button"
				>
					{l('load')}
				</button>
				<button
					className="signaly-button primary"
					disabled={busy || !has}
					onClick={build}
					type="button"
				>
					{l('build')}
				</button>
				<button className="signaly-button" onClick={onClose} type="button">
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
			<div className="signaly-check-body">
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
			</div>
		</div>
	);
};
