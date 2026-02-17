const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- LÓGICA DEL SERVIDOR (BOT ELIMINADO) ---
io.on('connection', (socket) => {
    socket.on('nuevo_usuario', (user) => {
        socket.broadcast.emit('mensaje_recibido', { 
            texto: `${user.nombre} se ha conectado`, 
            tipo: 'sistema' 
        });
    });

    socket.on('mensaje_enviado', (data) => {
        // Enviar mensaje a todos los demás
        socket.broadcast.emit('mensaje_recibido', data);
    });

    socket.on('escribiendo', (n) => socket.broadcast.emit('usuario_escribiendo', n));
    socket.on('dejo_de_escribir', () => socket.broadcast.emit('usuario_paró'));
});

// --- INTERFAZ PyChat (SIN BOT) ---
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
        body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #f0f2f5; }
        #login-screen { position: fixed; inset: 0; background: var(--py-green); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .login-card { background: white; padding: 30px; border-radius: 20px; text-align: center; width: 280px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .header { background: var(--py-green); color: white; padding: 15px; font-weight: bold; position: sticky; top: 0; z-index: 10; display: flex; align-items: center; }
        #chat { height: calc(100vh - 130px); background: var(--bg-chat); padding: 15px; overflow-y: auto; display: flex; flex-direction: column; }
        .mensaje { max-width: 85%; padding: 8px 12px; margin-bottom: 8px; border-radius: 12px; font-size: 14px; position: relative; word-wrap: break-word; }
        .enviado { align-self: flex-end; background: #dcf8c6; border-top-right-radius: 0; }
        .recibido { align-self: flex-start; background: #ffffff; border-top-left-radius: 0; }
        .sistema { align-self: center; background: #fff3cd; font-size: 11px; padding: 4px 10px; border-radius: 5px; margin: 10px 0; border: 1px solid #ffeeba; }
        .status-icon { font-size: 11px; color: #34b7f1; margin-left: 4px; font-weight: bold; }
        .input-area { background: #f0f0f0; padding: 10px; display: flex; gap: 8px; align-items: center; }
        input { flex: 1; border: none; padding: 12px; border-radius: 25px; outline: none; border: 1px solid #ddd; }
        button { background: var(--py-green); color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .code-input { letter-spacing: 5px; font-size: 20px; text-align: center; font-weight: bold; border: 2px solid var(--py-green) !important; }
        #notif-sound { display: none; }
    </style>
</head>
<body>
    <audio id="notif-sound" src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"></audio>

    <div id="login-screen">
        <div class="login-card" id="card-content">
            <h2 style="color:var(--py-green)">PyChat</h2>
            <p>Ingresa tus datos</p>
            <input type="text" id="username" placeholder="Nombre" style="width:90%; margin-bottom:10px;">
            <input type="text" id="usercontact" placeholder="Teléfono o Correo" style="width:90%; margin-bottom:15px;">
            <button onclick="generarCodigo()" style="width:100%; border-radius:10px;">Continuar</button>
        </div>
    </div>

    <div class="header">
        <span>PyChat</span>
        <small id="typing" style="font-weight:normal; font-size:10px; margin-left:15px; color:#b3e5fc;"></small>
    </div>

    <div id="chat"></div>

    <div class="input-area">
        <input id="input" type="text" placeholder="Escribe un mensaje..." onkeypress="tecleando()">
        <button onclick="enviar()">➤</button>
    </div>

    <script>
        const socket = io();
        let user = { nombre: '', contacto: '' };
        let codigoVerificacion = "";

        // Auto-login (Memoria)
        window.onload = () => {
            const savedName = localStorage.getItem('py_n');
            const savedCont = localStorage.getItem('py_c');
            if(savedName && savedCont) {
                user.nombre = savedName;
                user.contacto = savedCont;
                document.getElementById('login-screen').style.display = 'none';
                socket.emit('nuevo_usuario', user);
                solicitarNotificaciones();
            }
        };

        function generarCodigo() {
            const n = document.getElementById('username').value;
            const c = document.getElementById('usercontact').value;
            if(!n || !c) return alert("Completa los campos");
            
            user.nombre = n;
            user.contacto = c;
            codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
            
            document.getElementById('card-content').innerHTML = `
                <h2 style="color:var(--py-green)">Código</h2>
                <p>Tu código de acceso es:</p>
                <div style="font-size:28px; font-weight:bold; margin-bottom:15px; background:#f0f0f0; padding:10px; border-radius:10px;">\${codigoVerificacion}</div>
                <input type="text" id="v-code" class="code-input" placeholder="000000" maxlength="6" style="width:90%;">
                <button onclick="finalizarVerificacion()" style="width:100%; margin-top:15px; border-radius:10px;">Verificar</button>
            `;
        }

        function finalizarVerificacion() {
            const val = document.getElementById('v-code').value;
            if(val === codigoVerificacion) {
                localStorage.setItem('py_n', user.nombre);
                localStorage.setItem('py_c', user.contacto);
                document.getElementById('login-screen').style.display = 'none';
                socket.emit('nuevo_usuario', user);
                solicitarNotificaciones();
            } else {
                alert("Código incorrecto");
            }
        }

        function solicitarNotificaciones() {
            if ("Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }

        function enviar() {
            const i = document.getElementById('input');
            if(!i.value) return;
            const d = { id: Date.now(), nombre: user.nombre, contacto: user.contacto, texto: i.value };
            socket.emit('mensaje_enviado', d);
            agregarMensaje(d, 'enviado');
            i.value = '';
        }

        socket.on('mensaje_recibido', (d) => {
            agregarMensaje(d, d.tipo === 'sistema' ? 'sistema' : 'recibido');
            
            // Notificación y Sonido si la app está cerrada/segundo plano
            if (d.nombre !== user.nombre && d.tipo !== 'sistema') {
                document.getElementById('notif-sound').play();
                if (document.visibilityState !== "visible" && Notification.permission === "granted") {
                    new Notification(d.nombre, { body: d.texto, icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' });
                }
            }
        });

        function tecleando() {
            socket.emit('escribiendo', user.nombre);
            setTimeout(() => socket.emit('dejo_de_escribir'), 2000);
        }

        socket.on('usuario_escribiendo', (n) => document.getElementById('typing').textContent = n + ' está escribiendo...');
        socket.on('usuario_paró', () => document.getElementById('typing').textContent = '');

        function agregarMensaje(d, clase) {
            const div = document.createElement('div');
            div.className = 'mensaje ' + clase;
            const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let contenido = d.texto;
            let meta = d.tipo !== 'sistema' ? `<br><small style="font-size:9px; color:#888">\${d.nombre} (\${d.contacto}) • \${time}</small>` : '';
            
            div.innerHTML = contenido + meta + (clase === 'enviado' ? ' <span class="status-icon">✓✓</span>' : '');
            document.getElementById('chat').appendChild(div);
            document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Chat activo'));
