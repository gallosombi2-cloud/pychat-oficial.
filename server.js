const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new Datastore({ filename: 'chat.db', autoload: true });

// Limpieza cada 24hs
setInterval(() => {
    const hace24 = Date.now() - (24 * 60 * 60 * 1000);
    db.remove({ timestamp: { $lt: hace24 } }, { multi: true });
}, 3600000);

let conectados = 0;
io.on('connection', (socket) => {
    conectados++;
    io.emit('actualizar_usuarios', conectados);
    db.find({}).sort({ timestamp: 1 }).limit(100).exec((err, docs) => { if (!err) socket.emit('cargar_historial', docs); });
    socket.on('nuevo_usuario', (u) => { socket.nombre = u.nombre; });
    socket.on('mensaje_enviado', (d) => { db.insert({...d, timestamp: Date.now()}); socket.broadcast.emit('mensaje_recibido', d); });
    socket.on('borrar_todo', () => db.remove({}, { multi: true }, () => io.emit('limpiar')));
    socket.on('disconnect', () => { conectados--; io.emit('actualizar_usuarios', conectados); });
});

app.get('/manifest.json', (req, res) => {
    res.json({ "name": "PyChat Pro", "short_name": "PyChat", "start_url": "/", "display": "standalone", "background_color": "#008069", "theme_color": "#008069" });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <link rel="manifest" href="/manifest.json">
    <title>PyChat Pro</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --bg: #efeae2; --txt: #000; --msg-font: 15px; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); transition: 0.3s; }
        .header { background: var(--py-green); color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        #chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 8px; font-size: var(--msg-font); }
        .msg { background: white; padding: 8px 12px; border-radius: 10px; max-width: 80%; box-shadow: 0 1px 1px rgba(0,0,0,0.1); color: black; }
        .mio { align-self: flex-end; background: #d9fdd3; }
        .input-bar { background: #f0f2f5; padding: 10px; display: flex; align-items: center; gap: 8px; }
        #m { flex: 1; border: none; padding: 10px; border-radius: 20px; outline: none; }
        .btn-main { background: var(--py-green); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }
        
        /* Modal Configuración */
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 100; }
        .card { background: white; padding: 20px; border-radius: 15px; width: 90%; max-height: 80vh; overflow-y: auto; color: black; text-align: left; }
        .card h3 { margin-top: 0; color: var(--py-green); }
        .setting-row { margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .setting-row label { display: block; font-weight: bold; margin-bottom: 5px; font-size: 14px; }
        .theme-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .theme-btns button { padding: 8px; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <div id="login" style="position:fixed; inset:0; background:var(--py-green); z-index:1000; display:flex; align-items:center; justify-content:center;">
        <div class="card" style="text-align:center;">
            <h2>PyChat Pro</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:80%; padding:10px; margin-bottom:10px;">
            <button onclick="entrar()" style="width:85%; padding:10px; background:var(--py-green); color:white; border:none; border-radius:5px;">ENTRAR</button>
        </div>
    </div>

    <div class="header">
        <div>PyChat Pro <span id="count" style="background:#25d366; padding:2px 6px; border-radius:10px; font-size:12px;">0</span></div>
        <div style="display:flex; gap:15px;">
            <span onclick="invitarAhora()" style="cursor:pointer; font-size:20px;">👤+</span>
            <span onclick="abrirConfig()" style="cursor:pointer; font-size:20px;">⚙️</span>
        </div>
    </div>

    <div id="chat"></div>

    <div id="conf-modal" class="modal">
        <div class="card">
            <h3>⚙️ Configuración</h3>
            
            <div class="setting-row">
                <label>Temas Visuales</label>
                <div class="theme-btns">
                    <button onclick="setTheme('#efeae2', '#008069', '#000')">Clásico</button>
                    <button onclick="setTheme('#0b141a', '#202c33', '#fff')">Oscuro</button>
                    <button onclick="setTheme('#e3f2fd', '#1565c0', '#000')">Océano</button>
                    <button onclick="setTheme('#fce4ec', '#ad1457', '#000')">Rosa</button>
                </div>
            </div>

            <div class="setting-row">
                <label>Color de fondo personalizado</label>
                <input type="color" id="colorPicker" onchange="setBG(this.value)" style="width:100%; height:40px;">
            </div>

            <div class="setting-row">
                <label>Tamaño de letra: <span id="fontVal">15</span>px</label>
                <input type="range" min="12" max="24" value="15" oninput="setFont(this.value)" style="width:100%;">
            </div>

            <div class="setting-row">
                <label><input type="checkbox" id="soundOn" checked> Sonidos de notificación</label>
            </div>

            <button onclick="borrarTodo()" style="background:#ff3b30; color:white; width:100%; padding:10px; border:none; border-radius:5px; margin-bottom:10px;">VACIAR CHAT</button>
            <button onclick="document.getElementById('conf-modal').style.display='none'" style="width:100%; padding:10px; border:none; background:#eee; border-radius:5px;">Cerrar</button>
        </div>
    </div>

    <div class="input-bar">
        <input type="text" id="m" placeholder="Escribe aquí...">
        <button id="mic" class="btn-main" onclick="toggleVoz()">🎤</button>
        <button onclick="enviar()" class="btn-main">➤</button>
    </div>

    <script>
        const socket = io();
        let nick = "", rec, chunks = [], colorUser = '#'+Math.floor(Math.random()*16777215).toString(16);

        function entrar() { 
            nick = document.getElementById('nick').value; 
            if(nick) { document.getElementById('login').style.display='none'; socket.emit('nuevo_usuario', {nombre: nick}); }
        }

        function abrirConfig() { document.getElementById('conf-modal').style.display='flex'; }

        function setTheme(bg, head, txt) {
            document.documentElement.style.setProperty('--bg', bg);
            document.documentElement.style.setProperty('--py-green', head);
            document.documentElement.style.setProperty('--txt', txt);
        }

        function setBG(val) { document.documentElement.style.setProperty('--bg', val); }

        function setFont(val) {
            document.documentElement.style.setProperty('--msg-font', val + 'px');
            document.getElementById('fontVal').innerText = val;
        }

        function invitarAhora() {
            const url = window.location.href;
            if (navigator.share) { navigator.share({ title: 'PyChat Pro', url: url }); }
            else { navigator.clipboard.writeText(url); alert("Link copiado!"); }
        }

        async function toggleVoz() {
            if (!rec || rec.state === 'inactive') {
                const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                rec = new MediaRecorder(s); chunks = [];
                rec.ondataavailable = e => chunks.push(e.data);
                rec.onstop = () => {
                    const b = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                    const r = new FileReader();
                    r.onload = e => { socket.emit('mensaje_enviado', { n: nick, audio: e.target.result, color: colorUser }); poner({ n: nick, audio: e.target.result, color: colorUser }, true); };
                    r.readAsDataURL(b);
                };
                rec.start(); document.getElementById('mic').style.background = 'red';
            } else { rec.stop(); document.getElementById('mic').style.background = 'var(--py-green)'; }
        }

        function enviar() {
            let i = document.getElementById('m');
            if(!i.value) return;
            socket.emit('mensaje_enviado', { n: nick, texto: i.value, color: colorUser });
            poner({ n: nick, texto: i.value, color: colorUser }, true);
            i.value = "";
        }

        function poner(d, mio) {
            let div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : '');
            let c = d.texto || "";
            if(d.audio) c = \`<audio controls src="\${d.audio}" style="width:180px;"></audio>\`;
            div.innerHTML = \`<b style="font-size:10px; color:\${d.color}">\${d.n}</b><br>\${c}\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }

        socket.on('mensaje_recibido', d => { 
            poner(d, false); 
            if(document.getElementById('soundOn').checked) new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play();
        });
        socket.on('actualizar_usuarios', n => document.getElementById('count').innerText = n);
        socket.on('cargar_historial', h => h.forEach(m => poner(m, m.n === nick)));
        socket.on('limpiar', () => location.reload());
        function borrarTodo() { if(confirm("¿Borrar todo?")) socket.emit('borrar_todo'); }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
