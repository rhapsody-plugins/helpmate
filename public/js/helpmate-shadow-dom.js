// HelpMate Shadow DOM Setup
(function () {
    // Prevent multiple initializations
    if (window.helpmateShadowRoot) {
      console.log('HelpMate: Shadow DOM already initialized');
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initShadowDOM);
    } else {
      initShadowDOM();
    }

    function initShadowDOM() {
      const container = document.getElementById('helpmate-root');
      if (!container) return;

      const shadowRoot = container.attachShadow({ mode: 'open' });

      // Create a div inside shadow DOM to mount React
      const reactRoot = document.createElement('div');
      reactRoot.id = 'root';
      shadowRoot.appendChild(reactRoot);

      if (window.helpmateConfig && window.helpmateConfig.isDev) {
        loadDevStyles(shadowRoot);
      } else {
        loadProductionStyles(shadowRoot);
      }

      // Make shadow root available globally for React app
      window.helpmateShadowRoot = shadowRoot;
      window.helpmateReactRoot = reactRoot;

      // Dispatch custom event to signal shadow DOM is ready
      window.dispatchEvent(new CustomEvent('helpmate-shadow-ready'));
    }

    function loadDevStyles(shadowRoot) {
      // Try to find Vite styles
      const viteClientStyle = document.querySelector(
        '[data-vite-dev-id]:not([href*="helpmate-pro"])'
      );
      if (viteClientStyle && viteClientStyle.textContent) {
        const css = viteClientStyle.textContent;
        const style = document.createElement('style');
        style.textContent = css;
        shadowRoot.appendChild(style);
      }

      // Load Sonner styles
      document.head.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent?.includes('[data-sonner-toaster]')) {
          shadowRoot.append(styleEl.cloneNode(true));
        }
      });

      // If Vite styles aren't ready yet, retry after a short delay
      if (!viteClientStyle || !viteClientStyle.textContent) {
        setTimeout(() => loadDevStyles(shadowRoot), 100);
      }

      // Listen for Vite style updates
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.tagName === 'STYLE' &&
                node.getAttribute('data-vite-dev-id') &&
                !node.getAttribute('data-vite-dev-id').includes('helpmate-pro')
              ) {
                const style = document.createElement('style');
                style.textContent = node.textContent;
                shadowRoot.appendChild(style);
              }
            });
          }
        });
      });

      observer.observe(document.head, { childList: true, subtree: true });
    }

    function loadProductionStyles(shadowRoot) {
      const wpCss = document.querySelector(
        'link[href*="helpmate/public/app/dist/assets/index-"][href*=".css"]'
      );
      if (wpCss) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = wpCss.href;
        shadowRoot.appendChild(cssLink);
      }
    }
  })();