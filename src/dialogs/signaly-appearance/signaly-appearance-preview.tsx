// «Twine СИГНАЛЫ»: предпросмотр — настоящая игра SugarCube во фрейме
// 1920×1080, уменьшенная под размер окна. Цвета и размеры меняются сразу, без
// перезапуска: во фрейме подменяется таблица стилей.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story} from '../../store/stories';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	useStoryFormatsContext
} from '../../store/story-formats';
import {getAppInfo} from '../../util/app-info';
import {publishStoryWithFormat} from '../../util/publish';
import {PreviewMode, previewHtml} from '../../util/signaly/signaly-preview';

export const previewWidth = 1920;
export const previewHeight = 1080;

export interface SignalyAppearancePreviewProps {
	/** Адрес папки игры (file:///…/) — чтобы находились media/…. */
	baseUrl?: string;
	mode: PreviewMode;
	/** С какого экрана начать (id пассажа). */
	passageId?: string;
	/** Меняется — предпросмотр перезапускается. */
	refresh: number;
	/** История с готовыми блоками (JavaScript и таблица стилей). */
	story: Story;
}

export const SignalyAppearancePreview: React.FC<
	SignalyAppearancePreviewProps
> = props => {
	const {baseUrl, mode, passageId, refresh, story} = props;
	const {dispatch, formats} = useStoryFormatsContext();
	const {t} = useTranslation();
	const frameRef = React.useRef<HTMLIFrameElement>(null);
	const boxRef = React.useRef<HTMLDivElement>(null);
	const storyRef = React.useRef(story);
	const [html, setHtml] = React.useState<string>();
	const [error, setError] = React.useState<string>();
	const [scale, setScale] = React.useState(0.4);

	storyRef.current = story;

	// Публикация — только при смене экрана или «Обновить».
	React.useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const current = storyRef.current;
				const format = formatWithNameAndVersion(
					formats,
					current.storyFormat,
					current.storyFormatVersion
				);
				const properties = await loadFormatProperties(format)(dispatch);

				if (!properties) {
					throw new Error(t('signaly.appearance.preview.noFormat'));
				}

				const published = publishStoryWithFormat(
					current,
					properties.source,
					getAppInfo(),
					{startId: passageId}
				);

				if (!cancelled) {
					setError(undefined);
					setHtml(previewHtml(published, {baseUrl, mode}));
				}
			} catch (e) {
				if (!cancelled) {
					setError((e as Error).message);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [baseUrl, mode, passageId, refresh]);

	// Живое обновление стилей во фрейме.
	const applyStyles = React.useCallback(() => {
		const doc = frameRef.current?.contentDocument;
		const style = doc?.getElementById('style-story');

		if (style && style.textContent !== storyRef.current.stylesheet) {
			style.textContent = storyRef.current.stylesheet;
		}
	}, []);

	React.useEffect(applyStyles, [applyStyles, story.stylesheet]);

	// Масштаб под размер окна.
	React.useEffect(() => {
		const box = boxRef.current;

		if (!box) {
			return;
		}

		const update = () =>
			setScale(
				Math.min(
					box.clientWidth / previewWidth,
					box.clientHeight / previewHeight
				)
			);
		update();

		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		const observer = new ResizeObserver(update);

		observer.observe(box);
		return () => observer.disconnect();
	}, []);

	function handleLoad() {
		// SugarCube вставляет стили чуть позже загрузки — подстрахуемся.
		[100, 500, 1500].forEach(delay => setTimeout(applyStyles, delay));
	}

	return (
		<div className="signaly-preview-box" ref={boxRef}>
			{error && <div className="signaly-preview-error">{error}</div>}
			<div
				className="signaly-preview-frame"
				style={{
					height: previewHeight * scale,
					width: previewWidth * scale
				}}
			>
				{html && (
					<iframe
						onLoad={handleLoad}
						ref={frameRef}
						srcDoc={html}
						style={{
							height: previewHeight,
							transform: `scale(${scale})`,
							width: previewWidth
						}}
						title={t('signaly.appearance.preview.title')}
					/>
				)}
			</div>
		</div>
	);
};
