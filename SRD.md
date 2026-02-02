# Software Requirements Specification (SRD) - ProNode

## 1. System Architecture
-   **Frontend**: Vanilla HTML, CSS, JavaScript.
-   **Backend**: Node.js with Express.
-   **Database**: JSON file-based or SQLite (for simplicity and portability without external deps) or In-memory for initial prototype if requested. *Decision: JSON file system for persistence for now.*
-   **Real-time Communication**: Socket.io.

## 2. API Endpoints (Draft)

### Authentication
-   `POST /api/auth/signup`: Create new user.
-   `POST /api/auth/login`: Authenticate user.

### Users & Friends
-   `GET /api/users/me`: Get current user info.
-   `POST /api/friends/invite`: Send friend request.
-   `POST /api/friends/accept`: Accept friend request.
-   `GET /api/friends`: List friends.

### Chats
-   `POST /api/chats`: Create new chat.
-   `GET /api/chats`: List user's chats.
-   `GET /api/chats/:id`: Get chat details and messages.
-   `PUT /api/chats/:id`: Rename chat.
-   `DELETE /api/chats/:id`: Delete chat.

## 3. Data Models

### User
```json
{
  "id": "uuid",
  "username": "string",
  "password": "hashed_string",
  "friends": ["user_id"],
  "invites_received": ["user_id"],
  "invites_sent": ["user_id"]
}
```

### Chat
```json
{
  "id": "uuid",
  "name": "string",
  "participants": ["user_id"],
  "messages": [
    {
      "senderId": "user_id",
      "content": "string",
      "type": "text|audio",
      "timestamp": "iso_string"
    }
  ]
}
```

## 4. Technical Constraints
-   OS: Windows.
-   Environment: Node.js.
-   No external database service requirement (using local file storage).
