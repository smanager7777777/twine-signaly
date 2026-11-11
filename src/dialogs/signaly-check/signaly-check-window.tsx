// «Twine СИГНАЛЫ»: окно «Проверка истории» (сессия 25, ответ 2А). Список того,
// что в живой игре всплывёт ошибкой; щелчок по экрану открывает его. История не
// меняется.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {addPassageEditors, useDialogsContext} from '../context';
import {MediaKind} from '../../electron/shared';
import {Story} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {CheckKind, CheckProblem, checkStory} from '../../util/signaly/signaly-check';
import {MusicCatalog, musicTag, readMusic} from '../../util/signaly/signaly-music';
import {radioTag, readRadios} from '../../util/signaly/signaly-radio';
import {needsReverse, ReverseJob, reverseJobs} from '../../util/signaly/signaly-reverse';
import {makeReverseCopies} from '../signaly-reverse-copies';
import {TwineElectronWindow} from '../../electron/shared';
import '../signaly-appearance/signaly-appearance.css';
import '../signaly-kinds/signaly-kinds.css';
import '../signaly-sounds/signaly-sounds.css';
import './signaly-check.css';

export interface SignalyCheckWindowProps {
	onClose: () => void;
	story: Story;
}

const kinds: CheckKind[] = ['screen', 'media', 'variable', 'code'];
const mediaKinds: MediaKind[] = ['img', 'audio', 'video', 'fonts'];

export const SignalyCheckWindow: React.FC<SignalyCheckWindowProps> = props => {
	const {onClose, story} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.check.${key}`, options);
	const {dispatch} = useDialogsContext();
	const {available, gameFolder, listMedia} = useGameFolder();
	const folder = available ? gameFolder(story.id) : undefined;
	const [problems, setProblems] = React.useState<CheckProblem[] | undefined>();
	const [round, setRound] = React.useState(0);
	// Сессия 30, ответ 4А: треки радио без развёрнутой копии в папке игры.
	const [copies, setCopies] = React.useState<ReverseJob[]>([]);
	const [copying, setCopying] = React.useState('');
	const catalog = React.useMemo<MusicCatalog | undefined>(() => {
		const radios = story.passages.filter(p => p.tags.includes(radioTag)).flatMap(p => readRadios(p.text));
		const music = story.passages.find(p => p.tags.includes(musicTag));

		return music && needsReverse(radios) ? readMusic(music.text) : undefined;
	}, [story.passages]);

	React.useEffect(() => {
		let cancelled = false;

		(async () => {
			const media = folder
				? (await Promise.all(mediaKinds.map(k => listMedia(story.id, k)))).flat()
				: undefined;

			const bridge = (window as TwineElectronWindow).twineElectron;
			const missing =
				folder && catalog && bridge?.signalyReverseNeeded ? await bridge.signalyReverseNeeded(folder, reverseJobs(catalog)) : [];

			if (!cancelled) {
				setCopies(missing);
				setProblems(
					checkStory({
						passages: story.passages.map(p => ({name: p.name, tags: p.tags, text: p.text})),
						script: story.script,
						stylesheet: story.stylesheet,
						media
					})
				);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [round]); // eslint-disable-line

	React.useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	function makeCopies() {
		if (!folder || !catalog) {
			return;
		}
		setCopying(l('copies.working', {done: 0, total: copies.length}));
		makeReverseCopies(folder, catalog, (done, total) => setCopying(l('copies.working', {done, total})))
			.then(r => setCopying(r.failed.length ? l('copies.failed', {files: r.failed.join(', ')}) : ''))
			.catch(e => setCopying(l('copies.failed', {files: String(e)})))
			.finally(() => setRound(n => n + 1));
	}

	function open(name: string) {
		const passage = story.passages.find(p => p.name === name);

		if (passage) {
			dispatch(addPassageEditors(story.id, [passage.id]));
			onClose();
		}
	}

	return (
		<div aria-label={l('title')} aria-modal="true" className="signaly-appearance-window signaly-check-window" role="dialog">
			<header className="signaly-appearance-header">
				<h2>
					{l('title')} — {story.name}
				</h2>
				<button className="signaly-button primary" onClick={() => setRound(round + 1)} type="button">
					{l('again')}
				</button>
				<button className="signaly-button" onClick={onClose} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-check-body">
				<p className="signaly-field-hint">{l('intro')}</p>
				{!folder && <div className="signaly-notice">{l('noFolder')}</div>}
				{problems === undefined && <p>{l('running')}</p>}
				{problems?.length === 0 && copies.length === 0 && <p className="signaly-check-ok">{l('ok')}</p>}
				{copies.length > 0 && (
					<section className="signaly-check-group signaly-check-copies">
						<h3>
							{l('copies.title')} ({copies.length})
						</h3>
						<p className="signaly-field-hint">{l('copies.hint')}</p>
						<ul>
							{copies.map(c => (
								<li key={c.src}>
									<code>{c.src}</code>
								</li>
							))}
						</ul>
						<button className="signaly-button primary" disabled={!!copying} onClick={makeCopies} type="button">
							{l('copies.make')}
						</button>
						{copying && <span className="signaly-field-hint"> {copying}</span>}
					</section>
				)}
				{problems &&
					kinds.map(kind => {
						const list = problems.filter(p => p.kind === kind);

						if (list.length === 0) {
							return null;
						}
						return (
							<section className="signaly-check-group" key={kind}>
								<h3>
									{l(`kinds.${kind}`)} ({list.length})
								</h3>
								<p className="signaly-field-hint">{l(`hints.${kind}`)}</p>
								<ul>
									{list.map(p => (
										<li key={p.passage + '|' + p.detail}>
											{story.passages.some(x => x.name === p.passage) ? (
												<button className="signaly-check-link" onClick={() => open(p.passage)} type="button">
													{p.passage}
												</button>
											) : (
												<span>{p.passage}</span>
											)}
											{': '}
											<code>{p.detail}</code>
										</li>
									))}
								</ul>
							</section>
						);
					})}
			</div>
		</div>
	);
};
