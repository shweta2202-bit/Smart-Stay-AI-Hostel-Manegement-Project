
"use strict";

// ==================== CONFIGURATION ====================
const TOTAL_ROOMS = 250;
const BEDS_PER_ROOM = 4;
const ROOM_PREFIX = "A";
const ROOM_START = 1;
const TOTAL_BEDS = TOTAL_ROOMS * BEDS_PER_ROOM;

const KEYS = {
  students: "students",
  complaints: "complaints",
  notices: "notices",
  contacts: "contacts"
};

// ==================== DATA STORAGE ====================
function readData(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let students = readData(KEYS.students, []);
let complaints = readData(KEYS.complaints, []);
let notices = readData(KEYS.notices, []);

let contacts = readData(KEYS.contacts, {
  rector1Name: "Rector 1",
  rector1Phone: "",
  rector2Name: "Rector 2",
  rector2Phone: "",
  watchmanName: "Watchman",
  watchmanPhone: "",
  landlineName: "Hostel Landline",
  landlinePhone: ""
});

if (!Array.isArray(students)) students = [];
if (!Array.isArray(complaints)) complaints = [];
if (!Array.isArray(notices)) notices = [];

const rooms = Array.from({ length: TOTAL_ROOMS }, function (_, index) {
  return {
    id: ROOM_PREFIX + (ROOM_START + index),
    capacity: BEDS_PER_ROOM
  };
});

let toastTimer;

// ==================== HELPER FUNCTIONS ====================
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char];
  });
}

function notify(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 2600);
}

function getRoom(roomId) {
  return rooms.find(function (room) {
    return room.id === roomId;
  });
}

function roomOccupants(roomId) {
  return students.filter(function (student) {
    return student.room === roomId;
  });
}

function roomAvailable(roomId) {
  return Math.max(0, BEDS_PER_ROOM - roomOccupants(roomId).length);
}

