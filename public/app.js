const socket = io();

// STATE
let currentUser = null;
let currentChatId = null;
let friends = [];
let chats = [];
let activeCallStream = null;

// DOM ELEMENTS
const app = document.getElementById('app');
const views = {
    auth: document.getElementById('auth-view'),
    home: document.getElementById('home-view'),
    chat: document.getElementById('chat-view'),
    call: document.getElementById('call-view')
};

// --- AUTH HANDLERS ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const signupError = document.getElementById('signup-error');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
});

tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;

    const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
        signupError.textContent = data.error;
    } else {
        login(data.user);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
        alert(data.error);
    } else {
        login(data.user);
    }
});

function login(user) {
    currentUser = user;
    socket.emit('join_user', user.id);
    document.getElementById('current-user-display').textContent = user.username;

    // Switch View
    views.auth.classList.remove('active');
    views.home.classList.add('active');

    loadData();
}

document.getElementById('logout-btn').addEventListener('click', () => {
    window.location.reload();
});

// --- DATA LOADING ---
async function loadData() {
    const uRes = await fetch(`/api/users/${currentUser.id}`);
    const uData = await uRes.json();
    currentUser = uData;

    friends = [];
    const friendsListEl = document.getElementById('friends-list');
    friendsListEl.innerHTML = '';

    for (const friendId of currentUser.friends) {
        const fRes = await fetch(`/api/users/${friendId}`);
        const fData = await fRes.json();
        friends.push(fData);

        const div = document.createElement('div');
        div.className = 'friend-item';
        div.textContent = fData.username;
        friendsListEl.appendChild(div);
    }

    loadChats();
}

async function loadChats() {
    const res = await fetch(`/api/chats?userId=${currentUser.id}`);
    chats = await res.json();
    renderChats();

    chats.forEach(c => socket.emit('join_chat', c.id));
}

function renderChats() {
    const list = document.getElementById('chats-list');
    list.innerHTML = '';

    chats.forEach(chat => {
        const el = document.createElement('div');
        el.className = 'chat-item';
        el.innerHTML = `
            <div class="chat-info">
                <h4>${chat.name}</h4>
                <p>Last msg...</p>
            </div>
            <button class="icon-btn chat-options-btn" data-id="${chat.id}">...</button>
        `;

        // CORRECTION: Direct Event Listener binding
        el.querySelector('.chat-info').addEventListener('click', () => openChat(chat));

        el.querySelector('.chat-options-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openChatOptions(chat);
        });

        list.appendChild(el);
    });
}

// --- HOME ACTIONS ---
const createChatModal = document.getElementById('create-chat-modal');

