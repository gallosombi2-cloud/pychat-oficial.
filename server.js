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
    <title>PyChat Elite Final</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { 
            --primary: #075e54; --accent: #00a884; --bg: #0b141a; 
            --mio: #005c4b; --otro: #202c33; --txt: #e9edef;
            --font-size: 14px; --blur: 0px; --wallpaper: none;
        }
        body { 
            margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; 
            background: var(--bg); background-image: var(--wallpaper); background-size: cover;
            background-position: center; color: var(--txt); transition: 0.4s; overflow: hidden;
        }
        .header { background: var(--primary); padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); z-index: 100; }
        
        #lista-contactos { background: rgba(0,0,0,0.4); padding: 12px; display: flex; gap: 10px; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .contacto { background: var(--otro); padding: 8px 18px; border-radius: 20px; cursor: pointer; white-space: nowrap; transition: 0.3s; font-size: 13px; border: 1px solid transparent; }
        .contacto.activo { background: var(--accent); border-color: white; transform: scale(1.05); }

        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; font-size: var(--font-size); }
        .msg { padding: 12px; border-radius: 15px; max-width: 75%; position: relative; filter: blur(var(--blur)); transition: filter 0.3s, opacity 0.5s; }
        .msg:active { filter: blur(0px); }
        .mio { align-self: flex-end; background: var(--mio); border-bottom-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--otro); border-bottom-left-radius: 2px; }

        /* MODAL CONFIGURACION */
        #modal-config { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; align-items: center; justify-content: center; }
        .config-box { background: #1c272d; padding: 25px; border-radius: 25px; width: 85%; max-width: 320px; max-height: 80vh; overflow-y: auto; border: 1px solid var(--accent); }
        .section { margin-bottom: 15px; text-align: left; }
        .section label { display: block; font-size: 11px; color: #8696a0; margin-bottom: 5px; text-transform: uppercase; }
        select, input { width: 100%; padding: 10px; border-radius: 10px; border: none; background: #2a3942; color: white; box-sizing: border-box; }

        .input-bar { background: #202c33; padding: 12px; display: flex; gap: 10px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 14px; border-radius: 25px; background: #2a3942; color: white; outline: none; }
        .btn-round { background: var(--accent); color: white; border: none; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; font-size: 20px; }
        
        #btn-panic { background: #ff3b30; color: white; border: none; padding: 10px; border-radius: 10px; font-weight: bold; width: 100%; margin-top: 10px; cursor: pointer; }

        #login { position: fixed; inset: 0; background: var(--bg); z-index: 3000; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="text-align:center; width:80%;">
            <h1 style="color:var(--accent)">PyChat Elite</h1>
            <input type="text" id="nick" placeholder="Tu Alias" style="text-align:center; font-size:18px; margin-bottom:20px;">
            <button onclick="entrar()" style="width:100%; padding:15px; background:var(--accent); color:white; border:none; border-radius:15px; font-weight:bold;">ACCEDER</button>
        </div>
    </div>

    <div id="modal-config">
        <div class="config-box">
            <h2 style="color:var(--accent); margin-top:0;">Ajustes ⚙️</h2>
            
            <div class="section">
                <label>Tema</label>
                <select id="theme-sel">
                    <option value="#075e54,#00a884,#005c4b">Verde WhatsApp</option>
                    <option value="#1e3a8a,#3b82f6,#1e40af">Azul Galaxia</option>
                    <option value="#581c87,#a855f7,#7e22ce">Violeta Ghost</option>
                    <option value="#7f1d1d,#ef4444,#991b1b">Rojo Alerta</option>
                </select>
            </div>

            <div class="section">
                <label>Fondo</label>
                <select id="wall-sel">
                    <option value="none">Sólido</option>
                    <option value="url('https://www.transparenttextures.com/patterns/carbon-fibre.png')">Carbono</option>
                    <option value="url('https://www.transparenttextures.com/patterns/clouds.png')">Nubes</option>
                    <option value="url('https://www.transparenttextures.com/patterns/dark-matter.png')">Espacio</option>
                </select>
            </div>

            <div class="section">
                <label>Privacidad (Blur)</label>
                <select id="blur-sel">
                    <option value="0px">Normal</option>
                    <option value="6px">Fantasma (Borroso)</option>
                </select>
            </div>

            <div class="section">
                <label>Vida Mensaje (Seg)</label>
                <input type="number" id="time-val" value="15">
            </div>

            <button onclick="aplicar()" style="width:100%; padding:12px; background:var(--accent); color:white; border:none; border-radius:10px; font-weight:bold;">GUARDAR</button>
            <button id="btn-panic" onclick="panico()">🔥 BOTÓN DE PÁNICO</button>
            <button onclick="document.getElementById('modal-config').style.display='none'" style="margin-top:10px; background:none; border:none; color:#8696a0; width:100%;">Cerrar</button>
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
        <input type="text" id="m" placeholder="Elige un contacto..." disabled>
        <button onclick="enviar()" class="btn-round">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, mediaRec, chunks = [], grabando = false;
        let tVida = 15;

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); }
        }

        function aplicar() {
            const t = document.getElementById('theme-sel').value.split(',');
            tVida = parseInt(document.getElementById('time-val').value);
            document.documentElement.style.setProperty('--primary', t[0]);
            document.documentElement.style.setProperty('--accent', t[1]);
            document.documentElement.style.setProperty('--mio', t[2]);
            document.documentElement.style.setProperty('--wallpaper', document.getElementById('wall-sel').value);
            document.documentElement.style.setProperty('--blur', document.getElementById('blur-sel').value);
            document.getElementById('modal-config').style.display = 'none';
        }

        function panico() {
            document.getElementById('chat').innerHTML = "";
            document.getElementById('modal-config').style.display = 'none';
            alert("¡HISTORIAL LIMPIO!");
        }

        function invitar() {
            if (navigator.share) { navigator.share({ title: 'Chat Privado', url: window.location.href }); }
            else { prompt("Copia el link:", window.location.href); }
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
            setTimeout(() => {
                div.style.opacity = '0';
                setTimeout(() => div.remove(), 500);
            }, tVida * 1000);
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
