// «Twine СИГНАЛЫ»: кнопка «Радио» на вкладке «История» (шаг 7.2, ответ 1).

import {IconAntenna} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyRadioWindow} from './signaly-radio-window';

export const SignalyRadioButton: React.FC<{story: Story}> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconAntenna />} label={t('signaly.radio.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyRadioWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
