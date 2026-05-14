import requests
import json

BASE_URL = "http://localhost:8080/v1"
API_KEY = "prismrag-secret-key"  # Default development key


def test_models():
    print(f"Testing GET {BASE_URL}/models...")
    try:
        response = requests.get(
            f"{BASE_URL}/models", headers={"Authorization": f"Bearer {API_KEY}"}
        )
        response.raise_for_status()
        data = response.json()
        print(json.dumps(data, indent=2))

        models = [m["id"] for m in data.get("data", [])]
        if "prismrag-general" in models:
            print("\nSUCCESS: 'prismrag-general' found in models list.")
        else:
            print("\nFAILURE: 'prismrag-general' NOT found in models list.")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_models()
