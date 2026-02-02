# Product Requirements Document (PRD) - ProNode

## 1. Introduction
ProNode is a web-based chat application designed for seamless communication. It features user authentication, real-time messaging, group chats, and friend management with a visually appealing interface.

## 2. User Flows

### 2.1 Authentication
-   **Initial Screen**: Prompts user to "Log In" or "Sign In".
-   **Sign In (New User)**:
    -   Display "Are you new to FlipIt? Sign In" (Note: User mentioned "FlipIt", likely a typo from previous context, will use "ProNode" or keep generic).
    -   Input: Username and Password.
    -   Validation: Check if username is already taken.
        -   If yes: Show "Passcode or username already used".
        -   If no: Create account and redirect to Home Screen.
-   **Log In (Existing User)**:
    -   Input: Username and Password.
    -   Validation: Check credentials.
        -   If correct: Redirect to Home Screen.

### 2.2 Home Page
-   **Notifications**:
    -   Button to view pending messages/invites.
    -   Shows who sent messages and content.
-   **Chats List**:
    -   Displays active chats.
    -   **Context Menu (3 dots ...)**:
        -   **Rename**: Change chat name.
        -   **Delete Chat**: Remove the chat.
        -   **See People**:
            -   Lists participants.
            -   Actions per participant: Call (📞) and Message (✉) individually.

### 2.3 Create Chat
-   **Button**: Create Chat (📮).
-   **Flow**:
    1.  Click "People Inside" to select friends.
    2.  Click "Name of Chat" to set title.
    3.  Click "Create Chat" to finalize.

### 2.4 Chat Interface
-   **Top Bar**: Back button (to Home), Call button (☎).
-   **Message Area**: Displays messages.
-   **Input Area**:
    -   Text input field.
    -   Send button (📤).
    -   Voice button (🎤) - press to record, release to send.

### 2.5 Friends Management
-   **Location**: Settings -> Friend Invitation (📜).
-   **Action**: Enter friend's username to send invite.
-   **Acceptance**: Receiver accepts via Notifications to add to friends list.

## 3. UI/UX Requirements
-   **Theme**: Modern, premium feel. Vibrant colors, glassmorphism, or dark mode.
-   **Icons**: standard phone/mail/send/mic icons as specified.
