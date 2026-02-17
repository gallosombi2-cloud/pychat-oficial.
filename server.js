const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- LÓGICA DEL SERVIDOR ---
let estadosGlobales = []; 

io.on('connection', (socket) => {
    socket.emit('cargar_estados', estadosGlobales);

    socket.on('nuevo_usuario', (user) => {
        socket.broadcast.emit('mensaje_recibido', { texto: `${user.nombre} se unió al chat`, tipo: 'sistema' });
    });

    socket.on('subir_estado', (estado) => {
        const nuevoEstado = { ...estado, id: Date.now() };
        estadosGlobales.unshift(nuevoEstado);
        if(estadosGlobales.length > 20) estadosGlobales.pop();
        io.emit('nuevo_estado_recibido', nuevoEstado);
    });

    socket.on('mensaje_enviado', (data) => {
        socket.broadcast.emit('mensaje_recibido', data);
    });

    socket.on('solicitar_limpieza', (pass) => {
        if(pass === "1234") {
            estadosGlobales = [];
            io.emit('limpiar_pantalla_global');
        }
    });

    socket.on('escribiendo', (n) => socket.broadcast.emit('usuario_escribiendo', n));
    socket.on('dejo_de_escribir', () => socket.broadcast.emit('usuario_paró'));
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Pro Max</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --py-dark: #075E54; --bg-chat: #efeae2; }
        body { margin: 0; font-family: sans-serif; background: #f0f2f5; overflow: hidden; display: flex; flex-direction: column; height: 100vh; }
        
        .header { background: var(--py-green); color: white; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; z-index: 100; height: 55px; flex-shrink: 0; }
        .header h1 { font-size: 20px; margin: 0; }
        .config-btn { background: rgba(255,255,255,0.1); border-radius: 50%; padding: 8px; cursor: pointer; display: flex; }

        .status-bar { background: white; padding: 10px; display: flex; gap: 15px; overflow-x: auto; border-bottom: 1px solid #e9edef; min-height: 95px; align-items: center; flex-shrink: 0; }
        .status-item { flex-shrink: 0; text-align: center; width: 65px; }
        .status-circle { width: 58px; height: 58px; border-radius: 50%; border: 2.5px solid #25D366; display: flex; align-items: center; justify-content: center; background: #f0f2f5; overflow: hidden; cursor: pointer; }
        .status-circle img { width: 100%; height: 100%; object-fit: cover; }
        .status-name { font-size: 11px; margin-top: 5px; color: #54656f; }

        #chat { flex-grow: 1; background: var(--bg-chat); background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); padding: 15px; overflow-y: auto; display: flex; flex-direction: column; }
        .mensaje { max-width: 85%; padding: 8px 12px; margin-bottom: 6px; border-radius: 8px; font-size: 14.5px; box-shadow: 0 1px 1px rgba(0,0,0,0.1); position: relative; }
        .enviado { align-self: flex-end; background: #d9fdd3; }
        .recibido { align-self: flex-start; background: white; }
        .sistema { align-self: center; background: #fff3cd; font-size: 11px; padding: 5px 10px; border-radius: 5px; margin: 10px 0; }
        .msg-time { font-size: 10px; color: #667781; float: right; margin-top: 5px; margin-left: 8px; }
        .chat-img { max-width: 100%; border-radius: 8px; margin-top: 5px; }

        .input-area { background: #f0f2f5; padding: 10px; display: flex; gap: 8px; align-items: center; }
        input { flex: 1; border: none; padding: 12px 15px; border-radius: 25px; outline: none; font-size: 15px; }
        .btn-act { background: var(--py-green); color: white; border: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; flex-shrink: 0; }
        .btn-clip { background: none; color: #54656f; font-size: 24px; border: none; cursor: pointer; }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 500; backdrop-filter: blur(4px); }
        .card { background: white; padding: 25px; border-radius: 20px; width: 80%; max-width: 300px; text-align: center; }
    </style>
</head>
<body>
    <audio id="sonido" src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"></audio>

    <div id="login-screen" style="position:fixed; inset:0; background:var(--py-green); z-index:1000; display:flex; align-items:center; justify-content:center;">
        <div class="card">
            <h2 style="color:var(--py-green)">PyChat Pro</h2>
            <input type="text" id="nom" placeholder="Tu Nombre..." style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ddd; border-radius:10px; box-sizing:border-box;">
            <button onclick="registrar()" style="width:100%; background:var(--py-green); color:white; padding:12px; border:none; border-radius:10px; font-weight:bold;">ENTRAR</button>
        </div>
    </div>

    <div id="admin-panel" class="overlay">
        <div class="card">
            <h3>⚙️ Configuración</h3>
            <input type="password" id="admin-pass" placeholder="Clave Maestra" style="width:100%; padding:10px; margin-bottom:10px; border:1px solid #ddd; border-radius:5px; box-sizing:border-box;">
            <button onclick="ejecutarLimpieza()" style="width:100%; background:#ea0038; color:white; padding:10px; border:none; border-radius:5px;">LIMPIAR TODO</button>
            <button onclick="document.getElementById('admin-panel').style.display='none'" style="margin-top:10px; background:none; border:none; color:gray;">Cancelar</button>
        </div>
    </div>

    <div id="status-menu" class="overlay" onclick="this.style.display='none'">
        <div style="display:flex; gap:20px;">
            <button class="btn-act" style="width:70px; height:70px;" onclick="document.getElementById('file-status').click()">📷</button>
            <button class="btn-act" style="width:70px; height:70px; background:#9C27B0;" onclick="crearEstadoTexto()">✍️</button>
        </div>
    </div>

    <div id="status-viewer" class="overlay" onclick="this.style.display='none'">
        <div id="viewer-content" style="color:white; font-size:28px; text-align:center; padding:30px;"></div>
    </div>

    <div class="header">
        <h1>PyChat Pro</h1>
        <div class="config-btn" onclick="document.getElementById('admin-panel').style.display='flex'">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7-3.29c.04-.4.06-.8.06-1.21s-.02-.81-.06-1.21l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 13.5 2h-3c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.4-.06.8-.06 1.21s.02.81.06 1.21l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h3c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z"></path></svg>
        </div>
    </div>

    <div class="status-bar" id="status-bar">
        <div class="status-item" onclick="document.getElementById('status-menu').style.display='flex'">
            <div class="status-circle" style="border:2.5px dashed #bbb; color:#999; font-size:24px;">+</div>
            <div class="status-name">Tú</div>
        </div>
    </div>

    <input type="file" id="file-status" hidden accept="image/*" onchange="subirEstado(this)">
    <input type="file" id="file-chat" hidden accept="image/*" onchange="enviarFotoChat(this)">

    <div id="chat"></div>
    <div id="writing-notif" style="font-size:10px; color:gray; padding-left:15px; height:15px; background:var(--bg-chat);"></div>

    <div class="input-area">
        <button class="btn-clip" onclick="document.getElementById('file-chat').click()">📎</button>
        <input id="msg" type="text" placeholder="Escribe un mensaje..." onkeypress="tecleando()">
        <button id="btn-mic" class="btn-act" onclick="toggleAudio()">🎤</button>
        <button class="btn-act" onclick="enviar()">➤</button>
    </div>

    <script>
        const socket = io();
        let miUser = { nombre: '' };
        let mediaRecorder, audioChunks = [], isRecording = false;

        function registrar() {
            const n = document.getElementById('nom').value;
            if(!n) return;
            miUser.nombre = n;
            localStorage.setItem('p_n', n);
            document.getElementById('login-screen').style.display = 'none';
            socket.emit('nuevo_usuario', miUser);
            if ("Notification" in window) Notification.requestPermission();
        }

        window.onload = () => {
            const n = localStorage.getItem('p_n');
            if(n) { 
                miUser.nombre = n; 
                document.getElementById('login-screen').style.display = 'none';
                socket.emit('nuevo_usuario', miUser);
            }
        };

        function ejecutarLimpieza() {
            socket.emit('solicitar_limpieza', document.getElementById('admin-pass').value);
        }
        socket.on('limpiar_pantalla_global', () => { location.reload(); });

        // ESTADOS
        function subirEstado(input) {
            const reader = new FileReader();
            reader.onload = () => socket.emit('subir_estado', { n: miUser.nombre, img: reader.result, tipo: 'img' });
            if(input.files[0]) reader.readAsDataURL(input.files[0]);
        }
        function crearEstadoTexto() {
            const txt = prompt("¿Qué quieres publicar?");
            if(!txt) return;
            const colores = ['#9C27B0', '#E91E63', '#2196F3', '#FF9800', '#4CAF50'];
            socket.emit('subir_estado', { n: miUser.nombre, texto: txt, fondo: colores[Math.floor(Math.random()*5)], tipo: 'txt' });
        }
        socket.on('cargar_estados', (ests) => ests.forEach(e => addEstado(e)));
        socket.on('nuevo_estado_recibido', (e) => addEstado(e));

        function addEstado(e) {
            const bar = document.getElementById('status-bar');
            const div = document.createElement('div');
            div.className = 'status-item';
            let content = e.tipo === 'txt' ? \`<div style="font-size:7px; padding:5px;">\${e.texto}</div>\` : \`<img src="\${e.img}">\`;
            let style = e.tipo === 'txt' ? \`background:\${e.fondo}; border:none; color:white;\` : '';
            div.innerHTML = \`<div class="status-circle" style="\${style}" onclick="verEstado('\${e.tipo}', '\${e.texto||''}', '\${e.img||''}', '\${e.fondo||''}')">\${content}</div><div class="status-name">\${e.n}</div>\`;
            bar.appendChild(div);
        }

        function verEstado(tipo, txt, img, fondo) {
            const v = document.getElementById('status-viewer');
            const c = document.getElementById('viewer-content');
            v.style.display = 'flex';
            if(tipo === 'txt') { c.innerHTML = txt; v.style.background = fondo; }
            else { c.innerHTML = \`<img src="\${img}" style="max-width:100%; max-height:80vh;">\`; v.style.background = 'black'; }
            setTimeout(() => v.style.display = 'none', 4500);
        }

        // FOTOS CHAT
        function enviarFotoChat(input) {
            const reader = new FileReader();
            reader.onload = () => {
                enviarMensaje({ img: reader.result, tipo: 'foto' });
            };
            if(input.files[0]) reader.readAsDataURL(input.files[0]);
        }

        // AUDIO
        async function toggleAudio() {
            const btn = document.getElementById('btn-mic');
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const reader = new FileReader();
                        reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/mp3' }));
                        reader.onloadend = () => enviarMensaje({ audio: reader.result, tipo: 'audio' });
                        audioChunks = [];
                    };
                    mediaRecorder.start();
                    btn.style.background = "red"; btn.innerText = "⏹"; isRecording = true;
                } catch(e) { alert("Microfono bloqueado"); }
            } else {
                mediaRecorder.stop();
                btn.style.background = "var(--py-green)"; btn.innerText = "🎤"; isRecording = false;
            }
        }

        function enviar() {
            const i = document.getElementById('msg');
            if(!i.value) return;
            enviarMensaje({ texto: i.value, tipo: 'txt' });
            i.value = '';
        }

        function enviarMensaje(datos) {
            const d = { ...datos, n: miUser.nombre };
            socket.emit('mensaje_enviado', d);
            poner(d, 'enviado');
        }

        socket.on('mensaje_recibido', (d) => {
            poner(d, d.tipo === 'sistema' ? 'sistema' : 'recibido');
            if(d.n !== miUser.nombre) {
                document.getElementById('sonido').play();
                if(document.visibilityState !== 'visible' && Notification.permission === "granted") {
                    new Notification(d.n, { body: d.texto || "Te envió un archivo" });
                }
            }
        });

        function tecleando() { socket.emit('escribiendo', miUser.nombre); setTimeout(() => socket.emit('dejo_de_escribir'), 2000); }
        socket.on('usuario_escribiendo', (n) => document.getElementById('writing-notif').textContent = n + ' está escribiendo...');
        socket.on('usuario_paró', () => document.getElementById('writing-notif').textContent = '');

        function poner(d, c) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + c;
            const h = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            if(c === 'sistema') div.innerHTML = d.texto;
            else {
                let content = '';
                if(d.tipo === 'audio') content = \`<audio src="\${d.audio}" controls style="height:30px; width:200px;"></audio>\`;
                else if(d.tipo === 'foto') content = \`<img src="\${d.img}" class="chat-img">\`;
                else content = d.texto;
                div.innerHTML = \`<b style="font-size:12px; color:var(--py-dark); display:block;">\${d.n}</b>\${content}<span class="msg-time">\${h}</span>\`;
            }
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
