<?php
/**
 * Block editor script asset file (dependencies + version).
 *
 * @package Helpmate
 */

return array(
	'dependencies' => array(
		'wp-blocks',
		'wp-element',
		'wp-block-editor',
		'wp-components',
		'wp-i18n',
		'wp-server-side-render',
	),
	'version'      => defined( 'HELPMATE_VERSION' ) ? HELPMATE_VERSION : '2.0.2',
);
