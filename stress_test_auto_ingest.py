#!/usr/bin/env python3
"""
Stresstest für den Auto-Ingest Service
Erstellt viele simulierte Agent-Sessions gleichzeitig, um den Ingest-Service zu testen
"""

import json
import os
import time
import random
import threading
from datetime import datetime
from pathlib import Path


def generate_random_messages(count=10):
    """Generiert zufällige Nachrichten für eine Session"""
    templates = [
        "Hello there! How can I help you today?",
        "I've been working on the new feature implementation.",
        "Let me check the documentation for that.",
        "The system is running smoothly now.",
        "I found an interesting solution to the problem.",
        "Can you explain this concept in more detail?",
        "I think we need to optimize the performance here.",
        "The error occurred during the initialization phase.",
        "We should consider implementing better error handling.",
        "This approach seems to work well for our use case.",
        "I've completed the testing for this module.",
        "The deployment went smoothly without issues.",
        "I'm experiencing some difficulties with the integration.",
        "Could you review my code changes?",
        "The requirements have changed slightly.",
        "I've added comprehensive unit tests.",
        "Performance metrics look promising.",
        "Let's schedule a meeting to discuss this further.",
        "I've identified the root cause of the issue.",
        "The fix has been deployed to production."
    ]
    
    messages = []
    for i in range(count):
        message = {
            "type": "message",
            "timestamp": datetime.now().isoformat(),
            "message": {
                "role": random.choice(["user", "assistant"]),
                "content": [
                    {
                        "type": "text",
                        "text": random.choice(templates) + f" [{i}]"
                    }
                ]
            }
        }
        messages.append(message)
    return messages


def create_session_file(session_id, num_messages=10):
    """Erstellt eine simulierte Session-Datei"""
    session_dir = Path("/root/.openclaw/agents/main/sessions")
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # Session-Start-Eintrag
    session_start = {
        "type": "session",
        "id": session_id,
        "timestamp": datetime.now().isoformat(),
        "channel": "stress-test"
    }
    
    # Nachrichten generieren
    messages = generate_random_messages(num_messages)
    
    # Session-Datei schreiben
    session_file = session_dir / f"{session_id}.jsonl"
    
    with open(session_file, 'w', encoding='utf-8') as f:
        # Session-Info zuerst
        f.write(json.dumps(session_start) + "\n")
        
        # Dann Nachrichten
        for msg in messages:
            f.write(json.dumps(msg) + "\n")
    
    print(f"Created session file: {session_file} with {num_messages} messages")
    return session_file


def simulate_multiple_sessions(num_sessions=10, messages_per_session=10, delay_between_creations=0.1):
    """Erstellt mehrere Session-Dateien mit Verzögerung"""
    print(f"Creating {num_sessions} simulated sessions with {messages_per_session} messages each...")
    
    created_sessions = []
    
    for i in range(num_sessions):
        session_id = f"stress_test_session_{int(time.time())}_{i:03d}"
        session_file = create_session_file(session_id, messages_per_session)
        created_sessions.append(session_file)
        
        if delay_between_creations > 0:
            time.sleep(delay_between_creations)
    
    print(f"Created {len(created_sessions)} session files")
    return created_sessions


def simulate_concurrent_sessions(num_threads=5, sessions_per_thread=5):
    """Erstellt Sessions in parallelen Threads"""
    print(f"Creating sessions using {num_threads} threads with {sessions_per_thread} sessions each...")
    
    def thread_worker(thread_id):
        """Worker-Funktion für jeden Thread"""
        print(f"Thread {thread_id} starting...")
        session_files = simulate_multiple_sessions(
            num_sessions=sessions_per_thread,
            messages_per_session=random.randint(5, 15),
            delay_between_creations=0.05
        )
        print(f"Thread {thread_id} completed, created {len(session_files)} sessions")
        return session_files
    
    # Threads starten
    threads = []
    all_created_sessions = []
    
    for i in range(num_threads):
        thread = threading.Thread(target=lambda tid=i: all_created_sessions.extend(thread_worker(tid)))
        threads.append(thread)
        thread.start()
    
    # Warten auf alle Threads
    for thread in threads:
        thread.join()
    
    print(f"All threads completed. Total sessions created: {len(all_created_sessions)}")
    return all_created_sessions


def main():
    print("🧪 Starting Auto-Ingest Stress Test")
    print("="*50)
    
    # Zeitmessung
    start_time = time.time()
    
    # Option 1: Sequenzielle Erstellung
    print("\n1. Creating sequential sessions...")
    sequential_sessions = simulate_multiple_sessions(num_sessions=5, messages_per_session=8, delay_between_creations=0.2)
    
    # Kurze Pause
    time.sleep(2)
    
    # Option 2: Parallele Erstellung
    print("\n2. Creating concurrent sessions...")
    concurrent_sessions = simulate_concurrent_sessions(num_threads=3, sessions_per_thread=4)
    
    # Gesamtstatistik
    total_sessions = len(sequential_sessions) + len(concurrent_sessions)
    elapsed_time = time.time() - start_time
    
    print("\n" + "="*50)
    print("STRESS TEST COMPLETED")
    print("="*50)
    print(f"Sequential sessions: {len(sequential_sessions)}")
    print(f"Concurrent sessions: {len(concurrent_sessions)}")
    print(f"Total sessions: {total_sessions}")
    print(f"Total time: {elapsed_time:.2f}s")
    print(f"Average creation rate: {total_sessions/elapsed_time:.2f} sessions/sec")
    
    print("\nSession files created. The Auto-Ingest Service should now detect and process these files.")
    print("Monitor the service logs for ingestion activity.")


if __name__ == "__main__":
    main()