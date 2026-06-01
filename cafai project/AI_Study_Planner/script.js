const BASE_URL = 'http://127.0.0.1:5001/api';
let terminal;
let currentUser = null; // Store logged-in user

document.addEventListener("DOMContentLoaded", () => {
    terminal = document.getElementById('terminal-output');
    
    // Live Clock
    setInterval(() => {
        const clockEl = document.getElementById('live-clock');
        if(clockEl) clockEl.innerText = new Date().toLocaleTimeString();
    }, 1000);
});

// === View Switching ===
function toggleTheme() {
    document.body.classList.toggle('morning-mode');
    const icon = document.querySelector('#theme-toggle i');
    if (document.body.classList.contains('morning-mode')) {
        icon.className = 'fa-solid fa-moon'; // Show moon to switch back to Night
        icon.parentElement.style.color = '#0f172a';
        document.getElementById('welcome-user').style.color = '#0f172a';
    } else {
        icon.className = 'fa-solid fa-sun'; // Show sun to switch to Morning
        icon.parentElement.style.color = '#f8fafc';
        document.getElementById('welcome-user').style.color = '#cbd5e1';
    }
}

function switchView(viewId, event) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.getElementById('view-' + viewId).style.display = 'block';
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
    
    // Update Page Title
    const titles = {
        'dashboard': 'Dashboard',
        'calendar': 'Study Calendar',
        'timer': 'Focus Timer',
        'progress': 'Progress Tracker',
        'settings': 'Application Settings'
    };
    document.getElementById('page-title').innerText = titles[viewId];

    // Update Background Image dynamically
    document.querySelector('.main-content').className = 'main-content bg-' + viewId;

    // Load dynamic data from DB based on view
    if (viewId === 'settings') loadSettings();
    if (viewId === 'progress') loadAnalytics();
}

// === Auth System ===
function toggleAuth(mode) {
    if (mode === 'signup') {
        document.getElementById('login-box').style.display = 'none';
        document.getElementById('signup-box').style.display = 'flex';
        document.getElementById('login-error').innerText = '';
    } else {
        document.getElementById('signup-box').style.display = 'none';
        document.getElementById('login-box').style.display = 'flex';
        document.getElementById('signup-error').innerText = '';
    }
}

async function signup() {
    const user = document.getElementById('signup-username').value;
    const pass = document.getElementById('signup-password').value;
    const errorEl = document.getElementById('signup-error');
    
    if(!user || !pass) { errorEl.innerText = "Please fill all fields."; return; }
    
    errorEl.innerText = "Creating account in Database...";
    errorEl.style.color = "#fff";
    try {
        const res = await fetch(`${BASE_URL}/signup`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        
        if (data.success) {
            errorEl.style.color = "#10b981";
            errorEl.innerText = "Account Created! Logging you in automatically...";
            
            setTimeout(() => {
                document.getElementById('login-username').value = user;
                document.getElementById('login-password').value = pass;
                login();
            }, 1000);
        } else {
            errorEl.style.color = "#f87171";
            errorEl.innerText = data.message;
        }
    } catch(e) {
        errorEl.style.color = "#f87171";
        errorEl.innerText = "Could not connect to Python backend.";
    }
}

async function login() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    errorEl.style.color = "#fff";
    errorEl.innerText = "Authenticating with Database...";
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.username;
            document.getElementById('welcome-user').innerText = `Welcome, ${currentUser}`;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'flex';
            document.getElementById('chatbot-ui').style.display = 'flex';
            logToTerminal("Login successful. Data retrieved from SQLite.", "success-msg");
            if(Notification.permission === 'default') Notification.requestPermission();
            loadTasks();
        } else {
            errorEl.style.color = "#f87171";
            errorEl.innerText = data.message;
        }
    } catch(e) {
        errorEl.style.color = "#f87171";
        errorEl.innerText = "Backend disconnected. Please restart Python server.";
    }
}

