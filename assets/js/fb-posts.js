/**
 * Facebook Post Monitor Logic - CRUD Version
 */
window.FBPostMonitor = {
    state: {
        offset: 0,
        limit: 10,
        currentAuthor: '',
        isLoading: false,
        hasMore: false,
        posts: []
    },

    async init() {
        console.log("FBPostMonitor init");
        this.cacheDOM();
        this.bindEvents();
        await this.fetchAuthors();
        await this.fetchPosts();
    },

    cacheDOM() {
        this.dom = {
            container: document.getElementById('posts-container'),
            authorFilter: document.getElementById('author-filter'),
            loadMoreBtn: document.getElementById('load-more-btn'),
            loadMoreContainer: document.getElementById('load-more-container'),
            refreshBtn: document.getElementById('refresh-posts-btn'),
            addPostBtn: document.getElementById('add-post-btn'),
            emptyTemplate: document.getElementById('empty-state-template'),
            
            // Modal Elements
            modal: document.getElementById('post-modal'),
            modalCloseBtns: document.querySelectorAll('.modal-close-btn, .modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            postForm: document.getElementById('post-form'),
            postId: document.getElementById('post-id'),
            postAuthor: document.getElementById('post-author'),
            postBody: document.getElementById('post-body'),
            postUrl: document.getElementById('post-url'),
            postTelegram: document.getElementById('post-telegram'),
            saveBtn: document.getElementById('save-post-btn')
        };
    },

    bindEvents() {
        // Core Actions
        this.dom.authorFilter.addEventListener('change', () => {
            this.state.currentAuthor = this.dom.authorFilter.value;
            this.state.offset = 0;
            this.fetchPosts(false);
        });

        this.dom.loadMoreBtn.addEventListener('click', () => {
            if (this.state.isLoading || !this.state.hasMore) return;
            this.state.offset += this.state.limit;
            this.fetchPosts(true);
        });

        this.dom.refreshBtn.addEventListener('click', () => {
            this.state.offset = 0;
            this.fetchPosts(false);
            this.fetchAuthors();
        });

        // CRUD Actions
        this.dom.addPostBtn.addEventListener('click', () => this.openModal());

        this.dom.modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        this.dom.postForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    },

    // Modal Management
    openModal(post = null) {
        this.dom.postForm.reset();
        this.dom.postId.value = '';
        
        if (post) {
            this.dom.modalTitle.textContent = 'Edit Post';
            this.dom.postId.value = post.id;
            this.dom.postAuthor.value = post.author_name;
            this.dom.postBody.value = post.post_body;
            this.dom.postUrl.value = post.source_url || '';
            this.dom.postTelegram.checked = parseInt(post.telegram_sent) === 1;
            this.dom.saveBtn.textContent = 'Update Post';
        } else {
            this.dom.modalTitle.textContent = 'Add New Post';
            this.dom.saveBtn.textContent = 'Save Post';
        }

        this.dom.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        this.dom.modal.classList.add('hidden');
        document.body.style.overflow = '';
    },

    async handleFormSubmit(e) {
        e.preventDefault();
        const id = this.dom.postId.value;
        const action = id ? 'update' : 'create';
        
        const data = {
            id: id,
            author_name: this.dom.postAuthor.value,
            post_body: this.dom.postBody.value,
            source_url: this.dom.postUrl.value,
            telegram_sent: this.dom.postTelegram.checked ? 1 : 0
        };

        this.dom.saveBtn.disabled = true;
        this.dom.saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span> Saving...';

        try {
            const response = await fetch(`api/fb-posts/fb-posts.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                window.showToast(result.message, "success");
                this.closeModal();
                this.state.offset = 0;
                await this.fetchPosts(false);
                await this.fetchAuthors();
            } else {
                window.showToast(result.message, "error");
            }
        } catch (error) {
            window.showToast("Network error", "error");
        } finally {
            this.dom.saveBtn.disabled = false;
            this.dom.saveBtn.textContent = id ? 'Update Post' : 'Save Post';
        }
    },

    async deletePost(id) {
        if (!confirm("Are you sure you want to delete this post? This action will hide the post from the feed.")) return;

        try {
            const response = await fetch(`api/fb-posts/fb-posts.php?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const result = await response.json();

            if (result.success) {
                window.showToast("Post deleted successfully", "success");
                this.state.offset = 0;
                await this.fetchPosts(false);
                await this.fetchAuthors();
            } else {
                window.showToast(result.message, "error");
            }
        } catch (error) {
            window.showToast("Network error", "error");
        }
    },

    // Data Fetching
    async fetchAuthors() {
        try {
            const response = await fetch('api/fb-posts/fb-posts.php?action=get_authors');
            const result = await response.json();
            if (result.success) {
                const currentVal = this.dom.authorFilter.value;
                this.dom.authorFilter.innerHTML = '<option value="">All Authors</option>';
                result.data.forEach(author => {
                    const option = document.createElement('option');
                    option.value = author;
                    option.textContent = author;
                    if (author === currentVal) option.selected = true;
                    this.dom.authorFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Failed to fetch authors:", error);
        }
    },

    async fetchPosts(append = false) {
        if (this.state.isLoading) return;
        this.state.isLoading = true;

        if (!append) {
            this.dom.container.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white/40 rounded-[2rem] border border-dashed border-slate-200">
                    <span class="material-symbols-outlined text-6xl mb-4 animate-spin-infinite">sync</span>
                    <p class="font-bold tracking-tight">Syncing feed...</p>
                </div>`;
        }

        try {
            const url = `api/fb-posts/fb-posts.php?action=list&limit=${this.state.limit}&offset=${this.state.offset}&author=${encodeURIComponent(this.state.currentAuthor)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                this.state.hasMore = result.has_more;
                this.state.posts = append ? [...this.state.posts, ...result.data] : result.data;
                this.renderPosts(result.data, append);
            }
        } catch (error) {
            console.error("Failed to fetch posts:", error);
            window.showToast("Network error", "error");
        } finally {
            this.state.isLoading = false;
            this.updateLoadMoreUI();
        }
    },

    renderPosts(posts, append) {
        if (!append) this.dom.container.innerHTML = '';

        if (!append && posts.length === 0) {
            const emptyState = this.dom.emptyTemplate.content.cloneNode(true);
            this.dom.container.appendChild(emptyState);
            return;
        }

        posts.forEach(post => {
            const card = this.createPostCard(post);
            this.dom.container.appendChild(card);
        });
    },

    createPostCard(post) {
        const div = document.createElement('div');
        div.className = "group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 animate-scale-up";
        
        const timestamp = this.formatDate(post.created_at);
        const isSent = parseInt(post.telegram_sent) === 1;

        div.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-slate-500 font-black text-xl border border-white">
                        ${post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                        <h3 class="font-black text-slate-800 tracking-tight leading-none mb-1">${post.author_name || 'Unknown Author'}</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${timestamp}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isSent ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 animate-pulse'}">
                        <span class="w-1.5 h-1.5 rounded-full ${isSent ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                        ${isSent ? 'Sent' : 'Pending'}
                    </div>
                    <!-- CRUD Menu -->
                    <div class="flex items-center gap-1">
                        <button class="edit-btn w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center">
                            <span class="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button class="delete-btn w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center">
                            <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="relative">
                <p class="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                    ${this.escapeHTML(post.post_body)}
                </p>
                <div class="mt-4 flex items-center gap-2">
                    <button class="copy-body-btn flex-1 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-indigo-100 flex items-center justify-center gap-2" data-body="${this.escapeHTML(post.post_body)}">
                        <span class="material-symbols-outlined text-sm">content_copy</span>
                        Copy Text
                    </button>
                    ${post.source_url ? `
                        <a href="${post.source_url}" target="_blank" class="flex-1 bg-indigo-600 hover:bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 hover:shadow-none flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined text-sm">open_in_new</span>
                            Source
                        </a>
                    ` : ''}
                </div>
            </div>
        `;

        // Bind Card Actions
        this.bindCardActions(div, post);

        return div;
    },

    bindCardActions(card, post) {
        card.querySelector('.edit-btn').onclick = () => this.openModal(post);
        card.querySelector('.delete-btn').onclick = () => this.deletePost(post.id);
        
        const copyBtn = card.querySelector('.copy-body-btn');
        copyBtn.onclick = (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(post.post_body).then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="material-symbols-outlined text-sm text-emerald-500">check</span> COPIED!';
                setTimeout(() => copyBtn.innerHTML = originalText, 2000);
            });
        };
    },

    updateLoadMoreUI() {
        if (this.state.hasMore) {
            this.dom.loadMoreContainer.classList.remove('hidden');
            this.dom.loadMoreBtn.innerHTML = `
                <span class="relative flex items-center gap-3 text-sm font-black text-slate-600 group-hover:text-indigo-600">
                    Load More Posts
                    <span class="material-symbols-outlined text-lg">expand_more</span>
                </span>`;
        } else {
            this.dom.loadMoreContainer.classList.add('hidden');
        }
    },

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (e) {
            return dateString;
        }
    },

    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// Initialize
if (document.getElementById('posts-container')) {
    window.FBPostMonitor.init();
}
