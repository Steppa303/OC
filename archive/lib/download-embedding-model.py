#!/usr/bin/env python3
"""
Download Embedding Model (all-MiniLM-L6-v2)

Lädt das Modell lokal herunter für schnelle, zuverlässige Embeddings
ohne HuggingFace-Timeouts.

Usage:
    python download-embedding-model.py [model_path]
    
Example:
    python download-embedding-model.py /root/.openclaw/chroma_db/models/all-MiniLM-L6-v2
"""

import sys
import os
from pathlib import Path

# KORREKTER MODELLNAME (ohne Quotes!)
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def download_model(model_path: str) -> bool:
    """
    Lädt ein Sentence-Transformer Modell herunter
    
    Args:
        model_path: Lokaler Pfad zum Speichern
        
    Returns:
        bool: True bei Erfolg, False bei Fehler
    """
    try:
        print(f"📥 Downloading model: {MODEL_NAME}")
        print(f"📁 Saving to: {model_path}")
        
        # sentence-transformers importieren
        from sentence_transformers import SentenceTransformer
        
        # Modell laden und lokal speichern
        print("⏳ Loading model (this may take a few minutes)...")
        
        # WICHTIG: Modellname OHNE extra Quotes!
        model = SentenceTransformer(MODEL_NAME)
        
        # Modell im lokalen Pfad speichern
        os.makedirs(model_path, exist_ok=True)
        model.save(model_path)
        
        print(f"✅ Model successfully downloaded to: {model_path}")
        
        # Verifizieren dass Dateien existieren
        required_files = ['config.json', 'pytorch_model.bin', 'tokenizer.json', 'vocab.txt', 'modules.json']
        all_present = True
        for file in required_files:
            file_path = os.path.join(model_path, file)
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                print(f"  ✅ {file} ({file_size:.2f} MB)")
            else:
                print(f"  ❌ {file} NOT FOUND")
                all_present = False
        
        if all_present:
            print(f"\n✅ Model download COMPLETE!")
            return True
        else:
            print(f"\n⚠️ Model download INCOMPLETE - some files missing")
            return False
        
    except ImportError as e:
        print(f"❌ sentence-transformers not installed: {e}")
        print("💡 Install with: pip install sentence-transformers")
        return False
        
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        import traceback
        traceback.print_exc()
        return False


def clean_failed_download(model_path: str):
    """
    Löscht einen fehlgeschlagenen Download für sauberen Neustart
    """
    try:
        if os.path.exists(model_path):
            import shutil
            print(f"🧹 Cleaning up failed download: {model_path}")
            shutil.rmtree(model_path)
            print(f"✅ Cleanup complete")
    except Exception as e:
        print(f"⚠️ Cleanup failed: {e}")


def main():
    """Main entry point"""
    # Default Pfad oder Command-Line Argument
    if len(sys.argv) >= 2:
        model_path = sys.argv[1]
    else:
        model_path = "/root/.openclaw/chroma_db/models/all-MiniLM-L6-v2"
    
    print("=" * 60)
    print("EMBEDDING MODEL DOWNLOADER")
    print("=" * 60)
    print(f"Model: {MODEL_NAME}")
    print(f"Path: {model_path}")
    print("=" * 60)
    
    # Prüfen ob bereits ein fehlerhafter Download existiert
    if os.path.exists(model_path):
        print("\n⚠️ Existing model directory found!")
        print("   This might be from a failed download.")
        response = input("   Delete and restart? (y/n): ").strip().lower()
        if response == 'y':
            clean_failed_download(model_path)
        else:
            print("   Keeping existing directory (may cause issues)")
    
    # Download starten
    success = download_model(model_path)
    
    if success:
        print("\n" + "=" * 60)
        print("✅ SUCCESS! Model ready for use.")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ FAILED! Check error messages above.")
        print("=" * 60)
        print("\nTroubleshooting:")
        print("  1. Check internet connection")
        print("  2. Run: pip install --upgrade sentence-transformers")
        print("  3. Delete partial download and retry")
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
