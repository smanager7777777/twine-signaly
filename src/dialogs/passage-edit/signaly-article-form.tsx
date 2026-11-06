// «Twine СИГНАЛЫ»: форма «Статья» (шаг 4.4, ответы 1А, 5А). Экран становится
// статьёй: первой строкой <<sg-article …>> и тег sg-article. Каждое изменение
// сразу переписывает команду в тексте.

import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {Passage, Story} from '../../store/stories';
import {
	ArticleHead,
	articleSections,
	readArticles,
	setArticle
} from '../../util/signaly/signaly-articles';
import {ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';

const newSection = '\u0000new';

export const ArticleForm: React.FC<{
	head: ArticleHead;
	text: string;
	passage: Passage;
	story: Story;
	tagged: boolean;
	onText: (text: string) => void;
	onTag: () => void;
	onRemove: () => void;
}> = ({head, onRemove, onTag, onText, passage, story, tagged, text}) => {
	const {t} = useTranslation();
	const l = (key: string) => t(`signaly.articles.${key}`);
	const write = (patch: Partial<ArticleHead>) => onText(setArticle(text, {...head, ...patch}));
	const sections = React.useMemo(() => articleSections(readArticles(story.passages)), [story.passages]);
	const [typing, setTyping] = React.useState(false);
	const asText = typing || (head.section !== '' && !sections.includes(head.section));

	return (
		<>
			{!tagged && (
				<div className="signaly-notice">
					{l('noTag')}{' '}
					<button className="signaly-button" onClick={onTag} type="button">
						{l('addTag')}
					</button>
				</div>
			)}
			<TextField
				hint={t('signaly.articles.titleHint', {name: passage.name})}
				label={l('name')}
				onChange={title => write({title})}
				value={head.title}
			/>
			<ChoiceField
				label={l('section')}
				onChange={value => {
					setTyping(value === newSection);
					write({section: value === newSection ? head.section : value});
				}}
				options={[
					{label: l('noSection'), value: ''},
					...sections.map(name => ({label: name, value: name})),
					{label: l('newSection'), value: newSection}
				]}
				value={asText ? newSection : head.section}
			/>
			{asText && (
				<TextField
					hint={l('sectionHint')}
					label={l('sectionName')}
					onChange={section => write({section: section.replace(/,/g, ' ')})}
					value={head.section}
				/>
			)}
			<TextField
				hint={l('orderHint')}
				label={l('order')}
				onChange={input => {
					const n = Number(input.replace(',', '.'));

					if (input.trim() !== '' && isFinite(n)) {
						write({order: n});
					}
				}}
				value={String(head.order)}
			/>
			<TextField hint={l('backHint')} label={l('back')} onChange={back => write({back})} value={head.back} />
			<div className="signaly-field-hint">{l('hint')}</div>
			<div className="signaly-block-buttons">
				<button
					className="signaly-button"
					onClick={() => {
						if (window.confirm(l('confirmRemove'))) {
							onRemove();
						}
					}}
					type="button"
				>
					{l('remove')}
				</button>
			</div>
		</>
	);
};
