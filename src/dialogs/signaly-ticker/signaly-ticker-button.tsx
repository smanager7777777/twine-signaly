// «Twine СИГНАЛЫ»: кнопка «Строка событий» на вкладке «История» (шаг 4.1).

import {IconNews} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyTickerWindow} from './signaly-ticker-window';

export interface SignalyTickerButtonProps {
	story: Story;
}

export const SignalyTickerButton: React.FC<SignalyTickerButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconNews />} label={t('signaly.ticker.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyTickerWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
