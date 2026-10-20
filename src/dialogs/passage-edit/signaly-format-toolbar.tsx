// «Twine СИГНАЛЫ»: панель форматирования над текстом пассажа (шаг 1.3, ответы
// автора 3а и 5а). Вставляет обычную разметку SugarCube и HTML (см.
// util/signaly/signaly-format.ts), поэтому текст читается и работает в обычном
// Twine. Если курсор стоит внутри оформленного текста, панель показывает, как
// он оформлен (вид, место на экране, выравнивание, цвет, размер).

import {
	IconAlignCenter,
	IconAlignRight,
	IconBold,
	IconClick,
	IconHeading,
	IconItalic,
	IconList,
	IconMapPin,
	IconPalette,
	IconSeparatorHorizontal,
	IconStrikethrough,
	IconTextSize,
	IconUnderline
} from '@tabler/icons';
import CodeMirror from 'codemirror';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {ButtonBar} from '../../components/container/button-bar';
import {CardButton} from '../../components/control/card-button';
import {IconButton} from '../../components/control/icon-button';
import {MenuButton} from '../../components/control/menu-button';
import {Passage, Story, updateStory, useStoriesContext} from '../../store/stories';
import {
	defaultAppearance,
	readAppearance
} from '../../util/signaly/signaly-appearance';
import {normalizeHex} from '../../util/signaly/signaly-css';
import {
	Align,
	alignAt,
	applyAlign,
	applyKind,
	applyPlace,
	Edit,
	insertRule,
	kindAt,
	Mark,
	missingAlignCss,
	placeAt,
	setStyle,
	styleAt,
	toggleHeading,
	toggleList,
	toggleMark
} from '../../util/signaly/signaly-format';
import {readKinds} from '../../util/signaly/signaly-kinds';
import {SignalyPreviewButton} from '../signaly-passage-preview';
import './signaly-format-toolbar.css';

export interface SignalyFormatToolbarProps {
	disabled?: boolean;
	editor?: CodeMirror.Editor;
	passage: Passage;
	story: Story;
}

interface CursorInfo {
	kind: string;
	place: string;
	align: Align | '';
	color?: string;
	size?: string;
}

const sizes = ['50%', '75%', '125%', '150%', '200%', '300%'];

