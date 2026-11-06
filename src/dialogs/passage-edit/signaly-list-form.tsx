// «Twine СИГНАЛЫ»: форма блока «Список состояний» (шаг 5.1, ответы автора
// 2А–4А, решение 100). Вид, надпись и действие каждого состояния задаются один
// раз на весь список, ниже — таблица строк: номер, название, переменная, экран.

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	listMissing,
	listRowsFill,
	ListRow,
	ListState,
	ScreenBlock,
	Value
} from '../../util/signaly/signaly-screen-blocks';
import {parseAction, splitBody, writeActions} from '../../util/signaly/signaly-actions';
import {
	CheckField,
	ChoiceField,
	ColorField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {ActionContext, ActionList} from './signaly-action-list';

export interface ListFormProps extends ActionContext {
	block: ScreenBlock;
	kinds: Array<{cls: string; name: string}>;
	savedColors: string[];
	onCreatePassages: (names: string[]) => void;
	write: (next: Omit<ScreenBlock, 'from' | 'to'>) => void;
}

/** Значение состояния: число остаётся числом. */
function stateValue(input: string): Value {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : input;
}

function move<T>(list: T[], index: number, by: number) {
	const next = [...list];
	const [item] = next.splice(index, 1);

	next.splice(index + by, 0, item);
	return next;
}

export const ListForm: React.FC<ListFormProps> = props => {
	const {block, kinds, onCreatePassages, passages, savedColors, write} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.blocks.list.${key}`, options);
	const states = block.states ?? [];
	const rows = block.rows ?? [];
	const [fill, setFill] = React.useState({
		count: 10,
		first: rows.length + 1,
		digits: 3,
		name: 'Процедура {номер}',
		variable: 'prcd',
		screen: 'PRCD'
	});
	const setStates = (next: ListState[]) => write({...block, states: next});
	const setRows = (next: ListRow[]) => write({...block, rows: next});
	const setState = (index: number, key: string, value: Value | undefined) =>
		setStates(states.map((st, i) => (i === index ? {...st, values: {...st.values, [key]: value}} : st)));
	const setRow = (index: number, key: string, value: Value | undefined) =>
		setRows(rows.map((row, i) => (i === index ? {...row, values: {...row.values, [key]: value}} : row)));
	const kindOptions = kinds.map(k => ({label: k.name, value: k.cls}));
	const known = new Set(passages);
	const missing = listMissing(rows, passages);
	const form = String(block.values.form ?? 'link');
	const actionsOf = (st: ListState) => splitBody(st.content).map(parseAction);
	const passageOptions = passages.map(p => ({label: p, value: p}));
	const wayOf = (st: ListState) =>
		st.values.do === 'row' || st.values.do === 'window'
			? String(st.values.do)
			: st.values.goto !== undefined
			? 'goto'
			: 'none';
	const setWay = (index: number, way: string) =>
		setStates(
			states.map((st, i) =>
				i === index
					? {
							...st,
							values: {
								...st.values,
								do: way === 'row' || way === 'window' ? way : undefined,
								goto: way === 'goto' ? String(st.values.goto ?? passages[0] ?? '') : undefined,
								title: way === 'window' ? st.values.title : undefined
							}
					  }
					: st
			)
		);

	return (
		<>
			<ChoiceField
				label={l('form')}
				onChange={value => write({...block, values: {...block.values, form: value === 'link' ? undefined : value}})}
				options={['link', 'button', 'tile'].map(value => ({label: l(`forms.${value}`), value}))}
				value={form}
			/>
			<RangeField
				label={l('columns')}
				max={6}
				min={1}
				onChange={value => write({...block, values: {...block.values, columns: value}})}
				step={1}
				unit=""
				value={typeof block.values.columns === 'number' ? block.values.columns : 1}
			/>
			<h4 className="signaly-block-subtitle">{l('states')}</h4>
			<div className="signaly-field-hint">{l('statesHint')}</div>
			{states.map((st, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{l('state', {value: String(st.values.value ?? '')})}
						<IconButton
							disabled={index === 0}
							icon={<IconArrowUp />}
							iconOnly
							label={l('up')}
							onClick={() => setStates(move(states, index, -1))}
						/>
						<IconButton
							disabled={index === states.length - 1}
							icon={<IconArrowDown />}
							iconOnly
							label={l('down')}
							onClick={() => setStates(move(states, index, 1))}
						/>
						<IconButton
							disabled={states.length === 1}
							icon={<IconTrash />}
							iconOnly
							label={l('remove')}
							onClick={() => setStates(states.filter((_, i) => i !== index))}
						/>
					</legend>
					<TextField
						label={l('value')}
						onChange={value => setState(index, 'value', stateValue(value))}
						value={String(st.values.value ?? '')}
					/>
					<TextField
						hint={l(form === 'tile' ? 'labelTileHint' : 'labelHint')}
						label={l(form === 'tile' ? 'labelTile' : 'label')}
						onChange={value => setState(index, 'label', value)}
						value={String(st.values.label ?? '')}
					/>
					<ChoiceField
						label={l('kind')}
						onChange={value => setState(index, 'kind', value || undefined)}
						options={kindOptions}
						value={String(st.values.kind ?? '')}
					/>
					<CheckField
						label={l('ownColor')}
						onChange={on => setState(index, 'color', on ? '#00cc00' : undefined)}
						value={st.values.color !== undefined}
					/>
					{st.values.color !== undefined && (
						<ColorField
							label={l('color')}
							onChange={value => setState(index, 'color', value)}
							onSaveColor={() => {}}
							savedColors={savedColors}
							value={String(st.values.color)}
						/>
					)}
					<ChoiceField
						hint={l('keykindHint')}
						label={l('keykind')}
						onChange={value => setState(index, 'keykind', value || undefined)}
						options={[
							{label: l('keykindSame'), value: ''},
							...kinds.filter(k => k.cls).map(k => ({label: k.name, value: k.cls}))
						]}
						value={String(st.values.keykind ?? '')}
					/>
					<ChoiceField
						label={l('way')}
						onChange={value => setWay(index, value)}
						options={['none', 'row', 'window', 'goto'].map(value => ({label: l(`ways.${value}`), value}))}
						value={wayOf(st)}
					/>
					{wayOf(st) === 'goto' && (
						<ChoiceField
							label={l('goto')}
							onChange={value => setState(index, 'goto', value)}
							options={passageOptions}
							value={String(st.values.goto ?? '')}
						/>
					)}
					{wayOf(st) === 'window' && (
						<TextField
							label={l('windowTitle')}
							onChange={value => setState(index, 'title', value || undefined)}
							value={String(st.values.title ?? '')}
						/>
					)}
					<ActionList
						{...props}
						actions={actionsOf(st)}
						onChange={actions =>
							setStates(states.map((s, i) => (i === index ? {...s, content: writeActions(actions, false).trim()} : s)))
						}
					/>
				</fieldset>
			))}
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() =>
						setStates([
							...states,
							{
								values: {
									value: Math.max(-1, ...states.map(st => Number(st.values.value)).filter(n => !isNaN(n))) + 1,
									label: l('newState')
								},
								extra: [],
								content: ''
							}
						])
					}
					type="button"
				>
					{l('addState')}
				</button>
			</div>
			<h4 className="signaly-block-subtitle">{l('rows', {count: rows.length})}</h4>
			<div className="signaly-field-hint">{l('rowsHint')}</div>
			<fieldset className="signaly-block-row">
				<legend>{l('fill')}</legend>
				<RangeField
					label={l('fillCount')}
					max={99}
					min={1}
					onChange={count => setFill({...fill, count})}
					step={1}
					unit=""
					value={fill.count}
				/>
				<RangeField
					label={l('fillFirst')}
					max={999}
					min={0}
					onChange={first => setFill({...fill, first})}
					step={1}
					unit=""
					value={fill.first}
				/>
				<RangeField
					label={l('fillDigits')}
					max={5}
					min={1}
					onChange={digits => setFill({...fill, digits})}
					step={1}
					unit=""
					value={fill.digits}
				/>
				<TextField
					hint={l('fillNameHint')}
					label={l('fillName')}
					onChange={name => setFill({...fill, name})}
					value={fill.name}
				/>
				<TextField
					hint={l('fillVariableHint')}
					label={l('fillVariable')}
					onChange={variable => setFill({...fill, variable})}
					value={fill.variable}
				/>
				<TextField
					hint={l('fillScreenHint')}
					label={l('fillScreen')}
					onChange={screen => setFill({...fill, screen})}
					value={fill.screen}
				/>
				<div className="signaly-block-buttons">
					<button
						className="signaly-button"
						onClick={() => {
							setRows([...rows, ...listRowsFill(fill)]);
							setFill({...fill, first: fill.first + fill.count});
						}}
						type="button"
					>
						{l('fillDo', {count: fill.count})}
					</button>
				</div>
			</fieldset>
			<datalist id="signaly-list-passages">
				{passages.map(p => (
					<option key={p} value={p} />
				))}
			</datalist>
			<div className="signaly-list-table">
				<span>{l('num')}</span>
				<span>{l('name')}</span>
				<span>{l('variable')}</span>
				<span>{l('screen')}</span>
				<span>{l('key')}</span>
				<span />
				{rows.map((row, index) => {
					const screen = String(row.values.passage ?? '');

					return (
						<React.Fragment key={index}>
							<input
								aria-label={l('num')}
								onChange={e => setRow(index, 'num', e.target.value)}
								value={String(row.values.num ?? '')}
							/>
							<input
								aria-label={l('name')}
								onChange={e => setRow(index, 'name', e.target.value)}
								value={String(row.values.name ?? '')}
							/>
							<input
								aria-label={l('variable')}
								onChange={e => {
									const name = e.target.value.trim().replace(/^\$?/, '$');

									setRow(index, 'var', name === '$' ? undefined : name);
								}}
								value={String(row.values.var ?? '')}
							/>
							<input
								aria-label={l('screen')}
								className={screen && !known.has(screen) ? 'signaly-list-missing' : undefined}
								list="signaly-list-passages"
								onChange={e => setRow(index, 'passage', e.target.value || undefined)}
								title={screen && !known.has(screen) ? l('missing') : undefined}
								value={screen}
							/>
							<input
								aria-label={l('key')}
								checked={row.values.key === true}
								onChange={e => setRow(index, 'key', e.target.checked || undefined)}
								type="checkbox"
							/>
							<span className="signaly-list-row-buttons">
								<IconButton
									disabled={index === 0}
									icon={<IconArrowUp />}
									iconOnly
									label={l('up')}
									onClick={() => setRows(move(rows, index, -1))}
								/>
								<IconButton
									disabled={index === rows.length - 1}
									icon={<IconArrowDown />}
									iconOnly
									label={l('down')}
									onClick={() => setRows(move(rows, index, 1))}
								/>
								<IconButton
									icon={<IconTrash />}
									iconOnly
									label={l('removeRow')}
									onClick={() => setRows(rows.filter((_, i) => i !== index))}
								/>
							</span>
						</React.Fragment>
					);
				})}
			</div>
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => setRows([...rows, {values: {num: String(rows.length + 1), name: ''}, extra: []}])}
					type="button"
				>
					{l('addRow')}
				</button>
			</div>
			{missing.length > 0 && (
				<div className="signaly-block-buttons">
					<button className="signaly-button" onClick={() => onCreatePassages(missing)} type="button">
						{l('createMissing', {count: missing.length})}
					</button>
				</div>
			)}
			<div className="signaly-field-hint">{l('hint')}</div>
		</>
	);
};
