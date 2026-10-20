import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../store/stories';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {SignalyKindsWindow} from '../signaly-kinds-window';

const TestWindow: React.FC = () => {
	const {stories} = useStoriesContext();

	return <SignalyKindsWindow onClose={jest.fn()} story={stories[0]} />;
};

function renderWindow() {
	const story = fakeStory();

	story.stylesheet =
		'a {\n  color: #00cc00;\n}\n.amber a {\n  color: #FFBF00;\n}\n#other { color: red; }';
	story.script = 'author();';
	render(
		<FakeStateProvider stories={[story]}>
			<TestWindow />
			<StoryInspector />
		</FakeStateProvider>
	);
}

const stylesheet = () =>
	screen.getByTestId('story-inspector-stylesheet-default').textContent!;

describe('<SignalyKindsWindow>', () => {
	it('переносит виды из стилей автора и ничего не пишет до «Сохранить»', () => {
		renderWindow();
		expect(screen.getByText(/signaly\.kinds\.migrated/)).toBeInTheDocument();
		expect(screen.getByText('Янтарный')).toBeInTheDocument();
		expect(stylesheet()).not.toContain('СИГНАЛЫ');
		fireEvent.click(screen.getByText('signaly.appearance.save'));
		expect(stylesheet()).toContain('СИГНАЛЫ: виды кнопок и ссылок');
		expect(stylesheet()).toContain('.amber a {');
		expect(stylesheet()).toContain('#other { color: red; }');
		// Блок видов — после блока оформления.
		expect(stylesheet().indexOf('конец оформления терминала')).toBeLessThan(
			stylesheet().indexOf('виды кнопок и ссылок')
		);
	});

	it('добавляет свой вид с классом латиницей', () => {
		renderWindow();
		fireEvent.change(screen.getByPlaceholderText('signaly.kinds.newName'), {
			target: {value: 'Синий'}
		});
		fireEvent.click(screen.getByText('signaly.kinds.add'));
		fireEvent.click(screen.getByText('signaly.appearance.save'));
		expect(stylesheet()).toContain('.siniy a {');
		expect(stylesheet()).toContain('"name":"Синий"');
	});

	it('добавляет кнопку на экране', () => {
		renderWindow();
		fireEvent.click(screen.getByText('signaly.kinds.tabs.places'));
		fireEvent.change(screen.getByPlaceholderText('signaly.kinds.places.newName'), {
			target: {value: 'Звук'}
		});
		fireEvent.click(screen.getByText('signaly.kinds.places.add'));
		fireEvent.click(screen.getByText('signaly.appearance.save'));
		expect(stylesheet()).toContain('.sg-place-zvuk {');
		expect(stylesheet()).toContain('position: fixed;');
	});
});
