#!/usr/bin/env python3
"""
Verification script for RAG Phase 1 implementation
"""

import os
import sys
from pathlib import Path

def verify_installation():
    print("🔍 Verifying RAG Phase 1 Implementation")
    print("="*50)
    
    # 1. Check virtual environment
    venv_path = Path("/root/.openclaw/workspace/rag-env")
    if venv_path.exists():
        print("✅ Virtual environment exists")
    else:
        print("❌ Virtual environment missing")
        return False
    
    # 2. Check required packages
    try:
        import chromadb
        import sentence_transformers
        from sentence_transformers import SentenceTransformer
        print("✅ Required packages installed")
    except ImportError as e:
        print(f"❌ Package import error: {e}")
        return False
    
    # 3. Check embedding model
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Embedding model accessible")
    except Exception as e:
        print(f"❌ Embedding model error: {e}")
        return False
    
    # 4. Check database directory
    db_path = Path("/root/.openclaw/workspace/rag-db")
    db_path.mkdir(exist_ok=True)  # Create if doesn't exist
    print("✅ Database directory ready")
    
    # 5. Test basic ChromaDB functionality
    try:
        import chromadb
        from chromadb.config import Settings
        client = chromadb.PersistentClient(path="/root/.openclaw/workspace/rag-db/")
        
        # Create test collections
        for name in ["documents", "chat_sessions", "agent_logs"]:
            collection = client.get_or_create_collection(name=name)
        
        collections = [c.name for c in client.list_collections()]
        print(f"✅ Collections created: {collections}")
    except Exception as e:
        print(f"❌ ChromaDB error: {e}")
        return False
    
    # 6. Check API files
    api_file = Path("/root/.openclaw/workspace/rag_api.py")
    if api_file.exists():
        print("✅ API implementation file exists")
    else:
        print("❌ API implementation file missing")
        return False
    
    # 7. Check startup script
    script_file = Path("/root/.openclaw/workspace/start_rag_api.sh")
    if script_file.exists():
        print("✅ Startup script exists")
    else:
        print("❌ Startup script missing")
        return False
    
    # 8. Check test files
    test_file = Path("/root/.openclaw/workspace/test_rag_api.py")
    if test_file.exists():
        print("✅ Test script exists")
    else:
        print("❌ Test script missing")
        return False
    
    # 9. Check documentation
    docs_file = Path("/root/.openclaw/workspace/RAG_PHASE_1_DOCS.md")
    if docs_file.exists():
        print("✅ Documentation exists")
    else:
        print("❌ Documentation missing")
        return False
    
    print("\n" + "="*50)
    print("🎉 RAG Phase 1 Implementation Verification: SUCCESS")
    print("✅ All components installed and verified")
    print("✅ Ready for Phase 2 integration")
    
    return True

if __name__ == "__main__":
    success = verify_installation()
    if not success:
        sys.exit(1)