function logout() {
    currentUser = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('chatbot-ui').style.display = 'none';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

// === Google OAuth Mock ===
function showGoogleModal() {
    document.getElementById('google-modal').style.display = 'flex';
}

async function googleLogin(email) {
    document.getElementById('google-modal').style.display = 'none';
    const errorEl = document.getElementById('login-error');
    errorEl.style.color = "#fff";
    errorEl.innerText = "Authenticating with Google...";
    
    try {
        const res = await fetch(`${BASE_URL}/google_login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: email})
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.username;
            document.getElementById('welcome-user').innerText = `Welcome, ${currentUser}`;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'flex';
            document.getElementById('chatbot-ui').style.display = 'flex';
            logToTerminal("Google OAuth authenticated successfully via SQLite.", "success-msg");
            if(Notification.permission === 'default') Notification.requestPermission();
            loadTasks();
        } else {
            errorEl.style.color = "#f87171";
            errorEl.innerText = data.message;
        }
    } catch(e) {
        errorEl.style.color = "#f87171";
        errorEl.innerText = "Could not connect to Python backend.";
    }
}

// === Database Data Loading (Settings & Analytics) ===
async function loadSettings() {
    if(!currentUser) return;
    try {
        const res = await fetch(`${BASE_URL}/settings?username=${currentUser}`);
        const data = await res.json();
        if(!data.error) {
            document.getElementById('setting-difficulty').value = data.difficulty;
            document.getElementById('setting-hours').value = data.daily_hours;
            document.getElementById('setting-break').value = data.break_duration;
        }
    } catch(e) { console.error("Error loading settings"); }
}

async function saveSettings() {
    if(!currentUser) return;
    const msg = document.getElementById('settings-msg');
    msg.innerText = "Saving to Database...";
    msg.style.color = "white";
    
    const payload = {
        username: currentUser,
        difficulty: document.getElementById('setting-difficulty').value,
        daily_hours: document.getElementById('setting-hours').value,
        break_duration: document.getElementById('setting-break').value
    };
    
    try {
        const res = await fetch(`${BASE_URL}/settings`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            msg.innerText = "Settings Saved Successfully!";
            msg.style.color = "#10b981";
            setTimeout(()=> { msg.innerText = ""; }, 2000);
        }
    } catch(e) {
        msg.innerText = "Failed to save settings.";
        msg.style.color = "#f87171";
    }
}

async function loadAnalytics() {
    if(!currentUser) return;
    try {
        const res = await fetch(`${BASE_URL}/analytics?username=${currentUser}`);
        const data = await res.json();
        if(!data.error) {
            document.getElementById('stat-streak').innerText = `${data.streak_days} Days`;
            document.getElementById('stat-focus').innerText = `${data.focus_hours} Hours`;
            document.getElementById('stat-mastery').innerText = `${data.mastery_level}%`;
            
            // Render subject bars
            const container = document.getElementById('subject-bars-container');
            if(container && data.subject_hours) {
                container.innerHTML = "";
                const subjects = JSON.parse(data.subject_hours);
                if(Object.keys(subjects).length === 0) {
                    container.innerHTML = `<p style="color: var(--text-muted);">Complete tasks to track subject hours.</p>`;
                } else {
                    for(const [subj, hours] of Object.entries(subjects)) {
                        const pct = Math.min(100, hours * 10);
                        container.innerHTML += `
                            <div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span style="font-weight: 600;">${subj}</span>
                                    <span>${hours} hrs</span>
                                </div>
                                <div style="width: 100%; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                                    <div style="width: ${pct}%; background: var(--accent); height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }
    } catch(e) { console.error("Error loading analytics"); }
}

// === Automatic Syllabus Generation ===
async function generatePlanner() {
    const syllabus = document.getElementById('syllabus-input').value;
    const list = document.getElementById('schedule-list');
    
    if(!syllabus.trim()) {
        alert("Please enter a syllabus first!");
        return;
    }
    
    logToTerminal('Transmitting syllabus to AI Agent...', 'system-msg');
    list.innerHTML = "<li><i class='fa-solid fa-spinner fa-spin'></i> AI Engine is processing...</li>";
    
    try {
        const res = await fetch(`${BASE_URL}/generate_planner`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({syllabus: syllabus})
        });
        const data = await res.json();
        
        logToTerminal(data.trace, 'info-msg');
        logToTerminal(`✅ Generated optimal A* path: ${data.topics.join(' -> ')}`, 'success-msg');
        
        list.innerHTML = "";
        for (const [slot, topic] of Object.entries(data.schedule)) {
            list.innerHTML += `<li><span class="time">${slot}</span> <span class="topic">${topic}</span></li>`;
        }
        
        // POST tasks to backend
        if(data.tasks && data.tasks.length > 0) {
            for(const t of data.tasks) {
                await fetch(`${BASE_URL}/tasks`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: currentUser, ...t})
                });
            }
            if(Notification.permission === 'granted') {
                new Notification("AI Study Planner", { body: `Generated ${data.tasks.length} prioritized tasks!`});
            }
            loadTasks();
        }
    } catch(e) {
        logToTerminal('Error connecting to backend API.', 'error-msg');
        list.innerHTML = "<li>Error connecting to backend.</li>";
    }
}

