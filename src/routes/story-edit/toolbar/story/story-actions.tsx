import * as React from 'react';
import {ButtonBar} from '../../../../components/container/button-bar';
import {RenameStoryButton} from '../../../../components/story/rename-story-button';
import {SignalyCheckButton} from '../../../../dialogs/signaly-check';
import {SignalyAppearanceButton} from '../../../../dialogs/signaly-appearance';
import {SignalyCodesButton} from '../../../../dialogs/signaly-codes';
import {SignalyKeysButton} from '../../../../dialogs/signaly-keys';
import {SignalyKindsButton} from '../../../../dialogs/signaly-kinds';
import {SignalySoundsButton} from '../../../../dialogs/signaly-sounds';
import {SignalyTickerButton} from '../../../../dialogs/signaly-ticker';
import {SignalyMusicButton} from '../../../../dialogs/signaly-music';
import {SignalyRadioButton} from '../../../../dialogs/signaly-radio';
import {SignalyVariablesButton} from '../../../../dialogs/signaly-variables';
import {Story, updateStory, useStoriesContext} from '../../../../store/stories';
import {DetailsButton} from './details-button';
import {FindReplaceButton} from './find-replace-button';
import {JavaScriptButton} from './javascript-button';
import {PassageTagsButton} from './passage-tags-button';
import {StylesheetButton} from './stylesheet-button';

export interface StoryActionsProps {
	story: Story;
}

export const StoryActions: React.FC<StoryActionsProps> = props => {
	const {dispatch, stories} = useStoriesContext();
	const {story} = props;

	return (
		<ButtonBar>
			<FindReplaceButton story={story} />
			<RenameStoryButton
				existingStories={stories}
				onRename={name => dispatch(updateStory(stories, story, {name}))}
				story={story}
			/>
			<DetailsButton story={story} />
			<PassageTagsButton story={story} />
			<JavaScriptButton story={story} />
			<StylesheetButton story={story} />
			<SignalyAppearanceButton story={story} />
			<SignalyKindsButton story={story} />
			<SignalySoundsButton story={story} />
			<SignalyVariablesButton story={story} />
			<SignalyKeysButton story={story} />
			<SignalyCodesButton story={story} />
			<SignalyTickerButton story={story} />
			<SignalyMusicButton story={story} />
			<SignalyRadioButton story={story} />
			<SignalyCheckButton story={story} />
		</ButtonBar>
	);
};
