/**
 * CompressX — Page Transition Engine
 * Smooth fade-out before navigating to any internal page.
 */
(function () {
    let overlay = null;

    function getOverlay() {
        if (!overlay) {
            overlay = document.getElementById('__page-transition-overlay');
            if (!overlay && document.body) {
                overlay = document.createElement('div');
                overlay.className = 'page-transition-overlay';
                overlay.id = '__page-transition-overlay';
                document.body.appendChild(overlay);
            }
        }
        return overlay;
    }

    document.addEventListener('DOMContentLoaded', () => {
        getOverlay();
    });

    // Intercept internal navigation links
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[href]');
        if (!anchor) return;

        // Skip: external links, hash-only links, mailto/tel, JS links, API endpoints, download links
        if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('blob:') ||
            href.startsWith('data:') ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:') ||
            href.startsWith('/api/') ||
            href.startsWith('api/') ||
            anchor.hasAttribute('download') ||
            anchor.target === '_blank'
        ) return;

        e.preventDefault();

        // Always resolve internal HTML pages to the root of the app
        const targetPath = href.startsWith('/') ? href : `/${href}`;

        const ov = getOverlay();
        if (ov) ov.classList.add('active');
        setTimeout(() => {
            window.location.href = targetPath;
        }, 160);
    });

    // Also intercept programmatic JS navigations via a helper
    window.__navigateTo = function (href) {
        if (!href) return;
        if (href.startsWith('/api/') || href.startsWith('api/')) {
            window.location.href = href;
            return;
        }
        const targetPath = href.startsWith('/') || href.startsWith('http') ? href : `/${href}`;
        const ov = getOverlay();
        if (ov) ov.classList.add('active');
        setTimeout(() => {
            window.location.href = targetPath;
        }, 160);
    };
})();
