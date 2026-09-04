/**
 * Realtime Collaborative Editing UI Module for Easy Discord Bot Builder
 */

export class CollabUI {
    constructor(collabManager) {
        this.manager = collabManager;
        this.modal = document.getElementById('collabModal');
        this.btn = document.getElementById('collabBtn');
        this.statusBadge = document.getElementById('collabStatusBadge');
        this.userCountBadge = document.getElementById('collabUserCount');
        this.activeHighlights = new Map(); // peerId -> { blockId, styleElement }

        this.initElements();
        this.initListeners();
        this.checkUrlParams();
    }

    initElements() {
        this.elements = {
            closeBtn: document.getElementById('collabModalClose'),
            hostSection: document.getElementById('collabHostSection'),
            joinSection: document.getElementById('collabJoinSection'),
            activeSection: document.getElementById('collabActiveSection'),
            createBtn: document.getElementById('collabCreateRoomBtn'),
            joinBtn: document.getElementById('collabJoinRoomBtn'),
            roomIdInput: document.getElementById('collabRoomIdInput'),
            activeRoomId: document.getElementById('collabActiveRoomId'),
            copyIdBtn: document.getElementById('collabCopyIdBtn'),
            copyLinkBtn: document.getElementById('collabCopyLinkBtn'),
            disconnectBtn: document.getElementById('collabDisconnectBtn'),
            userNameInput: document.getElementById('collabUserNameInput'),
            userList: document.getElementById('collabUserList'),
            statusText: document.getElementById('collabStatusText'),
        };

        if (this.elements.userNameInput) {
            this.elements.userNameInput.value = this.manager.myUser.name;
            this.elements.userNameInput.addEventListener('change', (e) => {
                this.manager.setUserName(e.target.value);
            });
        }
    }

    initListeners() {
        // Toggle modal
        this.btn?.addEventListener('click', () => {
            this.openModal();
        });

        this.elements.closeBtn?.addEventListener('click', () => {
            this.closeModal();
        });

        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Create room
        this.elements.createBtn?.addEventListener('click', async () => {
            try {
                this.elements.createBtn.disabled = true;
                this.elements.createBtn.textContent = 'ルーム作成中...';
                await this.manager.createRoom();
                this.showToast('ルームを作成しました！', 'success');
            } catch (err) {
                this.showToast(err.message || '作成に失敗しました', 'error');
            } finally {
                if (this.elements.createBtn) {
                    this.elements.createBtn.disabled = false;
                    this.elements.createBtn.innerHTML = '<i data-lucide="plus-circle" class="w-4 h-4"></i> 新しいルームを開始';
                    if (window.lucide) window.lucide.createIcons();
                }
            }
        });

        // Join room
        this.elements.joinBtn?.addEventListener('click', async () => {
            const roomId = this.elements.roomIdInput?.value?.trim();
            if (!roomId) {
                this.showToast('ルームIDを入力してください', 'error');
                return;
            }
            try {
                this.elements.joinBtn.disabled = true;
                this.elements.joinBtn.textContent = '参加中...';
                await this.manager.joinRoom(roomId);
                this.showToast('ルームに参加しました！', 'success');
            } catch (err) {
                this.showToast(err.message || '参加に失敗しました', 'error');
            } finally {
                if (this.elements.joinBtn) {
                    this.elements.joinBtn.disabled = false;
                    this.elements.joinBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> ルームに参加';
                    if (window.lucide) window.lucide.createIcons();
                }
            }
        });

        // Copy Room ID
        this.elements.copyIdBtn?.addEventListener('click', () => {
            if (this.manager.roomId) {
                navigator.clipboard.writeText(this.manager.roomId);
                this.showCopyFeedback(this.elements.copyIdBtn, 'コピー完了');
            }
        });

        // Copy Share Link
        this.elements.copyLinkBtn?.addEventListener('click', () => {
            if (this.manager.roomId) {
                const url = new URL(window.location.href);
                url.searchParams.set('collab', this.manager.roomId);
                navigator.clipboard.writeText(url.toString());
                this.showCopyFeedback(this.elements.copyLinkBtn, 'リンクをコピーしました');
            }
        });

        // Disconnect
        this.elements.disconnectBtn?.addEventListener('click', () => {
            this.manager.disconnect();
            this.showToast('共同編集を切断しました', 'info');
        });

        // CollabManager events
        this.manager.onStateChange((type, data) => {
            switch (type) {
                case 'status_change':
                    this.updateViewByStatus(data.status);
                    break;
                case 'users_updated':
                    this.renderUsers(data);
                    break;
                case 'selection_updated':
                    this.applyRemoteSelection(data.peerId, data.blockId, data.user);
                    break;
                case 'selection_cleared':
                    this.clearRemoteSelection(data.peerId);
                    break;
                case 'all_selections_cleared':
                    this.clearAllRemoteSelections();
                    break;
                case 'info':
                    this.showToast(data.message, 'info');
                    break;
                case 'error':
                    this.showToast(data.error, 'error');
                    break;
            }
        });

        // Sync Project Title change to other peers
        const projectTitleInput = document.getElementById('projectTitleInput');
        projectTitleInput?.addEventListener('input', (e) => {
            if (this.manager.isConnected()) {
                this.manager.broadcastTitleChange(e.target.value);
            }
        });
    }

    openModal() {
        if (!this.modal) return;
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        void this.modal.offsetWidth;
        this.modal.classList.add('show-modal');
        if (window.lucide) window.lucide.createIcons();
    }

