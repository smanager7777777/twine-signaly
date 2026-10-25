// «Twine СИГНАЛЫ»: кнопка «Горячие клавиши» на вкладке «История» (шаг 3.3).

import {IconKeyboard} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyKeysWindow} from './signaly-keys-window';

export interface SignalyKeysButtonProps {
	story: Story;
}

export const SignalyKeysButton: React.FC<SignalyKeysButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconKeyboard />} label={t('signaly.keys.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyKeysWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
