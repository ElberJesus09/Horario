const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const STORAGE_KEY = "horario-pro-data";
const DEFAULT_RANGE = { start: "06:00", end: "22:00" };

const state = {
  courses: [],
  range: { ...DEFAULT_RANGE },
};

const els = {
  form: document.querySelector("#courseForm"),
  formTitle: document.querySelector("#formTitle"),
  courseId: document.querySelector("#courseId"),
  courseName: document.querySelector("#courseName"),
  teacherName: document.querySelector("#teacherName"),
  day: document.querySelector("#day"),
  room: document.querySelector("#room"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  color: document.querySelector("#color"),
  resetFormBtn: document.querySelector("#resetFormBtn"),
  deleteCourseBtn: document.querySelector("#deleteCourseBtn"),
  scheduleGrid: document.querySelector("#scheduleGrid"),
  rangeStart: document.querySelector("#rangeStart"),
  rangeEnd: document.querySelector("#rangeEnd"),
  conflictBanner: document.querySelector("#conflictBanner"),
  courseCount: document.querySelector("#courseCount"),
  conflictCount: document.querySelector("#conflictCount"),
  hourCount: document.querySelector("#hourCount"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
  downloadExcelBtn: document.querySelector("#downloadExcelBtn"),
  downloadPdfBtn: document.querySelector("#downloadPdfBtn"),
  downloadTemplateBtn: document.querySelector("#downloadTemplateBtn"),
  downloadProgressBtn: document.querySelector("#downloadProgressBtn"),
  fileInput: document.querySelector("#fileInput"),
  template: document.querySelector("#courseBlockTemplate"),
  modal: document.querySelector("#appModal"),
  modalCard: document.querySelector(".modal-card"),
  modalIcon: document.querySelector("#modalIcon"),
  modalKicker: document.querySelector("#modalKicker"),
  modalTitle: document.querySelector("#modalTitle"),
  modalMessage: document.querySelector("#modalMessage"),
  modalCancelBtn: document.querySelector("#modalCancelBtn"),
  modalConfirmBtn: document.querySelector("#modalConfirmBtn"),
  courseModal: document.querySelector("#courseModal"),
  courseModalColor: document.querySelector("#courseModalColor"),
  courseModalTitle: document.querySelector("#courseModalTitle"),
  courseModalMessage: document.querySelector("#courseModalMessage"),
  courseModalCloseBtn: document.querySelector("#courseModalCloseBtn"),
  courseModalDeleteBtn: document.querySelector("#courseModalDeleteBtn"),
  courseModalEditBtn: document.querySelector("#courseModalEditBtn"),
};

let modalResolver = null;
let selectedCourseId = null;

function closeModal(result = false) {
  els.modal.hidden = true;
  if (modalResolver) {
    modalResolver(result);
    modalResolver = null;
  }
}

function showModal({
  title,
  message,
  kicker = "Aviso",
  icon = "!",
  type = "info",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  showCancel = false,
}) {
  els.modalCard.className = `modal-card is-${type}`;
  els.modalIcon.textContent = icon;
  els.modalKicker.textContent = kicker;
  els.modalTitle.textContent = title;
  els.modalMessage.textContent = message;
  els.modalConfirmBtn.textContent = confirmText;
  els.modalCancelBtn.textContent = cancelText;
  els.modalCancelBtn.hidden = !showCancel;
  els.modal.hidden = false;
  els.modalConfirmBtn.focus();

  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function notifySuccess(title, message) {
  return showModal({ title, message, kicker: "Listo", icon: "OK", type: "success" });
}

function notifyError(title, message) {
  return showModal({ title, message, kicker: "Revisar", icon: "!", type: "danger" });
}

function confirmAction(title, message, confirmText = "Aceptar") {
  return showModal({
    title,
    message,
    kicker: "Confirmacion",
    icon: "?",
    type: "danger",
    confirmText,
    showCancel: true,
  });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildTimeOptions(select, selectedValue) {
  select.innerHTML = "";
  for (let minutes = 0; minutes <= 24 * 60; minutes += 30) {
    if (minutes === 24 * 60 && select !== els.rangeEnd) continue;
    const value = minutesToTime(minutes);
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = selectedValue;
}

function setupTimeSelects() {
  buildTimeOptions(els.startTime, "08:00");
  buildTimeOptions(els.endTime, "10:00");
  buildTimeOptions(els.rangeStart, DEFAULT_RANGE.start);
  buildTimeOptions(els.rangeEnd, DEFAULT_RANGE.end);
}

function minutesToTime(total) {
  const hours = Math.floor(total / 60).toString().padStart(2, "0");
  const minutes = (total % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function clampRangeToCourses() {
  if (!state.courses.length) return;
  const minStart = Math.min(...state.courses.map((course) => timeToMinutes(course.start)));
  const maxEnd = Math.max(...state.courses.map((course) => timeToMinutes(course.end)));
  const start = Math.min(timeToMinutes(state.range.start), Math.floor(minStart / 60) * 60);
  const end = Math.max(timeToMinutes(state.range.end), Math.ceil(maxEnd / 60) * 60);
  state.range.start = minutesToTime(Math.max(0, start));
  state.range.end = minutesToTime(Math.min(24 * 60, end));
  els.rangeStart.value = state.range.start;
  els.rangeEnd.value = state.range.end;
}

function normalizeCourse(raw) {
  return {
    id: raw.id || uid(),
    name: String(raw.name || raw.Curso || "").trim(),
    teacher: String(raw.teacher || raw.Profesor || "").trim(),
    day: DAYS.includes(raw.day || raw.Dia) ? raw.day || raw.Dia : "Lunes",
    room: String(raw.room || raw.Aula || "").trim(),
    start: String(raw.start || raw.Inicio || "08:00").slice(0, 5),
    end: String(raw.end || raw.Fin || "10:00").slice(0, 5),
    color: raw.color || raw.Color || "#2563eb",
  };
}

function getConflicts() {
  const conflicts = [];
  const byId = new Set();

  DAYS.forEach((day) => {
    const dayCourses = state.courses
      .filter((course) => course.day === day)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    for (let i = 0; i < dayCourses.length; i += 1) {
      for (let j = i + 1; j < dayCourses.length; j += 1) {
        const current = dayCourses[i];
        const next = dayCourses[j];
        if (timeToMinutes(next.start) < timeToMinutes(current.end)) {
          byId.add(current.id);
          byId.add(next.id);
          conflicts.push(`${day}: ${current.name} se cruza con ${next.name}`);
        }
      }
    }
  });

  return { conflicts, ids: byId };
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadLocal() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.courses = Array.isArray(parsed.courses) ? parsed.courses.map(normalizeCourse) : [];
    state.range = parsed.range || { ...DEFAULT_RANGE };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resetForm() {
  els.form.reset();
  els.courseId.value = "";
  els.startTime.value = "08:00";
  els.endTime.value = "10:00";
  els.color.value = "#2563eb";
  els.formTitle.textContent = "Nuevo curso";
  els.deleteCourseBtn.hidden = true;
}

function closeCourseModal() {
  selectedCourseId = null;
  els.courseModal.hidden = true;
}

function openCourseModal(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) return;
  selectedCourseId = id;
  els.courseModalColor.style.background = course.color;
  els.courseModalTitle.textContent = course.name;
  els.courseModalMessage.textContent = `${course.teacher} | ${course.day} ${course.start}-${course.end}${course.room ? ` | Aula ${course.room}` : ""}`;
  els.courseModal.hidden = false;
  els.courseModalEditBtn.focus();
}

function editCourse(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) return;
  closeCourseModal();
  els.courseId.value = course.id;
  els.courseName.value = course.name;
  els.teacherName.value = course.teacher;
  els.day.value = course.day;
  els.room.value = course.room;
  els.startTime.value = course.start;
  els.endTime.value = course.end;
  els.color.value = course.color;
  els.formTitle.textContent = "Editar curso";
  els.deleteCourseBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteCourse(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) return;
  closeCourseModal();
  const confirmed = await confirmAction("Eliminar curso", `Quieres eliminar "${course.name}" del horario?`, "Eliminar");
  if (!confirmed) return;
  state.courses = state.courses.filter((item) => item.id !== id);
  resetForm();
  render();
}

function renderSchedule() {
  clampRangeToCourses();
  const startMinute = timeToMinutes(state.range.start);
  const endMinute = timeToMinutes(state.range.end);
  const totalMinutes = Math.max(60, endMinute - startMinute);
  const hourRows = Math.ceil(totalMinutes / 60);
  const { conflicts, ids } = getConflicts();

  els.scheduleGrid.innerHTML = "";
  els.scheduleGrid.style.gridTemplateRows = `48px repeat(${hourRows}, var(--hour-height))`;

  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = "Hora";
  els.scheduleGrid.append(corner);

  DAYS.forEach((day) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = day;
    els.scheduleGrid.append(header);
  });

  for (let row = 0; row < hourRows; row += 1) {
    const time = startMinute + row * 60;
    const timeCell = document.createElement("div");
    timeCell.className = "time-cell";
    timeCell.textContent = minutesToTime(time);
    els.scheduleGrid.append(timeCell);

    DAYS.forEach((day) => {
      const column = document.createElement("div");
      column.className = "day-column";
      column.dataset.day = day;
      column.style.height = "var(--hour-height)";
      els.scheduleGrid.append(column);
    });
  }

  DAYS.forEach((day, dayIndex) => {
    const dayCourses = state.courses.filter((course) => course.day === day);
    dayCourses.forEach((course) => {
      const courseStart = Math.max(timeToMinutes(course.start), startMinute);
      const courseEnd = Math.min(timeToMinutes(course.end), endMinute);
      if (courseEnd <= startMinute || courseStart >= endMinute) return;

      const rowStart = Math.floor((courseStart - startMinute) / 60) + 2;
      const column = els.scheduleGrid.children[(rowStart - 1) * 7 + dayIndex + 1];
      const block = els.template.content.firstElementChild.cloneNode(true);
      const top = ((courseStart - (startMinute + (rowStart - 2) * 60)) / 60) * 74;
      const height = Math.max(44, ((courseEnd - courseStart) / 60) * 74 - 8);

      block.style.top = `${top + 4}px`;
      block.style.height = `${height}px`;
      block.style.background = course.color;
      block.dataset.id = course.id;
      block.classList.toggle("conflict", ids.has(course.id));
      block.querySelector("strong").textContent = course.name;
      block.querySelector(".teacher").textContent = course.teacher;
      block.querySelector(".meta").textContent = `${course.start}-${course.end}${course.room ? ` - ${course.room}` : ""}`;
      block.addEventListener("click", () => openCourseModal(course.id));
      column.append(block);
    });
  });

  const totalHours = state.courses.reduce(
    (sum, course) => sum + Math.max(0, timeToMinutes(course.end) - timeToMinutes(course.start)) / 60,
    0,
  );

  els.courseCount.textContent = state.courses.length;
  els.conflictCount.textContent = conflicts.length;
  els.hourCount.textContent = totalHours.toFixed(totalHours % 1 ? 1 : 0);
  els.conflictBanner.hidden = conflicts.length === 0;
  els.conflictBanner.textContent = conflicts.length
    ? `Cruces detectados: ${conflicts.join(" | ")}`
    : "";
}

function render() {
  renderSchedule();
  saveLocal();
}

function courseRows() {
  return state.courses
    .slice()
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start))
    .map((course) => ({
      Curso: course.name,
      Profesor: course.teacher,
      Dia: course.day,
      Inicio: course.start,
      Fin: course.end,
      Aula: course.room,
      Color: course.color,
    }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadExcel(filename = "horario.xlsx", rows = courseRows()) {
  if (!window.XLSX) {
    notifyError("No se pudo exportar", "La libreria de Excel no cargo. Revisa la conexion e intenta de nuevo.");
    return false;
  }
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Horario");
  XLSX.writeFile(workbook, filename);
  return true;
}

function downloadPdf() {
  if (!window.jspdf) {
    notifyError("No se pudo exportar", "La libreria de PDF no cargo. Revisa la conexion e intenta de nuevo.");
    return false;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  const { conflicts } = getConflicts();
  doc.setFontSize(18);
  doc.text("Horario Pro", 14, 18);
  doc.setFontSize(10);
  doc.text(`Cursos: ${state.courses.length} | Cruces: ${conflicts.length}`, 14, 26);
  doc.autoTable({
    startY: 34,
    head: [["Curso", "Profesor", "Dia", "Inicio", "Fin", "Aula"]],
    body: courseRows().map((row) => [row.Curso, row.Profesor, row.Dia, row.Inicio, row.Fin, row.Aula]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  if (conflicts.length) {
    doc.text("Cruces:", 14, doc.lastAutoTable.finalY + 12);
    conflicts.forEach((conflict, index) => doc.text(`- ${conflict}`, 14, doc.lastAutoTable.finalY + 19 + index * 6));
  }
  doc.save("horario.pdf");
  return true;
}

function downloadProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, "avance-horario.json");
}

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(firstSheet));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function importFile(file) {
  if (!file) return;
  try {
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(await file.text());
      state.courses = Array.isArray(parsed.courses) ? parsed.courses.map(normalizeCourse) : [];
      state.range = parsed.range || { ...DEFAULT_RANGE };
    } else {
      if (!window.XLSX) {
        notifyError("No se pudo importar", "La libreria de Excel no cargo. Revisa la conexion e intenta de nuevo.");
        return;
      }
      const rows = await readWorkbook(file);
      state.courses = rows.map(normalizeCourse).filter((course) => course.name && course.teacher);
      state.range = { ...DEFAULT_RANGE };
    }
    els.rangeStart.value = state.range.start;
    els.rangeEnd.value = state.range.end;
    resetForm();
    render();
    notifySuccess("Archivo cargado", "El horario se actualizo con el archivo que subiste.");
  } catch {
    notifyError("No se pudo cargar", "Revisa que sea un avance JSON o una plantilla Excel valida.");
  } finally {
    els.fileInput.value = "";
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const start = els.startTime.value;
  const end = els.endTime.value;
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    notifyError("Horario invalido", "La hora final debe ser mayor que la hora inicial.");
    return;
  }

  const course = normalizeCourse({
    id: els.courseId.value || uid(),
    name: els.courseName.value,
    teacher: els.teacherName.value,
    day: els.day.value,
    room: els.room.value,
    start,
    end,
    color: els.color.value,
  });

  const existingIndex = state.courses.findIndex((item) => item.id === course.id);
  if (existingIndex >= 0) {
    state.courses[existingIndex] = course;
  } else {
    state.courses.push(course);
  }
  resetForm();
  render();
});

els.resetFormBtn.addEventListener("click", resetForm);

els.deleteCourseBtn.addEventListener("click", () => deleteCourse(els.courseId.value));

els.rangeStart.addEventListener("change", () => {
  state.range.start = els.rangeStart.value || DEFAULT_RANGE.start;
  render();
});

els.rangeEnd.addEventListener("change", () => {
  state.range.end = els.rangeEnd.value || DEFAULT_RANGE.end;
  render();
});

els.clearAllBtn.addEventListener("click", async () => {
  if (state.courses.length) {
    const confirmed = await confirmAction("Limpiar horario", "Quieres borrar todos los cursos del horario?", "Borrar todo");
    if (!confirmed) return;
  }
  state.courses = [];
  resetForm();
  render();
});

els.downloadExcelBtn.addEventListener("click", () => {
  if (downloadExcel()) notifySuccess("Excel generado", "Se descargo el archivo horario.xlsx.");
});

els.downloadPdfBtn.addEventListener("click", () => {
  if (downloadPdf()) notifySuccess("PDF generado", "Se descargo el archivo horario.pdf.");
});

els.downloadTemplateBtn.addEventListener("click", () => {
  const rows = [
    { Curso: "Ejemplo", Profesor: "Nombre profesor", Dia: "Lunes", Inicio: "08:00", Fin: "10:00", Aula: "A-101", Color: "#2563eb" },
  ];
  if (downloadExcel("plantilla-horario.xlsx", rows)) {
    notifySuccess("Plantilla descargada", "Completa la plantilla y subela desde la seccion Importar.");
  }
});

els.downloadProgressBtn.addEventListener("click", () => {
  downloadProgress();
  notifySuccess("Avance guardado", "Se descargo avance-horario.json para retomarlo despues.");
});

els.fileInput.addEventListener("change", (event) => importFile(event.target.files[0]));
els.modalConfirmBtn.addEventListener("click", () => closeModal(true));
els.modalCancelBtn.addEventListener("click", () => closeModal(false));
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeModal(false);
});
els.courseModalCloseBtn.addEventListener("click", closeCourseModal);
els.courseModalEditBtn.addEventListener("click", () => editCourse(selectedCourseId));
els.courseModalDeleteBtn.addEventListener("click", () => deleteCourse(selectedCourseId));
els.courseModal.addEventListener("click", (event) => {
  if (event.target === els.courseModal) closeCourseModal();
});
document.addEventListener("keydown", (event) => {
  if (!els.modal.hidden && event.key === "Escape") closeModal(false);
  if (!els.courseModal.hidden && event.key === "Escape") closeCourseModal();
});

setupTimeSelects();
loadLocal();
els.rangeStart.value = state.range.start || DEFAULT_RANGE.start;
els.rangeEnd.value = state.range.end || DEFAULT_RANGE.end;
render();
