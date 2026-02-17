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
        const msgId = "id-" + Date.now();
        socket.to(datos.receptorId).emit('recibir_privado', { ...datos, emisorId: socket.id, msgId });
        socket.emit('confirmacion_envio', { ...datos, msgId });
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
    <title>PyChat Elite</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #075e54; --bg: #0b141a; --mio: #005c4b; --otro: #202c33; --txt: #e9edef; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); }
        .header { background: var(--py-green); padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        #lista-contactos { background: #111b21; border-bottom: 1px solid #222; padding: 10px; display: flex; gap: 10px; overflow-x: auto; min-height: 50px; }
        .contacto { background: #202c33; padding: 8px 15px; border-radius: 20px; border: 1px solid #333; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .contacto.activo { background: #00a884; border-color: #00a884; }
        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 12px; border-radius: 12px; max-width: 80%; position: relative; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .mio { align-self: flex-end; background: var(--mio); }
        .otro { align-self: flex-start; background: var(--otro); }
        
        /* Indicador de grabación */
        #recording-status { display: none; color: #ff3b30; font-size: 12px; text-align: center; padding: 5px; font-weight: bold; animation: pulse 1s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

        .input-bar { background: #202c33; padding: 10px; display: flex; gap: 10px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; background: #2a3942; color: white; outline: none; font-size: 16px; }
        .btn-round { background: #00a884; color: white; border: none; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; transition: 0.3s; }
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 2000; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="background:#202c33; padding:30px; border-radius:20px; text-align:center; width:85%; max-width:350px;">
            <h2 style="color:#00a884">PyChat Elite</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:15px; border-radius:10px; border:none; background:#2a3942; color:white;">
            <button onclick="entrar()" style="width:100%; margin-top:20px; padding:15px; background:#00a884; color:white; border:none; border-radius:10px; font-weight:bold;">ACCEDER</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Elite 🔒</span>
        <div style="display:flex; gap:15px;">
            <span onclick="invitar()" style="cursor:pointer; font-size:24px;">👤+</span>
            <span onclick="location.reload()" style="cursor:pointer; font-size:22px;">🔄</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="recording-status">🔴 GRABANDO AUDIO...</div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-audio" class="btn-round" onclick="controlVoz()">🎤</button>
        <input type="text" id="m" placeholder="Toca un contacto..." disabled>
        <button onclick="enviarTexto()" class="btn-round">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, mediaRec, chunks = [], grabando = false;

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); }
        }

        async function invitar() {
            if (navigator.share) {
                await navigator.share({ title: 'PyChat Elite', text: 'Hablemos en privado aquí:', url: window.location.href });
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copiado. Pégalo en el chat de tu contacto.");
            }
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
                        document.getElementById('m').placeholder = "Mensaje a " + users[id];
                        document.querySelectorAll('.contacto').forEach(c => c.classList.remove('activo'));
                        div.classList.add('activo');
                    };
                    lista.appendChild(div);
                }
            }
        });

        async function controlVoz() {
            if (!receptorId) return alert("Elige un contacto primero");
            const btn = document.getElementById('btn-audio');
            const status = document.getElementById('recording-status');

            if (!grabando) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRec = new MediaRecorder(stream);
                    chunks = [];
                    mediaRec.ondataavailable = e => chunks.push(e.data);
                    mediaRec.onstop = () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.onload = e => socket.emit('mensaje_privado', { receptorId, audio: e.target.result, n: miNick });
                        reader.readAsDataURL(blob);
                        stream.getTracks().forEach(t => t.stop());
                    };
                    mediaRec.start();
                    grabando = true;
                    btn.style.background = "#ff3b30";
                    btn.innerText = "🛑";
                    status.style.display = "block";
                } catch (e) { alert("Permite el micrófono en los ajustes del sitio."); }
            } else {
                mediaRec.stop();
                grabando = false;
                btn.style.background = "#00a884";
                btn.innerText = "🎤";
                status.style.display = "none";
            }
        }

        function enviarTexto() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, texto: inp.value, n: miNick });
            inp.value = "";
        }

        socket.on('recibir_privado', (d) => { if (receptorId === d.emisorId) poner(d, false); });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            if(d.texto) div.innerText = d.texto;
            if(d.audio) div.innerHTML = \`<audio src="\${d.audio}" controls style="width:210px;"></audio>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            
            // Modo Fantasma (10s)
            setTimeout(() => {
                div.style.transition = "opacity 1s";
                div.style.opacity = "0";
                setTimeout(() => div.remove(), 1000);
            }, 10000);
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
