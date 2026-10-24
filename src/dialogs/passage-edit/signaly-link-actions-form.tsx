// «Twine СИГНАЛЫ»: форма «Ссылка / кнопка» — надпись, вид, ссылка или кнопка,
// действия по порядку и экран, на который перейти после них (шаг 3.2, ответы
// автора 1А–6А). Каждое изменение сразу переписывает ссылку в тексте пассажа;
// всё — обычные команды SugarCube (см. util/signaly/signaly-actions.ts).

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
	DialogAction,
	LinkItem,
	newAction,
	SetAction,
	TimerAction,
	writeLink
} from '../../util/signaly/signaly-actions';
import {applyKind, kindAt} from '../../util/signaly/signaly-format';
import {findBlocks, Value, writeBlock} from '../../util/signaly/signaly-screen-blocks';
import {AudioInit} from '../../util/signaly/signaly-sounds';
import {KnownVariable, parseLiteral, variableTitle, VarValue} from '../../util/signaly/signaly-variables';
import {
	CheckField,
	ChoiceField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {AreaField} from './signaly-block-panel';

type L = (key: string, options?: Record<string, unknown>) => string;

const actionTypes: ActionType[] = ['set', 'audio', 'dialog', 'timer', 'stop', 'code'];

export interface LinkActionsFormProps {
	link: LinkItem;
	text: string;
	onText: (text: string) => void;
	kinds: Array<{cls: string; name: string}>;
	variables: KnownVariable[];
	audio: AudioInit;
	passages: string[];
	/** Имя открытого пассажа (для «перейти» по умолчанию). */
	current: string;
	fileChoice: (label: string, value: string, files: string[], onChange: (value: string) => void, none?: string) => React.ReactNode;
	audioFiles: string[];
}

/** Число из поля; пусто или не число — undefined. */
function numberOf(input: string) {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : undefined;
}

const percentOf = (level: number | undefined, fallback: number) =>
	level === undefined ? fallback : Math.round(level * 1000) / 10;

export const LinkActionsForm: React.FC<LinkActionsFormProps> = props => {
	const {audio, audioFiles, current, fileChoice, kinds, link, onText, passages, text, variables} = props;
	const {t} = useTranslation();
	const l: L = (key, options) => t(`signaly.actions.${key}`, options);
	const units = (key: string) => t(`signaly.appearance.units.${key}`);
	const write = (next: Partial<LinkItem>) =>
		onText(text.slice(0, link.from) + writeLink({...link, ...next}) + text.slice(link.to));
	const actions = link.actions;
	const setActions = (next: Action[]) => write({actions: next});
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

	/* ----- Вид: обёртка <span class> или кнопка на экране ----- */

	const kindClasses = kinds.map(k => k.cls).filter(Boolean);
	const place = findBlocks(text).find(
		b => b.type === 'place' && b.headTo !== undefined && b.headTo <= link.from && b.to - '<</sg-place>>'.length >= link.to
	);
	const kind = place ? String(place.values.kind ?? '') : kindAt(text, link.from, link.to, kindClasses);
	const setKind = (cls: string) => {
		if (place) {
			onText(
				text.slice(0, place.from) +
					writeBlock({...place, values: {...place.values, kind: cls || undefined}}) +
					text.slice(place.to)
			);
			return;
		}

		const made = applyKind(text, link.from, link.to, cls, kindClasses, '');

		if (made) {
			onText(text.slice(0, made.from) + made.insert + text.slice(made.to));
		}
	};

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

	const actionBody = (index: number, a: Action) => {
		switch (a.type) {
			case 'set':
				return setForm(index, a);
			case 'audio':
				return audioForm(index, a);
			case 'dialog':
				return dialogForm(index, a);
			case 'timer':
				return timerForm(index, a);
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
		<>
			{link.label !== undefined ? (
				<TextField label={l('label')} onChange={label => write({label})} value={link.label} />
			) : (
				<div className="signaly-field-hint">{l('labelCode')}</div>
			)}
			<ChoiceField
				hint={place ? l('kindPlace') : undefined}
				label={l('kind')}
				onChange={setKind}
				options={kinds.map(k => ({label: k.name, value: k.cls}))}
				value={kind}
			/>
			<ChoiceField
				label={l('form')}
				onChange={form => write({form: form as 'link' | 'button'})}
				options={[
					{label: l('forms.link'), value: 'link'},
					{label: l('forms.button'), value: 'button'}
				]}
				value={link.form}
			/>
			<h4 className="signaly-block-subtitle">{l('list')}</h4>
			{actions.length === 0 && <div className="signaly-field-hint">{l('none')}</div>}
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
				label={l('add')}
				onChange={type => {
					if (type) {
						const v = variables[0];

						const made = newAction(type as ActionType, v && {name: v.name, type: v.type});

						setActions([
							...actions,
							made.type === 'audio' ? {...made, who: {kind: 'track', id: audio.tracks[0]?.id ?? ''}} : made
						]);
					}
				}}
				options={[{label: l('addChoose'), value: ''}, ...actionTypes.map(type => ({label: l(`types.${type}`), value: type}))]}
				value=""
			/>
			{link.headCode === undefined &&
				passageChoice(l('goto'), link.passage, passage => write({passage}), l('gotoNone'))}
			<div className="signaly-field-hint">{l(link.markup ? 'hintMarkup' : 'hint')}</div>
		</>
	);
};
