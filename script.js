// ============================================================
// HN MUEBLES - SCRIPT PRINCIPAL COMPLETO
// Firebase Authentication + Firestore
// Cloudinary para Portafolio y Cotizaciones con Links de Fotos
// ============================================================


// ============================================================
// 1. CONFIGURACIÓN FIREBASE Y CLOUDINARY
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCLrVUpGCTxFxuMR0ATlwj2t3osSP0dD7Y",
  authDomain: "hn-muebles.firebaseapp.com",
  projectId: "hn-muebles",
  storageBucket: "hn-muebles.firebasestorage.app",
  messagingSenderId: "175601256381",
  appId: "1:175601256381:web:db2031a56faa87a02bf4d4",
  measurementId: "G-8PJGERB67Q"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();


// ============================================================
// CLOUDINARY
// ============================================================

const CLOUDINARY_CLOUD_NAME = "clvoagwx";
const CLOUDINARY_UPLOAD_PRESET = "hn_muebles_portafolio";


// ============================================================
// VARIABLES GLOBALES
// ============================================================

const EMAIL_ADMIN = "hn24muebles@gmail.com";

let proyectos = [];
let ingresos = [];
let esAdmin = false;
let portafolio = [];


// ============================================================
// 2. UTILIDADES GENERALES Y MODAL DE CONFIRMACIÓN
// ============================================================

function formatearMonto(valor) {
  const num = Number(valor) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}


function generarCodigoAleatorio() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let aleatorio = "";

  for (let i = 0; i < 5; i++) {
    aleatorio += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }

  return `HN${aleatorio}`;
}


function llenarCodigoAutomatico() {
  const input = document.getElementById("nuevo-codigo");
  if (input) {
    input.value = generarCodigoAleatorio();
  }
}


function irInicio() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}


// Modal flotante de confirmación unificado con el estilo de la web
function mostrarModalConfirmacion(titulo, mensaje, callbackConfirmar) {
  const modalId = "hn-confirm-modal-overlay";
  let overlay = document.getElementById(modalId);

  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = modalId;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(6px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 24px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      color: #fff;
      text-align: center;
      font-family: inherit;
    ">
      <div style="font-size: 2.5rem; margin-bottom: 12px;">⚠️</div>
      <h3 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 8px; color: #fff;">${escaparHTML(titulo)}</h3>
      <p style="color: #a3a3a3; font-size: 0.92rem; line-height: 1.5; margin-bottom: 24px;">${escaparHTML(mensaje)}</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button type="button" id="hn-confirm-cancel" style="
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        ">Cancelar</button>
        <button type="button" id="hn-confirm-ok" style="
          flex: 1;
          background: #ef4444;
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        ">Sí, eliminar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const cerrarModal = () => {
    overlay.remove();
    document.body.style.overflow = "";
  };

  document.getElementById("hn-confirm-cancel").onclick = cerrarModal;
  overlay.onclick = (e) => {
    if (e.target === overlay) cerrarModal();
  };

  document.getElementById("hn-confirm-ok").onclick = () => {
    cerrarModal();
    if (typeof callbackConfirmar === "function") {
      callbackConfirmar();
    }
  };
}


// ============================================================
// 3. AUTENTICACIÓN
// ============================================================

auth.onAuthStateChanged(async (user) => {

  if (!user) {
    esAdmin = false;
    ocultarPanelAdministrador();
    return;
  }

  const emailUsuario = (user.email || "").trim().toLowerCase();
  const emailAdmin = EMAIL_ADMIN.trim().toLowerCase();

  if (emailUsuario !== emailAdmin) {
    esAdmin = false;
    ocultarPanelAdministrador();
    return;
  }

  esAdmin = true;
  mostrarPanelAdministrador();

  try {
    await Promise.all([
      cargarProyectosDesdeNube(),
      cargarIngresosDesdeNube(),
      cargarPortafolioAdmin()
    ]);
    renderProyectosAdmin();
    renderGestionIngresos();
  } catch (error) {
    console.error("Error cargando panel:", error);
  }

});


async function cerrarSesionAdmin() {
  try {
    await auth.signOut();
    esAdmin = false;
    ocultarPanelAdministrador();
    cerrarVisorPortafolio();
    irInicio();
  } catch (error) {
    console.error("Error cerrando sesión:", error);
  }
}


// ============================================================
// 4. CONTROL DE VISTAS ADMIN (PANTALLA COMPLETA)
// ============================================================

