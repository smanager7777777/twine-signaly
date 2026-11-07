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

	React.useEffect(() => {
		let cancelled = false;

		(async () => {
			const media = folder
				? (await Promise.all(mediaKinds.map(k => listMedia(story.id, k)))).flat()
				: undefined;

			if (!cancelled) {
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
				{problems?.length === 0 && <p className="signaly-check-ok">{l('ok')}</p>}
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
