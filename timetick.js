// TimeTick - Main Script
let schedules = JSON.parse(localStorage.getItem("schedules") || "[]");
let currentSchedule = [];
let scheduleIsVerified = false;
let editingIndex = null;
let serverTimeOffset = 0; 
let isBreakBlock = false; 
let queuedRealBlockIndex = null; 
let isLiveRun = false;
const suppressedPopups = new Set(
  JSON.parse(sessionStorage.getItem("suppressedPopups") || "[]")
);
let chromebookMode = sessionStorage.getItem("chromebookMode");

const savedSchedulesList = document.getElementById("savedSchedulesList");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const verifyScheduleBtn = document.getElementById("verifyScheduleBtn");
const tabLinks = document.querySelectorAll(".tablink");
const wizardSteps = document.querySelectorAll(".wizard-step");
const blockLabel = document.getElementById("blockLabel");
const blockStart = document.getElementById("blockStart");
const blockEnd = document.getElementById("blockEnd");
const addBlockBtn = document.getElementById("addBlockBtn");
const scheduleTableBody = document.getElementById("scheduleTableBody");
const saveScheduleBtn = document.getElementById("saveScheduleBtn");

const saveScheduleName = document.getElementById("saveScheduleName");
const blockDropdown = document.getElementById("blockDropdown");
const runDropdown = document.getElementById("styledDropdown");
const chromebookModeCheckbox = document.getElementById("chromebookModeCheckbox");

const runOverlay = document.getElementById("runOverlay");
const runLabel = document.getElementById("runLabel");
const runCountdown = document.getElementById("runCountdown");
const runProgressBar = document.getElementById("runProgressBar");
const runPrevBtn = document.getElementById("prevRunBlock");
const runNextBtn = document.getElementById("nextRunBlock");
const runSnapNowBtn = document.getElementById("snapToNow");
const exitRunBtn = document.getElementById("exitRunView");

const openBtn = document.getElementById("openOptionsBtn");
const closeBtn = document.getElementById("closeOptionsBtn");
const sidebar = document.getElementById("optionsSidebar");
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const clearToastHistoryBtn = document.getElementById("clear-toast-history-btn");

const dropdown = document.querySelector(".dropdown");
const dropdownToggle = document.querySelector(".dropdown-toggle");
const dropdownMenu = document.querySelector(".dropdown-menu");
const exportAllBtn = document.getElementById("exportAllSchedulesBtn");
const importBtn = document.getElementById("importSingleScheduleBtn");
const importFileInput = document.getElementById("importScheduleFileInput");

if (chromebookMode === null) {
  if (navigator.userAgent.includes("CrOS")) {
    chromebookMode = true;
    sessionStorage.setItem("chromebookMode", JSON.stringify(true));
  } else {
    chromebookMode = false;
    sessionStorage.setItem("chromebookMode", JSON.stringify(false));
  }
} else {
  chromebookMode = JSON.parse(chromebookMode);
}

function chromebookModeFunc() {
  if (chromebookMode) {
    document.querySelector(".dropdown-content").style.maxHeight = "350%";
  } else {
    document.querySelector(".dropdown-content").style.maxHeight = "700%";
  }
}

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastActions = document.getElementById("toastActions");
const toastMultipliers = new Map(); 
let lastToastOptions = null;
let runTimerTimeout = null;
let activeRunIndex = 0; 

const toastQueue = [];
const toastHistory = [];
let toastActive = false;

function showToast(message, options = {}) {
  const key = `${options.type || "info"}-${message}`;

  const existing = toastMultipliers.get(key);
  if (existing) {
    existing.count++;
    toastMultipliers.set(key, existing);

    if (toastActive && toastMessage.textContent.includes(message)) {
      toastMessage.textContent = `${message} x${existing.count}`;
    }

    return;
  }

  toastMultipliers.set(key, { count: 1 });
  lastToastOptions = options;
  toastQueue.push({ message, options, key });
  if (!toastActive || options.confirm) processNextToast();
}

