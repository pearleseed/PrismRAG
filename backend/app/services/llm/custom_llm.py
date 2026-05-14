"""
Custom LLM Provider for External AI Backends

Implements a custom LLM provider that transforms PrismRAG LLM interface
into external backend protocol (e.g., Content Network).

Protocol:
  Internal Request:  {"system_prompt": "...", "user_input": "..."}
  Internal Response: {"system_response": "...", "token_usage": 123}
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import ssl
import time
import uuid
from typing import AsyncGenerator, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.services.llm.base import LLMProvider
from app.services.llm.types import LLMMessage, LLMResult, StreamChunk

logger = logging.getLogger(__name__)


class CustomLLMError(Exception):
    """Base exception for Custom LLM errors."""

    pass


# ============================================================================
# Factory Function
# ============================================================================


def create_custom_llm_provider() -> Optional[LLMProvider]:
    """
    Create a custom LLM provider based on configuration.

    Returns:
        Configured LLM provider or None if endpoint is not configured

    Raises:
        ValueError: If configuration is invalid
    """
    from app.core.config import settings

    endpoint = (settings.CUSTOM_LLM_ENDPOINT or "").strip()
    if not endpoint:
        return None

    return _create_custom_provider()


def _create_custom_provider() -> LLMProvider:
    """
    Create Custom LLM provider for external AI backends.

    Returns:
        CustomLLMProvider instance

    Raises:
        ValueError: If configuration is invalid
    """
    from app.core.config import settings

    endpoint = (settings.CUSTOM_LLM_ENDPOINT or "").strip()
    if not endpoint:
        raise ValueError("CUSTOM_LLM_ENDPOINT is required when using custom provider")

    auth_type = (settings.CUSTOM_LLM_AUTH_TYPE or "bearer").strip().lower()
    auth_credentials = (settings.CUSTOM_LLM_AUTH_CREDENTIALS or "").strip()
    timeout = float(settings.CUSTOM_LLM_TIMEOUT or 30.0)
    verify_ssl = bool(settings.CUSTOM_LLM_VERIFY_SSL)
    model_name = (settings.CUSTOM_LLM_MODEL_NAME or "custom-llm").strip()

    try:
        # Endpoint will be combined with model_name in CustomLLMProvider.__init__
        # Example: endpoint="https://api.example.com/chat" + model_name="gpt-4"
        #          → full URL: "https://api.example.com/chat/gpt-4"
        provider = CustomLLMProvider(
            endpoint=endpoint,
            auth_type=auth_type,
            auth_credentials=auth_credentials,
            timeout=timeout,
            verify_ssl=verify_ssl,
            model_name=model_name,
        )
        logger.info(
            f"Created Custom LLM provider",
            extra={
                "endpoint": endpoint,
                "model_name": model_name,
                "full_url": provider.endpoint,
                "auth_type": auth_type,
                "timeout": timeout,
                "verify_ssl": verify_ssl,
            },
        )
        return provider
    except CustomLLMError as e:
        raise ValueError(f"Failed to create Custom LLM provider: {str(e)}")


# ============================================================================
# Custom LLM Provider Implementation
# ============================================================================


class CustomLLMProvider(LLMProvider):
    """
    Custom LLM Provider for External AI Backends.

    Implements PrismRAG's LLMProvider interface to integrate external
    AI backends as a drop-in LLM provider.

    Handles:
    - Message transformation (PrismRAG format → backend protocol)
    - HTTP communication with authentication and SSL options
    - Response validation and transformation
    - Error handling and timeout management
    """

    def __init__(
        self,
        endpoint: str,
        auth_type: str = "bearer",
        auth_credentials: str = "",
        timeout: float = 30.0,
        verify_ssl: bool = True,
        model_name: str = "custom-llm",
    ):
        """
        Initialize the Custom LLM provider.

        Args:
            endpoint: Backend base URL (e.g., "https://api.example.com/chat")
                     Model name will be appended: {endpoint}/{model_name}
            auth_type: Authentication type - "bearer" or "basic"
            auth_credentials: API key (for bearer) or "username:password" (for basic)
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates
            model_name: Model identifier (appended to endpoint URL)

        Raises:
            CustomLLMError: If endpoint is not configured
        """
        if not endpoint or not endpoint.strip():
            raise CustomLLMError("Custom LLM endpoint is not configured")

        endpoint = endpoint.strip()
        model_name = (model_name or "custom-llm").strip()

        # Build full endpoint URL by appending model_name
        # Remove trailing slash from endpoint if present
        endpoint = endpoint.rstrip("/")
        self.endpoint = f"{endpoint}/{model_name}"

        self.auth_type = auth_type.lower()
        self.auth_credentials = auth_credentials.strip()
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self.model_name = model_name

        if self.auth_type not in ("bearer", "basic"):
            raise CustomLLMError(
                f"Unsupported auth_type: {self.auth_type}. Must be 'bearer' or 'basic'."
            )

    def _build_auth_header(self) -> Optional[str]:
        """
        Build Authorization header based on auth type.

        Returns:
            Authorization header value or None if no credentials
        """
        if not self.auth_credentials:
            return None

        if self.auth_type == "bearer":
            return f"Bearer {self.auth_credentials}"

        if self.auth_type == "basic":
            credentials_b64 = base64.b64encode(
                self.auth_credentials.encode("utf-8")
            ).decode("ascii")
            return f"Basic {credentials_b64}"

        return None

    def _get_ssl_context(self) -> Optional[ssl.SSLContext]:
        """
        Get SSL context based on verification setting.

        Returns:
            SSL context or None for default
        """
        if not self.verify_ssl:
            return ssl._create_unverified_context()
        return None

    def _extract_messages(
        self, messages: list[LLMMessage]
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Extract system prompt and reconstruct full conversation history into user_input.

        Args:
            messages: List of LLMMessage objects

        Returns:
            Tuple of (system_prompt, reconstructed_conversation)
        """
        system_prompt = None
        history_parts = []

        for msg in messages:
            role = msg.role.lower()
            content = (msg.content or "").strip()
            if not content:
                continue

            if role == "system":
                # Capture the first system message found
                if system_prompt is None:
                    system_prompt = content
            elif role == "user":
                history_parts.append(f"User: {content}")
            elif role == "assistant":
                history_parts.append(f"Assistant: {content}")

        # Combine history into a single string
        reconstructed_history = "\n".join(history_parts) if history_parts else None

        return system_prompt, reconstructed_history

    def _build_internal_request(
        self, system_prompt: Optional[str], user_input: Optional[str]
    ) -> dict:
        """
        Build internal backend request.

        Args:
            system_prompt: System prompt (optional)
            user_input: User input (required)

        Returns:
            Internal request dict

        Raises:
            CustomLLMError: If user_input is missing
        """
        if not user_input or not user_input.strip():
            raise CustomLLMError(
                "No user message found in request. At least one user message is required."
            )

        return {
            "system_prompt": system_prompt or "",
            "user_input": user_input.strip(),
        }

    def _validate_internal_response(self, response_data: dict) -> tuple[str, int]:
        """
        Validate internal backend response.

        Args:
            response_data: Parsed response JSON

        Returns:
            Tuple of (system_response, token_usage)

        Raises:
            CustomLLMError: If response is invalid
        """
        # Validate system_response
        system_response = response_data.get("system_response")
        if system_response is None:
            raise CustomLLMError(
                "Backend response is missing a valid 'system_response' field."
            )

        if not isinstance(system_response, str):
            raise CustomLLMError("Backend response 'system_response' must be a string.")

        system_response_trimmed = system_response.strip()
        if not system_response_trimmed:
            raise CustomLLMError(
                "Backend response 'system_response' is empty after trimming whitespace."
            )

        # Validate token_usage
        token_usage = response_data.get("token_usage")
        if token_usage is None:
            raise CustomLLMError(
                "Backend response is missing a valid 'token_usage' field."
            )

        if not isinstance(token_usage, int):
            raise CustomLLMError("Backend response 'token_usage' must be an integer.")

        if token_usage < 0:
            raise CustomLLMError(
                "Backend response 'token_usage' must be greater than or equal to zero."
            )

        return system_response_trimmed, token_usage

    def _make_http_request(self, request_data: dict) -> dict:
        """
        Make HTTP request to backend.

        Args:
            request_data: Request payload

        Returns:
            Parsed JSON response

        Raises:
            CustomLLMError: On HTTP or network errors
        """
        try:
            # Encode request
            request_body = json.dumps(request_data, ensure_ascii=False).encode("utf-8")

            # Build HTTP request
            req = Request(
                self.endpoint,
                data=request_body,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )

            # Add authorization header if configured
            auth_header = self._build_auth_header()
            if auth_header:
                req.add_header("Authorization", auth_header)

            # Get SSL context
            ssl_context = self._get_ssl_context()

            # Make request with timeout
            with urlopen(req, timeout=self.timeout, context=ssl_context) as response:
                response_body = response.read().decode("utf-8")

            # Parse response
            try:
                response_data = json.loads(response_body)
            except json.JSONDecodeError as e:
                raise CustomLLMError(f"Backend response is not valid JSON: {str(e)}")

            return response_data

        except URLError as e:
            if hasattr(e, "code"):
                # HTTP error
                raise CustomLLMError(
                    f"Backend request failed with HTTP {e.code}: {str(e.reason)}"
                )
            else:
                # Network error
                raise CustomLLMError(f"Backend request failed: {str(e)}")

    # ========================================================================
    # LLMProvider Interface Implementation
    # ========================================================================

    def complete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
    ) -> str | LLMResult:
        """
        Synchronous text generation.

        Args:
            messages: Conversation history
            temperature: Sampling temperature (ignored by backend)
            max_tokens: Maximum output tokens (ignored by backend)
            system_prompt: System-level instruction (prepended to extracted system message)
            think: If True, return LLMResult with thinking text (not supported)

        Returns:
            Generated text string
        """
        # Extract messages
        extracted_system, user_input = self._extract_messages(messages)

        # Combine system prompts
        final_system = system_prompt or ""
        if extracted_system:
            final_system = f"{final_system}\n{extracted_system}".strip()

        # Build internal request
        internal_request = self._build_internal_request(final_system, user_input)

        logger.debug(
            f"Custom LLM request",
            extra={"endpoint": self.endpoint},
        )

        try:
            # Make HTTP request
            internal_response = self._make_http_request(internal_request)

            # Validate response
            system_response, token_usage = self._validate_internal_response(
                internal_response
            )

            logger.debug(
                f"Custom LLM response",
                extra={"tokens": token_usage},
            )

            return system_response

        except CustomLLMError as e:
            logger.error(f"Custom LLM error: {str(e)}")
            return ""

    async def acomplete(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
    ) -> str | LLMResult:
        """
        Async text generation.

        Runs complete() in a thread pool to avoid blocking.
        """
        return await asyncio.to_thread(
            self.complete,
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt,
            think=think,
        )

    async def astream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        think: bool = False,
        tools: list | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        Async streaming generation.

        Backend does not support streaming, so this yields
        a single text chunk with the complete response.
        """
        try:
            result = await self.acomplete(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=system_prompt,
                think=think,
            )
            # Extract content string if result is an LLMResult object
            from app.services.llm.types import LLMResult

            content = result.content if isinstance(result, LLMResult) else result

            yield StreamChunk(type="text", text=content)
        except Exception as e:
            logger.error(f"Custom LLM streaming error: {str(e)}")
            yield StreamChunk(type="text", text="")

    def supports_vision(self) -> bool:
        """Backend does not support vision."""
        return False

    def supports_thinking(self) -> bool:
        """Backend does not support thinking mode."""
        return False

    def supports_native_tools(self) -> bool:
        """Backend does not support tool calling."""
        return False
