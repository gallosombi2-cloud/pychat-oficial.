const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Datastore = require('nedb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Base de datos de mensajes
const db = new Datastore({ filename: 'chat.db', autoload: true });

let usuariosConectados = {}; 

io.on('connection', (socket) => {
    // Enviar historial al conectar
    db.find({ privado: { $ne: true } }).sort({ timestamp: 1 }).limit(100).exec((err, docs) => {
        if (!err) socket.emit('cargar_historial', docs);
    });

    socket.on('nuevo_usuario', (user) => {
        usuariosConectados[user.nombre] = { 
            id: socket.id, 
            foto: user.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' 
        };
        io.emit('lista_usuarios_activos', usuariosConectados);
    });

    socket.on('mensaje_enviado', (data) => {
        db.insert({ ...data, timestamp: Date.now() });
        socket.broadcast.emit('mensaje_recibido', data);
    });

    socket.on('mensaje_privado', (data) => {
        const destino = usuariosConectados[data.para];
        if (destino) socket.to(destino.id).emit('mensaje_recibido', { ...data, privado: true });
    });

    // Acción de borrar historial (Sin claves)
    socket.on('borrar_todo_confirmado', () => {
        db.remove({}, { multi: true }, () => {
            io.emit('limpiar_pantalla_clientes');
        });
    });

    socket.on('disconnect', () => {
        for(let n in usuariosConectados) {
            if(usuariosConectados[n].id === socket.id) delete usuariosConectados[n];
        }
        io.emit('lista_usuarios_activos', usuariosConectados);
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PyChat Pro</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root { --py-green: #008069; --py-blue: #34b7f1; --my-bubble: #d9fdd3; }
        body { margin: 0; font-family: sans-serif; background: #efeae2; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .header { background: var(--py-green); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        .contact-list { background: white; padding: 10px; display: flex; gap: 15px; overflow-x: auto; border-bottom: 1px solid #ddd; min-height: 90px; }
        .contact-item { text-align: center; min-width: 65px; cursor: pointer; }
        .contact-circle { width: 55px; height: 55px; border-radius: 50%; border: 2px solid #25D366; overflow: hidden; margin-bottom: 5px; background: #eee; }
        .contact-circle img { width: 100%; height: 100%; object-fit: cover; }
        .contact-item.active .contact-circle { border-color: var(--py-blue); }
        #chat { flex-grow: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); }
        .mensaje { max-width: 80%; padding: 8px 12px; margin-bottom: 8px; border-radius: 10px; font-size: 14px; }
        .enviado { align-self: flex-end; background: var(--my-bubble); }
        .recibido { align-self: flex-start; background: white; }
        .input-area { background: #f0f2f5; padding: 10px; border-top: 1px solid #ddd; display: flex; gap: 8px; }
        input[type="text"] { flex: 1; padding: 10px; border-radius: 20px; border: 1px solid #ddd; outline: none; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .card { background: white; padding: 20px; border-radius: 15px; width: 85%; max-width: 300px; }
    </style>
</head>
<body>
    <div id="login" style="position:fixed; inset:0; background:var(--py-green); z-index:2000; display:flex; align-items:center; justify-content:center;">
        <div class="card" style="text-align:center;">
            <h3>PyChat Pro</h3>
            <input type="text" id="user-name" placeholder="Tu nombre..." style="width:100%; margin-bottom:10px;">
            <button onclick="entrar()" style="width:100%; padding:10px; background:var(--py-green); color:white; border:none; border-radius:10px;">Entrar</button>
        </div>
    </div>

    <div id="config" class="overlay">
        <div class="card">
            <h4>Configuración</h4>
            <label>URL Foto Perfil:</label>
            <input type="text" id="set-photo" style="width:100%; margin-bottom:10px;">
            <label>Color Burbuja:</label>
            <input type="color" id="set-color" style="width:100%; margin-bottom:15px;" onchange="document.documentElement.style.setProperty('--my-bubble', this.value)">
            <button onclick="borrarTodo()" style="width:100%; padding:10px; background:red; color:white; border:none; border-radius:10px; margin-bottom:10px;">LIMPIAR TODO</button>
            <button onclick="document.getElementById('config').style.display='none'" style="width:100%; padding:10px; background:#ddd; border:none; border-radius:10px;">Cerrar</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat Pro</span>
        <span onclick="document.getElementById('config').style.display='flex'">⚙️</span>
    </div>
    
    <div class="contact-list" id="contact-list">
        <div class="contact-item active" onclick="setPrivado('')">🌐<br>Todos</div>
    </div>

    <div id="chat"></div>

    <div class="input-area">
        <input type="text" id="msg" placeholder="Mensaje..." autocomplete="off">
        <button onclick="enviar()" style="border-radius:50%; width:40px; height:40px; border:none; background:var(--py-green); color:white;">➤</button>
    </div>

    <script>
        const socket = io();
        let miNombre = "";
        let privadoPara = "";

        function entrar() {
            miNombre = document.getElementById('user-name').value;
            if(!miNombre) return;
            document.getElementById('login').style.display = 'none';
            socket.emit('nuevo_usuario', { nombre: miNombre });
        }

        function enviar() {
            const m = document.getElementById('msg');
            if(!m.value) return;
            const data = { n: miNombre, texto: m.value, para: privadoPara };
            if(privadoPara) { socket.emit('mensaje_privado', data); poner(data, 'enviado'); }
            else { socket.emit('mensaje_enviado', data); poner(data, 'enviado'); }
            m.value = "";
        }

        socket.on('cargar_historial', (h) => h.forEach(m => poner(m, m.n === miNombre ? 'enviado' : 'recibido')));
        socket.on('mensaje_recibido', (d) => poner(d, 'recibido'));
        socket.on('limpiar_pantalla_clientes', () => location.reload());

        function borrarTodo() { if(confirm("¿Borrar todo?")) socket.emit('borrar_todo_confirmado'); }

        socket.on('lista_usuarios_activos', (us) => {
            const list = document.getElementById('contact-list');
            list.innerHTML = '<div class="contact-item active" onclick="setPrivado(\\'\\')">🌐<br>Todos</div>';
            for(let n in us) {
                if(n !== miNombre) {
                    const d = document.createElement('div');
                    d.className = 'contact-item';
                    d.innerHTML = \`<div class="contact-circle"><img src="\${us[n].foto}"></div>\${n}\`;
                    d.onclick = () => { privadoPara = n; document.querySelectorAll('.contact-item').forEach(e=>e.classList.remove('active')); d.classList.add('active'); };
                    list.appendChild(d);
                }
            }
        });

        function poner(d, c) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + c;
            div.innerHTML = \`<b style="font-size:10px;">\${d.n}</b><br>\${d.texto}\`;
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

server.listen(process.env.PORT || 3000);
