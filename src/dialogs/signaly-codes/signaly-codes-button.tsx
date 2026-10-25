// «Twine СИГНАЛЫ»: кнопка «Коды» на вкладке «История» (шаг 3.4).

import {IconPassword} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyCodesWindow} from './signaly-codes-window';

export interface SignalyCodesButtonProps {
	story: Story;
}

export const SignalyCodesButton: React.FC<SignalyCodesButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconPassword />} label={t('signaly.codes.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyCodesWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
