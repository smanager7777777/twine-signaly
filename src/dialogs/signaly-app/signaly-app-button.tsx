// «Twine СИГНАЛЫ»: кнопка «Приложение» на вкладке «История» (сессия 32, этап Т2).

import {IconDeviceMobile} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyAppWindow} from './signaly-app-window';

export interface SignalyAppButtonProps {
	story: Story;
}

export const SignalyAppButton: React.FC<SignalyAppButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton
				icon={<IconDeviceMobile />}
				label={t('signaly.app.button')}
				onClick={() => setOpen(true)}
			/>
			{open &&
				createPortal(
					<SignalyAppWindow onClose={() => setOpen(false)} story={story} />,
					document.body
				)}
		</>
	);
};
