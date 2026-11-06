// «Twine СИГНАЛЫ»: форма блока «Кнопка-перебор» (этап 6, ответ 2А): значения,
// переменная, вид. Значение лежит в переменной, каждый щелчок даёт следующее.

import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {PickOption, ScreenBlock, Value} from '../../util/signaly/signaly-screen-blocks';
import {KnownVariable} from '../../util/signaly/signaly-variables';
import {ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';

export interface PickFormProps {
	block: ScreenBlock;
	kinds: Array<{cls: string; name: string}>;
	variables: KnownVariable[];
	write: (next: Omit<ScreenBlock, 'from' | 'to'>) => void;
}

/** Значение: число остаётся числом. */
function pickValue(input: string): Value {
	const n = Number(input.replace(',', '.'));

	return input.trim() !== '' && isFinite(n) ? n : input;
}

function move<T>(list: T[], index: number, by: number) {
	const next = [...list];
	const [item] = next.splice(index, 1);

	next.splice(index + by, 0, item);
	return next;
}

export const PickForm: React.FC<PickFormProps> = props => {
	const {block, kinds, variables, write} = props;
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.blocks.pick.${key}`);
	const options = block.options ?? [];
	const set = (key: string, value: Value | undefined) => write({...block, values: {...block.values, [key]: value}});
	const setOptions = (next: PickOption[]) => write({...block, options: next});
	const setOption = (index: number, key: string, value: Value) =>
		setOptions(options.map((o, i) => (i === index ? {...o, values: {...o.values, [key]: value}} : o)));
	const values = options.map(o => String(o.values.value ?? ''));
	const repeated = new Set(values).size !== values.length;

	return (
		<>
			<div className="signaly-field">
				<label className="signaly-field-label">
					{l('variable')}
					<input
						className="signaly-text"
						list="signaly-pick-variables"
						onChange={e => set('var', e.target.value.trim().replace(/^\$?/, '$'))}
						value={String(block.values.var ?? '')}
					/>
				</label>
				<datalist id="signaly-pick-variables">
					{variables.map(item => (
						<option key={item.name} value={`$${item.name}`} />
					))}
				</datalist>
				<div className="signaly-field-hint">{l('variableHint')}</div>
			</div>
			<ChoiceField
				label={l('form')}
				onChange={value => set('form', value === 'button' ? 'button' : undefined)}
				options={['button', 'link'].map(value => ({label: l(`forms.${value}`), value}))}
				value={block.values.form === 'button' ? 'button' : 'link'}
			/>
			<ChoiceField
				label={l('kind')}
				onChange={value => set('kind', value || undefined)}
				options={kinds.map(k => ({label: k.name, value: k.cls}))}
				value={String(block.values.kind ?? '')}
			/>
			<h4 className="signaly-block-subtitle">{l('values')}</h4>
			<div className="signaly-field-hint">{l('valuesHint')}</div>
			{options.map((option, index) => (
				<fieldset className="signaly-block-row" key={index}>
					<legend>
						{index + 1}
						<IconButton
							disabled={index === 0}
							icon={<IconArrowUp />}
							iconOnly
							label={l('up')}
							onClick={() => setOptions(move(options, index, -1))}
						/>
						<IconButton
							disabled={index === options.length - 1}
							icon={<IconArrowDown />}
							iconOnly
							label={l('down')}
							onClick={() => setOptions(move(options, index, 1))}
						/>
						<IconButton
							disabled={options.length === 1}
							icon={<IconTrash />}
							iconOnly
							label={l('remove')}
							onClick={() => setOptions(options.filter((_, i) => i !== index))}
						/>
					</legend>
					<TextField
						label={l('label')}
						onChange={value => setOption(index, 'label', value)}
						value={String(option.values.label ?? '')}
					/>
					<TextField
						label={l('value')}
						onChange={value => setOption(index, 'value', pickValue(value))}
						value={String(option.values.value ?? '')}
					/>
				</fieldset>
			))}
			{repeated && <div className="signaly-field-hint">{l('repeated')}</div>}
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() =>
						setOptions([
							...options,
							{
								values: {
									label: l('newValue'),
									value: Math.max(-1, ...options.map(o => Number(o.values.value)).filter(n => !isNaN(n))) + 1
								},
								extra: []
							}
						])
					}
					type="button"
				>
					{l('add')}
				</button>
			</div>
		</>
	);
};
