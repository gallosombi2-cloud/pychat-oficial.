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
            texto: datos.texto, emisorId: socket.id, emisorNombre: socket.nombre,
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
        :root { --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; --fs: 15px; --wall: none; }
        body { margin: 0; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        .header { background: var(--p); padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        
        #chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background-image: var(--wall); background-size: cover; background-position: center; }
        .msg { padding: 12px; border-radius: 12px; max-width: 85%; font-size: var(--fs); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
        .mio { align-self: flex-end; background: var(--m); }
        .otro { align-self: flex-start; background: var(--o); }

        .input-bar { background: var(--o); padding: 10px; display: flex; gap: 8px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 20px; background: rgba(255,255,255,0.1); color: white; outline: none; }
        .btn { background: var(--a); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 20px; }

        /* Modales */
        .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; }
        .modal-box { background: #1c272d; padding: 25px; border-radius: 25px; width: 85%; max-width: 350px; }
        .modal-box h3 { margin-top: 0; color: var(--a); text-align: center; }
        
        input[type="color"], input[type="text"], select { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #2a3942; color: white; margin-bottom: 15px; box-sizing: border-box; }
        .menu-btn { width: 100%; padding: 15px; border-radius: 12px; border: none; margin-bottom: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
        
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <audio id="notificacion-sonido" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>

    <div id="login">
        <div style="text-align:center; width:80%;">
            <h1 style="color:var(--a); margin-bottom:30px;">PyChat</h1>
            <input type="text" id="nick" placeholder="Tu nombre..." style="text-align:center;">
            <button onclick="entrar()" class="menu-btn" style="background:var(--a); color:white;">ENTRAR AL CHAT</button>
        </div>
    </div>

    <div id="modal-settings" class="modal-overlay">
        <div class="modal-box">
            <h3>Diseño 🎨</h3>
            <label style="font-size:12px; color:gray;">Color Principal</label>
            <input type="color" id="c-header" onchange="actualizarEstilos()">
            <label style="font-size:12px; color:gray;">Fondo del Chat</label>
            <input type="color" id="c-bg" onchange="actualizarEstilos()">
            <label style="font-size:12px; color:gray;">Mis Burbujas</label>
            <input type="color" id="c-mio" onchange="actualizarEstilos()">
            <label style="font-size:12px; color:gray;">Imagen de Fondo (Link)</label>
            <input type="text" id="wall-url" placeholder="https://imagen.jpg" onchange="actualizarEstilos()">
            
            <button onclick="logout()" class="menu-btn" style="background:#444; color:white;">Cerrar Sesión</button>
            <button onclick="document.getElementById('modal-settings').style.display='none'" class="menu-btn" style="background:var(--a); color:white;">GUARDAR Y VOLVER</button>
        </div>
    </div>

    <div id="modal-invite" class="modal-overlay">
        <div class="modal-box">
            <h3>Invitar Amigos 👤</h3>
            <p style="font-size:13px; color:gray; text-align:center;">Selecciona cómo quieres invitar:</p>
            
            <button onclick="invitarAgenda()" class="menu-btn" style="background:#00a884; color:white;">
                📖 Abrir Agenda de Contactos
            </button>
            <button onclick="invitarWhatsApp()" class="menu-btn" style="background:#25D366; color:white;">
                💬 Enviar por WhatsApp
            </button>
            <button onclick="invitarSistema()" class="menu-btn" style="background:#333; color:white;">
                🔗 Compartir Link General
            </button>
            
            <button onclick="document.getElementById('modal-invite').style.display='none'" style="width:100%; background:none; border:none; color:gray; margin-top:10px;">Cancelar</button>
        </div>
    </div>

    <div class="header">
        <span id="display-user" style="font-weight:bold;">PyChat 🔒</span>
        <div style="display:flex; gap:18px;">
            <span onclick="document.getElementById('modal-invite').style.display='flex'" style="cursor:pointer; font-size:24px;">👤+</span>
            <span onclick="document.getElementById('modal-settings').style.display='flex'" style="cursor:pointer; font-size:24px;">⚙️</span>
        </div>
    </div>

    <div id="chat"></div>

    <div class="input-bar">
        <input type="text" id="m" placeholder="Escribe un mensaje..." disabled>
        <button onclick="enviar()" class="btn">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null;
        const sonidoNotif = document.getElementById('notificacion-sonido');

        window.onload = () => {
            const saved = localStorage.getItem('pychat_user');
            if(saved) { 
                miNick = saved; 
                document.getElementById('login').style.display = 'none'; 
                socket.emit('nuevo_usuario', miNick); 
                document.getElementById('display-user').innerText = miNick; 
            }
            cargarConfig();
        };

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { 
                localStorage.setItem('pychat_user', miNick); 
                location.reload(); 
            }
        }

        // --- FUNCIONES DE INVITACIÓN ---
        const linkChat = window.location.href;
        const msgText = "¡Hola! Hablemos en privado por mi app de PyChat: " + linkChat;

        async function invitarAgenda() {
            if ('contacts' in navigator) {
                try {
                    const contacts = await navigator.contacts.select(['tel'], {multiple: false});
                    if(contacts.length) {
                        let tel = contacts[0].tel[0].replace(/\\s/g, '');
                        window.open(\`https://wa.me/\${tel}?text=\${encodeURIComponent(msgText)}\`);
                    }
                } catch(e) { invitarWhatsApp(); }
            } else { alert("Tu navegador no permite acceso directo a la agenda. Prueba la opción de WhatsApp."); }
        }

        function invitarWhatsApp() {
            let num = prompt("Escribe el número de tu amigo (ej: 595981...):");
            if(num) window.open(\`https://wa.me/\${num.replace(/\\+/g, '')}?text=\${encodeURIComponent(msgText)}\`);
        }

        function invitarSistema() {
            if(navigator.share) navigator.share({title:'PyChat', text:msgText, url:linkChat});
            else alert("Copia este link: " + linkChat);
        }

        // --- PERSONALIZACIÓN ---
        function actualizarEstilos() {
            const config = {
                h: document.getElementById('c-header').value,
                b: document.getElementById('c-bg').value,
                m: document.getElementById('c-mio').value,
                w: document.getElementById('wall-url').value
            };
            aplicar(config);
            localStorage.setItem('pychat_theme_v2', JSON.stringify(config));
        }

        function cargarConfig() {
            const c = JSON.parse(localStorage.getItem('pychat_theme_v2'));
            if(c) {
                aplicar(c);
                document.getElementById('c-header').value = c.h;
                document.getElementById('c-bg').value = c.b;
                document.getElementById('c-mio').value = c.m;
                document.getElementById('wall-url').value = c.w;
            }
        }

        function aplicar(c) {
            document.documentElement.style.setProperty('--p', c.h);
            document.documentElement.style.setProperty('--bg', c.b);
            document.documentElement.style.setProperty('--m', c.m);
            if(c.w) document.documentElement.style.setProperty('--wall', \`url('\${c.w}')\`);
        }

        // --- CHAT LOGIC ---
        socket.on('actualizar_lista', (users) => {
            // Elige automáticamente al primer usuario disponible para chatear
            for(let id in users) {
                if(id !== socket.id) {
                    receptorId = id;
                    document.getElementById('m').disabled = false;
                    document.getElementById('m').placeholder = "Chateando con " + users[id];
                }
            }
        });

        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !receptorId) return;
            socket.emit('mensaje_privado', { receptorId, texto: inp.value });
            inp.value = "";
        }

        socket.on('recibir_privado', (d) => { 
            poner(d, false); 
            sonidoNotif.play().catch(()=>{}); 
        });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            div.innerHTML = \`\${d.texto}<div style="font-size:9px; text-align:right; opacity:0.5; margin-top:5px;">\${d.hora}</div>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }

        function logout() { localStorage.removeItem('pychat_user'); location.reload(); }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
