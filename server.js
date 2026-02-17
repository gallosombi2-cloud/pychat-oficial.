// ... (Mantén el inicio del server.js igual)

    <div class="header">
        <span>PyChat Ghost 👻</span>
        <div style="display:flex; gap:10px;">
            <button onclick="panico()" style="background:#ff3b30; border:none; border-radius:50%; width:35px; height:35px; cursor:pointer; font-size:18px; box-shadow:0 0 10px rgba(255,0,0,0.5);">⚡</button>
            <span onclick="location.reload()" style="cursor:pointer; font-size:20px;">🔄</span>
        </div>
    </div>

    <div id="lista-contactos"></div>
    <div id="chat"></div>

    <script>
        // ... (Mantén las funciones anteriores de voz y chat)

        function panico() {
            // 1. Borrado visual instantáneo
            document.getElementById('chat').innerHTML = \`
                <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0.3;">
                    <span style="font-size:50px;">📂</span>
                    <p>No hay mensajes recientes</p>
                </div>
            \`;
            
            // 2. Bloqueo de entrada
            document.getElementById('m').disabled = true;
            document.getElementById('m').placeholder = "Chat bloqueado";
            
            // 3. Reset de seguridad (Cierra sesión en 1 segundo)
            alert("¡MODO PÁNICO ACTIVADO! Limpiando sesión...");
            setTimeout(() => {
                location.reload(); 
            }, 1000);
        }

        // --- MEJORA: DETECCIÓN DE CAPTURA DE PANTALLA (Aviso) ---
        // Aunque no se puede evitar al 100% en web, podemos avisar si cambian de pestaña
        document.addEventListener("visibilitychange", function() {
            if (document.hidden) {
                console.log("El usuario salió de la pestaña - Posible captura o cambio de app");
            }
        });

        // Bloqueo de clic derecho para evitar "Guardar como"
        document.addEventListener('contextmenu', event => event.preventDefault());
    </script>
