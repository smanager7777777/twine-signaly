// «Twine СИГНАЛЫ»: форма эффекта текста (шаг 2.1, ответ автора 5А). Открывается
// из кнопки «Эффект» или щелчком по команде эффекта в тексте; каждое изменение
// сразу переписывает команду. Сам текст под эффектом правится в пассаже.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	Effect,
	idsIn,
	replaceEffect,
	TimedSection
} from '../../util/signaly/signaly-effects';
import {
	CheckField,
	ChoiceField,
	RangeField,
	TextField
} from '../signaly-appearance/signaly-appearance-fields';

export interface SignalyEffectFormProps {
	effect: Effect;
	/** Виды кнопок и ссылок (для раскрытия). */
	kinds: Array<{cls: string; name: string}>;
	text: string;
	onText: (text: string) => void;
}

export function effectTitle(effect: Effect, t: (key: string) => string) {
	return t(`signaly.effects.types.${effect.type}`);
}

export const SignalyEffectForm: React.FC<SignalyEffectFormProps> = props => {
	const {effect, kinds, onText, text} = props;
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.effects.${key}`);
	const seconds = t('signaly.appearance.units.seconds');
	const write = (changed: Partial<Effect>) =>
		onText(replaceEffect(text, effect, {...effect, ...changed}));
	const content = text.slice(effect.contentFrom, effect.contentTo);

	// Сессия 7: начало — от открытия экрана или после эффектов выше.
	const begin = (
		<ChoiceField
			hint={l('beginHint')}
			label={l('begin')}
			onChange={value => write({after: value === 'after'})}
			options={['open', 'after'].map(value => ({label: l(`begins.${value}`), value}))}
			value={effect.after ? 'after' : 'open'}
		/>
	);
	const turnOn = effect.after ? 'after' : (effect.start ?? 0) > 0 ? 'open' : 'now';
	const turnOnFields = (
		<>
			<ChoiceField
				hint={l('beginHint')}
				label={l('turnOn')}
				onChange={value =>
					write({
						after: value === 'after',
						start: value === 'now' ? undefined : effect.start ?? (value === 'open' ? 2 : undefined)
					})
				}
				options={['now', 'open', 'after'].map(value => ({label: l(`turnOns.${value}`), value}))}
				value={turnOn}
			/>
			{turnOn !== 'now' && (
				<RangeField
					label={l('turnOnAfter')}
					max={60}
					min={0}
					onChange={start => write({start})}
					step={0.1}
					unit={seconds}
					value={effect.start ?? 0}
				/>
			)}
		</>
	);
	const more = <div className="signaly-field-hint">{l('moreHint')}</div>;

	switch (effect.type) {
		case 'type': {
			const v = effect.type_!;
			const set = (changes: Partial<typeof v>) => write({type_: {...v, ...changes}});

			return (
				<>
					{begin}
					<RangeField
						hint={l('speedHint')}
						label={l('speed')}
						max={300}
						min={5}
						onChange={speed => set({speed})}
						unit={t('signaly.effects.ms')}
						value={v.speed}
					/>
					<RangeField
						hint={l('startHint')}
						label={l('start')}
						max={30}
						min={0}
						onChange={start => set({start})}
						step={0.1}
						unit={seconds}
						value={v.start ?? 0.4}
					/>
					<ChoiceField
						label={l('cursor')}
						onChange={cursor => set({cursor: cursor as typeof v.cursor})}
						options={['blink', 'none', 'keep'].map(value => ({
							label: l(`cursors.${value}`),
							value
						}))}
						value={v.cursor}
					/>
					<CheckField
						hint={l('inlineHint')}
						label={l('inline')}
						onChange={inline => set({inline})}
						value={v.inline}
					/>
					<div className="signaly-field-hint">{l('typeHint')}</div>
					{more}
				</>
			);
		}

		case 'timed': {
			const sections = effect.sections!;
			const setDelay = (index: number, delay: number) =>
				write({
					sections: sections.map((s: TimedSection, i) => (i === index ? {...s, delay} : s))
				});
			let previous = sections[0].delay ?? 1;

			return (
				<>
					{begin}
					{sections.map((section, index) => {
						const delay = section.delay ?? previous;

						previous = delay;
						return (
							<RangeField
								hint={
									index === 0
										? undefined
										: section.content.trim().slice(0, 60) || l('emptyLine')
								}
								key={index}
								label={
									index === 0
										? sections.length > 1
											? l('firstAfter')
											: l('after')
										: `${l('nextAfter')} ${index + 1}`
								}
								max={60}
								min={0}
								onChange={value => setDelay(index, value)}
								step={0.1}
								unit={seconds}
								value={delay}
							/>
						);
					})}
					<CheckField label={l('fade')} onChange={fade => write({fade})} value={!!effect.fade} />
					<div className="signaly-field-hint">
						{sections.length > 1 ? l('linesHint') : l('timedHint')}
					</div>
					{more}
				</>
			);
		}

		case 'swap': {
			const ids = idsIn(text);

			return (
				<>
					{begin}
					<RangeField
						label={l('after')}
						max={120}
						min={0}
						onChange={delay =>
							write({sections: [{...effect.sections![0], delay}]})
						}
						step={0.1}
						unit={seconds}
						value={effect.sections?.[0]?.delay ?? 3}
					/>
					<ChoiceField
						hint={l('targetHint')}
						label={l('target')}
						onChange={target => write({target})}
						options={[...new Set([effect.target ?? '', ...ids])].map(id => ({
							label: id,
							value: id
						}))}
						value={effect.target ?? ''}
					/>
					<div className="signaly-field">
						<label className="signaly-field-label">
							{l('replacement')}
							<textarea
								className="signaly-text signaly-area"
								onChange={e => write({replacement: e.target.value})}
								rows={3}
								value={effect.replacement ?? ''}
							/>
						</label>
						<div className="signaly-field-hint">{t('signaly.blocks.contentHint')}</div>
					</div>
					<CheckField
						label={l('fade')}
						onChange={replaceFade => write({replaceFade})}
						value={!!effect.replaceFade}
					/>
					{more}
				</>
			);
		}

		case 'blink':
			return (
				<>
					<RangeField
						label={l('period')}
						max={5}
						min={0.2}
						onChange={period => write({period})}
						step={0.1}
						unit={seconds}
						value={effect.period ?? 1}
					/>
					{turnOnFields}
					<div className="signaly-field-hint">{l('blinkHint')}</div>
					{more}
				</>
			);

		case 'reveal':
			return (
				<>
					<TextField
						hint={l('revealLabelHint')}
						label={l('revealLabel')}
						onChange={label => write({label})}
						value={effect.label ?? ''}
					/>
					<div className="signaly-field">
						<label className="signaly-field-label">
							{l('revealText')}
							<textarea
								className="signaly-text signaly-area"
								onChange={e =>
									onText(text.slice(0, effect.contentFrom) + e.target.value + text.slice(effect.contentTo))
								}
								rows={3}
								value={content}
							/>
						</label>
						<div className="signaly-field-hint">{t('signaly.blocks.contentHint')}</div>
					</div>
					<ChoiceField
						label={l('revealForm')}
						onChange={value => write({button: value === 'button'})}
						options={['button', 'link'].map(value => ({label: l(`revealForms.${value}`), value}))}
						value={effect.button ? 'button' : 'link'}
					/>
					<ChoiceField
						label={l('revealKind')}
						onChange={value => write({kind: value || undefined})}
						options={kinds.map(k => ({label: k.name, value: k.cls}))}
						value={effect.kind ?? ''}
					/>
					<CheckField
						label={l('revealKeep')}
						onChange={keep => write({keep})}
						value={!!effect.keep}
					/>
					<div className="signaly-field-hint">{l(effect.keep ? 'revealKeepHint' : 'revealHint')}</div>
				</>
			);

		case 'glitch':
			return (
				<>
					<TextField
						label={l('glitchText')}
						onChange={value =>
							onText(
								text.slice(0, effect.contentFrom) + value + text.slice(effect.contentTo)
							)
						}
						value={content}
					/>
					<TextField
						hint={l('shadowHint')}
						label={l('shadow')}
						onChange={shadow => write({shadow})}
						value={effect.shadow ?? ''}
					/>
					{turnOnFields}
					<div className="signaly-field-hint">{l('glitchHint')}</div>
					{more}
				</>
			);
	}
};