document.getElementById('create-chat-btn').addEventListener('click', () => {
    const list = document.getElementById('create-chat-friends-list');
    list.innerHTML = '';

    friends.forEach(f => {
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
            <label>
                <input type="checkbox" value="${f.id}" class="friend-check">
                <span class="friend-name"></span>
            </label>
        `;
        div.querySelector('.friend-name').textContent = f.username;
        list.appendChild(div);
    });

    createChatModal.classList.remove('hidden');
});

document.getElementById('confirm-create-chat-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-chat-name').value;
    const checks = document.querySelectorAll('.friend-check:checked');
    const participantIds = [currentUser.id];
    checks.forEach(c => participantIds.push(c.value));

    if (!name) return alert('Enter chat name');

    const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, participants: participantIds })
    });

    const newChat = await res.json();
    chats.push(newChat);
    renderChats();
    socket.emit('join_chat', newChat.id);
    createChatModal.classList.add('hidden');
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});

// Settings & Friends
const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

document.getElementById('send-invite-btn').addEventListener('click', async () => {
    const username = document.getElementById('invite-username').value;
    const status = document.getElementById('invite-status');

    const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: currentUser.id, toUsername: username })
    });
    const data = await res.json();

    if (data.error) {
        status.textContent = data.error;
        status.style.color = 'red';
    } else {
        status.textContent = 'Invite sent!';
        status.style.color = 'green';
    }
});

// Notifications
const notifModal = document.getElementById('notifications-modal');
document.getElementById('show-notifications-btn').addEventListener('click', () => {
    renderNotifications();
    notifModal.classList.remove('hidden');
});

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    list.innerHTML = '';

    if (currentUser.invitesReceived.length === 0) {
        list.textContent = 'No new notifications'; // Fixed XSS risk
        return;
    }

    currentUser.invitesReceived.forEach(async (inviterId) => {
        const res = await fetch(`/api/users/${inviterId}`);
        const inviter = await res.json();

        const div = document.createElement('div');
        div.className = 'friend-item';

        const span = document.createElement('span');
        span.textContent = `Friend request from ${inviter.username}`;

        const btn = document.createElement('button');
        btn.className = 'accept-btn';
        btn.textContent = 'Accept';
        btn.onclick = async () => {
            await fetch('/api/friends/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, inviteFromId: inviter.id })
            });
            div.remove();
            loadData();
        };

        div.appendChild(span);
        div.appendChild(btn);
        list.appendChild(div);
    });
}

// --- CHAT INTERFACE ---
let activeChatConfig = null;

function openChat(chat) {
    if (!chat) return;
    currentChatId = chat.id;
    activeChatConfig = chat;
    document.getElementById('current-chat-name').textContent = chat.name;

    views.home.classList.remove('active');
    views.chat.classList.add('active');

    renderMessages(chat.messages);
}

document.getElementById('back-to-home').addEventListener('click', () => {
    views.chat.classList.remove('active');
    views.home.classList.add('active');
    currentChatId = null;
    loadChats();
});

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        const isMe = msg.senderId === currentUser.id;
        div.className = `message ${isMe ? 'sent' : 'received'}`;

        let senderName = 'Unknown';
        if (isMe) senderName = 'You';
        else {
            const f = friends.find(fr => fr.id === msg.senderId);
            if (f) senderName = f.username;
        }

        const sSpan = document.createElement('span');
        sSpan.className = 'message-sender';
        sSpan.textContent = senderName;
        div.appendChild(sSpan);

        if (msg.type === 'navio-audio') {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = msg.content;
            div.appendChild(audio);
        } else {
            // SECURE: Use textContent
            const tNode = document.createTextNode(msg.content);
            div.appendChild(tNode);
        }

        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

document.getElementById('send-msg-btn').addEventListener('click', sendMessage);

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value;
    if (!content) return;

    socket.emit('send_message', {
        chatId: currentChatId,
        senderId: currentUser.id,
        content: content,
        type: 'text'
    });

    input.value = '';
}

socket.on('message', (msg) => {
    if (currentChatId === msg.chatId) {
        const container = document.getElementById('messages-container');

        const div = document.createElement('div');
        const isMe = msg.senderId === currentUser.id;
        div.className = `message ${isMe ? 'sent' : 'received'}`;

        let senderName = isMe ? 'You' : 'Friend';
        if (!isMe) {
            const f = friends.find(fr => fr.id === msg.senderId);
            if (f) senderName = f.username;
        }

        const sSpan = document.createElement('span');
        sSpan.className = 'message-sender';
        sSpan.textContent = senderName;
        div.appendChild(sSpan);

        if (msg.type === 'navio-audio') {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = msg.content;
            div.appendChild(audio);
        } else {
            const tNode = document.createTextNode(msg.content);
            div.appendChild(tNode);
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
});

// Voice Logic
const voiceBtn = document.getElementById('voice-msg-btn');
let mediaRecorder;
let audioChunks = [];

voiceBtn.addEventListener('mousedown', startRecording);
voiceBtn.addEventListener('mouseup', stopRecording);
voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const base64Audio = reader.result;
                socket.emit('send_message', {
                    chatId: currentChatId,
                    senderId: currentUser.id,
                    content: base64Audio,
                    type: 'navio-audio'
                });
            };
        };

        mediaRecorder.start();
        voiceBtn.classList.add('recording');
    } catch (e) {
        console.error('Mic error', e);
        alert('Microphone access denied');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        voiceBtn.classList.remove('recording');
    }
}

// --- CHAT OPTIONS & PEOPLE ---
const chatOptionsModal = document.getElementById('chat-options-modal');
const seePeopleModal = document.getElementById('see-people-modal');

document.getElementById('chat-menu-btn').addEventListener('click', () => {
    if (activeChatConfig) openChatOptions(activeChatConfig);
});

function openChatOptions(chat) {
    activeChatConfig = chat;
    chatOptionsModal.classList.remove('hidden');
}

document.getElementById('rename-chat-option').addEventListener('click', async () => {
    const newName = prompt('Enter new chat name:', activeChatConfig.name);
    if (newName) {
        await fetch(`/api/chats/${activeChatConfig.id}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        chatOptionsModal.classList.add('hidden');
        if (currentChatId === activeChatConfig.id) {
            document.getElementById('current-chat-name').textContent = newName;
        }
        loadChats();
    }
});

document.getElementById('delete-chat-option').addEventListener('click', async () => {
    if (confirm('Delete this chat?')) {
        await fetch(`/api/chats/${activeChatConfig.id}`, { method: 'DELETE' });
        chatOptionsModal.classList.add('hidden');
        if (currentChatId === activeChatConfig.id) {
            views.chat.classList.remove('active');
            views.home.classList.add('active');
            currentChatId = null;
        }
        loadChats();
    }
});

document.getElementById('see-people-option').addEventListener('click', async () => {
    chatOptionsModal.classList.add('hidden');
    seePeopleModal.classList.remove('hidden');

    const list = document.getElementById('chat-people-list');
    list.innerHTML = '';

    for (const pid of activeChatConfig.participants) {
        const res = await fetch(`/api/users/${pid}`);
        const pData = await res.json();

        const isMe = pData.id === currentUser.id;

        const div = document.createElement('div');
        div.className = 'person-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = pData.username + (isMe ? ' (You)' : '');
        div.appendChild(nameSpan);

        if (!isMe) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'person-actions';

            const callBtn = document.createElement('button');
            callBtn.textContent = '📞';
            // Start Individual Call
            callBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startCall(pData.id, pData.username);
            });

            const msgBtn = document.createElement('button');
            msgBtn.textContent = '✉';
            msgBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                alert(`Messaging ${pData.username} functionality to be implemented (opens chat)`);
            });

            actionsDiv.appendChild(callBtn);
            actionsDiv.appendChild(msgBtn);
            div.appendChild(actionsDiv);
        }

        list.appendChild(div);
    }
});

