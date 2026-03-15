const FontPicker = {

    // ── Configuration ──────────────────────────────────────────
    STORAGE_KEY: 'app-font',
    USER_NAME_KEY: 'user_name',
    ACCENT_KEY: 'app_accent',
    DEFAULT_FONT: 'Space Grotesk',
    DEFAULT_NAME: 'User Name',
    DEFAULT_ACCENT: '#6366f1',
    SOUND_KEY: 'app_sound_preference',
    DEFAULT_SOUND: 'assets/audio/r.mp3',

    /** Available sounds for the heartbeat pulse */
    sounds: [
        { id: 'pulse-1', label: 'Deep Pulse', file: 'assets/audio/r.mp3', icon: 'favorite' },
        { id: 'pulse-2', label: 'Soft Echo', file: 'assets/audio/r1.mp3', icon: 'waves' },
    ],

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

    accents: [
        { 
            name: 'Indigo', 
            color: '#6366f1',
            shades: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' }
        },
        { 
            name: 'Emerald', 
            color: '#10b981',
            shades: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' }
        },
        { 
            name: 'Rose', 
            color: '#f43f5e',
            shades: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' }
        },
        { 
            name: 'Amber', 
            color: '#f59e0b',
            shades: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' }
        },
        { 
            name: 'Violet', 
            color: '#8b5cf6',
            shades: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' }
        },
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

        // 4. Restore Accent Color
        await this._loadSavedAccent();

        // 5. Restore Sound Preference
        await this._loadSavedSound();

        // 6. Build dropdown UI once the profile image is in the DOM
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

    /**
     * Load Accent Color from Database
     */
    async _loadSavedAccent() {
        const cached = localStorage.getItem(this.ACCENT_KEY);
        
        try {
            const response = await fetch(`api/profile/settings.php?key=app_accent`);
            const result = await response.json();
            
            if (result.success && result.data.app_accent) {
                this._applyAccent(result.data.app_accent, false);
                return;
            }
        } catch (error) {
            console.warn("[FontPicker] Failed to fetch accent from DB.");
        }

        this._applyAccent(cached || this.DEFAULT_ACCENT, false);
    },

    /**
     * Load Sound Preference from Database
     */
    async _loadSavedSound() {
        const cached = localStorage.getItem(this.SOUND_KEY);
        
        try {
            const response = await fetch(`api/profile/settings.php?key=app_sound_preference`);
            const result = await response.json();
            
            if (result.success && result.data.app_sound_preference) {
                this._applySound(result.data.app_sound_preference, false);
                return;
            }
        } catch (error) {
            console.warn("[FontPicker] Failed to fetch sound from DB.");
        }

        this._applySound(cached || this.DEFAULT_SOUND, false);
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
     * Apply an accent color globally via data-theme attribute.
     */
    _applyAccent(color, saveToDB = true) {
        // Find the full accent object
        const accent = this.accents.find(a => a.color === color) || this.accents[0];
        
        // 1. Set Primary Variable (Fallback)
        document.documentElement.style.setProperty('--app-accent', color);
        
        // 2. Set Theme Attribute on Body
        document.body.setAttribute('data-theme', accent.name.toLowerCase());

        // 3. Persist
        localStorage.setItem(this.ACCENT_KEY, color);
        if (saveToDB) {
            this._saveToDatabase('app_accent', color);
        }
        this._currentAccent = color;
    },

    /**
     * Apply a sound preference globally.
     */
    _applySound(soundFile, saveToDB = true) {
        // 1. Update StudyMentor if available
        if (window.studyMentor) {
            window.studyMentor.setHeartbeatSound(soundFile);
        }

        // 2. Persist
        localStorage.setItem(this.SOUND_KEY, soundFile);
        if (saveToDB) {
            this._saveToDatabase('app_sound_preference', soundFile);
        }
        this._currentSound = soundFile;
    },

    /**
     * Save any setting to MySQL database
     */
    async _saveToDatabase(key, value) {
        try {
            const response = await fetch('api/profile/settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[FontPicker] Successfully saved ${key} to database.`);
            } else {
                console.error(`[FontPicker] Database save failed for ${key}:`, result.message);
                if (window.showToast) window.showToast(`Failed to sync ${key}`, 'error');
            }
        } catch (error) {
            console.error(`[FontPicker] Connection error during database sync for ${key}:`, error);
            if (window.showToast) window.showToast("Cloud sync failed (Connection Error)", "error");
        }
    },

    /**
     * Build the dropdown HTML and inject it next to the profile image.
     */
    _buildDropdown() {
        const profileImg = document.getElementById('header-profile-img');
        const profileWrapper = profileImg?.closest('.relative');
        if (!profileWrapper || !profileImg) {
            console.warn('[FontPicker] Profile wrapper or image not found — retrying in 500ms');
            setTimeout(() => this._buildDropdown(), 500);
            return;
        }

        // Give the wrapper an ID for easier reference
        profileWrapper.id = 'font-picker-anchor';

        // 1. Add SVG Progress Ring around the image
        if (!document.getElementById('fp-progress-ring')) {
            const svgNamespace = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNamespace, "svg");
            svg.setAttribute("id", "fp-progress-ring");
            svg.setAttribute("class", "fp-progress-ring");
            svg.setAttribute("viewBox", "0 0 36 36");

            svg.innerHTML = `
                <circle class="fp-ring-bg" cx="18" cy="18" r="16" fill="none" stroke-width="2"></circle>
                <circle class="fp-ring-indicator" id="fp-progress-indicator" cx="18" cy="18" r="16" fill="none" stroke-width="2" 
                        stroke-dasharray="100, 100" stroke-linecap="round" transform="rotate(-90 18 18)"></circle>
            `;
            profileWrapper.insertBefore(svg, profileImg);
        }

        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.id = 'font-picker-dropdown';
        dropdown.className = 'font-picker-dropdown custom-scrollbar';
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
                <!-- Mini Progress Stats inside Dropdown -->
                <div class="fp-progress-stats" id="fp-mini-stats">
                    <div class="fp-stat-item">
                        <span class="fp-stat-label">Daily Goal</span>
                        <span class="fp-stat-value" id="fp-stat-percent">0%</span>
                    </div>
                    <div class="fp-stat-item">
                        <span class="fp-stat-label">Momentum</span>
                        <span class="fp-stat-value" id="fp-momentum-status" style="font-size: 10px; opacity: 0.8;">Active Pulse</span>
                    </div>
                </div>
                <button class="fp-action-item" id="fp-change-photo" role="menuitem">
                    <span class="material-symbols-outlined">photo_camera</span>
                    <span>Change Profile Picture</span>
                </button>
            </div>

            <div class="fp-divider"></div>

            <!-- Branding Section -->
            <div class="fp-section">
                <div class="fp-header">
                    <span class="material-symbols-outlined fp-header-icon">palette</span>
                    <span class="fp-header-text">Branding</span>
                </div>
                <div class="fp-color-list" role="group">
                    ${this.accents.map(a => `
                        <button class="fp-color-swatch" data-accent="${a.color}" title="${a.name}" 
                                style="background-color:${a.color}">
                            <span class="fp-color-check material-symbols-outlined">check</span>
                        </button>
                    `).join('')}
                </div>
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

            <div class="fp-divider"></div>

            <!-- Sound Pulse Section -->
            <div class="fp-section">
                <div class="fp-header">
                    <span class="material-symbols-outlined fp-header-icon">audiotrack</span>
                    <span class="fp-header-text">Sound Pulse</span>
                </div>
                <div class="fp-list" role="group">
                    ${this.sounds.map(s => `
                        <button class="fp-option fp-sound-option" data-sound="${s.file}" role="menuitemradio">
                            <span class="material-symbols-outlined mr-2 opacity-70">${s.icon}</span>
                            <span class="fp-option-preview">${s.label}</span>
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

        // Start progress ring sync
        this._startProgressSync();
    },

    /**
     * Start syncing progress with StudyTargetTracker
     */
    _startProgressSync() {
        // Sync every 2 seconds
        setInterval(() => this.updateProgressRing(), 2000);
    },

    /**
     * Update the SVG ring and mini-stats based on StudyTargetTracker data
     */
    updateProgressRing() {
        const indicator = document.getElementById('fp-progress-indicator');
        const percentLabel = document.getElementById('fp-stat-percent');
        
        if (typeof StudyTargetTracker === 'undefined' || !StudyTargetTracker.studiedSeconds) return;

        const total = StudyTargetTracker.DAILY_TARGET_SECONDS || (12 * 3600);
        const current = StudyTargetTracker.studiedSeconds;
        const percent = Math.min(100, Math.round((current / total) * 100));

        if (indicator) {
            // SVG stroke-dasharray logic
            indicator.style.strokeDasharray = `${percent}, 100`;
        }
        if (percentLabel) {
            percentLabel.textContent = `${percent}%`;
        }

        // Sync Momentum Status
        const statusLabel = document.getElementById('fp-momentum-status');
        if (statusLabel && StudyTargetTracker.currentStatus) {
            statusLabel.textContent = StudyTargetTracker.currentStatus;
            
            // Optional: Dynamic color coding for the status text
            if (StudyTargetTracker.currentStatus === 'Signal Lost') statusLabel.style.color = '#94a3b8';
            else if (StudyTargetTracker.currentStatus.includes('Critical')) statusLabel.style.color = '#f43f5e';
            else statusLabel.style.color = 'var(--brand-600)';
        }
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
            const fontOption = e.target.closest('.fp-option:not(.fp-sound-option)');
            if (fontOption && dropdown.contains(fontOption)) {
                const font = fontOption.dataset.font;
                this._applyFont(font);
                this._updateActiveState();
                this._close();
                return;
            }

            // 4. Click on an accent color
            const swatch = e.target.closest('.fp-color-swatch');
            if (swatch && dropdown.contains(swatch)) {
                const color = swatch.dataset.accent;
                this._applyAccent(color);
                this._updateActiveState();
                return;
            }

            // 5. Click on a sound option
            const soundOption = e.target.closest('.fp-sound-option');
            if (soundOption && dropdown.contains(soundOption)) {
                const sound = soundOption.dataset.sound;
                this._applySound(sound);
                this._updateActiveState();
                return;
            }

            // 5. Click on Edit Name
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

        // Update accent color active state
        this._dropdown.querySelectorAll('.fp-color-swatch').forEach(btn => {
            const isActive = btn.dataset.accent === this._currentAccent;
            btn.classList.toggle('active', isActive);
        });

        // Update sound active state
        this._dropdown.querySelectorAll('.fp-sound-option').forEach(btn => {
            const isActive = btn.dataset.sound === this._currentSound;
            btn.classList.toggle('fp-active', isActive);
        });
    }
};

// Expose globally so SmartHeader or main.js can call FontPicker.init()
window.FontPicker = FontPicker;
