// «Twine СИГНАЛЫ»: кнопка «Переменные» на вкладке «История» (шаг 3.1).

import {IconVariable} from '@tabler/icons';
import * as React from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {Story} from '../../store/stories';
import {SignalyVariablesWindow} from './signaly-variables-window';

export interface SignalyVariablesButtonProps {
	story: Story;
}

export const SignalyVariablesButton: React.FC<SignalyVariablesButtonProps> = ({story}) => {
	const [open, setOpen] = React.useState(false);
	const {t} = useTranslation();

	return (
		<>
			<IconButton icon={<IconVariable />} label={t('signaly.variables.button')} onClick={() => setOpen(true)} />
			{open && createPortal(<SignalyVariablesWindow onClose={() => setOpen(false)} story={story} />, document.body)}
		</>
	);
};
