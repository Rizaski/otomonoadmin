// Routing System
class Router {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        const initRouter = () => {
            // Handle hash changes
            window.addEventListener('hashchange', () => this.handleRoute());

            // Handle initial load
            this.handleRoute();

            // Handle navigation clicks
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.getAttribute('data-page');
                    this.navigate(page);
                });
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initRouter);
        } else {
            // DOM is already ready
            setTimeout(initRouter, 0);
        }
    }

    handleRoute() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        this.navigate(hash);
    }

    navigate(page) {
        // Hide all pages and pause iframes if not Design Studio
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');

            // Pause all iframes when switching away from Design Studio
            if (page !== 'design-studio' && p.id === 'design-studio') {
                const iframe = p.querySelector('#designStudioFrame');
                if (iframe) {
                    // Remove src to stop loading
                    iframe.setAttribute('data-src', iframe.src);
                    iframe.removeAttribute('src');
                }
            }
        });

        // Show target page
        const targetPage = document.getElementById(page);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = page;

            // Restore iframe src if navigating to Design Studio
            if (page === 'design-studio') {
                const iframe = targetPage.querySelector('#designStudioFrame');
                if (iframe && iframe.getAttribute('data-src')) {
                    iframe.src = iframe.getAttribute('data-src');
                    iframe.removeAttribute('data-src');
                } else if (iframe && !iframe.src) {
                    iframe.src = 'https://otomonodesignner.vercel.app/';
                }
            }

            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-page') === page) {
                    item.classList.add('active');
                }
            });

            // Update header with current page name
            this.updatePageName(page);

            // Update URL
            window.history.pushState(null, null, `#${page}`);

            // Trigger page load event
            window.dispatchEvent(new CustomEvent('pagechange', {
                detail: {
                    page
                }
            }));

            // Call app's onPageChange if app is initialized
            if (window.app && window.app.onPageChange) {
                window.app.onPageChange(page);
            }
        }
    }

    updatePageName(page) {
        // Map page IDs to display names
        const pageNames = {
            'dashboard': 'Dashboard',
            'orders': 'Orders',
            'customers': 'Customers',
            'materials': 'Materials',
            'design-studio': 'Design Studio',
            'analytics': 'Analytics',
            'reports': 'Reports',
            'settings': 'Settings'
        };

        const displayName = pageNames[page] || 'Dashboard';

        // Try to update immediately
        const pageNameElement = document.getElementById('currentPageName');
        if (pageNameElement) {
            pageNameElement.textContent = displayName;
            console.log('Page name updated to:', displayName);
        } else {
            // Element not found, try again after a short delay
            setTimeout(() => {
                const element = document.getElementById('currentPageName');
                if (element) {
                    element.textContent = displayName;
                    console.log('Page name updated to:', displayName, '(delayed)');
                } else {
                    console.warn('currentPageName element not found after delay');
                }
            }, 50);
        }
    }
}

// Initialize router when DOM is ready
(function() {
    const init = () => {
        try {
            const router = new Router();
            window.router = router;
            console.log('Router initialized successfully');

            // Listen for page changes to update header
            window.addEventListener('pagechange', (e) => {
                const page = (e.detail && e.detail.page) ? e.detail.page : 'dashboard';
                router.updatePageName(page);
            });

            // Update page name after a brief delay to ensure DOM is ready
            setTimeout(() => {
                const hash = window.location.hash.substring(1) || 'dashboard';
                router.updatePageName(hash);
            }, 100);
        } catch (error) {
            console.error('Error initializing router:', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already ready
        setTimeout(init, 0);
    }
})();