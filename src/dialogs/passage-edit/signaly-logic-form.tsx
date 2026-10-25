// «Twine СИГНАЛЫ»: формы условия, состояний и значения переменной (шаг 3.1,
// ответы автора 3А, 4А, 6А). Открываются из панели над текстом или щелчком по
// команде в тексте; каждое изменение сразу переписывает команду. Сам текст под
// условием правится в пассаже.

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	caseInput,
	caseValue,
	Cond,
	CondOp,
	Condition,
	replaceConditionHead,
	setConditionElse,
	StateCase,
	States,
	ValueShow,
	writeExpr,
	writeStates,
	writeValue
} from '../../util/signaly/signaly-logic';
import {
	KnownVariable,
	parseLiteral,
	variableTitle,
	VarType,
	VarValue
} from '../../util/signaly/signaly-variables';
import {
	CheckField,
	ChoiceField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';
import {AreaField} from './signaly-block-panel';

type L = (key: string, options?: Record<string, unknown>) => string;

function useL(): L {
	const {t} = useTranslation();

	return (key, options) => t(`signaly.logic.${key}`, options);
}

/** Выбор переменной: из окна «Переменные» и найденные в тексте. */
const VariableChoice: React.FC<{
	label: string;
	name: string;
	onChange: (name: string) => void;
	variables: KnownVariable[];
}> = ({label, name, onChange, variables}) => (
	<ChoiceField
		label={label}
		onChange={onChange}
		options={[
			...variables.map(v => ({label: variableTitle(v), value: v.name})),
			...(variables.some(v => v.name === name) ? [] : [{label: `$${name}`, value: name}])
		]}
		value={name}
	/>
);

function typeOfVar(variables: KnownVariable[], name: string): VarType | undefined {
	return variables.find(v => v.name === name)?.type;
}

/** Значение из поля ввода с учётом типа переменной. */
function inputValue(input: string, type: VarType | undefined): VarValue {
	if (type === 'text') {
		return input;
	}
	if (type === 'number') {
		const n = Number(input.replace(',', '.'));

		return input.trim() !== '' && !isNaN(n) ? n : input;
	}
	return parseLiteral(input) ?? input;
}

/** Поле значения: да-нет — выбор, остальное — строка. */
const ValueInput: React.FC<{
	label: string;
	onChange: (value: VarValue) => void;
	type?: VarType;
	value: VarValue | undefined;
}> = ({label, onChange, type, value}) => {
	const l = useL();

	if (type === 'bool') {
		return (
			<ChoiceField
				label={label}
				onChange={v => onChange(v === 'true')}
				options={[
					{label: l('yes'), value: 'true'},
					{label: l('no'), value: 'false'}
				]}
				value={String(value === true)}
			/>
		);
	}
	return (
		<TextField
			label={label}
			onChange={v => onChange(inputValue(v, type))}
			value={value === undefined ? '' : String(value)}
		/>
	);
};

/* ----- Условие ----- */

/** Строки условий: переменная, «включена / равна / …», значение; «все / хотя бы одно». */
export const CondRows: React.FC<{
	conds: Cond[];
	join: 'and' | 'or';
	onChange: (conds: Cond[], join: 'and' | 'or') => void;
	variables: KnownVariable[];
}> = ({conds, join: currentJoin, onChange, variables}) => {
	const l = useL();
	const write = (next: Cond[], join = currentJoin) => onChange(next, join);
	const change = (index: number, c: Partial<Cond>) =>
		write(conds.map((x, i) => (i === index ? {...x, ...c} : x)));

	return (
		<>
			{conds.map((c, index) => {
				const type = typeOfVar(variables, c.name);

				return (
					<fieldset className="signaly-block-row" key={index}>
						<legend>
							{l('cond.row', {n: index + 1})}
							<IconButton
								disabled={conds.length < 2}
								icon={<IconTrash />}
								iconOnly
								label={l('remove')}
								onClick={() => write(conds.filter((_, i) => i !== index))}
							/>
						</legend>
						<VariableChoice
							label={l('variable')}
							name={c.name}
							onChange={name => change(index, {name})}
							variables={variables}
						/>
						<ChoiceField
							label={l('cond.op')}
							onChange={op =>
								change(index, {
									op: op as CondOp,
									value: op === 'on' || op === 'off' ? undefined : c.value ?? (type === 'bool' ? true : type === 'text' ? '' : 0)
								})
							}
							options={(['on', 'off', 'eq', 'ne', 'gt', 'lt'] as const).map(op => ({label: l(`cond.ops.${op}`), value: op}))}
							value={c.op}
						/>
						{c.op !== 'on' && c.op !== 'off' && (
							<ValueInput
								label={l('valueField')}
								onChange={value => change(index, {value})}
								type={type}
								value={c.value}
							/>
						)}
					</fieldset>
				);
			})}
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => write([...conds, {name: variables[0]?.name ?? conds[0].name, op: 'on'}])}
					type="button"
				>
					{l('cond.add')}
				</button>
			</div>
			{conds.length > 1 && (
				<ChoiceField
					label={l('cond.join')}
					onChange={join => write(conds, join as 'and' | 'or')}
					options={[
						{label: l('cond.and'), value: 'and'},
						{label: l('cond.or'), value: 'or'}
					]}
					value={currentJoin}
				/>
			)}
		</>
	);
};

