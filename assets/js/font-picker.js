const FontPicker = {

    // ── Configuration ──────────────────────────────────────────
    STORAGE_KEY: 'app-font',
    USER_NAME_KEY: 'user_name',
    DEFAULT_FONT: 'Space Grotesk',
    DEFAULT_NAME: 'User Name',

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
    _currentName: '',

    // ── Public API ─────────────────────────────────────────────

    async init() {
        // 1. Load all font families via a single Google Fonts stylesheet
        this._injectFontStylesheet();

        // 2. Restore the user's saved font (Preference: DB > LocalStorage > Default)
        await this._loadSavedFont();

        // 3. Restore User Name
        await this._loadSavedName();

        // 4. Build dropdown UI once the profile image is in the DOM
        this._buildDropdown();

        // 5. Bind events
        this._bindEvents();

        console.log(`[FontPicker] Initialized with font: "${this._currentFont}" and name: "${this._currentName}"`);
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
            console.warn("[FontPicker] Failed to fetch font from DB, using fallback.");
        }

        // Fallback
        const font = cached || this.DEFAULT_FONT;
        this._applyFont(font, false);
    },

    /**
     * Load User Name from Database
     */
    async _loadSavedName() {
        const cached = localStorage.getItem(this.USER_NAME_KEY);
        
        try {
            const response = await fetch(`api/profile/settings.php?key=user_name`);
            const result = await response.json();
            
            if (result.success && result.data.user_name) {
                this._currentName = result.data.user_name;
                localStorage.setItem(this.USER_NAME_KEY, this._currentName);
                return;
            }
        } catch (error) {
            console.warn("[FontPicker] Failed to fetch name from DB.");
        }

        this._currentName = cached || this.DEFAULT_NAME;
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
            .map(f => `family=${f.family.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900`)
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
            this._saveToDatabase('app_font', fontFamily);
        }
        this._currentFont = fontFamily;
    },

    /**
     * Save any setting to MySQL database
     */
    async _saveToDatabase(key, value) {
        try {
            await fetch('api/profile/settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
        } catch (error) {
            console.error(`FontPicker: Database sync failed for ${key}`, error);
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
            <!-- User Header Section -->
            <div class="fp-section">
                <div class="fp-header-editable" id="fp-name-container">
                    <span class="fp-user-name" id="fp-display-name">${this._currentName}</span>
                    <input type="text" id="fp-name-input" class="fp-name-input" value="${this._currentName}" maxlength="20" style="display:none">
                    <button class="fp-edit-btn" id="fp-edit-name-btn" title="Edit Name">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="fp-save-btn" id="fp-save-name-btn" title="Save Name" style="display:none">
                        <span class="material-symbols-outlined">check</span>
                    </button>
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
        document.addEventListener('click', (e) => {
            const profileImg = document.getElementById('header-profile-img');
            const profileBtn = profileImg?.closest('.relative');
            const dropdown = this._dropdown;
            if (!profileImg || !dropdown) return;

            // 1. Toggle dropdown when profile image is clicked
            if (profileBtn && (profileBtn.contains(e.target)) && !dropdown.contains(e.target)) {
                e.stopPropagation();
                this._toggle();
                return;
            }

            // 2. Click on "Change Profile Picture"
            const changePhotoBtn = e.target.closest('#fp-change-photo');
            if (changePhotoBtn && dropdown.contains(changePhotoBtn)) {
                const fileInput = document.getElementById('avatar-upload-input');
                if (fileInput) fileInput.click();
                this._close();
                return;
            }

            // 3. Click on a font option
            const option = e.target.closest('.fp-option');
            if (option && dropdown.contains(option)) {
                const font = option.dataset.font;
                this._applyFont(font);
                this._updateActiveState();
                this._close();
                return;
            }

            // 4. Click on Edit Name
            const editBtn = e.target.closest('#fp-edit-name-btn');
            if (editBtn && dropdown.contains(editBtn)) {
                e.stopPropagation();
                this._enterEditMode();
                return;
            }

            // 5. Click on Save Name
            const saveBtn = e.target.closest('#fp-save-name-btn');
            if (saveBtn && dropdown.contains(saveBtn)) {
                e.stopPropagation();
                this._saveNewName();
                return;
            }

            // 6. Click outside → close (only if not editing)
            if (!dropdown.contains(e.target)) {
                const input = document.getElementById('fp-name-input');
                if (input && input.style.display === 'none') {
                    this._close();
                }
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const input = document.getElementById('fp-name-input');
                if (input && input.style.display !== 'none') {
                    this._cancelEdit();
                } else if (this.isOpen) {
                    this._close();
                }
            }
            if (e.key === 'Enter') {
                const input = document.getElementById('fp-name-input');
                if (input && input.style.display !== 'none' && document.activeElement === input) {
                    this._saveNewName();
                }
            }
        });
    },

    _enterEditMode() {
        const display = document.getElementById('fp-display-name');
        const input = document.getElementById('fp-name-input');
        const editBtn = document.getElementById('fp-edit-name-btn');
        const saveBtn = document.getElementById('fp-save-name-btn');

        if (!display || !input || !editBtn || !saveBtn) return;

        display.style.display = 'none';
        editBtn.style.display = 'none';
        input.style.display = 'block';
        saveBtn.style.display = 'flex';
        input.focus();
        input.select();
    },

    _cancelEdit() {
        const display = document.getElementById('fp-display-name');
        const input = document.getElementById('fp-name-input');
        const editBtn = document.getElementById('fp-edit-name-btn');
        const saveBtn = document.getElementById('fp-save-name-btn');

        if (!display || !input || !editBtn || !saveBtn) return;

        display.style.display = 'block';
        editBtn.style.display = 'flex';
        input.style.display = 'none';
        saveBtn.style.display = 'none';
        input.value = this._currentName;
    },

    async _saveNewName() {
        const input = document.getElementById('fp-name-input');
        if (!input) return;

        const newName = input.value.trim() || this.DEFAULT_NAME;
        
        // Update Local State
        this._currentName = newName;
        localStorage.setItem(this.USER_NAME_KEY, newName);

        // Update UI
        const display = document.getElementById('fp-display-name');
        if (display) display.textContent = newName;

        this._cancelEdit();

        // Save to DB
        await this._saveToDatabase('user_name', newName);
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
