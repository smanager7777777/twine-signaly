// «Twine СИГНАЛЫ»: список действий по порядку — общий для формы «Ссылка /
// кнопка» (шаг 3.2) и окна «Горячие клавиши» (шаг 3.3). Внутри «Если … то …
// иначе …» и «Через N секунд» — свои списки (ответ автора 7А). Всё — обычные
// команды SugarCube (см. util/signaly/signaly-actions.ts).

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	Action,
	ActionType,
	AudioAct,
	AudioAction,
	AudioWho,
	DelayAction,
	DialogAction,
	IfAction,
	newAction,
	SetAction,
	SignalAction,
	TimerAction,
	MusicAction,
	MusicOp,
	musicOps
} from '../../util/signaly/signaly-actions';
import {parseExpr, writeExpr} from '../../util/signaly/signaly-logic';
import {Value} from '../../util/signaly/signaly-screen-blocks';
import {AudioInit} from '../../util/signaly/signaly-sounds';
import {KnownVariable, parseLiteral, variableTitle, VarValue} from '../../util/signaly/signaly-variables';
import {
	CheckField,
	ChoiceField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {AreaField} from './signaly-block-panel';
import {CondListsContext, CondRows} from './signaly-logic-form';

type L = (key: string, options?: Record<string, unknown>) => string;

/** Действие «Музыка» (шаг 7.1): что сделать с общим плеером каталога «Музыка». */
const MusicActionFields: React.FC<{action: MusicAction; l: L; onChange: (patch: Partial<MusicAction>) => void}> = props => {
	const {action, l, onChange} = props;
	const lists = React.useContext(CondListsContext);
	const names = action.op === 'track' ? lists.tracks ?? [] : action.op === 'folder' ? lists.folders ?? [] : [];

	return (
		<>
			<ChoiceField
				label={l('music.op')}
				onChange={op =>
					onChange({
						op: op as MusicOp,
						target: op === 'toggle' || op === 'section' ? 'ambient' : op === 'track' || op === 'folder' ? '' : '',
						amount: op === 'volume' ? 30 : op === 'louder' || op === 'quieter' ? 5 : op === 'auto' ? -1 : 0
					})
				}
				options={musicOps.map(op => ({label: l(`music.ops.${op}`), value: op}))}
				value={action.op}
			/>
			{(action.op === 'track' || action.op === 'folder') && (
				<ChoiceField
					hint={names.length ? undefined : l('music.noCatalog')}
					label={l(action.op === 'track' ? 'music.track' : 'music.folder')}
					onChange={target => onChange({target})}
					options={[...new Set([action.target, ...names])].filter(Boolean).map(n => ({label: n, value: n}))}
					value={action.target}
				/>
			)}
			{(action.op === 'toggle' || action.op === 'section') && (
				<ChoiceField
					hint={action.op === 'toggle' ? l('music.toggleHint') : undefined}
					label={l('music.section')}
					onChange={target => onChange({target})}
					options={['ambient', 'radio'].map(v => ({label: l(`music.sections.${v}`), value: v}))}
					value={action.target === 'radio' ? 'radio' : 'ambient'}
				/>
			)}
			{(action.op === 'volume' || action.op === 'louder' || action.op === 'quieter') && (
				<RangeField
					label={l(action.op === 'volume' ? 'music.volume' : 'music.step')}
					max={99}
					min={action.op === 'volume' ? 0 : 1}
					onChange={amount => onChange({amount})}
					unit=""
					value={action.amount}
				/>
			)}
			{action.op === 'auto' && (
				<ChoiceField
					label={l('music.auto')}
					onChange={v => onChange({amount: Number(v)})}
					options={['1', '0', '-1'].map(v => ({label: l(`music.autos.${v === '-1' ? 'toggle' : v === '1' ? 'on' : 'off'}`), value: v}))}
					value={String(action.amount)}
				/>
			)}
			<div className="signaly-field-hint">{l(`music.hints.${action.op}`)}</div>
		</>
	);
};

export const actionTypes: ActionType[] = [
	'set',
	'progress',
	'audio',
	'signal',
	'dialog',
	'timer',
	'stop',
	'if',
	'delay',
	'back',
	'music',
	'code'
];

/** Что нужно спискам действий: переменные, звуки, экраны, файлы папки игры. */
export interface ActionContext {
	variables: KnownVariable[];
	audio: AudioInit;
	passages: string[];
	/** Имя открытого пассажа (для «перейти» по умолчанию). */
	current: string;
	fileChoice: (label: string, value: string, files: string[], onChange: (value: string) => void, none?: string) => React.ReactNode;
	audioFiles: string[];
	/** Список действий кода из общей таблицы: есть «Прогресс вводящего +N» (шаг 3.4). */
	codes?: boolean;
}

export interface ActionListProps extends ActionContext {
	actions: Action[];
	onChange: (actions: Action[]) => void;
	/** Вложенный список (внутри «Если» или «Через N секунд»). */
	nested?: boolean;
}

/** Число из поля; пусто или не число — undefined. */
export function numberOf(input: string) {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : undefined;
}

const percentOf = (level: number | undefined, fallback: number) =>
	level === undefined ? fallback : Math.round(level * 1000) / 10;

export const ActionList: React.FC<ActionListProps> = props => {
	const {actions, audio, audioFiles, codes, current, fileChoice, nested, onChange, passages, variables} = props;
	const {t} = useTranslation();
	const l: L = (key, options) => t(`signaly.actions.${key}`, options);
	const units = (key: string) => t(`signaly.appearance.units.${key}`);
	const setActions = onChange;
	const change = (index: number, action: Action) =>
		setActions(actions.map((a, i) => (i === index ? action : a)));
	const edit = <T extends Action>(index: number, a: T, patch: Partial<T>) =>
		change(index, {...a, ...patch, raw: undefined});
	const passageChoice = (label: string, value: string, onChange: (v: string) => void, none?: string) => (
		<ChoiceField
			label={label}
			onChange={onChange}
			options={[...(none !== undefined ? [{label: none, value: ''}] : []), ...passages.map(p => ({label: p, value: p}))]}
			value={value}
		/>
	);
	const otherPassage = passages.find(p => p !== current) ?? '';
	const sub = (list: Action[], onList: (next: Action[]) => void) => (
		<ActionList {...props} actions={list} nested onChange={onList} />
	);

	/* ----- Одно действие ----- */

	const setForm = (index: number, a: SetAction) => {
		const type = variables.find(v => v.name === a.name)?.type;
		const value = (input: string): VarValue =>
			type === 'text' ? input : type === 'number' ? numberOf(input) ?? input : parseLiteral(input) ?? input;

		return (
			<>
				<ChoiceField
					label={l('set.variable')}
					onChange={name => edit(index, a, {name})}
					options={[
						...variables.map(v => ({label: variableTitle(v), value: v.name})),
						...(variables.some(v => v.name === a.name) ? [] : [{label: `$${a.name}`, value: a.name}])
					]}
					value={a.name}
				/>
				<ChoiceField
					label={l('set.op')}
					onChange={op =>
						edit(index, a, {
							op: op as SetAction['op'],
							value:
								op === 'toggle'
									? undefined
									: op === 'to'
									? a.value ?? (type === 'bool' ? true : type === 'text' ? '' : 0)
									: typeof a.value === 'number'
									? a.value
									: 1
						})
					}
					options={(['to', 'add', 'sub', 'toggle'] as const).map(op => ({label: l(`set.ops.${op}`), value: op}))}
					value={a.op}
				/>
				{a.op === 'to' &&
					(type === 'bool' ? (
						<ChoiceField
							label={l('set.value')}
							onChange={v => edit(index, a, {value: v === 'true'})}
							options={[
								{label: t('signaly.logic.yes'), value: 'true'},
								{label: t('signaly.logic.no'), value: 'false'}
							]}
							value={String(a.value === true)}
						/>
					) : (
						<TextField
							hint={type ? undefined : l('set.valueHint')}
							label={l('set.value')}
							onChange={v => edit(index, a, {value: value(v)})}
							value={a.value === undefined ? '' : String(a.value)}
						/>
					))}
				{(a.op === 'add' || a.op === 'sub') && (
					<TextField
						label={l('set.by')}
						onChange={v => edit(index, a, {value: numberOf(v) ?? 0})}
						value={String(a.value ?? 1)}
					/>
				)}
			</>
		);
	};

	const audioForm = (index: number, a: AudioAction) => {
		const who = a.who;
		const whoKind = who.kind;
		const playlist = whoKind === 'playlist';
		const ids = (kind: string) =>
			kind === 'track'
				? audio.tracks.map(x => x.id)
				: kind === 'group'
				? audio.groups.map(x => x.id)
				: audio.lists.map(x => x.id);
		const setWho = (next: AudioWho) => {
			const nextPlaylist = next.kind === 'playlist';

			edit(index, a, {
				who: next,
				act: a.act === 'skip' && !nextPlaylist ? 'play' : a.act,
				time: nextPlaylist ? undefined : a.time
			});
		};

		return (
			<>
				<ChoiceField
					label={l('audio.who')}
					onChange={kind => {
						if (kind === 'track' || kind === 'group' || kind === 'playlist') {
							setWho({kind, id: ids(kind)[0] ?? ''});
						} else if (kind === 'other') {
							setWho({kind, selector: ':all'});
						} else {
							setWho({kind: kind as 'playing' | 'paused' | 'all'});
						}
					}}
					options={['track', 'group', 'playlist', 'playing', 'paused', 'all', 'other'].map(k => ({
						label: l(`audio.whos.${k}`),
						value: k
					}))}
					value={whoKind}
				/>
				{(who.kind === 'track' || who.kind === 'group' || who.kind === 'playlist') && (
					<ChoiceField
						hint={ids(who.kind).length === 0 ? l('audio.noSounds') : undefined}
						label={l(`audio.names.${who.kind}`)}
						onChange={id => setWho({kind: who.kind, id})}
						options={ids(who.kind).map(id => ({label: id, value: id}))}
						value={who.id}
					/>
				)}
				{(who.kind === 'playing' || who.kind === 'paused' || who.kind === 'all') && (
					<ChoiceField
						label={l('audio.except')}
						onChange={except => setWho({kind: who.kind, ...(except ? {except} : {})})}
						options={[{label: l('audio.exceptNone'), value: ''}, ...audio.groups.map(g => ({label: g.id, value: g.id}))]}
						value={who.except ?? ''}
					/>
				)}
				{who.kind === 'other' && (
					<TextField
						hint={l('audio.selectorHint')}
						label={l('audio.selector')}
						onChange={selector => setWho({kind: 'other', selector})}
						value={who.selector}
					/>
				)}
				<ChoiceField
					label={l('audio.act')}
					onChange={act =>
						edit(index, a, {
							act: act as AudioAct,
							level: act === 'fade' ? a.level ?? 0.5 : undefined,
							over: act === 'fade' ? a.over : undefined
						})
					}
					options={(['play', 'pause', 'stop', 'fade', ...(playlist ? ['skip'] : []), ''] as const).map(act => ({
						label: l(`audio.acts.${act || 'none'}`),
						value: act
					}))}
					value={a.act}
				/>
				{a.act === 'fade' && (
					<>
						<RangeField
							label={l('audio.level')}
							max={100}
							min={0}
							onChange={v => edit(index, a, {level: v / 100})}
							unit="%"
							value={percentOf(a.level, 50)}
						/>
						<TextField
							hint={l('audio.overHint')}
							label={l('audio.over')}
							onChange={v => edit(index, a, {over: numberOf(v)})}
							value={a.over === undefined ? '' : String(a.over)}
						/>
					</>
				)}
				<CheckField
					label={l('audio.setVolume')}
					onChange={on => edit(index, a, {volume: on ? 1 : undefined})}
					value={a.volume !== undefined}
				/>
				{a.volume !== undefined && (
					<RangeField
						label={l('audio.volume')}
						max={100}
						min={0}
						onChange={v => edit(index, a, {volume: v / 100})}
						unit="%"
						value={percentOf(a.volume, 100)}
					/>
				)}
				<ChoiceField
					label={l('audio.loop')}
					onChange={v => edit(index, a, {loop: v === '' ? undefined : v === 'on'})}
					options={['', 'on', 'off'].map(v => ({label: l(`audio.loops.${v || 'keep'}`), value: v}))}
					value={a.loop === undefined ? '' : a.loop ? 'on' : 'off'}
				/>
				{!playlist && (
					<>
						<CheckField
							hint={l('audio.timeHint')}
							label={l('audio.setTime')}
							onChange={on => edit(index, a, {time: on ? 0 : undefined})}
							value={a.time !== undefined}
						/>
						{a.time !== undefined && (
							<TextField
								label={l('audio.time')}
								onChange={v => edit(index, a, {time: numberOf(v) ?? 0})}
								value={String(a.time)}
							/>
						)}
					</>
				)}
			</>
		);
	};

	const dialogForm = (index: number, a: DialogAction) => (
		<>
			<TextField label={t('signaly.blocks.dialog.heading')} onChange={title => edit(index, a, {title})} value={a.title} />
			<ChoiceField
				label={t('signaly.blocks.dialog.content')}
				onChange={v => edit(index, a, {passage: v === 'passage' ? otherPassage : '', text: v === 'passage' ? '' : a.text})}
				options={[
					{label: t('signaly.blocks.dialog.ownText'), value: 'text'},
					{label: t('signaly.blocks.dialog.fromPassage'), value: 'passage'}
				]}
				value={a.passage ? 'passage' : 'text'}
			/>
			{a.passage ? (
				passageChoice(t('signaly.blocks.dialog.passage'), a.passage, passage => edit(index, a, {passage}))
			) : (
				<AreaField
					hint={t('signaly.blocks.contentHint')}
					label={t('signaly.blocks.dialog.text')}
					onChange={v => edit(index, a, {text: v})}
					value={a.text}
				/>
			)}
			<ChoiceField
				label={t('signaly.blocks.dialog.close')}
				onChange={v =>
					edit(index, a, {
						close: v === 'cross' ? '' : (v as 'ok' | 'time'),
						seconds: v === 'time' ? a.seconds ?? 5 : undefined,
						ok: v === 'ok' ? a.ok ?? t('signaly.blocks.dialog.okDefault') : undefined
					})
				}
				options={['cross', 'ok', 'time'].map(v => ({label: t(`signaly.blocks.dialog.closes.${v}`), value: v}))}
				value={a.close || 'cross'}
			/>
			{a.close === 'ok' && (
				<TextField label={t('signaly.blocks.dialog.ok')} onChange={ok => edit(index, a, {ok})} value={a.ok ?? ''} />
			)}
			{a.close === 'time' && (
				<RangeField
					label={l('dialogSeconds')}
					max={60}
					min={1}
					onChange={seconds => edit(index, a, {seconds})}
					unit={units('seconds')}
					value={a.seconds ?? 5}
				/>
			)}
		</>
	);

	const timerForm = (index: number, a: TimerAction) => {
		const v = a.values;
		const str = (key: string) => (v[key] === undefined ? '' : String(v[key]));
		const set = (patch: Record<string, Value | undefined>) => edit(index, a, {values: {...v, ...patch}});
		const end =
			v.goto !== undefined
				? 'goto'
				: v.sound !== undefined
				? 'sound'
				: v.title !== undefined || v.passage !== undefined || v.text !== undefined
				? 'dialog'
				: 'none';
		const lb = (key: string) => t(`signaly.blocks.timer.${key}`);
		const range = (key: string, max: number, unit: string) => (
			<RangeField
				label={lb(key)}
				max={max}
				min={0}
				onChange={n => set({[key]: n})}
				unit={unit}
				value={typeof v[key] === 'number' ? (v[key] as number) : 0}
			/>
		);

		return (
			<>
				<TextField hint={l('timerNameHint')} label={lb('name')} onChange={name => set({name})} value={str('name')} />
				{range('hours', 23, lb('h'))}
				{range('minutes', 59, lb('m'))}
				{range('seconds', 59, lb('s'))}
				<ChoiceField
					label={lb('end')}
					onChange={value =>
						set({
							goto: value === 'goto' ? otherPassage : undefined,
							title: value === 'dialog' ? lb('endTitle') : undefined,
							text: value === 'dialog' ? lb('endText') : undefined,
							passage: undefined,
							sound: value === 'sound' ? audioFiles[0] ?? '' : undefined
						})
					}
					options={['goto', 'dialog', 'sound', 'none'].map(value => ({label: lb(`ends.${value}`), value}))}
					value={end}
				/>
				{end === 'goto' && passageChoice(lb('goto'), str('goto'), goto => set({goto}))}
				{end === 'dialog' && (
					<>
						<TextField label={t('signaly.blocks.dialog.heading')} onChange={title => set({title})} value={str('title')} />
						<ChoiceField
							label={t('signaly.blocks.dialog.content')}
							onChange={value =>
								set({
									passage: value === 'passage' ? otherPassage : undefined,
									text: value === 'passage' ? undefined : str('text')
								})
							}
							options={[
								{label: t('signaly.blocks.dialog.ownText'), value: 'text'},
								{label: t('signaly.blocks.dialog.fromPassage'), value: 'passage'}
							]}
							value={v.passage !== undefined ? 'passage' : 'text'}
						/>
						{v.passage !== undefined ? (
							passageChoice(t('signaly.blocks.dialog.passage'), str('passage'), passage => set({passage}))
						) : (
							<AreaField label={t('signaly.blocks.dialog.text')} onChange={value => set({text: value})} value={str('text')} />
						)}
					</>
				)}
				{end === 'sound' && fileChoice(lb('sound'), str('sound'), audioFiles, sound => set({sound}))}
			</>
		);
	};

	const signalForm = (index: number, a: SignalAction) => (
		<>
			{fileChoice(l('signal.file'), a.src, audioFiles, src => edit(index, a, {src}))}
			<RangeField
				label={l('signal.volume')}
				max={100}
				min={0}
				onChange={volume => edit(index, a, {volume})}
				unit="%"
				value={a.volume}
			/>
			<CheckField hint={l('signal.keepHint')} label={l('signal.keep')} onChange={keep => edit(index, a, {keep})} value={a.keep} />
			<CheckField
				hint={l('signal.duckHint')}
				label={l('signal.duck')}
				onChange={on =>
					edit(index, a, on ? {duck: audio.groups[0]?.id ?? ':playing', duckTo: 30} : {duck: undefined, duckTo: undefined})
				}
				value={!!a.duck}
			/>
			{!!a.duck && (
				<>
					<ChoiceField
						label={l('signal.duckWho')}
						onChange={duck => edit(index, a, {duck})}
						options={[
							...[...new Set([...audio.groups.map(g => g.id), ...(a.duck === ':playing' ? [] : [a.duck])])].map(id => ({
								label: id,
								value: id
							})),
							{label: l('signal.duckAll'), value: ':playing'}
						]}
						value={a.duck}
					/>
					<RangeField
						hint={l('signal.duckToHint')}
						label={l('signal.duckTo')}
						max={100}
						min={0}
						onChange={duckTo => edit(index, a, {duckTo})}
						unit="%"
						value={a.duckTo ?? 30}
					/>
				</>
			)}
			<div className="signaly-field-hint">{l('signal.hint')}</div>
		</>
	);

	const ifForm = (index: number, a: IfAction) => {
		const parsed = parseExpr(a.expr);

		return (
			<>
				{parsed && parsed.conds.length > 0 ? (
					<CondRows
						conds={parsed.conds}
						join={parsed.join}
						onChange={(conds, join) => edit(index, a, {expr: writeExpr(conds, join)})}
						variables={variables}
					/>
				) : (
					<>
						<div className="signaly-field-hint">{t('signaly.logic.cond.code')}</div>
						<TextField label={t('signaly.logic.cond.expr')} onChange={expr => edit(index, a, {expr})} value={a.expr} />
					</>
				)}
				<h5 className="signaly-block-subtitle">{l('if.then')}</h5>
				{sub(a.then, then => edit(index, a, {then}))}
				<CheckField
					label={l('if.else')}
					onChange={on => {
						if (on || !a.else?.length || window.confirm(l('if.confirmNoElse'))) {
							edit(index, a, {else: on ? [] : undefined});
						}
					}}
					value={a.else !== undefined}
				/>
				{a.else !== undefined && (
					<>
						<h5 className="signaly-block-subtitle">{l('if.otherwise')}</h5>
						{sub(a.else, other => edit(index, a, {else: other}))}
					</>
				)}
			</>
		);
	};

	const delayForm = (index: number, a: DelayAction) => (
		<>
			<TextField
				hint={l('delay.hint')}
				label={l('delay.seconds')}
				onChange={v => edit(index, a, {seconds: Math.max(0, numberOf(v) ?? 0)})}
				value={String(a.seconds)}
			/>
			<h5 className="signaly-block-subtitle">{l('delay.then')}</h5>
			{sub(a.actions, list => edit(index, a, {actions: list}))}
		</>
	);

	const actionBody = (index: number, a: Action) => {
		switch (a.type) {
			case 'signal':
				return signalForm(index, a);
			case 'if':
				return ifForm(index, a);
			case 'delay':
				return delayForm(index, a);
			case 'set':
				return setForm(index, a);
			case 'audio':
				return audioForm(index, a);
			case 'dialog':
				return dialogForm(index, a);
			case 'timer':
				return timerForm(index, a);
			case 'progress':
				return (
					<TextField
						hint={l('progressHint')}
						label={l('progress')}
						onChange={v => edit(index, a, {amount: numberOf(v) ?? 0})}
						value={String(a.amount)}
					/>
				);
			case 'back':
				return <div className="signaly-field-hint">{l('backHint')}</div>;
			case 'music':
				return <MusicActionFields action={a} l={l} onChange={patch => edit(index, a, patch)} />;
			case 'stop':
				return (
					<TextField
						hint={l('stopHint')}
						label={t('signaly.blocks.timer.name')}
						onChange={name => edit(index, a, {name})}
						value={a.name}
					/>
				);
			default:
				return (
					<AreaField
						hint={l('codeHint')}
						label={l('types.code')}
						onChange={code => change(index, {type: 'code', code})}
						value={a.code}
					/>
				);
		}
	};

	const move = (index: number, by: number) => {
		const next = actions.slice();
		const [a] = next.splice(index, 1);

		next.splice(index + by, 0, a);
		setActions(next);
	};

	return (
		<div className={nested ? 'signaly-action-list nested' : 'signaly-action-list'}>
			{actions.length === 0 && <div className="signaly-field-hint">{l(nested ? 'noneNested' : 'none')}</div>}
			{actions.map((a, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{l('row', {n: index + 1, type: l(`types.${a.type}`)})}
						<IconButton
							disabled={index === 0}
							icon={<IconArrowUp />}
							iconOnly
							label={t('signaly.logic.up')}
							onClick={() => move(index, -1)}
						/>
						<IconButton
							disabled={index === actions.length - 1}
							icon={<IconArrowDown />}
							iconOnly
							label={t('signaly.logic.down')}
							onClick={() => move(index, 1)}
						/>
						<IconButton
							icon={<IconTrash />}
							iconOnly
							label={t('signaly.logic.remove')}
							onClick={() => setActions(actions.filter((_, i) => i !== index))}
						/>
					</legend>
					{actionBody(index, a)}
				</fieldset>
			))}
			<ChoiceField
				label={l(nested ? 'addNested' : 'add')}
				onChange={type => {
					if (type) {
						const v = variables[0];
						const made = newAction(type as ActionType, v && {name: v.name, type: v.type});

						setActions([
							...actions,
							made.type === 'audio'
								? {...made, who: {kind: 'track', id: audio.tracks[0]?.id ?? ''}}
								: made.type === 'signal'
								? {...made, src: audioFiles[0] ?? ''}
								: made
						]);
					}
				}}
				options={[{label: l('addChoose'), value: ''}, ...actionTypes
						.filter(type => codes || type !== 'progress')
						.map(type => ({label: l(`types.${type}`), value: type}))]}
				value=""
			/>
		</div>
	);
};
