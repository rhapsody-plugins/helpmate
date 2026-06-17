/**
 * Render Helpmate order details after successful WPForms submit
 * when confirmation contains a helpmate order payload node.
 */
(function ($) {
	'use strict';

	var BADGE_STYLES = {
		delivered: { background: '#bbf7d0', color: '#166534' },
		shipped: { background: '#bfdbfe', color: '#1e40af' },
		processing: { background: '#fed7aa', color: '#c2410c' },
		cancelled: { background: '#fecaca', color: '#991b1b' },
		default: { background: '#e2e8f0', color: '#475569' },
	};

	function textNode(str) {
		return document.createTextNode(str == null ? '' : String(str));
	}

	function el(tag, className, styles) {
		var n = document.createElement(tag);
		if (className) {
			n.className = className;
		}
		if (styles) {
			Object.keys(styles).forEach(function (k) {
				n.style[k] = styles[k];
			});
		}
		return n;
	}

	function statusKey(status) {
		var s = (status || '').toLowerCase();
		if (s === 'delivered') return 'delivered';
		if (s === 'shipped') return 'shipped';
		if (s === 'processing') return 'processing';
		if (s === 'cancelled') return 'cancelled';
		return 'default';
	}

	function removeExistingByFormId(formId) {
		if (!formId) return;
		$('.helpmate-wpforms-order-card[data-helpmate-form-id="' + String(formId) + '"]').remove();
	}

	function appendLabelValue(parent, labelText, valueText) {
		var p = el('p', null, { margin: '0 0 0.35em 0', fontSize: '0.875rem' });
		var lab = el('span', null, { color: '#64748b' });
		lab.appendChild(textNode(labelText + ': '));
		var val = el('span', null, { color: '#334155' });
		val.appendChild(textNode(valueText));
		p.appendChild(lab);
		p.appendChild(val);
		parent.appendChild(p);
	}

	function parsePayloadFromNode($node) {
		if (!$node || !$node.length) return null;
		var raw = $node.attr('data-helpmate-order-status');
		if (!raw) return null;
		try {
			var parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? parsed : null;
		} catch (e) {
			return null;
		}
	}

	function renderCard($target, order, formId) {
		if (!order || typeof order !== 'object') return;

		var L = (window.helpmateWpformsOrderStatus && window.helpmateWpformsOrderStatus.labels) || {};
		removeExistingByFormId(formId);

		var card = el('div', 'helpmate-wpforms-order-card helpmate-cf7-order-status', {
			marginTop: '12px',
			border: '1px solid #e2e8f0',
			borderRadius: '8px',
			overflow: 'hidden',
			background: '#fff',
		});
		card.setAttribute('role', 'status');
		card.setAttribute('aria-live', 'polite');
		if (formId) {
			card.setAttribute('data-helpmate-form-id', String(formId));
		}

		var head = el('div', null, {
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			padding: '12px',
			borderBottom: '1px solid #e2e8f0',
			background: '#f8fafc',
		});

		var title = el('div', null, { fontWeight: '600' });
		title.appendChild(textNode((L.order || 'Order') + ' ' + String(order.orderId || '')));
		head.appendChild(title);

		var badge = el('span', null, {
			fontSize: '0.75rem',
			padding: '2px 8px',
			borderRadius: '999px',
			fontWeight: '600',
		});
		Object.assign(badge.style, BADGE_STYLES[statusKey(order.status)] || BADGE_STYLES.default);
		badge.appendChild(textNode(String(order.status || '')));
		head.appendChild(badge);
		card.appendChild(head);

		var body = el('div', null, { padding: '12px', background: '#f1f5f9' });
		if (order.date) {
			appendLabelValue(body, L.orderDate || 'Order date', String(order.date));
		}
		if (order.trackingNumber) {
			appendLabelValue(body, L.tracking || 'Tracking', String(order.trackingNumber));
		}
		if (order.estimatedDelivery) {
			appendLabelValue(body, L.estimatedDelivery || 'Estimated delivery', String(order.estimatedDelivery));
		}

		if (order.items && order.items.length) {
			var itemsTitle = el('p', null, { margin: '8px 0 4px 0', fontSize: '0.75rem', color: '#64748b' });
			itemsTitle.appendChild(textNode(L.items || 'Items'));
			body.appendChild(itemsTitle);
			var ul = el('ul', null, { margin: '0', paddingLeft: '1.25em', fontSize: '0.875rem' });
			order.items.forEach(function (item) {
				var li = el('li', null, { marginBottom: '4px' });
				li.appendChild(textNode(String(item.quantity || 0) + 'x ' + String(item.name || '') + ' - ' + String(item.price || '')));
				ul.appendChild(li);
			});
			body.appendChild(ul);
		}

		if (order.shippingAddress) {
			var shipTitle = el('p', null, { margin: '10px 0 4px 0', fontSize: '0.75rem', color: '#64748b' });
			shipTitle.appendChild(textNode(L.shippingAddress || 'Shipping address'));
			body.appendChild(shipTitle);
			var shipP = el('p', null, { margin: '0', fontSize: '0.875rem', color: '#334155', whiteSpace: 'pre-line' });
			shipP.appendChild(textNode(String(order.shippingAddress)));
			body.appendChild(shipP);
		}

		card.appendChild(body);

		$target.append(card);
	}

	function renderFromForm($form) {
		var $payloadNode = $form.find('.helpmate-wpforms-order-status-payload').first();
		if ($payloadNode.attr('data-helpmate-rendered') === '1') return;
		var payload = parsePayloadFromNode($payloadNode);
		if (!payload) return;
		var formId = parseInt($payloadNode.attr('data-helpmate-order-status-form-id') || '', 10) || null;
		var $target = $form.find('.wpforms-confirmation-container-full, .wpforms-confirmation-container').first();
		if (!$target.length) {
			$target = $payloadNode.parent();
		}
		$payloadNode.attr('data-helpmate-rendered', '1');
		renderCard($target, payload, formId);
	}

	function renderFromGlobalPayloadNodes() {
		$('.helpmate-wpforms-order-status-payload').each(function () {
			var $node = $(this);
			if ($node.attr('data-helpmate-rendered') === '1') return;
			var payload = parsePayloadFromNode($node);
			if (!payload) return;
			var formId = parseInt($node.attr('data-helpmate-order-status-form-id') || '', 10) || null;
			var $target = $node.closest('.wpforms-confirmation-container-full, .wpforms-confirmation-container');
			if (!$target.length) {
				var $form = $node.closest('form.wpforms-form');
				if ($form.length) {
					$target = $form;
				} else if (formId) {
					$target = $('#wpforms-form-' + String(formId)).parent();
				}
			}
			if (!$target.length) return;
			$node.attr('data-helpmate-rendered', '1');
			renderCard($target, payload, formId);
		});
	}

	$(document).ready(function () {
		$('.wpforms-form').each(function () {
			renderFromForm($(this));
		});
		renderFromGlobalPayloadNodes();
	});

	$(document).on('wpformsAjaxSubmitSuccess', function (e, formData) {
		if (!formData || !formData.formId) return;
		var $form = $('#wpforms-form-' + String(formData.formId));
		if (!$form.length) return;
		window.setTimeout(function () {
			renderFromForm($form);
			renderFromGlobalPayloadNodes();
		}, 50);
	});
})(jQuery);

