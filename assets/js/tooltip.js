/**
 * Modular Tooltip System
 * Handles dynamic content, colorful themes, and smart positioning.
 */
const TooltipSystem = {
    tooltipEl: null,
    activeTrigger: null,

    init() {
        if (this.tooltipEl) return;
        
        // Create tooltip element
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.className = 'tooltip-container';
        this.tooltipEl.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-accent" id="tooltip-accent"></div>
                <div class="tooltip-title" id="tooltip-title"></div>
            </div>
            <div class="tooltip-desc" id="tooltip-desc"></div>
        `;
        document.body.appendChild(this.tooltipEl);

        // Bind events
        document.addEventListener('mouseover', (e) => this.handleTrigger(e));
        document.addEventListener('touchstart', (e) => this.handleTrigger(e), { passive: true });
        document.addEventListener('mouseout', (e) => this.hideTooltip(e));
        
        // Hide on scroll or resize
        window.addEventListener('scroll', () => this.hideTooltip(), { passive: true });
        window.addEventListener('resize', () => this.hideTooltip());
    },

    handleTrigger(e) {
        const trigger = e.target.closest('.tooltip-trigger');
        if (!trigger) return;

        this.activeTrigger = trigger;
        this.showTooltip(trigger);
    },

    showTooltip(trigger) {
        const title = trigger.getAttribute('data-tooltip-title') || 'Info';
        const desc = trigger.getAttribute('data-tooltip-desc') || '';
        const color = trigger.getAttribute('data-tooltip-color') || '#1e293b';

        // Set content
        document.getElementById('tooltip-title').textContent = title;
        document.getElementById('tooltip-desc').textContent = desc;
        this.tooltipEl.style.setProperty('--tooltip-color', color);

        // Position
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = this.tooltipEl.getBoundingClientRect();
        
        // Default position: top-center relative to trigger
        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Boundary safety: Screen top
        if (top < 10) {
            top = rect.bottom + 10; // Flip below
        }

        // Boundary safety: Left edge
        if (left < 10) {
            left = 10;
        }

        // Boundary safety: Right edge
        const screenWidth = window.innerWidth;
        if (left + tooltipRect.width > screenWidth - 10) {
            left = screenWidth - tooltipRect.width - 10;
        }

        this.tooltipEl.style.top = `${top}px`;
        this.tooltipEl.style.left = `${left}px`;
        this.tooltipEl.classList.add('visible');
    },

    hideTooltip(e) {
        if (e && e.relatedTarget && e.relatedTarget.closest('.tooltip-trigger')) return;
        this.tooltipEl.classList.remove('visible');
        this.activeTrigger = null;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TooltipSystem.init());
} else {
    TooltipSystem.init();
}
