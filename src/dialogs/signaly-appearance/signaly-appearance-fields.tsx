// «Twine СИГНАЛЫ»: поля окна «Оформление терминала» — палитра, ползунок,
// галочка, выбор файла из папки игры, текст.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {normalizeHex} from '../../util/signaly/signaly-css';

interface FieldFrameProps {
	hint?: string;
	label: string;
	htmlFor?: string;
}

const FieldFrame: React.FC<React.PropsWithChildren<FieldFrameProps>> = ({
	children,
	hint,
	htmlFor,
	label
}) => (
	<div className="signaly-field">
		<label className="signaly-field-label" htmlFor={htmlFor}>
			{label}
		</label>
		<div className="signaly-field-control">{children}</div>
		{hint && <div className="signaly-field-hint">{hint}</div>}
	</div>
);

let fieldCounter = 0;

function useFieldId() {
	const [id] = React.useState(() => `signaly-field-${++fieldCounter}`);

	return id;
}

export interface ColorFieldProps {
	hint?: string;
	label: string;
	onChange: (value: string) => void;
	onSaveColor: (value: string) => void;
	savedColors: string[];
	value: string;
}

export const ColorField: React.FC<ColorFieldProps> = props => {
	const {hint, label, onChange, onSaveColor, savedColors, value} = props;
	const {t} = useTranslation();
	const id = useFieldId();
	const [text, setText] = React.useState(value);

	React.useEffect(() => setText(value), [value]);

	function commit() {
		const hex = normalizeHex(text.startsWith('#') ? text : `#${text}`);

		if (hex) {
			onChange(hex);
		} else {
			setText(value);
		}
	}

	return (
		<FieldFrame hint={hint} htmlFor={id} label={label}>
			<div className="signaly-color">
				<input
					aria-label={label}
					className="signaly-color-picker"
					id={id}
					onChange={e => onChange(e.target.value)}
					type="color"
					value={value}
				/>
				<input
					aria-label={t('signaly.appearance.hexCode')}
					className="signaly-color-hex"
					onBlur={commit}
					onChange={e => setText(e.target.value)}
					onKeyDown={e => e.key === 'Enter' && commit()}
					spellCheck={false}
					value={text}
				/>
				<button
					className="signaly-small-button"
					disabled={savedColors.includes(value)}
					onClick={() => onSaveColor(value)}
					title={t('signaly.appearance.saveColor')}
					type="button"
				>
					★
				</button>
			</div>
			<div className="signaly-swatches">
				{savedColors.map(color => (
					<button
						aria-label={color}
						className={
							color === value ? 'signaly-swatch selected' : 'signaly-swatch'
						}
						key={color}
						onClick={() => onChange(color)}
						style={{background: color}}
						title={color}
						type="button"
					/>
				))}
			</div>
		</FieldFrame>
	);
};

export interface RangeFieldProps {
	hint?: string;
	label: string;
	max: number;
	min: number;
	onChange: (value: number) => void;
	step?: number;
	unit: string;
	value: number;
}

export const RangeField: React.FC<RangeFieldProps> = props => {
	const {hint, label, max, min, onChange, step = 1, unit, value} = props;
	const id = useFieldId();
	const [text, setText] = React.useState(String(value));

	React.useEffect(() => setText(String(value)), [value]);

	function commit(raw: string) {
		const number = Number(raw.replace(',', '.'));

		if (raw.trim() !== '' && isFinite(number)) {
			// В поле можно ввести и больше, чем у ползунка (кроме отрицательных размеров).
			onChange(min >= 0 ? Math.max(0, number) : number);
		} else {
			setText(String(value));
		}
	}

	return (
		<FieldFrame hint={hint} htmlFor={id} label={label}>
			<div className="signaly-range">
				<input
					aria-label={label}
					id={id}
					max={max}
					min={min}
					onChange={e => onChange(Number(e.target.value))}
					step={step}
					type="range"
					value={Math.min(max, Math.max(min, value))}
				/>
				<input
					aria-label={`${label}, ${unit}`}
					className="signaly-number"
					inputMode="decimal"
					onBlur={e => commit(e.target.value)}
					onChange={e => setText(e.target.value)}
					onKeyDown={e =>
						e.key === 'Enter' && commit((e.target as HTMLInputElement).value)
					}
					value={text}
				/>
				<span className="signaly-unit">{unit}</span>
			</div>
		</FieldFrame>
	);
};

export interface CheckFieldProps {
	hint?: string;
	label: string;
	onChange: (value: boolean) => void;
	value: boolean;
}

export const CheckField: React.FC<CheckFieldProps> = props => {
	const {hint, label, onChange, value} = props;

	return (
		<div className="signaly-field signaly-check">
			<label>
				<input
					checked={value}
					onChange={e => onChange(e.target.checked)}
					type="checkbox"
				/>
				{label}
			</label>
			{hint && <div className="signaly-field-hint">{hint}</div>}
		</div>
	);
};

export interface ChoiceFieldProps {
	hint?: string;
	label: string;
	onChange: (value: string) => void;
	/** Варианты: значение → подпись. */
	options: Array<{label: string; value: string}>;
	value: string;
}

export const ChoiceField: React.FC<ChoiceFieldProps> = props => {
	const {hint, label, onChange, options, value} = props;
	const id = useFieldId();
	const all = options.some(option => option.value === value)
		? options
		: [...options, {label: value, value}];

	return (
		<FieldFrame hint={hint} htmlFor={id} label={label}>
			<select
				className="signaly-select"
				id={id}
				onChange={e => onChange(e.target.value)}
				value={value}
			>
				{all.map(option => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</FieldFrame>
	);
};

/**
 * Выбор кнопками (сессия 26): для коротких списков, где выпадающий список
 * у автора на Windows не раскрывался («Первое посещение»).
 */
export const ButtonsField: React.FC<ChoiceFieldProps> = props => {
	const {hint, label, onChange, options, value} = props;

	return (
		<div className="signaly-field">
			<div className="signaly-field-label">{label}</div>
			<div aria-label={label} className="signaly-field-control signaly-buttons-field" role="radiogroup">
				{options.map(option => (
					<button
						aria-checked={option.value === value}
						className="signaly-button"
						key={option.value}
						onClick={() => onChange(option.value)}
						role="radio"
						type="button"
					>
						{option.label}
					</button>
				))}
			</div>
			{hint && <div className="signaly-field-hint">{hint}</div>}
		</div>
	);
};

export interface TextFieldProps {
	hint?: string;
	label: string;
	onChange: (value: string) => void;
	value: string;
}

export const TextField: React.FC<TextFieldProps> = props => {
	const {hint, label, onChange, value} = props;
	const id = useFieldId();

	return (
		<FieldFrame hint={hint} htmlFor={id} label={label}>
			<input
				className="signaly-text"
				id={id}
				onChange={e => onChange(e.target.value)}
				value={value}
			/>
		</FieldFrame>
	);
};
