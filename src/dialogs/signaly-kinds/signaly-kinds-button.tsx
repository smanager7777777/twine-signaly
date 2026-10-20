// «Twine СИГНАЛЫ»: кнопка «Виды кнопок и ссылок» на вкладке «История».
// Окно открывается поверх всей программы.

import {IconClick} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyKindsWindow} from './signaly-kinds-window';

export interface SignalyKindsButtonProps {
	story: Story;
}

export const SignalyKindsButton: React.FC<
	SignalyKindsButtonProps
> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton
				icon={<IconClick />}
				label={t('signaly.kinds.button')}
				onClick={() => setOpen(true)}
			/>
			{open &&
				createPortal(
					<SignalyKindsWindow
						onClose={() => setOpen(false)}
						story={story}
					/>,
					document.body
				)}
		</>
	);
};
