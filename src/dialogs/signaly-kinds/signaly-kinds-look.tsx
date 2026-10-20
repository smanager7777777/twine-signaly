// «Twine СИГНАЛЫ»: настройки одного облика (ссылки или кнопки) в окне «Виды
// кнопок и ссылок»: общие (размер, отступы, плавность) и три состояния —
// обычное, при наведении, при нажатии.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Look, LookState} from '../../util/signaly/signaly-kinds';
import {
	CheckField,
	ColorField,
	RangeField
} from '../signaly-appearance/signaly-appearance-fields';

interface ColorProps {
	onSaveColor: (color: string) => void;
	savedColors: string[];
}

interface StateEditorProps extends ColorProps {
	onChange: (value: LookState) => void;
	value: LookState;
}

const StateEditor: React.FC<StateEditorProps> = props => {
	const {onChange, onSaveColor, savedColors, value} = props;
	const {t} = useTranslation();
	const label = (key: string) => t(`signaly.kinds.fields.${key}`);
	const px = t('signaly.appearance.units.px');
	const set = <K extends keyof LookState>(key: K, v: LookState[K]) =>
		onChange({...value, [key]: v});
	const color = (key: 'color' | 'borderColor' | 'glowColor' | 'bg') => (
		<ColorField
			label={label(key)}
			onChange={v => set(key, v)}
			onSaveColor={onSaveColor}
			savedColors={savedColors}
			value={value[key] || '#000000'}
		/>
	);

	return (
		<>
			{color('color')}
			<CheckField
				label={label('noBg')}
				onChange={v => set('bg', v ? '' : value.color === '#000000' ? '#ffffff' : '#000000')}
				value={value.bg === ''}
			/>
			{value.bg !== '' && color('bg')}
			<RangeField
				hint={t('signaly.kinds.hints.borderWidth')}
				label={label('borderWidth')}
				max={10}
				min={0}
				onChange={v => set('borderWidth', v)}
				unit={px}
				value={value.borderWidth}
			/>
			{value.borderWidth > 0 && color('borderColor')}
			<RangeField
				hint={t('signaly.kinds.hints.glow')}
				label={label('glow')}
				max={40}
				min={0}
				onChange={v => set('glow', v)}
				unit={px}
				value={value.glow}
			/>
			{value.glow > 0 && color('glowColor')}
			<CheckField
				label={label('underline')}
				onChange={v => set('underline', v)}
				value={value.underline}
			/>
		</>
	);
};

export interface LookEditorProps extends ColorProps {
	onChange: (value: Look) => void;
	value: Look;
}

export const LookEditor: React.FC<LookEditorProps> = props => {
	const {onChange, onSaveColor, savedColors, value} = props;
	const {t} = useTranslation();
	const label = (key: string) => t(`signaly.kinds.fields.${key}`);
	const px = t('signaly.appearance.units.px');
	const colors = {onSaveColor, savedColors};
	const set = <K extends keyof Look>(key: K, v: Look[K]) =>
		onChange({...value, [key]: v});

	return (
		<>
			<section>
				<h3>{t('signaly.kinds.sections.common')}</h3>
				<RangeField
					hint={t('signaly.kinds.hints.size')}
					label={label('size')}
					max={300}
					min={30}
					onChange={v => set('size', v)}
					unit="%"
					value={value.size}
				/>
				<RangeField
					label={label('padV')}
					max={40}
					min={0}
					onChange={v => set('padV', v)}
					unit={px}
					value={value.padV}
				/>
				<RangeField
					label={label('padH')}
					max={60}
					min={0}
					onChange={v => set('padH', v)}
					unit={px}
					value={value.padH}
				/>
				<RangeField
					hint={t('signaly.kinds.hints.transition')}
					label={label('transition')}
					max={2}
					min={0}
					onChange={v => set('transition', v)}
					step={0.05}
					unit={t('signaly.appearance.units.seconds')}
					value={value.transition}
				/>
			</section>
			<section>
				<h3>{t('signaly.kinds.sections.normal')}</h3>
				<StateEditor
					{...colors}
					onChange={v => set('normal', v)}
					value={value.normal}
				/>
			</section>
			<section>
				<h3>{t('signaly.kinds.sections.hover')}</h3>
				<StateEditor
					{...colors}
					onChange={v => set('hover', v)}
					value={value.hover}
				/>
			</section>
			<section>
				<h3>{t('signaly.kinds.sections.active')}</h3>
				<CheckField
					label={label('activeAsHover')}
					onChange={v => set('active', v ? null : {...value.hover})}
					value={value.active === null}
				/>
				{value.active && (
					<StateEditor
						{...colors}
						onChange={v => set('active', v)}
						value={value.active}
					/>
				)}
			</section>
		</>
	);
};
