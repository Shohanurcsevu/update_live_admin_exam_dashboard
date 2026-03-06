/**
 * FontPicker — Global Font Switcher Module
 * 
 * Provides a premium dropdown on the profile avatar to switch
 * the app's typeface. Selection persists via localStorage.
 * 
 * Uses CSS variable `--app-font` on <html> so every element
 * inherits the chosen font automatically.
 */
const FontPicker = {

    // ── Configuration ──────────────────────────────────────────
    STORAGE_KEY: 'app-font',
    DEFAULT_FONT: 'Space Grotesk',

    /** Available fonts — label, family (Google Fonts), and a preview weight */
    fonts: [
        { label: 'Space Grotesk', family: 'Space Grotesk', icon: '🚀', tag: 'Techy' },
        { label: 'Inter', family: 'Inter', icon: '🔵', tag: 'Classic' },
        { label: 'Poppins', family: 'Poppins', icon: '🟣', tag: 'Friendly' },
        { label: 'DM Sans', family: 'DM Sans', icon: '⚫', tag: 'Minimal' },
        { label: 'Outfit', family: 'Outfit', icon: '🟢', tag: 'Modern' },
        { label: 'Nunito', family: 'Nunito', icon: '🟠', tag: 'Rounded' },
        { label: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans', icon: '💎', tag: 'Premium' },
    ],

    isOpen: false,

    // ── Public API ─────────────────────────────────────────────

    async init() {
        // 1. Load all font families via a single Google Fonts stylesheet
        this._injectFontStylesheet();

        // 2. Restore the user's saved font (Preference: DB > LocalStorage > Default)
        await this._loadSavedFont();

        // 3. Build dropdown UI once the profile image is in the DOM
        this._buildDropdown();

        // 4. Bind events
        this._bindEvents();

        console.log(`[FontPicker] Initialized with font: "${this._currentFont}"`);
    },

    /**
     * Load font from Database (with LocalStorage fallback)
     */
    async _loadSavedFont() {
        const cached = localStorage.getItem(this.STORAGE_KEY);
        
        try {
            const response = await fetch(`api/profile/settings.php?key=app_font`);
            const result = await response.json();
            
            if (result.success && result.data.app_font) {
                const dbFont = result.data.app_font;
                this._applyFont(dbFont, false); // Don't re-save to DB
                localStorage.setItem(this.STORAGE_KEY, dbFont);
                return;
            }
        } catch (error) {
            console.warn("[FontPicker] Failed to fetch from DB, using fallback.");
        }

        // Fallback
        const font = cached || this.DEFAULT_FONT;
        this._applyFont(font, false);
    },

    // ── Private Methods ────────────────────────────────────────

    /**
     * Inject a <link> for Google Fonts containing ALL available families.
     * This replaces the need for pre-loading in index.html.
     */
    _injectFontStylesheet() {
        // Don't inject if already present
        if (document.getElementById('font-picker-gfonts')) return;

        const families = this.fonts
            .map(f => `family=${f.family.replace(/ /g, '+')}:wght@300;400;500;600;700`)
            .join('&');

        const link = document.createElement('link');
        link.id = 'font-picker-gfonts';
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
        document.head.appendChild(link);
    },

    /**
     * Apply a font globally via CSS variable on <html>.
     */
    _applyFont(fontFamily, saveToDB = true) {
        // 1. Set CSS variable
        document.documentElement.style.setProperty('--app-font', `'${fontFamily}'`);

        // 2. Persist to LocalStorage (Fast fallback)
        localStorage.setItem(this.STORAGE_KEY, fontFamily);

        // 3. Persist to Database (MySQL Sync)
        if (saveToDB) {
            this._saveToDatabase(fontFamily);
        }
        this._currentFont = fontFamily;
    },

    /**
     * Save font selection to MySQL database
     */
    async _saveToDatabase(fontFamily) {
        try {
            await fetch('api/profile/settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'app_font',
                    value: fontFamily
                })
            });
        } catch (error) {
            console.error("FontPicker: Database sync failed", error);
        }
    },

    /**
     * Build the dropdown HTML and inject it next to the profile image.
     */
    _buildDropdown() {
        const profileWrapper = document.querySelector('#header-profile-img')?.closest('.relative');
        if (!profileWrapper) {
            console.warn('[FontPicker] Profile wrapper not found — retrying in 500ms');
            setTimeout(() => this._buildDropdown(), 500);
            return;
        }

        // Give the wrapper an ID for easier reference
        profileWrapper.id = 'font-picker-anchor';

        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.id = 'font-picker-dropdown';
        dropdown.className = 'font-picker-dropdown';
        dropdown.setAttribute('role', 'menu');
        dropdown.innerHTML = `
            <!-- Personalization Section -->
            <div class="fp-section">
                <div class="fp-header">
                    <span class="material-symbols-outlined fp-header-icon">person</span>
                    <span class="fp-header-text">Personalization</span>
                </div>
                <button class="fp-action-item" id="fp-change-photo" role="menuitem">
                    <span class="material-symbols-outlined">photo_camera</span>
                    <span>Change Profile Picture</span>
                </button>
            </div>

            <div class="fp-divider"></div>

            <!-- Typography Section -->
            <div class="fp-section">
                <div class="fp-header">
                    <span class="material-symbols-outlined fp-header-icon">font_download</span>
                    <span class="fp-header-text">Typography</span>
                </div>
                <div class="fp-list" role="group">
                    ${this.fonts.map(f => `
                        <button class="fp-option" data-font="${f.family}" role="menuitemradio">
                            <span class="fp-option-preview" style="font-family:'${f.family}',sans-serif">${f.label}</span>
                            <span class="fp-option-tag">${f.tag}</span>
                            <span class="fp-check material-symbols-outlined">check_circle</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        profileWrapper.appendChild(dropdown);
        this._dropdown = dropdown;

        // Highlight saved font
        this._updateActiveState();
    },

    /**
     * Bind click events for toggle and outside-click dismiss.
     */
    _bindEvents() {
        // Toggle dropdown when profile image is clicked
        document.addEventListener('click', (e) => {
            const profileImg = document.getElementById('header-profile-img');
            const profileBtn = profileImg?.closest('.relative');
            const dropdown = this._dropdown;
            if (!profileImg || !dropdown) return;

            // Click on profile image → toggle
            if (profileBtn && (profileBtn.contains(e.target)) && !dropdown.contains(e.target)) {
                e.stopPropagation();
                this._toggle();
                return;
            }

            // Click on "Change Profile Picture"
            const changePhotoBtn = e.target.closest('#fp-change-photo');
            if (changePhotoBtn && dropdown.contains(changePhotoBtn)) {
                const fileInput = document.getElementById('avatar-upload-input');
                if (fileInput) fileInput.click();
                this._close();
                return;
            }

            // Click on a font option
            const option = e.target.closest('.fp-option');
            if (option && dropdown.contains(option)) {
                const font = option.dataset.font;
                this._applyFont(font);
                this._updateActiveState();
                this._close();
                return;
            }

            // Click outside → close
            if (!dropdown.contains(e.target)) {
                this._close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this._close();
        });
    },

    _toggle() {
        this.isOpen ? this._close() : this._open();
    },

    _open() {
        if (!this._dropdown) return;
        this.isOpen = true;
        this._dropdown.classList.add('fp-open');
    },

    _close() {
        if (!this._dropdown) return;
        this.isOpen = false;
        this._dropdown.classList.remove('fp-open');
    },

    /**
     * Highlight the currently active font in the dropdown.
     */
    _updateActiveState() {
        if (!this._dropdown) return;
        this._dropdown.querySelectorAll('.fp-option').forEach(btn => {
            const isActive = btn.dataset.font === this._currentFont;
            btn.classList.toggle('fp-active', isActive);
        });
    }
};

// Expose globally so SmartHeader or main.js can call FontPicker.init()
window.FontPicker = FontPicker;
