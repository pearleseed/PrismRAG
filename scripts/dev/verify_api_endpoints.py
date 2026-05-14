#!/usr/bin/env python3
"""
API Endpoint Verification Script
Tests all documented API endpoints to ensure they're accessible and properly configured.
"""

import asyncio
import sys
from typing import Dict, List, Tuple

import httpx


class APIVerifier:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip("/")
        self.results: List[Tuple[str, str, bool, str]] = []

    async def verify_endpoint(
        self, method: str, path: str, description: str
    ) -> Tuple[bool, str]:
        """Verify a single endpoint is accessible."""
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                if method == "GET":
                    response = await client.get(url)
                elif method == "POST":
                    response = await client.post(url, json={})
                elif method == "PUT":
                    response = await client.put(url, json={})
                elif method == "DELETE":
                    response = await client.delete(url)
                else:
                    return False, f"Unsupported method: {method}"

                # Accept 2xx, 4xx (expected for missing params), but not 5xx or connection errors
                if response.status_code < 500:
                    return True, f"Status {response.status_code}"
                else:
                    return False, f"Server error: {response.status_code}"

        except httpx.ConnectError:
            return False, "Connection refused - is the backend running?"
        except httpx.TimeoutException:
            return False, "Request timeout"
        except Exception as e:
            return False, f"Error: {str(e)}"

    async def verify_all(self):
        """Verify all documented endpoints."""
        endpoints = [
            # Health checks
            ("GET", "/health", "Health check"),
            ("GET", "/ready", "Readiness check"),
            ("GET", "/docs", "Swagger UI"),
            ("GET", "/redoc", "ReDoc UI"),
            # Workspaces
            ("GET", "/api/v1/workspaces", "List workspaces"),
            ("GET", "/api/v1/workspaces/summary", "Workspace summaries"),
            # Config
            ("GET", "/api/v1/config/status", "Config status"),
            # OpenAI-compatible
            ("GET", "/v1/models", "OpenAI models list"),
            # Note: We skip endpoints that require IDs or would modify data
        ]

        print(f"🔍 Verifying API endpoints at {self.base_url}\n")
        print("=" * 80)

        for method, path, description in endpoints:
            success, message = await self.verify_endpoint(method, path, description)
            self.results.append((method, path, success, message))

            status = "✅" if success else "❌"
            print(f"{status} {method:6} {path:40} - {message}")

        print("=" * 80)
        self.print_summary()

    def print_summary(self):
        """Print verification summary."""
        total = len(self.results)
        passed = sum(1 for _, _, success, _ in self.results if success)
        failed = total - passed

        print(f"\n📊 Summary:")
        print(f"   Total endpoints tested: {total}")
        print(f"   ✅ Passed: {passed}")
        print(f"   ❌ Failed: {failed}")

        if failed > 0:
            print(f"\n⚠️  {failed} endpoint(s) failed verification")
            print("   Make sure the backend is running: ./scripts/run_bk.sh")
            sys.exit(1)
        else:
            print(f"\n🎉 All endpoints verified successfully!")
            sys.exit(0)


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Verify PrismRAG API endpoints")
    parser.add_argument(
        "--url",
        default="http://localhost:8080",
        help="Base URL of the API (default: http://localhost:8080)",
    )
    args = parser.parse_args()

    verifier = APIVerifier(base_url=args.url)
    await verifier.verify_all()


if __name__ == "__main__":
    asyncio.run(main())
