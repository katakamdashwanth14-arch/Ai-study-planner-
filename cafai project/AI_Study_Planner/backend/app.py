import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", module="urllib3")

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from ai_engine import process_syllabus_and_plan, expectimax_study_decision, bayesian_update
import sqlite3

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

app = Flask(__name__)
CORS(app)

DB_PATH = 'cognistudy.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS users")
    c.execute("DROP TABLE IF EXISTS settings")
    c.execute("DROP TABLE IF EXISTS analytics")
    c.execute("DROP TABLE IF EXISTS tasks")
    c.execute("DROP TABLE IF EXISTS goals")
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            username TEXT PRIMARY KEY,
            difficulty TEXT,
            daily_hours INTEGER,
            break_duration TEXT,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS analytics (
            username TEXT PRIMARY KEY,
            streak_days INTEGER,
            focus_hours INTEGER,
            mastery_level REAL,
            subject_hours TEXT,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            title TEXT,
            subject TEXT,
            priority TEXT,
            deadline TEXT,
            status TEXT,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            goal_text TEXT,
            progress INTEGER,
            FOREIGN KEY(username) REFERENCES users(username)
        )
    ''')
    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

API_KEY = "YOUR_GEMINI_API_KEY_HERE"
if HAS_GENAI and API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None

@app.route('/')
def home():
    return "CogniStudy AI Backend is running successfully on Port 5001!"

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required."}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username = ?", (username,))
    if c.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Username already exists. Please login."}), 409
        
    hashed_pwd = generate_password_hash(password, method="pbkdf2:sha256")
    c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_pwd))
    
    # Defaults
    c.execute("INSERT INTO settings (username, difficulty, daily_hours, break_duration) VALUES (?, ?, ?, ?)", 
              (username, "Intermediate (Standard)", 4, "Short (5 mins)"))
    c.execute("INSERT INTO analytics (username, streak_days, focus_hours, mastery_level, subject_hours) VALUES (?, ?, ?, ?, ?)", 
              (username, 0, 0, 0.0, '{}'))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Sign up successful! You can now log in."})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT password FROM users WHERE username = ?", (username,))
    row = c.fetchone()
    conn.close()
    
    if row and check_password_hash(row[0], password):
        return jsonify({"success": True, "message": "Login successful.", "username": username})
    return jsonify({"success": False, "message": "Invalid username or password."}), 401

@app.route('/api/google_login', methods=['POST'])
def google_login():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({"success": False, "message": "Email required."}), 400
        
    username = email.split('@')[0]  # Just use the name part of email
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username = ?", (username,))
    row = c.fetchone()
    
    if not row:
        # Create user automatically
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, "GOOGLE_OAUTH_NO_PASS"))
        c.execute("INSERT INTO settings (username, difficulty, daily_hours, break_duration) VALUES (?, ?, ?, ?)", 
                  (username, "Intermediate (Standard)", 4, "Short (5 mins)"))
        c.execute("INSERT INTO analytics (username, streak_days, focus_hours, mastery_level, subject_hours) VALUES (?, ?, ?, ?, ?)", 
                  (username, 0, 0, 0.0, '{}'))
        conn.commit()
    
    conn.close()
    return jsonify({"success": True, "message": "Google Login successful.", "username": username})

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    username = request.args.get('username') or (request.json.get('username') if request.is_json else None)
    if not username:
        return jsonify({"error": "Username required"}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute("SELECT difficulty, daily_hours, break_duration FROM settings WHERE username = ?", (username,))
        row = c.fetchone()
        conn.close()
        if row:
            return jsonify({"difficulty": row[0], "daily_hours": row[1], "break_duration": row[2]})
        return jsonify({"error": "Settings not found"}), 404
        
    elif request.method == 'POST':
        data = request.json
        c.execute("""
            UPDATE settings 
            SET difficulty = ?, daily_hours = ?, break_duration = ?
            WHERE username = ?
        """, (data.get('difficulty'), data.get('daily_hours'), data.get('break_duration'), username))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Settings saved to database!"})

@app.route('/api/analytics', methods=['GET', 'POST'])
def handle_analytics():
    username = request.args.get('username') or (request.json.get('username') if request.is_json else None)
    if not username:
        return jsonify({"error": "Username required"}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute("SELECT streak_days, focus_hours, mastery_level, subject_hours FROM analytics WHERE username = ?", (username,))
        row = c.fetchone()
        conn.close()
        if row:
            return jsonify({
                "streak_days": row[0], "focus_hours": row[1], 
                "mastery_level": row[2], "subject_hours": row[3]
            })
        return jsonify({"error": "Analytics not found"}), 404
        
    elif request.method == 'POST':
        # Simulates updating focus time and subjects
        data = request.json
        c.execute("SELECT focus_hours, subject_hours FROM analytics WHERE username = ?", (username,))
        row = c.fetchone()
        current_hours = row[0]
        subj_hours = row[1]
        
        # update focus hours
        new_hours = current_hours + data.get('add_hours', 1)
        
        import json
        subject_dict = json.loads(subj_hours) if subj_hours else {}
        subj_name = data.get('subject', 'General')
        subject_dict[subj_name] = subject_dict.get(subj_name, 0) + data.get('add_hours', 1)
        
        c.execute("UPDATE analytics SET focus_hours = ?, subject_hours = ? WHERE username = ?", 
                  (new_hours, json.dumps(subject_dict), username))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "new_focus_hours": new_hours})

@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    username = request.args.get('username') or (request.json.get('username') if request.is_json else None)
    if not username:
        return jsonify({"error": "Username required"}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute("SELECT id, title, subject, priority, deadline, status FROM tasks WHERE username = ? ORDER BY deadline ASC", (username,))
        rows = c.fetchall()
        conn.close()
        tasks = [{"id": r[0], "title": r[1], "subject": r[2], "priority": r[3], "deadline": r[4], "status": r[5]} for r in rows]
        return jsonify({"tasks": tasks})
        
    elif request.method == 'POST':
        data = request.json
        c.execute("INSERT INTO tasks (username, title, subject, priority, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
                  (username, data['title'], data['subject'], data['priority'], data['deadline'], data.get('status', 'pending')))
        conn.commit()
        task_id = c.lastrowid
        conn.close()
        return jsonify({"success": True, "id": task_id})

@app.route('/api/tasks/complete', methods=['POST'])
def complete_task():
    data = request.json
    task_id = data.get('id')
    username = data.get('username')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE tasks SET status = 'completed' WHERE id = ? AND username = ?", (task_id, username))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/generate_planner', methods=['POST'])
def generate_planner():
    data = request.json
    syllabus = data.get('syllabus', '')
    plan = process_syllabus_and_plan(syllabus)
    return jsonify(plan)

@app.route('/api/chat', methods=['POST'])
def chat():
    message = request.json.get('message', '')
    if model:
        try:
            reply = model.generate_content(f"You are CogniStudy, an AI study planner. A student says: {message}. Help them.").text
        except Exception as e:
            reply = "I'm having trouble with my LLM backend."
    else:
        reply = "I'm your AI Planner! I see your message. Make sure to input your syllabus to generate your smart plan."
    return jsonify({"reply": reply, "trace": "[Chatbot] Processed."})

@app.route('/api/study_decision', methods=['GET'])
def study_decision():
    fatigue = float(request.args.get('fatigue', 5.0))
    result = expectimax_study_decision(fatigue)
    return jsonify(result)

@app.route('/api/quiz_update', methods=['POST'])
def quiz_update():
    data = request.json
    prior = float(data.get('prior_mastery', 0.5))
    score = float(data.get('score', 80.0))
    result = bayesian_update(prior, score)
    return jsonify(result)

if __name__ == '__main__':
    print("🚀 CogniStudy Python AI Engine starting on http://localhost:5001")
    app.run(port=5001, debug=True)
