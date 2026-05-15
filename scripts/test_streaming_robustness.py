import asyncio
import httpx
import sys

BASE_URL = "http://localhost:8000"


async def test_streaming_cancellation():
    print("\n--- Testing Streaming Cancellation ---")
    # This requires the server to be running locally
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            # We start a stream and then close it after 2 seconds
            print("Starting stream...")
            payload = {
                "message": "Write a very long poem about quantum gravity.",
                "history": [],
                "enable_thinking": True,
            }

            # Use the RAG endpoint (workspace 1 is usually the default)
            url = f"{BASE_URL}/api/v1/rag/workspace/1/chat/stream"

            try:
                async with client.stream("POST", url, json=payload) as response:
                    print(f"Status: {response.status_code}")
                    count = 0
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            print(f"Received data chunk {count}")
                            count += 1
                        if count > 5:
                            print("Abruptly closing connection...")
                            break
            except Exception as e:
                print(f"Caught expected connection close error: {e}")

            print(
                "Connection closed. Check server logs for 'Task cancelled' or cleanup messages."
            )
    except Exception as e:
        print(f"Test failed: {e}")


async def test_streaming_error_forwarding():
    print("\n--- Testing Streaming Error Forwarding ---")
    # We can simulate an error by passing invalid workspace or similar,
    # but let's try to trigger a real internal error if possible,
    # or just verify the 'error' event handling.
    try:
        async with httpx.AsyncClient() as client:
            # Invalid workspace ID should trigger an error event
            url = f"{BASE_URL}/api/v1/rag/workspace/999999/chat/stream"
            payload = {"message": "hi", "history": []}

            async with client.stream("POST", url, json=payload) as response:
                async for line in response.aiter_lines():
                    if line.startswith("event: error"):
                        print("Success: Received 'error' event from server.")
                        return
            print("Failure: Did not receive 'error' event.")
    except Exception as e:
        print(f"Test failed: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1]

    asyncio.run(test_streaming_cancellation())
    asyncio.run(test_streaming_error_forwarding())
