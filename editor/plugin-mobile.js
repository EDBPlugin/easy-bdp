(function () {
    /**
     * EDBP Plugin Mobile Support
     * Handles drill-down navigation and mobile UI for the plugin marketplace.
     */
    document.addEventListener('DOMContentLoaded', () => {
        const pluginModal = document.getElementById('pluginModal');
        const pluginList = document.getElementById('pluginList');
        const backBtn = document.getElementById('pluginMobileBackBtn');
        const isMobile = () => document.documentElement.classList.contains('is-mobile');

        if (!pluginModal || !pluginList || !backBtn) return;

        // Handle drill-down: When a plugin item is clicked, show detail view
        pluginList.addEventListener('click', (e) => {
            if (!isMobile()) return;

            // Detect plugin item click via event delegation
            const item = e.target.closest('[class*="rounded-lg cursor-pointer"]');
            if (item) {
                pluginModal.classList.add('detail-open');
                const detail = document.getElementById('pluginDetail');
                if (detail) detail.scrollTop = 0;
            }
        });

        // Handle back button: Return to plugin list
        backBtn.addEventListener('click', () => {
            pluginModal.classList.remove('detail-open');
        });

        // Reset view state when modal is closed
        const handleClose = () => {
            pluginModal.classList.remove('detail-open');
        };

        document.getElementById('pluginModalClose')?.addEventListener('click', handleClose);

        // Watch for modal being hidden (via backdrop click or other logic)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (pluginModal.classList.contains('hidden')) {
                        // 既に詳細が閉じられている場合は何もしない（無限ループ防止）
                        if (pluginModal.classList.contains('detail-open')) {
                            handleClose();
                        }
                    }
                }
            });
        });
        observer.observe(pluginModal, { attributes: true });

        // Patch for the "Installed only" toggle bug
        // The current UI uses a button but PluginUI expects a checkbox
        const filterContainer = pluginModal.querySelector('.mt-3.flex.items-center.justify-between');
        if (filterContainer) {
            const toggleBtn = filterContainer.querySelector('button');
            if (toggleBtn && !toggleBtn.querySelector('input')) {
                // Create a hidden checkbox to satisfy PluginUI's listener
                const hiddenCheckbox = document.createElement('input');
                hiddenCheckbox.type = 'checkbox';
                hiddenCheckbox.style.display = 'none';
                toggleBtn.appendChild(hiddenCheckbox);

                toggleBtn.addEventListener('click', () => {
                    hiddenCheckbox.checked = !hiddenCheckbox.checked;
                    // Trigger the 'change' event that PluginUI listens for
                    hiddenCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

                    // Update visual state of the custom toggle button
                    const knob = toggleBtn.querySelector('div');
                    if (hiddenCheckbox.checked) {
                        toggleBtn.classList.replace('bg-slate-200', 'bg-indigo-600');
                        toggleBtn.classList.replace('dark:bg-slate-700', 'dark:bg-indigo-500');
                        knob.style.left = 'calc(100% - 0.75rem - 0.125rem)';
                    } else {
                        toggleBtn.classList.replace('bg-indigo-600', 'bg-slate-200');
                        toggleBtn.classList.replace('dark:bg-indigo-500', 'dark:bg-slate-700');
                        knob.style.left = '0.125rem';
                    }
                });
            }
        }
    });
})();
