/**
 * Helpmate blocks editor (vanilla wp.element — no build step required).
 */
( function ( wp ) {
	var registerBlockType = wp.blocks.registerBlockType;
	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var TextControl = wp.components.TextControl;
	var SelectControl = wp.components.SelectControl;
	var Notice = wp.components.Notice;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var ServerSideRender =
		wp.serverSideRender ||
		( wp.components && wp.components.ServerSideRender );
	function renderPreview( block, attributes ) {
		if ( ServerSideRender ) {
			return el( ServerSideRender, {
				block: block,
				attributes: attributes,
			} );
		}
		return el(
			'p',
			{ className: 'helpmate-block-preview-fallback' },
			__( 'Save the page and view on the front end to see this block.', 'helpmate-ai-chatbot' )
		);
	}

	var alignOptions = [
		{ label: __( 'Default', 'helpmate-ai-chatbot' ), value: '' },
		{ label: __( 'Left', 'helpmate-ai-chatbot' ), value: 'left' },
		{ label: __( 'Center', 'helpmate-ai-chatbot' ), value: 'center' },
		{ label: __( 'Right', 'helpmate-ai-chatbot' ), value: 'right' },
	];

	function SchedulingEdit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var blockProps = useBlockProps( {
			className: 'helpmate-block-scheduling',
		} );
		var data =
			typeof window !== 'undefined' && window.helpmateSchedulingBlock
				? window.helpmateSchedulingBlock
				: { warnings: [] };
		var warnings = data.warnings || [];

		return el(
			'div',
			blockProps,
			el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Content', 'helpmate-ai-chatbot' ), initialOpen: true },
					el( TextControl, {
						label: __( 'Heading', 'helpmate-ai-chatbot' ),
						value: attributes.headingText,
						onChange: function ( v ) {
							setAttributes( { headingText: v } );
						},
						placeholder: __(
							'Schedule an Appointment',
							'helpmate-ai-chatbot'
						),
					} ),
					el( SelectControl, {
						label: __( 'Text alignment', 'helpmate-ai-chatbot' ),
						value: attributes.textAlign,
						options: alignOptions,
						onChange: function ( v ) {
							setAttributes( { textAlign: v } );
						},
					} )
				)
			),
			warnings.map( function ( w, i ) {
				return el(
					Notice,
					{ key: i, status: 'warning', isDismissible: false },
					w
				);
			} ),
			renderPreview( 'helpmate/scheduling', attributes )
		);
	}

	registerBlockType( 'helpmate/scheduling', {
		edit: SchedulingEdit,
		save: function () {
			return null;
		},
	} );

	var styleFieldDefs = [
		{
			key: 'overrideBackgroundColor',
			label: __( 'Bar background', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideTextColor',
			label: __( 'Text color', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideTextFontSize',
			label: __( 'Text font size', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideButtonBackgroundColor',
			label: __( 'Button background', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideButtonTextColor',
			label: __( 'Button text color', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideButtonTextFontSize',
			label: __( 'Button font size', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideCountdownBackgroundColor',
			label: __( 'Countdown background', 'helpmate-ai-chatbot' ),
		},
		{
			key: 'overrideCountdownTextColor',
			label: __( 'Countdown text', 'helpmate-ai-chatbot' ),
		},
	];

	function PromoEdit( props ) {
		var attributes = props.attributes;
		var setAttributes = props.setAttributes;
		var blockProps = useBlockProps( {
			className: 'helpmate-block-promo-banner',
		} );
		var data =
			typeof window !== 'undefined' && window.helpmatePromoBlock
				? window.helpmatePromoBlock
				: { moduleEnabled: true, banners: [] };
		var banners = data.banners || [];
		var bannerOptions = [
			{
				label: __( '— Select —', 'helpmate-ai-chatbot' ),
				value: 0,
			},
		].concat(
			banners.map( function ( b ) {
				return {
					label:
						b.title && b.title !== ''
							? b.title + ' (ID ' + b.id + ')'
							: sprintf(
									/* translators: %d: Banner database ID */
									__( 'Banner (ID %d)', 'helpmate-ai-chatbot' ),
									b.id
							  ),
					value: b.id,
				};
			} )
		);

		var styleControls = styleFieldDefs.map( function ( f ) {
			var key = f.key;
			return el( TextControl, {
				key: key,
				label: f.label,
				value: attributes[ key ] || '',
				onChange: function ( val ) {
					var o = {};
					o[ key ] = val;
					setAttributes( o );
				},
			} );
		} );

		var promoChildren = [
			el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{
						title: __( 'Promo banner', 'helpmate-ai-chatbot' ),
						initialOpen: true,
					},
					el( SelectControl, {
						label: __( 'Banner', 'helpmate-ai-chatbot' ),
						value: attributes.bannerId,
						options: bannerOptions,
						onChange: function ( v ) {
							setAttributes( {
								bannerId: parseInt( v, 10 ) || 0,
							} );
						},
					} )
				),
				el(
					PanelBody,
					{
						title: __( 'Style overrides', 'helpmate-ai-chatbot' ),
						initialOpen: false,
					},
					el(
						'p',
						{ className: 'components-base-control__help' },
						__(
							'Leave empty to use colors and sizes from the Helpmate admin promo settings.',
							'helpmate-ai-chatbot'
						)
					),
					styleControls
				)
			),
		];
		if ( ! data.moduleEnabled ) {
			promoChildren.push(
				el(
					Notice,
					{ status: 'warning', isDismissible: false },
					__(
						'Promo Bar is disabled in Helpmate module settings.',
						'helpmate-ai-chatbot'
					)
				)
			);
		} else if ( ! attributes.bannerId ) {
			promoChildren.push(
				el(
					Notice,
					{ status: 'info', isDismissible: false },
					__( 'Select a promo banner.', 'helpmate-ai-chatbot' )
				)
			);
		}
		promoChildren.push(
			renderPreview( 'helpmate/promo-banner', attributes )
		);
		return el( 'div', blockProps, promoChildren );
	}

	registerBlockType( 'helpmate/promo-banner', {
		edit: PromoEdit,
		save: function () {
			return null;
		},
	} );
} )( window.wp );