function processNextToast() {
  if (toastQueue.length === 0) {
    toastActive = false;
    hideToast();
    return;
  }

  toastActive = true;

  const { message, options, key } = toastQueue.shift();

  toast.className = "toast"; 
  toastMessage.textContent = message;
  toast.classList.add("show");

  if (options.confirm) {
    hideToast();
    showConfirmPopup(
      options.message || toastMessage.textContent,
      () => {
        options.onConfirm?.();
        toastMultipliers.delete(key);
        processNextToast();
      },
      () => {
        options.onCancel?.();
        toastMultipliers.delete(key);
        processNextToast();
      },
      { key: options.key || message }
    );
  } else {
    const multiplier = toastMultipliers.get(key)?.count || 1;
    toastMessage.textContent =
      multiplier > 1 ? `${message} x${multiplier}` : message;

    const timestamp = new Date().toLocaleTimeString();
    toastHistory.unshift({
      message: multiplier > 1 ? `${message} x${multiplier}` : message,
      type: options.type || "info",
      timestamp,
    });
    renderToastHistory();

    setTimeout(() => {
      hideToast();
      toastMultipliers.delete(key);
      processNextToast();
    }, options.duration || 3000);
  }
}

function renderToastHistory() {
  const container = document.getElementById("toast-history-list");
  if (!container) return;

  container.innerHTML = ""; 
  clearToastHistoryBtn.classList.remove("hidden");

  if (toastHistory.length === 0) {
    clearToastHistoryBtn.classList.add("hidden");
    container.innerHTML = `<p class="empty-msg">No toasts yet.</p>`;
    return;
  }

  toastHistory.forEach(({ message, type, timestamp }) => {
    const div = document.createElement("div");
    div.className = `toast-history-entry toast-${type}`;

    div.innerHTML = `
      <div class="toast-entry-header">
        <span class="toast-type">${type.toUpperCase()}</span>
        <span class="toast-time">${timestamp}</span>
      </div>
      <div class="toast-entry-msg">${message}</div>
    `;

    container.appendChild(div);
  });
}

function addToastToHistory(message, options) {
  const list = document.getElementById("toast-history-list");
  const item = document.createElement("div");
  item.className = "toast-history-item";
  item.textContent = `[${options.type || "info"}] ${message}`;
  list.prepend(item); 
}

function hideToast() {
  toast.classList.remove("show");
}

function showConfirmPopup(message, onConfirm, onCancel, options = {}) {
  const key = options.key || message;

  if (suppressedPopups.has(key)) {
    onConfirm?.();
    return;
  }

  const overlay = document.getElementById("popupOverlay");
  const msgBox = document.getElementById("popupMessage");
  const confirmBtn = document.getElementById("popupConfirmBtn");
  const cancelBtn = document.getElementById("popupCancelBtn");
  const skipCheckbox = document.getElementById("popupSkipCheckbox");

  msgBox.textContent = message;
  confirmBtn.innerText = "Yes";
  cancelBtn.innerText = "No";
  overlay.classList.remove("hidden");

  skipCheckbox.checked = false;

  void overlay.offsetWidth;

  const close = () => overlay.classList.add("hidden");

  confirmBtn.onclick = () => {
    if (skipCheckbox.checked) {
      suppressedPopups.add(key);
      saveSuppressedPopups();
    }
    close();
    onConfirm?.();
  };

  cancelBtn.onclick = () => {
    close();
    onCancel?.();
  };
}

function saveSuppressedPopups() {
  sessionStorage.setItem(
    "suppressedPopups",
    JSON.stringify([...suppressedPopups])
  );
}