document.querySelector('.close-back-people').addEventListener('click', () => {
    seePeopleModal.classList.add('hidden');
});

// Notifications Socket
socket.on('notification', (data) => {
    loadData();
});

socket.on('chat_new', () => loadChats());
socket.on('chat_updated', () => loadChats());
socket.on('chat_deleted', (data) => {
    if (currentChatId === data.chatId) {
        alert('This chat was deleted');
        views.chat.classList.remove('active');
        views.home.classList.add('active');
        currentChatId = null;
    }
    loadChats();
});

// --- CALLING FEATURE ---
const incomingCallModal = document.getElementById('incoming-call-modal');
const joinCallBtn = document.getElementById('join-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');

document.getElementById('call-group-btn').addEventListener('click', () => {
    // Call user defined in chat
    if (activeChatConfig && currentChatId) {
        socket.emit('call_group_start', {
            fromId: currentUser.id,
            fromName: currentUser.username,
            chatId: currentChatId
        });
        // Self join
        joinCall();
    }
});

function startCall(targetId, targetName) {
    socket.emit('call_start', {
        fromId: currentUser.id,
        fromName: currentUser.username,
        toId: targetId
    });
    // For the caller, show 'calling' state or just jump to call screen waiting
    joinCall();
}

socket.on('call_incoming', (data) => {
    // Show Modal
    const display = document.getElementById('caller-name-display');
    if (data.isGroup) {
        display.textContent = `Group Call in Chat...`;
    } else {
        display.textContent = `${data.fromName} is calling...`;
    }
    incomingCallModal.classList.remove('hidden');
});

joinCallBtn.addEventListener('click', () => {
    incomingCallModal.classList.add('hidden');
    joinCall();
});

declineCallBtn.addEventListener('click', () => {
    incomingCallModal.classList.add('hidden');
});

async function joinCall() {
    // Switch to Call View
    views.home.classList.remove('active');
    views.chat.classList.remove('active');
    views.call.classList.add('active');

    // Start Media
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        activeCallStream = stream;
        const video = document.getElementById('local-video');
        video.srcObject = stream;
    } catch (e) {
        console.warn('Video/Audio access failed, trying Audio only...', e);
        try {
            // Fallback: Audio only
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            activeCallStream = audioStream;
            const video = document.getElementById('local-video');
            video.srcObject = audioStream;
            alert('Camera not found or denied. Switched to Audio call.');
        } catch (err) {
            console.error('Media access failed completely', err);
            let msg = 'Could not access microphone.';
            if (err.name === 'NotAllowedError') msg = 'Permission denied. Please allow camera/microphone access in your browser settings.';

            alert(msg);
        }
    }
}

endCallBtn.addEventListener('click', () => {
    if (activeCallStream) {
        activeCallStream.getTracks().forEach(t => t.stop());
        activeCallStream = null;
    }
    views.call.classList.remove('active');
    // Go back to home
    views.home.classList.add('active');
});

let isMuted = false;
toggleMicBtn.addEventListener('click', () => {
    if (activeCallStream) {
        isMuted = !isMuted;
        activeCallStream.getAudioTracks()[0].enabled = !isMuted;
        toggleMicBtn.classList.toggle('muted', isMuted);
    }
});

let isCamOff = false;
toggleCamBtn.addEventListener('click', () => {
    if (activeCallStream) {
        isCamOff = !isCamOff;
        activeCallStream.getVideoTracks()[0].enabled = !isCamOff;
        toggleCamBtn.classList.toggle('muted', isCamOff);
    }
});
