/**
 * CompressX — Page Transition Engine
 * Smooth fade-out before navigating to any internal page.
 */
(function () {
    // Inject the overlay div once
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.id = '__page-transition-overlay';
    document.body.appendChild(overlay);

    // Intercept internal navigation links
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[href]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        // Skip: external links, hash-only links, mailto/tel, JS links
        if (
            href.startsWith('http') ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:') ||
            anchor.target === '_blank'
        ) return;

        e.preventDefault();

        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = href;
        }, 160);
    });

    // Also intercept programmatic JS navigations via a helper
    window.__navigateTo = function (href) {
        if (!href) return;
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = href;
        }, 160);
    };
})();
