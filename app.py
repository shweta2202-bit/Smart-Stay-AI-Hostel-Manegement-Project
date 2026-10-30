
from flask import Flask, request, jsonify, send_from_directory
from pathlib import Path
import sqlite3

# ---------- PROJECT PATHS ----------
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
DB_PATH = BASE_DIR / "hostel.db"

# Serve frontend files: index.html, style.css, script.js
app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path=""
)


# ---------- DATABASE ----------
def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    with get_db() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY,
                capacity INTEGER NOT NULL DEFAULT 4
            );

            CREATE TABLE IF NOT EXISTS students (
                student_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT DEFAULT '',
                course TEXT DEFAULT '',
                room_id INTEGER,
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            );

            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                room_id INTEGER,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending'
            );

            CREATE TABLE IF NOT EXISTS notices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Normal',
                message TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contacts (
                role TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL
            );
        """)

        # Create rooms 1–250, each with four beds.
        con.executemany(
            "INSERT OR IGNORE INTO rooms (id, capacity) VALUES (?, 4)",
            [(i,) for i in range(1, 251)]
        )


def query_all(sql, params=()):
    with get_db() as con:
        return [
            dict(row)
            for row in con.execute(sql, params).fetchall()
        ]


def room_details(room_id):
    with get_db() as con:
        room = con.execute(
            "SELECT * FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()

        if room is None:
            return None

        occupied = con.execute(
            "SELECT COUNT(*) FROM students WHERE room_id = ?",
            (room_id,)
        ).fetchone()[0]

        return {
            "id": room_id,
            "capacity": room["capacity"],
            "occupied": occupied,
            "available": room["capacity"] - occupied
        }


# ---------- FRONTEND ----------
@app.route("/")
def home():
    index_file = FRONTEND_DIR / "index.html"

    if not index_file.is_file():
        return f"index.html not found at: {index_file}", 404

    return send_from_directory(str(FRONTEND_DIR), "index.html")


# ---------- HEALTH CHECK ----------
@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "project": "NOVA SmartStay"
    })


# ---------- ROOMS ----------
@app.get("/api/rooms")
def get_rooms():
    rooms = query_all("SELECT id FROM rooms ORDER BY id")
    return jsonify([
        room_details(room["id"]) for room in rooms
    ])


# ---------- STUDENTS ----------
@app.get("/api/students")
def get_students():
    return jsonify(query_all("""
        SELECT student_id, name, phone, course, room_id
        FROM students
        ORDER BY name
    """))


@app.post("/api/students")
def add_student():
    data = request.get_json(silent=True) or {}

    student_id = str(data.get("student_id", "")).strip()
    name = str(data.get("name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    course = str(data.get("course", "")).strip()
    room_value = data.get("room_id")

    if not student_id or not name:
        return jsonify({
            "error": "Student ID and name are required."
        }), 400

    room_id = None

    if room_value not in (None, ""):
        try:
            room_id = int(room_value)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid room number."}), 400

        if not 1 <= room_id <= 250:
            return jsonify({
                "error": "Room number must be between 1 and 250."
            }), 400

    try:
        with get_db() as con:
            if room_id is not None:
                room = con.execute(
                    "SELECT capacity FROM rooms WHERE id = ?",
                    (room_id,)
                ).fetchone()

                if room is None:
                    return jsonify({"error": "Room not found."}), 404

                occupied = con.execute(
                    "SELECT COUNT(*) FROM students WHERE room_id = ?",
                    (room_id,)
                ).fetchone()[0]

                if occupied >= room["capacity"]:
                    return jsonify({"error": "Room is full."}), 409

            con.execute("""
                INSERT INTO students
                (student_id, name, phone, course, room_id)
                VALUES (?, ?, ?, ?, ?)
            """, (student_id, name, phone, course, room_id))

    except sqlite3.IntegrityError:
        return jsonify({
            "error": "This student ID already exists."
        }), 409

    return jsonify({"message": "Student added successfully."}), 201


@app.delete("/api/students/<student_id>")
def delete_student(student_id):
    with get_db() as con:
        result = con.execute(
            "DELETE FROM students WHERE student_id = ?",
            (student_id,)
        )

        if result.rowcount == 0:
            return jsonify({"error": "Student not found."}), 404

    return jsonify({"message": "Student deleted."})


# ---------- ROOM ALLOCATION ----------
@app.post("/api/allocations")
def allocate_room():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id", "")).strip()

    try:
        room_id = int(data.get("room_id", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid room number."}), 400

    if not 1 <= room_id <= 250:
        return jsonify({"error": "Invalid room number."}), 400

    with get_db() as con:
        student = con.execute(
            "SELECT room_id FROM students WHERE student_id = ?",
            (student_id,)
        ).fetchone()

        if student is None:
            return jsonify({"error": "Student not found."}), 404

        if student["room_id"] is not None:
            return jsonify({
                "error": "Student already has a room allocated."
            }), 409

        room = con.execute(
            "SELECT capacity FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()

        if room is None:
            return jsonify({"error": "Room not found."}), 404

        occupied = con.execute(
            "SELECT COUNT(*) FROM students WHERE room_id = ?",
            (room_id,)
        ).fetchone()[0]

        if occupied >= room["capacity"]:
            return jsonify({"error": "Room is full."}), 409

        con.execute(
            "UPDATE students SET room_id = ? WHERE student_id = ?",
            (room_id, student_id)
        )

    return jsonify({"message": "Room allocated successfully."})


# ---------- COMPLAINTS ----------
@app.get("/api/complaints")
def get_complaints():
    return jsonify(query_all(
        "SELECT * FROM complaints ORDER BY id DESC"
    ))


@app.post("/api/complaints")
def add_complaint():
    data = request.get_json(silent=True) or {}

    student_name = str(data.get("student_name", "")).strip()
    message = str(data.get("message", "")).strip()
    room_value = data.get("room_id")
    room_id = None

    if not student_name or not message:
        return jsonify({
            "error": "Student name and complaint details are required."
        }), 400

    if room_value not in (None, ""):
        try:
            room_id = int(room_value)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid room number."}), 400

        if not 1 <= room_id <= 250:
            return jsonify({"error": "Invalid room number."}), 400

    with get_db() as con:
        cur = con.execute("""
            INSERT INTO complaints (student_name, room_id, message)
            VALUES (?, ?, ?)
        """, (student_name, room_id, message))

        complaint_id = cur.lastrowid

    return jsonify({
        "id": complaint_id,
        "message": "Complaint submitted."
    }), 201


@app.patch("/api/complaints/<int:complaint_id>")
def update_complaint(complaint_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ("Pending", "In Progress", "Resolved"):
        return jsonify({"error": "Invalid complaint status."}), 400

    with get_db() as con:
        cur = con.execute(
            "UPDATE complaints SET status = ? WHERE id = ?",
            (status, complaint_id)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Complaint not found."}), 404

    return jsonify({"message": "Complaint status updated."})


# ---------- NOTICES ----------
@app.get("/api/notices")
def get_notices():
    return jsonify(query_all(
        "SELECT * FROM notices ORDER BY id DESC"
    ))


@app.post("/api/notices")
def add_notice():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    message = str(data.get("message", "")).strip()
    priority = data.get("priority", "Normal")

    if not title or not message:
        return jsonify({
            "error": "Notice title and message are required."
        }), 400

    if priority not in ("Normal", "Important", "Urgent"):
        return jsonify({"error": "Invalid notice priority."}), 400

    with get_db() as con:
        cur = con.execute("""
            INSERT INTO notices (title, priority, message)
            VALUES (?, ?, ?)
        """, (title, priority, message))

        notice_id = cur.lastrowid

    return jsonify({
        "id": notice_id,
        "message": "Notice published."
    }), 201


# ---------- CONTACTS ----------
@app.get("/api/contacts")
def get_contacts():
    return jsonify(query_all(
        "SELECT role, name, phone FROM contacts ORDER BY role"
    ))


@app.put("/api/contacts/<path:role>")
def save_contact(role):
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    phone = str(data.get("phone", "")).strip()

    allowed_roles = (
        "Rector 1", "Rector 2", "Watchman", "Landline"
    )

    if role not in allowed_roles:
        return jsonify({"error": "Unknown contact role."}), 400

    if not name or not phone:
        return jsonify({
            "error": "Contact name and phone are required."
        }), 400

    with get_db() as con:
        con.execute("""
            INSERT INTO contacts (role, name, phone)
            VALUES (?, ?, ?)
            ON CONFLICT(role) DO UPDATE SET
                name = excluded.name,
                phone = excluded.phone
        """, (role, name, phone))

    return jsonify({"message": "Contact saved successfully."})


# ---------- DASHBOARD ----------
@app.get("/api/dashboard")
def dashboard():
    with get_db() as con:
        total_rooms = con.execute(
            "SELECT COUNT(*) FROM rooms"
        ).fetchone()[0]

        total_beds = con.execute(
            "SELECT COALESCE(SUM(capacity), 0) FROM rooms"
        ).fetchone()[0]

        total_students = con.execute(
            "SELECT COUNT(*) FROM students"
        ).fetchone()[0]

        occupied_rooms = con.execute("""
            SELECT COUNT(DISTINCT room_id)
            FROM students
            WHERE room_id IS NOT NULL
        """).fetchone()[0]

        complaint_count = con.execute(
            "SELECT COUNT(*) FROM complaints"
        ).fetchone()[0]

        notice_count = con.execute(
            "SELECT COUNT(*) FROM notices"
        ).fetchone()[0]

    available_beds = total_beds - total_students

    return jsonify({
        "total_rooms": total_rooms,
        "total_beds": total_beds,
        "total_students": total_students,
        "available_beds": available_beds,
        "occupied_beds": total_students,
        "occupied_rooms": occupied_rooms,
        "empty_rooms": total_rooms - occupied_rooms,
        "occupancy_percent": round(
            total_students * 100 / total_beds, 1
        ) if total_beds else 0,
        "complaints": complaint_count,
        "notices": notice_count
    })


# ---------- START SERVER ----------
if __name__ == "__main__":
    init_db()
    app.run(debug=True)
