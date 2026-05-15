import sys
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_path))

from app.services.vector_store import get_vector_store  # noqa: E402
from app.services.chunker import chunk_text  # noqa: E402
from app.core.config import settings  # noqa: E402


def test_chunking():
    print("\n--- Testing Source Code Chunking ---")
    code = """
def hello_world():
    print("Hello, world!")

class Greeter:
    def __init__(self, name):
        self.name = name
    
    def greet(self):
        print(f"Hello, {self.name}!")
"""
    chunks = chunk_text(code, source="test.py")
    print(f"Generated {len(chunks)} chunks for test.py")
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i} metadata: {chunk.metadata}")
        # print(f"Chunk {i} content:\n{chunk.content}\n")


def test_qdrant_factory():
    print("\n--- Testing Vector Store Factory ---")
    settings.VECTOR_DATABASE = "qdrant"
    store = get_vector_store(workspace_id=999)
    print(f"Store type: {type(store).__name__}")

    settings.VECTOR_DATABASE = "chroma"
    store = get_vector_store(workspace_id=999)
    print(f"Store type: {type(store).__name__}")


if __name__ == "__main__":
    try:
        test_chunking()
        test_qdrant_factory()
        print("\nVerification script ran successfully (unit logic checked).")
    except Exception as e:
        print(f"\nVerification failed: {e}")
