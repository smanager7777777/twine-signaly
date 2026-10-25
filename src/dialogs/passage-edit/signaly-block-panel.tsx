// «Twine СИГНАЛЫ»: форма блока экрана (шаг 1.4, решение 52). Открывается из
// «Добавить блок» или щелчком по команде блока в тексте пассажа и стоит между
// панелью и текстом. Каждое изменение сразу переписывает команду в тексте —
// предпросмотр обновляется вместе с текстом.

import {readSounds} from '../../util/signaly/signaly-sounds';
import {IconArrowDown, IconArrowUp, IconTrash, IconX} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Passage, Story} from '../../store/stories';
import {useGameFolder} from '../../store/use-game-folder';
import {
	defaultAppearance,
	readAppearance
} from '../../util/signaly/signaly-appearance';
import {findEffects} from '../../util/signaly/signaly-effects';
import {readKinds} from '../../util/signaly/signaly-kinds';
import {
	ChainStep,
	CodeCase,
	findBlocks,
	Kr2,
	kr2DefaultCols,
	kr2DefaultRows,
	Kr2Row,
	readKr2,
	ScreenBlock,
	timerDefaults,
	Value,
	variablesIn,
	writeBlock,
	writeKr2
} from '../../util/signaly/signaly-screen-blocks';
import {
	CheckField,
	ChoiceField,
	ColorField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {effectTitle, SignalyEffectForm} from './signaly-effect-form';
import {ConditionForm, StatesForm, ValueForm} from './signaly-logic-form';
import {findConditions, findStates, findValues} from '../../util/signaly/signaly-logic';
import {knownVariables} from '../../util/signaly/signaly-variables';
import {findLinks} from '../../util/signaly/signaly-actions';
import {findAudioInit} from '../../util/signaly/signaly-sounds';
import {LinkActionsForm} from './signaly-link-actions-form';
import {CondListsContext, useCondLists} from './signaly-logic-form';
import {EventForm} from './signaly-event-form';
import {eventTag, findEvent, setEventHead} from '../../util/signaly/signaly-events';

export type PanelTarget =
	| {kind: 'block'; index: number}
	| {kind: 'effect'; index: number}
	| {kind: 'condition'; index: number}
	| {kind: 'states'; index: number}
	| {kind: 'value'; index: number}
	| {kind: 'link'; index: number}
	| {kind: 'event'}
	| {kind: 'kr2'};

export interface SignalyBlockPanelProps {
	/** Текст пассажа, как он сейчас в редакторе. */
	text: string;
	passage: Passage;
	story: Story;
	target: PanelTarget;
	/** Записать новый текст пассажа в редактор. */
	onText: (text: string) => void;
	/** Включить или снять тег kr2 у пассажа. */
	onKr2Tag: (on: boolean) => void;
	/** Включить или снять тег sg-event (шаг 3.5). */
	onEventTag: (on: boolean) => void;
	onClose: () => void;
}

/* ----- Общие кусочки ----- */

export const AreaField: React.FC<{
	hint?: string;
	label: string;
	onChange: (value: string) => void;
	value: string;
}> = ({hint, label, onChange, value}) => (
	<div className="signaly-field">
		<label className="signaly-field-label">
			{label}
			<textarea
				className="signaly-text signaly-area"
				onChange={e => onChange(e.target.value)}
				rows={3}
				value={value}
			/>
		</label>
		{hint && <div className="signaly-field-hint">{hint}</div>}
	</div>
);

export function useLists(story: Story) {
	const {listMedia} = useGameFolder();
	const [media, setMedia] = React.useState<{
		img: string[];
		video: string[];
		audio: string[];
		fonts: string[];
	}>({img: [], video: [], audio: [], fonts: []});

	React.useEffect(() => {
		let cancelled = false;

		Promise.all([
			listMedia(story.id, 'img'),
			listMedia(story.id, 'video'),
			listMedia(story.id, 'audio'),
			listMedia(story.id, 'fonts')
		]).then(([img, video, audio, fonts]) => {
			if (!cancelled) {
				setMedia({img, video, audio, fonts});
			}
		});
		return () => {
			cancelled = true;
		};
	}, [story.id]); // eslint-disable-line

	const passages = React.useMemo(
		() =>
			story.passages
				.filter(p => !p.tags.includes('script') && !p.tags.includes('stylesheet'))
				.map(p => p.name)
				.sort((a, b) => a.localeCompare(b, 'ru')),
		[story.passages]
	);

	return {media, passages};
}

/* ----- Панель ----- */

export const SignalyBlockPanel: React.FC<SignalyBlockPanelProps> = props => {
	const {onClose, onEventTag, onKr2Tag, onText, passage, story, target, text} = props;
	const {t} = useTranslation();
	const {media, passages} = useLists(story);
	const condLists = useCondLists(story);
	const savedColors = React.useMemo(
		() => (readAppearance(story.stylesheet) ?? defaultAppearance).savedColors,
		[story.stylesheet]
	);
	const kinds = React.useMemo(
		() => readKinds(story.stylesheet)?.kinds ?? [{cls: '', name: t('signaly.blocks.onscreen.plain')}],
		[story.stylesheet, t]
	);
	const soundSets = React.useMemo(
		() => (readSounds(story.script)?.sets ?? []).map(s => s.name),
		[story.script]
	);
	const l = (key: string) => t(`signaly.blocks.${key}`);
	const px = t('signaly.appearance.units.px');
	const seconds = t('signaly.appearance.units.seconds');

	const fileChoice = (
		label: string,
		value: string,
		files: string[],
		onChange: (value: string) => void,
		none?: string
	) => (
		<ChoiceField
			hint={files.length === 0 ? l('noFiles') : undefined}
			label={label}
			onChange={onChange}
			options={[
				...(none !== undefined ? [{label: none, value: ''}] : []),
				...files.map(f => ({label: f, value: f}))
			]}
			value={value}
		/>
	);
	const passageChoice = (
		label: string,
		value: string,
		onChange: (value: string) => void,
		none: string
	) => (
		<ChoiceField
			label={label}
			onChange={onChange}
			options={[{label: none, value: ''}, ...passages.map(p => ({label: p, value: p}))]}
			value={value}
		/>
	);

	let title = '';
	let body: React.ReactNode = null;

	if (target.kind === 'event') {
		// Шаг 3.5: пассаж-событие.
		const head = findEvent(text);

		if (!head) {
			return null;
		}
		title = t('signaly.events.title');
		body = (
			<EventForm
				head={head}
				onRemove={() => {
					onText(setEventHead(text, undefined));
					onEventTag(false);
					onClose();
				}}
				onTag={() => onEventTag(true)}
				onText={onText}
				tagged={passage.tags.includes(eventTag)}
				text={text}
				variables={knownVariables(story.passages)}
			/>
		);
	} else if (target.kind === 'effect') {
		const effect = findEffects(text)[target.index];

		if (!effect) {
			return null;
		}
		title = effectTitle(effect, t);
		body = <SignalyEffectForm effect={effect} onText={onText} text={text} />;
	} else if (target.kind === 'condition' || target.kind === 'states' || target.kind === 'value') {
		const variables = knownVariables(story.passages);

		if (target.kind === 'condition') {
			const cond = findConditions(text)[target.index];

			if (!cond) {
				return null;
			}
			title = t('signaly.logic.cond.title');
			body = <ConditionForm cond={cond} onText={onText} text={text} variables={variables} />;
		} else if (target.kind === 'states') {
			const states = findStates(text, kinds.map(k => k.cls).filter(Boolean))[target.index];

			if (!states) {
				return null;
			}
			title = t('signaly.logic.states.title');
			body = <StatesForm kinds={kinds} onText={onText} states={states} text={text} variables={variables} />;
		} else {
			const value = findValues(text)[target.index];

			if (!value) {
				return null;
			}
			title = t('signaly.logic.value.title');
			body = <ValueForm onText={onText} text={text} value={value} variables={variables} />;
		}
	} else if (target.kind === 'link') {
		// Шаг 3.2: ссылка или кнопка — действия по порядку и переход.
		const link = findLinks(text)[target.index];

		if (!link) {
			return null;
		}
		title = t(`signaly.actions.title.${link.form}`);
		body = (
			<LinkActionsForm
				audio={findAudioInit(story.passages.find(p => p.name === 'StoryInit')?.text ?? '').init}
				audioFiles={media.audio}
				current={passage.name}
				fileChoice={fileChoice}
				kinds={kinds}
				link={link}
				onText={onText}
				passages={passages}
				text={text}
				variables={knownVariables(story.passages)}
			/>
		);
	} else if (target.kind === 'kr2') {
		title = l('kr2.title');
		body = (
			<Kr2Form
				fileChoice={fileChoice}
				images={media.img}
				l={l}
				onKr2Tag={onKr2Tag}
				onText={onText}
				passage={passage}
				passageChoice={passageChoice}
				story={story}
				text={text}
			/>
		);
	} else {
		const block = findBlocks(text)[target.index];

		if (!block) {
			return null;
		}

		const v = block.values;
		const str = (key: string, fallback = '') =>
			v[key] === undefined ? fallback : String(v[key]);
		const num = (key: string, fallback: number) =>
			typeof v[key] === 'number' ? (v[key] as number) : fallback;
		const write = (next: Omit<ScreenBlock, 'from' | 'to'>) =>
			onText(text.slice(0, block.from) + writeBlock(next) + text.slice(block.to));
		const set = (key: string, value: Value | undefined) =>
			write({...block, values: {...v, [key]: value}});
		const color = (key: string, label: string, fallback: string) => (
			<ColorField
				label={label}
				onChange={value => set(key, value)}
				onSaveColor={() => {}}
				savedColors={savedColors}
				value={str(key, fallback)}
			/>
		);
		const range = (
			key: string,
			label: string,
			min: number,
			max: number,
			fallback: number,
			unit = px,
			step = 1,
			hint?: string
		) => (
			<RangeField
				hint={hint}
				label={label}
				max={max}
				min={min}
				onChange={value => set(key, value)}
				step={step}
				unit={unit}
				value={num(key, fallback)}
			/>
		);
		const check = (key: string, label: string, hint?: string) => (
			<CheckField
				hint={hint}
				label={label}
				onChange={value => set(key, value || undefined)}
				value={v[key] === true}
			/>
		);
		const place = () => (
			<>
				<ChoiceField
					label={l('place')}
					onChange={value => set('place', value === 'text' ? undefined : value)}
					options={['text', 'center', 'screen'].map(value => ({
						label: l(`places.${value}`),
						value
					}))}
					value={str('place', 'text')}
				/>
				{v.place === 'screen' && (
					<>
						<ChoiceField
							label={l('corner')}
							onChange={value => set('corner', value)}
							options={['tl', 'tr', 'bl', 'br'].map(value => ({
								label: l(`corners.${value}`),
								value
							}))}
							value={str('corner', 'tl')}
						/>
						{range('x', l('x'), -900, 1900, 0)}
						{range('y', l('y'), -500, 1080, 0, px, 1, l('dragHint'))}
					</>
				)}
				{range('border', l('border'), 0, 20, 0)}
				{range('glow', l('glow'), 0, 60, 0)}
				{color('color', l('borderColor'), '#00cc00')}
			</>
		);

		switch (block.type) {
			case 'image':
				title = l('image.title');
				body = (
					<>
						{fileChoice(l('file'), str('src'), media.img, value => set('src', value))}
						{range('width', l('width'), 20, 1920, 400, px, 1, l('resizeHint'))}
						{place()}
					</>
				);
				break;

			case 'video':
				title = l('video.title');
				body = (
					<>
						{fileChoice(l('file'), str('src'), media.video, value => set('src', value))}
						{range('width', l('width'), 20, 1920, 1000, px, 1, l('resizeHint'))}
						{range('height', l('video.height'), 0, 1080, 0, px, 1, l('video.heightHint'))}
						{check('autoplay', l('video.autoplay'))}
						{check('loop', l('video.loop'))}
						{check('muted', l('video.muted'))}
						{check('controls', l('video.controls'))}
						{check('buttons', l('video.buttons'))}
						{place()}
					</>
				);
				break;

			case 'alarm':
				title = l('alarm.title');
				body = (
					<>
						<AreaField
							hint={l('contentHint')}
							label={l('alarm.text')}
							onChange={value => write({...block, content: value})}
							value={block.content ?? ''}
						/>
						{color('bg', l('alarm.bg'), '#cc0000')}
						{color('color', l('alarm.color'), '#000000')}
						{range('size', l('alarm.size'), 10, 200, 70)}
						{range('blink', l('alarm.blink'), 0, 3, 0, seconds, 0.1, l('alarm.blinkHint'))}
						{fileChoice(l('alarm.sound'), str('sound'), media.audio, value => set('sound', value), l('noSound'))}
						{v.sound !== undefined && (
							<>
								{range('volume', l('alarm.volume'), 0, 100, 100, '%')}
								{check('loop', l('alarm.loop'))}
							</>
						)}
						<ChoiceField
							label={l('alarm.close')}
							onChange={value => set('close', value)}
							options={['click', 'time', 'master'].map(value => ({
								label: l(`alarm.closes.${value}`),
								value
							}))}
							value={str('close', 'master')}
						/>
						{v.close === 'time' && range('seconds', l('seconds'), 1, 120, 5, seconds)}
						{passageChoice(l('alarm.goto'), str('goto'), value => set('goto', value), l('stay'))}
					</>
				);
				break;

			case 'dialog': {
				const fromPassage = v.passage !== undefined;

				title = l('dialog.title');
				body = (
					<>
						<TextField label={l('dialog.label')} onChange={value => set('label', value)} value={str('label')} />
						<ChoiceField
							label={l('dialog.opener')}
							onChange={value => set('button', value === 'button' || undefined)}
							options={[
								{label: l('dialog.link'), value: 'link'},
								{label: l('dialog.button'), value: 'button'}
							]}
							value={v.button === true ? 'button' : 'link'}
						/>
						<TextField label={l('dialog.heading')} onChange={value => set('title', value)} value={str('title')} />
						<ChoiceField
							label={l('dialog.content')}
							onChange={value =>
								value === 'passage'
									? set('passage', passages.find(p => p !== passage.name) ?? '')
									: set('passage', undefined)
							}
							options={[
								{label: l('dialog.ownText'), value: 'text'},
								{label: l('dialog.fromPassage'), value: 'passage'}
							]}
							value={fromPassage ? 'passage' : 'text'}
						/>
						{fromPassage ? (
							<ChoiceField
								label={l('dialog.passage')}
								onChange={value => set('passage', value)}
								options={passages.map(p => ({label: p, value: p}))}
								value={str('passage')}
							/>
						) : (
							<AreaField
								hint={l('contentHint')}
								label={l('dialog.text')}
								onChange={value => write({...block, content: value})}
								value={block.content ?? ''}
							/>
						)}
						<ChoiceField
							label={l('dialog.close')}
							onChange={value => set('close', value === 'cross' ? undefined : value)}
							options={['cross', 'ok', 'time'].map(value => ({
								label: l(`dialog.closes.${value}`),
								value
							}))}
							value={str('close', 'cross')}
						/>
						{v.close === 'ok' && (
							<TextField label={l('dialog.ok')} onChange={value => set('ok', value)} value={str('ok', l('dialog.okDefault'))} />
						)}
						{v.close === 'time' && range('seconds', l('seconds'), 1, 120, 5, seconds)}
					</>
				);
				break;
			}

			case 'place':
				title = l('onscreen.title');
				body = (
					<>
						<ChoiceField
							label={l('onscreen.kind')}
							onChange={value => set('kind', value === '' ? undefined : value)}
							options={kinds.map(k => ({label: k.name, value: k.cls}))}
							value={str('kind')}
						/>
						<ChoiceField
							label={l('corner')}
							onChange={value => set('corner', value)}
							options={['tl', 'tr', 'bl', 'br'].map(value => ({
								label: l(`corners.${value}`),
								value
							}))}
							value={str('corner', 'tl')}
						/>
						{range('x', l('x'), -900, 1900, 0)}
						{range('y', l('y'), -500, 1080, 0, px, 1, l('dragHint'))}
						{/* Шаг 2.2 (ответ 1А): свой звук или без звука. */}
						{(['hover', 'click'] as const).map(which => (
							<ChoiceField
								key={which}
								label={t(`signaly.sounds.place.${which}`)}
								onChange={value => set(which, value === '' ? undefined : value)}
								options={[
									{label: t('signaly.sounds.place.kind'), value: ''},
									{label: t('signaly.sounds.kind.none'), value: 'none'},
									...soundSets.map(name => ({label: name, value: name}))
								]}
								value={str(which)}
							/>
						))}
						<div className="signaly-field-hint">{l('onscreen.contentHint')}</div>
					</>
				);
				break;

			case 'timer': {
				// Шаг 2.3 (ответы 1А–4А).
				const running = v.start === 'running';
				const end = v.goto !== undefined ? 'goto' : v.sound !== undefined ? 'sound' : v.title !== undefined || v.passage !== undefined || v.text !== undefined ? 'dialog' : 'none';
				const fromPassage = v.passage !== undefined;
				const setEnd = (value: string) =>
					write({
						...block,
						values: {
							...v,
							goto: value === 'goto' ? passages.find(p => p !== passage.name) ?? '' : undefined,
							title: value === 'dialog' ? l('timer.endTitle') : undefined,
							text: value === 'dialog' ? l('timer.endText') : undefined,
							passage: undefined,
							sound: value === 'sound' ? media.audio[0] ?? '' : undefined
						}
					});

				title = l('timer.title');
				body = (
					<>
						<TextField hint={l('timer.nameHint')} label={l('timer.name')} onChange={value => set('name', value)} value={str('name')} />
						<ChoiceField
							label={l('timer.start')}
							onChange={value => set('start', value === 'enter' ? undefined : value)}
							options={['enter', 'running'].map(value => ({label: l(`timer.starts.${value}`), value}))}
							value={running ? 'running' : 'enter'}
						/>
						{!running && (
							<>
								{range('hours', l('timer.hours'), 0, 23, 0, l('timer.h'))}
								{range('minutes', l('timer.minutes'), 0, 59, 0, l('timer.m'))}
								{range('seconds', l('timer.seconds'), 0, 59, 0, l('timer.s'))}
								<ChoiceField
									label={l('timer.end')}
									onChange={setEnd}
									options={['goto', 'dialog', 'sound', 'none'].map(value => ({label: l(`timer.ends.${value}`), value}))}
									value={end}
								/>
								{end === 'goto' && passageChoice(l('timer.goto'), str('goto'), value => set('goto', value), l('code.choosePassage'))}
								{end === 'dialog' && (
									<>
										<TextField label={l('dialog.heading')} onChange={value => set('title', value)} value={str('title')} />
										<ChoiceField
											label={l('dialog.content')}
											onChange={value =>
												write({
													...block,
													values: {
														...v,
														passage: value === 'passage' ? passages.find(p => p !== passage.name) ?? '' : undefined,
														text: value === 'passage' ? undefined : str('text')
													}
												})
											}
											options={[
												{label: l('dialog.ownText'), value: 'text'},
												{label: l('dialog.fromPassage'), value: 'passage'}
											]}
											value={fromPassage ? 'passage' : 'text'}
										/>
										{fromPassage ? (
											<ChoiceField
												label={l('dialog.passage')}
												onChange={value => set('passage', value)}
												options={passages.map(p => ({label: p, value: p}))}
												value={str('passage')}
											/>
										) : (
											<AreaField hint={l('contentHint')} label={l('dialog.text')} onChange={value => set('text', value)} value={str('text')} />
										)}
									</>
								)}
								{end === 'sound' && fileChoice(l('timer.sound'), str('sound'), media.audio, value => set('sound', value))}
								{check('hidden', l('timer.hidden'), l('timer.hiddenHint'))}
							</>
						)}
						{running && <div className="signaly-field-hint">{l('timer.runningHint')}</div>}
						{(running || v.hidden !== true) && (
							<>
								<h4 className="signaly-block-subtitle">{l('timer.look')}</h4>
								<ChoiceField
									label={l('timer.font')}
									onChange={value => set('font', value === timerDefaults.font ? undefined : value)}
									options={[
										{label: l('timer.terminalFont'), value: 'none'},
										...[...new Set([timerDefaults.font, ...media.fonts])].map(f => ({label: f, value: f}))
									]}
									value={str('font', timerDefaults.font)}
								/>
								{color('color', l('timer.color'), timerDefaults.color)}
								{color('bg', l('timer.bg'), timerDefaults.bg)}
								{range('size', l('timer.size'), 10, 400, timerDefaults.size)}
								{range('border', l('border'), 0, 20, timerDefaults.border)}
								{range('glow', l('glow'), 0, 60, timerDefaults.glow)}
								<ChoiceField
									label={l('timer.format')}
									onChange={value => set('format', value === 'ms' ? undefined : value)}
									options={['ms', 'hms'].map(value => ({label: l(`timer.formats.${value}`), value}))}
									value={str('format', 'ms')}
								/>
							</>
						)}
					</>
				);
				break;
			}

			case 'chain':
				title = l('chain.title');
				body = (
					<ChainForm
						block={block}
						fileChoice={fileChoice}
						l={l}
						passageChoice={passageChoice}
						place={place}
						range={range}
						set={set}
						str={str}
						videos={media.video}
						write={write}
					/>
				);
				break;

			case 'code':
				title = l('code.title');
				body = (
					<CodeForm
						block={block}
						check={check}
						fileChoice={fileChoice}
						l={l}
						media={media.audio}
						passageChoice={passageChoice}
						range={range}
						set={set}
						str={str}
						write={write}
					/>
				);
				break;
		}
	}

	return (
		<div aria-label={title} className="signaly-block-panel" role="group">
			<div className="signaly-block-panel-header">
				<strong>{title}</strong>
				<IconButton icon={<IconX />} iconOnly label={l('done')} onClick={onClose} />
			</div>
			<div className="signaly-block-panel-body">
				<CondListsContext.Provider value={condLists}>{body}</CondListsContext.Provider>
			</div>
		</div>
	);
};

/* ----- Поле кода: таблица «код → действие» ----- */

interface CodeFormProps {
	block: ScreenBlock;
	check: (key: string, label: string, hint?: string) => React.ReactNode;
	fileChoice: (
		label: string,
		value: string,
		files: string[],
		onChange: (value: string) => void,
		none?: string
	) => React.ReactNode;
	l: (key: string) => string;
	media: string[];
	passageChoice: (
		label: string,
		value: string,
		onChange: (value: string) => void,
		none: string
	) => React.ReactNode;
	range: (
		key: string,
		label: string,
		min: number,
		max: number,
		fallback: number,
		unit?: string,
		step?: number,
		hint?: string
	) => React.ReactNode;
	set: (key: string, value: Value | undefined) => void;
	str: (key: string, fallback?: string) => string;
	write: (next: Omit<ScreenBlock, 'from' | 'to'>) => void;
}

const CodeForm: React.FC<CodeFormProps> = props => {
	const {block, check, fileChoice, l, media, passageChoice, range, set, str, write} = props;
	const cases = block.cases ?? [];
	const codes = cases.filter(c => c.kind === 'case');
	const wrong = cases.find(c => c.kind === 'wrong');
	const update = (next: CodeCase[]) => {
		// Неверный код — всегда последней строкой.
		write({
			...block,
			cases: [...next.filter(c => c.kind === 'case'), ...next.filter(c => c.kind === 'wrong')]
		});
	};
	const change = (item: CodeCase, changes: Partial<CodeCase>) =>
		update(cases.map(c => (c === item ? {...c, ...changes} : c)));
	const setValue = (item: CodeCase, key: string, value: Value | undefined) =>
		change(item, {values: {...item.values, [key]: value === '' ? undefined : value}});

	const actions = (item: CodeCase) => {
		const fromPassage = item.values.passage !== undefined;

		return (
			<>
				{passageChoice(l('code.goto'), String(item.values.goto ?? ''), value => setValue(item, 'goto', value), l('code.noGoto'))}
				<TextField label={l('code.message')} onChange={value => setValue(item, 'title', value)} value={String(item.values.title ?? '')} />
				<ChoiceField
					label={l('dialog.content')}
					onChange={value =>
						change(item, {
							values: {...item.values, passage: value === 'passage' ? '' : undefined}
						})
					}
					options={[
						{label: l('dialog.ownText'), value: 'text'},
						{label: l('dialog.fromPassage'), value: 'passage'}
					]}
					value={fromPassage ? 'passage' : 'text'}
				/>
				{fromPassage ? (
					passageChoice(l('dialog.passage'), String(item.values.passage ?? ''), value => change(item, {values: {...item.values, passage: value}}), l('code.choosePassage'))
				) : (
					<AreaField
						hint={l('code.textHint')}
						label={l('dialog.text')}
						onChange={value => change(item, {content: value})}
						value={item.content}
					/>
				)}
				{fileChoice(l('code.sound'), String(item.values.sound ?? ''), media, value => setValue(item, 'sound', value), l('noSound'))}
			</>
		);
	};

	return (
		<>
			<ChoiceField
				label={l('code.field')}
				onChange={value => set('password', value === 'password' || undefined)}
				options={[
					{label: l('code.visible'), value: 'text'},
					{label: l('code.stars'), value: 'password'}
				]}
				value={block.values.password === true ? 'password' : 'text'}
			/>
			<TextField
				label={l('code.button')}
				onChange={value => set('button', value)}
				value={str('button')}
			/>
			{block.values.button !== undefined && range('gap', l('code.gap'), 0, 6, 1, l('code.lines'))}
			{check('focus', l('code.focus'))}
			{check('clear', l('code.clear'))}
			{check('table', l('code.table'), l('code.tableHint'))}
			<TextField
				label={l('code.var')}
				onChange={value => set('var', value.trim() === '' ? undefined : value.trim())}
				value={str('var')}
			/>
			<div className="signaly-field-hint">{l('code.enterHint')}</div>

			{codes.map((item, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{l('code.code')} {index + 1}
						<IconButton
							icon={<IconTrash />}
							iconOnly
							label={l('remove')}
							onClick={() => update(cases.filter(c => c !== item))}
						/>
					</legend>
					<TextField
						label={l('code.value')}
						onChange={value => change(item, {values: {...item.values, code: value}})}
						value={String(item.values.code ?? '')}
					/>
					{actions(item)}
				</fieldset>
			))}
			<button
				className="signaly-button"
				onClick={() =>
					update([...cases, {kind: 'case', values: {code: ''}, extra: [], content: ''}])
				}
				type="button"
			>
				{l('code.add')}
			</button>
			<fieldset className="signaly-block-row">
				<legend>{l('code.wrong')}</legend>
				{wrong ? (
					<>
						{actions(wrong)}
						<button className="signaly-button" onClick={() => update(cases.filter(c => c !== wrong))} type="button">
							{l('code.noWrong')}
						</button>
					</>
				) : (
					<button
						className="signaly-button"
						onClick={() =>
							update([...cases, {kind: 'wrong', values: {title: l('code.wrongTitle')}, extra: [], content: l('code.wrongText')}])
						}
						type="button"
					>
						{l('code.addWrong')}
					</button>
				)}
			</fieldset>
		</>
	);
};

/* ----- Цепочка видео (шаг 2.3, ответы 6А, 7А) ----- */

interface ChainFormProps {
	block: ScreenBlock;
	fileChoice: CodeFormProps['fileChoice'];
	l: (key: string) => string;
	passageChoice: CodeFormProps['passageChoice'];
	place: () => React.ReactNode;
	range: CodeFormProps['range'];
	set: CodeFormProps['set'];
	str: CodeFormProps['str'];
	videos: string[];
	write: CodeFormProps['write'];
}

const ChainForm: React.FC<ChainFormProps> = props => {
	const {block, fileChoice, l, passageChoice, place, range, set, str, videos, write} = props;
	const {t} = useTranslation();
	const steps = block.steps ?? [];
	const update = (next: ChainStep[]) => write({...block, steps: next});
	const setStep = (index: number, key: string, value: Value | undefined) =>
		update(
			steps.map((s, i) =>
				i === index ? {...s, values: {...s.values, [key]: value === false ? undefined : value}} : s
			)
		);
	const move = (index: number, by: number) => {
		const next = [...steps];
		const [step] = next.splice(index, 1);

		next.splice(Math.max(0, Math.min(next.length, index + by)), 0, step);
		update(next);
	};

	return (
		<>
			{range('width', l('width'), 20, 1920, 1000, t('signaly.appearance.units.px'), 1, l('resizeHint'))}
			{range('height', l('video.height'), 0, 1080, 0, t('signaly.appearance.units.px'), 1, l('video.heightHint'))}
			{place()}
			<h4 className="signaly-block-subtitle">{l('chain.steps')}</h4>
			{steps.map((step, index) => {
				const v = step.values;
				const last = index === steps.length - 1;
				const next = String(v.next ?? 'end');

				return (
					<fieldset className="signaly-block-row" key={index}>
						<legend>
							{l('chain.step')} {index + 1}
							<IconButton disabled={index === 0} icon={<IconArrowUp />} iconOnly label={l('up')} onClick={() => move(index, -1)} />
							<IconButton disabled={last} icon={<IconArrowDown />} iconOnly label={l('down')} onClick={() => move(index, 1)} />
							<IconButton disabled={steps.length < 2} icon={<IconTrash />} iconOnly label={l('remove')} onClick={() => update(steps.filter((_, i) => i !== index))} />
						</legend>
						{fileChoice(l('file'), String(v.src ?? ''), videos, value => setStep(index, 'src', value))}
						<CheckField label={l('chain.loop')} onChange={value => setStep(index, 'loop', value)} value={v.loop === true} />
						<CheckField label={l('video.muted')} onChange={value => setStep(index, 'muted', value)} value={v.muted === true} />
						<ChoiceField
							hint={v.loop === true && next === 'end' ? l('chain.loopEndHint') : undefined}
							label={last ? l('chain.lastNext') : l('chain.next')}
							onChange={value => setStep(index, 'next', value)}
							options={['click', 'end', 'time'].map(value => ({label: l(`chain.nexts.${value}`), value}))}
							value={next}
						/>
						{next === 'time' && (
							<RangeField
								label={l('seconds')}
								max={600}
								min={0}
								onChange={value => setStep(index, 'seconds', value)}
								step={0.5}
								unit={t('signaly.appearance.units.seconds')}
								value={typeof v.seconds === 'number' ? v.seconds : 5}
							/>
						)}
					</fieldset>
				);
			})}
			<button
				className="signaly-button"
				onClick={() => update([...steps, {values: {src: '', next: 'end'}, extra: []}])}
				type="button"
			>
				{l('chain.add')}
			</button>
			{passageChoice(l('chain.goto'), str('goto'), value => set('goto', value), l('stay'))}
			<div className="signaly-field-hint">{l('chain.hint')}</div>
		</>
	);
};

/* ----- Окно KR2 ----- */

interface Kr2FormProps {
	fileChoice: CodeFormProps['fileChoice'];
	images: string[];
	l: (key: string) => string;
	onKr2Tag: (on: boolean) => void;
	onText: (text: string) => void;
	passage: Passage;
	passageChoice: CodeFormProps['passageChoice'];
	story: Story;
	text: string;
}

const Kr2Form: React.FC<Kr2FormProps> = props => {
	const {fileChoice, images, l, onKr2Tag, onText, passage, passageChoice, story, text} = props;
	const {t} = useTranslation();
	const kr2 = readKr2(text);
	const tagged = passage.tags.includes('kr2');
	const variables = React.useMemo(
		() => variablesIn(story.passages.map(p => p.text)),
		[story.passages]
	);
	const save = (changes: Partial<Kr2>) => onText(writeKr2(text, {...kr2, ...changes}));
	const rows = kr2.status;
	const setRows = (next: Kr2Row[]) => save({status: next});
	const changeRow = (index: number, row: Kr2Row) =>
		setRows(rows.map((r, i) => (i === index ? row : r)));
	const move = (index: number, by: number) => {
		const next = [...rows];
		const [row] = next.splice(index, 1);

		next.splice(Math.max(0, Math.min(next.length, index + by)), 0, row);
		setRows(next);
	};

	return (
		<>
			<CheckField
				hint={l('kr2.tagHint')}
				label={l('kr2.tag')}
				onChange={onKr2Tag}
				value={tagged}
			/>
			{fileChoice(l('kr2.image'), kr2.image, images, value => save({image: value}), l('kr2.noImage'))}
			<RangeField
				label={l('kr2.cols')}
				max={90}
				min={10}
				onChange={value => save({cols: value})}
				unit="%"
				value={kr2.cols}
			/>
			<RangeField
				label={l('kr2.rows')}
				max={90}
				min={10}
				onChange={value => save({rows: value})}
				unit="%"
				value={kr2.rows}
			/>
			{(kr2.cols !== kr2DefaultCols || kr2.rows !== kr2DefaultRows) && (
				<button
					className="signaly-button"
					onClick={() => save({cols: kr2DefaultCols, rows: kr2DefaultRows})}
					type="button"
				>
					{l('kr2.defaultLayout')}
				</button>
			)}

			<h4 className="signaly-block-subtitle">{l('kr2.status')}</h4>
			<div className="signaly-field-hint">{l('kr2.statusHint')}</div>
			{rows.map((row, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{row.kind === 'text' ? l('kr2.textRow') : l('kr2.windowRow')}
						<IconButton disabled={index === 0} icon={<IconArrowUp />} iconOnly label={l('up')} onClick={() => move(index, -1)} />
						<IconButton disabled={index === rows.length - 1} icon={<IconArrowDown />} iconOnly label={l('down')} onClick={() => move(index, 1)} />
						<IconButton icon={<IconTrash />} iconOnly label={l('remove')} onClick={() => setRows(rows.filter((_, i) => i !== index))} />
					</legend>
					{row.kind === 'text' ? (
						<>
							<TextField label={l('kr2.line')} onChange={value => changeRow(index, {...row, text: value})} value={row.text} />
							<ChoiceField
								label={l('kr2.insertVar')}
								onChange={value =>
									value && changeRow(index, {...row, text: `${row.text}${row.text && !row.text.endsWith(' ') ? ' ' : ''}${value}`})
								}
								options={[{label: '—', value: ''}, ...variables.map(name => ({label: name, value: name}))]}
								value=""
							/>
						</>
					) : (
						<>
							<TextField label={l('dialog.label')} onChange={value => changeRow(index, {...row, label: value})} value={row.label} />
							<ChoiceField
								label={l('dialog.opener')}
								onChange={value => changeRow(index, {...row, button: value === 'button'})}
								options={[
									{label: l('dialog.link'), value: 'link'},
									{label: l('dialog.button'), value: 'button'}
								]}
								value={row.button ? 'button' : 'link'}
							/>
							<TextField label={l('dialog.heading')} onChange={value => changeRow(index, {...row, title: value})} value={row.title} />
							{passageChoice(l('kr2.windowPassage'), row.passage, value => changeRow(index, {...row, passage: value}), l('code.choosePassage'))}
						</>
					)}
					<ChoiceField
						label={l('kr2.show')}
						onChange={value =>
							changeRow(index, {
								...row,
								when:
									value === 'always'
										? undefined
										: {
												name: row.when?.name ?? variables[0] ?? '$found',
												value: value === 'equals' ? row.when?.value ?? '1' : undefined
										  }
							})
						}
						options={['always', 'on', 'equals'].map(value => ({
							label: l(`kr2.shows.${value}`),
							value
						}))}
						value={!row.when ? 'always' : row.when.value === undefined ? 'on' : 'equals'}
					/>
					{row.when && (
						<>
							<ChoiceField
								label={l('kr2.whenVar')}
								onChange={value => changeRow(index, {...row, when: {...row.when!, name: value}})}
								options={[...new Set([row.when.name, ...variables])].map(name => ({label: name, value: name}))}
								value={row.when.name}
							/>
							<TextField
								label={l('kr2.whenVarOther')}
								onChange={value => {
									const name = value.trim().replace(/^\$?/, '$');

									changeRow(index, {...row, when: {...row.when!, name}});
								}}
								value={row.when.name}
							/>
							{row.when.value !== undefined && (
								<TextField
									label={l('kr2.whenValue')}
									onChange={value => changeRow(index, {...row, when: {...row.when!, value}})}
									value={row.when.value}
								/>
							)}
						</>
					)}
				</fieldset>
			))}
			<div className="signaly-block-buttons">
				<button className="signaly-button" onClick={() => setRows([...rows, {kind: 'text', text: ''}])} type="button">
					{l('kr2.addText')}
				</button>
				<button
					className="signaly-button"
					onClick={() =>
						setRows([...rows, {kind: 'window', label: l('kr2.windowLabel'), title: '', passage: '', button: false}])
					}
					type="button"
				>
					{l('kr2.addWindow')}
				</button>
			</div>
			<div className="signaly-field-hint">{t('signaly.blocks.kr2.mainHint')}</div>
		</>
	);
};
