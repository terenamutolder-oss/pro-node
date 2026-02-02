const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs'); // SECURE
const storage = require('./storage');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// Auth
app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await storage.findUserByName(username);
    if (user) return res.status(409).json({ error: 'Passcode or username already used' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await storage.createUser({ username, password: hashedPassword });
    res.json({ user: newUser });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.findUserByName(username);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Compare hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ user });
});

// Users/Friends
app.post('/api/friends/invite', async (req, res) => {
    const { fromId, toUsername } = req.body;
    try {
        const result = await storage.sendInvite(fromId, toUsername);
        res.json(result);

        // Notify recipient if connected
        const recipient = await storage.findUserByName(toUsername);
        if (recipient) {
            io.to(recipient.id).emit('notification', { type: 'invite', from: fromId });
        }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/friends/accept', async (req, res) => {
    const { userId, inviteFromId } = req.body;
    try {
        await storage.acceptInvite(userId, inviteFromId);
        res.json({ success: true });

        // Notify sender
        io.to(inviteFromId).emit('notification', { type: 'invite_accepted', from: userId });
        io.to(inviteFromId).emit('friend_accepted', { friendId: userId });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// Chats
app.get('/api/chats', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const chats = await storage.getUserChats(userId);
    res.json(chats);
});

app.post('/api/chats', async (req, res) => {
    const { name, participants } = req.body;
    const chat = await storage.createChat(name, participants);

    participants.forEach(pId => {
        io.to(pId).emit('chat_new', chat);
    });

    res.json(chat);
});

app.put('/api/chats/:id/rename', async (req, res) => {
    const { name } = req.body;
    const chat = await storage.updateChat(req.params.id, { name });
    io.to(req.params.id).emit('chat_updated', chat);
    res.json(chat);
});

app.delete('/api/chats/:id', async (req, res) => {
    await storage.deleteChat(req.params.id);
    io.to(req.params.id).emit('chat_deleted', { chatId: req.params.id });
    res.json({ success: true });
});

// --- SOCKET.IO ---

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins their own room for direct alerts (calls/invites)
    socket.on('join_user', (userId) => {
        socket.join(userId);
        console.log(`Socket ${socket.id} joined user room ${userId}`);
    });

    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
    });

    socket.on('send_message', async (data) => {
        const msg = await storage.addMessage(data.chatId, {
            senderId: data.senderId,
            content: data.content,
            type: data.type || 'text',
            timestamp: new Date().toISOString()
        });

        io.to(data.chatId).emit('message', msg);
    });

    // --- CALLING LOGIC ---
    socket.on('call_start', (data) => {
        // data: { fromId, fromName, toId (user or chat?) }
        // Simple 1-on-1 logic for now based on user request "calling a person"
        if (data.toId) {
            console.log(`Call from ${data.fromName} to ${data.toId}`);
            // Emit to the specific user
            io.to(data.toId).emit('call_incoming', {
                fromId: data.fromId,
                fromName: data.fromName,
                callId: uuidv4() // Unique call session ID
            });
        }
    });

    socket.on('call_group_start', (data) => {
        // data: { fromId, fromName, chatId }
        socket.to(data.chatId).emit('call_incoming', {
            fromId: data.fromId,
            fromName: data.fromName,
            isGroup: true,
            chatId: data.chatId,
            callId: uuidv4()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;

if (process.env.VERCEL) {
    // Vercel serverless function entry point
    module.exports = app;
} else {
    // Local development entry point
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
