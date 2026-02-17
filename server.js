const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let usuariosOnline = {}; 
let mensajesPendientes = {}; 

app.get('/manifest.json', (req, res) => {
    res.json({
        "short_name": "PyChat",
        "name": "PyChat WhatsApp God Mode",
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

    socket.on('escribiendo', (datos) => {
        if(usuariosOnline[datos.receptorId]) {
            socket.to(datos.receptorId).emit('usuario_escribiendo', { emisorId: socket.id });
        }
    });

    socket.on('mensaje_privado', (datos) => {
        const paquete = {
            texto: datos.texto, 
            imagen: datos.imagen,
            audio: datos.audio,
            emisorId: socket.id, 
            emisorNombre: socket.nombre,
            hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        
        if (usuariosOnline[datos.receptorId]) {
            socket.to(datos.receptorId).emit('recibir_privado', paquete);
            socket.emit('confirmacion_visto', { emisorId: socket.id });
        } else if (datos.nombreDestino) {
            if (!mensajesPendientes[datos.nombreDestino]) mensajesPendientes[datos.nombreDestino] = [];
            mensajesPendientes[datos.nombreDestino].push(paquete);
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <link rel="manifest" href="/manifest.json">
    <title>PyChat WhatsApp God Mode</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; --fs: 15px; --wall: none; }
        body { margin: 0; font-family: 'Segoe UI', Roboto, sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        
        .header { background: var(--p); padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; z-index: 20; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .status-info { font-size: 11px; color: var(--a); height: 14px; font-weight: normal; }

        #agenda-bar { background: var(--bg); padding: 10px; display: flex; gap: 15px; overflow-x: auto; border-bottom: 1px solid #222; scrollbar-width: none; }
        .contact-pill { display: flex; flex-direction: column; align-items: center; min-width: 65px; cursor: pointer; position: relative; }
        .avatar { width: 50px; height: 50px; background: #374045; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 2px solid transparent; transition: 0.3s; }
        .online .avatar { border-color: var(--a); }
        .active .avatar { background: var(--a); transform: scale(1.1); }

        #chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 8px; background-image: var(--wall); background-size: cover; background-attachment: fixed; }
        .msg { padding: 8px 12px; border-radius: 12px; max-width: 75%; font-size: var(--fs); position: relative; box-shadow: 0 1px 1px rgba(0,0,0,0.2); animation: fadeIn 0.3s; }
        .mio { align-self: flex-end; background: var(--m); border-top-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--o); border-top-left-radius: 2px; }
        .check { font-size: 11px; margin-left: 5px; color: #34b7f1; font-weight: bold; }
        
        .input-bar { background: #202c33; padding: 10px; display: flex; gap: 10px; align-items: center; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
        #m { flex: 1; border: none; padding: 12px 15px; border-radius: 25px; background: #2a3942; color: white; outline: none; font-size: 16px; }
        .btn-icon { background: none; border: none; color: #8696a0; font-size: 24px; cursor: pointer; padding: 5px; }
        .btn-send { background: var(--a); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }

        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 100; align-items: center; justify-content: center; }
        .modal-box { background: #1c272d; padding: 25px; border-radius: 25px; width: 85%; max-width: 360px; border: 1px solid #333; }
        input[type="text"], select { width: 100%; margin-bottom: 15px; border-radius: 10px; border: none; padding: 12px; background: #2a3942; color: white; box-sizing: border-box; }
        
        #login-screen { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; align-items: center; justify-content: center; text-align: center; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <audio id="notif-sound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>

    <div id="login-screen">
        <div style="width: 80%;">
            <div style="font-size: 60px;">🔱</div>
            <h2 style="color:var(--a); margin: 10px 0;">PyChat God Mode</h2>
            <input type="text" id="nick" placeholder="Ingresa tu nombre..." style="text-align:center;">
            <button onclick="entrar()" style="width:100%; padding:15px; border:none; border-radius:12px; background:var(--a); color:white; font-weight:bold; cursor:pointer;">EMPEZAR</button>
        </div>
    </div>

    <div id="modal-settings" class="modal">
        <div class="modal-box">
            <h3 style="margin-top:0; color:var(--a); text-align:center;">Ajustes de Elite ⚙️</h3>
            <label style="font-size:12px; color:gray;">Color de Marca</label>
            <input type="color" id="c-a" onchange="actualizar()" style="width:100%; height:40px; border:none; background:none; cursor:pointer;">
            <label style="font-size:12px; color:gray;">Fondo del Chat</label>
            <input type="text" id="wall-url" placeholder="URL de imagen (JPG/PNG)" onchange="actualizar()">
            <select id="f-size" onchange="actualizar()">
                <option value="13px">Letra Pequeña</option>
                <option value="15px" selected>Letra Normal</option>
                <option value="18px">Letra Grande</option>
            </select>
            <button onclick="borrarAgenda()" style="width:100%; background:#444; color:white; border:none; padding:12px; border-radius:10px; margin-top:10px;">Limpiar Agenda</button>
            <button onclick="panico()" style="width:100%; background:#e74c3c; color:white; border:none; padding:12px; border-radius:10px; margin-top:10px; font-weight:bold;">🔥 BOTÓN DE PÁNICO</button>
            <button onclick="cerrar()" style="width:100%; background:var(--a); color:white; border:none; padding:12px; border-radius:10px; margin-top:15px; font-weight:bold;">LISTO</button>
        </div>
    </div>

    <div class="header">
        <div>
            <div id="user-title" style="font-weight:bold; letter-spacing:0.5px;">PyChat</div>
            <div id="status-escribiendo" class="status-info"></div>
        </div>
        <div style="display:flex; gap:18px; font-size:24px;">
            <span onclick="abrirAgendaNativa()" style="cursor:pointer">👤</span>
            <span onclick="abrirConfig()" style="cursor:pointer">⚙️</span>
        </div>
    </div>

    <div id="agenda-bar"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button class="btn-icon" onclick="document.getElementById('img-in').click()">📎</button>
        <input type="file" id="img-in" style="display:none" accept="image/*" onchange="enviarImagen(this)">
        <input type="text" id="m" placeholder="Escribe un mensaje" disabled oninput="notificarEscribiendo()">
        <button id="mic-btn" class="btn-icon" onclick="toggleAudio()">🎤</button>
        <button onclick="enviar()" class="btn-send">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, nombreDestino = "", escribiendoTimeout;
        let agenda = JSON.parse(localStorage.getItem('py_god_agenda') || '{}');

        window.onload = () => {
            const s = localStorage.getItem('py_god_user');
            if(s) { miNick = s; document.getElementById('login-screen').style.display='none'; socket.emit('nuevo_usuario', miNick); document.getElementById('user-title').innerText = miNick; }
            cargarSkin();
            renderAgenda({});
        };

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { localStorage.setItem('py_god_user', miNick); location.reload(); }
        }

        socket.on('actualizar_lista', (online) => { renderAgenda(online); });

        function renderAgenda(online) {
            const bar = document.getElementById('agenda-bar');
            bar.innerHTML = "";
            let combinada = {...agenda};
            for(let id in online) {
                if(online[id] !== miNick) {
                    combinada[online[id]] = id;
                    if(!agenda[online[id]]) { agenda[online[id]] = id; localStorage.setItem('py_god_agenda', JSON.stringify(agenda)); }
                }
            }
            for(let nombre in combinada) {
                const isOnline = Object.values(online).includes(nombre);
                const pill = document.createElement('div');
                pill.className = \`contact-pill \${isOnline ? 'online' : ''} \${nombre === nombreDestino ? 'active' : ''}\`;
                pill.innerHTML = \`<div class="avatar">\${nombre[0].toUpperCase()}</div><span style="font-size:11px; margin-top:5px; color:\${isOnline ? 'white' : 'gray'}">\${nombre}</span>\`;
                pill.onclick = () => { 
                    nombreDestino = nombre;
                    receptorId = isOnline ? Object.keys(online).find(k => online[k] === nombre) : null;
                    document.getElementById('m').disabled = false;
                    document.getElementById('m').placeholder = "Chat con " + nombre;
                    renderAgenda(online);
                };
                bar.appendChild(pill);
            }
        }

        async function abrirAgendaNativa() {
            if ('contacts' in navigator) {
                try {
                    const contacts = await navigator.contacts.select(['tel'], {multiple: false});
                    if(contacts.length) window.open(\`https://wa.me/\${contacts[0].tel[0].replace(/\\D/g, '')}?text=\${encodeURIComponent("Hablemos en privado: "+window.location.href)}\`);
                } catch(e) { navigator.share({url: window.location.href}); }
            } else { navigator.share({url: window.location.href}); }
        }

        function notificarEscribiendo() {
            if(receptorId) socket.emit('escribiendo', { receptorId });
        }

        socket.on('usuario_escribiendo', (d) => {
            if(d.emisorId === receptorId) {
                document.getElementById('status-escribiendo').innerText = "escribiendo...";
                clearTimeout(escribiendoTimeout);
                escribiendoTimeout = setTimeout(() => { document.getElementById('status-escribiendo').innerText = ""; }, 2000);
            }
        });

        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !nombreDestino) return;
            socket.emit('mensaje_privado', { receptorId, nombreDestino, texto: inp.value });
            inp.value = "";
        }

        function enviarImagen(input) {
            if(input.files[0]) {
                const r = new FileReader();
                r.onload = (e) => socket.emit('mensaje_privado', { receptorId, nombreDestino, imagen: e.target.result });
                r.readAsDataURL(input.files[0]);
            }
        }

        let mediaRecorder;
        function toggleAudio() {
            if(!receptorId) return;
            if(!mediaRecorder || mediaRecorder.state === "inactive") {
                navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.start();
                    document.getElementById('mic-btn').style.color = "#e74c3c";
                    mediaRecorder.ondataavailable = (e) => {
                        const r = new FileReader();
                        r.onload = (f) => socket.emit('mensaje_privado', { receptorId, nombreDestino, audio: f.target.result });
                        r.readAsDataURL(e.data);
                    };
                });
            } else {
                mediaRecorder.stop();
                document.getElementById('mic-btn').style.color = "#8696a0";
            }
        }

        socket.on('recibir_privado', (d) => { poner(d, false); document.getElementById('notif-sound').play(); });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            let content = d.texto ? \`<div>\${d.texto}</div>\` : "";
            if(d.imagen) content += \`<img src="\${d.imagen}" style="max-width:100%; border-radius:8px; margin-top:5px;">\`;
            if(d.audio) content += \`<audio src="\${d.audio}" controls style="width:200px; height:35px; margin-top:5px;"></audio>\`;
            div.innerHTML = \`\${content}<div style="font-size:9px; text-align:right; margin-top:5px; opacity:0.6;">\${d.hora} \${mio ? '<span class="check">✓✓</span>' : ''}</div>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 120000); // 2 min de vida
        }

        function abrirConfig() { document.getElementById('modal-settings').style.display='flex'; }
        function cerrar() { document.getElementById('modal-settings').style.display='none'; }
        function panico() { document.getElementById('chat').innerHTML = ""; cerrar(); }
        function borrarAgenda() { localStorage.removeItem('py_god_agenda'); location.reload(); }
        
        function actualizar() {
            const s = { a: document.getElementById('c-a').value, f: document.getElementById('f-size').value, w: document.getElementById('wall-url').value };
            localStorage.setItem('py_god_skin', JSON.stringify(s));
            aplicarSkin(s);
        }
        function cargarSkin() {
            const s = JSON.parse(localStorage.getItem('py_god_skin'));
            if(s) { document.getElementById('c-a').value = s.a; document.getElementById('f-size').value = s.f; document.getElementById('wall-url').value = s.w || ""; aplicarSkin(s); }
        }
        function aplicarSkin(s) {
            document.documentElement.style.setProperty('--a', s.a);
            document.documentElement.style.setProperty('--fs', s.f);
            document.documentElement.style.setProperty('--wall', s.w ? \`url('\${s.w}')\` : 'none');
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
