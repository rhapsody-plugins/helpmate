/**
 * Toggle Helpmate CF7 field-map sections when the action select changes.
 */
(function () {
  'use strict';

  function sync() {
    var panel = document.getElementById('helpmate-panel');
    if (!panel) {
      return;
    }
    var select = panel.querySelector('#helpmate_cf7_action');
    var v = select && select.value ? select.value : '';
    var blocks = panel.querySelectorAll('[data-helpmate-action-block]');
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      var id = el.getAttribute('data-helpmate-action-block') || '';
      el.style.display = id === v && v !== '' ? '' : 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.getElementById('helpmate-panel');
    if (!panel) {
      return;
    }
    var select = panel.querySelector('#helpmate_cf7_action');
    if (select) {
      select.addEventListener('change', sync);
    }
    sync();
  });
})();
