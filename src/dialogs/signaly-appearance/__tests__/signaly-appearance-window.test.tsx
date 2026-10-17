import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../store/stories';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {SignalyAppearanceWindow} from '../signaly-appearance-window';

const TestWindow: React.FC<{onClose?: () => void}> = ({
	onClose = jest.fn()
}) => {
	const {stories} = useStoriesContext();

	return <SignalyAppearanceWindow onClose={onClose} story={stories[0]} />;
};

function renderWindow() {
	const story = fakeStory();

	story.stylesheet =
		'body {\n  background-color: #000000;\n  color: #00cc00;\n  font-size: 25px;\n}\na { color: red; }';
	story.script = 'author();';
	render(
		<FakeStateProvider stories={[story]}>
			<TestWindow />
			<StoryInspector />
		</FakeStateProvider>
	);
}

describe('<SignalyAppearanceWindow>', () => {
	it('shows the settings read from the author stylesheet', () => {
		renderWindow();
		expect(
			screen.getByText(/signaly\.appearance\.migrated/)
		).toBeInTheDocument();
		expect(
			screen.getByRole('slider', {name: 'signaly.appearance.fields.fontSize'})
		).toHaveValue('25');
	});

	it('does not change the story until saved', () => {
		renderWindow();
		fireEvent.change(
			screen.getByRole('slider', {name: 'signaly.appearance.fields.fontSize'}),
			{target: {value: '30'}}
		);
		expect(
			screen.getByTestId('story-inspector-stylesheet-default')
		).not.toHaveTextContent('СИГНАЛЫ');
		fireEvent.click(screen.getByText('signaly.appearance.save'));

		const stylesheet = screen.getByTestId(
			'story-inspector-stylesheet-default'
		).textContent!;

		expect(stylesheet).toContain('--sg-font-size: 30px;');
		expect(stylesheet).toContain('a { color: red; }');
		// Правило body автора перенесено в блок.
		expect(stylesheet.split('конец оформления терминала')[1]).not.toContain(
			'body {'
		);
		expect(
			screen.getByTestId('story-inspector-javascript-default')
		).toHaveTextContent(/СИГНАЛЫ: движок терминала.*author\(\);/);
	});

	it('saves a color to the story palette', () => {
		renderWindow();
		fireEvent.change(
			screen.getByLabelText('signaly.appearance.fields.pageBg'),
			{target: {value: '#123456'}}
		);
		fireEvent.click(screen.getAllByTitle('signaly.appearance.saveColor')[0]);
		fireEvent.click(screen.getByText('signaly.appearance.save'));
		expect(
			screen.getByTestId('story-inspector-stylesheet-default')
		).toHaveTextContent(
			'"savedColors":["#00cc00","#ffbf00","#cc0000","#cccc00","#cc00cc","#000000","#123456"]'
		);
	});
});
