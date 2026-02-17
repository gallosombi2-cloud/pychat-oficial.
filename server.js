const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Memoria del Servidor
let usuariosOnline = {}; 
let mensajesPendientes = {}; 

io.on('connection', (socket) => {
    // Enviar lista de quién está conectado ahora
    socket.emit('actualizar_lista', usuariosOnline);

    socket.on('nuevo_usuario', (nombre) => {
        socket.nombre = nombre;
        usuariosOnline[socket.id] = nombre;
        
        // ENTREGA DE MENSAJES GUARDADOS (MODO OFFLINE)
        if (mensajesPendientes[nombre]) {
            mensajesPendientes[nombre].forEach(msg => {
                socket.emit('recibir_privado', msg);
            });
            delete mensajesPendientes[nombre]; 
        }
        
        io.emit('actualizar_lista', usuariosOnline);
    });

    socket.on('mensaje_privado', (datos) => {
        const receptorId = datos.receptorId;
        const nombreDestino = datos.nombreDestino;

        const paqueteMensaje = {
            ...datos,
            emisorId: socket.id,
            emisorNombre: socket.nombre,
            fecha: new Date().toLocaleTimeString()
        };

        if (usuariosOnline[receptorId]) {
            // Usuario está conectado: entrega directa
            socket.to(receptorId).emit('recibir_privado', paqueteMensaje);
        } else {
            // Usuario desconectado: guardar en buzón por NOMBRE
            if (!mensajesPendientes[nombreDestino]) mensajesPendientes[nombreDestino] = [];
            mensajesPendientes[nombreDestino].push({
                ...paqueteMensaje,
                nota: "(Recibido mientras estabas fuera)"
            });
        }
        // Confirmar al emisor para que vea su propio mensaje
        socket.emit('confirmacion_envio', paqueteMensaje);
    });

    socket.on('disconnect', () => {
        if (socket.id) {
            delete usuariosOnline[socket.id];
            io.emit('actualizar_lista', usuariosOnline);
        }
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
        :root { --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        
        .header { background: var(--p); padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.5); z-index: 10; }
        
        #lista-contactos { background: #111b21; padding: 12px; display: flex; gap: 10px; overflow-x: auto; border-bottom: 1px solid #333; min-height: 45px; }
        .con { background: var(--o); padding: 8px 18px; border-radius: 20px; cursor: pointer; white-space: nowrap; font-size: 13px; border: 1px solid transparent; transition: 0.3s; }
        .con.activo { background: var(--a); border-color: white; transform: scale(1.05); }

        #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .msg { padding: 12px; border-radius: 12px; max-width: 80%; position: relative; animation: fadeIn 0.3s; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .mio { align-self: flex-end; background: var(--m); border-bottom-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--o); border-bottom-left-radius: 2px; }

        .input-bar { background: var(--o); padding: 12px; display: flex; gap: 10px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 14px; border-radius: 25px; background: #2a3942; color: white; outline: none; font-size: 16px; }
        .btn-act { background: var(--a); color: white; border: none; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; }

        /* MODALES */
        #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; align-items: center; justify-content: center; }
        .box { background: #1c272d; padding: 25px; border-radius: 25px; width: 85%; max-width: 320px; text-align: center; border: 1px solid var(--a); }
        
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 2000; display: flex; align-items: center; justify-content: center; }
        input[type="text"]#nick { width: 80%; padding: 15px; border-radius: 10px; border: none; font-size: 18px; text-align: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="text-align:center; width:100%;">
            <h1 style="color:var(--a)">PyChat Elite</h1>
            <input type="text" id="nick" placeholder="¿Tu apodo?">
            <br><br>
            <button onclick="entrar()" style="width:70%; padding:15px; background:var(--a); color:white; border:none; border-radius:10px; font-weight:bold;">ACCEDER</button>
        </div>
    </div>

    <div id="modal">
        <div class="box">
            <h3 style="color:var(--a); margin-top:0;">Ajustes de Sistema ⚙️</h3>
            <div style="text-align:left; margin-bottom:15px;">
                <label style="font-size:11px; color:gray;">TEMA VISUAL</label>
                <select id="t-sel" style="width:100%; padding:10px; background:#2a3942; color:white; border:none; border-radius:8px; margin-top:5px;">
                    <option value="#075e54,#00a884,#005c4b">Verde Clásico</option>
                    <option value="#1e3a8a,#3b82f6,#1e40af">Azul Galaxia</option>
                    <option value="#581c87,#a855f7,#7e22ce">Violeta Ghost</option>
                </select>
            </div>
            <button onclick="aplicar()" style="width:100%; padding:12px; background:var(--a); color:white; border:none; border-radius:10px; font-weight:bold;">GUARDAR CAMBIOS</button>
            <button onclick="panico()" style="width:100%; margin-top:10px; padding:12px; background:#ff3b30; color:white; border:none; border-radius:10px; font-weight:bold;">🔥 BOTÓN DE PÁNICO</button>
            <button onclick="cerrar()" style="margin-top:15px; background:none; border:none; color:gray;">Cerrar</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Elite 🔒</span>
        <div style="display:flex; gap:18px;">
            <span onclick="invitar()" style="cursor:pointer; font-size:22px;">👤+</span>
            <span onclick="abrir()" style="cursor:pointer; font-size:22px;">⚙️</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-mic" class="btn-act" onclick="toggleAudio()">🎤</button>
        <input type="text" id="m" placeholder="Toca a alguien..." disabled>
        <button onclick="enviar()" class="btn-act">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, nombreDestino = "", mediaRec, chunks = [], grabando = false;

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); }
        }

        function abrir() { document.getElementById('modal').style.display = 'flex'; }
        function cerrar() { document.getElementById('modal').style.display = 'none'; }
        function panico() { document.getElementById('chat').innerHTML = ""; cerrar(); }

        function aplicar() {
            const c = document.getElementById('t-sel').value.split(',');
            document.documentElement.style.setProperty('--p', c[0]);
            document.documentElement.style.setProperty('--a', c[1]);
            document.documentElement.style.setProperty('--m', c[2]);
            cerrar();
        }

        function invitar() {
            if (navigator.share) { navigator.share({ title: 'Chat Privado', url: window.location.href }); }
            else { prompt("Copia el link de invitación:", window.location.href); }
        }

        socket.on('actualizar_lista', (users) => {
            const lista = document.getElementById('lista-contactos');
            lista.innerHTML = "";
            for (let id in users) {
                if (id !== socket.id) {
                    const div = document.createElement('div');
                    div.className = 'con' + (receptorId === id ? ' activo' : '');
                    div.innerText = users[id];
                    div.onclick = () => {
                        receptorId = id;
                        nombreDestino = users[id];
                        document.getElementById('m').disabled = false;
                        document.getElementById('m').placeholder = "Chat con " + users[id];
                        document.querySelectorAll('.con').forEach(c => c.classList.remove('activo'));
                        div.classList.add('activo');
                    };
                    lista.appendChild(div);
                }
            }
        });

        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, nombreDestino, texto: inp.value });
            inp.value = "";
        }

        async function toggleAudio() {
            if(!receptorId) return alert("Elige un contacto");
            const btn = document.getElementById('btn-mic');
            if(!grabando) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRec = new MediaRecorder(stream);
                    chunks = [];
                    mediaRec.ondataavailable = e => chunks.push(e.data);
                    mediaRec.onstop = () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.onload = e => socket.emit('mensaje_privado', { receptorId, nombreDestino, audio: e.target.result });
                        reader.readAsDataURL(blob);
                        stream.getTracks().forEach(track => track.stop());
                    };
                    mediaRec.start();
                    grabando = true; btn.style.background = "#ff3b30"; btn.innerText = "🛑";
                } catch(e) { alert("Activa el permiso de micrófono"); }
            } else {
                mediaRec.stop(); grabando = false; btn.style.background = "var(--a)"; btn.innerText = "🎤";
            }
        }

        socket.on('recibir_privado', (d) => { if(receptorId === d.emisorId || d.nota) poner(d, false); });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            let html = d.texto || "";
            if(d.audio) html = \`<audio src="\${d.audio}" controls style="width:180px;"></audio>\`;
            if(d.nota) html += \`<br><small style="font-size:9px; color:#aaa; font-style:italic;">\${d.nota}</small>\`;
            div.innerHTML = html;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            // Autodestrucción en 30 segundos
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 30000);
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
