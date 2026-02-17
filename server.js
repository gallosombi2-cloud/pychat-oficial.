const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let usuariosOnline = {}; 

io.on('connection', (socket) => {
    socket.on('nuevo_usuario', (nombre) => {
        socket.nombre = nombre;
        usuariosOnline[socket.id] = nombre;
        io.emit('actualizar_lista', usuariosOnline);
    });
    socket.on('mensaje_privado', (datos) => {
        socket.to(datos.receptorId).emit('recibir_privado', { ...datos, emisorId: socket.id });
        socket.emit('confirmacion_envio', datos);
    });
    socket.on('disconnect', () => {
        delete usuariosOnline[socket.id];
        io.emit('actualizar_lista', usuariosOnline);
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>PyChat Elite Ultra</title>
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
        :root { --primary: #075e54; --accent: #00a884; --bg: #0b141a; --mio: #005c4b; --otro: #202c33; --txt: #e9edef; --blur: 0px; --wallpaper: none; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); background-image: var(--wallpaper); background-size: cover; color: var(--txt); overflow: hidden; }
        .header { background: var(--primary); padding: 15px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
        #lista-contactos { background: rgba(0,0,0,0.4); padding: 12px; display: flex; gap: 10px; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .contacto { background: var(--otro); padding: 8px 18px; border-radius: 20px; cursor: pointer; white-space: nowrap; font-size: 13px; }
        .contacto.activo { background: var(--accent); border-color: white; }
        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .msg { padding: 12px; border-radius: 15px; max-width: 75%; filter: blur(var(--blur)); transition: 0.3s; }
        .msg:active { filter: blur(0px); }
        .mio { align-self: flex-end; background: var(--mio); }
        .otro { align-self: flex-start; background: var(--otro); }
        #modal-config, #modal-qr { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 2000; align-items: center; justify-content: center; text-align: center; }
        .config-box { background: #1c272d; padding: 25px; border-radius: 25px; width: 85%; max-width: 320px; border: 1px solid var(--accent); }
        .input-bar { background: #202c33; padding: 12px; display: flex; gap: 10px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 14px; border-radius: 25px; background: #2a3942; color: white; outline: none; }
        .btn-round { background: var(--accent); color: white; border: none; width: 48px; height: 48px; border-radius: 50%; font-size: 20px; }
        #qrcode { background: white; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0; }
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 3000; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="text-align:center; width:80%;">
            <h1 style="color:var(--accent)">PyChat Elite</h1>
            <input type="text" id="nick" placeholder="Nombre para el chat" style="width:100%; padding:15px; border-radius:10px; border:none; background:#2a3942; color:white;">
            <button onclick="entrar()" style="margin-top:20px; width:100%; padding:15px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">INGRESAR</button>
        </div>
    </div>

    <div id="modal-qr">
        <div class="config-box">
            <h2 style="color:var(--accent)">Escanea para Unirte</h2>
            <div id="qrcode"></div>
            <p style="font-size:12px; color:#8696a0;">Muestra este código a tu amigo</p>
            <button onclick="document.getElementById('modal-qr').style.display='none'" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px;">CERRAR</button>
        </div>
    </div>

    <div id="modal-config">
        <div class="config-box">
            <h2 style="color:var(--accent); margin-top:0;">Personalizar ⚙️</h2>
            <div style="text-align:left; margin-bottom:10px;">
                <label style="font-size:11px; color:#8696a0;">TEMA</label>
                <select id="theme-sel" style="width:100%; padding:10px; border-radius:8px; background:#2a3942; color:white; border:none;">
                    <option value="#075e54,#00a884,#005c4b">WhatsApp</option>
                    <option value="#1e3a8a,#3b82f6,#1e40af">Azul Profundo</option>
                    <option value="#581c87,#a855f7,#7e22ce">Violeta Ghost</option>
                </select>
            </div>
            <button onclick="mostrarQR()" style="width:100%; padding:12px; background:#fff; color:#000; border:none; border-radius:10px; margin-bottom:10px; font-weight:bold;">🔲 GENERAR QR</button>
            <button onclick="aplicar()" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">GUARDAR</button>
            <button onclick="document.getElementById('chat').innerHTML=''; document.getElementById('modal-config').style.display='none';" style="width:100%; padding:10px; background:#ff3b30; color:white; border:none; border-radius:10px; margin-top:10px;">🔥 PÁNICO (BORRAR TODO)</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Elite 🔒</span>
        <div style="display:flex; gap:15px;">
            <span onclick="invitar()" style="cursor:pointer; font-size:22px;">👤+</span>
            <span onclick="document.getElementById('modal-config').style.display='flex'" style="cursor:pointer; font-size:22px;">⚙️</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-mic" class="btn-round" onclick="toggleAudio()">🎤</button>
        <input type="text" id="m" placeholder="Toca a un contacto..." disabled>
        <button onclick="enviar()" class="btn-round">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, mediaRec, chunks = [], grabando = false;

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); }
        }

        function mostrarQR() {
            document.getElementById('qrcode').innerHTML = "";
            new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 200, height: 200 });
            document.getElementById('modal-qr').style.display = 'flex';
        }

        function invitar() {
            if (navigator.share) {
                navigator.share({ title: 'Únete a mi chat', url: window.location.href });
            } else { prompt("Copia el link:", window.location.href); }
        }

        function aplicar() {
            const t = document.getElementById('theme-sel').value.split(',');
            document.documentElement.style.setProperty('--primary', t[0]);
            document.documentElement.style.setProperty('--accent', t[1]);
            document.documentElement.style.setProperty('--mio', t[2]);
            document.getElementById('modal-config').style.display = 'none';
        }

        socket.on('actualizar_lista', (users) => {
            const lista = document.getElementById('lista-contactos');
            lista.innerHTML = "";
            for (let id in users) {
                if (id !== socket.id) {
                    const div = document.createElement('div');
                    div.className = 'contacto' + (receptorId === id ? ' activo' : '');
                    div.innerText = users[id];
                    div.onclick = () => {
                        receptorId = id;
                        document.getElementById('m').disabled = false;
                        document.getElementById('m').placeholder = "Chat con " + users[id];
                        document.querySelectorAll('.contacto').forEach(c => c.classList.remove('activo'));
                        div.classList.add('activo');
                    };
                    lista.appendChild(div);
                }
            }
        });

        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, texto: inp.value });
            inp.value = "";
        }

        async function toggleAudio() {
            if(!receptorId) return alert("Selecciona contacto");
            const btn = document.getElementById('btn-mic');
            if(!grabando) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRec = new MediaRecorder(stream);
                chunks = [];
                mediaRec.ondataavailable = e => chunks.push(e.data);
                mediaRec.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onload = e => socket.emit('mensaje_privado', { receptorId, audio: e.target.result });
                    reader.readAsDataURL(blob);
                };
                mediaRec.start();
                grabando = true; btn.innerText = "🛑"; btn.style.background = "red";
            } else {
                mediaRec.stop(); grabando = false; btn.innerText = "🎤"; btn.style.background = "var(--accent)";
            }
        }

        socket.on('recibir_privado', (d) => { if(receptorId === d.emisorId) poner(d, false); });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            if(d.texto) div.innerText = d.texto;
            if(d.audio) div.innerHTML = \`<audio src="\${d.audio}" controls style="width:180px;"></audio>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 20000);
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
