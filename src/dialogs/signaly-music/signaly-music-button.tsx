// «Twine СИГНАЛЫ»: кнопка «Музыка» на вкладке «История» (шаг 7.1).

import {IconMusic} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyMusicWindow} from './signaly-music-window';

export const SignalyMusicButton: React.FC<{story: Story}> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconMusic />} label={t('signaly.music.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyMusicWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
