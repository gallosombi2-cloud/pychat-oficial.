const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- LÓGICA DEL SERVIDOR ---
let estadosGlobales = []; 
let usuariosConectados = {}; 

io.on('connection', (socket) => {
    socket.emit('cargar_estados', estadosGlobales);

    socket.on('nuevo_usuario', (user) => {
        usuariosConectados[user.nombre] = socket.id;
        io.emit('lista_usuarios_activos', Object.keys(usuariosConectados));
        socket.broadcast.emit('mensaje_recibido', { texto: `${user.nombre} se unió`, tipo: 'sistema' });
    });

    socket.on('mensaje_privado', (data) => {
        const idDestino = usuariosConectados[data.para];
        if (idDestino) {
            socket.to(idDestino).emit('mensaje_recibido', { ...data, privado: true });
        }
    });

    socket.on('mensaje_enviado', (data) => {
        socket.broadcast.emit('mensaje_recibido', data);
    });

    socket.on('disconnect', () => {
        for(let nombre in usuariosConectados){
            if(usuariosConectados[nombre] === socket.id) {
                delete usuariosConectados[nombre];
                break;
            }
        }
        io.emit('lista_usuarios_activos', Object.keys(usuariosConectados));
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Pro Max</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --py-dark: #075E54; --bg-chat: #efeae2; --py-blue: #34b7f1; --notif-red: #ff3b30; }
        body { margin: 0; font-family: sans-serif; background: #f0f2f5; overflow: hidden; display: flex; flex-direction: column; height: 100vh; }
        .header { background: var(--py-green); color: white; padding: 0 15px; display: flex; justify-content: space-between; align-items: center; height: 55px; flex-shrink: 0; }
        .user-list { background: white; padding: 10px; display: flex; gap: 10px; overflow-x: auto; border-bottom: 1px solid #ddd; flex-shrink: 0; align-items: center; }
        .user-tag { background: #f0f2f5; color: #54656f; padding: 6px 15px; border-radius: 20px; font-size: 13px; cursor: pointer; white-space: nowrap; border: 1px solid #ddd; position: relative; }
        .user-tag.active { background: var(--py-blue); color: white; border-color: var(--py-blue); font-weight: bold; }
        .badge { position: absolute; top: -5px; right: -5px; background: var(--notif-red); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 2px solid white; display: none; }
        #chat { flex-grow: 1; background: var(--bg-chat); background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); padding: 15px; overflow-y: auto; display: flex; flex-direction: column; }
        .mensaje { max-width: 85%; padding: 8px 12px; margin-bottom: 6px; border-radius: 8px; font-size: 14.5px; }
        .enviado { align-self: flex-end; background: #d9fdd3; }
        .recibido { align-self: flex-start; background: white; }
        .privado-msg { border: 2px solid var(--py-blue); }
        .input-area { background: #f0f2f5; padding: 10px; border-top: 1px solid #ddd; }
        .controls { display: flex; gap: 8px; align-items: center; }
        input { flex: 1; border: none; padding: 12px 15px; border-radius: 25px; outline: none; }
        .btn-act { background: var(--py-green); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; }
    </style>
</head>
<body>
    <audio id="sonido" src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"></audio>
    <div id="login-screen" style="position:fixed; inset:0; background:var(--py-green); z-index:4000; display:flex; align-items:center; justify-content:center;">
        <div style="background:white; padding:30px; border-radius:20px; text-align:center; width:80%;">
            <h2>PyChat Pro</h2>
            <input type="text" id="nom" placeholder="Tu Nombre..." style="width:100%; padding:12px; margin-bottom:15px; border-radius:10px; border:1px solid #ccc; box-sizing:border-box;">
            <button onclick="registrar()" style="width:100%; background:var(--py-green); color:white; padding:12px; border:none; border-radius:10px; font-weight:bold;">ENTRAR</button>
        </div>
    </div>
    <div class="header"><h1>PyChat Pro</h1></div>
    <div class="user-list" id="user-list"><div class="user-tag active" id="tag-todos" onclick="seleccionarChat('')">🌐 Todos</div></div>
    <div id="chat"></div>
    <div class="input-area">
        <div id="dest-label" style="font-size:11px; color:var(--py-blue); font-weight:bold; display:none; margin-bottom:5px;">🔒 PRIVADO PARA: <span></span></div>
        <div class="controls">
            <input id="msg" type="text" placeholder="Mensaje para todos..." autocomplete="off">
            <button class="btn-act" id="send-btn" onclick="enviar()">➤</button>
        </div>
    </div>
    <script>
        const socket = io();
        let miUser = { nombre: '' };
        let chatPrivadoCon = '';
        let notificaciones = {};

        function registrar() {
            const n = document.getElementById('nom').value;
            if(!n) return;
            miUser.nombre = n;
            document.getElementById('login-screen').style.display = 'none';
            socket.emit('nuevo_usuario', miUser);
        }

        socket.on('lista_usuarios_activos', (nombres) => {
            const list = document.getElementById('user-list');
            list.innerHTML = '<div class="user-tag active" id="tag-todos" onclick="seleccionarChat(\\'\\')">🌐 Todos</div>';
            nombres.forEach(n => {
                if(n !== miUser.nombre) {
                    const div = document.createElement('div');
                    div.className = 'user-tag';
                    div.id = 'tag-' + n;
                    div.innerHTML = \`\${n} <span class="badge" id="badge-\${n}">0</span>\`;
                    div.onclick = () => seleccionarChat(n);
                    list.appendChild(div);
                }
            });
        });

        function seleccionarChat(nombre) {
            chatPrivadoCon = nombre;
            document.querySelectorAll('.user-tag').forEach(t => t.classList.remove('active'));
            if(nombre === '') {
                document.getElementById('tag-todos').classList.add('active');
                document.getElementById('dest-label').style.display = 'none';
            } else {
                document.getElementById('tag-' + nombre).classList.add('active');
                document.getElementById('dest-label').style.display = 'block';
                document.getElementById('dest-label').querySelector('span').innerText = nombre.toUpperCase();
                document.getElementById('badge-' + nombre).style.display = 'none';
            }
        }

        function enviar() {
            const i = document.getElementById('msg');
            if(!i.value) return;
            const datos = { n: miUser.nombre, texto: i.value, para: chatPrivadoCon };
            if(chatPrivadoCon) {
                socket.emit('mensaje_privado', datos);
                poner({ ...datos, privado: true }, 'enviado');
            } else {
                socket.emit('mensaje_enviado', datos);
                poner(datos, 'enviado');
            }
            i.value = '';
        }

        socket.on('mensaje_recibido', (d) => {
            document.getElementById('sonido').play();
            if(d.privado && chatPrivadoCon !== d.n) {
                const badge = document.getElementById('badge-' + d.n);
                if(badge) badge.style.display = 'block';
            }
            poner(d, 'recibido');
        });

        function poner(d, c) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + c + (d.privado ? ' privado-msg' : '');
            let tag = d.privado ? '🔒 ' + (c==='enviado'?'Para '+d.para : d.n) : d.n;
            div.innerHTML = \`<b style="font-size:10px; display:block;">\${tag}</b>\${d.texto}\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Servidor corriendo en el puerto 3000');
});
