const {notarize} = require('@electron/notarize');
const path = require('path');
const pkg = require('./package.json');

const isPreview =
	/alpha|beta|pre/.test(pkg.version) || process.env.FORCE_PREVIEW;

module.exports = {
	async afterSign(context) {
		if (context.packager.platform.name === 'mac') {
			if (!('APPLE_APP_ID' in process.env)) {
				console.log(
					'APPLE_APP_ID environment variable is not set, skipping notarization'
				);
				return;
			}

			if (!('APPLE_ID' in process.env)) {
				console.log(
					'APPLE_ID environment variable is not set, skipping notarization'
				);
				return;
			}

			if (!('APPLE_ID_PASSWORD' in process.env)) {
				console.log(
					'APPLE_ID_PASSWORD environment variable is not set, skipping notarization'
				);
				return;
			}

			if (!('APPLE_TEAM_ID' in process.env)) {
				console.log(
					'APPLE_TEAM_ID environment variable is not set, skipping notarization'
				);
				return;
			}

			console.log('Notarizing Mac app...');
			await notarize({
				appBundleId: process.env.APPLE_APP_ID,
				appPath: path.join(context.appOutDir, `Twine.app`),
				appleId: process.env.APPLE_ID,
				appleIdPassword: process.env.APPLE_ID_PASSWORD,
				teamId: process.env.APPLE_TEAM_ID
			});
		}
	},

	// This step was necessary to ad hoc sign the app. Otherwise, on Apple Silicon
	// you get repeated prompts for file access. This is commented out because we
	// are able to sign the app thanks to the Interactive Fiction Technology
	// Foundation, but originally figuring this problem out took forever, so the
	// code below might be helpful to others making builds.
	// The code below was cribbed from https://github.com/alacritty/alacritty/issues/5840.
	//
	// afterSign(context) {
	// 	if (context.packager.platform.name === 'mac') {
	// 		console.log('Ad hoc signing Mac app...');
	// 		child_process.execSync(
	// 			'codesign --force --deep --sign - dist/electron/mac-universal/Twine.app'
	// 		);
	// 	}
	// },
	// «Twine СИГНАЛЫ»: своё имя и id, чтобы не пересекаться с обычным Twine.
	appId: 'ru.signaly.twine',
	productName: 'Twine СИГНАЛЫ',
	directories: {
		output: 'dist/electron'
	},
	extraMetadata: {
		main: 'electron-build/main/src/electron/main-process/index.js',
		name: 'twine-signaly',
		productName: 'Twine СИГНАЛЫ'
	},
	files: ['electron-build/**/*', 'node_modules/**/*'],
	linux: {
		artifactName: `Twine-${pkg.version}-Linux-\${arch}.zip`,
		target: [{arch: ['arm64', 'x64'], target: 'zip'}]
	},
	mac: {
		artifactName: `Twine-${pkg.version}-macOS.dmg`,
		icon: `icons/app-${isPreview ? 'preview' : 'release'}.png`,
		target: {arch: ['universal'], target: 'dmg'}
	},
	nsis: {
		oneClick: false,
		allowToChangeInstallationDirectory: true
	},
	win: {
		artifactName: `Twine-SIGNALY-${pkg.version}-Windows.\${ext}`,
		icon: `icons/app-${isPreview ? 'preview' : 'release'}-no-padding.ico`,
		target: {arch: ['x64'], target: 'zip'}
	}
};
