// «Twine СИГНАЛЫ»: кнопка «Оформление терминала» на вкладке «История».
// Окно открывается поверх всей программы.

import {IconPalette} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyAppearanceWindow} from './signaly-appearance-window';

export interface SignalyAppearanceButtonProps {
	story: Story;
}

export const SignalyAppearanceButton: React.FC<
	SignalyAppearanceButtonProps
> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton
				icon={<IconPalette />}
				label={t('signaly.appearance.button')}
				onClick={() => setOpen(true)}
			/>
			{open &&
				createPortal(
					<SignalyAppearanceWindow
						onClose={() => setOpen(false)}
						story={story}
					/>,
					document.body
				)}
		</>
	);
};
