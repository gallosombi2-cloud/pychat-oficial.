const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let usuariosOnline = {}; 
let mensajesPendientes = {}; 

// Configuración PWA para que sea instalable
app.get('/manifest.json', (req, res) => {
    res.json({
        "short_name": "PyChat",
        "name": "PyChat Elite Pro",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0b141a",
        "theme_color": "#075e54",
        "icons": [{ "src": "https://cdn-icons-png.flaticon.com/512/5968/5968771.png", "sizes": "512x512", "type": "image/png" }]
    });
});

io.on('connection', (socket) => {
    socket.emit('actualizar_lista', usuariosOnline);

    socket.on('nuevo_usuario', (nombre) => {
        socket.nombre = nombre;
        usuariosOnline[socket.id] = nombre;
        if (mensajesPendientes[nombre]) {
            mensajesPendientes[nombre].forEach(msg => socket.emit('recibir_privado', msg));
            delete mensajesPendientes[nombre]; 
        }
        io.emit('actualizar_lista', usuariosOnline);
    });

    socket.on('mensaje_privado', (datos) => {
        const paquete = {
            texto: datos.texto, audio: datos.audio,
            emisorId: socket.id, emisorNombre: socket.nombre,
            hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        if (usuariosOnline[datos.receptorId]) {
            socket.to(datos.receptorId).emit('recibir_privado', paquete);
        } else if (datos.nombreDestino) {
            if (!mensajesPendientes[datos.nombreDestino]) mensajesPendientes[datos.nombreDestino] = [];
            mensajesPendientes[datos.nombreDestino].push({...paquete, nota: "(Mensaje Offline)"});
        }
        socket.emit('confirmacion_envio', paquete);
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <link rel="manifest" href="/manifest.json">
    <title>PyChat Elite</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        .header { background: var(--p); padding: 15px; display: flex; justify-content: space-between; align-items: center; }
        #lista-contactos { background: #111b21; padding: 10px; display: flex; gap: 8px; overflow-x: auto; border-bottom: 1px solid #222; min-height: 40px; }
        .con { background: var(--o); padding: 7px 15px; border-radius: 20px; cursor: pointer; white-space: nowrap; font-size: 13px; border: 1px solid transparent; }
        .con.activo { background: var(--a); border-color: white; }
        #chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 10px; border-radius: 10px; max-width: 85%; }
        .mio { align-self: flex-end; background: var(--m); }
        .otro { align-self: flex-start; background: var(--o); }
        .input-bar { background: var(--o); padding: 10px; display: flex; gap: 8px; }
        #m { flex: 1; border: none; padding: 12px; border-radius: 20px; background: #2a3942; color: white; outline: none; }
        .btn { background: var(--a); color: white; border: none; width: 42px; height: 42px; border-radius: 50%; cursor: pointer; }
        #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; }
        .box { background: #1c272d; padding: 20px; border-radius: 15px; width: 80%; max-width: 300px; text-align: center; }
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div id="login">
        <div style="text-align:center; width:80%;">
            <h2 style="color:var(--a)">PyChat Elite</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:90%; padding:12px; border-radius:8px; border:none; margin-bottom:15px;">
            <button onclick="entrar()" style="width:95%; padding:12px; background:var(--a); color:white; border:none; border-radius:8px; font-weight:bold;">INGRESAR</button>
        </div>
    </div>

    <div id="modal">
        <div class="box">
            <h3 style="color:var(--a)">Ajustes ⚙️</h3>
            <select id="t-sel" onchange="cambiarTema(this.value)" style="width:100%; padding:10px; background:#2a3942; color:white; border:none; border-radius:5px; margin-bottom:15px;">
                <option value="#075e54,#00a884,#005c4b">Verde WhatsApp</option>
                <option value="#1e3a8a,#3b82f6,#1e40af">Azul Galaxia</option>
                <option value="#581c87,#a855f7,#7e22ce">Violeta Fantasma</option>
            </select>
            <button onclick="logout()" style="width:100%; padding:10px; background:#444; color:white; border:none; border-radius:5px; margin-bottom:10px;">Cerrar Sesión</button>
            <button onclick="panico()" style="width:100%; padding:10px; background:red; color:white; border:none; border-radius:5px;">🔥 PÁNICO (BORRAR TODO)</button>
            <button onclick="cerrar()" style="margin-top:15px; background:none; border:none; color:gray;">Cerrar</button>
        </div>
    </div>

    <div class="header">
        <span id="display-user">PyChat 🔒</span>
        <div style="display:flex; gap:15px;">
            <span onclick="compartirApp()" style="cursor:pointer; font-size:22px;">👤+</span>
            <span onclick="abrir()" style="cursor:pointer; font-size:22px;">⚙️</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-mic" class="btn" onclick="toggleAudio()">🎤</button>
        <input type="text" id="m" placeholder="Toca un contacto..." disabled>
        <button onclick="enviar()" class="btn">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, nombreDestino = "", mediaRec, chunks = [], grabando = false;

        window.onload = () => {
            const saved = localStorage.getItem('pychat_user');
            if(saved) { miNick = saved; document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); document.getElementById('display-user').innerText = miNick; }
            const tema = localStorage.getItem('pychat_theme');
            if(tema) cambiarTema(tema, false);
        };

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { localStorage.setItem('pychat_user', miNick); document.getElementById('login').style.display = 'none'; socket.emit('nuevo_usuario', miNick); document.getElementById('display-user').innerText = miNick; }
        }

        function cambiarTema(val, save = true) {
            const c = val.split(',');
            document.documentElement.style.setProperty('--p', c[0]);
            document.documentElement.style.setProperty('--a', c[1]);
            document.documentElement.style.setProperty('--m', c[2]);
            if(save) localStorage.setItem('pychat_theme', val);
        }

        async function compartirApp() {
            // Esta función intenta abrir los contactos reales del teléfono si está soportado
            const shareData = { title: 'PyChat Elite', text: '¡Únete a mi chat privado!', url: window.location.href };
            try {
                if (navigator.share) { await navigator.share(shareData); } 
                else { prompt("Copia y envía este link a tus contactos:", window.location.href); }
            } catch (err) { console.log("Error al compartir"); }
        }

        function logout() { localStorage.removeItem('pychat_user'); location.reload(); }
        function abrir() { document.getElementById('modal').style.display = 'flex'; }
        function cerrar() { document.getElementById('modal').style.display = 'none'; }
        function panico() { document.getElementById('chat').innerHTML = ""; cerrar(); }

        socket.on('actualizar_lista', (users) => {
            const lista = document.getElementById('lista-contactos');
            lista.innerHTML = "";
            for (let id in users) {
                if (id !== socket.id) {
                    const div = document.createElement('div');
                    div.className = 'con' + (receptorId === id ? ' activo' : '');
                    div.innerText = users[id];
                    div.onclick = () => {
                        receptorId = id; nombreDestino = users[id];
                        document.getElementById('m').disabled = false;
                        document.getElementById('m').placeholder = "Mensaje a " + users[id];
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
            if(!receptorId) return alert("Selecciona un contacto");
            const btn = document.getElementById('btn-mic');
            if(!grabando) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRec = new MediaRecorder(stream);
                chunks = [];
                mediaRec.ondataavailable = e => chunks.push(e.data);
                mediaRec.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onload = e => socket.emit('mensaje_privado', { receptorId, nombreDestino, audio: e.target.result });
                    reader.readAsDataURL(blob);
                    stream.getTracks().forEach(t => t.stop());
                };
                mediaRec.start();
                grabando = true; btn.style.background = "red";
            } else { mediaRec.stop(); grabando = false; btn.style.background = "var(--a)"; }
        }

        socket.on('recibir_privado', (d) => { if(receptorId === d.emisorId || d.nota) poner(d, false); });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            let content = d.texto || "";
            if(d.audio) content = \`<audio src="\${d.audio}" controls style="width:160px;"></audio>\`;
            if(d.nota) content += \`<br><small style="font-size:9px; opacity:0.6">\${d.nota}</small>\`;
            div.innerHTML = \`\${content}<div style="font-size:8px; text-align:right; opacity:0.5">\${d.hora}</div>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 45000);
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
