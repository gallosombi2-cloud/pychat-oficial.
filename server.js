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
            texto: datos.texto, 
            emisorId: socket.id, 
            emisorNombre: socket.nombre,
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
            --p: #075e54; --a: #00a884; --bg: #0b141a; --m: #005c4b; --o: #202c33; --t: #e9edef; --fs: 15px; --wall: none; 
        }
        body { margin: 0; font-family: 'Segoe UI', sans-serif; height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--t); overflow: hidden; }
        
        /* Header */
        .header { background: var(--p); padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10; }
        
        /* Agenda */
        #agenda-bar { background: rgba(0,0,0,0.2); padding: 10px; display: flex; gap: 10px; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .contact-pill { background: var(--o); padding: 8px 15px; border-radius: 20px; font-size: 12px; cursor: pointer; white-space: nowrap; border: 1px solid transparent; transition: 0.3s; }
        .contact-pill.online { border-color: var(--a); }
        .contact-pill.active { background: var(--a); color: white; transform: scale(1.05); }

        /* Chat Area */
        #chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background-image: var(--wall); background-size: cover; background-position: center; }
        .msg { padding: 12px; border-radius: 12px; max-width: 80%; font-size: var(--fs); box-shadow: 0 1px 2px rgba(0,0,0,0.3); position: relative; word-wrap: break-word; }
        .mio { align-self: flex-end; background: var(--m); border-bottom-right-radius: 2px; }
        .otro { align-self: flex-start; background: var(--o); border-bottom-left-radius: 2px; }

        /* Input */
        .input-bar { background: var(--o); padding: 10px; display: flex; gap: 8px; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
        #m { flex: 1; border: none; padding: 12px; border-radius: 20px; background: rgba(255,255,255,0.1); color: white; outline: none; }
        .btn { background: var(--a); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; }

        /* Modales */
        .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; align-items: center; justify-content: center; }
        .modal-box { background: #1c272d; padding: 20px; border-radius: 25px; width: 85%; max-width: 350px; max-height: 80vh; overflow-y: auto; }
        .modal-box h3 { margin-top: 0; color: var(--a); text-align: center; }
        
        .config-row { margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        input[type="color"] { border: none; width: 40px; height: 40px; background: none; cursor: pointer; }
        input[type="text"], select { width: 100%; padding: 10px; border-radius: 10px; border: none; background: #2a3942; color: white; margin-top: 5px; box-sizing: border-box; }
        
        .menu-btn { width: 100%; padding: 14px; border-radius: 12px; border: none; margin-top: 10px; font-weight: bold; cursor: pointer; color: white; }
        #login { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <audio id="notificacion-sonido" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>

    <div id="login">
        <div style="text-align:center; width:80%;">
            <h1 style="color:var(--a)">PyChat</h1>
            <input type="text" id="nick" placeholder="Tu apodo aquí..." style="text-align:center;">
            <button onclick="entrar()" class="menu-btn" style="background:var(--a)">COMENZAR</button>
        </div>
    </div>

    <div id="modal-settings" class="modal-overlay">
        <div class="modal-box">
            <h3>Configuración ⚙️</h3>
            
            <div class="config-row"><span>Cabecera</span><input type="color" id="c-header" onchange="aplicarTodo()"></div>
            <div class="config-row"><span>Fondo App</span><input type="color" id="c-bg" onchange="aplicarTodo()"></div>
            <div class="config-row"><span>Mis Mensajes</span><input type="color" id="c-mio" onchange="aplicarTodo()"></div>
            <div class="config-row"><span>Mensajes Amigo</span><input type="color" id="c-otro" onchange="aplicarTodo()"></div>
            
            <label style="font-size:12px;">Tamaño de Texto</label>
            <select id="f-size" onchange="aplicarTodo()">
                <option value="12px">Pequeño</option>
                <option value="15px" selected>Normal</option>
                <option value="18px">Grande</option>
                <option value="22px">Extra Grande</option>
            </select>

            <label style="font-size:12px; margin-top:10px; display:block;">Imagen de Fondo (URL)</label>
            <input type="text" id="wall-url" placeholder="Pega el link de una imagen..." onchange="aplicarTodo()">

            <hr style="opacity:0.1; margin: 15px 0;">
            
            <button onclick="borrarAgenda()" class="menu-btn" style="background:#444;">Limpiar Agenda</button>
            <button onclick="panico()" class="menu-btn" style="background:red;">BORRAR CHAT ACTUAL</button>
            <button onclick="logout()" class="menu-btn" style="background:#222;">Cerrar Sesión</button>
            <button onclick="cerrar()" class="menu-btn" style="background:var(--a);">CERRAR Y GUARDAR</button>
        </div>
    </div>

    <div class="header">
        <span id="display-user" style="font-weight:bold;">PyChat</span>
        <div style="display:flex; gap:18px;">
            <span onclick="abrirAgendaNativa()" style="cursor:pointer; font-size:24px;">👤+</span>
            <span onclick="abrir()" style="cursor:pointer; font-size:24px;">⚙️</span>
        </div>
    </div>

    <div id="agenda-bar"></div>
    <div id="chat"></div>

    <div class="input-bar">
        <input type="text" id="m" placeholder="Selecciona un amigo..." disabled>
        <button onclick="enviar()" class="btn">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "", receptorId = null, nombreDestino = "";
        let agenda = JSON.parse(localStorage.getItem('pychat_agenda') || '{}');

        window.onload = () => {
            const saved = localStorage.getItem('pychat_user');
            if(saved) { 
                miNick = saved; 
                document.getElementById('login').style.display = 'none'; 
                socket.emit('nuevo_usuario', miNick); 
                document.getElementById('display-user').innerText = miNick; 
            }
            cargarConfig();
            actualizarUIAgenda({});
        };

        function entrar() {
            miNick = document.getElementById('nick').value.trim();
            if(miNick) { localStorage.setItem('pychat_user', miNick); location.reload(); }
        }

        // --- AGENDA Y CONTACTOS ---
        socket.on('actualizar_lista', (usersOnline) => {
            actualizarUIAgenda(usersOnline);
        });

        function actualizarUIAgenda(online) {
            const bar = document.getElementById('agenda-bar');
            bar.innerHTML = "";
            
            // Unir agenda guardada con los que están conectados ahora
            let listaCompleta = {...agenda};
            for(let id in online) {
                if(online[id] !== miNick) {
                    listaCompleta[online[id]] = id;
                    if(!agenda[online[id]]) {
                        agenda[online[id]] = id;
                        localStorage.setItem('pychat_agenda', JSON.stringify(agenda));
                    }
                }
            }

            for(let nombre in listaCompleta) {
                const isOnline = Object.values(online).includes(nombre);
                const div = document.createElement('div');
                div.className = \`contact-pill \${isOnline ? 'online' : ''} \${nombre === nombreDestino ? 'active' : ''}\`;
                div.innerText = (isOnline ? '● ' : '○ ') + nombre;
                div.onclick = () => {
                    nombreDestino = nombre;
                    receptorId = isOnline ? Object.keys(online).find(k => online[k] === nombre) : null;
                    document.getElementById('m').disabled = false;
                    document.getElementById('m').placeholder = "Chat con " + nombre;
                    actualizarUIAgenda(online);
                };
                bar.appendChild(div);
            }
        }

        // --- CONTACTOS DEL TELÉFONO ---
        async function abrirAgendaNativa() {
            if ('contacts' in navigator) {
                try {
                    const contacts = await navigator.contacts.select(['tel'], {multiple: false});
                    if(contacts.length) {
                        let tel = contacts[0].tel[0].replace(/\\D/g, '');
                        window.open(\`https://wa.me/\${tel}?text=\${encodeURIComponent("Hablemos por PyChat: " + window.location.href)}\`);
                    }
                } catch(e) { compartirGen(); }
            } else { compartirGen(); }
        }
        function compartirGen() { navigator.share ? navigator.share({title:'PyChat', url:window.location.href}) : prompt("Copia el link:", window.location.href); }

        // --- CONFIGURACIÓN Y ESTILOS ---
        function aplicarTodo() {
            const conf = {
                h: document.getElementById('c-header').value,
                bg: document.getElementById('c-bg').value,
                m: document.getElementById('c-mio').value,
                o: document.getElementById('c-otro').value,
                f: document.getElementById('f-size').value,
                w: document.getElementById('wall-url').value
            };
            
            document.documentElement.style.setProperty('--p', conf.h);
            document.documentElement.style.setProperty('--bg', conf.bg);
            document.documentElement.style.setProperty('--m', conf.m);
            document.documentElement.style.setProperty('--o', conf.o);
            document.documentElement.style.setProperty('--fs', conf.f);
            if(conf.w) document.documentElement.style.setProperty('--wall', \`url('\${conf.w}')\`);
            else document.documentElement.style.setProperty('--wall', 'none');

            localStorage.setItem('pychat_v4_conf', JSON.stringify(conf));
        }

        function cargarConfig() {
            const c = JSON.parse(localStorage.getItem('pychat_v4_conf'));
            if(c) {
                document.getElementById('c-header').value = c.h;
                document.getElementById('c-bg').value = c.bg;
                document.getElementById('c-mio').value = c.m;
                document.getElementById('c-otro').value = c.o || "#202c33";
                document.getElementById('f-size').value = c.f;
                document.getElementById('wall-url').value = c.w || "";
                aplicarTodo();
            }
        }

        // --- LOGICA DE MENSAJES ---
        function enviar() {
            const inp = document.getElementById('m');
            if(!inp.value || !nombreDestino) return;
            socket.emit('mensaje_privado', { receptorId, nombreDestino, texto: inp.value });
            inp.value = "";
        }

        socket.on('recibir_privado', (d) => { 
            poner(d, false); 
            document.getElementById('notificacion-sonido').play().catch(()=>{}); 
        });
        socket.on('confirmacion_envio', (d) => { poner(d, true); });

        function poner(d, mio) {
            const div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : 'otro');
            div.innerHTML = \`\${d.texto}<div style="font-size:9px; text-align:right; opacity:0.5; margin-top:5px;">\${d.hora}</div>\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            
            // Auto-eliminación tras 60 seg
            setTimeout(() => {
                div.style.opacity = '0';
                setTimeout(() => div.remove(), 500);
            }, 60000);
        }

        function abrir() { document.getElementById('modal-settings').style.display='flex'; }
        function cerrar() { document.getElementById('modal-settings').style.display='none'; }
        function logout() { localStorage.clear(); location.reload(); }
        function panico() { document.getElementById('chat').innerHTML = ""; cerrar(); }
        function borrarAgenda() { localStorage.removeItem('pychat_agenda'); location.reload(); }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