function openModal() {
  modalOverlay.classList.add("active");
}
function closeModal() {
  modalOverlay.classList.remove("active");
  resetModal();
}
function resetModal() {
  currentSchedule = [];
  editingIndex = null;
  saveScheduleName.value = "";
  blockLabel.value = blockStart.value = blockEnd.value = "";
  scheduleTableBody.innerHTML = "";
  switchTab(0);
}
function switchTab(index) {
  tabLinks.forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
    wizardSteps[i].classList.toggle("active", i === index);
  });
}

function renderSavedSchedules() {
  savedSchedulesList.innerHTML = "";
  schedules.forEach((sched, i) => {
    const div = document.createElement("div");
    div.className = "schedule-tile";
    div.innerHTML = `
      <h3>${sched.name}</h3>
      <div class="schedule-buttons">
        <button class="btn edit" onclick="editSchedule(${i})">Edit</button>
        <button class="btn run" onclick="runSchedule(${i})">Run</button>
        <button class="btn delete" onclick="deleteSchedule(${i})">Delete</button>
      </div>
    `;
    savedSchedulesList.appendChild(div);
  });
}

function addBlock() {
  const label = blockLabel.value.trim();
  const start = blockStart.value;
  const end = blockEnd.value;

  if (!end) return showToast("❌ End time is required.", { type: "error" });

  if (start && start >= end) {
    return showToast("❌ Start time must be before end time.", {
      type: "error",
    });
  }

  if (start === end) {
    return showToast("❌ Start and end times cannot be the same.", {
      type: "error",
    });
  }

  const newStart = start ? parseTime(start) : null;
  const newEnd = parseTime(end);
  const overlaps = currentSchedule.some((block) => {
    const existingStart = block.start ? parseTime(block.start) : null;
    const existingEnd = parseTime(block.end);

    const aStart = newStart || newEnd;
    const bStart = existingStart || existingEnd;

    return aStart < existingEnd && newEnd > bStart;
  });

  if (overlaps) {
    return showToast("❌ This block overlaps with an existing one.", {
      type: "error",
    });
  }

  currentSchedule.push({ label, start, end });
  renderScheduleTable();
  blockLabel.value = blockStart.value = blockEnd.value = "";
  scheduleIsVerified = false;
}

function renderScheduleTable() {
  scheduleTableBody.innerHTML = "";
  currentSchedule.forEach((block, i) => {
    const row = document.createElement("tr");
    row.dataset.index = i;
    row.innerHTML = `
      <td class="drag-handle">≡</td>
      <td><input type="text" value="${block.label || ""
      }" onchange="updateBlock(${i}, 'label', this.value)" /></td>
      <td><input type="time" value="${block.start || ""
      }" onchange="updateBlock(${i}, 'start', this.value)" /></td>
      <td><input type="time" value="${block.end || ""
      }" onchange="updateBlock(${i}, 'end', this.value)" /></td>
      <td><button class="btn delete" onclick="deleteBlock(${i})">Delete</button></td>
    `;
    scheduleTableBody.appendChild(row);
  });

  Sortable.create(scheduleTableBody, {
    handle: ".drag-handle",
    animation: 150,
    onEnd: function () {
      const newOrder = [];
      const rows = Array.from(scheduleTableBody.children);
      rows.forEach((row) => {
        const originalIndex = parseInt(row.dataset.index);
        newOrder.push(currentSchedule[originalIndex]);
      });
      currentSchedule = newOrder;
      renderScheduleTable(); 
    },
  });

  scheduleIsVerified = false;
  document.getElementById("verifyResult")?.remove(); 
}

function updateBlock(index, field, value) {
  currentSchedule[index][field] = value;
  scheduleIsVerified = false;

  showToast("⚠️ Schedule changed. Please verify again.", { type: "warning" });
}

function deleteBlock(index) {
  showToast("Delete this block?", {
    confirm: true,
    onConfirm: () => {
      currentSchedule.splice(index, 1);
      renderScheduleTable();
    },
  });
}