export const ConditionForm: React.FC<{
	cond: Condition;
	text: string;
	onText: (text: string) => void;
	variables: KnownVariable[];
}> = ({cond, onText, text, variables}) => {
	const l = useL();

	if (!cond.conds) {
		return (
			<>
				<div className="signaly-field-hint">{l('cond.code')}</div>
				<TextField
					label={l('cond.expr')}
					onChange={expr => onText(replaceConditionHead(text, cond, expr))}
					value={cond.expr}
				/>
				<CheckField
					label={l('cond.else')}
					onChange={on => onText(setConditionElse(text, cond, on, l('cond.elseSample')))}
					value={cond.elseFrom !== undefined}
				/>
			</>
		);
	}

	return (
		<>
			<CondRows
				conds={cond.conds}
				join={cond.join}
				onChange={(next, join) => onText(replaceConditionHead(text, cond, writeExpr(next, join)))}
				variables={variables}
			/>
			<CheckField
				hint={l('cond.elseHint')}
				label={l('cond.else')}
				onChange={on => {
					const elseText =
						cond.elseContentFrom !== undefined ? text.slice(cond.elseContentFrom, cond.to - '<</if>>'.length) : '';

					if (on || elseText.trim() === '' || window.confirm(l('cond.confirmNoElse'))) {
						onText(setConditionElse(text, cond, on, l('cond.elseSample')));
					}
				}}
				value={cond.elseFrom !== undefined}
			/>
			<div className="signaly-field-hint">{l('cond.hint')}</div>
		</>
	);
};

/* ----- Состояния ----- */

export const StatesForm: React.FC<{
	kinds: Array<{cls: string; name: string}>;
	states: States;
	text: string;
	onText: (text: string) => void;
	variables: KnownVariable[];
}> = ({kinds, onText, states, text, variables}) => {
	const l = useL();
	const name = /^\$([A-Za-z_]\w*)$/.exec(states.expr)?.[1];
	const type = name ? typeOfVar(variables, name) : undefined;
	const write = (next: Partial<Pick<States, 'expr' | 'cases'>>) =>
		onText(text.slice(0, states.from) + writeStates({...states, ...next}) + text.slice(states.to));
	const valued = states.cases.filter(c => c.value !== undefined);
	const other = states.cases.find(c => c.value === undefined);
	const setCases = (next: StateCase[], otherCase = other) =>
		write({cases: otherCase ? [...next, otherCase] : next});
	const change = (index: number, c: Partial<StateCase>) =>
		setCases(valued.map((x, i) => (i === index ? {...x, ...c} : x)));
	const move = (index: number, by: number) => {
		const next = [...valued];
		const [row] = next.splice(index, 1);

		next.splice(Math.max(0, Math.min(next.length, index + by)), 0, row);
		setCases(next);
	};
	const kindChoice = (c: StateCase, onChange: (kind: string) => void) => (
		<ChoiceField
			label={l('states.kind')}
			onChange={onChange}
			options={[{label: l('states.noKind'), value: ''}, ...kinds.filter(k => k.cls !== '').map(k => ({label: k.name, value: k.cls}))]}
			value={c.kind}
		/>
	);
	const caseText = (value: string) => (type === 'text' ? JSON.stringify(value) : caseValue(value));

	return (
		<>
			{name !== undefined ? (
				<VariableChoice
					label={l('variable')}
					name={name}
					onChange={next => write({expr: `$${next}`})}
					variables={variables}
				/>
			) : (
				<TextField label={l('states.expr')} onChange={expr => write({expr})} value={states.expr} />
			)}
			{valued.map((c, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{l('states.row', {n: index + 1})}
						<IconButton disabled={index === 0} icon={<IconArrowUp />} iconOnly label={l('up')} onClick={() => move(index, -1)} />
						<IconButton
							disabled={index === valued.length - 1}
							icon={<IconArrowDown />}
							iconOnly
							label={l('down')}
							onClick={() => move(index, 1)}
						/>
						<IconButton
							disabled={valued.length < 2}
							icon={<IconTrash />}
							iconOnly
							label={l('remove')}
							onClick={() => setCases(valued.filter((_, i) => i !== index))}
						/>
					</legend>
					{type === 'bool' ? (
						<ChoiceField
							label={l('states.value')}
							onChange={value => change(index, {value})}
							options={[
								{label: l('yes'), value: 'true'},
								{label: l('no'), value: 'false'}
							]}
							value={caseInput(c.value!)}
						/>
					) : (
						<TextField
							label={l('states.value')}
							onChange={value => change(index, {value: caseText(value)})}
							value={caseInput(c.value!)}
						/>
					)}
					{kindChoice(c, kind => change(index, {kind}))}
					<AreaField label={l('states.text')} onChange={content => change(index, {content})} value={c.content} />
				</fieldset>
			))}
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => {
						const last = valued[valued.length - 1];
						const n = last ? Number(caseInput(last.value!)) : NaN;
						const value = type === 'bool' ? (last?.value === 'true' ? 'false' : 'true') : isNaN(n) ? '""' : String(n + 1);

						setCases([...valued, {value, content: l('states.sample'), kind: last?.kind ?? ''}]);
					}}
					type="button"
				>
					{l('states.add')}
				</button>
			</div>
			<CheckField
				hint={l('states.otherHint')}
				label={l('states.other')}
				onChange={on => setCases(valued, on ? {content: l('states.sample'), kind: ''} : undefined)}
				value={other !== undefined}
			/>
			{other && (
				<fieldset className="signaly-block-row">
					<legend>{l('states.other')}</legend>
					{kindChoice(other, kind => setCases(valued, {...other, kind}))}
					<AreaField label={l('states.text')} onChange={content => setCases(valued, {...other, content})} value={other.content} />
				</fieldset>
			)}
			<div className="signaly-field-hint">{l('states.hint')}</div>
		</>
	);
};

