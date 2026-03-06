/**
 * Profile Manager
 * 
 * Handles user avatar customization, cropping (Cropper.js),
 * and synchronization with the database.
 */

const ProfileManager = {
    cropper: null,
    avatarStoreKey: 'user_avatar',
    apiUrl: 'api/profile/settings.php',

    /**
     * Initialization: Load avatar and bind events
     */
    async init() {
        console.log("ProfileManager: Initializing...");
        
        // 1. Initial Load from Database (or Fallback to LocalStorage)
        await this._loadAvatar();

        // 2. Bind Upload Events
        this._bindEvents();
    },

    /**
     * Load avatar from Database API
     */
    async _loadAvatar() {
        try {
            const response = await fetch(`${this.apiUrl}?key=${this.avatarStoreKey}`);
            const result = await response.json();
            
            if (result.success && result.data[this.avatarStoreKey]) {
                const avatarData = result.data[this.avatarStoreKey];
                this._updateAvatarUI(avatarData);
                // Also cache locally for offline/fast load
                localStorage.setItem(this.avatarStoreKey, avatarData);
            } else {
                // Fallback to local storage cache if network fails
                const cached = localStorage.getItem(this.avatarStoreKey);
                if (cached) this._updateAvatarUI(cached);
            }
        } catch (error) {
            console.warn("ProfileManager: Failed to fetch avatar from DB, using cache.", error);
            const cached = localStorage.getItem(this.avatarStoreKey);
            if (cached) this._updateAvatarUI(cached);
        }
    },

    /**
     * Bind UI Event Listeners
     */
    _bindEvents() {
        const fileInput = document.getElementById('avatar-upload-input');
        if (!fileInput) return;

        // Triggered when file is selected
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this._openCropper(file);
            }
        });

        // Save Button in Modal
        const saveBtn = document.getElementById('save-avatar-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this._saveCroppedImage());
        }

        // Cancel Button
        const cancelBtn = document.getElementById('cancel-avatar-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this._closeModal());
        }
    },

    /**
     * Initialize Cropper.js Modal
     */
    _openCropper(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const modal = document.getElementById('avatar-crop-modal');
            const image = document.getElementById('crop-target-img');
            
            if (!modal || !image) return;

            image.src = event.target.result;
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Destroy existing cropper if any
            if (this.cropper) {
                this.cropper.destroy();
            }

            // Init Cropper.js for circular crop
            this.cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                guides: false,
                autoCropArea: 0.8,
                dragMode: 'move',
                ready() {
                    console.log("Cropper.js Ready");
                }
            });
        };
        reader.readAsDataURL(file);
    },

    /**
     * Save Cropped Image to Database
     */
    async _saveCroppedImage() {
        if (!this.cropper) return;

        // Get circular crop as base64
        const canvas = this.cropper.getCroppedCanvas({
            width: 256,
            height: 256
        });

        // Convert to rounded (optional, but CSS handle transparency nicely)
        const base64Image = canvas.toDataURL('image/png');

        // Close Modal
        this._closeModal();

        // Update UI Immediately
        this._updateAvatarUI(base64Image);

        // Save to Database
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: this.avatarStoreKey,
                    value: base64Image
                })
            });

            const result = await response.json();
            if (result.success) {
                localStorage.setItem(this.avatarStoreKey, base64Image);
                console.log("ProfileManager: Avatar saved to DB");
            }
        } catch (error) {
            console.error("ProfileManager: Failed to save avatar", error);
        }
    },

    /**
     * Update all avatar images in the UI
     */
    _updateAvatarUI(base64Data) {
        if (!base64Data) return;

        // 1. Update all standard img tags
        const avatars = document.querySelectorAll('#header-profile-img, .profile-avatar-img');
        avatars.forEach(img => {
            img.src = base64Data;
        });

        // 2. Remove the early-load style to let the img.src take priority
        const earlyStyle = document.getElementById('early-avatar-style');
        if (earlyStyle) {
            earlyStyle.remove();
        }
    },

    _closeModal() {
        const modal = document.getElementById('avatar-crop-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        // Clear input so same file can be selected again
        const fileInput = document.getElementById('avatar-upload-input');
        if (fileInput) fileInput.value = '';
    }
};

// Global Exposure
window.ProfileManager = ProfileManager;
