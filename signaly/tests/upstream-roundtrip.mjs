// Совместимость с обычным Twine 2.12.1: история импортируется, экспортируется в
// .twee и публикуется в HTML без надстройки «Twine СИГНАЛЫ».
// node upstream-roundtrip.mjs <папка dist/web обычного Twine> <история.twee> <папка для результата> <playwright>
// Результат: <папка>/export.twee и <папка>/upstream.html.
import {createRequire} from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';

const [webDir, twee, outDir, playwrightPath] = process.argv.slice(2);
const require = createRequire(path.resolve('package.json'));
const {chromium} = require(playwrightPath);
fs.mkdirSync(outDir, {recursive: true});

const types = {html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png'};
const server = http
	.createServer((req, res) => {
		let file = path.join(webDir, decodeURIComponent(req.url.split('?')[0]));
		if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
		if (!fs.existsSync(file)) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream'});
		fs.createReadStream(file).pipe(res);
	})
	.listen(0);

const browser = await chromium.launch();
const page = await browser.newPage({acceptDownloads: true, locale: 'en-US', viewport: {width: 1400, height: 900}});
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForTimeout(2000);
const btn = re => page.getByRole('button', {name: re});
if (await btn(/^Skip$/).count()) await btn(/^Skip$/).click();
await page.getByRole('tab', {name: 'Library'}).click();
await btn(/^Import$/).click();
await page.locator('input[type=file]').setInputFiles(twee);
await page.waitForTimeout(1000);
const confirm = btn(/Import/);
if (await confirm.count()) await confirm.last().click();
await page.waitForTimeout(1000);
await page.getByText('27,03,2025').first().click();
await page.getByRole('tab', {name: 'Story'}).click();
await btn(/^Edit$/).first().click();
await page.waitForTimeout(1500);
await page.getByRole('tab', {name: 'Build'}).click();

async function download(re, file) {
	const [dl] = await Promise.all([page.waitForEvent('download'), btn(re).click()]);
	await dl.saveAs(path.join(outDir, file));
	console.log('записано:', path.join(outDir, file));
}

await download(/Export As Twee/, 'export.twee');
await download(/^Publish to File$/, 'upstream.html');
await browser.close();
server.close();
