// «Twine СИГНАЛЫ»: предпросмотр — настоящая игра SugarCube во фрейме
// 1920×1080, уменьшенная под размер окна. Цвета и размеры меняются сразу, без
// перезапуска: во фрейме подменяется таблица стилей.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {setPref, usePrefsContext} from '../../store/prefs';
import {Story} from '../../store/stories';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	useStoryFormatsContext
} from '../../store/story-formats';
import {getAppInfo} from '../../util/app-info';
import {publishStoryWithFormat} from '../../util/publish';
import {attachDrag, DragOptions} from '../../util/signaly/signaly-drag';
import {PreviewMode, previewHtml} from '../../util/signaly/signaly-preview';
import {SignalySounds} from '../../util/signaly/signaly-sounds';

/** Галочка «Закрепить»: в предпросмотре ничего не двигается мышью. */
export const SignalyDragLock: React.FC = () => {
	const {t} = useTranslation();
	const {dispatch, prefs} = usePrefsContext();

	return (
		<label className="signaly-drag-lock" title={t('signaly.drag.lockHint')}>
			<input
				checked={prefs.signalyDragLock}
				onChange={e => dispatch(setPref('signalyDragLock', e.target.checked))}
				type="checkbox"
			/>{' '}
			{t('signaly.drag.lock')}
		</label>
	);
};

/** Галочка «Без звука» (шаг 2.2, ответ 7А): звуки наведения и нажатия в предпросмотре. */
export const SignalyPreviewMute: React.FC = () => {
	const {t} = useTranslation();
	const {dispatch, prefs} = usePrefsContext();

	return (
		<label className="signaly-drag-lock" title={t('signaly.sounds.muteHint')}>
			<input
				checked={prefs.signalyPreviewMute}
				onChange={e => dispatch(setPref('signalyPreviewMute', e.target.checked))}
				type="checkbox"
			/>{' '}
			{t('signaly.sounds.mute')}
		</label>
	);
};

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
	/** Меняется — во фрейме открывается образец окна-сообщения. */
	sampleDialog?: number;
	/** Меняется — во фрейме проигрывается смена цикла (окно «Строка событий»). */
	cycleDemo?: number;
	/** История с готовыми блоками (JavaScript и таблица стилей). */
	story: Story;
	/** Перетаскивание мышью (шаг 1.4): что делать, когда элемент отпустили. */
	drag?: {locked: boolean} & Pick<DragOptions, 'onDrop'>;
	/** Наборы звуков (шаг 2.2): меняются во фрейме сразу, без перезапуска. */
	sounds?: SignalySounds;
}

export const SignalyAppearancePreview: React.FC<
	SignalyAppearancePreviewProps
> = props => {
	const {baseUrl, cycleDemo, drag, mode, passageId, refresh, sampleDialog, sounds, story} = props;
	const {dispatch, formats} = useStoryFormatsContext();
	const {prefs} = usePrefsContext();
	const muteRef = React.useRef(prefs.signalyPreviewMute);
	const {t} = useTranslation();
	const frameRef = React.useRef<HTMLIFrameElement>(null);
	const boxRef = React.useRef<HTMLDivElement>(null);
	const storyRef = React.useRef(story);
	const [html, setHtml] = React.useState<string>();
	const [error, setError] = React.useState<string>();
	const [scale, setScale] = React.useState(0.4);

	storyRef.current = story;

	// Перетаскивание: свежие настройки — через ref, подключение — при загрузке.
	const dragRef = React.useRef(drag);
	const dragControl = React.useRef<ReturnType<typeof attachDrag>>();

	dragRef.current = drag;
	React.useEffect(() => dragControl.current?.update(), [drag?.locked]);
	React.useEffect(() => () => dragControl.current?.detach(), []);

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
					setHtml(previewHtml(published, {baseUrl, mode, uiSound: !muteRef.current}));
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

	// Наборы звуков — сразу во фрейм.
	const soundsRef = React.useRef(sounds);

	soundsRef.current = sounds;

	const applySounds = React.useCallback(() => {
		const sugar = (frameRef.current?.contentWindow as any)?.SugarCube;

		if (soundsRef.current && sugar?.setup) {
			sugar.setup.signalySounds = soundsRef.current;
		}
	}, []);

	React.useEffect(applySounds, [applySounds, sounds]);

	// «Без звука» меняется сразу, без перезапуска.
	muteRef.current = prefs.signalyPreviewMute;
	React.useEffect(() => {
		const win = frameRef.current?.contentWindow as any;

		if (win) {
			win.SIGNALY_UI_SOUND = !prefs.signalyPreviewMute;
		}
	}, [prefs.signalyPreviewMute]);

	// Образец окна-сообщения — чтобы видеть его оформление.
	React.useEffect(() => {
		const sugar = (frameRef.current?.contentWindow as any)?.SugarCube;

		if (!sampleDialog || !sugar?.Dialog) {
			return;
		}
		sugar.Dialog.create(t('signaly.appearance.sampleDialogTitle'))
			.wiki(t('signaly.appearance.sampleDialogText'))
			.open();
	}, [sampleDialog]); // eslint-disable-line

	// Смена цикла — показать анимацию цифр.
	React.useEffect(() => {
		const sugar = (frameRef.current?.contentWindow as any)?.SugarCube;

		if (cycleDemo && sugar?.setup?.signaly?.cycleDemo) {
			sugar.setup.signaly.cycleDemo();
		}
	}, [cycleDemo]);

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
		[100, 500, 1500].forEach(delay =>
			setTimeout(() => {
				applyStyles();
				applySounds();
			}, delay)
		);

		const doc = frameRef.current?.contentDocument;

		dragControl.current?.detach();
		dragControl.current = undefined;
		if (doc && dragRef.current) {
			dragControl.current = attachDrag(doc, {
				locked: () => dragRef.current?.locked ?? true,
				onDrop: result => dragRef.current?.onDrop(result)
			});
		}
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
