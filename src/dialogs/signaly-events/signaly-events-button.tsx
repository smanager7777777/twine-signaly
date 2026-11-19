// «Twine СИГНАЛЫ»: кнопка «События» на вкладке «История» (сессия 35, этап Т4 — ответ Т4-4 А).

import {IconBolt} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyEventsWindow} from './signaly-events-window';

export interface SignalyEventsButtonProps {
	story: Story;
}

export const SignalyEventsButton: React.FC<SignalyEventsButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconBolt />} label={t('signaly.eventsWindow.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyEventsWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
