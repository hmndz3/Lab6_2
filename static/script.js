// --------------------------------------------------------------------------
// Nombre del usuario en el chat osea el mio
// --------------------------------------------------------------------------
const MI_NOMBRE = "Harry Mendez";

// --------------------------------------------------------------------------
// Referencias a elementos del DOM
// --------------------------------------------------------------------------
const cajaMensajes       = document.getElementById("caja-mensajes");
const campoMensaje       = document.getElementById("campo-mensaje");
const botonEnviar        = document.getElementById("boton-enviar");
const contadorCaracteres = document.getElementById("contador-caracteres");

// --------------------------------------------------------------------------
// Expresiones regulares para detectar links
// --------------------------------------------------------------------------
const regexImagen = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(\?\S*)?/i;

const regexUrl = /https?:\/\/[^\s]+/gi;

// --------------------------------------------------------------------------
// Cache de previews para no volver a buscar los mismos links
// --------------------------------------------------------------------------
const cachePreview = {};

// Funcion: obtenerMensajes
// Descripcion: Llama a la API y renderiza los mensajes en el DOM
const obtenerMensajes = async () => {
    let mensajes;
    
    try {
        const respuesta = await fetch("/api/messages");
        const texto     = await respuesta.text();
        mensajes        = JSON.parse(texto);
    } catch (e) {
        console.log("Error al obtener mensajes:", e);
        return;
    }

    // Verificar si el usuario esta viendo el final del chat
    // (para decidir si hacer scroll al final despues de actualizar)
    const estaAbajo =
        cajaMensajes.scrollTop + cajaMensajes.clientHeight >= cajaMensajes.scrollHeight - 10;

    // Limpiar los mensajes actuales del DOM
    cajaMensajes.innerHTML = "";

    // Crear un elemento <li> por cada mensaje recibido
    for (const mensaje of mensajes) {
        const autor   = mensaje.user || mensaje.author || "???";
        const texto   = (mensaje.text || "").trim();
        const elemento = document.createElement("li");

        // Si el mensaje es propio, agregar clase para alinearlo a la derecha
        if (autor === MI_NOMBRE) {
            elemento.classList.add("propio");
        }

        // Construir el HTML del mensaje con el nombre y texto
        let contenido = escaparHtml(texto);

        // Verificar si el texto contiene un link a imagen
        const coincidenciaImagen = texto.match(regexImagen);
        if (coincidenciaImagen) {
            contenido += `<br><img src="${coincidenciaImagen[0]}" class="imagen-chat" alt="imagen" loading="lazy">`;
        }

        elemento.innerHTML = `<strong>${escaparHtml(autor)}:</strong> ${contenido}`;
        cajaMensajes.appendChild(elemento);

        // Verificar si el texto contiene un link web (que no sea imagen)
        const todosLosLinks = texto.match(regexUrl) || [];
        const linksPagina   = todosLosLinks.filter(url => !regexImagen.test(url));

        // Si hay un link a pagina web, crear preview asincrono
        if (linksPagina.length > 0) {
            obtenerPreviewLink(linksPagina[0], elemento);
        }
    }

    // Hacer scroll al fondo solo si ya estabamos ahi antes de actualizar
    if (estaAbajo) {
        cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
    }
};

const publicarMensaje = async (mensaje) => {
    try {
        await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mensaje),
        });
        // Refrescar los mensajes despues de publicar
        obtenerMensajes();
    } catch (e) {
        console.log("Error al publicar mensaje:", e);
    }
};
const enviarMensaje = () => {
    const texto = campoMensaje.value.trim();

    // No enviar si el campo esta vacio
    if (!texto) return;

    // No enviar si supera los 140 caracteres (doble validacion)
    if (texto.length > 140) {
        alert("Maximo 140 caracteres permitidos.");
        return;
    }

    // Publicar el mensaje con el nombre del usuario
    publicarMensaje({ user: MI_NOMBRE, text: texto });

    // Limpiar el campo y resetear el contador
    campoMensaje.value = "";
    actualizarContador();
};

