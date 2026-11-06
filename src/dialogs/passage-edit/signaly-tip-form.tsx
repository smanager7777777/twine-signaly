// «Twine СИГНАЛЫ»: форма «Подсказка» (шаг 5.4, ответ 4А): текст на экране, текст
// подсказки, ширина. Вид рамки — в «Оформлении терминала». Каждое изменение
// сразу переписывает команду <<hovertip>> в тексте.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {removeTip, setTip, Tip, tipContent} from '../../util/signaly/signaly-tip';
import {RangeField} from '../signaly-appearance/signaly-appearance-fields';
import {AreaField} from './signaly-block-panel';

export const TipForm: React.FC<{
	onClose: () => void;
	onText: (text: string) => void;
	text: string;
	tip: Tip;
}> = ({onClose, onText, text, tip}) => {
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.tips.${key}`);

	return (
		<>
			<AreaField label={l('tip')} onChange={value => onText(setTip(text, tip, {tip: value}))} value={tip.tip} />
			<AreaField
				hint={l('contentHint')}
				label={l('content')}
				onChange={value => onText(setTip(text, tip, {content: value}))}
				value={tipContent(text, tip)}
			/>
			<RangeField
				hint={l('widthHint')}
				label={l('width')}
				max={1500}
				min={0}
				onChange={width => onText(setTip(text, tip, {width}))}
				unit={t('signaly.appearance.units.px')}
				value={tip.width}
			/>
			<button
				className="signaly-button"
				onClick={() => {
					onText(removeTip(text, tip));
					onClose();
				}}
				type="button"
			>
				{l('remove')}
			</button>
		</>
	);
};
