const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- LÓGICA DEL SERVIDOR ---
let estadosGlobales = []; 

io.on('connection', (socket) => {
    socket.emit('cargar_estados', estadosGlobales);

    socket.on('subir_estado', (estado) => {
        const nuevoEstado = { ...estado, id: Date.now() };
        estadosGlobales.unshift(nuevoEstado);
        if(estadosGlobales.length > 20) estadosGlobales.pop();
        io.emit('nuevo_estado_recibido', nuevoEstado);
    });

    socket.on('mensaje_enviado', (data) => socket.broadcast.emit('mensaje_recibido', data));
    
    socket.on('solicitar_limpieza', (pass) => {
        if(pass === "1234") {
            estadosGlobales = [];
            io.emit('limpiar_pantalla_global');
        }
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Ultimate</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #075E54; --bg-chat: #e5ddd5; }
        body { margin: 0; font-family: sans-serif; background: #f0f2f5; overflow: hidden; }
        
        /* ESTADOS */
        .status-bar { background: white; padding: 10px; display: flex; gap: 12px; overflow-x: auto; border-bottom: 1px solid #ddd; height: 85px; align-items: center; }
        .status-item { flex-shrink: 0; text-align: center; width: 60px; position: relative; }
        .status-circle { width: 55px; height: 55px; border-radius: 50%; border: 3px solid #25D366; object-fit: cover; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; text-align: center; overflow: hidden; padding: 2px; }
        .status-name { font-size: 10px; margin-top: 4px; color: #555; }
        
        /* VISOR */
        #status-viewer { position: fixed; inset: 0; background: black; z-index: 200; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #viewer-content { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; text-align: center; padding: 20px; box-sizing: border-box; }

        /* GENERAL */
        .header { background: var(--py-green); color: white; padding: 12px; font-weight: bold; }
        #chat { height: calc(100vh - 220px); background: var(--bg-chat); padding: 15px; overflow-y: auto; display: flex; flex-direction: column; }
        .mensaje { max-width: 80%; padding: 10px; margin-bottom: 8px; border-radius: 12px; font-size: 14px; }
        .enviado { align-self: flex-end; background: #dcf8c6; }
        .recibido { align-self: flex-start; background: white; }
        .input-area { background: #f0f0f0; padding: 10px; display: flex; gap: 8px; }
        .btn-round { background: var(--py-green); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; }
        
        /* MODAL ESTADO */
        #modal-tipo { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 150; display: none; align-items: center; justify-content: center; gap: 20px; }
    </style>
</head>
<body>
    <div id="login-screen" style="position:fixed; inset:0; background:var(--py-green); z-index:300; display:flex; align-items:center; justify-content:center;">
        <div style="background:white; padding:25px; border-radius:20px; text-align:center; width:280px;">
            <h2 style="color:var(--py-green)">PyChat</h2>
            <input type="text" id="nom" placeholder="Tu Nombre" style="width:90%; padding:10px; margin-bottom:10px; border-radius:10px; border:1px solid #ccc;">
            <button onclick="registrar()" style="width:100%; background:var(--py-green); color:white; padding:12px; border:none; border-radius:10px;">Entrar</button>
        </div>
    </div>

    <div id="modal-tipo" onclick="this.style.display='none'">
        <button class="btn-round" style="width:80px; height:80px; background:#25D366;" onclick="document.getElementById('file-in').click()">📷<br>Foto</button>
        <button class="btn-round" style="width:80px; height:80px; background:#9C27B0;" onclick="crearEstadoTexto()">✍️<br>Texto</button>
    </div>

    <div id="status-viewer" onclick="this.style.display='none'">
        <div id="viewer-content"></div>
    </div>

    <div class="header">PyChat Pro</div>
    
    <div class="status-bar" id="status-bar">
        <div class="status-item" onclick="document.getElementById('modal-tipo').style.display='flex'">
            <div class="status-circle" style="background:#eee; border:2px dashed #999; color:#999; font-size:25px;">+</div>
            <div class="status-name">Mi Estado</div>
        </div>
    </div>

    <input type="file" id="file-in" hidden accept="image/*" onchange="subirFoto(this)">

    <div id="chat"></div>

    <div class="input-area">
        <input id="msg" type="text" placeholder="Escribe...">
        <button class="btn-round" onclick="enviar()">➤</button>
    </div>

    <script>
        const socket = io();
        let miUser = { nombre: '' };

        function registrar() {
            const n = document.getElementById('nom').value;
            if(!n) return;
            miUser.nombre = n;
            localStorage.setItem('p_n', n);
            document.getElementById('login-screen').style.display = 'none';
        }

        window.onload = () => {
            const n = localStorage.getItem('p_n');
            if(n) { miUser.nombre = n; document.getElementById('login-screen').style.display = 'none'; }
        };

        // ESTADOS
        function subirFoto(input) {
            const reader = new FileReader();
            reader.onload = () => socket.emit('subir_estado', { n: miUser.nombre, img: reader.result, tipo: 'img' });
            if(input.files[0]) reader.readAsDataURL(input.files[0]);
        }

        function crearEstadoTexto() {
            const txt = prompt("Escribe tu estado:");
            if(!txt) return;
            const colores = ['#9C27B0', '#E91E63', '#2196F3', '#FF9800', '#4CAF50'];
            const color = colores[Math.floor(Math.random()*colores.length)];
            socket.emit('subir_estado', { n: miUser.nombre, texto: txt, fondo: color, tipo: 'txt' });
        }

        socket.on('cargar_estados', (ests) => ests.forEach(e => addEstado(e)));
        socket.on('nuevo_estado_recibido', (e) => addEstado(e));

        function addEstado(e) {
            const bar = document.getElementById('status-bar');
            const div = document.createElement('div');
            div.className = 'status-item';
            const style = e.tipo === 'txt' ? \`background:\${e.fondo}\` : '';
            const content = e.tipo === 'txt' ? e.texto.substring(0,10)+'...' : \`<img src="\${e.img}" style="width:100%;height:100%;object-fit:cover;">\`;
            
            div.innerHTML = \`<div class="status-circle" style="\${style}" onclick="verEstado('\${e.tipo}', '\${e.texto||''}', '\${e.img||''}', '\${e.fondo||''}')">\${content}</div><div class="status-name">\${e.n}</div>\`;
            bar.appendChild(div);
        }

        function verEstado(tipo, txt, img, fondo) {
            const v = document.getElementById('status-viewer');
            const c = document.getElementById('viewer-content');
            v.style.display = 'flex';
            if(tipo === 'txt') {
                c.innerHTML = txt;
                c.style.background = fondo;
            } else {
                c.innerHTML = \`<img src="\${img}" style="max-width:100%; max-height:90vh;">\`;
                c.style.background = 'black';
            }
            setTimeout(() => v.style.display = 'none', 4000);
        }

        // CHAT
        function enviar() {
            const i = document.getElementById('msg');
            if(!i.value) return;
            const d = { n: miUser.nombre, t: i.value };
            socket.emit('mensaje_enviado', d);
            poner(d, 'enviado');
            i.value = '';
        }

        socket.on('mensaje_recibido', (d) => poner(d, 'recibido'));

        function poner(d, c) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + c;
            div.innerHTML = \`<b>\${d.n}</b><br>\${d.t}\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000, () => console.log('Ready'));
