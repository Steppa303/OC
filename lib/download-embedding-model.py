#!/usr/bin/env python3
"""
Download Embedding Model (all-MiniLM-L6-v2)

Lädt das Modell lokal herunter für schnelle, zuverlässige Embeddings
ohne HuggingFace-Timeouts.
"""

import sys
import os
from pathlib import Path

def download_model(model_name: str, model_path: str) -> bool:
    """
    Lädt ein Sentence-Transformer Modell herunter
    
    Args:
        model_name: Name des Modells (z.B. 'all-MiniLM-L6-v2')
        model_path: Lokaler Pfad zum Speichern
        
    Returns:
        bool: True bei Erfolg, False bei Fehler
    """
    try:
        print(f"📥 Downloading model: {model_name}")
        print(f"📁 Saving to: {model_path}")
        
        # sentence-transformers importieren
        from sentence_transformers import SentenceTransformer
        
        # Modell laden und lokal speichern
        print("⏳ Loading model (this may take a few minutes)...")
        model = SentenceTransformer(model_name)
        
        # Modell im lokalen Pfad speichern
        os.makedirs(model_path, exist_ok=True)
        model.save(model_path)
        
        print(f"✅ Model successfully downloaded to: {model_path}")
        
        # Verifizieren dass Dateien existieren
        required_files = ['config.json', 'pytorch_model.bin', 'tokenizer.json', 'vocab.txt']
        for file in required_files:
            file_path = os.path.join(model_path, file)
            if os.path.exists(file_path):
                print(f"  ✅ {file}")
            else:
                print(f"  ⚠️ {file} not found")
        
        return True
        
    except ImportError as e:
        print(f"❌ sentence-transformers not installed: {e}")
        print("💡 Install with: pip install sentence-transformers")
        return False
        
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        return False


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: python download-embedding-model.py <model_name> <model_path>")
        print("Example: python download-embedding-model.py all-MiniLM-L6-v2 /path/to/model")
        sys.exit(1)
    
    model_name = sys.argv[1]
    model_path = sys.argv[2]
    
    success = download_model(model_name, model_path)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
