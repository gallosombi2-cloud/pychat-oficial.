const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Base de Datos
const db = new Datastore({ filename: 'chat.db', autoload: true });

io.on('connection', (socket) => {
    db.find({ privado: { $ne: true } }).sort({ timestamp: 1 }).limit(100).exec((err, docs) => {
        if (!err) socket.emit('cargar_historial', docs);
    });

    socket.on('nuevo_usuario', (u) => {
        socket.nombre = u.nombre;
        io.emit('usuario_conectado', { n: u.nombre, id: socket.id });
    });

    socket.on('mensaje_enviado', (d) => {
        db.insert({ ...d, timestamp: Date.now() });
        socket.broadcast.emit('mensaje_recibido', d);
    });

    socket.on('solicitar_limpieza_total', () => {
        db.remove({}, { multi: true }, () => {
            io.emit('limpiar_pantalla');
        });
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Pro Final</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --bg-chat: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); }
        body { margin: 0; font-family: sans-serif; background: #efeae2; display: flex; flex-direction: column; height: 100vh; }
        
        .header { background: var(--py-green); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        
        .search-container { background: white; padding: 10px; border-bottom: 1px solid #ddd; }
        .search-bar { width: 100%; padding: 10px; border-radius: 20px; border: 1px solid #eee; background: #f0f2f5; outline: none; box-sizing: border-box; }

        #chat { flex-grow: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; background-image: var(--bg-chat); background-attachment: fixed; }
        .msg { max-width: 80%; padding: 8px 12px; margin-bottom: 8px; border-radius: 10px; background: white; box-shadow: 0 1px 1px rgba(0,0,0,0.1); }
        .mio { align-self: flex-end; background: #d9fdd3; }

        .input-area { background: #f0f2f5; padding: 10px; display: flex; gap: 10px; }
        #m { flex: 1; border: none; padding: 12px; border-radius: 25px; outline: none; }
        
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .card { background: white; padding: 20px; border-radius: 20px; width: 85%; max-width: 320px; text-align: center; }
        
        .wallpaper-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px; }
        .wp-option { height: 50px; border-radius: 5px; cursor: pointer; border: 2px solid transparent; background-size: cover; }
    </style>
</head>
<body>
    <div id="login" style="position:fixed; inset:0; background:var(--py-green); display:flex; align-items:center; justify-content:center; z-index:2000;">
        <div class="card">
            <h2>PyChat Pro</h2>
            <input type="text" id="nick" placeholder="Tu nombre..." style="width:100%; padding:12px; border-radius:10px; border:1px solid #ccc; box-sizing:border-box;">
            <button onclick="entrar()" style="margin-top:15px; width:100%; padding:12px; background:var(--py-green); color:white; border:none; border-radius:10px; font-weight:bold;">ENTRAR</button>
        </div>
    </div>

    <div id="config" class="modal">
        <div class="card">
            <h3>⚙️ Ajustes</h3>
            <p style="font-size:12px; color:#666;">Cambiar Fondo:</p>
            <div class="wallpaper-grid">
                <div class="wp-option" style="background-color:#efeae2;" onclick="setWP('#efeae2')"></div>
                <div class="wp-option" style="background-image:url('https://i.pinimg.com/originals/ab/ab/60/abab60f640e3407963d3999901897453.jpg');" onclick="setWP('url(https://i.pinimg.com/originals/ab/ab/60/abab60f640e3407963d3999901897453.jpg)')"></div>
                <div class="wp-option" style="background-image:url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');" onclick="setWP('url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)')"></div>
            </div>
            <button onclick="borrarTodo()" style="background:#ff3b30; color:white; border:none; width:100%; padding:12px; border-radius:10px; margin-top:20px; font-weight:bold;">🗑️ BORRAR CHAT</button>
            <button onclick="document.getElementById('config').style.display='none'" style="margin-top:15px; border:none; background:none; color:blue;">Cerrar</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Pro</span>
        <span onclick="document.getElementById('config').style.display='flex'" style="cursor:pointer; font-size:20px;">⚙️</span>
    </div>

    <div class="search-container">
        <input type="text" class="search-bar" id="buscador" placeholder="🔍 Buscar mensajes..." onkeyup="buscar()">
    </div>

    <div id="chat"></div>

    <div class="input-area">
        <input type="text" id="m" placeholder="Escribe un mensaje..." autocomplete="off">
        <button onclick="enviar()" style="background:var(--py-green); color:white; border:none; width:45px; height:45px; border-radius:50%;">➤</button>
    </div>

    <script>
        const socket = io();
        let miNombre = "";

        function entrar() {
            miNombre = document.getElementById('nick').value;
            if(!miNombre) return;
            document.getElementById('login').style.display = 'none';
            socket.emit('nuevo_usuario', { nombre: miNombre });
        }

        function setWP(val) { document.documentElement.style.setProperty('--bg-chat', val); }

        function buscar() {
            const f = document.getElementById('buscador').value.toLowerCase();
            const msgs = document.querySelectorAll('.msg');
            msgs.forEach(m => m.style.display = m.innerText.toLowerCase().includes(f) ? 'block' : 'none');
        }

        function enviar() {
            const i = document.getElementById('m');
            if(!i.value) return;
            const d = { n: miNombre, texto: i.value };
            socket.emit('mensaje_enviado', d);
            poner(d, true);
            i.value = "";
        }

        function borrarTodo() { if(confirm("¿Borrar historial?")) socket.emit('solicitar_limpieza_total'); }

        socket.on('cargar_historial', (h) => h.forEach(m => poner(m, m.n === miNombre)));
        socket.on('mensaje_recibido', (d) => poner(d, false));
        socket.on('limpiar_pantalla', () => location.reload());

        function poner(d, mio) {
            const div = document.createElement('div');
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
