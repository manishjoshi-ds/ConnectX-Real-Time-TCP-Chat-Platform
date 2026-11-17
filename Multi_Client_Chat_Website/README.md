# Multi-Client Chat Application Using TCP

A modern, real-time multi-client communication platform built with **Flask**, **Flask-SocketIO**, **SQLite**, and **HTML5/CSS3/JavaScript** over **WebSocket / TCP**.

## Features

- **Real-Time Multi-Client Communication**: Public room, 1-to-1 private direct messages, and multi-member group chats.
- **SQLite Database Persistence**: Stores `users`, `conversations`, `conversation_members`, `messages`, `media_files`, and `message_reactions` inside `data/tcpchat.db`.
- **HTTP Multipart Media Sharing**: Upload and download images (JPG, PNG, WEBP), videos (MP4, WEBM), documents (PDF, DOC/DOCX, TXT, PPT/PPTX, XLS/XLSX), and audio files (MP3, WAV, OGG, M4A) with strict extension, MIME, and file-size validation.
- **Messaging Features**: Typing indicators, delivery & read receipts, reply quotes, edit/delete messages, emoji reactions, keyword search, Media Gallery, File Manager, and custom chat themes.
- **User Profiles & Groups**: Display names, bios, presence status, profile/group avatar uploads, and admin-controlled group participant management.

## Installation & Running Locally

```bash
cd Multi_Client_Chat_Website
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` in multiple browser tabs or windows (`Rahul`, `Aman`, `Priya`) to test concurrent messaging, media uploads, private DMs, and group chats.