function mostrarPanelAdministrador() {
  const login = document.getElementById("admin-login");
  const panel = document.getElementById("admin-panel");
  const modalOverlay = panel?.closest('.modal-overlay');

  if (login) login.classList.add("hidden");

  if (modalOverlay) {
    modalOverlay.style.position = "relative";
    modalOverlay.style.background = "transparent";
    modalOverlay.style.backdropFilter = "none";
    modalOverlay.style.padding = "0";
    modalOverlay.style.display = "block";
  }

  if (panel) {
    panel.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  try {
    cambiarVistaAdmin('inicio');
  } catch (e) {}
}


function ocultarPanelAdministrador() {
  const login = document.getElementById("admin-login");
  const panel = document.getElementById("admin-panel");
  const modalOverlay = panel?.closest('.modal-overlay');

  if (panel) panel.classList.add("hidden");
  
  if (modalOverlay) {
    modalOverlay.style.position = "";
    modalOverlay.style.background = "";
    modalOverlay.style.backdropFilter = "";
    modalOverlay.style.padding = "";
    modalOverlay.style.display = "";
  }

  if (login) login.classList.remove("hidden");
}


function cambiarVistaAdmin(vistaId) {
  if (!esAdmin) return;

  const vistas = [
    'admin-vista-inicio',
    'admin-vista-nuevo-proyecto',
    'admin-vista-ingresos',
    'admin-vista-portafolio'
  ];

  vistas.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === `admin-vista-${vistaId}` || id === vistaId) {
        el.style.display = 'block';
        el.classList.remove('hidden');
      } else {
        el.style.display = 'none';
        el.classList.add('hidden');
      }
    }
  });

  const botonesMenu = document.querySelectorAll('.admin-nav-btn');
  botonesMenu.forEach(btn => {
    if (btn.dataset && btn.dataset.vista === vistaId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}


// ============================================================
// 5. FIRESTORE (SIN BLOQUEOS)
// ============================================================

async function cargarProyectosDesdeNube() {
  if (!auth.currentUser || !esAdmin) return;
  const snapshot = await db.collection("proyectos").get();
  proyectos = [];
  snapshot.forEach(doc => {
    proyectos.push({ id: doc.id, ...doc.data() });
  });
}


async function cargarIngresosDesdeNube() {
  if (!auth.currentUser || !esAdmin) return;
  const snapshot = await db.collection("ingresos").get();
  ingresos = [];
  snapshot.forEach(doc => {
    ingresos.push({ id: doc.id, ...doc.data() });
  });
}


// ============================================================
// 6. BÚSQUEDA PÚBLICA
// ============================================================

async function buscarProyectoPublico(codigo) {
  const errorMsg = document.getElementById("mensaje-error");
  const resultBox = document.getElementById("resultado-proyecto");

  try {
    const snapshot = await db.collection("proyectos_publicos")
      .where("codigo", "==", codigo)
      .limit(1)
      .get();

    if (snapshot.empty) {
      resultBox?.classList.add("hidden");
      errorMsg?.classList.remove("hidden");
      return;
    }

    const data = snapshot.docs[0].data();

    errorMsg?.classList.add("hidden");
    resultBox?.classList.remove("hidden");

    document.getElementById("res-codigo").innerText = data.codigo || "";
    document.getElementById("res-mueble").innerText = data.mueble || "";
    document.getElementById("res-cliente").innerText = `Cliente: ${data.cliente || ""}`;
    document.getElementById("res-estado").innerText = data.estado || "";
    document.getElementById("res-porcentaje").innerText = `${data.progreso || 0}%`;

  } catch (error) {
    console.error("Error búsqueda pública:", error);
    resultBox?.classList.add("hidden");
    if (errorMsg) {
      errorMsg.innerText = "No se pudo consultar el proyecto.";
      errorMsg.classList.remove("hidden");
    }
  }
}


// ============================================================
// 7. GESTIÓN DE PROYECTOS
// ============================================================

function renderProyectosAdmin() {
  if (!esAdmin) return;

  const container = document.getElementById("lista-proyectos-admin");
  const total = document.getElementById("total-proyectos");

  if (total) total.innerText = proyectos.length;
  if (!container) return;

  container.innerHTML = "";

  const etapas = [
    "Diseño Aprobado",
    "Corte",
    "Armado",
    "Instalación",
    "Finalizado"
  ];

  proyectos.forEach((p, index) => {
    const presupuesto = Number(p.presupuesto) || 0;
    const adelanto = Number(p.adelanto) || 0;
    const saldo = Math.max(presupuesto - adelanto, 0);

    const fecha = p.fechaEntrega
      ? p.fechaEntrega.split("-").reverse().join("/")
      : "Sin definir";

    const card = document.createElement("div");
    card.className = "admin-card";
    card.style.cssText = `
      background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.1);
      border-radius:12px;
      padding:1.2rem;
      margin-bottom:1rem;
    `;

    const botones = etapas.map((estado, idx) => {
      const activo = p.estado === estado;
      return `
        <button
          type="button"
          onclick="cambiarEstadoPorId('${p.id}', ${idx}, ${(idx + 1) * 20})"
          style="
            border:none;
            padding:.4rem .7rem;
            border-radius:6px;
            cursor:pointer;
            font-size:.8rem;
            margin:.2rem;
            ${activo ? "background:#f59e0b;color:#000;font-weight:bold;" : "background:rgba(255,255,255,.1);color:#fff;"}
          "
        >
          ${estado}
        </button>
      `;
    }).join("");

    card.innerHTML = `
      <div id="info-view-${index}">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px;">
            <span style="background:#f59e0b; color:#000; padding:.2rem .6rem; border-radius:4px; font-weight:bold; font-size:.85rem;">
              ${escaparHTML(p.codigo || "")}
            </span>
            <strong style="margin-left:.4rem;">
              ${escaparHTML(p.mueble || "")}
            </strong>
            <p style="margin:.4rem 0; color:#a3a3a3; font-size:.85rem;">
              Cliente: ${escaparHTML(p.cliente || "")} | Tel: ${escaparHTML(p.telefono || "Sin registrar")}
            </p>
            <p style="color:#38bdf8; font-size:.85rem;">
              Entrega: <strong>${fecha}</strong>
            </p>

            <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:12px;">
              <div class="financial-box" style="background:rgba(56,189,248,.07); border:1px solid rgba(56,189,248,.25); color:#38bdf8;">
                <span style="font-size:.75rem; opacity:.85; margin-bottom:5px;">Monto total</span>
                <strong style="font-size:1.05rem; white-space:nowrap;">Bs. ${formatearMonto(presupuesto)}</strong>
              </div>
              <div class="financial-box" style="background:rgba(245,158,11,.07); border:1px solid rgba(245,158,11,.25); color:#f59e0b;">
                <span style="font-size:.75rem; opacity:.85; margin-bottom:5px;">Adelanto</span>
                <strong style="font-size:1.05rem; white-space:nowrap;">Bs. ${formatearMonto(adelanto)}</strong>
              </div>
              <div class="financial-box" style="background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.25); color:#ef4444;">
                <span style="font-size:.75rem; opacity:.85; margin-bottom:5px;">Pendiente</span>
                <strong style="font-size:1.05rem; white-space:nowrap;">Bs. ${formatearMonto(saldo)}</strong>
              </div>
            </div>

            <div style="margin-top:.7rem;">${botones}</div>

            <button
              type="button"
              onclick="notificarWhatsApp(${index})"
              style="margin-top:.6rem; background:#16a34a; color:white; border:none; padding:.4rem .8rem; border-radius:6px; cursor:pointer; font-size:.85rem; font-weight:bold;"
            >
              WhatsApp
            </button>
          </div>

          <div style="display:flex; gap:5px; align-items:flex-start;">
            <button type="button" onclick="activarEdicionInline(${index})" class="admin-action-btn" style="background:#3b82f6; color:#fff;" title="Editar proyecto">✏️</button>
            <button type="button" onclick="confirmarEliminarProyecto('${p.id}', '${escaparHTML(p.mueble || "")}')" class="admin-action-btn" style="background:#ef4444; color:#fff;" title="Eliminar proyecto">🗑️</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}


async function cambiarEstadoPorId(id, etapaIdx, progreso) {
  if (!esAdmin || !auth.currentUser) return;

  const etapas = ["Diseño Aprobado", "Corte", "Armado", "Instalación", "Finalizado"];
  const descripciones = [
    "El diseño ha sido aprobado por WhatsApp. El proyecto ingresa a producción.",
    "Las placas se encuentran en proceso de corte y pegado de tapacantos.",
    "Las piezas se están ensamblando en taller.",
    "El mueble está en proceso de traslado e instalación en sitio.",
    "¡El proyecto ha sido completado e instalado con éxito!"
  ];

  const estado = etapas[etapaIdx];
  const detalles = descripciones[etapaIdx];

  const projIndex = proyectos.findIndex(p => p.id === id);
  if (projIndex !== -1) {
    proyectos[projIndex].estado = estado;
    proyectos[projIndex].progreso = progreso;
    proyectos[projIndex].detalles = detalles;
    renderProyectosAdmin();
  }

  try {
    const batch = db.batch();
    const proyectoRef = db.collection("proyectos").doc(id);
    batch.update(proyectoRef, { estado, progreso, detalles });

    const proyecto = proyectos.find(p => p.id === id);
    const publicoQuery = await db.collection("proyectos_publicos")
      .where("codigo", "==", proyecto?.codigo)
      .limit(1)
      .get();

    publicoQuery.forEach(doc => {
      batch.update(doc.ref, { estado, progreso, detalles });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error estado:", error);
  }
}


function confirmarEliminarProyecto(id, nombreMueble) {
  mostrarModalConfirmacion(
    "¿Eliminar proyecto?",
    `¿Estás seguro de que deseas eliminar el proyecto "${nombreMueble}"? Esta acción borrará también sus registros de ingresos y no se puede deshacer.`,
    () => ejecutarEliminarProyecto(id)
  );
}


async function ejecutarEliminarProyecto(id) {
  if (!esAdmin || !auth.currentUser) return;

  const proyectoEliminado = proyectos.find(p => p.id === id);

  proyectos = proyectos.filter(p => p.id !== id);
  ingresos = ingresos.filter(i => i.proyectoId !== id);
  renderProyectosAdmin();
  renderGestionIngresos();

  try {
    const batch = db.batch();
    batch.delete(db.collection("proyectos").doc(id));

    if (proyectoEliminado) {
      const publicSnap = await db.collection("proyectos_publicos")
        .where("codigo", "==", proyectoEliminado.codigo)
        .limit(1)
        .get();
      publicSnap.forEach(doc => batch.delete(doc.ref));

      const ingresoSnap = await db.collection("ingresos")
        .where("proyectoId", "==", id)
        .limit(1)
        .get();
      ingresoSnap.forEach(doc => batch.delete(doc.ref));
    }

    await batch.commit();
  } catch (error) {
    console.error("Error eliminando:", error);
  }
}


function activarEdicionInline(index) {
  const p = proyectos[index];
  const info = document.getElementById(`info-view-${index}`);
  if (!info || !p) return;

  info.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:7px;">
      <input id="edit-codigo-${index}" value="${escaparHTML(p.codigo || "")}" placeholder="Código">
      <input id="edit-cliente-${index}" value="${escaparHTML(p.cliente || "")}" placeholder="Cliente">
      <input id="edit-mueble-${index}" value="${escaparHTML(p.mueble || "")}" placeholder="Mueble">
      <input id="edit-telefono-${index}" value="${escaparHTML(p.telefono || "")}" placeholder="WhatsApp">
      <input type="number" id="edit-presupuesto-${index}" value="${p.presupuesto || 0}" placeholder="Presupuesto" min="0" step="0.01">
      <input type="number" id="edit-adelanto-${index}" value="${p.adelanto || 0}" placeholder="Adelanto" min="0" step="0.01">
      <input type="date" id="edit-fecha-${index}" value="${p.fechaEntrega || ""}">
      <div>
        <button type="button" onclick="guardarEdicionInline('${p.id}',${index})" style="background:#16a34a; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">Guardar</button>
        <button type="button" onclick="renderProyectosAdmin()" style="background:#404040; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">Cancelar</button>
      </div>
    </div>
  `;
}


async function guardarEdicionInline(id, index) {
  if (!esAdmin || !auth.currentUser) return;

  const proyectoAnterior = proyectos.find(p => p.id === id);
  const codigoAnterior = proyectoAnterior?.codigo || "";

  const codigo = document.getElementById(`edit-codigo-${index}`).value.trim().toUpperCase();
  const cliente = document.getElementById(`edit-cliente-${index}`).value.trim();
  const mueble = document.getElementById(`edit-mueble-${index}`).value.trim();
  const telefono = document.getElementById(`edit-telefono-${index}`).value.trim();
  const presupuesto = Number(document.getElementById(`edit-presupuesto-${index}`).value) || 0;
  const adelanto = Number(document.getElementById(`edit-adelanto-${index}`).value) || 0;
  const fechaEntrega = document.getElementById(`edit-fecha-${index}`).value;

  const projIndex = proyectos.findIndex(p => p.id === id);
  if (projIndex !== -1) {
    proyectos[projIndex] = { ...proyectos[projIndex], codigo, cliente, mueble, telefono, presupuesto, adelanto, fechaEntrega };
    renderProyectosAdmin();
  }

  try {
    await db.collection("proyectos").doc(id).update({
      codigo, cliente, mueble, telefono, presupuesto, adelanto, fechaEntrega
    });

    const ingresoSnap = await db.collection("ingresos").where("proyectoId", "==", id).limit(1).get();
    if (!ingresoSnap.empty) {
      const ingresoDoc = ingresoSnap.docs[0];
      const ingreso = ingresoDoc.data();
      const pagosFinales = Number(ingreso.pagosFinales) || 0;
      const cobrado = adelanto + pagosFinales;
      const pendiente = Math.max(presupuesto - cobrado, 0);

      await ingresoDoc.ref.update({ codigo, cliente, mueble, presupuesto, adelanto, cobrado, pendiente });
      await cargarIngresosDesdeNube();
      renderGestionIngresos();
    }

    const publicoSnap = await db.collection("proyectos_publicos").where("codigo", "==", codigoAnterior).limit(1).get();
    for (const doc of publicoSnap.docs) {
      await doc.ref.update({ codigo, cliente, mueble, fechaEntrega });
    }
  } catch (error) {
    console.error("Error editando:", error);
  }
}


// ============================================================
// 8. INGRESOS
// ============================================================

function renderGestionIngresos() {
  if (!esAdmin) return;

  const container = document.getElementById("lista-ingresos");
  if (!container) return;

  const filtro = document.getElementById("ingresos-mes")?.value || "";
  let lista = [...ingresos];

  if (filtro) {
    lista = lista.filter(ingreso => {
      let fecha = null;
      if (ingreso.fechaCreacion && ingreso.fechaCreacion.toDate) {
        fecha = ingreso.fechaCreacion.toDate();
      }
      if (!fecha) return true;
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      return mes === filtro;
    });
  }

  let totalCobrado = 0;
  let totalPendiente = 0;

  lista.forEach(ingreso => {
    totalCobrado += Number(ingreso.cobrado) || 0;
    totalPendiente += Number(ingreso.pendiente) || 0;
  });

  const resumenProyectos = document.getElementById("ing-resumen-proyectos");
  const resumenCobrado = document.getElementById("ing-resumen-cobrado");
  const resumenPendiente = document.getElementById("ing-resumen-pendiente");

  if (resumenProyectos) resumenProyectos.innerText = lista.length;
  if (resumenCobrado) resumenCobrado.innerText = `Bs. ${formatearMonto(totalCobrado)}`;
  if (resumenPendiente) resumenPendiente.innerText = `Bs. ${formatearMonto(totalPendiente)}`;

  container.innerHTML = "";

  if (!lista.length) {
    container.innerHTML = `<div style="text-align:center; color:#777; padding:25px;">No hay registros para este mes.</div>`;
    return;
  }

  lista.forEach(ingreso => {
    const card = document.createElement("div");
    card.style.cssText = `
      background:rgba(255,255,255,.035);
      border:1px solid rgba(255,255,255,.09);
      border-radius:9px;
      padding:10px;
      margin-bottom:7px;
    `;

    const presupuesto = Number(ingreso.presupuesto) || 0;
    const adelanto = Number(ingreso.adelanto) || 0;
    const cobrado = Number(ingreso.cobrado) || 0;
    const pendiente = Math.max(presupuesto - cobrado, 0);

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:8px;">
        <div>
          <strong>${escaparHTML(ingreso.cliente || "")}</strong>
          <div style="color:#a3a3a3; font-size:.75rem;">
            ${escaparHTML(ingreso.codigo || "")} · ${escaparHTML(ingreso.mueble || "")}
          </div>
        </div>
        <div style="color:#38bdf8; font-weight:bold; font-size:.85rem;">
          Total: Bs. ${formatearMonto(presupuesto)}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin-top:8px;">
        <div class="summary-box amber">Adelanto<strong>Bs. ${formatearMonto(adelanto)}</strong></div>
        <div class="summary-box green">Cobrado<strong>Bs. ${formatearMonto(cobrado)}</strong></div>
        <div class="summary-box red">Pendiente<strong>Bs. ${formatearMonto(pendiente)}</strong></div>
      </div>

      ${
        pendiente > 0
          ? `
            <div style="display:flex; gap:5px; margin-top:8px;">
              <input type="number" min="0" step="0.01" id="pago-${ingreso.id}" placeholder="Monto pagado">
              <button type="button" onclick="registrarPago('${ingreso.id}')" style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:7px 10px; cursor:pointer; font-weight:bold;">Registrar pago</button>
            </div>
          `
          : `
            <div style="margin-top:8px; color:#4ade80; font-size:.78rem; text-align:center;">
              <i class="fa-solid fa-circle-check"></i> Proyecto pagado completamente
            </div>
          `
      }
    `;
    container.appendChild(card);
  });
}


async function registrarPago(ingresoId) {
  if (!esAdmin || !auth.currentUser) return;

  const input = document.getElementById(`pago-${ingresoId}`);
  const monto = Number(input?.value) || 0;
  if (monto <= 0) return;

  const ingreso = ingresos.find(i => i.id === ingresoId);
  if (!ingreso) return;

  const presupuesto = Number(ingreso.presupuesto) || 0;
  const cobradoActual = Number(ingreso.cobrado) || 0;
  const pendienteActual = Math.max(presupuesto - cobradoActual, 0);

  const pago = Math.min(monto, pendienteActual);
  if (pago <= 0) return;

  const pagosFinalesActuales = Number(ingreso.pagosFinales) || 0;
  const nuevosPagosFinales = pagosFinalesActuales + pago;
  const nuevoCobrado = cobradoActual + pago;
  const nuevoPendiente = Math.max(presupuesto - nuevoCobrado, 0);

  const idx = ingresos.findIndex(i => i.id === ingresoId);
  if (idx !== -1) {
    ingresos[idx].pagosFinales = nuevosPagosFinales;
    ingresos[idx].cobrado = nuevoCobrado;
    ingresos[idx].pendiente = nuevoPendiente;
    renderGestionIngresos();
  }

  try {
    await db.collection("ingresos").doc(ingresoId).update({
      pagosFinales: nuevosPagosFinales,
      cobrado: nuevoCobrado,
      pendiente: nuevoPendiente,
      fechaUltimoPago: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error registrando pago:", error);
  }
}


// ============================================================
// 9. PDF
// ============================================================

async function exportarIngresosPDF() {
  if (!esAdmin) return;

  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert("jsPDF no disponible.");
    return;
  }

  const doc = new jsPDF();

  const mesInput = document.getElementById('ingresos-mes');
  const periodo = mesInput && mesInput.value ? mesInput.value : new Date().toISOString().slice(0, 7);
  const fechaGeneracion = new Date().toLocaleDateString('es-ES');

  const lista = ingresos.filter(ingreso => {
    if (!ingreso.fechaCreacion || !ingreso.fechaCreacion.toDate) return true;
    const fecha = ingreso.fechaCreacion.toDate();
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    return mes === periodo;
  });

  let totalContratadoNum = 0;
  let adelantosRecibidosNum = 0;
  let saldosCobradosNum = 0;

  lista.forEach(ing => {
    totalContratadoNum += Number(ing.presupuesto) || 0;
    adelantosRecibidosNum += Number(ing.adelanto) || 0;
    saldosCobradosNum += Number(ing.pagosFinales) || 0;
  });

  const totalIngresadoNum = adelantosRecibidosNum + saldosCobradosNum;
  const pendienteNum = Math.max(totalContratadoNum - totalIngresadoNum, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("HN MUEBLES", 14, 20);

  doc.setFontSize(14);
  doc.text("REPORTE MENSUAL DE INGRESOS", 14, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periodo: ${periodo}`, 14, 36);
  doc.text(`Generado: ${fechaGeneracion}`, 14, 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("RESUMEN FINANCIERO", 14, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  doc.text(`Total contratado: Bs. ${totalContratadoNum}`, 14, 62);
  doc.text(`Adelantos recibidos: Bs. ${adelantosRecibidosNum}`, 14, 68);
  doc.text(`Saldos cobrados: Bs. ${saldosCobradosNum}`, 14, 74);
  
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL INGRESADO: Bs. ${totalIngresadoNum}`, 14, 80);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Pendiente: Bs. ${pendienteNum}`, 14, 86);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DETALLE DE MOVIMIENTOS", 14, 100);

  doc.setFontSize(10);
  doc.text("Fecha", 14, 108);
  doc.text("Codigo", 50, 108);
  doc.text("Cliente", 80, 108);
  doc.text("Tipo", 130, 108);
  doc.text("Monto", 170, 108);

  doc.setLineWidth(0.3);
  doc.line(14, 112, 196, 112);

  let posY = 118;
  doc.setFont("helvetica", "normal");

  if (lista.length === 0) {
    doc.text("Sin movimientos registrados en este periodo.", 14, posY);
    posY += 8;
  } else {
    lista.forEach(ing => {
      const fechaMov = ing.fechaCreacion && ing.fechaCreacion.toDate ? ing.fechaCreacion.toDate().toLocaleDateString('es-ES') : fechaGeneracion;
      const codigoMov = ing.codigo || "";
      const clienteMov = ing.cliente || "";
      const tipoMov = "Adelanto";
      const montoMov = `Bs. ${Number(ing.adelanto) || 0}`;

      doc.text(fechaMov, 14, posY);
      doc.text(codigoMov, 50, posY);
      doc.text(clienteMov, 80, posY);
      doc.text(tipoMov, 130, posY);
      doc.text(montoMov, 170, posY);
      posY += 8;
    });
  }

  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL INGRESADO: Bs. ${totalIngresadoNum}`, 14, posY + 6);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("HN Muebles - Documento interno de control financiero.", 14, 280);

  doc.save(`HN-Muebles-Ingresos-${periodo}.pdf`);
}


// ============================================================
// 10. WHATSAPP
// ============================================================

function notificarWhatsApp(index) {
  if (!esAdmin) return;

  const p = proyectos[index];
  if (!p || !p.telefono) return;

  let numero = p.telefono.toString().replace(/\D/g, "");
  if (!numero.startsWith("591") && numero.length === 8) {
    numero = "591" + numero;
  }

  const presupuesto = Number(p.presupuesto) || 0;
  const adelanto = Number(p.adelanto) || 0;
  const saldo = Math.max(presupuesto - adelanto, 0);

  const link = window.location.origin + window.location.pathname + `?codigo=${encodeURIComponent(p.codigo)}`;
  const fecha = p.fechaEntrega ? p.fechaEntrega.split("-").reverse().join("/") : "Por coordinar";

  const mensaje = `Hola *${p.cliente}* 👋, desde *HN Muebles* te informamos el estado de tu proyecto *"${p.mueble}"*:

🛠️ *Estado:* ${p.estado}
📊 *Progreso:* ${p.progreso}%
📅 *Fecha estimada de entrega:* ${fecha}

💰 *Resumen Financiero:*
• Monto Total: Bs. ${formatearMonto(presupuesto)}
• Adelanto: Bs. ${formatearMonto(adelanto)}
• Saldo Pendiente: Bs. ${formatearMonto(saldo)}

🔍 *Consulta el estado de tu proyecto aquí:*
${link}`;

  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, "_blank");
}


// ============================================================
// 11. PORTAFOLIO (PÚBLICO, ADMIN Y EDICIÓN AVANZADA)
// ============================================================

async function cargarPortafolioPublico() {
  const container = document.getElementById("portfolio-grid");
  if (!container) return;

  try {
    const snapshot = await db.collection("portafolio").orderBy("creadoEn", "desc").get();
    portafolio = [];
    snapshot.forEach(doc => portafolio.push({ id: doc.id, ...doc.data() }));
    renderPortafolioPublico();
  } catch (error) {
    console.error("Error cargando portafolio:", error);
  }
}


function crearVisorPortafolio() {
  if (document.getElementById("hn-portfolio-viewer")) return;

  const visor = document.createElement("div");
  visor.id = "hn-portfolio-viewer";
  visor.innerHTML = `
    <div id="hn-portfolio-backdrop" onclick="cerrarVisorPortafolio()" style="position:absolute; inset:0; background:rgba(0,0,0,.88); backdrop-filter:blur(8px);"></div>
    <button type="button" onclick="cerrarVisorPortafolio()" style="position:absolute; top:20px; right:25px; z-index:20; width:45px; height:45px; border:none; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; font-size:24px; cursor:pointer;">×</button>
    <button type="button" id="hn-portfolio-prev" onclick="visorPortafolioAnterior(event)" style="position:absolute; left:20px; top:50%; transform:translateY(-50%); z-index:20; width:50px; height:50px; border:none; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; font-size:30px; cursor:pointer;">‹</button>
    <div id="hn-portfolio-content" style="position:relative; z-index:10; width:calc(100% - 150px); height:calc(100% - 120px); display:flex; flex-direction:column; justify-content:center; align-items:center;"></div>
    <button type="button" id="hn-portfolio-next" onclick="visorPortafolioSiguiente(event)" style="position:absolute; right:20px; top:50%; transform:translateY(-50%); z-index:20; width:50px; height:50px; border:none; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; font-size:30px; cursor:pointer;">›</button>
    <div id="hn-portfolio-counter" style="position:absolute; bottom:25px; left:50%; transform:translateX(-50%); z-index:20; color:#fff; background:rgba(0,0,0,.5); padding:7px 15px; border-radius:20px; font-size:13px;"></div>
  `;
  visor.style.cssText = "position:fixed; inset:0; z-index:99999; display:none; align-items:center; justify-content:center; padding:30px;";
  document.body.appendChild(visor);
}


let visorTrabajoActual = null;
let visorIndiceActual = 0;


function abrirVisorPortafolio(trabajoId, indice = 0) {
  const trabajo = portafolio.find(p => p.id === trabajoId);
  if (!trabajo) return;
  const media = Array.isArray(trabajo.media) ? trabajo.media : [];
  if (!media.length) return;

  crearVisorPortafolio();
  visorTrabajoActual = trabajo;
  visorIndiceActual = indice;

  const visor = document.getElementById("hn-portfolio-viewer");
  if (!visor) return;

  visor.style.display = "flex";
  document.body.style.overflow = "hidden";
  mostrarMediaVisor();
  document.addEventListener("keydown", manejarTecladoVisor);
}


function mostrarMediaVisor() {
  if (!visorTrabajoActual) return;
  const media = visorTrabajoActual.media || [];
  if (!media.length) return;

  if (visorIndiceActual < 0) visorIndiceActual = media.length - 1;
  if (visorIndiceActual >= media.length) visorIndiceActual = 0;

  const actual = media[visorIndiceActual];
  const content = document.getElementById("hn-portfolio-content");
  const counter = document.getElementById("hn-portfolio-counter");

  if (!content) return;
  content.innerHTML = "";

  const titulo = document.createElement("div");
  titulo.className = "visor-title";
  titulo.textContent = visorTrabajoActual.titulo || "HN Muebles";
  content.appendChild(titulo);

  if (actual.tipo === "video") {
    const video = document.createElement("video");
    video.src = actual.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    content.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = actual.url;
    img.alt = visorTrabajoActual.titulo || "Trabajo HN Muebles";
    content.appendChild(img);
  }

  if (counter) counter.innerText = `${visorIndiceActual + 1} / ${media.length}`;
}


function visorPortafolioAnterior(event) {
  event?.stopPropagation();
  if (!visorTrabajoActual) return;
  visorIndiceActual--;
  mostrarMediaVisor();
}


function visorPortafolioSiguiente(event) {
  event?.stopPropagation();
  if (!visorTrabajoActual) return;
  visorIndiceActual++;
  mostrarMediaVisor();
}


function manejarTecladoVisor(event) {
  const visor = document.getElementById("hn-portfolio-viewer");
  if (!visor || visor.style.display === "none") return;
  if (event.key === "Escape") cerrarVisorPortafolio();
  if (event.key === "ArrowLeft") visorPortafolioAnterior();
  if (event.key === "ArrowRight") visorPortafolioSiguiente();
}


function cerrarVisorPortafolio() {
  const visor = document.getElementById("hn-portfolio-viewer");
  if (visor) visor.style.display = "none";
  document.body.style.overflow = "";
  visorTrabajoActual = null;
  visorIndiceActual = 0;
  document.removeEventListener("keydown", manejarTecladoVisor);
}


function renderPortafolioPublico() {
  const container = document.getElementById("portfolio-grid");
  if (!container) return;
  container.innerHTML = "";

  if (!portafolio.length) {
    container.innerHTML = `<div class="portfolio-empty"><p>Próximamente mostraremos nuestros trabajos aquí.</p></div>`;
    return;
  }

  portafolio.forEach(trabajo => {
    const card = document.createElement("article");
    card.className = "portfolio-card";
    const media = Array.isArray(trabajo.media) ? trabajo.media : [];
    const primerMedia = media[0];
    let mediaHTML = "";

    if (primerMedia) {
      mediaHTML = `
        <div class="portfolio-media" style="position:relative; cursor:pointer;" onclick="abrirVisorPortafolio('${trabajo.id}',0)">
          <img src="${primerMedia.url}" alt="" loading="lazy" style="width:100%; height:100%; object-fit:cover;"/>
        </div>
      `;
    }

    card.innerHTML = `
      ${mediaHTML}
      <div class="portfolio-card-body">
        <div class="portfolio-card-title">${escaparHTML(trabajo.titulo || "")}</div>
        <div class="portfolio-card-description">${escaparHTML(trabajo.descripcion || "")}</div>
      </div>
    `;
    container.appendChild(card);
  });
}


async function cargarPortafolioAdmin() {
  if (!esAdmin || !auth.currentUser) return;
  const snapshot = await db.collection("portafolio").orderBy("creadoEn", "desc").get();
  portafolio = [];
  snapshot.forEach(doc => portafolio.push({ id: doc.id, ...doc.data() }));
  renderPortafolioAdmin();
}


function mostrarPreviewArchivos() {
  const container = document.getElementById("portfolio-files-preview");
  const fotos = Array.from(document.getElementById("portfolio-fotos")?.files || []);
  const videos = Array.from(document.getElementById("portfolio-videos")?.files || []);
  if (!container) return;
  container.innerHTML = "";

  [...fotos, ...videos].forEach(archivo => {
    const div = document.createElement("div");
    div.className = "file-preview";
    const url = URL.createObjectURL(archivo);
    div.innerHTML = `<img src="${url}" alt="">`;
    container.appendChild(div);
  });
}


// Función de subida a Cloudinary
async function subirArchivoCloudinary(archivo, nombreCarpeta = "") {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    if (nombreCarpeta) {
      const carpetaLimpia = nombreCarpeta
        .trim()
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, "_")
        .replace(/\s+/g, "_");
      
      formData.append("folder", `cotizaciones/${carpetaLimpia}`);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Cloudinary rechazó el archivo. Código: " + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error("Error de conexión con Cloudinary."));
    xhr.send(formData);
  });
}


async function publicarTrabajoPortafolio(e) {
  e.preventDefault();
  
  if (!esAdmin || !auth.currentUser) {
    alert("Acceso denegado. Debes iniciar sesión como administrador.");
    return;
  }

  const titulo = document.getElementById("portfolio-titulo")?.value.trim() || "";
  const descripcion = document.getElementById("portfolio-descripcion")?.value.trim() || "";
  const fotos = Array.from(document.getElementById("portfolio-fotos")?.files || []);
  const videos = Array.from(document.getElementById("portfolio-videos")?.files || []);
  const archivos = [...fotos, ...videos];

  if (!titulo) {
    alert("Por favor escribe un título para el trabajo.");
    return;
  }

  if (!archivos.length) {
    alert("Por favor selecciona al menos una foto o video.");
    return;
  }

  alert(`Subiendo ${archivos.length} archivo(s)... Por favor espera un momento.`);

  try {
    const media = [];
    for (const archivo of archivos) {
      const resultado = await subirArchivoCloudinary(archivo);
      media.push({
        tipo: archivo.type.startsWith("video/") ? "video" : "imagen",
        url: resultado.secure_url || resultado.url,
        public_id: resultado.public_id || "",
        nombre: archivo.name
      });
    }

    await db.collection("portafolio").add({
      titulo,
      descripcion,
      media,
      creadoPor: auth.currentUser.email,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById("form-portafolio")?.reset();
    const previewContainer = document.getElementById("portfolio-files-preview");
    if (previewContainer) previewContainer.innerHTML = "";

    await cargarPortafolioAdmin();
    await cargarPortafolioPublico();
    
    alert("¡Trabajo publicado correctamente!");
  } catch (error) {
    console.error("Error publicando portafolio:", error);
    alert("Error al publicar: " + error.message);
  }
}


function renderPortafolioAdmin() {
  const container = document.getElementById("lista-portafolio-admin");
  const total = document.getElementById("total-portafolio");
  if (total) total.innerText = portafolio.length;
  if (!container) return;

  container.innerHTML = "";
  if (!portafolio.length) {
    container.innerHTML = `<div style="text-align:center; color:#777; padding:25px;">Todavía no tienes trabajos publicados.</div>`;
    return;
  }

  portafolio.forEach((trabajo) => {
    const card = document.createElement("div");
    card.className = "portfolio-admin-card";
    card.id = `portfolio-admin-item-${trabajo.id}`;
    
    const primerMedia = trabajo.media?.[0];
    const thumb = primerMedia?.url || "";

    card.innerHTML = `
      <div style="cursor:pointer; position:relative;" onclick="abrirVisorPortafolio('${trabajo.id}',0)">
        <img src="${thumb}" class="portfolio-admin-thumb" alt="">
      </div>
      <div class="portfolio-admin-info" id="portfolio-info-${trabajo.id}">
        <strong>${escaparHTML(trabajo.titulo || "")}</strong>
        <p>${escaparHTML(trabajo.descripcion || "")}</p>
        <p>${trabajo.media?.length || 0} archivo(s)</p>
      </div>
      <div class="portfolio-admin-actions" style="display:flex; gap:6px;">
        <button type="button" onclick="activarEdicionPortafolio('${trabajo.id}')" style="background:#3b82f6; color:#fff; border:none; padding:8px 10px; border-radius:6px; cursor:pointer;" title="Editar trabajo">✏️</button>
        <button type="button" class="delete-portfolio-btn" onclick="confirmarEliminarTrabajoPortafolio('${trabajo.id}', '${escaparHTML(trabajo.titulo || "")}')" style="background:#ef4444; color:#fff; border:none; padding:8px 10px; border-radius:6px; cursor:pointer;" title="Eliminar trabajo">🗑️</button>
      </div>
    `;
    container.appendChild(card);
  });
}


function activarEdicionPortafolio(id) {
  const trabajo = portafolio.find(p => p.id === id);
  const infoContainer = document.getElementById(`portfolio-info-${id}`);
  if (!trabajo || !infoContainer) return;

  const media = Array.isArray(trabajo.media) ? trabajo.media : [];

  let mediaItemsHTML = media.map((m, idx) => `
    <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:5px; border-radius:4px; margin-bottom:4px;">
      <img src="${m.url}" style="width:35px; height:35px; object-fit:cover; border-radius:3px;" alt="">
      <span style="font-size:0.75rem; color:#ccc; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.nombre || `Archivo ${idx + 1}`}</span>
      <button type="button" onclick="confirmarEliminarArchivoIndividual('${id}', ${idx})" style="background:#ef4444; color:#fff; border:none; padding:3px 7px; border-radius:3px; cursor:pointer; font-size:0.7rem;" title="Eliminar esta foto">✕</button>
    </div>
  `).join("");

  infoContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
      <input type="text" id="edit-port-titulo-${id}" value="${escaparHTML(trabajo.titulo || "")}" placeholder="Título" style="padding:6px; border-radius:4px; border:1px solid #555; background:#222; color:#fff; font-size:0.9rem;">
      <textarea id="edit-port-desc-${id}" placeholder="Descripción" style="padding:6px; border-radius:4px; border:1px solid #555; background:#222; color:#fff; font-size:0.85rem; resize:vertical;">${escaparHTML(trabajo.descripcion || "")}</textarea>
      
      <div style="font-size:0.8rem; color:#38bdf8; margin-top:2px;">Archivos actuales (puedes eliminar los que no quieras):</div>
      <div style="max-height:140px; overflow-y:auto; padding-right:4px;">
        ${mediaItemsHTML || '<div style="font-size:0.75rem; color:#777;">No hay archivos.</div>'}
      </div>

      <div style="margin-top:4px;">
        <label style="font-size:0.78rem; color:#a3a3a3; display:block; margin-bottom:3px;">Agregar más fotos/videos:</label>
        <input type="file" id="edit-port-nuevos-archivos-${id}" multiple accept="image/*,video/*" style="font-size:0.75rem; color:#ccc;">
      </div>

      <div style="display:flex; gap:6px; margin-top:6px;">
        <button type="button" onclick="guardarEdicionPortafolio('${id}')" style="background:#16a34a; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;">Guardar cambios</button>
        <button type="button" onclick="renderPortafolioAdmin()" style="background:#555; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Cancelar</button>
      </div>
    </div>
  `;
}


function confirmarEliminarArchivoIndividual(trabajoId, indexMedia) {
  const trabajo = portafolio.find(p => p.id === trabajoId);
  if (!trabajo || !trabajo.media) return;

  if (trabajo.media.length <= 1) {
    alert("El trabajo debe tener al menos una foto o video. No puedes eliminar la última.");
    return;
  }

  mostrarModalConfirmacion(
    "¿Eliminar archivo?",
    "¿Estás seguro de que deseas eliminar esta foto del álbum?",
    () => ejecutarEliminarArchivoIndividual(trabajoId, indexMedia)
  );
}


async function ejecutarEliminarArchivoIndividual(trabajoId, indexMedia) {
  if (!esAdmin || !auth.currentUser) return;

  const trabajo = portafolio.find(p => p.id === trabajoId);
  if (!trabajo || !trabajo.media) return;

  trabajo.media.splice(indexMedia, 1);
  activarEdicionPortafolio(trabajoId);

  try {
    await db.collection("portafolio").doc(trabajoId).update({
      media: trabajo.media
    });
    renderPortafolioPublico();
  } catch (error) {
    console.error("Error al eliminar archivo individual:", error);
    alert("Hubo un error al actualizar la base de datos.");
  }
}


async function guardarEdicionPortafolio(id) {
  if (!esAdmin || !auth.currentUser) return;

  const nuevoTitulo = document.getElementById(`edit-port-titulo-${id}`)?.value.trim() || "";
  const nuevaDesc = document.getElementById(`edit-port-desc-${id}`)?.value.trim() || "";
  const nuevosArchivosInput = document.getElementById(`edit-port-nuevos-archivos-${id}`);
  const nuevosArchivos = nuevosArchivosInput ? Array.from(nuevosArchivosInput.files) : [];

  if (!nuevoTitulo) {
    alert("El título no puede estar vacío.");
    return;
  }

  const idx = portafolio.findIndex(p => p.id === id);
  if (idx === -1) return;

  let mediaActualizada = [...(portafolio[idx].media || [])];

  try {
    if (nuevosArchivos.length > 0) {
      alert(`Subiendo ${nuevosArchivos.length} archivo(s) nuevo(s)... Espera un momento.`);
      for (const archivo of nuevosArchivos) {
        const resultado = await subirArchivoCloudinary(archivo);
        mediaActualizada.push({
          tipo: archivo.type.startsWith("video/") ? "video" : "imagen",
          url: resultado.secure_url || resultado.url,
          public_id: resultado.public_id || "",
          nombre: archivo.name
        });
      }
    }

    portafolio[idx].titulo = nuevoTitulo;
    portafolio[idx].descripcion = nuevaDesc;
    portafolio[idx].media = mediaActualizada;

    renderPortafolioAdmin();
    renderPortafolioPublico();

    await db.collection("portafolio").doc(id).update({
      titulo: nuevoTitulo,
      descripcion: nuevaDesc,
      media: mediaActualizada
    });

    alert("¡Trabajo actualizado correctamente!");
  } catch (error) {
    console.error("Error al actualizar portafolio:", error);
    alert("Hubo un error al actualizar los datos: " + error.message);
  }
}


function confirmarEliminarTrabajoPortafolio(id, tituloTrabajo) {
  mostrarModalConfirmacion(
    "¿Eliminar trabajo del portafolio?",
    `¿Estás seguro de que deseas eliminar "${tituloTrabajo || 'este trabajo'}" del portafolio? Esta acción es irreversible.`,
    () => ejecutarEliminarTrabajoPortafolio(id)
  );
}


async function ejecutarEliminarTrabajoPortafolio(id) {
  if (!esAdmin || !auth.currentUser) return;

  portafolio = portafolio.filter(p => p.id !== id);
  renderPortafolioAdmin();
  renderPortafolioPublico();
  cerrarVisorPortafolio();

  try {
    await db.collection("portafolio").doc(id).delete();
  } catch (error) {
    console.error("Error eliminando portafolio:", error);
  }
}


// ============================================================
// 12. DOM READY & COTIZADOR WHATSAPP CON CLOUDINARY (LINKS NOMBRADOS)
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  const formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("input-email")?.value.trim().toLowerCase();
      const password = document.getElementById("input-pass")?.value || "";
      if (!email || !password) return;

      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (error) {
        console.error("ERROR LOGIN:", error);
      }
    });
  }

  const formBuscar = document.getElementById("form-buscar");
  if (formBuscar) {
    formBuscar.addEventListener("submit", async function (e) {
      e.preventDefault();
      const codigo = document.getElementById("input-codigo")?.value.trim().toUpperCase();
      if (codigo) await buscarProyectoPublico(codigo);
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const codigoUrl = urlParams.get("codigo");
  if (codigoUrl) {
    const inputCodigo = document.getElementById("input-codigo");
    if (inputCodigo) {
      inputCodigo.value = codigoUrl;
      buscarProyectoPublico(codigoUrl);
    }
  }

  const presupuestoInput = document.getElementById("nuevo-presupuesto");
  const adelantoInput = document.getElementById("nuevo-adelanto");

  function calcularSaldoNuevo() {
    const total = Number(presupuestoInput?.value) || 0;
    const adelanto = Number(adelantoInput?.value) || 0;
    const saldo = Math.max(total - adelanto, 0);

    const totalPreview = document.getElementById("nuevo-total-preview");
    const adelantoPreview = document.getElementById("nuevo-adelanto-preview");
    const saldoPreview = document.getElementById("nuevo-saldo-preview");

    if (totalPreview) totalPreview.innerText = `Bs. ${formatearMonto(total)}`;
    if (adelantoPreview) adelantoPreview.innerText = `Bs. ${formatearMonto(adelanto)}`;
    if (saldoPreview) saldoPreview.innerText = `Bs. ${formatearMonto(saldo)}`;
  }

  presupuestoInput?.addEventListener("input", calcularSaldoNuevo);
  adelantoInput?.addEventListener("input", calcularSaldoNuevo);
  calcularSaldoNuevo();

  const formNuevo = document.getElementById("form-nuevo-proyecto");
  if (formNuevo) {
    formNuevo.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!esAdmin || !auth.currentUser) return;

      const codigo = document.getElementById("nuevo-codigo")?.value.trim().toUpperCase() || generarCodigoAleatorio();
      const cliente = document.getElementById("nuevo-cliente")?.value.trim() || "";
      const mueble = document.getElementById("nuevo-mueble")?.value.trim() || "";
      const telefono = document.getElementById("nuevo-telefono")?.value.trim() || "";
      const presupuesto = Number(document.getElementById("nuevo-presupuesto")?.value) || 0;
      const adelanto = Number(document.getElementById("nuevo-adelanto")?.value) || 0;
      const fechaEntrega = document.getElementById("nuevo-fecha")?.value || "";
      const pendiente = Math.max(presupuesto - adelanto, 0);

      const proyectoRef = db.collection("proyectos").doc();
      const ingresoRef = db.collection("ingresos").doc();
      const publicoRef = db.collection("proyectos_publicos").doc(proyectoRef.id);

      const proyecto = {
        id: proyectoRef.id,
        codigo, cliente, mueble, telefono,
        estado: "Diseño Aprobado",
        progreso: 20,
        detalles: "Diseño confirmado por WhatsApp. Listo para corte.",
        presupuesto, adelanto, fechaEntrega,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };

      const ingreso = {
        id: ingresoRef.id,
        proyectoId: proyectoRef.id,
        codigo, cliente, mueble, presupuesto, adelanto,
        pagosFinales: 0, cobrado: adelanto, pendiente,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      };

      proyectos.unshift(proyecto);
      ingresos.unshift(ingreso);
      renderProyectosAdmin();
      renderGestionIngresos();

      document.getElementById("nuevo-codigo").value = generarCodigoAleatorio();
      document.getElementById("nuevo-cliente").value = "";
      document.getElementById("nuevo-mueble").value = "";
      document.getElementById("nuevo-telefono").value = "";
      document.getElementById("nuevo-presupuesto").value = "";
      document.getElementById("nuevo-adelanto").value = "";
      document.getElementById("nuevo-fecha").value = "";
      calcularSaldoNuevo();

      try {
        const batch = db.batch();
        batch.set(proyectoRef, proyecto);
        batch.set(ingresoRef, ingreso);
        batch.set(publicoRef, { codigo, cliente, mueble, estado: "Diseño Aprobado", progreso: 20, detalles: "Diseño confirmado por WhatsApp.", fechaEntrega });
        await batch.commit();
      } catch (error) {
        console.error("Error creando proyecto:", error);
        alert("Hubo un error al guardar en la base de datos: " + error.message);
      }
    });
  }

  // ============================================================
  // INTEGRACIÓN DEL FORMULARIO DE COTIZACIÓN CON CLOUDINARY
  // ============================================================
  const formCotizacionMedidas = document.getElementById("form-cotizacion") || document.getElementById("form-cotizacion-medidas"); 
  if (formCotizacionMedidas) {
    formCotizacionMedidas.addEventListener("submit", async function (e) {
      e.preventDefault();

      const nombreCliente = document.getElementById("cotiza-nombre")?.value.trim() || document.getElementById("nombre-cliente")?.value.trim() || "Cliente";
      const telefonoCliente = document.getElementById("cotiza-telefono")?.value.trim() || document.getElementById("telefono-cliente")?.value.trim() || "";
      const tipoMueble = document.getElementById("cotiza-categoria")?.value.trim() || document.getElementById("tipo-mueble")?.value.trim() || "Mueble a medida";
      const detallesMueble = document.getElementById("cotiza-detalles")?.value.trim() || document.getElementById("detalles-mueble")?.value.trim() || "";
      
      const alto = document.getElementById("medida-alto")?.value.trim() || "";
      const largo = document.getElementById("medida-largo")?.value.trim() || "";
      const profundidad = document.getElementById("medida-profundidad")?.value.trim() || "";

      const inputArchivo = document.getElementById("cotiza-foto") || document.getElementById("foto-referencia") || document.querySelector("input[type='file']"); 
      const archivosSeleccionados = inputArchivo?.files ? Array.from(inputArchivo.files) : [];

      let contadorFotos = 1;
      let contadorVideos = 1;
      let detalleArchivosMensaje = [];

      if (archivosSeleccionados.length > 0) {
        try {
          const botonEnviar = formCotizacionMedidas.querySelector("button[type='submit']");
          if (botonEnviar) botonEnviar.textContent = "Subiendo archivos...";

          for (const archivo of archivosSeleccionados) {
            const resultado = await subirArchivoCloudinary(archivo, nombreCliente);
            const urlCloudinary = resultado.secure_url || resultado.url;

            if (archivo.type && archivo.type.startsWith("video/")) {
              detalleArchivosMensaje.push(`🎥 Video ${contadorVideos}: ${urlCloudinary}`);
              contadorVideos++;
            } else {
              detalleArchivosMensaje.push(`📷 Foto ${contadorFotos}: ${urlCloudinary}`);
              contadorFotos++;
            }
          }
          
          if (botonEnviar) botonEnviar.textContent = "Enviar cotización";
        } catch (error) {
          console.error("Error subiendo archivos:", error);
          alert("Hubo un problema al subir los archivos a Cloudinary, pero se enviarán los datos de texto.");
        }
      }

      const numeroTaller = "59162037033";

      let lineasMensaje = [
        "Hola, vengo desde la web de HN Muebles. ¡Quiero una cotización!",
        "",
        `Cliente: ${nombreCliente}`,
        `Teléfono: ${telefonoCliente || 'No especificado'}`,
        `Mueble: ${tipoMueble}`
      ];

      if (alto || largo || profundidad) {
        lineasMensaje.push("Medidas ingresadas:");
        if (alto) lineasMensaje.push(` - Alto: ${alto}`);
        if (largo) lineasMensaje.push(` - Largo/Ancho: ${largo}`);
        if (profundidad) lineasMensaje.push(` - Profundidad: ${profundidad}`);
      }

      if (detallesMueble) {
        lineasMensaje.push(`Detalles: ${detallesMueble}`);
      }

      if (detalleArchivosMensaje.length > 0) {
        lineasMensaje.push("");
        lineasMensaje.push("📂 *Archivos de referencia:*");
        lineasMensaje.push(...detalleArchivosMensaje);
      }

      const mensajeFinal = encodeURIComponent(lineasMensaje.join("\n"));
      window.open(`https://wa.me/${numeroTaller}?text=${mensajeFinal}`, "_blank");
    });
  }

  const filtroIngresos = document.getElementById("ingresos-mes");
  if (filtroIngresos) {
    const ahora = new Date();
    filtroIngresos.value = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
    filtroIngresos.addEventListener("change", () => renderGestionIngresos());
  }

  crearVisorPortafolio();
  cargarPortafolioPublico();

  document.getElementById("portfolio-fotos")?.addEventListener("change", mostrarPreviewArchivos);
  document.getElementById("portfolio-videos")?.addEventListener("change", mostrarPreviewArchivos);

  const formPortfolio = document.getElementById("form-portafolio");
  if (formPortfolio) {
    formPortfolio.addEventListener("submit", publicarTrabajoPortafolio);
  }

})
