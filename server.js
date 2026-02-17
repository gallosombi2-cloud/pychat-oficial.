const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Datastore({ filename: 'chat.db', autoload: true });

function limpiarMensajesViejos() {
    const hace24Horas = Date.now() - (24 * 60 * 60 * 1000);
    db.remove({ timestamp: { $lt: hace24Horas } }, { multi: true });
}
setInterval(limpiarMensajesViejos, 3600000);

let conectados = 0;

io.on('connection', (socket) => {
    conectados++;
    io.emit('actualizar_usuarios', conectados);
    db.find({}).sort({ timestamp: 1 }).limit(100).exec((err, docs) => {
        if (!err) socket.emit('cargar_historial', docs);
    });
    socket.on('nuevo_usuario', (u) => { socket.nombre = u.nombre; });
    socket.on('escribiendo', (nombre) => { socket.broadcast.emit('usuario_escribiendo', nombre); });
    socket.on('mensaje_enviado', (d) => {
        db.insert({ ...d, timestamp: Date.now() });
        socket.broadcast.emit('mensaje_recibido', d);
    });
    socket.on('borrar_todo', () => { db.remove({}, { multi: true }, () => io.emit('limpiar')); });
    socket.on('disconnect', () => { conectados--; io.emit('actualizar_usuarios', conectados); });
});

app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "PyChat Pro",
        "short_name": "PyChat",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#008069",
        "theme_color": "#008069",
        "icons": [{ "src": "https://cdn-icons-png.flaticon.com/512/134/134914.png", "sizes": "512x512", "type": "image/png" }]
    });
});

app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send("self.addEventListener('fetch', (e) => {});");
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#008069">
    <title>PyChat Pro</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --bg-chat: #efeae2; }
        body { margin: 0; font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .header { background: var(--py-green); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        .badge-online { background: #25d366; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 8px; }
        .search-area { background: white; padding: 8px; border-bottom: 1px solid #ddd; }
        #busc { width: 100%; padding: 8px; border-radius: 20px; border: 1px solid #ddd; outline: none; box-sizing: border-box; }
        #chat { flex: 1; overflow-y: auto; padding: 15px; background: var(--bg-chat); display: flex; flex-direction: column; }
        .msg { background: white; padding: 10px; border-radius: 12px; margin-bottom: 8px; max-width: 85%; box-shadow: 0 1px 1px rgba(0,0,0,0.1); }
        .mio { align-self: flex-end; background: #d9fdd3; }
        .user-tag { font-size: 11px; font-weight: bold; margin-bottom: 3px; display: block; }
        .img-msg { max-width: 100%; border-radius: 8px; margin-top: 5px; display: block; }
        audio { max-width: 100%; height: 35px; margin-top: 5px; }
        .input-bar { background: #f0f2f5; padding: 10px; display: flex; gap: 8px; align-items: center; }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; outline: none; }
        .btn-send, .btn-mic { background: var(--py-green); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-mic.recording { background: red; animation: pulse 1s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .card { background: white; padding: 25px; border-radius: 20px; text-align: center; width: 80%; }
    </style>
</head>
<body>
    <div id="login" style="position:fixed; inset:0; background:var(--py-green); z-index:2000; display:flex; align-items:center; justify-content:center;">
        <div class="card">
            <h2>PyChat Pro</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:12px; border-radius:10px; border:1px solid #ccc;">
            <button onclick="entrar()" style="width:100%; margin-top:15px; padding:12px; background:var(--py-green); color:white; border:none; border-radius:10px;">Entrar</button>
        </div>
    </div>

    <div class="header">
        <div>PyChat Pro <span id="user-count" class="badge-online">0</span></div>
        <div>
            <span onclick="invitarAmigos()" style="cursor:pointer; font-size:22px; margin-right:10px;">👤+</span>
            <span onclick="document.getElementById('config').style.display='flex'" style="cursor:pointer; font-size:18px;">⚙️</span>
        </div>
    </div>

    <div class="search-area"><input type="text" id="busc" placeholder="🔍 Buscar..." onkeyup="buscar()"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <label style="font-size:24px; cursor:pointer;">📎<input type="file" id="img-input" style="display:none" onchange="enviarFoto()"></label>
        <input type="text" id="m" placeholder="Mensaje..." oninput="avisarEscribiendo()">
        <button id="mic-btn" class="btn-mic" onmousedown="startRec()" onmouseup="stopRec()" ontouchstart="startRec()" ontouchend="stopRec()">🎤</button>
        <button onclick="enviar()" class="btn-send">➤</button>
    </div>

    <div id="config" class="modal">
        <div class="card">
            <h3>⚙️ Ajustes</h3>
            <button onclick="borrar()" style="background:red; color:white; padding:10px; width:100%; border-radius:10px;">BORRAR TODO</button>
            <button onclick="document.getElementById('config').style.display='none'" style="margin-top:15px; border:none; background:none; color:blue;">Cerrar</button>
        </div>
    </div>

    <script>
        const socket = io();
        let miNick = "", mediaRecorder, audioChunks = [];
        const colores = ['#e91e63', '#9c27b0', '#2196f3', '#00a884', '#ff9800'];
        let miColor = colores[Math.floor(Math.random() * colores.length)];

        function entrar() { miNick = document.getElementById('nick').value; if(miNick) document.getElementById('login').style.display='none'; socket.emit('nuevo_usuario', {nombre: miNick}); }
        
        // GRABACIÓN DE VOZ
        async function startRec() {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                const reader = new FileReader();
                reader.onload = e => {
                    socket.emit('mensaje_enviado', { n: miNick, audio: e.target.result, color: miColor });
                    poner({ n: miNick, audio: e.target.result, color: miColor }, true);
                };
                reader.readAsDataURL(blob);
            };
            mediaRecorder.start();
            document.getElementById('mic-btn').classList.add('recording');
        }

        function stopRec() {
            if(mediaRecorder) mediaRecorder.stop();
            document.getElementById('mic-btn').classList.remove('recording');
        }

        function enviar() {
            let i = document.getElementById('m');
            if(!i.value) return;
            socket.emit('mensaje_enviado', { n: miNick, texto: i.value, color: miColor });
            poner({ n: miNick, texto: i.value, color: miColor }, true);
            i.value = "";
        }

        function poner(d, mio) {
            let div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : '');
            let cont = d.texto || "";
            if(d.foto) cont = \`<img src="\${d.foto}" class="img-msg">\`;
            if(d.audio) cont = \`<audio controls src="\${d.audio}"></audio>\`;
            div.innerHTML = \`<span class="user-tag" style="color:\${d.color}">\${d.n}</span>\${cont}\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }

        // Funciones auxiliares (buscar, invitar, etc.) se mantienen igual...
        function buscar() { let f = document.getElementById('busc').value.toLowerCase(); document.querySelectorAll('.msg').forEach(m => m.style.display = m.innerText.toLowerCase().includes(f) ? 'block' : 'none'); }
        function invitarAmigos() { navigator.share({ title: 'PyChat Pro', url: window.location.href }); }
        socket.on('actualizar_usuarios', n => document.getElementById('user-count').innerText = n);
        socket.on('mensaje_recibido', d => { poner(d, false); new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play(); });
        socket.on('cargar_historial', h => h.forEach(m => poner(m, m.n === miNick)));
        socket.on('limpiar', () => location.reload());
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
