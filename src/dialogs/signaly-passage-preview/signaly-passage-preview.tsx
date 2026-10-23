// «Twine СИГНАЛЫ»: предпросмотр экрана рядом с редактором пассажа (шаг 1.3,
// ответ автора 6а). Кнопка «Предпросмотр» в окне пассажа открывает панель
// слева от окон пассажей: настоящая игра SugarCube с картинками из папки игры,
// начиная с этого пассажа. Текст пассажа попадает в историю через секунду
// после набора — тогда же обновляется и предпросмотр.

import {IconEye, IconRefresh, IconX} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {usePrefsContext} from '../../store/prefs';
import {
	Story,
	updatePassage,
	useStoriesContext
} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {blockAfterDrop, DragResult} from '../../util/signaly/signaly-drag';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';
import {writeBlock} from '../../util/signaly/signaly-screen-blocks';
import {
	SignalyAppearancePreview,
	SignalyDragLock
} from '../signaly-appearance/signaly-appearance-preview';
import '../signaly-appearance/signaly-appearance.css';
import './signaly-passage-preview.css';

/* ----- Какой пассаж показывать (одна панель на всё окно программы) ----- */

let current: string | undefined;
const listeners = new Set<() => void>();

export function setPreviewPassage(passageId: string | undefined) {
	current = passageId;
	listeners.forEach(listener => listener());
}

export function usePreviewPassage() {
	const [value, setValue] = React.useState(current);

	React.useEffect(() => {
		const listener = () => setValue(current);

		listeners.add(listener);
		listener();
		return () => {
			listeners.delete(listener);
		};
	}, []);
	return value;
}

/* ----- Кнопка в окне пассажа ----- */

export const SignalyPreviewButton: React.FC<{passageId: string}> = ({
	passageId
}) => {
	const {t} = useTranslation();
	const shown = usePreviewPassage();

	return (
		<IconButton
			icon={<IconEye />}
			label={t('signaly.passagePreview.button')}
			onClick={() =>
				setPreviewPassage(shown === passageId ? undefined : passageId)
			}
			selectable
			selected={shown === passageId}
		/>
	);
};

/* ----- Панель ----- */

export const SignalyPassagePreview: React.FC<{story: Story}> = ({story}) => {
	const {t} = useTranslation();
	const {prefs} = usePrefsContext();
	const {dispatch} = useStoriesContext();
	const {gameFolder} = useGameFolder();
	const passageId = usePreviewPassage();
	const [refresh, setRefresh] = React.useState(0);
	const [top, setTop] = React.useState<number>();
	const passage = story.passages.find(p => p.id === passageId);

	// Панель — под панелью инструментов Twine, даже если та в узком окне
	// переносится на третью строку.
	React.useEffect(() => {
		const toolbar = document.querySelector('.route-toolbar');

		if (!toolbar || typeof ResizeObserver === 'undefined') {
			return;
		}

		// Кнопки могут вылезать за высоту панели — берём самую нижнюю.
		const update = () =>
			setTop(
				Math.max(
					toolbar.getBoundingClientRect().bottom,
					...[...toolbar.querySelectorAll('button')].map(
						el => el.getBoundingClientRect().bottom
					)
				) + 8
			);
		const observer = new ResizeObserver(update);

		update();
		observer.observe(toolbar);
		return () => observer.disconnect();
	}, [passageId]);
	const folder = gameFolder(story.id);
	// Перезапуск, когда меняется текст любого пассажа или JavaScript истории
	// (стили меняются на лету).
	const key = React.useMemo(
		() =>
			story.script +
			'\u0000' +
			story.passages.map(p => p.name + '\u0001' + p.text).join('\u0000'),
		[story.passages, story.script]
	);

	React.useEffect(() => setRefresh(r => r + 1), [key]);

	// Пассаж удалили или закрыли историю — панель закрывается.
	React.useEffect(() => {
		if (passageId && !passage) {
			setPreviewPassage(undefined);
		}
	}, [passage, passageId]);
	React.useEffect(() => () => setPreviewPassage(undefined), []);

	if (!passage) {
		return null;
	}

	// Элемент перетащили мышью — записываем новые числа (шаг 1.4).
	function drop(result: DragResult) {
		// Сначала этот пассаж, потом остальные (блок мог прийти из <<include>>).
		const candidates = [passage!, ...story.passages.filter(p => p !== passage)];

		for (const candidate of candidates) {
			const found = blockAfterDrop(candidate.text, result);

			if (found) {
				const {block, changed} = found;

				dispatch(
					updatePassage(story, candidate, {
						text:
							candidate.text.slice(0, block.from) +
							writeBlock(changed) +
							candidate.text.slice(block.to)
					})
				);
				return;
			}
		}
	}

	return (
		<div
			aria-label={t('signaly.passagePreview.title')}
			className="signaly-passage-preview"
			style={{
				right: `calc(${prefs.dialogWidth}px + 3 * var(--grid-size))`,
				top
			}}
		>
			<div className="signaly-passage-preview-header">
				<span className="signaly-passage-preview-title">
					{t('signaly.passagePreview.title')}: {passage.name}
				</span>
				<SignalyDragLock />
				<IconButton
					icon={<IconRefresh />}
					iconOnly
					label={t('signaly.appearance.preview.refresh')}
					onClick={() => setRefresh(r => r + 1)}
				/>
				<IconButton
					icon={<IconX />}
					iconOnly
					label={t('common.close')}
					onClick={() => setPreviewPassage(undefined)}
				/>
			</div>
			{!folder && (
				<div className="signaly-notice">
					{t('signaly.appearance.preview.noFolder')}
				</div>
			)}
			<SignalyAppearancePreview
				baseUrl={folder ? folderToFileUrl(folder) : undefined}
				drag={{
					locked: prefs.signalyDragLock,
					onDrop: drop
				}}
				mode="passage"
				passageId={passage.id}
				refresh={refresh}
				story={story}
			/>
		</div>
	);
};
