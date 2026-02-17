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
        const msgId = "id-" + Date.now() + Math.random();
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
    <title>PyChat Ghost Elite</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #075e54; --bg: #0b141a; --mio: #005c4b; --otro: #202c33; --txt: #e9edef; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); overflow: hidden; }
        
        /* Cabecera */
        .header { background: var(--py-green); padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; z-index: 10; }
        .panic-btn { background: #ff3b30; border: none; border-radius: 50%; width: 35px; height: 35px; color: white; cursor: pointer; font-size: 18px; }

        /* Lista Contactos */
        #lista-contactos { background: #111b21; border-bottom: 1px solid #222; padding: 10px; display: flex; gap: 10px; overflow-x: auto; min-height: 50px; }
        .contacto { background: #202c33; padding: 8px 15px; border-radius: 20px; border: 1px solid #333; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .contacto.activo { background: #00a884; border-color: #00a884; }

        /* Area de Chat */
        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 10px; border-radius: 10px; max-width: 80%; position: relative; transition: opacity 0.8s, transform 0.8s; }
        .mio { align-self: flex-end; background: var(--mio); }
        .otro { align-self: flex-start; background: var(--otro); }
        .desaparecer { opacity: 0; transform: translateY(-20px); }

        /* Barra de Tiempo */
        .timer { height: 2px; background: rgba(255,255,255,0.2); margin-top: 5px; width: 100%; }
        .progress { height: 100%; background: #ff3b30; width: 100%; animation: burn 10s linear forwards; }
        @keyframes burn { from { width: 100%; } to { width: 0%; } }

        /* Barra de Entrada */
        .input-bar { background: #202c33; padding: 10px; display: flex; gap: 8px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; background: #2a3942; color: white; outline: none; }
        .btn-send { background: #00a884; color: white; border: none; width: 42px; height: 42px; border-radius: 50%; cursor: pointer; }
        
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .login-card { background: #202c33; padding: 30px; border-radius: 20px; text-align: center; width: 80%; }
    </style>
</head>
<body>

    <div id="login">
        <div class="login-card">
            <h2 style="color:#00a884">PyChat Ghost</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:12px; border-radius:10px; border:none; background:#2a3942; color:white; margin-bottom:15px;">
            <button onclick="entrar()" style="width:100%; padding:12px; background:#00a884; color:white; border:none; border-radius:10px; font-weight:bold;">ENTRAR</button>
        </div>
    </div>

    <div class="header">
        <span>Ghost Mode 🔒</span>
        <button class="panic-btn" onclick="panico()">⚡</button>
    </div>

    <div id="lista-contactos"></div>

    <div style="background:#182229; padding:5px; font-size:10px; text-align:center; color:#8696a0;">Filtro: 
        <select id="voice-filter" style="background:none; color:#00a884; border:none;">
            <option value="1">Normal</option>
            <option value="1.5">Ardilla</option>
            <option value="0.7">Gigante</option>
        </select>
    </div>

    <div id="chat"></div>

    <div class="input-bar">
        <button id="mic" class="btn-send" onmousedown="startRec()" onmouseup="stopRec()" ontouchstart="startRec()" ontouchend="stopRec()">🎤</button>
        <input type="text" id="m" placeholder="Selecciona un contacto..." disabled>
        <button onclick="enviarTexto()" class="btn-send">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, mediaRec, chunks = [];

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) document.getElementById('login').style.display = 'none';
            socket.emit('nuevo_usuario', miNick);
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
                        actualizarVisualLista(id);
                    };
                    lista.appendChild(div);
                }
            }
        });

        function actualizarVisualLista(idActivo) {
            document.querySelectorAll('.contacto').forEach(c => c.classList.remove('activo'));
            // Refrescaría solo el estilo
        }

        function enviarTexto() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, texto: inp.value, n: miNick });
            inp.value = "";
        }

        socket.on('recibir_privado', (d) => {
            if (receptorId === d.emisorId || d.emisorId === socket.id) poner(d);
        });

        socket.on('confirmacion_envio', (d) => {
            poner(d, true);
        });

        function poner(d, mio = false) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            div.id = d.msgId;
            
            if(d.texto) div.innerText = d.texto;
            if(d.audio) {
                const speed = document.getElementById('voice-filter').value;
                div.innerHTML = \`<audio src="\${d.audio}" controls onplay="this.playbackRate=\${speed}" style="width:160px;"></audio>\`;
            }

            div.innerHTML += '<div class="timer"><div class="progress"></div></div>';
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;

            setTimeout(() => {
                div.classList.add('desaparecer');
                setTimeout(() => div.remove(), 1000);
            }, 10000);
        }

        async function startRec() {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRec = new MediaRecorder(stream);
            chunks = [];
            mediaRec.ondataavailable = e => chunks.push(e.data);
            mediaRec.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                const reader = new FileReader();
                reader.onload = e => {
                    socket.emit('mensaje_privado', { receptorId, audio: e.target.result, n: miNick });
                };
                reader.readAsDataURL(blob);
            };
            mediaRec.start();
            document.getElementById('mic').style.background = 'red';
        }

        function stopRec() {
            if(mediaRec) mediaRec.stop();
            document.getElementById('mic').style.background = '#00a884';
        }

        function panico() {
            document.body.innerHTML = "<div style='background:black; color:white; height:100vh; display:flex; align-items:center; justify-content:center;'><h1>SISTEMA LIMPIO</h1></div>";
            setTimeout(() => location.reload(), 1000);
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
