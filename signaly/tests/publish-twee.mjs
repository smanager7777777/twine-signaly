// Быстрая публикация .twee в HTML с SugarCube 2.37.3 — только для проверок
// (как «Опубликовать» в Twine: пассажи в <tw-storydata>, JavaScript и стили
// истории — в отдельных тегах). Настоящая публикация — в программе.
// node publish-twee.mjs <история.twee> <игра.html> [debug] [start=Пассаж]
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const [input, output, ...flags] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const formatJs = fs.readFileSync(
	path.join(root, 'public/story-formats/sugarcube-2.37.3/format.js'),
	'utf8'
);
let format;
vm.runInNewContext(formatJs, {window: {storyFormat: f => (format = f)}});

const escape = s =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const source = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n');
const passages = [];
let current;
for (const line of source.split('\n')) {
	const header = /^::\s*(.*?)\s*(?:\[([^\]]*)\])?\s*(\{[^}]*\})?\s*$/.exec(line);
	if (line.startsWith('::') && header) {
		current = {name: header[1].replace(/\\(.)/g, '$1'), tags: header[2] ? header[2].split(/\s+/).filter(Boolean) : [], meta: header[3] ? JSON.parse(header[3]) : {}, lines: []};
		passages.push(current);
	} else if (current) {
		current.lines.push(line.replace(/^\\::/, '::'));
	}
}
passages.forEach(p => (p.text = p.lines.join('\n').replace(/\s+$/, '')));

const title = passages.find(p => p.name === 'StoryTitle').text.trim();
const data = JSON.parse(passages.find(p => p.name === 'StoryData').text);
const startFlag = flags.find(f => f.startsWith('start='));
const startName = startFlag ? startFlag.slice(6) : data.start;
const story = passages.filter(p => !['StoryTitle', 'StoryData'].includes(p.name));
const script = story.filter(p => p.tags.includes('script')).map(p => p.text).join('\n');
const style = story.filter(p => p.tags.includes('stylesheet')).map(p => p.text).join('\n');
const normal = story.filter(p => !p.tags.includes('script') && !p.tags.includes('stylesheet'));
let startPid = 1;
const passageData = normal
	.map((p, i) => {
		if (p.name === startName) startPid = i + 1;
		return `<tw-passagedata pid="${i + 1}" name="${escape(p.name)}" tags="${escape(p.tags.join(' '))}" position="${p.meta.position || '0,0'}" size="${p.meta.size || '100,100'}">${escape(p.text)}</tw-passagedata>`;
	})
	.join('');

const storyData =
	`<tw-storydata name="${escape(title)}" startnode="${startPid}" creator="Twine" creator-version="2.12.1" format="SugarCube" format-version="2.37.3" ifid="${data.ifid}" options="${flags.includes('debug') ? 'debug' : ''}" hidden>` +
	`<style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">${style}</style>` +
	`<script role="script" id="twine-user-script" type="text/twine-javascript">${script}</script>` +
	passageData +
	'</tw-storydata>';

fs.writeFileSync(
	output,
	format.source
		.replace(/{{STORY_NAME}}/g, () => escape(title))
		.replace(/{{STORY_DATA}}/g, () => storyData)
);
console.log(`${output}: ${normal.length} пассажей`);