    closeModal() {
        if (!this.modal) return;
        this.modal.classList.remove('show-modal');
        setTimeout(() => {
            this.modal.classList.remove('flex');
            this.modal.classList.add('hidden');
        }, 200);
    }

    updateViewByStatus(status) {
        const isConnected = status === 'connected';

        // Update header button & badges
        if (this.statusBadge) {
            if (isConnected) {
                this.statusBadge.classList.remove('bg-slate-400');
                this.statusBadge.classList.add('bg-emerald-500', 'animate-pulse');
            } else {
                this.statusBadge.classList.remove('bg-emerald-500', 'animate-pulse');
                this.statusBadge.classList.add('bg-slate-400');
            }
        }

        if (this.elements.activeSection && this.elements.hostSection && this.elements.joinSection) {
            if (isConnected) {
                this.elements.hostSection.classList.add('hidden');
                this.elements.joinSection.classList.add('hidden');
                this.elements.activeSection.classList.remove('hidden');

                if (this.elements.activeRoomId) {
                    this.elements.activeRoomId.textContent = this.manager.roomId;
                }
            } else {
                this.elements.hostSection.classList.remove('hidden');
                this.elements.joinSection.classList.remove('hidden');
                this.elements.activeSection.classList.add('hidden');
            }
        }

        if (this.userCountBadge) {
            this.userCountBadge.textContent = isConnected ? `${this.manager.getAllUsers().length}` : '';
            this.userCountBadge.classList.toggle('hidden', !isConnected);
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderUsers(users) {
        if (!this.elements.userList) return;
        this.elements.userList.innerHTML = '';

        if (this.userCountBadge && this.manager.isConnected()) {
            this.userCountBadge.textContent = `${users.length}`;
        }

        users.forEach((user) => {
            const isMe = user.id === this.manager.myUser.id;
            const li = document.createElement('div');
            li.className = 'flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm';

            li.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <div class="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm" style="background-color: ${user.color};"></div>
                    <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${this.escapeHtml(user.name)}</span>
                    ${isMe ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">あなた</span>' : ''}
                </div>
                <div>
                    ${user.isHost ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">👑 ホスト</span>' : '<span class="text-[10px] font-medium text-slate-400">ゲスト</span>'}
                </div>
            `;
            this.elements.userList.appendChild(li);
        });
    }

    applyRemoteSelection(peerId, blockId, user) {
        this.clearRemoteSelection(peerId);
        if (!blockId) return;

        // Try to find the block element in SVG
        const blockGroup = document.querySelector(`g.blocklyDraggable[data-id="${blockId}"]`);
        if (!blockGroup) return;

        const path = blockGroup.querySelector('path.blocklyPath');
        if (!path) return;

        // Create overlay / custom glow filter
        const originalStroke = path.style.stroke;
        const originalStrokeWidth = path.style.strokeWidth;
        const originalFilter = path.style.filter;

        path.style.stroke = user.color;
        path.style.strokeWidth = '3.5px';
        path.style.filter = `drop-shadow(0 0 6px ${user.color})`;

        this.activeHighlights.set(peerId, {
            path,
            originalStroke,
            originalStrokeWidth,
            originalFilter,
        });
    }

    clearRemoteSelection(peerId) {
        const item = this.activeHighlights.get(peerId);
        if (item && item.path) {
            item.path.style.stroke = item.originalStroke;
            item.path.style.strokeWidth = item.originalStrokeWidth;
            item.path.style.filter = item.originalFilter;
        }
        this.activeHighlights.delete(peerId);
    }

    clearAllRemoteSelections() {
        for (const [peerId] of this.activeHighlights) {
            this.clearRemoteSelection(peerId);
        }
    }

    checkUrlParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const collabRoomId = urlParams.get('collab') || urlParams.get('room');
            if (collabRoomId) {
                // Auto prompt join
                setTimeout(async () => {
                    const shouldJoin = await this.promptJoinConfirmation(collabRoomId);
                    if (shouldJoin) {
                        if (this.elements.roomIdInput) this.elements.roomIdInput.value = collabRoomId;
                        try {
                            await this.manager.joinRoom(collabRoomId);
                            this.showToast('共同編集ルームに参加しました！', 'success');
                        } catch (e) {
                            this.showToast(e.message || '参加に失敗しました', 'error');
                        }
                    }
                }, 600);
            }
        } catch (e) {
            console.error('Error parsing collab URL params:', e);
        }
    }

    async promptJoinConfirmation(roomId) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: '👥 共同編集に参加しますか？',
                text: `ルーム ID: ${roomId} への招待を受け取りました。参加すると現在のワークスペースがルームのデータに同期されます。`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5',
                cancelButtonColor: '#64748b',
                confirmButtonText: '参加する',
                cancelButtonText: 'キャンセル',
            });
            return result.isConfirmed;
        }
        return window.confirm(`共同編集ルーム (${roomId}) に参加しますか？`);
    }

    showToast(message, type = 'info') {
        if (typeof Swal !== 'undefined' && Swal.mixin) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });
            Toast.fire({
                icon: type,
                title: message,
            });
            return;
        }
        console.log(`[Collab ${type}]: ${message}`);
    }

    showCopyFeedback(button, text) {
        if (!button) return;
        const originalHtml = button.innerHTML;
        button.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-500"></i> <span class="text-emerald-500">${text}</span>`;
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            button.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
