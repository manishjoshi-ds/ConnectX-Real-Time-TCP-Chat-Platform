(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("tcpchat_theme", theme);
    if (themeToggle) {
      themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }
  }

  applyTheme(localStorage.getItem("tcpchat_theme") || "light");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      applyTheme(root.classList.contains("dark") ? "light" : "dark");
    });
  }

  const joinForm = document.getElementById("joinForm");
  if (!joinForm || typeof io === "undefined") return;

  const socket = io({ transports: ["polling", "websocket"] });

  let currentUser = "";
  let authToken = "";
  let activeConvId = "public";
  let replyToId = null;
  let conversations = [];
  let directory = [];
  const messagesByConv = {};

  const loginView = document.getElementById("loginView");
  const chatView = document.getElementById("chatView");
  const usernameInput = document.getElementById("usernameInput");
  const loginError = document.getElementById("loginError");
  const currentUsernameEl = document.getElementById("currentUsername");
  const onlineCountEl = document.getElementById("onlineCount");
  const channelsListEl = document.getElementById("channelsList");
  const usersListEl = document.getElementById("usersList");
  const messagesContainer = document.getElementById("messagesContainer");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const chatError = document.getElementById("chatError");
  const roomHeading = document.getElementById("roomHeading");
  const roomSubheading = document.getElementById("roomSubheading");
  const connectionStatus = document.getElementById("connectionStatus");
  const logoutBtn = document.getElementById("logoutBtn");
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadBar = document.getElementById("uploadBar");
  const uploadLabel = document.getElementById("uploadLabel");
  const uploadProgress = document.getElementById("uploadProgress");
  const replyBar = document.getElementById("replyBar");
  const replyLabel = document.getElementById("replyLabel");
  const cancelReplyBtn = document.getElementById("cancelReplyBtn");
  const searchInput = document.getElementById("searchInput");
  const newGroupBtn = document.getElementById("newGroupBtn");

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function selectConversation(convId) {
    activeConvId = convId;
    const conv = conversations.find((c) => c.id === convId);
    roomHeading.textContent = conv ? conv.name : "Common Chat Room";
    roomSubheading.textContent = conv && conv.type === "private" ? "Private 1-to-1 TCP Chat" : "Real-time Socket.IO Channel";
    if (!messagesByConv[convId] && authToken) {
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}/messages`, {
        headers: { "x-auth-token": authToken },
      });
      if (res.ok) {
        const json = await res.json();
        messagesByConv[convId] = json.messages || [];
      }
    }
    socket.emit("mark_read", { conversationId: convId });
    renderSidebar();
    renderMessages();
  }

  function renderSidebar() {
    channelsListEl.textContent = "";
    usersListEl.textContent = "";
    const onlineUsers = directory.filter((u) => u.isOnline);
    onlineCountEl.textContent = String(onlineUsers.length);

    conversations
      .filter((c) => c.type === "public" || c.type === "group")
      .forEach((conv) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "user-item" + (activeConvId === conv.id ? " active" : "");
        btn.textContent = (conv.type === "public" ? "# " : "Group: ") + conv.name;
        btn.addEventListener("click", () => selectConversation(conv.id));
        li.appendChild(btn);
        channelsListEl.appendChild(li);
      });

    directory
      .filter((u) => u.username !== currentUser)
      .forEach((u) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "user-item";
        btn.textContent = `${u.displayName || u.username} (${u.isOnline ? "Online" : "Offline"})`;
        btn.addEventListener("click", () => socket.emit("open_dm", { targetUsername: u.username }));
        li.appendChild(btn);
        usersListEl.appendChild(li);
      });
  }

  function renderMessages(overrideList) {
    messagesContainer.textContent = "";
    const list = overrideList || messagesByConv[activeConvId] || [];

    list.forEach((msg) => {
      const card = document.createElement("div");
      card.className = "message-card";
      if (msg.type === "system") {
        card.classList.add("system");
        card.textContent = `${msg.text} · ${msg.timestamp}`;
        messagesContainer.appendChild(card);
        return;
      }

      if (msg.sender === currentUser) card.classList.add("own");

      const meta = document.createElement("div");
      meta.className = "message-meta";
      const s = document.createElement("strong");
      s.textContent = msg.sender === currentUser ? "You" : msg.senderDisplayName || msg.sender;
      const t = document.createElement("span");
      t.textContent = `${msg.edited ? "(edited) " : ""}${msg.timestamp}`;
      meta.appendChild(s);
      meta.appendChild(t);
      card.appendChild(meta);

      if (msg.replyTo) {
        const rep = document.createElement("div");
        rep.style.fontSize = "0.75rem";
        rep.style.opacity = "0.85";
        rep.textContent = `Replying to ${msg.replyTo.sender}: ${msg.replyTo.text}`;
        card.appendChild(rep);
      }

      if (msg.text) {
        const body = document.createElement("p");
        body.textContent = msg.text;
        card.appendChild(body);
      }

      if (msg.media && !msg.deleted) {
        const tokenParam = `token=${encodeURIComponent(authToken)}`;
        if (msg.media.mediaType === "image") {
          const img = document.createElement("img");
          img.className = "media-img";
          img.src = `${msg.media.url}?${tokenParam}`;
          img.alt = msg.media.originalFilename;
          card.appendChild(img);
        }
        const dl = document.createElement("a");
        dl.className = "media-link";
        dl.href = `${msg.media.downloadUrl}&${tokenParam}`;
        dl.textContent = `Download ${msg.media.originalFilename}`;
        card.appendChild(dl);
      }

      if (!msg.deleted) {
        const actions = document.createElement("div");
        actions.className = "message-actions";
        const rBtn = document.createElement("button");
        rBtn.type = "button";
        rBtn.textContent = "Reply";
        rBtn.addEventListener("click", () => {
          replyToId = msg.id;
          replyLabel.textContent = `Replying to ${msg.sender}: ${msg.text || "attachment"}`;
          replyBar.hidden = false;
        });
        actions.appendChild(rBtn);

        const reactBtn = document.createElement("button");
        reactBtn.type = "button";
        reactBtn.textContent = "👍";
        reactBtn.addEventListener("click", () => socket.emit("toggle_reaction", { messageId: msg.id, emoji: "👍" }));
        actions.appendChild(reactBtn);

        if (msg.sender === currentUser) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.textContent = "Delete";
          delBtn.addEventListener("click", () => socket.emit("delete_message", { messageId: msg.id }));
          actions.appendChild(delBtn);
        }
        card.appendChild(actions);
      }

      if (msg.reactions && msg.reactions.length > 0) {
        const reactRow = document.createElement("div");
        reactRow.style.fontSize = "0.75rem";
        reactRow.textContent = msg.reactions.map((r) => `${r.emoji} ${r.users.length}`).join("  ");
        card.appendChild(reactRow);
      }

      messagesContainer.appendChild(card);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = usernameInput.value.trim();
    if (!raw) {
      showError(loginError, "Please enter a username.");
      return;
    }
    showError(loginError, "");
    socket.emit("join_chat", { username: raw });
  });

  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) {
      showError(chatError, "Cannot send an empty message.");
      return;
    }
    showError(chatError, "");
    socket.emit("send_message", { conversationId: activeConvId, text, replyToId });
    messageInput.value = "";
    replyToId = null;
    replyBar.hidden = true;
  });

  cancelReplyBtn.addEventListener("click", () => {
    replyToId = null;
    replyBar.hidden = true;
  });

  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file || !authToken) return;
    const xhr = new XMLHttpRequest();
    uploadBar.hidden = false;
    uploadLabel.textContent = `Uploading ${file.name}...`;
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) uploadProgress.value = Math.round((ev.loaded / ev.total) * 100);
    };
    xhr.onload = () => {
      uploadBar.hidden = true;
      fileInput.value = "";
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.media) {
          socket.emit("send_message", {
            conversationId: activeConvId,
            text: messageInput.value.trim(),
            mediaId: data.media.id,
            replyToId,
          });
          messageInput.value = "";
          replyToId = null;
          replyBar.hidden = true;
        } else {
          showError(chatError, data.error || "Upload failed.");
        }
      } catch {
        showError(chatError, "Invalid upload response.");
      }
    };
    const form = new FormData();
    form.append("file", file);
    form.append("conversationId", activeConvId);
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("x-auth-token", authToken);
    xhr.send(form);
  });

  newGroupBtn.addEventListener("click", () => {
    const name = window.prompt("Enter new group name:");
    if (name && name.trim().length >= 2) {
      socket.emit("create_group", { name: name.trim(), memberUsernames: [] });
    }
  });

  searchInput.addEventListener("input", async () => {
    const q = searchInput.value.trim();
    if (!q) {
      renderMessages();
      return;
    }
    const res = await fetch(`/api/conversations/${encodeURIComponent(activeConvId)}/search?q=${encodeURIComponent(q)}`, {
      headers: { "x-auth-token": authToken },
    });
    if (res.ok) {
      const json = await res.json();
      renderMessages(json.results || []);
    }
  });

  logoutBtn.addEventListener("click", () => socket.emit("logout"));

  socket.on("connect", () => { connectionStatus.textContent = "Connected · WebSocket/TCP"; });
  socket.on("disconnect", () => { connectionStatus.textContent = "Disconnected · Reconnecting..."; });
  socket.on("join_error", (d) => showError(loginError, d.message || "Join failed."));

  socket.on("join_success", (data) => {
    currentUser = data.username;
    authToken = data.authToken;
    currentUsernameEl.textContent = currentUser;
    directory = data.directory || [];
    conversations = data.conversations || [];
    activeConvId = data.activeConversationId || "public";
    messagesByConv[activeConvId] = data.history || [];
    loginView.hidden = true;
    chatView.hidden = false;
    renderSidebar();
    renderMessages();
  });

  socket.on("users_update", (data) => {
    directory = data.directory || [];
    renderSidebar();
  });

  socket.on("dm_opened", (data) => {
    if (!data.conversation) return;
    if (!conversations.some((c) => c.id === data.conversation.id)) {
      conversations.unshift(data.conversation);
    }
    messagesByConv[data.conversation.id] = data.messages || [];
    selectConversation(data.conversation.id);
  });

  socket.on("conversation_updated", (data) => {
    if (!data.conversation) return;
    const idx = conversations.findIndex((c) => c.id === data.conversation.id);
    if (idx >= 0) conversations[idx] = data.conversation;
    else conversations.unshift(data.conversation);
    renderSidebar();
  });

  socket.on("new_message", (data) => {
    const msg = data.message;
    if (!msg) return;
    if (!messagesByConv[msg.conversationId]) messagesByConv[msg.conversationId] = [];
    if (!messagesByConv[msg.conversationId].some((m) => m.id === msg.id)) {
      messagesByConv[msg.conversationId].push(msg);
    }
    if (msg.conversationId === activeConvId) renderMessages();
  });

  socket.on("message_updated", (data) => {
    const msg = data.message;
    if (!msg || !messagesByConv[msg.conversationId]) return;
    messagesByConv[msg.conversationId] = messagesByConv[msg.conversationId].map((m) =>
      m.id === msg.id ? msg : m,
    );
    if (msg.conversationId === activeConvId) renderMessages();
  });

  socket.on("chat_error", (d) => showError(chatError, d.message || "Error."));
  socket.on("logged_out", () => {
    currentUser = "";
    authToken = "";
    chatView.hidden = true;
    loginView.hidden = false;
    usernameInput.value = "";
  });
})();
