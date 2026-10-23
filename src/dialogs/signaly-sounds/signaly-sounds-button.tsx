// «Twine СИГНАЛЫ»: кнопка «Звуки» на вкладке «История» (шаг 2.2).

import {IconMusic} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalySoundsWindow} from './signaly-sounds-window';

export interface SignalySoundsButtonProps {
	story: Story;
}

export const SignalySoundsButton: React.FC<SignalySoundsButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconMusic />} label={t('signaly.sounds.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalySoundsWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