// === Task Management ===
async function loadTasks() {
    if(!currentUser) return;
    try {
        const res = await fetch(`${BASE_URL}/tasks?username=${currentUser}`);
        const data = await res.json();
        
        const listContainer = document.getElementById('task-list-container');
        const gridContainer = document.getElementById('calendar-grid');
        if(!listContainer || !gridContainer) return;
        
        if(!data.tasks || data.tasks.length === 0) {
            listContainer.innerHTML = `<li style="color: var(--text-muted);">No tasks scheduled yet. Generate a plan!</li>`;
            gridContainer.innerHTML = `<div style="color: var(--text-muted);">No tasks to display.</div>`;
            return;
        }
        
        listContainer.innerHTML = "";
        gridContainer.innerHTML = "";
        
        data.tasks.forEach(t => {
            const badgeColor = t.priority === "High" ? "#ef4444" : (t.priority === "Medium" ? "#f59e0b" : "#3b82f6");
            const isCompleted = t.status === "completed";
            const textStyle = isCompleted ? "text-decoration: line-through; opacity: 0.6;" : "";
            const btnHTML = isCompleted ? `<span style="color: #10b981;"><i class="fa-solid fa-check"></i> Done</span>` : `<button onclick="completeTask(${t.id}, '${t.subject}')" style="padding: 5px 10px; font-size: 0.8rem; background: #10b981;"><i class="fa-solid fa-check"></i></button>`;
            
            // Render Dashboard List Item
            listContainer.innerHTML += `
                <li style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">
                    <div>
                        <div style="font-weight: 600; ${textStyle}">${t.title}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                            <span style="background: ${badgeColor}33; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; margin-right: 8px;">${t.priority}</span>
                            <i class="fa-regular fa-clock"></i> ${t.deadline}
                        </div>
                    </div>
                    <div>${btnHTML}</div>
                </li>
            `;
            
            // Render Calendar Grid Item
            gridContainer.innerHTML += `
                <div class="glass" style="padding: 1rem; border-left: 4px solid ${badgeColor}; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="font-weight: bold; ${textStyle}">${t.title}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin: 10px 0;"><i class="fa-regular fa-calendar"></i> ${t.deadline}</div>
                    <div style="text-align: right;">${btnHTML}</div>
                </div>
            `;
        });
    } catch(e) { console.error("Error loading tasks"); }
}

async function completeTask(taskId, subject) {
    if(!currentUser) return;
    try {
        await fetch(`${BASE_URL}/tasks/complete`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id: taskId, username: currentUser})
        });
        
        // Log 1 hour of subject time
        await fetch(`${BASE_URL}/analytics`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: currentUser, add_hours: 1, subject: subject})
        });
        
        loadTasks();
    } catch(e) { console.error(e); }
}

function logToTerminal(message, type = 'info-msg') {
    if(!terminal) return;
    const p = document.createElement('p');
    p.className = type;
    p.innerHTML = `[${new Date().toLocaleTimeString([], { hour12: false })}] ${message}`;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}

// === Chatbot ===
function toggleChat() {
    const chat = document.querySelector('.chatbot-container');
    const icon = document.getElementById('chat-toggle-icon');
    chat.classList.toggle('minimized');
    icon.className = chat.classList.contains('minimized') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
}

function handleChatEnter(e) {
    if(e.key === 'Enter') sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    addChatMessage(message, 'user-msg');
    input.value = '';
    const typingId = addChatMessage('Agent is thinking...', 'ai-msg');
    
    try {
        const res = await fetch(`${BASE_URL}/chat`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: message})
        });
        const data = await res.json();
        document.getElementById(typingId).innerText = data.reply;
    } catch(e) {
        document.getElementById(typingId).innerText = "Backend disconnected.";
    }
}

function addChatMessage(text, type) {
    const chatBody = document.getElementById('chat-body');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerText = text;
    const id = 'msg-' + Date.now();
    div.id = id;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return id;
}

// === Focus Timer ===
let timerInterval;
let timeLeft = 25 * 60; // 25 mins

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            
            // Add focus hours to database
            if(currentUser) {
                fetch(`${BASE_URL}/analytics`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: currentUser, add_hours: 1})
                });
            }
            
            alert("Focus session complete! Time for a short break.");
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = 25 * 60;
    updateTimerDisplay();
}
