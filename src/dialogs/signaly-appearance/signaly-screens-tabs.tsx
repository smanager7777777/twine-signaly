// «Twine СИГНАЛЫ»: вкладки «Виды экранов» и «Стили текста» окна «Оформление
// терминала» (шаг 4.2, ответы 1А, 2А, 3А, 5А). Слева список заготовок, под ним
// настройки выбранной; всё, что не задано, берётся из общего оформления.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {systemFonts} from '../../util/signaly/signaly-appearance';
import {
	copyNamed,
	newScreenView,
	newTextStyle,
	ScreenView,
	Switch,
	TextPlace,
	textPlaces,
	TextStyle
} from '../../util/signaly/signaly-screens';
import {CheckField, ChoiceField, ColorField, RangeField, TextField} from './signaly-appearance-fields';

interface Shared {
	fonts: string[];
	onSaveColor: (color: string) => void;
	savedColors: string[];
	/** Сколько экранов пользуются заготовкой — для предупреждения об удалении. */
	used: (id: string) => number;
}

function fontOptions(fonts: string[], same: string) {
	return [
		{label: same, value: ''},
		...systemFonts.map(f => ({label: f, value: f})),
		...fonts.map(f => ({label: f.replace(/^media\/fonts\//, ''), value: f}))
	];
}

interface NamedListProps<T extends {id: string; name: string}> {
	items: T[];
	l: (key: string, options?: Record<string, unknown>) => string;
	onAdd: () => void;
	onChange: (items: T[]) => void;
	onCopy: () => void;
	onSelect: (index: number) => void;
	selected: number;
	used: (id: string) => number;
}

function NamedList<T extends {id: string; name: string}>(props: NamedListProps<T>) {
	const {items, l, onAdd, onChange, onCopy, onSelect, selected, used} = props;
	const row = items[selected];

	function remove() {
		const count = used(row.id);
		const text = count > 0 ? l('confirmDeleteUsed', {name: row.name, count}) : l('confirmDelete', {name: row.name});

		if (window.confirm(text)) {
			onChange(items.filter((_, i) => i !== selected));
			onSelect(Math.max(0, selected - 1));
		}
	}

	return (
		<>
			<div className="signaly-kinds-list">
				{items.map((item, i) => (
					<button
						aria-pressed={i === selected}
						className="signaly-kinds-item"
						key={item.id}
						onClick={() => onSelect(i)}
						type="button"
					>
						{item.name}
					</button>
				))}
			</div>
			<div className="signaly-sound-actions">
				<button className="signaly-button" onClick={onAdd} type="button">
					{l('add')}
				</button>
				<button className="signaly-button" disabled={!row} onClick={onCopy} type="button">
					{l('copy')}
				</button>
				<button className="signaly-button" disabled={!row} onClick={remove} type="button">
					{l('delete')}
				</button>
			</div>
		</>
	);
}

export interface ScreenViewsTabProps extends Shared {
	onChange: (views: ScreenView[]) => void;
	onSelect: (index: number) => void;
	selected: number;
	views: ScreenView[];
}

export const ScreenViewsTab: React.FC<ScreenViewsTabProps> = props => {
	const {fonts, onChange, onSaveColor, onSelect, savedColors, selected, used, views} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.screens.${key}`, options);
	const px = t('signaly.appearance.units.px');
	const view = views[selected];
	const set = (patch: Partial<ScreenView>) => onChange(views.map((v, i) => (i === selected ? {...v, ...patch} : v)));

	const color = (key: 'borderColor' | 'glowColor', label: string) => (
		<ColorField label={label} onChange={value => set({[key]: value})} onSaveColor={onSaveColor} savedColors={savedColors} value={view[key]} />
	);
	const ownColor = (key: 'pageBg' | 'winBg' | 'textColor', hint?: string) => (
		<>
			<CheckField
				hint={hint}
				label={l(`fields.${key}Own`)}
				onChange={own => set({[key]: own ? '#000000' : ''})}
				value={view[key] !== ''}
			/>
			{view[key] !== '' && (
				<ColorField label={l(`fields.${key}`)} onChange={value => set({[key]: value})} onSaveColor={onSaveColor} savedColors={savedColors} value={view[key]} />
			)}
		</>
	);
	const range = (key: 'borderWidth' | 'glowSize' | 'winWidth' | 'winHeight' | 'winOffsetX' | 'winOffsetY', min: number, max: number) => (
		<RangeField label={l(`fields.${key}`)} max={max} min={min} onChange={value => set({[key]: value})} unit={px} value={view[key]} />
	);
	const fx = (key: 'vignette' | 'noise', valueKey: 'vignetteValue' | 'noiseValue') => (
		<>
			<ChoiceField
				label={l(`fields.${key}`)}
				onChange={value => set({[key]: value as Switch})}
				options={[
					{label: l('same'), value: 'same'},
					{label: l('switch.on'), value: 'on'},
					{label: l('switch.off'), value: 'off'}
				]}
				value={view[key]}
			/>
			{view[key] === 'on' && (
				<RangeField label={l('fields.fxValue')} max={100} min={1} onChange={value => set({[valueKey]: value})} unit="%" value={view[valueKey]} />
			)}
		</>
	);

	return (
		<>
			<p className="signaly-field-hint">{l('intro')}</p>
			<NamedList
				items={views}
				l={key => l(`list.${key}`)}
				onAdd={() => {
					onChange([...views, newScreenView(views, l('newName'))]);
					onSelect(views.length);
				}}
				onChange={onChange}
				onCopy={() => {
					const next = views.slice();

					next.splice(selected + 1, 0, copyNamed(views, view, l('copySuffix')));
					onChange(next);
					onSelect(selected + 1);
				}}
				onSelect={onSelect}
				selected={selected}
				used={used}
			/>
			{!view && <p className="signaly-field-hint">{l('empty')}</p>}
			{view && (
				<>
					<TextField hint={l('nameHint')} label={l('name')} onChange={name => set({name})} value={view.name} />
					<section>
						<h3>{l('sections.frame')}</h3>
						<ChoiceField
							label={l('fields.frame')}
							onChange={value => set({frame: value as ScreenView['frame']})}
							options={[
								{label: l('same'), value: 'same'},
								{label: l('frame.none'), value: 'none'},
								{label: l('frame.own'), value: 'own'}
							]}
							value={view.frame}
						/>
						{view.frame === 'own' && (
							<>
								{range('borderWidth', 0, 20)}
								{color('borderColor', l('fields.borderColor'))}
								{range('glowSize', 0, 60)}
								{color('glowColor', l('fields.glowColor'))}
							</>
						)}
					</section>
					<section>
						<h3>{l('sections.window')}</h3>
						<ChoiceField
							hint={l('sizeHint')}
							label={l('fields.size')}
							onChange={value => set({size: value as ScreenView['size']})}
							options={[
								{label: l('same'), value: 'same'},
								{label: l('size.full'), value: 'full'},
								{label: l('size.own'), value: 'own'}
							]}
							value={view.size}
						/>
						{view.size === 'own' && (
							<>
								{range('winWidth', 200, 1920)}
								{range('winHeight', 200, 1080)}
								{range('winOffsetX', -900, 900)}
								{range('winOffsetY', -500, 500)}
							</>
						)}
						<CheckField
							label={l('fields.paddingOwn')}
							onChange={own => set({padding: own ? 20 : null})}
							value={view.padding !== null}
						/>
						{view.padding !== null && (
							<RangeField label={l('fields.padding')} max={200} min={0} onChange={padding => set({padding})} unit={px} value={view.padding} />
						)}
					</section>
					<section>
						<h3>{l('sections.colors')}</h3>
						{ownColor('winBg', l('winBgHint'))}
						{ownColor('pageBg')}
						{ownColor('textColor', l('textColorHint'))}
					</section>
					<section>
						<h3>{l('sections.text')}</h3>
						<ChoiceField label={l('fields.font')} onChange={font => set({font})} options={fontOptions(fonts, l('same'))} value={view.font} />
						<CheckField
							label={l('fields.fontSizeOwn')}
							onChange={own => set({fontSize: own ? 25 : null})}
							value={view.fontSize !== null}
						/>
						{view.fontSize !== null && (
							<RangeField label={l('fields.fontSize')} max={300} min={8} onChange={fontSize => set({fontSize})} unit={px} value={view.fontSize} />
						)}
						<div className="signaly-field">
							<div className="signaly-field-label">{l('fields.textPlace')}</div>
							<div className="signaly-place-grid" role="group" aria-label={l('fields.textPlace')}>
								{textPlaces.map(place => (
									<button
										aria-label={l(`place.${place}`)}
										aria-pressed={view.textPlace === place}
										className="signaly-place-cell"
										key={place}
										onClick={() => set({textPlace: view.textPlace === place ? ('' as TextPlace) : place})}
										title={l(`place.${place}`)}
										type="button"
									/>
								))}
							</div>
							<div className="signaly-field-hint">
								{view.textPlace ? l(`place.${view.textPlace}`) : l('placeSame')}
							</div>
						</div>
					</section>
					<section>
						<h3>{l('sections.effects')}</h3>
						<ChoiceField
							label={l('fields.flicker')}
							onChange={value => set({flicker: value as Switch})}
							options={[
								{label: l('same'), value: 'same'},
								{label: l('switch.on'), value: 'on'},
								{label: l('switch.off'), value: 'off'}
							]}
							value={view.flicker}
						/>
						{fx('vignette', 'vignetteValue')}
						{fx('noise', 'noiseValue')}
					</section>
				</>
			)}
		</>
	);
};

export interface TextStylesTabProps extends Shared {
	onChange: (styles: TextStyle[]) => void;
	onSelect: (index: number) => void;
	selected: number;
	styles: TextStyle[];
}

export const TextStylesTab: React.FC<TextStylesTabProps> = props => {
	const {fonts, onChange, onSaveColor, onSelect, savedColors, selected, styles, used} = props;
	const {t} = useTranslation();
	const l = (key: string, options?: Record<string, unknown>) => t(`signaly.textStyles.${key}`, options);
	const style = styles[selected];
	const set = (patch: Partial<TextStyle>) => onChange(styles.map((s, i) => (i === selected ? {...s, ...patch} : s)));

	return (
		<>
			<p className="signaly-field-hint">{l('intro')}</p>
			<NamedList
				items={styles}
				l={key => l(`list.${key}`)}
				onAdd={() => {
					onChange([...styles, newTextStyle(styles, l('newName'))]);
					onSelect(styles.length);
				}}
				onChange={onChange}
				onCopy={() => {
					const next = styles.slice();

					next.splice(selected + 1, 0, copyNamed(styles, style, l('copySuffix')));
					onChange(next);
					onSelect(selected + 1);
				}}
				onSelect={onSelect}
				selected={selected}
				used={used}
			/>
			{!style && <p className="signaly-field-hint">{l('empty')}</p>}
			{style && (
				<>
					<TextField label={l('name')} onChange={name => set({name})} value={style.name} />
					<ChoiceField label={l('font')} onChange={font => set({font})} options={fontOptions(fonts, l('same'))} value={style.font} />
					<CheckField label={l('sizeOwn')} onChange={own => set({size: own ? 25 : null})} value={style.size !== null} />
					{style.size !== null && (
						<RangeField label={l('size')} max={300} min={8} onChange={size => set({size})} unit={t('signaly.appearance.units.px')} value={style.size} />
					)}
					<CheckField label={l('colorOwn')} onChange={own => set({color: own ? '#00cc00' : ''})} value={style.color !== ''} />
					{style.color !== '' && (
						<ColorField label={l('color')} onChange={color => set({color})} onSaveColor={onSaveColor} savedColors={savedColors} value={style.color} />
					)}
					<RangeField hint={l('glowHint')} label={l('glow')} max={60} min={0} onChange={glow => set({glow})} unit={t('signaly.appearance.units.px')} value={style.glow} />
					{style.glow > 0 && (
						<>
							<CheckField label={l('glowColorOwn')} onChange={own => set({glowColor: own ? '#00cc00' : ''})} value={style.glowColor !== ''} />
							{style.glowColor !== '' && (
								<ColorField label={l('glowColor')} onChange={glowColor => set({glowColor})} onSaveColor={onSaveColor} savedColors={savedColors} value={style.glowColor} />
							)}
						</>
					)}
					<CheckField label={l('lineHeightOwn')} onChange={own => set({lineHeight: own ? 1.5 : null})} value={style.lineHeight !== null} />
					{style.lineHeight !== null && (
						<RangeField hint={l('lineHeightHint')} label={l('lineHeight')} max={4} min={0.6} onChange={lineHeight => set({lineHeight})} step={0.05} unit={l('lineHeightUnit')} value={style.lineHeight} />
					)}
				</>
			)}
		</>
	);
};