// ==================== PAGE NAVIGATION ====================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".nav-link").forEach(function (button) {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const titles = {
    dashboard: "Dashboard",
    students: "Student Management",
    rooms: "Room Management",
    complaints: "Complaints",
    notices: "Notice Board",
    contacts: "Contact Directory",
    reports: "Reports"
  };

  const title = document.getElementById("pageTitle");
  if (title) title.textContent = titles[pageId] || "NOVA";

  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach(function (button) {
  button.addEventListener("click", function () {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-goto]").forEach(function (button) {
  button.addEventListener("click", function () {
    showPage(button.dataset.goto);
  });
});

// ==================== ROOM DROPDOWNS ====================
function availableRoomOptions(selectedValue) {
  return rooms
    .filter(function (room) {
      return roomAvailable(room.id) > 0 || room.id === selectedValue;
    })
    .map(function (room) {
      const free = roomAvailable(room.id);
      return `<option value="${room.id}" ${
        room.id === selectedValue ? "selected" : ""
      }>${room.id} — ${free} bed${free === 1 ? "" : "s"} available</option>`;
    })
    .join("");
}

function refreshRoomSelects() {
  const studentRoom = document.getElementById("studentRoom");
  const allocationRoom = document.getElementById("allocationRoom");
  const complaintRoom = document.getElementById("complaintRoom");

  if (studentRoom) {
    const previous = studentRoom.value;
    studentRoom.innerHTML =
      '<option value="">Not allocated yet</option>' +
      availableRoomOptions(previous);
  }

  if (allocationRoom) {
    const previous = allocationRoom.value;
    allocationRoom.innerHTML = availableRoomOptions(previous);

    if (!allocationRoom.options.length) {
      allocationRoom.innerHTML =
        '<option value="">No beds available</option>';
    }
  }

  if (complaintRoom) {
    const previous = complaintRoom.value;
    complaintRoom.innerHTML =
      '<option value="">Not specified</option>' +
      rooms.map(function (room) {
        return `<option value="${room.id}" ${
          room.id === previous ? "selected" : ""
        }>${room.id}</option>`;
      }).join("");
  }

  renderAllocationStudentOptions();
}

function renderAllocationStudentOptions() {
  const select = document.getElementById("allocationStudent");
  if (!select) return;

  const previous = select.value;
  const unallocated = students.filter(function (student) {
    return !student.room;
  });

  select.innerHTML = unallocated.length
    ? unallocated.map(function (student) {
        return `<option value="${escapeHTML(student.id)}" ${
          student.id === previous ? "selected" : ""
        }>${escapeHTML(student.name)} (${escapeHTML(student.id)})</option>`;
      }).join("")
    : '<option value="">No unallocated students</option>';
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const occupiedBeds = students.filter(function (student) {
    return Boolean(student.room);
  }).length;

  const availableBeds = Math.max(0, TOTAL_BEDS - occupiedBeds);

  const occupiedRooms = rooms.filter(function (room) {
    return roomOccupants(room.id).length > 0;
  }).length;

  const values = {
    totalRooms: TOTAL_ROOMS,
    totalBeds: TOTAL_BEDS.toLocaleString(),
    totalStudents: students.length,
    availableBeds: availableBeds.toLocaleString(),
    occupiedLabel: occupiedBeds.toLocaleString() + " / " + TOTAL_BEDS.toLocaleString(),
    occupiedRooms: occupiedRooms,
    emptyRooms: TOTAL_ROOMS - occupiedRooms
  };

  Object.keys(values).forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.textContent = values[id];
  });

  const bar = document.getElementById("occupancyBar");
  if (bar) {
    bar.style.width = Math.min(100, occupiedBeds / TOTAL_BEDS * 100) + "%";
  }

  const recentContainer = document.getElementById("recentStudents");
  if (!recentContainer) return;

  const recent = students.slice(-5).reverse();

  recentContainer.innerHTML = recent.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Student ID</th><th>Course</th><th>Room</th></tr></thead>
        <tbody>${recent.map(function (student) {
          return `<tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.id)}</td>
            <td>${escapeHTML(student.course || "—")}</td>
            <td>${escapeHTML(student.room || "Not allocated")}</td>
          </tr>`;
        }).join("")}</tbody></table></div>`
    : "No students registered yet.";
}

// ==================== STUDENT MANAGEMENT ====================
function renderStudents() {
  const table = document.getElementById("studentTable");
  const empty = document.getElementById("studentEmpty");
  if (!table || !empty) return;

  const searchElement = document.getElementById("studentSearch");
  const search = searchElement ? searchElement.value.trim().toLowerCase() : "";

  const filtered = students.slice().reverse().filter(function (student) {
    return [
      student.name,
      student.id,
      student.phone,
      student.course,
      student.room
    ].some(function (value) {
      return String(value || "").toLowerCase().includes(search);
    });
  });

  table.innerHTML = filtered.map(function (student) {
    return `<tr>
      <td>${escapeHTML(student.name)}</td>
      <td>${escapeHTML(student.id)}</td>
      <td>${escapeHTML(student.course || "—")}</td>
      <td>${escapeHTML(student.phone || "—")}</td>
      <td>${escapeHTML(student.room || "Not allocated")}</td>
      <td><button class="action-btn danger-btn"
        data-delete-student="${escapeHTML(student.id)}">Delete</button></td>
    </tr>`;
  }).join("");

  empty.style.display = filtered.length ? "none" : "block";
}

const studentSearch = document.getElementById("studentSearch");
if (studentSearch) {
  studentSearch.addEventListener("input", renderStudents);
}

const studentForm = document.getElementById("studentForm");
if (studentForm) {
  studentForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("studentName").value.trim();
    const id = document.getElementById("studentId").value.trim();
    const phone = document.getElementById("studentPhone").value.trim();
    const course = document.getElementById("studentCourse").value.trim();
    const room = document.getElementById("studentRoom").value;

    if (!name || !id) {
      notify("Enter the student's name and ID.");
      return;
    }

    if (students.some(function (student) {
      return student.id.toLowerCase() === id.toLowerCase();
    })) {
      notify("That student ID already exists.");
      return;
    }

    if (room && (!getRoom(room) || roomAvailable(room) <= 0)) {
      notify("This room is full. Select another room.");
      return;
    }

    students.push({
      id: id,
      name: name,
      phone: phone,
      course: course,
      room: room,
      createdAt: new Date().toLocaleDateString()
    });

    saveData(KEYS.students, students);
    studentForm.reset();
    renderAll();
    notify("Student registered successfully.");
  });
}

const studentTable = document.getElementById("studentTable");
if (studentTable) {
  studentTable.addEventListener("click", function (event) {
    const button = event.target.closest("[data-delete-student]");
    if (!button) return;

    const id = button.dataset.deleteStudent;
    const student = students.find(function (item) {
      return item.id === id;
    });

    if (!student || !confirm("Delete student " + student.name + "?")) return;

    students = students.filter(function (item) {
      return item.id !== id;
    });

    saveData(KEYS.students, students);
    renderAll();
    notify("Student record deleted.");
  });
}

// ==================== ROOM MANAGEMENT ====================
function renderRooms() {
  const roomGrid = document.getElementById("roomGrid");
  if (!roomGrid) return;

  const searchElement = document.getElementById("roomSearch");
  const search = searchElement ? searchElement.value.trim().toLowerCase() : "";

  const occupiedBeds = students.filter(function (student) {
    return Boolean(student.room);
  }).length;

  const values = {
    roomCount: TOTAL_ROOMS,
    roomBedCount: TOTAL_BEDS.toLocaleString(),
    roomOccupied: occupiedBeds,
    roomFree: Math.max(0, TOTAL_BEDS - occupiedBeds).toLocaleString()
  };

  Object.keys(values).forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.textContent = values[id];
  });

  const filteredRooms = rooms.filter(function (room) {
    return room.id.toLowerCase().includes(search);
  });

  roomGrid.innerHTML = filteredRooms.map(function (room) {
    const occupants = roomOccupants(room.id);
    const free = BEDS_PER_ROOM - occupants.length;

    let className = "";
    if (free === 0) {
      className = "full";
    } else if (occupants.length > 0) {
      className = "partial";
    }

    const bedDots = Array.from(
      { length: BEDS_PER_ROOM },
      function (_, index) {
        const filled = index < occupants.length ? "filled" : "";
        return `<span class="bed-dot ${filled}"></span>`;
      }
    ).join("");

    return `<div class="room-card ${className}">
      <h4>${escapeHTML(room.id)}</h4>
      <p>${occupants.length}/${BEDS_PER_ROOM} beds occupied</p>
      <div class="bed-dots">${bedDots}</div>
      <p style="margin-top:9px">${free} bed${free === 1 ? "" : "s"} free</p>
    </div>`;
  }).join("");

  if (!filteredRooms.length) {
    roomGrid.innerHTML =
      '<div class="empty-state">No rooms match your search.</div>';
  }
}

const roomSearch = document.getElementById("roomSearch");
if (roomSearch) {
  roomSearch.addEventListener("input", renderRooms);
}

const allocationForm = document.getElementById("allocationForm");
if (allocationForm) {
  allocationForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const studentId = document.getElementById("allocationStudent").value;
    const roomId = document.getElementById("allocationRoom").value;

    const student = students.find(function (item) {
      return item.id === studentId;
    });

    if (!student) {
      notify("Register a student without a room first.");
      return;
    }

    if (!getRoom(roomId) || roomAvailable(roomId) <= 0) {
      notify("This room is full. Choose another room.");
      return;
    }

    student.room = roomId;
    saveData(KEYS.students, students);
    renderAll();
    notify(student.name + " allocated to " + roomId + ".");
  });
}

// ==================== COMPLAINTS ====================
function categorizeComplaint(text) {
  const value = text.toLowerCase();

  if (/electric|light|fan|switch|power|socket|wiring/.test(value)) return "Electrical";
  if (/water|tap|pipe|leak|toilet|flush|plumb/.test(value)) return "Plumbing";
  if (/clean|garbage|dust|dirty|hygiene|waste/.test(value)) return "Cleaning";
  if (/wifi|internet|network|router/.test(value)) return "Internet";

  return "Other";
}

const complaintForm = document.getElementById("complaintForm");
if (complaintForm) {
  complaintForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const student = document.getElementById("complaintStudent").value.trim();
    const room = document.getElementById("complaintRoom").value;
    const text = document.getElementById("complaintText").value.trim();

    if (!student || !text) {
      notify("Enter the student name and complaint details.");
      return;
    }

    complaints.unshift({
      id: "CMP-" + Date.now(),
      student: student,
      room: room,
      text: text,
      category: categorizeComplaint(text),
      status: "Open",
      date: new Date().toLocaleString()
    });

    saveData(KEYS.complaints, complaints);
    complaintForm.reset();
    renderAll();
    notify("Complaint submitted.");
  });
}

function renderComplaints() {
  const list = document.getElementById("complaintList");
  const empty = document.getElementById("complaintEmpty");
  if (!list || !empty) return;

  list.innerHTML = complaints.map(function (item) {
    return `<article class="list-card">
      <div class="list-card-top">
        <div>
          <h4>${escapeHTML(item.category)} complaint
            <span class="tag">${escapeHTML(item.id)}</span></h4>
          <p>${escapeHTML(item.text)}</p>
          <p style="margin-top:9px">Student: ${escapeHTML(item.student)}
            · Room: ${escapeHTML(item.room || "Not specified")}</p>
          <p style="margin-top:5px">${escapeHTML(item.date)}</p>
        </div>
        <span class="tag ${item.status === "Resolved" ? "resolved" : "urgent"}">
          ${escapeHTML(item.status)}
        </span>
      </div>
      ${item.status !== "Resolved"
        ? `<button class="action-btn" data-resolve-complaint="${escapeHTML(item.id)}">Mark resolved</button>`
        : ""}
      <button class="action-btn danger-btn" data-delete-complaint="${escapeHTML(item.id)}">Delete</button>
    </article>`;
  }).join("");

  empty.style.display = complaints.length ? "none" : "block";
}

const complaintList = document.getElementById("complaintList");
if (complaintList) {
  complaintList.addEventListener("click", function (event) {
    const resolveButton = event.target.closest("[data-resolve-complaint]");
    const deleteButton = event.target.closest("[data-delete-complaint]");

    if (resolveButton) {
      const item = complaints.find(function (complaint) {
        return complaint.id === resolveButton.dataset.resolveComplaint;
      });

      if (item) {
        item.status = "Resolved";
        saveData(KEYS.complaints, complaints);
        renderAll();
        notify("Complaint marked resolved.");
      }
    }

    if (deleteButton) {
      const id = deleteButton.dataset.deleteComplaint;
      complaints = complaints.filter(function (item) {
        return item.id !== id;
      });

      saveData(KEYS.complaints, complaints);
      renderAll();
      notify("Complaint deleted.");
    }
  });
}

// ==================== NOTICE BOARD ====================
const noticeForm = document.getElementById("noticeForm");
if (noticeForm) {
  noticeForm.addEventListener("submit", function (event) {
    event.preventDefault();

    notices.unshift({
      id: "NOTICE-" + Date.now(),
      title: document.getElementById("noticeTitle").value.trim(),
      priority: document.getElementById("noticePriority").value,
      message: document.getElementById("noticeMessage").value.trim(),
      date: new Date().toLocaleString()
    });

    saveData(KEYS.notices, notices);
    noticeForm.reset();
    renderAll();
    notify("Notice published successfully.");
  });
}

function renderNotices() {
  const list = document.getElementById("noticeList");
  const empty = document.getElementById("noticeEmpty");
  if (!list || !empty) return;

  list.innerHTML = notices.map(function (notice) {
    const priorityClass = notice.priority.toLowerCase();

    return `<article class="notice-card priority-${escapeHTML(priorityClass)}">
      <div class="list-card-top">
        <h4>${escapeHTML(notice.title)}</h4>
        <span class="tag ${
          priorityClass === "urgent" ? "urgent" :
          priorityClass === "important" ? "important" : ""
        }">${escapeHTML(notice.priority)}</span>
      </div>
      <p>${escapeHTML(notice.message)}</p>
      <div class="notice-meta">
        <span>${escapeHTML(notice.date)}</span>
        <button class="action-btn danger-btn"
          data-delete-notice="${escapeHTML(notice.id)}">Delete notice</button>
      </div>
    </article>`;
  }).join("");

  empty.style.display = notices.length ? "none" : "block";
}

const noticeList = document.getElementById("noticeList");
if (noticeList) {
  noticeList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-delete-notice]");
    if (!button) return;

    notices = notices.filter(function (notice) {
      return notice.id !== button.dataset.deleteNotice;
    });

    saveData(KEYS.notices, notices);
    renderAll();
    notify("Notice deleted.");
  });
}

// ==================== CONTACT DIRECTORY ====================
function phoneLink(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? "tel:" + digits : "";
}

function renderContacts() {
  const cards = document.getElementById("contactCards");
  if (!cards) return;

  const definitions = [
    ["rector1Name", "Rector 1", "rector1Phone", "Rector", "♙"],
    ["rector2Name", "Rector 2", "rector2Phone", "Rector", "♙"],
    ["watchmanName", "Watchman", "watchmanPhone", "Security", "◈"],
    ["landlineName", "Hostel Landline", "landlinePhone", "Landline", "☎"]
  ];

  cards.innerHTML = definitions.map(function (item) {
    const name = contacts[item[0]] || item[1];
    const phone = contacts[item[2]] || "";
    const href = phoneLink(phone);

    return `<div class="contact-card">
      <div class="contact-icon">${item[4]}</div>
      <h4>${escapeHTML(name)}</h4>
      <p>${escapeHTML(item[3])}</p>
      ${href
        ? `<a href="${escapeHTML(href)}">${escapeHTML(phone)} · Call</a>`
        : '<span class="muted">Add phone number below</span>'}
    </div>`;
  }).join("");

  [
    "rector1Name", "rector1Phone", "rector2Name", "rector2Phone",
    "watchmanName", "watchmanPhone", "landlineName", "landlinePhone"
  ].forEach(function (id) {
    const field = document.getElementById(id);
    if (field && document.activeElement !== field) {
      field.value = contacts[id] || "";
    }
  });
}

const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", function (event) {
    event.preventDefault();

    [
      "rector1Name", "rector1Phone", "rector2Name", "rector2Phone",
      "watchmanName", "watchmanPhone", "landlineName", "landlinePhone"
    ].forEach(function (id) {
      contacts[id] = document.getElementById(id).value.trim();
    });

    saveData(KEYS.contacts, contacts);
    renderContacts();
    notify("Contact details saved.");
  });
}

// ==================== REPORTS AND CSV EXPORT ====================
function renderReports() {
  const occupied = students.filter(function (student) {
    return Boolean(student.room);
  }).length;

  const values = {
    reportRooms: TOTAL_ROOMS,
    reportCapacity: TOTAL_BEDS.toLocaleString(),
    reportStudents: students.length,
    reportAvailable: Math.max(0, TOTAL_BEDS - occupied).toLocaleString(),
    reportComplaints: complaints.length,
    reportNotices: notices.length
  };

  Object.keys(values).forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.textContent = values[id];
  });
}

const exportButton = document.getElementById("exportCsv");
if (exportButton) {
  exportButton.addEventListener("click", function () {
    if (!students.length) {
      notify("There are no students to export yet.");
      return;
    }

    const columns = [
      "Name", "Student ID", "Phone", "Course", "Room", "Registered Date"
    ];

    const rows = students.map(function (student) {
      return [
        student.name,
        student.id,
        student.phone || "",
        student.course || "",
        student.room || "Not allocated",
        student.createdAt || ""
      ];
    });

    function csvCell(value) {
      return '"' + String(value ?? "").replace(/"/g, '""') + '"';
    }

    const csv = [columns].concat(rows).map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "RJ-hostel-students.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    notify("Student CSV report exported.");
  });
}

// ==================== RENDER EVERYTHING ====================
function renderAll() {
  renderDashboard();
  renderStudents();
  renderRooms();
  renderComplaints();
  renderNotices();
  renderContacts();
  renderReports();
  refreshRoomSelects();
}

// Start the application after HTML has loaded.
renderAll();
