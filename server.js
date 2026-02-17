const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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
    <title>PyChat Elite 🔒</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { 
            --py-green: #075e54; 
            --bg: #0b141a; 
            --mio: #005c4b; 
            --otro: #202c33; 
            --txt: #e9edef; 
            --accent: #00a884;
            --wallpaper: none;
        }
        body { 
            margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; 
            background-color: var(--bg); 
            background-image: var(--wallpaper);
            background-size: cover;
            background-position: center;
            color: var(--txt); 
        }
        .header { background: var(--py-green); padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        
        #lista-contactos { background: rgba(17, 27, 33, 0.9); padding: 12px; display: flex; gap: 12px; overflow-x: auto; min-height: 45px; border-bottom: 1px solid #222; }
        .contacto { background: #202c33; padding: 8px 18px; border-radius: 20px; border: 1px solid #333; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .contacto.activo { background: var(--accent); border-color: var(--accent); }

        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 12px; border-radius: 12px; max-width: 80%; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .mio { align-self: flex-end; background: var(--mio); border-bottom-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--otro); border-bottom-left-radius: 2px; }

        #modal-config { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 6000; align-items: center; justify-content: center; }
        .config-card { background: #202c33; padding: 25px; border-radius: 20px; width: 85%; max-width: 300px; text-align: center; }

        .input-bar { background: #202c33; padding: 10px; display: flex; gap: 10px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; background: #2a3942; color: white; outline: none; font-size: 16px; }
        .btn-circle { background: var(--accent); color: white; border: none; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 5000; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="background:#202c33; padding:30px; border-radius:20px; text-align:center; width:85%;">
            <h2 style="color:var(--accent)">PyChat Elite 🔒</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:14px; border-radius:10px; border:none; background:#2a3942; color:white;">
            <button onclick="entrar()" style="width:100%; margin-top:20px; padding:14px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">INGRESAR</button>
        </div>
    </div>

    <div id="modal-config">
        <div class="config-card">
            <h3 style="margin-top:0; color:var(--accent);">Configuración ⚙️</h3>
            
            <div style="text-align:left; margin-bottom:15px;">
                <label style="font-size:12px; color:#8696a0;">Fondo de Chat:</label>
                <select id="wall-select" style="width:100%; padding:10px; background:#2a3942; color:white; border:none; border-radius:8px; margin-top:5px;">
                    <option value="none">Sólido Oscuro</option>
                    <option value="url('https://www.transparenttextures.com/patterns/dark-matter.png')">Noche Estrellada</option>
                    <option value="url('https://www.transparenttextures.com/patterns/clouds.png')">Nubes Suaves</option>
                </select>
            </div>

            <div style="text-align:left; margin-bottom:15px;">
                <label style="font-size:12px; color:#8696a0;">Color de Burbujas:</label>
                <select id="color-select" style="width:100%; padding:10px; background:#2a3942; color:white; border:none; border-radius:8px; margin-top:5px;">
                    <option value="#075e54,#00a884,#005c4b">Verde Clásico</option>
                    <option value="#1e3a8a,#3b82f6,#1e40af">Azul Profundo</option>
                    <option value="#581c87,#a855f7,#7e22ce">Violeta Ghost</option>
                </select>
            </div>

            <button onclick="guardarConfig()" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">APLICAR</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Elite 🔒</span>
        <div style="display:flex; gap:15px; align-items:center;">
            <span onclick="compartir()" style="cursor:pointer; font-size:24px;">👤+</span>
            <span onclick="abrirConfig()" style="cursor:pointer; font-size:22px;">⚙️</span>
            <span onclick="location.reload()" style="cursor:pointer; font-size:20px;">🔄</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-mic" class="btn-circle" onclick="toggleAudio()">🎤</button>
        <input type="text" id="m" placeholder="Toca un contacto..." disabled>
        <button onclick="enviarTexto()" class="btn-circle">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, mediaRec, chunks = [], grabando = false;

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); }
        }

        function abrirConfig() { document.getElementById('modal-config').style.display = 'flex'; }
        
        function guardarConfig() {
            const wall = document.getElementById('wall-select').value;
            const colores = document.getElementById('color-select').value.split(',');
            
            document.documentElement.style.setProperty('--wallpaper', wall);
            document.documentElement.style.setProperty('--py-green', colores[0]);
            document.documentElement.style.setProperty('--accent', colores[1]);
            document.documentElement.style.setProperty('--mio', colores[2]);
            
            document.getElementById('modal-config').style.display = 'none';
        }

        async function compartir() {
            if (navigator.share) {
                await navigator.share({ title: 'PyChat Elite', text: 'Hablemos privado:', url: window.location.href });
            } else { alert("Link copiado!"); }
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

        async function toggleAudio() {
            if (!receptorId) return alert("Selecciona a alguien arriba");
            const btn = document.getElementById('btn-mic');
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
                    btn.style.background = "#ff3b30"; btn.innerText = "🛑";
                } catch (e) { alert("Permite el micrófono"); }
            } else {
                mediaRec.stop(); grabando = false;
                btn.style.background = "var(--accent)"; btn.innerText = "🎤";
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
            if(d.audio) div.innerHTML = \`<audio src="\${d.audio}" controls style="width:200px;"></audio>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            setTimeout(() => {
                div.style.transition = "opacity 0.8s";
                div.style.opacity = "0";
                setTimeout(() => div.remove(), 1000);
            }, 15000); // 15 segundos para dar tiempo a leer con el nuevo diseño
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
