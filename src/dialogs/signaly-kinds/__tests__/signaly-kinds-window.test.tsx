import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../store/stories';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {sanitizeKinds, withKinds} from '../../../util/signaly/signaly-kinds';
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

	it('переносит старые кнопки на экране в элементы пассажей (сессия 6)', () => {
		const story = fakeStory(1);

		story.stylesheet = withKinds(
			'',
			sanitizeKinds({
				kinds: [],
				places: [{id: 'rad', name: 'РАД', corner: 'tr', x: 5, y: 2.75, kind: 'amber'}]
			})
		);
		story.script = '';
		story.passages[0].text = 'Текст <span class="sg-place-rad amber"><<link "РАД">><</link>></span>';
		render(
			<FakeStateProvider stories={[story]}>
				<TestWindow />
				<StoryInspector />
			</FakeStateProvider>
		);
		expect(screen.getByText(/signaly\.kinds\.placesMoved/)).toBeInTheDocument();
		expect(screen.queryByText('signaly.kinds.tabs.places')).not.toBeInTheDocument();
		fireEvent.click(screen.getByText('signaly.appearance.save'));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`).textContent).toContain(
			'Текст <<sg-place kind amber corner tr x 5 y 2.75>><<link "РАД">><</link>><</sg-place>>'
		);
		expect(stylesheet()).not.toContain('.sg-place-rad');
		expect(stylesheet()).toContain('"places":[]');
	});
});