const actualizarContador = () => {
    const cantidad = campoMensaje.value.length;
    contadorCaracteres.textContent = `${cantidad} / 140`;

    // Quitar clases de color previas
    contadorCaracteres.classList.remove("advertencia", "limite");

    // Amarillo cuando se acerca al limite
    if (cantidad >= 140) {
        contadorCaracteres.classList.add("limite");
    } else if (cantidad >= 100) {
        contadorCaracteres.classList.add("advertencia");
    }
};
const obtenerPreviewLink = async (url, elementoMensaje) => {

    // Si ya tenemos la preview en cache, usarla directamente
    if (cachePreview[url] !== undefined) {
        if (cachePreview[url]) mostrarPreviewLink(cachePreview[url], elementoMensaje);
        return;
    }

    // Marcar la URL como en proceso para no buscarla dos veces
    cachePreview[url] = null;

    try {
        const urlProxy   = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const respuesta  = await fetch(urlProxy);

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        const html  = datos.contents || "";

        // Parsear el HTML de la pagina para extraer sus metadatos
        const parser   = new DOMParser();
        const documento = parser.parseFromString(html, "text/html");

        // Funcion auxiliar para leer metaetiquetas
        const leerMeta = (nombre) =>
            documento.querySelector(`meta[property="${nombre}"]`)?.getAttribute("content") ||
            documento.querySelector(`meta[name="${nombre}"]`)?.getAttribute("content") || "";

        const preview = {
            url,
            titulo:      leerMeta("og:title")       || documento.title || url,
            descripcion: leerMeta("og:description") || leerMeta("description") || "",
            imagen:      leerMeta("og:image")       || "",
        };

        // Guardar en cache y mostrar
        cachePreview[url] = preview;
        mostrarPreviewLink(preview, elementoMensaje);

    } catch (e) {
        console.log("No se pudo obtener preview del link:", url, e);
    }
};

const mostrarPreviewLink = (preview, elementoMensaje) => {

    // Evitar duplicar previews en el mismo mensaje
    if (elementoMensaje.querySelector(".preview-link")) return;

    const enlace = document.createElement("a");
    enlace.className = "preview-link";
    enlace.href      = preview.url;
    enlace.target    = "_blank";
    enlace.rel       = "noopener noreferrer";

    // Imagen de preview si existe
    const htmlImagen = preview.imagen
        ? `<img class="preview-imagen" src="${escaparHtml(preview.imagen)}" alt="" loading="lazy">`
        : "";

    enlace.innerHTML = `
        ${htmlImagen}
        <div class="preview-cuerpo">
            <div class="preview-titulo">${escaparHtml(preview.titulo)}</div>
            ${preview.descripcion ? `<div class="preview-descripcion">${escaparHtml(preview.descripcion)}</div>` : ""}
            <div class="preview-url">${escaparHtml(preview.url)}</div>
        </div>
    `;

    elementoMensaje.appendChild(enlace);

    // Si el usuario estaba al fondo, mantener el scroll abajo
    const estaAbajo = cajaMensajes.scrollTop + cajaMensajes.clientHeight >= cajaMensajes.scrollHeight - 60;
    if (estaAbajo) cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
};

const escaparHtml = (texto) => {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(texto));
    return div.innerHTML;
};
const ajustarAlturaTextarea = () => {
    campoMensaje.style.height = "auto";
    campoMensaje.style.height = Math.min(campoMensaje.scrollHeight, 120) + "px";
};

// --------------------------------------------------------------------------
// Event listeners - Escuchan las acciones del usuario
// --------------------------------------------------------------------------

// Click en boton enviar
botonEnviar.addEventListener("click", () => {
    enviarMensaje();
});

// Escribir en el campo de texto
campoMensaje.addEventListener("input", () => {
    // Cortar el texto si supera 140 caracteres
    if (campoMensaje.value.length > 140) {
        campoMensaje.value = campoMensaje.value.substring(0, 140);
    }
    actualizarContador();
    ajustarAlturaTextarea();
});

// Presionar Enter para enviar (Shift+Enter hace salto de linea)
campoMensaje.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault();
        enviarMensaje();
    }
});

// --------------------------------------------------------------------------
// Inicializacion - Cargar mensajes al abrir y refrescar cada 5 segundos
// --------------------------------------------------------------------------
obtenerMensajes();
setInterval(obtenerMensajes, 5000);