function verifySchedule() {
  const issues = [];
  const blocks = currentSchedule;
  const tableBody = document.getElementById("scheduleTableBody");
  const rows = tableBody.querySelectorAll("tr");

  let prevEnd = parseTime("00:00"); 

  rows.forEach((row) => row.classList.remove("invalid-row"));

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const row = rows[i];
    const label = block.label.trim();

    let hasIssue = false;

    if (!label || !block.end) {
      issues.push(`Block ${i + 1} has missing required fields.`);
      hasIssue = true;
    } else {
      const start = block.start ? parseTime(block.start) : prevEnd;
      const end = parseTime(block.end);

      if (start >= end) {
        issues.push(`Block ${i + 1} ("${label}") starts at or after it ends.`);
        hasIssue = true;
      }

      if (start < prevEnd) {
        issues.push(
          `Block ${i + 1} ("${label}") starts before previous block ended.`
        );
        hasIssue = true;
      }

      prevEnd = end;
    }

    if (hasIssue) {
      row.classList.add("invalid-row");
    }
  }

  if (issues.length === 0) {
    scheduleIsVerified = true;
    showToast("✅ Schedule looks good!", { type: "success" });
  } else {
    scheduleIsVerified = false;
    setTimeout(() => {
      alert("⚠️ Issues found:\n\n" + issues.join("\n"));
    }, 300);
  }
}

function saveSchedule() {
  const name = saveScheduleName.value.trim();
  if (!name || currentSchedule.length === 0)
    return showToast("❌ Schedule name and at least one block required.", {
      type: "error",
    });

  if (!scheduleIsVerified) {
    switchTab(1);
    return showToast("⚠️ Please verify the schedule before saving.", {
      type: "warning",
    });
  }

  const data = { name, blocks: currentSchedule };
  if (editingIndex !== null) {
    schedules[editingIndex] = data;
  } else {
    schedules.push(data);
  }
  localStorage.setItem("schedules", JSON.stringify(schedules));
  renderSavedSchedules();
  closeModal();
  showToast("✅ Schedule saved!", { type: "success" });
}

function exportAllSchedules() {
  const allSchedules = JSON.parse(localStorage.getItem("schedules") || "[]");
  dropdown.classList.remove("open");
  if (!allSchedules.length) {
    showToast("❌ No schedules to export", { type: "error" });
    return;
  }
  const jsonBlob = new Blob([JSON.stringify(allSchedules, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(jsonBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "all-schedules.json";
  downloadLink.click();
  URL.revokeObjectURL(url);
  showToast("✅ Exported all schedules", { type: "success" });
}

function processImportedJSON(jsonText) {
  dropdown.classList.remove("open");
  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      showToast("❌ Invalid file format", { type: "error" });
      return;
    }
    const optionsText = parsed
      .map((s, i) => `${i + 1}: ${s.name || "Untitled"}`)
      .join("\n");
    const choice = prompt(
      `Choose a schedule to import:\n\n${optionsText}\n\nEnter number:`
    );
    const index = parseInt(choice);
    if (!index || index < 1 || index > parsed.length) {
      showToast("❌ Invalid selection", { type: "error" });
      return;
    }
    const chosen = parsed[index - 1];
    if (!Array.isArray(chosen.blocks)) {
      showToast("❌ Selected schedule has no blocks", { type: "error" });
      return;
    }
    const existing = JSON.parse(localStorage.getItem("schedules") || "[]");
    existing.push(chosen);
    localStorage.setItem("schedules", JSON.stringify(existing));
    schedules = existing;
    renderSavedSchedules();
    showToast(`✅ Imported "${chosen.name || "Unnamed"}"`, { type: "success" });
  } catch {
    showToast("❌ Failed to parse JSON", { type: "error" });
  }
}

function editSchedule(index) {
  editingIndex = index;
  currentSchedule = [...schedules[index].blocks];
  saveScheduleName.value = schedules[index].name;
  renderScheduleTable();
  document.querySelector(":root").style.setProperty("--tabtransition", "0s");
  openModal();
  switchTab(1);
  setTimeout(
    () =>
      document
        .querySelector(":root")
        .style.setProperty("--tabtransition", "0.3s"),
    300
  );
}

function deleteSchedule(index) {
  showToast("Delete this schedule?", {
    confirm: true,
    onConfirm: () => {
      schedules.splice(index, 1);
      localStorage.setItem("schedules", JSON.stringify(schedules));
      renderSavedSchedules();
      showToast("✅ Schedule deleted!", { type: "success" });
    },
  });
}

function parseTime(str) {
  const [h, m] = str.split(":").map(Number);
  const d = getServerNow();
  d.setHours(h, m, 0, 0);
  return d;
}

function getServerNow() {
  return new Date(Date.now() + serverTimeOffset);
}

function synchronizeServerTime() {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "HEAD",
        window.location.href + "?cache_bust=" + Date.now(),
        true
      );
      xhr.onreadystatechange = function () {
        if (xhr.readyState === xhr.HEADERS_RECEIVED) {
          const serverDateStr = xhr.getResponseHeader("Date");
          if (serverDateStr) {
            const serverDate = new Date(serverDateStr).getTime();
            const localDate = Date.now();
            serverTimeOffset = serverDate - localDate;
            resolve();
          } else {

            serverTimeOffset = 0;
            resolve();
          }
        }
      };
      xhr.onerror = () => {
        serverTimeOffset = 0;
        resolve();
      };
      xhr.send();
    } catch {
      serverTimeOffset = 0;
      resolve();
    }
  });
}

