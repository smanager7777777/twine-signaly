// «Twine СИГНАЛЫ»: вкладка «Блоки» окна «Приложение» (сессия 34, ответ Т3-11 А). Папки блоков
// остаются в названии пассажа («Схемы/Отсек 1/План»); здесь — дерево папок со счётчиками,
// переименование папки целиком и «+ Блок в папку». Правки идут сразу в историю (как загрузка
// пакета), без «Сохранить»: это пассажи, а не общие настройки.

import * as React from 'react';
import {Story, useStoriesContext} from '../../store/stories';
import {
	blockTree,
	FolderNode,
	newBlockIn,
	readBlockHead,
	renameFolder
} from '../../util/signaly/signaly-app-model';
import {appBlockColor, appBlockTag} from '../../util/signaly/signaly-app';
import {freeSpot} from '../../util/signaly/signaly-keys';
import {TextField} from '../signaly-appearance/signaly-appearance-fields';
import {usePhoneL} from './signaly-app-fields';

export const BlocksTab: React.FC<{
	story: Story;
	onOpen: (passageId: string) => void;
}> = ({onOpen, story}) => {
	const l = usePhoneL();
	const {dispatch} = useStoriesContext();
	const tree = React.useMemo(() => blockTree(story.passages), [story.passages]);
	const [folder, setFolder] = React.useState('');
	const [rename, setRename] = React.useState('');
	const [title, setTitle] = React.useState('');
	const [note, setNote] = React.useState('');

	React.useEffect(() => setRename(folder), [folder]);

	function applyRename() {
		const changes = renameFolder(story.passages, folder, rename);

		if (!changes.length) {
			return;
		}
		// Сначала временные имена: две папки могут поменяться названиями.
		changes
			.filter(c => c.name)
			.forEach(c => {
				const p = story.passages.find(x => x.id === c.id)!;

				dispatch({type: 'updatePassage', storyId: story.id, passageId: c.id, props: {name: `${p.name} ~${p.id}`}});
			});
		changes.forEach(c =>
			dispatch({
				type: 'updatePassage',
				storyId: story.id,
				passageId: c.id,
				props: {...(c.name ? {name: c.name} : {}), ...(c.text !== undefined ? {text: c.text} : {})}
			})
		);
		setNote(l('blocks.renamed', {n: changes.length, from: folder, to: rename.trim() || l('blocks.root')}));
		setFolder(rename.split('/').map(x => x.trim()).filter(Boolean).join('/'));
	}

	function addBlock() {
		const b = newBlockIn(story.passages, folder, title);

		dispatch({
			type: 'createPassage',
			storyId: story.id,
			props: {name: b.name, story: story.id, tags: [appBlockTag], text: b.text, ...freeSpot(story.passages)}
		});
		if (!story.tagColors[appBlockTag]) {
			dispatch({type: 'updateStory', storyId: story.id, props: {tagColors: {...story.tagColors, [appBlockTag]: appBlockColor}}});
		}
		setNote(l('blocks.added', {name: b.name}));
		setTitle('');
	}

	const row = (node: FolderNode, depth: number): React.ReactNode => (
		<li key={node.path || '/'}>
			<button
				aria-pressed={folder === node.path}
				className="signaly-kinds-item signaly-app-folder"
				onClick={() => setFolder(node.path)}
				style={{paddingLeft: `${depth * 16 + 6}px`}}
				type="button"
			>
				📁 {node.path ? node.name : l('blocks.root')} ({node.count})
			</button>
			<ul>
				{node.folders.map(f => row(f, depth + 1))}
				{node.blocks.map(b => {
					const head = readBlockHead(b.passage.text);
					const marks = [
						head?.start ? l('blocks.start') : '',
						head && head.chapter > 1 ? l('blocks.chapter', {n: head.chapter}) : '',
						head?.who.length ? `№${head.who.join(', ')}` : ''
					].filter(Boolean);

					return (
						<li key={b.passage.id}>
							<button
								className="signaly-kinds-item signaly-app-block-row"
								onClick={() => onOpen(b.passage.id)}
								style={{paddingLeft: `${depth * 16 + 28}px`}}
								title={l('blocks.open')}
								type="button"
							>
								▫ {b.title}
								{marks.length > 0 && <span className="signaly-field-hint"> — {marks.join(', ')}</span>}
							</button>
						</li>
					);
				})}
			</ul>
		</li>
	);

	return (
		<>
			<h3>{l('blocks.title')}</h3>
			<div className="signaly-field-hint">{l('blocks.hint')}</div>
			<div className="signaly-phone-split">
				<ul className="signaly-app-tree">{row(tree, 0)}</ul>
				<div className="signaly-phone-form">
					<h3>{folder ? l('blocks.folder', {name: folder}) : l('blocks.root')}</h3>
					{folder && (
						<>
							<TextField hint={l('blocks.renameHint')} label={l('blocks.rename')} onChange={setRename} value={rename} />
							<button className="signaly-button" disabled={rename.trim() === folder} onClick={applyRename} type="button">
								{l('blocks.renameDo')}
							</button>
						</>
					)}
					<TextField hint={l('blocks.newTitleHint')} label={l('blocks.newTitle')} onChange={setTitle} value={title} />
					<button className="signaly-button" onClick={addBlock} type="button">
						{l('blocks.add')}
					</button>
					{note && <div className="signaly-notice">{note}</div>}
				</div>
			</div>
		</>
	);
};
