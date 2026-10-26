# Real-Time Chat & Team Collaboration App

A college project MVP for real-time team communication and collaboration, built with **React 18 + Vite**, **Node.js + Express**, and **Socket.IO**.

---

## 🚀 Key Features

- **Authentication & Security**:
  - User registration and login.
  - Password hashing with `bcryptjs`.
  - Stateless session authorization with `jsonwebtoken` (JWT).
  - Server-side conversation membership authorization.
  - Ownership enforcement: users may edit or delete **only their own messages**.
- **Real-Time Communication (Socket.IO)**:
  - Authenticated WebSocket handshakes with JWT.
  - Live conversation rooms for instant message delivery without polling.
  - Real-time online/offline presence tracking across browser sessions.
  - Dynamic live typing indicators with debounced timeouts.
  - Real-time unread message counters updated dynamically across clients.
- **Messaging & Channels**:
  - One-to-one direct conversations.
  - Group collaboration channels with member management (add/remove members, admin roles).
  - Message editing with `(edited)` indicator tags.
  - Message deletion with placeholder tombstones.
- **Evaluation 1 In-Memory Storage**:
  - In-memory data store (`backend/src/storage/memoryStore.js`).
  - Decoupled Repository Pattern (`userRepository`, `conversationRepository`, `messageRepository`) enabling seamless transition to MongoDB/Mongoose in Evaluation 2.

---

## 📁 Project Structure

```
Chat app/
├── backend/
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── config/              # Environment & JWT configuration
│       ├── controllers/         # Auth, User, Conversation & Message controllers
│       ├── middleware/          # JWT auth & Socket.IO auth middleware
│       ├── repositories/        # Data access layer (User, Conv, Message)
│       ├── routes/              # Express API routers
│       ├── sockets/             # Socket.IO connection & event handlers
│       ├── storage/             # In-memory store & demo seed data
│       └── server.js            # Express app + HTTP server + Socket.IO boot
├── frontend/
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/                 # Fetch client with auto JWT injection
│       ├── components/
│       │   ├── auth/            # Sign in / Register screen + Demo buttons
│       │   ├── chat/            # ChatArea, MessageBubble, TypingIndicator
│       │   ├── layout/          # Navbar, user chip, connection status
│       │   ├── modals/          # NewChatModal, NewGroupModal, GroupDetailsModal, EditMessageModal
│       │   └── sidebar/         # Search, filters, conversation list, unread badges
│       ├── context/             # AuthContext, SocketContext, ChatContext
│       ├── index.css            # Responsive styles and design system
│       ├── App.jsx              # Main responsive workspace
│       └── main.jsx             # React 18 root
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js**: v18+ (tested on Node.js `v24.4.0`)
- **npm**: v9+ (tested on npm `11.4.2`)

---

## ⚙️ Setup & Installation

### Option 1: Root Convenient Script
```bash
# In the project root:
npm run install:all
```

### Option 2: Individual Folders
```bash
# Terminal 1 - Backend:
cd backend
npm install

# Terminal 2 - Frontend:
cd frontend
npm install
```

---

## 🏃 Running the Application

### 1. Start the Backend Server
```bash
cd backend
npm start
```
*Backend will start on port `5000` (`http://localhost:5000`). It automatically seeds 3 demo users.*

### 2. Start the Frontend Dev Server
Open a second terminal window:
```bash
cd frontend
npm run dev
```
*Frontend will start on `http://localhost:5173`.*

---

## 👥 Demo Accounts for Quick Evaluation

You can register any new account, or click the one-click demo login buttons on the sign-in screen:

| Name | Email | Username | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Alice Johnson** | `alice@example.com` | `alice` | `password123` | Project Admin |
| **Bob Smith** | `bob@example.com` | `bob` | `password123` | Team Member |
| **Charlie Davis** | `charlie@example.com` | `charlie` | `password123` | Team Member |

---

## 🧪 Evaluation Test Walkthrough

1. **Test 1-on-1 Real-Time Chat & Presence**:
   - Open Chrome at `http://localhost:5173` and log in as **Alice**.
   - Open an Incognito window (or second browser) at `http://localhost:5173` and log in as **Bob**.
   - Observe both Alice and Bob's presence indicator show **Online** (green dot).
   - Alice clicks the direct chat with Bob. Type a message — notice Bob receives it instantly via Socket.IO.
   - When Bob is typing, Alice sees **"Bob is typing..."** in real time.
2. **Test Unread Counters**:
   - Have Alice send a message to a group or chat that Bob does not currently have open.
   - Notice the purple unread count badge increment on Bob's sidebar.
   - When Bob selects the conversation, the unread count automatically resets to zero.
3. **Test Message Editing & Deletion**:
   - Hover over your own sent message. Click the `⋮` action menu.
   - Select **Edit**: change the text and save. Notice the message updates on both screens with an `(edited)` tag.
   - Select **Delete**: confirm deletion. Notice the text changes to *"This message was deleted"* on both screens.
   - Try to edit someone else's message: the option is not available, and any direct API attempt is rejected with HTTP 403.
4. **Test Group Channels & Member Management**:
   - Click **"New Group"** in the top bar.
   - Enter a name (e.g. *"Frontend Engineers"*) and select members.
   - Open **"Group Info"** to add members, change group title, or leave the channel.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Log in and receive JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |
| `GET` | `/api/users` | List/search registered users (`?q=`) | Yes |
| `GET` | `/api/conversations` | List user's conversations with unread counts | Yes |
| `POST` | `/api/conversations/direct` | Create/retrieve 1-on-1 direct conversation | Yes |
| `POST` | `/api/conversations/group` | Create new group conversation | Yes |
| `GET` | `/api/conversations/:id` | Fetch conversation details & participants | Yes |
| `PUT` | `/api/conversations/:id` | Update group name/description | Yes |
| `POST` | `/api/conversations/:id/members` | Add member to group | Yes |
| `DELETE` | `/api/conversations/:id/members/:userId` | Remove member or leave group | Yes |
| `POST` | `/api/conversations/:id/read` | Mark conversation as read | Yes |
| `GET` | `/api/conversations/:id/messages` | Get message history | Yes |
| `POST` | `/api/conversations/:id/messages` | Send message to conversation | Yes |
| `PUT` | `/api/messages/:id` | Edit own message | Yes |
| `DELETE` | `/api/messages/:id` | Delete own message | Yes |

---

## 🔄 Transitioning to Evaluation 2 (MongoDB)

All data storage is isolated in `backend/src/repositories/`. The controllers and Socket.IO handlers interact solely with the repository interfaces (`userRepository`, `conversationRepository`, `messageRepository`). To switch to MongoDB in Evaluation 2:
1. Connect Mongoose in `backend/src/server.js`.
2. Implement Mongoose models matching the data contracts.
3. Replace the methods inside `repositories/*.js` with Mongoose queries.
The controllers, routes, Socket.IO handlers, and frontend require zero modifications.