function inferStartTimes(schedule) {
  const now = getServerNow();
  for (let i = 0; i < schedule.length; i++) {
    const block = schedule[i];
    if (!block.start || block.start.trim() === "") {
      if (i === 0) {
        block.__inferredStart = now;
      } else {
        const prevEnd = parseTime(schedule[i - 1].end);
        block.__inferredStart = prevEnd;
      }
    } else {
      block.__inferredStart = parseTime(block.start);
    }
  }
}

function populateRunDropdown() {
  const dropdown = document.getElementById("styledDropdown");
  dropdown.innerHTML = ""; 

  const now = getServerNow();

  currentSchedule.forEach((block, index) => {
    const option = document.createElement("div");
    option.classList.add("dropdown-option");

    const label = block.label || `Run Block ${index + 1}`;
    option.textContent = label;

    const end = parseTime(block.end);

    const isCompleted = now >= end;

    if (isCompleted) {
      option.classList.add("disabled"); 
      option.dataset.disabled = "true";
    }

    option.dataset.index = index;
    dropdown.appendChild(option);
  });
}

function showBreakUntil(index) {
  isBreakBlock = true;
  queuedRealBlockIndex = index;

  const block = currentSchedule[index];
  const start = block.__inferredStart;
  if (!start) {
    showToast("Cannot determine when to start next block.", { type: "error" });
    return;
  }

  runLabel.textContent = "⏸️ Transition / Break";
  runCountdown.textContent = "Waiting to start next block...";
  runProgressBar.style.width = `0%`;

  clearRunTimer();

  function tickBreak() {
    const now = getServerNow();
    const remaining = (start - now) / 1000;

    if (remaining <= 0) {
      isBreakBlock = false;
      updateRunBlock(queuedRealBlockIndex);
      return;
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = Math.floor(remaining % 60);
    runCountdown.textContent = `Resuming in ${hours ? `${hours}:` : ''}${mins}:${secs
      .toString()
      .padStart(2, "0")}`;

    runTimerTimeout = setTimeout(tickBreak, 500);
  }

  tickBreak();
}

function runSchedule(index) {
  const schedule = schedules[index];
  if (!schedule || !schedule.blocks.length) return;

  isLiveRun = true;

  currentSchedule = schedule.blocks;

  const now = getServerNow();

  let currentIdx = -1;
  for (let i = 0; i < currentSchedule.length; i++) {
    const block = currentSchedule[i];
    const start = block.__inferredStart;
    const end = parseTime(block.end);
    if (start && now >= start && now < end) {
      currentIdx = i;
      break;
    } else if (!start && now < end) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx === -1) {

    currentIdx = 0;

    const lastEnd = parseTime(currentSchedule[currentSchedule.length - 1].end);
    if (now >= lastEnd) {
      showToast("Schedule has ended.", { type: "info" });
      return;
    }
  }

  activeRunIndex = currentIdx;
  runOverlay.style.display = "flex";
  sidebar.classList.remove("open");
  inferStartTimes(currentSchedule);
  populateRunDropdown();

  const activeBlock = currentSchedule[currentIdx];
  const start = activeBlock.__inferredStart;

  if (start && now < start) {
    runOverlay.style.display = "flex";
    populateRunDropdown();
    showBreakUntil(currentIdx);
    return;
  }

  updateRunBlock(activeRunIndex);
}

function updateRunBlock(index) {
  if (index >= currentSchedule.length) {
    runOverlay.style.display = "none";
    showToast("✅ Schedule complete!", { type: "success" });
    clearRunTimer();
    return;
  }

  activeRunIndex = index;

  const block = currentSchedule[index];
  runLabel.textContent = block.label || "Unnamed Block";

  const now = getServerNow();
  const start = block.__inferredStart || now;
  const end = parseTime(block.end);
  const totalSeconds = Math.max(0, (end - start) / 1000);
  // Prevent showing break blocks unless in live mode
  if (isLiveRun && start && now < start) {
    showBreakUntil(index);
    return;
  }

  isBreakBlock = false;
  queuedRealBlockIndex = null;

  // If block already passed, jump to next
  if (end - now <= 0) {
    updateRunBlock(index + 1);
    return;
  }

  clearRunTimer();

  function tick() {
    const nowTick = getServerNow();
    let remainingSeconds = (end - nowTick) / 1000;

    let isFinalTick = false;

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      isFinalTick = true;
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = Math.floor(remainingSeconds % 60);
    runCountdown.textContent = `${hours}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    let elapsed = totalSeconds - remainingSeconds;
    if (elapsed < 0) elapsed = 0;

    const pct = totalSeconds > 0 ? (elapsed / totalSeconds) * 102 : 102;
    runProgressBar.style.width = `${pct}%`;

    if (isFinalTick) {
      setTimeout(() => {
        updateRunBlock(index + 1);
      }, 500);
      return;
    }

    runTimerTimeout = setTimeout(tick, 500);
  }

  populateRunDropdown();
  tick();
}

function clearRunTimer() {
  if (runTimerTimeout) {
    clearTimeout(runTimerTimeout);
    runTimerTimeout = null;
  }
}

runPrevBtn.addEventListener("click", () => {
  const now = getServerNow();
  const end = activeRunIndex !== 0 ? parseTime(currentSchedule[activeRunIndex - 1].end) : null;
  const isCompleted = end ? now >= end : null;
  isLiveRun = false;
  if (isBreakBlock) {
    updateRunBlock(activeRunIndex);
  } else if (isCompleted) {
    showToast("Previous block is already completed", { type: "error" });
  } else if (activeRunIndex > 0) {
    updateRunBlock(activeRunIndex - 1);
  } else {
    showToast("Already at first block", { type: "info" });
  }
});

runNextBtn.addEventListener("click", () => {
  isLiveRun = false;
  if (isBreakBlock) {
    updateRunBlock(activeRunIndex);
  } else if (activeRunIndex < currentSchedule.length - 1) {
    updateRunBlock(activeRunIndex + 1);
  } else {
    showToast("Already at last block", { type: "info" });
  }
});

runSnapNowBtn.addEventListener("click", () => {

  const now = getServerNow();
  isLiveRun = true;

  let currentIdx = -1;
  for (let i = 0; i < currentSchedule.length; i++) {
    const block = currentSchedule[i];
    const start = block.__inferredStart;
    const end = parseTime(block.end);
    if (start && now >= start && now < end) {
      currentIdx = i;
      break;
    } else if (!start && now < end) {
      currentIdx = i;
      break;
    }
  }

  const futureBlock = currentSchedule.find((b) => {
    const start = b.__inferredStart;
    return start && now < start;
  });

  if (currentIdx === -1 && futureBlock) {
    const idx = currentSchedule.indexOf(futureBlock);
    showToast("No active block. Waiting for next scheduled block.", {
      type: "info",
    });
    showBreakUntil(idx);
    return;
  } else if (currentIdx === -1) {
    showToast("No active block now", { type: "info" });
    return;
  } else if (currentIdx === activeRunIndex) {
    showToast("Already at snapped block", { type: "info" });
    return;
  }

  updateRunBlock(currentIdx);
  showToast("Snapped to current timeline", { type: "info" });
});

exitRunBtn.addEventListener("click", () => {
  isLiveRun = false;
  runOverlay.style.display = "none";
  clearRunTimer();
});

modalCloseBtn.onclick = closeModal;
addScheduleBtn.onclick = openModal;
tabLinks.forEach((btn, i) => (btn.onclick = () => switchTab(i)));
addBlockBtn.onclick = addBlock;
verifyScheduleBtn.onclick = verifySchedule;
saveScheduleBtn.onclick = saveSchedule;

openBtn.addEventListener("click", () => sidebar.classList.add("open"));
closeBtn.addEventListener("click", () => sidebar.classList.remove("open"));
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const tabId = tab.dataset.tab;
    tabContents.forEach((content) => {
      content.classList.toggle("hidden", content.id !== tabId);
    });
  });
});
document
  .querySelector('[data-tab="tab-toast-history"]')
  ?.addEventListener("click", () => {
    renderToastHistory();
  });

toast.addEventListener("click", (e) => {
  hideToast();
  processNextToast();
});
clearToastHistoryBtn.addEventListener("click", () => {
  toastHistory.length = 0;
  renderToastHistory();
});
dropdownToggle.addEventListener("click", () =>
  dropdown.classList.toggle("open")
);
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) dropdown.classList.remove("open");
  if (!e.target.closest(".btn-group-dropdown"))
    runDropdown.classList.remove("show");
});

exportAllBtn.onclick = exportAllSchedules;
importBtn.onclick = () => importFileInput.click();
importFileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => processImportedJSON(reader.result);
  reader.readAsText(file);
  importFileInput.value = "";
};
blockDropdown.addEventListener("click", () => {
  runDropdown.classList.toggle("show");
});
runDropdown.addEventListener("click", (e) => {
  isLiveRun = false;
  runDropdown.classList.toggle("show");
  const option = e.target.closest(".dropdown-option");
  if (!option) return;

  const index = parseInt(option.dataset.index);

  if (option.dataset.disabled === "true") {
    showToast("You can't jump to a completed block.", { type: "error" });
    return;
  }

  if (isBreakBlock && index === activeRunIndex) {
    updateRunBlock(activeRunIndex);
  } else if (index === activeRunIndex) {
    showToast("You're already on this block.", { type: "info" });
    return;
  }

  updateRunBlock(index);
  showToast(`Jumped to "${option.textContent}"`, {
    type: "success",
    duration: 1000,
  });
});
chromebookModeCheckbox.checked = chromebookMode;
chromebookModeCheckbox.onchange = () => {
  chromebookMode = chromebookModeCheckbox.checked;
  sessionStorage.setItem("chromebookMode", JSON.stringify(chromebookModeCheckbox.checked));
  chromebookModeFunc();
}

chromebookModeFunc();
renderSavedSchedules();

synchronizeServerTime().then(() => {
  console.log("Server time synchronized, offset (ms):", serverTimeOffset);
});

