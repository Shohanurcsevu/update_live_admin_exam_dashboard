/**
 * This function must be called AFTER the header has been loaded into the DOM,
 * because it needs to attach an event listener to the #sidebar-toggle button.
 */
function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        // Optional: Close sidebar when clicking outside of it on mobile
        document.addEventListener('click', (event) => {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggle = sidebarToggle.contains(event.target);

            if (!sidebar.classList.contains('-translate-x-full') && !isClickInsideSidebar && !isClickOnToggle) {
                 sidebar.classList.add('-translate-x-full');
            }
        });
    } else {
        console.log("Sidebar or toggle button not found yet. Waiting for components to load.");
    }
}