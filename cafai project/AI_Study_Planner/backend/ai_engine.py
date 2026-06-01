import heapq
import random
from dataclasses import dataclass
from typing import List, Dict

# === CO1: Agent model, State Formulation, Dataclasses ===
@dataclass
class Topic:
    name: str
    complexity: int
    prerequisites: List[str]

# Static Graph
KNOWLEDGE_GRAPH = {
    'Python Basics': Topic('Python Basics', 2, []),
    'Data Structures': Topic('Data Structures', 4, ['Python Basics']),
    'Search Algorithms': Topic('Search Algorithms', 6, ['Data Structures']),
    'Probability': Topic('Probability', 5, ['Python Basics']),
    'Bayesian Networks': Topic('Bayesian Networks', 8, ['Probability']),
}

def heuristic(current: str, goal: str, graph: Dict) -> int:
    if current not in graph or goal not in graph: return 10
    return abs(graph[current].complexity - graph[goal].complexity)

# === CO2: A* Search Algorithm (Dynamic) ===
def calculate_a_star_path(start: str, goal: str, graph: Dict = KNOWLEDGE_GRAPH):
    if start not in graph: return {"path": [start, goal], "trace": "Fallback triggered."}
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {topic: float('inf') for topic in graph}
    g_score[start] = 0
    expansions = 0
    
    while open_set:
        expansions += 1
        _, current = heapq.heappop(open_set)

        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            path.reverse()
            return {"path": path, "trace": f"[A* Search] Path found. Expanded {expansions} nodes."}

        neighbors = [t.name for t in graph.values() if current in t.prerequisites]
        for neighbor in neighbors:
            tentative_g = g_score[current] + graph[neighbor].complexity
            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + heuristic(neighbor, goal, graph)
                heapq.heappush(open_set, (f_score, neighbor))
                
    return {"path": list(graph.keys()), "trace": "A* traversed. Returning full topic list."}

# === CO3: Constraint Satisfaction Problem (CSP) ===
def csp_schedule(topics: List[str], time_slots: List[str]):
    assignment = {}
    def backtrack(slot_idx):
        if slot_idx >= len(time_slots) or len(assignment) == len(topics): return True
        slot = time_slots[slot_idx]
        for topic in topics:
            if topic not in assignment.values(): 
                assignment[slot] = topic
                if backtrack(slot_idx + 1): return True
                del assignment[slot]
        return False
        
    success = backtrack(0)
    trace = "[CSP Solver] Backtracking applied. Constraints satisfied." if success else "CSP fallback applied."
    return {"schedule": assignment, "trace": trace}

# === CO4 & CO5 ===
def expectimax_study_decision(fatigue_level: float):
    prob_interrupt = 0.3
    study_utility = (10 - fatigue_level * 2) * (1 - prob_interrupt) + (2 - fatigue_level) * prob_interrupt
    break_utility = 5
    decision = "Study" if study_utility > break_utility else "Take a Break"
    return {"decision": decision, "trace": f"[Expectimax] Study Utils: {study_utility:.1f}. Decision: {decision}"}

def bayesian_update(prior_mastery: float, quiz_score: float):
    likelihood_mastery = 0.9 if quiz_score > 70 else 0.4
    likelihood_no_mastery = 0.2 if quiz_score > 70 else 0.8
    marginal = (likelihood_mastery * prior_mastery) + (likelihood_no_mastery * (1 - prior_mastery))
    posterior = (likelihood_mastery * prior_mastery) / marginal
    return {"mastery_probability": round(posterior, 2), "trace": f"[Bayesian Inference] Posterior updated."}

# === USER SYLLABUS INTEGRATION ===
from datetime import datetime, timedelta

def process_syllabus_and_plan(syllabus_text: str):
    raw_topics = [t.strip() for t in syllabus_text.replace('\n', ',').split(',') if t.strip()]
    if not raw_topics:
        raw_topics = ["Math", "Physics", "Chemistry"]
    
    dynamic_graph = {}
    for i, t in enumerate(raw_topics):
        prereq = [raw_topics[i-1]] if i > 0 else []
        dynamic_graph[t] = Topic(t, random.randint(2, 8), prereq)
        
    start = raw_topics[0]
    goal = raw_topics[-1]
    path_result = calculate_a_star_path(start, goal, dynamic_graph)
    optimal_path = path_result['path']
    if not optimal_path:
        optimal_path = raw_topics
    
    slots = ["Monday 9AM", "Monday 4PM", "Tuesday 9AM", "Tuesday 4PM", "Wednesday 9AM", "Wednesday 4PM"]
    schedule_result = csp_schedule(optimal_path, slots[:len(optimal_path)])
    
    tasks = []
    base_date = datetime.now()
    priorities = ["High", "Medium", "Low"]
    
    for i, (slot, topic) in enumerate(schedule_result['schedule'].items()):
        deadline = (base_date + timedelta(days=i+1)).strftime("%Y-%m-%d")
        priority = "High" if dynamic_graph[topic].complexity > 5 else "Medium"
        tasks.append({
            "title": f"Master {topic} ({slot})",
            "subject": topic.split()[0] if " " in topic else topic,
            "priority": priority,
            "deadline": deadline,
            "status": "pending"
        })
    
    return {
        "topics": optimal_path,
        "schedule": schedule_result['schedule'],
        "tasks": tasks,
        "trace": f"{path_result['trace']} | {schedule_result['trace']}"
    }