/* ----- Значение ----- */

export const ValueForm: React.FC<{
	value: ValueShow;
	text: string;
	onText: (text: string) => void;
	variables: KnownVariable[];
}> = ({onText, text, value, variables}) => {
	const l = useL();
	const known = variables.find(v => v.name === value.name);
	const words = value.yes !== undefined || value.no !== undefined;
	const write = (next: Partial<ValueShow>) =>
		onText(text.slice(0, value.from) + writeValue({...value, ...next}) + text.slice(value.to));

	return (
		<>
			<VariableChoice
				label={l('variable')}
				name={value.name}
				onChange={name => {
					const v = variables.find(x => x.name === name);
					const bool = v?.type === 'bool';

					write({
						name,
						label: !value.label || value.label === known?.label ? v?.label ?? '' : value.label,
						yes: bool ? value.yes ?? l('yes') : v?.type ? undefined : value.yes,
						no: bool ? value.no ?? l('no') : v?.type ? undefined : value.no,
						of: v?.type === 'number' ? value.of : undefined
					});
				}}
				variables={variables}
			/>
			<TextField hint={l('value.labelHint')} label={l('value.label')} onChange={label => write({label})} value={value.label} />
			{known?.type === undefined && (
				<CheckField
					label={l('value.words')}
					onChange={on => write(on ? {yes: l('yes'), no: l('no'), of: undefined} : {yes: undefined, no: undefined})}
					value={words}
				/>
			)}
			{(known?.type === 'bool' || words) && (
				<>
					<TextField label={l('value.yes')} onChange={yes => write({yes, no: value.no ?? ''})} value={value.yes ?? ''} />
					<TextField label={l('value.no')} onChange={no => write({no, yes: value.yes ?? ''})} value={value.no ?? ''} />
				</>
			)}
			{known?.type !== 'bool' && known?.type !== 'text' && !words && (
				<>
					<CheckField
						label={l('value.of')}
						onChange={on => write({of: on ? 5 : undefined})}
						value={value.of !== undefined}
					/>
					{value.of !== undefined && (
						<TextField
							label={l('value.total')}
							onChange={input => {
								const n = Number(input.replace(',', '.'));

								if (input.trim() !== '' && !isNaN(n) && n >= 0) {
									write({of: n});
								}
							}}
							value={String(value.of)}
						/>
					)}
				</>
			)}
			<div className="signaly-field-hint">{l('value.hint')}</div>
		</>
	);
};
