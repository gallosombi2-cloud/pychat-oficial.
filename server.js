const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- SERVIDOR ---
io.on('connection', (socket) => {
    socket.on('nuevo_usuario', (user) => {
        socket.broadcast.emit('mensaje_recibido', { 
            texto: `${user.nombre} se ha unido`, 
            tipo: 'sistema' 
        });
    });

    socket.on('mensaje_enviado', (data) => {
        socket.broadcast.emit('mensaje_recibido', data);
    });

    socket.on('escribiendo', (n) => socket.broadcast.emit('usuario_escribiendo', n));
    socket.on('dejo_de_escribir', () => socket.broadcast.emit('usuario_paró'));
});

// --- INTERFAZ PyChat ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Oficial</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #075E54; --bg-chat: #e5ddd5; }
        body { margin: 0; font-family: sans-serif; background: #f0f2f5; }
        #login-screen { position: fixed; inset: 0; background: var(--py-green); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .login-card { background: white; padding: 25px; border-radius: 15px; text-align: center; width: 280px; }
        .header { background: var(--py-green); color: white; padding: 15px; font-weight: bold; position: sticky; top: 0; }
        #chat { height: calc(100vh - 130px); background: var(--bg-chat); padding: 15px; overflow-y: auto; display: flex; flex-direction: column; }
        .mensaje { max-width: 80%; padding: 8px 12px; margin-bottom: 8px; border-radius: 10px; font-size: 14px; position: relative; }
        .enviado { align-self: flex-end; background: #dcf8c6; }
        .recibido { align-self: flex-start; background: #ffffff; }
        .sistema { align-self: center; background: #fff3cd; font-size: 11px; padding: 4px 10px; border-radius: 5px; margin: 5px; }
        .input-area { background: #f0f0f0; padding: 10px; display: flex; gap: 8px; }
        input { flex: 1; border: 1px solid #ddd; padding: 12px; border-radius: 20px; outline: none; }
        button { background: var(--py-green); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; }
    </style>
</head>
<body>
    <audio id="sonido" src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"></audio>

    <div id="login-screen">
        <div class="login-card" id="box">
            <h2 style="color:var(--py-green)">PyChat</h2>
            <input type="text" id="nom" placeholder="Tu Nombre" style="width:90%; margin-bottom:10px;">
            <input type="text" id="con" placeholder="Teléfono o Correo" style="width:90%; margin-bottom:15px;">
            <button onclick="paso1()" style="width:100%; border-radius:10px;">Continuar</button>
        </div>
    </div>

    <div class="header">PyChat <small id="typing" style="margin-left:10px; font-weight:normal; opacity:0.8;"></small></div>
    <div id="chat"></div>
    <div class="input-area">
        <input id="msg" type="text" placeholder="Mensaje..." onkeypress="teclando()">
        <button onclick="enviar()">➤</button>
    </div>

    <script>
        const socket = io();
        let miUser = { nombre: '', contacto: '' };
        let miCod = "";

        // Al cargar: verificar si ya existe sesión
        window.onload = () => {
            const n = localStorage.getItem('p_n');
            const c = localStorage.getItem('p_c');
            if(n && c) {
                miUser.nombre = n; miUser.contacto = c;
                document.getElementById('login-screen').style.display = 'none';
                socket.emit('nuevo_usuario', miUser);
            }
        };

        function paso1() {
            const n = document.getElementById('nom').value;
            const c = document.getElementById('con').value;
            if(!n || !c) return alert("Llena los campos");
            
            miUser.nombre = n; miUser.contacto = c;
            miCod = Math.floor(100000 + Math.random() * 900000).toString();
            
            document.getElementById('box').innerHTML = \`
                <h3>Verificación</h3>
                <p>Tu código es: <b style="font-size:22px;">\${miCod}</b></p>
                <input type="text" id="v_in" placeholder="000000" style="width:80%; text-align:center; font-size:20px;">
                <button onclick="paso2()" style="width:100%; margin-top:15px; border-radius:10px;">Verificar</button>
            \`;
        }

        function paso2() {
            if(document.getElementById('v_in').value === miCod) {
                localStorage.setItem('p_n', miUser.nombre);
                localStorage.setItem('p_c', miUser.contacto);
                document.getElementById('login-screen').style.display = 'none';
                socket.emit('nuevo_usuario', miUser);
                if(Notification.permission !== 'granted') Notification.requestPermission();
            } else { alert("Código mal"); }
        }

        function enviar() {
            const m = document.getElementById('msg');
            if(!m.value) return;
            const d = { n: miUser.nombre, c: miUser.contacto, t: m.value };
            socket.emit('mensaje_enviado', d);
            ponerMsg(d, 'enviado');
            m.value = '';
        }

        socket.on('mensaje_recibido', (d) => {
            ponerMsg(d, d.tipo === 'sistema' ? 'sistema' : 'recibido');
            if(d.n && d.n !== miUser.nombre) {
                document.getElementById('sonido').play();
                if(document.visibilityState !== 'visible') {
                    new Notification(d.n, { body: d.t });
                }
            }
        });

        function teclando() { 
            socket.emit('escribiendo', miUser.nombre);
            setTimeout(() => socket.emit('dejo_de_escribir'), 2000);
        }

        socket.on('usuario_escribiendo', (n) => document.getElementById('typing').textContent = n + ' está escribiendo...');
        socket.on('usuario_paró', () => document.getElementById('typing').textContent = '');

        function ponerMsg(d, clase) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + clase;
            const hora = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            if(clase === 'sistema') {
                div.innerHTML = d.texto;
            } else {
                div.innerHTML = \`\${d.t}<br><small style="font-size:9px; opacity:0.6;">\${d.n} • \${hora} \${clase==='enviado'?'<b>✓✓</b>':''}</small>\`;
            }
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('OK'));
