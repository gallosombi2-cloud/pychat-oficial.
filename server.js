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
            mensajesPendientes[datos.nombreDestino].push({...paquete, nota: "(Offline)"});
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
    <title>PyChat Elite</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { 
            --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; --fs: 15px;
            --wall: none;
        }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        
        .header { background: var(--p); padding: 15px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
        
        #lista-contactos { background: rgba(0,0,0,0.3); padding: 10px; display: flex; gap: 8px; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.1); min-height: 45px; }
        .con { background: var(--o); padding: 7px 15px; border-radius: 20px; cursor: pointer; white-space: nowrap; font-size: 13px; border: 1px solid transparent; }
        .con.activo { background: var(--a); border-color: white; }

        #chat { 
            flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; 
            background-image: var(--wall); background-size: cover; background-position: center;
        }
        
        .msg { padding: 12px; border-radius: 12px; max-width: 85%; font-size: var(--fs); position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .mio { align-self: flex-end; background: var(--m); border-bottom-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--o); border-bottom-left-radius: 2px; }

        .input-bar { background: var(--o); padding: 10px; display: flex; gap: 8px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 20px; background: rgba(255,255,255,0.1); color: white; outline: none; }
        .btn { background: var(--a); color: white; border: none; width: 42px; height: 42px; border-radius: 50%; cursor: pointer; font-size: 20px; }

        #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; overflow-y: auto; }
        .box { background: #1c272d; padding: 20px; border-radius: 20px; width: 85%; max-width: 350px; text-align: left; }
        .box h3 { text-align: center; color: var(--a); margin-top: 0; }
        .box label { display: block; font-size: 12px; color: #aaa; margin: 10px 0 5px; }
        .box input[type="color"], .box input[type="text"], .box select { width: 100%; padding: 8px; border-radius: 5px; border: none; background: #2a3942; color: white; }
        
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <audio id="notificacion-sonido" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>

    <div id="login">
        <div style="text-align:center; width:80%;">
            <h2 style="color:var(--a)">PyChat Elite</h2>
            <input type="text" id="nick" placeholder="¿Cómo te llamas?" style="width:90%; padding:15px; border-radius:10px; border:none; margin-bottom:15px; background:#2a3942; color:white; text-align:center;">
            <button onclick="entrar()" style="width:95%; padding:15px; background:var(--a); color:white; border:none; border-radius:10px; font-weight:bold;">COMENZAR</button>
        </div>
    </div>

    <div id="modal">
        <div class="box">
            <h3>Personalizar App 🎨</h3>
            
            <label>Color Principal (Cabecera)</label>
            <input type="color" id="c-header" onchange="actualizar()">
            
            <label>Color Fondo de Pantalla</label>
            <input type="color" id="c-bg" onchange="actualizar()">

            <label>Burbuja Mis Mensajes</label>
            <input type="color" id="c-mio" onchange="actualizar()">

            <label>Tamaño de Letra</label>
            <select id="f-size" onchange="actualizar()">
                <option value="13px">Pequeña</option>
                <option value="15px" selected>Normal</option>
                <option value="18px">Grande</option>
            </select>

            <label>Link Imagen de Fondo (Wallpaper)</label>
            <input type="text" id="wall-url" placeholder="http://imagen.jpg" onchange="actualizar()">

            <hr style="opacity:0.1; margin:20px 0;">
            
            <button onclick="logout()" style="width:100%; padding:10px; background:#444; color:white; border:none; border-radius:8px; margin-bottom:8px;">Cerrar Sesión</button>
            <button onclick="panico()" style="width:100%; padding:10px; background:red; color:white; border:none; border-radius:8px;">BOTÓN DE PÁNICO</button>
            <button onclick="cerrar()" style="width:100%; margin-top:10px; background:none; border:none; color:gray;">Listo / Volver</button>
        </div>
    </div>

    <div class="header">
        <span id="display-user" style="font-weight:bold;">PyChat 🔒</span>
        <div style="display:flex; gap:18px;">
            <span onclick="seleccionarYCompartir()" style="cursor:pointer; font-size:24px;">👤+</span>
            <span onclick="abrir()" style="cursor:pointer; font-size:24px;">⚙️</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <button id="btn-mic" class="btn" onclick="toggleAudio()">🎤</button>
        <input type="text" id="m" placeholder="Escribe algo..." disabled>
        <button onclick="enviar()" class="btn">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, nombreDestino = "";
        const sonidoNotif = document.getElementById('notificacion-sonido');

        window.onload = () => {
            const savedUser = localStorage.getItem('pychat_user');
            if(savedUser) { 
                miNick = savedUser; 
                document.getElementById('login').style.display = 'none'; 
                socket.emit('nuevo_usuario', miNick); 
                document.getElementById('display-user').innerText = miNick; 
            }
            cargarEstilos();
        };

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) {
                localStorage.setItem('pychat_user', miNick);
                location.reload();
            }
        }

        // --- SISTEMA DE PERSONALIZACIÓN TOTAL ---
        function actualizar() {
            const config = {
                header: document.getElementById('c-header').value,
                bg: document.getElementById('c-bg').value,
                mio: document.getElementById('c-mio').value,
                fs: document.getElementById('f-size').value,
                wall: document.getElementById('wall-url').value
            };
            aplicarEstilos(config);
            localStorage.setItem('pychat_config', JSON.stringify(config));
        }

        function cargarEstilos() {
            const config = JSON.parse(localStorage.getItem('pychat_config'));
            if(config) {
                aplicarEstilos(config);
                // Llenar los inputs del modal con lo guardado
                document.getElementById('c-header').value = config.header;
                document.getElementById('c-bg').value = config.bg;
                document.getElementById('c-mio').value = config.mio;
                document.getElementById('f-size').value = config.fs;
                document.getElementById('wall-url').value = config.wall;
            }
        }

        function aplicarEstilos(c) {
            document.documentElement.style.setProperty('--p', c.header);
            document.documentElement.style.setProperty('--bg', c.bg);
            document.documentElement.style.setProperty('--m', c.mio);
            document.documentElement.style.setProperty('--fs', c.fs);
            if(c.wall) document.documentElement.style.setProperty('--wall', \`url('\${c.wall}')\`);
        }

        // --- FUNCIONES DE APP ---
        async function seleccionarYCompartir() {
            const msj = "¡Hablemos en privado por PyChat! Entra aquí: " + window.location.href;
            if ('contacts' in navigator && 'ContactsManager' in window) {
                try {
                    const contacts = await navigator.contacts.select(['tel'], {multiple: false});
                    if(contacts.length) window.open(\`https://wa.me/\${contacts[0].tel}?text=\${encodeURIComponent(msj)}\`);
                } catch(e) { navigator.share({title:'PyChat', text:msj, url:window.location.href}); }
            } else {
                navigator.share({title:'PyChat', text:msj, url:window.location.href});
            }
        }

        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, nombreDestino, texto: inp.value });
            inp.value = "";
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
                        receptorId = id; nombreDestino = users[id];
                        document.getElementById('m').disabled = false;
                        document.querySelectorAll('.con').forEach(c => c.classList.remove('activo'));
                        div.classList.add('activo');
                    };
                    lista.appendChild(div);
                }
            }
        });

        socket.on('recibir_privado', (d) => { 
            if(receptorId === d.emisorId || d.nota) {
                poner(d, false);
                sonidoNotif.play().catch(()=>{});
            } 
        });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            let content = d.texto || "";
            if(d.audio) content = \`<audio src="\${d.audio}" controls style="width:180px;"></audio>\`;
            div.innerHTML = \`\${content}<div style="font-size:8px; text-align:right; opacity:0.5; margin-top:5px;">\${d.hora}</div>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 60000);
        }

        function logout() { localStorage.removeItem('pychat_user'); location.reload(); }
        function abrir() { document.getElementById('modal').style.display = 'flex'; }
        function cerrar() { document.getElementById('modal').style.display = 'none'; }
        function panico() { document.getElementById('chat').innerHTML = ""; cerrar(); }
        
        async function toggleAudio() {
            if(!receptorId) return;
            const btn = document.getElementById('btn-mic');
            // Lógica de audio simplificada para evitar fallos
            alert("Función de audio activa. Mantén pulsado (Simulado en esta versión para estabilidad)");
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
