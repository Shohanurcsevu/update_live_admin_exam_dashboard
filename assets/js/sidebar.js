/**
 * This function must be called AFTER the sidebar component has been loaded into the DOM.
 */
function initSidebarToggle() {
    console.log("initSidebarToggle called");
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const collapseToggle = document.getElementById('sidebar-collapse-toggle');
    const overlay = document.getElementById('sidebar-overlay');

    if (!sidebar) {
        console.error("Sidebar element (#sidebar) not found!");
        return;
    }

    // Function to toggle mobile sidebar
    const toggleMobileSidebar = (forceClose = false) => {
        if (window.innerWidth >= 768) return;

        const isCurrentlyOpen = sidebar.classList.contains('mobile-open');
        const shouldOpen = forceClose ? false : !isCurrentlyOpen;

        if (shouldOpen) {
            console.log("Opening mobile sidebar");
            sidebar.classList.add('mobile-open');
            if (overlay) {
                overlay.classList.remove('hidden');
                setTimeout(() => {
                    overlay.classList.remove('opacity-0');
                    overlay.classList.add('opacity-100');
                }, 10);
            }
        } else {
            console.log("Closing mobile sidebar");
            sidebar.classList.remove('mobile-open');
            if (overlay) {
                overlay.classList.remove('opacity-100');
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.classList.add('hidden'), 300);
            }
        }
    };

    // --- Mobile Toggle Logic ---
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileSidebar();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => toggleMobileSidebar(true));
    }

    // Auto-close sidebar on mobile after clicking a link
    sidebar.addEventListener('click', (e) => {
        if (window.innerWidth >= 768) return;
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            console.log("Nav link clicked on mobile - auto-closing");
            toggleMobileSidebar(true);
        }
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (event) => {
        if (window.innerWidth >= 768) return;
        const isClickInsideSidebar = sidebar.contains(event.target);
        const isClickOnToggle = sidebarToggle && sidebarToggle.contains(event.target);

        if (!sidebar.classList.contains('-translate-x-full') && !isClickInsideSidebar && !isClickOnToggle) {
            toggleMobileSidebar(true);
        }
    });

    // --- Desktop Collapse Logic ---
    if (collapseToggle) {
        const sidebarContainer = document.getElementById('sidebar-container');

        // Restore state from localStorage
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            if (sidebarContainer) sidebarContainer.classList.add('collapsed');
            updateCollapseIcon(true);
        }

        collapseToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowCollapsed = sidebar.classList.toggle('collapsed');
            if (sidebarContainer) sidebarContainer.classList.toggle('collapsed');

            localStorage.setItem('sidebarCollapsed', nowCollapsed);
            updateCollapseIcon(nowCollapsed);
        });
    }

    function updateCollapseIcon(collapsed) {
        if (!collapseToggle) return;
        const iconSpan = collapseToggle.querySelector('.material-symbols-outlined');
        if (iconSpan) {
            iconSpan.textContent = collapsed ? 'rocket_launch' : 'menu';
        }
    }

    // --- Submenu Toggle Logic ---
    const submenuToggles = sidebar.querySelectorAll('.submenu-toggle');
    submenuToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const parent = toggle.closest('.has-submenu');
            if (!parent) return;

            // If sidebar is collapsed, expand it first
            if (sidebar.classList.contains('collapsed')) {
                const sidebarContainer = document.getElementById('sidebar-container');
                sidebar.classList.remove('collapsed');
                if (sidebarContainer) sidebarContainer.classList.remove('collapsed');
                localStorage.setItem('sidebarCollapsed', 'false');
                updateCollapseIcon(false);
            }

            const isOpen = parent.classList.contains('open');
            parent.classList.toggle('open');

            // --- Highlight Logic ---
            // Clear all highlights from all nav-links
            sidebar.querySelectorAll('.nav-link').forEach(link => link.classList.remove('bg-gray-700'));
            // Add highlight to the clicked group toggle
            toggle.classList.add('bg-gray-700');

            const submenu = parent.querySelector('.submenu');
            if (submenu) {
                if (parent.classList.contains('open')) {
                    submenu.classList.remove('hidden');
                } else {
                    // CSS handles the smooth slide out via max-height
                    setTimeout(() => {
                        if (!parent.classList.contains('open')) {
                            submenu.classList.add('hidden');
                        }
                    }, 300); // Match transition duration
                }
            }
        });
    });
}