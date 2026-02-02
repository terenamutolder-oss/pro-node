const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Use OS temp directory for Vercel compatibility (ephemeral)
const DATA_DIR = path.join(os.tmpdir(), 'pronode_data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

async function init() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) { }

    try {
        await fs.access(USERS_FILE);
    } catch {
        // Create default file if not exists
        await fs.writeFile(USERS_FILE, '[]');
    }

    try {
        await fs.access(CHATS_FILE);
    } catch {
        await fs.writeFile(CHATS_FILE, '[]');
    }
}

init();

async function read(file) {
    try {
        await init(); // Ensure dir exists before read
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function write(file, data) {
    await init();
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// USERS
async function createUser(userData) {
    const users = await read(USERS_FILE);
    const newUser = {
        id: uuidv4(),
        ...userData,
        friends: [],
        invitesReceived: [],
        invitesSent: []
    };
    users.push(newUser);
    await write(USERS_FILE, users);
    return newUser;
}

async function findUserByName(username) {
    const users = await read(USERS_FILE);
    return users.find(u => u.username === username);
}

async function getUser(id) {
    const users = await read(USERS_FILE);
    return users.find(u => u.id === id);
}

async function sendInvite(fromId, toUsername) {
    const users = await read(USERS_FILE);
    const fromUser = users.find(u => u.id === fromId);
    const toUser = users.find(u => u.username === toUsername);

    if (!toUser) throw new Error('User not found');
    if (fromUser.friends.includes(toUser.id)) throw new Error('Already friends');
    if (toUser.invitesReceived.includes(fromId)) throw new Error('Invite already sent');

    toUser.invitesReceived.push(fromId);
    fromUser.invitesSent.push(toUser.id);

    await write(USERS_FILE, users);
    return { success: true };
}

async function acceptInvite(userId, inviteFromId) {
    const users = await read(USERS_FILE);
    const user = users.find(u => u.id === userId);
    const inviter = users.find(u => u.id === inviteFromId);

    if (!user || !inviter) throw new Error('User not found');

    // Add to friends
    user.friends.push(inviter.id);
    inviter.friends.push(user.id);

    // Remove invites
    user.invitesReceived = user.invitesReceived.filter(id => id !== inviteFromId);
    inviter.invitesSent = inviter.invitesSent.filter(id => id !== userId);

    await write(USERS_FILE, users);
}

// CHATS
async function createChat(name, participantIds) {
    const chats = await read(CHATS_FILE);
    const newChat = {
        id: uuidv4(),
        name,
        participants: participantIds,
        messages: []
    };
    chats.push(newChat);
    await write(CHATS_FILE, chats);
    return newChat;
}

async function getUserChats(userId) {
    const chats = await read(CHATS_FILE);
    return chats.filter(c => c.participants.includes(userId));
}

async function addMessage(chatId, message) {
    const chats = await read(CHATS_FILE);
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.messages.push(message);
        await write(CHATS_FILE, chats);
        return message;
    }
    return null;
}

async function updateChat(chatId, updates) {
    const chats = await read(CHATS_FILE);
    const chatIndex = chats.findIndex(c => c.id === chatId);
    if (chatIndex > -1) {
        chats[chatIndex] = { ...chats[chatIndex], ...updates };
        await write(CHATS_FILE, chats);
        return chats[chatIndex];
    }
    return null;
}

async function deleteChat(chatId) {
    let chats = await read(CHATS_FILE);
    chats = chats.filter(c => c.id !== chatId);
    await write(CHATS_FILE, chats);
}

module.exports = {
    createUser,
    findUserByName,
    getUser,
    sendInvite,
    acceptInvite,
    createChat,
    getUserChats,
    addMessage,
    updateChat,
    deleteChat
};
