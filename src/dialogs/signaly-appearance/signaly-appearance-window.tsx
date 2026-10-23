// «Twine СИГНАЛЫ»: окно «Оформление терминала» (ответы автора к шагу 1.2:
// большое окно поверх карты — слева настройки, справа предпросмотр с настоящим
// SugarCube; сохранённые цвета — свои у каждой истории).
//
// Ничего не записывается в историю до «Сохранить». При сохранении в «Таблицу
// стилей» ставится блок оформления, в «JavaScript истории» — движок.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Story, useStoriesContext} from '../../store/stories';
import {saveStoryWithUpgrade} from '../signaly-upgrade';
import {useGameFolder} from '../../store/use-game-folder';
import {
	prepareStory,
	SignalyAppearance,
	systemFonts,
	withAppearance,
	dialogFromAuthor
} from '../../util/signaly/signaly-appearance';
import {folderToFileUrl} from '../../util/signaly/signaly-preview';
import {
	CheckField,
	ChoiceField,
	ColorField,
	RangeField,
	TextField
} from './signaly-appearance-fields';
import {SignalyAppearancePreview, SignalyPreviewMute} from './signaly-appearance-preview';
import './signaly-appearance.css';

export interface SignalyAppearanceWindowProps {
	onClose: () => void;
	story: Story;
}

const startScreenValue = '__sg-start__';

export const SignalyAppearanceWindow: React.FC<
	SignalyAppearanceWindowProps
