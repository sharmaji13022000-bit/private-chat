<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Chat & Call</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; }
    body { background-color: #0b141a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
    #login-box, #chat-box { width: 100%; max-width: 480px; background: #111b21; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.6); }
    #login-box { padding: 25px; display: flex; flex-direction: column; gap: 15px; }
    #chat-box { display: none; height: 95vh; flex-direction: column; position: relative; }
    input, button { padding: 10px 14px; border-radius: 8px; border: none; font-size: 14px; }
    input { background: #2a3942; color: #fff; outline: none; }
    button { background: #00a884; color: #fff; font-weight: bold; cursor: pointer; }
    button:hover { opacity: 0.9; }

    /* Header & Calling Action Buttons */
    #header { padding: 12px 16px; background: #202c33; display: flex; justify-content: space-between; align-items: center; }
    .call-btn-group { display: flex; gap: 8px; }
    .icon-btn { background: #2a3942; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; font-size: 16px; }

    /* Messages & Media Styling */
    #messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
    .msg { max-width: 80%; padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
    .sent { background: #005c4b; align-self: flex-end; }
    .received { background: #202c33; align-self: flex-start; }
    .system { align-self: center; font-size: 11px; color: #8696a0; }
    .msg img, .msg video { max-width: 100%; border-radius: 6px; margin-top: 5px; display: block; }
    .time { font-size: 10px; opacity: 0.6; margin-left: 8px; float: right; margin-top: 4px; }

    /* Input Footer */
    #chat-input-area { display: flex; padding: 10px; background: #202c33; gap: 6px; align-items: center; }
    #msg-input { flex: 1; }

    /* Call Video Overlay */
    #call-overlay { display: none; position: absolute; inset: 0; background: rgba(0,0,0,0.92); z-index: 100; flex-direction: column; justify-content: center; align-items: center; padding: 15px; }
    .video-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; height: 75%; align-items: center; }
    video { width: 100%; max-height: 48%; border-radius: 10px; background: #222; object-fit: cover; }
    #call-controls { margin-top: 15px; display: flex; gap: 15px; }
    .end-btn { background: #ea4335 !important; }
  </style>
</head>
<body>

  <!-- Screen 1: Login -->
  <div id="login-box">
    <h2 style="text-align: center;">Private Room</h2>
    <input type="text" id="username" placeholder="Apna Naam dalein">
    <input type="text" id="room" placeholder="Secret Room Code">
    <button onclick="joinChat()">Chat Shuru Karein</button>
  </div>

  <!-- Screen 2: Chat & Call Dashboard -->
  <div id="chat-box">
    <div id="header">
      <span id="chat-header" style="font-weight: bold;">Room</span>
      <div class="call-btn-group">
        <button class="icon-btn" title="Audio Call" onclick="startCall('audio')">📞</button>
        <button class="icon-btn" title="Video Call" onclick="startCall('video')">📹</button>
      </div>
    </div>

    <div id="messages"></div>

    <form id="chat-input-area" onsubmit="sendMessage(event)">
      <!-- File/Photo Upload -->
      <label class="icon-btn" title="Gallery / Files">
        📁
        <input type="file" id="file-picker" accept="image/*,video/*" style="display: none;" onchange="handleFileUpload(event)">
      </label>
      <!-- Direct Camera Capture -->
      <label class="icon-btn" title="Direct Camera">
        📷
        <input type="file" id="camera-picker" accept="image/*" capture="environment" style="display: none;" onchange="handleFileUpload(event)">
      </label>
      <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
      <button type="submit">Send</button>
    </form>

    <!-- Calling Screen Overlay -->
    <div id="call-overlay">
      <h3 id="call-status" style="margin-bottom: 10px;">Calling...</h3>
      <div class="video-grid">
        <video id="remote-video" autoplay playsinline></video>
        <video id="local-video" autoplay playsinline muted></video>
      </div>
      <div id="call-controls">
        <button class="icon-btn end-btn" onclick="endCall()">❌ Cut Call</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentUsername = "";
    let roomId = "";
    let localStream = null;
    let peerConnection = null;

    const rtcConfig = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    function joinChat() {
      const u = document.getElementById('username').value.trim();
      const r = document.getElementById('room').value.trim();
      if (!u || !r) return alert("Dono details dalein!");

      currentUsername = u;
      roomId = r;
      socket.emit('join-room', { username: u, roomId: r });

      document.getElementById('login-box').style.display = 'none';
      document.getElementById('chat-box').style.display = 'flex';
      document.getElementById('chat-header').innerText = `Room: ${r}`;
    }

    function renderMessage(data) {
      const container = document.getElementById('messages');
      const el = document.createElement('div');
      const isMe = data.sender === currentUsername;
      el.className = `msg ${isMe ? 'sent' : 'received'}`;

      let mediaHtml = '';
      if (data.fileData) {
        if (data.fileType.startsWith('image/')) {
          mediaHtml = `<img src="${data.fileData}" alt="Uploaded image" />`;
        } else if (data.fileType.startsWith('video/')) {
          mediaHtml = `<video controls src="${data.fileData}"></video>`;
        }
      }

      el.innerHTML = `<strong>${isMe ? 'You' : data.sender}:</strong> ${data.text || ''} ${mediaHtml} <span class="time">${data.time}</span>`;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
    }

    function sendMessage(e) {
      e.preventDefault();
      const input = document.getElementById('msg-input');
      const text = input.value.trim();
      if (!text) return;
      socket.emit('send-message', { text });
      input.value = '';
    }

    function handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 25 * 1024 * 1024) {
        alert("File size 25MB se kam honi chahiye!");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        socket.emit('send-message', {
          fileData: reader.result,
          fileType: file.type,
          text: `[Attachment: ${file.name || 'File'}]`
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }

    // WebRTC Audio/Video Call Functions
    async function startCall(callType) {
      document.getElementById('call-overlay').style.display = 'flex';
      document.getElementById('call-status').innerText = `${callType === 'video' ? 'Video' : 'Audio'} Call Lag Rahi Hai...`;

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
        });
        document.getElementById('local-video').srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
          document.getElementById('remote-video').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('call-user', { signalData: event.candidate, callType });
          }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call-user', { signalData: offer, callType });

      } catch (err) {
        alert("Camera ya Microphone permission allow karein!");
        endCall();
      }
    }

    socket.on('incoming-call', async (data) => {
      if (data.signal && data.signal.type === 'offer') {
        const accept = confirm(`${data.from} se ${data.callType} call aa rahi hai. Accept karein?`);
        if (!accept) {
          socket.emit('end-call');
          return;
        }

        document.getElementById('call-overlay').style.display = 'flex';
        document.getElementById('call-status').innerText = `Connected with ${data.from}`;

        localStream = await navigator.mediaDevices.getUserMedia({
          video: data.callType === 'video',
          audio: true
        });
        document.getElementById('local-video').srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
          document.getElementById('remote-video').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('answer-call', { signal: event.candidate });
          }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer-call', { signal: answer });
      } else if (data.signal && data.signal.candidate) {
        if (peerConnection) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
          } catch(e) {}
        }
      }
    });

    socket.on('call-accepted', async (signal) => {
      document.getElementById('call-status').innerText = "Call Connected";
      if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
        } catch(e) {}
      }
    });

    socket.on('call-ended', () => {
      endCall(false);
    });

    function endCall(notify = true) {
      if (notify) socket.emit('end-call');
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      document.getElementById('call-overlay').style.display = 'none';
    }

    // Socket message listeners
    socket.on('load-history', (history) => {
      document.getElementById('messages').innerHTML = '';
      history.forEach(msg => renderMessage(msg));
    });

    socket.on('receive-message', (data) => renderMessage(data));

    socket.on('system-message', (msg) => {
      const container = document.getElementById('messages');
      const el = document.createElement('div');
      el.className = 'system';
      el.innerText = msg;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
    });
  </script>
</body>
</html>