export const SignalyFormatToolbar: React.FC<SignalyFormatToolbarProps> = props => {
	const {disabled, editor, passage, story} = props;
	const {t} = useTranslation();
	const {dispatch, stories} = useStoriesContext();
	const [info, setInfo] = React.useState<CursorInfo>({kind: '', place: '', align: ''});
	const [colorOpen, setColorOpen] = React.useState(false);
	const [pickerColor, setPickerColor] = React.useState('#cc0000');
	const data = React.useMemo(() => readKinds(story.stylesheet), [story.stylesheet]);
	const kinds = React.useMemo(
		() => (data?.kinds ?? []).filter(k => k.cls !== ''),
		[data]
	);
	const places = data?.places ?? [];
	const savedColors = React.useMemo(
		() => (readAppearance(story.stylesheet) ?? defaultAppearance).savedColors,
		[story.stylesheet]
	);
	const kindClasses = React.useMemo(() => kinds.map(k => k.cls), [kinds]);

	const selection = React.useCallback(() => {
		const doc = editor!.getDoc();

		return {
			text: doc.getValue(),
			from: doc.indexFromPos(doc.getCursor('from')),
			to: doc.indexFromPos(doc.getCursor('to'))
		};
	}, [editor]);

	const updateInfo = React.useCallback(() => {
		if (!editor) {
			return;
		}

		const {text, from, to} = selection();

		setInfo({
			kind: kindAt(text, from, to, kindClasses),
			place: placeAt(text, from, to),
			align: alignAt(text, from, to),
			color: styleAt(text, from, to, 'color'),
			size: styleAt(text, from, to, 'font-size')
		});
	}, [editor, kindClasses, selection]);

	React.useEffect(() => {
		if (!editor) {
			return;
		}
		updateInfo();
		editor.on('cursorActivity', updateInfo);
		return () => editor.off('cursorActivity', updateInfo);
	}, [editor, updateInfo]);

	function run(make: (text: string, from: number, to: number) => Edit | undefined) {
		if (!editor) {
			return;
		}

		const doc = editor.getDoc();
		const {text, from, to} = selection();
		const edit = make(text, from, to);

		if (!edit) {
			editor.focus();
			return;
		}
		const expected = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

		editor.operation(() => {
			doc.replaceRange(edit.insert, doc.posFromIndex(edit.from), doc.posFromIndex(edit.to));
		});
		editor.focus();

		// Редактор Twine «управляемый»: правка доходит до текста не сразу, а после
		// обновления React, и курсор при этом сбрасывается. Ставим выделение,
		// когда новый текст уже в редакторе.
		let tries = 0;
		const select = () => {
			if (doc.getValue() !== expected && tries++ < 20) {
				window.setTimeout(select, 10);
				return;
			}
			doc.setSelection(doc.posFromIndex(edit.selFrom), doc.posFromIndex(edit.selTo));
			updateInfo();
		};

		Promise.resolve().then(select);
	}

	const mark = (m: Mark) => () => run((text, from, to) => toggleMark(text, from, to, m));

	function align(value: Align) {
		const css = missingAlignCss(story.stylesheet, value);

		if (css && info.align !== value) {
			// В таблице стилей нет класса выравнивания — добавляем его в конец.
			dispatch(
				updateStory(stories, story, {stylesheet: story.stylesheet.replace(/\s*$/, '') + css})
			);
		}
		run((text, from, to) => applyAlign(text, from, to, value));
	}

	function color(value: string | null) {
		run((text, from, to) => setStyle(text, from, to, 'color', value));
		setColorOpen(false);
	}

	const label = (key: string) => t(`signaly.format.${key}`);
	const kindName = kinds.find(k => k.cls === info.kind)?.name;
	const placeName = places.find(p => p.id === info.place)?.name;
	const off = disabled || !editor;

	return (
		<div className="signaly-format-toolbar">
			<ButtonBar>
				<IconButton disabled={off} icon={<IconBold />} iconOnly label={label('bold')} onClick={mark('bold')} />
				<IconButton disabled={off} icon={<IconItalic />} iconOnly label={label('italic')} onClick={mark('italic')} />
				<IconButton disabled={off} icon={<IconUnderline />} iconOnly label={label('underline')} onClick={mark('underline')} />
				<IconButton disabled={off} icon={<IconStrikethrough />} iconOnly label={label('strike')} onClick={mark('strike')} />
				<CardButton
					ariaLabel={label('color')}
					disabled={off}
					icon={
						<span className="signaly-format-color-icon">
							<IconPalette />
							<span style={{background: info.color ?? 'transparent'}} />
						</span>
					}
					iconOnly
					label={info.color ? `${label('color')}: ${info.color}` : label('color')}
					onChangeOpen={setColorOpen}
					open={colorOpen}
				>
					<div className="signaly-format-color-card">
						<p>{label('colorHint')}</p>
						<div className="signaly-swatches">
							{savedColors.map(c => (
								<button
									aria-label={c}
									className={c === info.color ? 'signaly-swatch selected' : 'signaly-swatch'}
									key={c}
									onClick={() => color(c)}
									style={{background: c}}
									title={c}
									type="button"
								/>
							))}
						</div>
						<div className="signaly-color">
							<input
								aria-label={label('otherColor')}
								className="signaly-color-picker"
								onChange={e => setPickerColor(e.target.value)}
								type="color"
								value={normalizeHex(pickerColor) ?? '#cc0000'}
							/>
							<button className="signaly-button" onClick={() => color(pickerColor)} type="button">
								{label('applyColor')}
							</button>
							<button
								className="signaly-button"
								disabled={!info.color}
								onClick={() => color(null)}
								type="button"
							>
								{label('removeColor')}
							</button>
						</div>
					</div>
				</CardButton>
				<MenuButton
					disabled={off}
					icon={<IconTextSize />}
					iconOnly
					items={[
						...sizes.map(size => ({
							checkable: true as const,
							checked: info.size === size,
							label: size,
							onClick: () =>
								run((text, from, to) => setStyle(text, from, to, 'font-size', size))
						})),
						{separator: true as const},
						{
							disabled: !info.size,
							label: label('normalSize'),
							onClick: () =>
								run((text, from, to) => setStyle(text, from, to, 'font-size', null))
						}
					]}
					label={info.size ? `${label('size')}: ${info.size}` : label('size')}
				/>
				<IconButton
					disabled={off}
					icon={<IconAlignCenter />}
					iconOnly
					label={label('center')}
					onClick={() => align('center')}
					selectable
					selected={info.align === 'center'}
				/>
				<IconButton
					disabled={off}
					icon={<IconAlignRight />}
					iconOnly
					label={label('right')}
					onClick={() => align('right')}
					selectable
					selected={info.align === 'right'}
				/>
				<MenuButton
					disabled={off}
					icon={<IconHeading />}
					iconOnly
					items={[1, 2, 3].map(level => ({
						label: label(`heading${level}`),
						onClick: () =>
							run((text, from, to) => toggleHeading(text, from, to, level))
					}))}
					label={label('heading')}
				/>
				<IconButton
					disabled={off}
					icon={<IconList />}
					iconOnly
					label={label('list')}
					onClick={() => run(toggleList)}
				/>
				<IconButton
					disabled={off}
					icon={<IconSeparatorHorizontal />}
					iconOnly
					label={label('rule')}
					onClick={() => run((text, from) => insertRule(text, from))}
				/>
				<MenuButton
					disabled={off}
					icon={<IconClick />}
					items={
						kinds.length === 0
							? [{disabled: true, label: label('noKinds'), onClick: () => {}}]
							: [
									...kinds.map(k => ({
										checkable: true as const,
										checked: info.kind === k.cls,
										label: k.name,
										onClick: () =>
											run((text, from, to) =>
												applyKind(text, from, to, k.cls, kindClasses, label('sampleLink'))
											)
									})),
									{separator: true as const},
									{
										disabled: info.kind === '',
										label: label('noKind'),
										onClick: () =>
											run((text, from, to) =>
												applyKind(text, from, to, '', kindClasses, '')
											)
									}
							  ]
					}
					label={kindName ? `${label('kind')}: ${kindName}` : label('kind')}
				/>
				<MenuButton
					disabled={off}
					icon={<IconMapPin />}
					items={
						places.length === 0
							? [{disabled: true, label: label('noPlaces'), onClick: () => {}}]
							: [
									...places.map(p => ({
										checkable: true as const,
										checked: info.place === p.id,
										label: p.name,
										onClick: () => run((text, from, to) => applyPlace(text, from, to, p))
									})),
									{separator: true as const},
									{
										disabled: info.place === '',
										label: label('noPlace'),
										onClick: () => run((text, from, to) => applyPlace(text, from, to, null))
									}
							  ]
					}
					label={placeName ? `${label('place')}: ${placeName}` : label('place')}
				/>
				<SignalyPreviewButton passageId={passage.id} />
			</ButtonBar>
		</div>
	);
};