> = ({onClose, story}) => {
	const {t} = useTranslation();
	const {dispatch, stories} = useStoriesContext();
	const {available, chooseGameFolder, gameFolder, listMedia} = useGameFolder();
	// Перенос настроек и движок готовятся один раз при открытии окна.
	const [prepared] = React.useState(() =>
		prepareStory(story.script, story.stylesheet)
	);
	const [appearance, setAppearance] = React.useState<SignalyAppearance>(
		prepared.appearance
	);
	// «Сохранено» — только если история уже в точности такая, какой её запишет
	// окно (после обновления программы движок и блок можно пересохранить).
	const [upToDate] = React.useState(
		() =>
			prepared.script === story.script &&
			withAppearance(prepared.stylesheet, prepared.appearance) ===
				story.stylesheet
	);
	const [saved, setSaved] = React.useState(upToDate);
	const [savedOnce, setSavedOnce] = React.useState(false);
	const [screen, setScreen] = React.useState(story.startPassage);
	const [refresh, setRefresh] = React.useState(0);
	const [sampleDialog, setSampleDialog] = React.useState(0);
	const [fonts, setFonts] = React.useState<string[]>([]);
	const [sounds, setSounds] = React.useState<string[]>([]);
	const folder = gameFolder(story.id);

	React.useEffect(() => {
		listMedia(story.id, 'fonts').then(setFonts);
		listMedia(story.id, 'audio').then(setSounds);
	}, [folder, story.id]); // eslint-disable-line

	const stylesheet = withAppearance(prepared.stylesheet, appearance);
	const previewStory = React.useMemo(
		() => ({...story, script: prepared.script, stylesheet}),
		[prepared.script, story, stylesheet]
	);

	function change<K extends keyof SignalyAppearance>(
		key: K,
		value: SignalyAppearance[K]
	) {
		setAppearance(current => ({...current, [key]: value}));
		setSaved(false);
	}

	function changeFont(font: string) {
		setAppearance(current => ({...current, font, fontFile: ''}));
		setSaved(false);
	}

	// Включая окна-сообщения, берём значения из правил автора .ui-dialog.
	function turnDialogs(on: boolean) {
		setAppearance(current => ({
			...current,
			...(on ? dialogFromAuthor(prepared.stylesheet) : {}),
			dialogOn: on
		}));
		setSaved(false);
	}

	function saveColor(color: string) {
		if (!appearance.savedColors.includes(color)) {
			change('savedColors', [...appearance.savedColors, color]);
		}
	}

	function removeColor(color: string) {
		change(
			'savedColors',
			appearance.savedColors.filter(c => c !== color)
		);
	}

	function save() {
		saveStoryWithUpgrade(dispatch, stories, story, {
			script: prepared.script,
			stylesheet
		});
		setSaved(true);
		setSavedOnce(true);
	}

	function close() {
		if (saved || window.confirm(t('signaly.appearance.confirmClose'))) {
			onClose();
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

	const label = (key: string) => t(`signaly.appearance.fields.${key}`);
	const hint = (key: string) => {
		const text = t(`signaly.appearance.hints.${key}`, {defaultValue: ''});

		return text === '' ? undefined : text;
	};
	const color = (key: keyof SignalyAppearance) => (
		<ColorField
			hint={hint(key)}
			label={label(key)}
			onChange={value => change(key, value as never)}
			onSaveColor={saveColor}
			savedColors={appearance.savedColors}
			value={appearance[key] as string}
		/>
	);
	const range = (
		key: keyof SignalyAppearance,
		min: number,
		max: number,
		unit: string,
		step = 1
	) => (
		<RangeField
			hint={hint(key)}
			label={label(key)}
			max={max}
			min={min}
			onChange={value => change(key, value as never)}
			step={step}
			unit={unit}
			value={appearance[key] as number}
		/>
	);
	const check = (key: keyof SignalyAppearance) => (
		<CheckField
			hint={hint(key)}
			label={label(key)}
			onChange={value => change(key, value as never)}
			value={appearance[key] as boolean}
		/>
	);
	const px = t('signaly.appearance.units.px');
	const percent = '%';
	const seconds = t('signaly.appearance.units.seconds');
	const passages = [...story.passages]
		.filter(p => !p.tags.includes('script') && !p.tags.includes('stylesheet'))
		.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

	return (
		<div
			aria-label={t('signaly.appearance.title')}
			aria-modal="true"
			className="signaly-appearance-window"
			role="dialog"
		>
			<header className="signaly-appearance-header">
				<h2>
					{t('signaly.appearance.title')} — {story.name}
				</h2>
				<span className="signaly-appearance-status">
					{saved
						? t('signaly.appearance.saved')
						: t('signaly.appearance.unsaved')}
				</span>
				<button
					className="signaly-button primary"
					disabled={saved}
					onClick={save}
					type="button"
				>
					{t('signaly.appearance.save')}
				</button>
				<button className="signaly-button" onClick={close} type="button">
					{t('common.close')}
				</button>
			</header>
			<div className="signaly-appearance-body">
				<div className="signaly-appearance-settings">
					{!upToDate && prepared.moved.length === 0 && !savedOnce && (
						<div className="signaly-notice">
							{t('signaly.appearance.updated')}
						</div>
					)}
					{prepared.moved.length > 0 && !savedOnce && (
						<div className="signaly-notice">
							{t('signaly.appearance.migrated', {
								list: prepared.moved.join(', ')
							})}
						</div>
					)}

					<section>
						<h3>{t('signaly.appearance.sections.colors')}</h3>
						<p className="signaly-field-hint">
							{t('signaly.appearance.hints.savedColors')}
						</p>
						<div className="signaly-swatches large">
							{appearance.savedColors.map(c => (
								<span className="signaly-saved-color" key={c}>
									<span
										className="signaly-swatch"
										style={{background: c}}
										title={c}
									/>
									<button
										aria-label={t('signaly.appearance.removeColor', {color: c})}
										className="signaly-remove-color"
										onClick={() => removeColor(c)}
										title={t('signaly.appearance.removeColor', {color: c})}
										type="button"
									>
										×
									</button>
								</span>
							))}
						</div>
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.screen')}</h3>
						{color('pageBg')}
						{color('textColor')}
						<ChoiceField
							hint={
								available ? hint('font') : t('signaly.appearance.hints.fontWeb')
							}
							label={label('font')}
							onChange={value =>
								value.startsWith('media/')
									? change('fontFile', value)
									: changeFont(value)
							}
							options={[
								...systemFonts.map(f => ({label: f, value: f})),
								...fonts.map(f => ({
									label: t('signaly.appearance.fontFile', {
										name: f.replace(/^media\/fonts\//, '')
									}),
									value: f
								}))
							]}
							value={appearance.fontFile || appearance.font}
						/>
						{range('fontSize', 10, 80, px)}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.window')}</h3>
						{range('winWidth', 200, 1920, px)}
						{range('winHeight', 200, 1080, px)}
						{range('winPadding', 0, 200, px)}
						{range('winOffsetX', -900, 900, px)}
						{range('winOffsetY', -500, 500, px)}
						{color('winBg')}
						{range('borderWidth', 0, 20, px)}
						{color('borderColor')}
						{range('glowSize', 0, 60, px)}
						{color('glowColor')}
						{check('lineScroll')}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.flicker')}</h3>
						{check('flicker')}
						{range('flickerPeriod', 0.05, 2, seconds, 0.05)}
						{range('flickerDepth', 0, 50, percent)}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.crt')}</h3>
						{range('vignette', 0, 100, percent)}
						{range('noise', 0, 100, percent)}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.protect')}</h3>
						{check('noSelect')}
						{check('noContextMenu')}
						{check('noZoom')}
						{range('hideCursor', 0, 60, seconds)}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.start')}</h3>
						<TextField
							hint={hint('startText')}
							label={label('startText')}
							onChange={value => change('startText', value)}
							value={appearance.startText}
						/>
						<ChoiceField
							hint={
								available
									? hint('startSound')
									: t('signaly.appearance.hints.soundWeb')
							}
							label={label('startSound')}
							onChange={value => change('startSound', value)}
							options={[
								{label: t('signaly.appearance.noSound'), value: ''},
								...sounds.map(s => ({
									label: s.replace(/^media\/audio\//, ''),
									value: s
								}))
							]}
							value={appearance.startSound}
						/>
						{range('startVolume', 0, 100, percent)}
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.dialogs')}</h3>
						<CheckField
							hint={hint('dialogOn')}
							label={label('dialogOn')}
							onChange={turnDialogs}
							value={appearance.dialogOn}
						/>
						{appearance.dialogOn && (
							<>
								{color('dialogBg')}
								{color('dialogColor')}
								{range('dialogSize', 10, 80, px)}
								{color('dialogBorderColor')}
								{range('dialogBorderWidth', 0, 20, px)}
								{range('dialogGlow', 0, 60, px)}
								{color('dialogTitleBg')}
								{color('dialogTitleColor')}
								{range('dialogTitleSize', 10, 80, px)}
								{range('dialogTitleLine', 0, 10, px)}
							</>
						)}
						<button
							className="signaly-button"
							onClick={() => setSampleDialog(n => n + 1)}
							type="button"
						>
							{t('signaly.appearance.sampleDialog')}
						</button>
					</section>

					<section>
						<h3>{t('signaly.appearance.sections.text')}</h3>
						{check('typeClick')}
						{check('typeSeen')}
						<h4 className="signaly-block-subtitle">{t('signaly.appearance.glitch')}</h4>
						<p className="signaly-field-hint">{t('signaly.appearance.glitchHint')}</p>
						{color('glitchColor')}
						{color('glitchBg')}
						{color('glitchShadow1')}
						{color('glitchShadow2')}
						{range('glitchShift', 0, 30, px, 0.5)}
						{range('glitchSpeed', 0.2, 10, seconds, 0.1)}
					</section>
				</div>

				<div className="signaly-appearance-preview">
					<div className="signaly-preview-toolbar">
						<label>
							{t('signaly.appearance.preview.screen')}{' '}
							<select onChange={e => setScreen(e.target.value)} value={screen}>
								<option value={startScreenValue}>
									{t('signaly.appearance.preview.startScreen')}
								</option>
								{passages.map(p => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
						</label>
						<button
							className="signaly-button"
							onClick={() => setRefresh(r => r + 1)}
							type="button"
						>
							{t('signaly.appearance.preview.refresh')}
						</button>
						<SignalyPreviewMute />
						<span className="signaly-field-hint">
							{t('signaly.appearance.preview.size')}
						</span>
					</div>
					{available && !folder && (
						<div className="signaly-notice">
							{t('signaly.appearance.preview.noFolder')}{' '}
							<button
								className="signaly-button"
								onClick={() => chooseGameFolder(story.id)}
								type="button"
							>
								{t('signaly.appearance.preview.chooseFolder')}
							</button>
						</div>
					)}
					<SignalyAppearancePreview
						baseUrl={folder ? folderToFileUrl(folder) : undefined}
						mode={screen === startScreenValue ? 'start' : 'passage'}
						passageId={screen === startScreenValue ? undefined : screen}
						refresh={refresh}
						sampleDialog={sampleDialog}
						story={previewStory}
					/>
				</div>
			</div>
		</div>
	);
};
