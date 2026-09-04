/**
 * Realtime Collaborative Editing Core Module for Easy Discord Bot Builder
 * Powered by PeerJS (WebRTC P2P)
 */

const USER_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
];

function getRandomColor() {
    return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function generateRandomName() {
    const animals = ['ねこ', 'いぬ', 'きつね', 'ペンギン', 'パンダ', 'コアラ', 'フクロウ', 'うさぎ'];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${animal}_${num}`;
}

export class CollabManager {
    constructor(workspace) {
        this.workspace = workspace;
        this.peer = null;
        this.connections = new Map(); // peerId -> DataConnection
        this.isHost = false;
        this.roomId = null;
        this.myUser = {
            id: null,
            name: localStorage.getItem('edbb_collab_user_name') || generateRandomName(),
            color: getRandomColor(),
            isHost: false,
        };
        this.remoteUsers = new Map(); // peerId -> user object
        this.remoteSelections = new Map(); // peerId -> blockId
        this.isApplyingRemote = false;
        this.listeners = new Set();
        this.blocklyListener = null;

        this.setupBlocklyListener();
    }

    onStateChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(eventType, data = {}) {
        for (const listener of this.listeners) {
            try {
                listener(eventType, data);
            } catch (err) {
                console.error('CollabManager listener error:', err);
            }
        }
    }

    setUserName(name) {
        if (!name || !name.trim()) return;
        this.myUser.name = name.trim();
        localStorage.setItem('edbb_collab_user_name', this.myUser.name);
        this.broadcast({
            type: 'user_update',
            user: this.myUser,
        });
        this.notify('users_updated', this.getAllUsers());
    }

    getAllUsers() {
        return [this.myUser, ...Array.from(this.remoteUsers.values())];
    }

    isConnected() {
        return this.peer && !this.peer.destroyed && (this.isHost || this.connections.size > 0);
    }

    setupBlocklyListener() {
        if (!this.workspace) return;
        this.blocklyListener = (event) => {
            if (this.isApplyingRemote || !this.isConnected()) return;

            // Handle Selection Event
            if (event.type === Blockly.Events.SELECTED) {
                const blockId = event.newElementId || null;
                this.broadcast({
                    type: 'selection_change',
                    senderId: this.myUser.id,
                    blockId: blockId,
                });
                return;
            }

            // Filter out purely UI-only events
            if (event.isUiEvent) return;

            // Only sync mutative events
            const syncableEvents = [
                Blockly.Events.BLOCK_CREATE,
                Blockly.Events.BLOCK_DELETE,
                Blockly.Events.BLOCK_CHANGE,
                Blockly.Events.BLOCK_MOVE,
                Blockly.Events.VAR_CREATE,
                Blockly.Events.VAR_DELETE,
                Blockly.Events.VAR_RENAME,
                Blockly.Events.COMMENT_CREATE,
                Blockly.Events.COMMENT_DELETE,
                Blockly.Events.COMMENT_CHANGE,
                Blockly.Events.COMMENT_MOVE,
            ];

            if (syncableEvents.includes(event.type)) {
                try {
                    const eventJson = event.toJson();
                    this.broadcast({
                        type: 'blockly_event',
                        senderId: this.myUser.id,
                        event: eventJson,
                    });
                } catch (e) {
                    console.error('Failed to serialize Blockly event:', e);
                }
            }
        };

        this.workspace.addChangeListener(this.blocklyListener);
    }

    async createRoom() {
        this.disconnect();
        const randomId = Math.random().toString(36).substring(2, 9);
        const roomId = `edbb-${randomId}`;

        this.isHost = true;
        this.roomId = roomId;
        this.myUser.isHost = true;

        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') {
                return reject(new Error('PeerJS ライブラリが読み込まれていません。'));
            }

            this.peer = new Peer(roomId, {
                debug: 1,
            });

            this.peer.on('open', (id) => {
                this.myUser.id = id;
                this.notify('status_change', { status: 'connected', isHost: true, roomId: this.roomId });
                this.notify('users_updated', this.getAllUsers());
                resolve(this.roomId);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Host Error:', err);
                this.notify('error', { error: err.message || '接続エラーが発生しました' });
                reject(err);
            });

            this.peer.on('close', () => {
                this.disconnect();
            });
        });
    }

    async joinRoom(roomId) {
        if (!roomId || !roomId.trim()) throw new Error('ルームIDを入力してください。');
        const cleanRoomId = roomId.trim();
        this.disconnect();

        this.isHost = false;
        this.roomId = cleanRoomId;
        this.myUser.isHost = false;

        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') {
                return reject(new Error('PeerJS ライブラリが読み込まれていません。'));
            }

            this.peer = new Peer({
                debug: 1,
            });

            this.peer.on('open', (id) => {
                this.myUser.id = id;
                const conn = this.peer.connect(cleanRoomId, {
                    reliable: true,
                });

                conn.on('open', () => {
                    this.connections.set(cleanRoomId, conn);
                    // Send user info to host
                    conn.send({
                        type: 'user_join',
                        user: this.myUser,
                    });
                    this.notify('status_change', { status: 'connected', isHost: false, roomId: this.roomId });
                    resolve(cleanRoomId);
                });

                conn.on('data', (data) => {
                    this.handleIncomingData(data, conn);
                });

                conn.on('close', () => {
                    this.notify('info', { message: 'ホストとの接続が切断されました。' });
                    this.disconnect();
                });

                conn.on('error', (err) => {
                    console.error('Connection to host error:', err);
                    this.notify('error', { error: 'ホストへの接続に失敗しました。' });
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Client Error:', err);
                this.notify('error', { error: err.message || '接続エラーが発生しました' });
                reject(err);
            });

            this.peer.on('close', () => {
                this.disconnect();
            });
        });
    }

    handleIncomingConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);

            // Send current full workspace to new guest
            try {
                const fullState = Blockly.serialization.workspaces.save(this.workspace);
                const titleInput = document.getElementById('projectTitleInput');
                const projectTitle = titleInput ? titleInput.value : '';

                conn.send({
                    type: 'sync_full',
                    state: fullState,
                    projectTitle: projectTitle,
                    hostUser: this.myUser,
                    users: Array.from(this.remoteUsers.values()),
                });
            } catch (err) {
                console.error('Failed to serialize workspace for sync_full:', err);
            }
        });

        conn.on('data', (data) => {
            this.handleIncomingData(data, conn);

            // As Host, relay message to all other guests
            if (this.isHost && data.type !== 'sync_full') {
                for (const [peerId, otherConn] of this.connections) {
                    if (peerId !== conn.peer && otherConn.open) {
                        otherConn.send(data);
                    }
                }
            }
        });

        conn.on('close', () => {
            const departingUser = this.remoteUsers.get(conn.peer);
            this.connections.delete(conn.peer);
            this.remoteUsers.delete(conn.peer);
            this.remoteSelections.delete(conn.peer);
            this.notify('selection_cleared', { peerId: conn.peer });
            this.notify('users_updated', this.getAllUsers());
            if (departingUser) {
                this.notify('info', { message: `${departingUser.name} さんが退出しました。` });
            }
            // Relay departure to remaining peers
            if (this.isHost) {
                this.broadcast({
                    type: 'user_leave',
                    peerId: conn.peer,
                });
            }
        });

        conn.on('error', (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
        });
    }

    handleIncomingData(data, conn) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'sync_full':
                this.applyFullSync(data);
                break;

            case 'blockly_event':
                this.applyBlocklyEvent(data.event);
                break;

            case 'selection_change':
                this.applySelectionChange(data.senderId, data.blockId);
                break;

            case 'user_join':
                this.remoteUsers.set(data.user.id, data.user);
                this.notify('users_updated', this.getAllUsers());
                this.notify('info', { message: `${data.user.name} さんが参加しました！` });
                break;

            case 'user_update':
                this.remoteUsers.set(data.user.id, data.user);
                this.notify('users_updated', this.getAllUsers());
                break;

            case 'user_leave':
                this.remoteUsers.delete(data.peerId);
                this.remoteSelections.delete(data.peerId);
                this.notify('selection_cleared', { peerId: data.peerId });
                this.notify('users_updated', this.getAllUsers());
                break;

            case 'title_change':
                if (data.title != null) {
                    const titleInput = document.getElementById('projectTitleInput');
                    if (titleInput && titleInput.value !== data.title) {
                        titleInput.value = data.title;
                    }
                }
                break;

            default:
                break;
        }
    }

    applyFullSync(data) {
        this.isApplyingRemote = true;
        try {
            if (data.state && this.workspace) {
                this.workspace.clear();
                Blockly.serialization.workspaces.load(data.state, this.workspace);
            }
            if (data.projectTitle != null) {
                const titleInput = document.getElementById('projectTitleInput');
                if (titleInput) titleInput.value = data.projectTitle;
            }
            if (data.hostUser) {
                this.remoteUsers.set(data.hostUser.id, data.hostUser);
            }
            if (Array.isArray(data.users)) {
                data.users.forEach((u) => {
                    if (u.id !== this.myUser.id) {
                        this.remoteUsers.set(u.id, u);
                    }
                });
            }
            this.notify('users_updated', this.getAllUsers());
            this.notify('info', { message: 'ワークスペースの同期が完了しました。' });
        } catch (err) {
            console.error('Failed to load synced workspace:', err);
        } finally {
            this.isApplyingRemote = false;
        }
    }

    applyBlocklyEvent(eventJson) {
        if (!eventJson || !this.workspace) return;
        this.isApplyingRemote = true;
        try {
            const event = Blockly.Events.fromJson(eventJson, this.workspace);
            if (event) {
                event.run(true);
            }
        } catch (err) {
            console.error('Failed to apply remote Blockly event:', err);
        } finally {
            this.isApplyingRemote = false;
        }
    }

    applySelectionChange(peerId, blockId) {
        if (!peerId) return;
        const user = this.remoteUsers.get(peerId);
        if (!user) return;

        if (blockId) {
            this.remoteSelections.set(peerId, blockId);
            this.notify('selection_updated', { peerId, blockId, user });
        } else {
            this.remoteSelections.delete(peerId);
            this.notify('selection_cleared', { peerId });
        }
    }

    broadcast(data) {
        if (!this.isConnected()) return;
        for (const conn of this.connections.values()) {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.error('Broadcast send error:', e);
                }
            }
        }
    }

    broadcastTitleChange(newTitle) {
        this.broadcast({
            type: 'title_change',
            title: newTitle,
        });
    }

    disconnect() {
        if (this.blocklyListener && this.workspace) {
            // Keep listener active for reconnect
        }

        // Close all connections
        for (const conn of this.connections.values()) {
            try {
                conn.close();
            } catch (e) { }
        }
        this.connections.clear();

        if (this.peer && !this.peer.destroyed) {
            try {
                this.peer.destroy();
            } catch (e) { }
        }
        this.peer = null;

        this.isHost = false;
        this.roomId = null;
        this.myUser.id = null;
        this.myUser.isHost = false;
        this.remoteUsers.clear();
        this.remoteSelections.clear();

        this.notify('all_selections_cleared');
        this.notify('status_change', { status: 'disconnected' });
        this.notify('users_updated', []);
    }
}
