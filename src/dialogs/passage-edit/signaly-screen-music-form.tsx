// «Twine СИГНАЛЫ»: форма «Музыка экрана» (шаг 7.1, ответы 2А, 5А). Первой строкой
// экрана — <<sg-screen-music …>>: через сколько секунд после входа что сделать с
// текущей музыкой и что включить. Ушли с экрана раньше — ничего не происходит;
// после смены новая музыка играет дальше, пока другой экран не скажет иначе.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {ScreenMusic, setScreenMusic} from '../../util/signaly/signaly-music';
import {ChoiceField, RangeField} from '../signaly-appearance/signaly-appearance-fields';
import {CondListsContext} from './signaly-logic-form';

export const ScreenMusicForm: React.FC<{
	head: ScreenMusic;
	text: string;
	onText: (text: string) => void;
	onRemove: () => void;
}> = ({head, onRemove, onText, text}) => {
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.screenMusic.${key}`);
	const lists = React.useContext(CondListsContext);
	const write = (patch: Partial<ScreenMusic>) => onText(setScreenMusic(text, {...head, ...patch}));
	const s = t('signaly.appearance.units.seconds');
	const names = head.play === 'track' ? lists.tracks ?? [] : head.play === 'folder' ? lists.folders ?? [] : [];

	return (
		<>
			<p className="signaly-field-hint">{l('intro')}</p>
			<RangeField label={l('delay')} max={600} min={0} onChange={delay => write({delay})} step={0.5} unit={s} value={head.delay} />
			<ChoiceField
				label={l('now')}
				onChange={now => write({now: now as ScreenMusic['now']})}
				options={['', 'stop', 'fade'].map(v => ({label: l(`nows.${v || 'keep'}`), value: v}))}
				value={head.now}
			/>
			{head.now === 'fade' && (
				<RangeField label={l('fade')} max={60} min={0} onChange={fade => write({fade})} step={0.5} unit={s} value={head.fade} />
			)}
			<ChoiceField
				label={l('play')}
				onChange={play => write({play: play as ScreenMusic['play'], target: ''})}
				options={['', 'track', 'folder', 'ambient'].map(v => ({label: l(`plays.${v || 'none'}`), value: v}))}
				value={head.play}
			/>
			{(head.play === 'track' || head.play === 'folder') && (
				<ChoiceField
					hint={names.length ? undefined : t('signaly.actions.music.noCatalog')}
					label={l(head.play === 'track' ? 'track' : 'folder')}
					onChange={target => write({target})}
					options={[{label: l('choose'), value: ''}, ...[...new Set([head.target, ...names])].filter(Boolean).map(n => ({label: n, value: n}))]}
					value={head.target}
				/>
			)}
			{head.play !== '' && head.now === 'fade' && (
				<RangeField
					hint={l('afterHint')}
					label={l('after')}
					max={60}
					min={0}
					onChange={after => write({after})}
					step={0.5}
					unit={s}
					value={head.after}
				/>
			)}
			{head.play !== '' && (
				<RangeField hint={l('riseHint')} label={l('rise')} max={60} min={0} onChange={rise => write({rise})} step={0.5} unit={s} value={head.rise} />
			)}
			<p className="signaly-field-hint">{l('leaveHint')}</p>
			<button className="signaly-button" onClick={onRemove} type="button">
				{l('remove')}
			</button>
		</>
	);
};
