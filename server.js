const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Datastore({ filename: 'chat.db', autoload: true });

io.on('connection', (socket) => {
    db.find({}).sort({ timestamp: 1 }).exec((err, docs) => {
        if (!err) socket.emit('cargar_historial', docs);
    });
    socket.on('nuevo_usuario', (u) => { socket.nombre = u.nombre; });
    socket.on('mensaje_enviado', (d) => {
        db.insert({ ...d, timestamp: Date.now() });
        socket.broadcast.emit('mensaje_recibido', d);
    });
    socket.on('borrar_todo', () => {
        db.remove({}, { multi: true }, () => io.emit('limpiar'));
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --bg-chat: #efeae2; }
        body { margin: 0; font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; }
        .header { background: var(--py-green); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: bold; }
        .search-area { background: white; padding: 10px; border-bottom: 1px solid #ddd; }
        #busc { width: 100%; padding: 8px; border-radius: 20px; border: 1px solid #ddd; outline: none; }
        #chat { flex: 1; overflow-y: auto; padding: 15px; background: var(--bg-chat); display: flex; flex-direction: column; }
        .msg { background: white; padding: 10px; border-radius: 10px; margin-bottom: 8px; max-width: 85%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .mio { align-self: flex-end; background: #d9fdd3; }
        .input-bar { background: #f0f2f5; padding: 10px; display: flex; gap: 10px; }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; outline: none; }
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .card { background: white; padding: 25px; border-radius: 20px; text-align: center; width: 80%; }
    </style>
</head>
<body>
    <div id="login" style="position:fixed; inset:0; background:var(--py-green); z-index:2000; display:flex; align-items:center; justify-content:center;">
        <div class="card">
            <h2>PyChat Pro</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:10px; border:1px solid #ccc; border-radius:10px;">
            <button onclick="entrar()" style="width:100%; margin-top:10px; padding:12px; background:var(--py-green); color:white; border:none; border-radius:10px;">Entrar</button>
        </div>
    </div>

    <div id="config" class="modal">
        <div class="card">
            <h3>⚙️ Ajustes</h3>
            <button onclick="setBG('#efeae2')" style="padding:10px; width:100%; margin-bottom:5px;">Fondo Beige</button>
            <button onclick="setBG('#fff')" style="padding:10px; width:100%; margin-bottom:5px;">Fondo Blanco</button>
            <button onclick="borrar()" style="background:red; color:white; padding:10px; width:100%; margin-top:10px; border-radius:10px; border:none;">ELIMINAR CHAT</button>
            <button onclick="document.getElementById('config').style.display='none'" style="margin-top:15px; border:none; background:none; color:blue;">Cerrar</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Pro</span>
        <span onclick="document.getElementById('config').style.display='flex'" style="cursor:pointer;">⚙️</span>
    </div>

    <div class="search-area">
        <input type="text" id="busc" placeholder="🔍 Buscar mensajes..." onkeyup="buscar()">
    </div>

    <div id="chat"></div>

    <div class="input-bar">
        <input type="text" id="m" placeholder="Escribe algo..." autocomplete="off">
        <button onclick="enviar()" style="background:var(--py-green); color:white; border:none; width:45px; height:45px; border-radius:50%;">➤</button>
    </div>

    <script>
        const socket = io();
        let miNick = "";
        function entrar() { 
            miNick = document.getElementById('nick').value; 
            if(miNick) { 
                document.getElementById('login').style.display='none'; 
                socket.emit('nuevo_usuario', {nombre: miNick}); 
            } 
        }
        function buscar() {
            let f = document.getElementById('busc').value.toLowerCase();
            document.querySelectorAll('.msg').forEach(m => m.style.display = m.innerText.toLowerCase().includes(f) ? 'block' : 'none');
        }
        function enviar() {
            let i = document.getElementById('m');
            if(!i.value) return;
            let d = { n: miNick, texto: i.value };
            socket.emit('mensaje_enviado', d);
            poner(d, true);
            i.value = "";
        }
        function borrar() { if(confirm("¿Borrar todo?")) socket.emit('borrar_todo'); }
        function setBG(c) { document.documentElement.style.setProperty('--bg-chat', c); }
        socket.on('cargar_historial', (h) => h.forEach(m => poner(m, m.n === miNick)));
        socket.on('mensaje_recibido', (d) => poner(d, false));
        socket.on('limpiar', () => location.reload());
        function poner(d, mio) {
            let div = document.createElement('div');
            div.className = 'msg ' + (mio ? 'mio' : '');
            div.innerHTML = '<b>' + d.n + '</b><br>' + d.texto;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});
server.listen(process.env.PORT || 3000);
