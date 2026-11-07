// «Twine СИГНАЛЫ»: кнопка «Проверить историю» на вкладке «История» (сессия 25, ответ 2А).

import {IconListCheck} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyCheckWindow} from './signaly-check-window';

export interface SignalyCheckButtonProps {
	story: Story;
}

export const SignalyCheckButton: React.FC<SignalyCheckButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconListCheck />} label={t('signaly.check.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyCheckWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
