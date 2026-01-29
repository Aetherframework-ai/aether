"""
Aether Python SDK - Core module
"""

from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum
import asyncio
import json
import httpx
import websockets
from websockets.asyncio.client import connect

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ========== Enums ==========


class ResourceType(Enum):
    STEP = 0
    ACTIVITY = 1
    WORKFLOW = 2


# ========== Data Classes ==========


@dataclass
class ActivityOptions:
    max_attempts: int = 3
    timeout: int = 30000  # milliseconds
    retry_interval: int = 1000
    backoff_multiplier: float = 2.0


@dataclass
class ResourceMetadata:
    name: str
    resource_type: ResourceType
    options: Optional[ActivityOptions] = None


# ========== Decorators ==========

_steps_registry: Dict[str, Callable] = {}
_activities_registry: Dict[str, Callable] = {}
_workflows_registry: Dict[str, Callable] = {}


def step(name: Optional[str] = None):
    """Decorator to mark a method as a step"""

    def decorator(func: Callable):
        step_name = name or func.__name__
        _steps_registry[step_name] = func
        func._aether_step = step_name
        return func

    return decorator


def activity(
    options: Optional[ActivityOptions] = None,
    name: Optional[str] = None,
    max_attempts: int = 3,
    timeout: int = 30000,
):
    """Decorator to mark a method as an activity"""

    def decorator(func: Callable):
        activity_name = name or func.__name__
        _activities_registry[activity_name] = func
        func._aether_activity = activity_name
        # Support both options object and keyword arguments
        if options:
            func._aether_activity_options = options
        else:
            func._aether_activity_options = ActivityOptions(
                max_attempts=max_attempts, timeout=timeout
            )
        return func

    return decorator


def workflow(name: Optional[str] = None):
    """Decorator to mark a class as a workflow"""

    def decorator(cls: type):
        workflow_name = name or cls.__name__
        _workflows_registry[workflow_name] = cls
        cls._aether_workflow = workflow_name
        return cls

    return decorator


def get_steps() -> Dict[str, Callable]:
    """Get all registered steps"""
    return _steps_registry.copy()


def get_activities() -> Dict[str, Callable]:
    """Get all registered activities"""
    return _activities_registry.copy()


def get_workflows() -> Dict[str, type]:
    """Get all registered workflows"""
    return _workflows_registry.copy()


# ========== Workflow Context ==========


class WorkflowContext:
    """Context for workflow execution"""

    def __init__(self, service: "AetherService"):
        self._service = service

    async def step(self, name: str, input: Any) -> Any:
        """Execute a step"""
        # Check if it's a local step (self::xxx)
        if name.startswith("self::"):
            step_name = name[6:]  # Remove 'self::'
            return await self._execute_local_step(step_name, input)

        # Remote step - would call Aether to route to target service
        print(f"[Aether] Remote step: {name}")
        return await self._service._execute_remote_step(name, input)

    async def activity(
        self, name: str, input: Any, options: Optional[ActivityOptions] = None
    ) -> Any:
        """Execute an activity with retry"""
        # Check if it's a local activity
        if name.startswith("self::"):
            activity_name = name[6:]
            return await self._execute_local_activity(activity_name, input, options)

        # Remote activity
        print(f"[Aether] Remote activity: {name}")
        return await self._service._execute_remote_activity(name, input, options)

    async def child(self, workflow_name: str, args: List[Any]) -> Any:
        """Execute a child workflow"""
        print(f"[Aether] Child workflow: {workflow_name}")
        return await self._service._execute_remote_workflow(workflow_name, args)

    async def _execute_local_step(self, name: str, input: Any) -> Any:
        """Execute a local step"""
        if name in _steps_registry:
            step_func = _steps_registry[name]
            if asyncio.iscoroutinefunction(step_func):
                return await step_func(self._service, input)
            else:
                return step_func(self._service, input)
        raise ValueError(f"Step '{name}' not found")

    async def _execute_local_activity(
        self, name: str, input: Any, options: Optional[ActivityOptions]
    ) -> Any:
        """Execute a local activity with retry"""
        if name not in _activities_registry:
            raise ValueError(f"Activity '{name}' not found")

        activity_func = _activities_registry[name]
        opts = options or ActivityOptions()

        # Execute with retry
        last_error = None
        for attempt in range(opts.max_attempts):
            try:
                if asyncio.iscoroutinefunction(activity_func):
                    return await asyncio.wait_for(
                        activity_func(self._service, input),
                        timeout=opts.timeout / 1000.0,
                    )
                else:
                    return asyncio.wait_for(
                        activity_func(self._service, input),
                        timeout=opts.timeout / 1000.0,
                    )
            except Exception as e:
                last_error = e
                if attempt < opts.max_attempts - 1:
                    # Exponential backoff
                    wait_time = opts.retry_interval * (opts.backoff_multiplier**attempt)
                    await asyncio.sleep(wait_time / 1000.0)

        raise last_error


# ========== Aether Client ==========


class AetherClient:
    """Client for interacting with Aether server via REST API"""

    def __init__(self, base_url: str = "http://localhost:7233"):
        self._base_url = base_url.rstrip("/")
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=httpx.Timeout(30.0),
            )
        return self._http_client

    async def close(self):
        """Close the HTTP client"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def start_workflow(
        self,
        workflow_name: str,
        workflow_id: str,
        input: Any,
        task_queue: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Start a new workflow execution"""
        client = await self._get_client()
        response = await client.post(
            "/api/v1/workflows",
            json={
                "workflowName": workflow_name,
                "workflowId": workflow_id,
                "input": input,
                "taskQueue": task_queue,
            },
        )
        response.raise_for_status()
        return response.json()

    async def get_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Get workflow execution status"""
        client = await self._get_client()
        response = await client.get(f"/api/v1/workflows/{workflow_id}")
        response.raise_for_status()
        return response.json()

    async def cancel_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Cancel a workflow execution"""
        client = await self._get_client()
        response = await client.post(f"/api/v1/workflows/{workflow_id}/cancel")
        response.raise_for_status()
        return response.json()

    async def signal_workflow(
        self, workflow_id: str, signal_name: str, data: Any = None
    ) -> Dict[str, Any]:
        """Send a signal to a workflow"""
        client = await self._get_client()
        response = await client.post(
            f"/api/v1/workflows/{workflow_id}/signal",
            json={"signalName": signal_name, "data": data},
        )
        response.raise_for_status()
        return response.json()

    async def query_workflow(
        self, workflow_id: str, query_name: str, args: Any = None
    ) -> Dict[str, Any]:
        """Query a workflow"""
        client = await self._get_client()
        response = await client.post(
            f"/api/v1/workflows/{workflow_id}/query",
            json={"queryName": query_name, "args": args},
        )
        response.raise_for_status()
        return response.json()


# ========== Aether Worker ==========


class AetherWorker:
    """Worker that connects to Aether server via WebSocket"""

    def __init__(
        self,
        server_url: str = "ws://localhost:7233",
        task_queue: str = "default",
        service: Optional["AetherService"] = None,
    ):
        self._server_url = server_url.rstrip("/")
        self._task_queue = task_queue
        self._service = service
        self._ws: Optional[websockets.asyncio.client.ClientConnection] = None
        self._running = False
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0

    async def start(self):
        """Start the worker and connect to Aether server"""
        self._running = True
        print(f"[AetherWorker] Starting worker for task queue: {self._task_queue}")

        while self._running:
            try:
                await self._connect_and_poll()
            except websockets.exceptions.ConnectionClosed as e:
                if self._running:
                    print(f"[AetherWorker] Connection closed: {e}. Reconnecting...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(
                        self._reconnect_delay * 2, self._max_reconnect_delay
                    )
            except Exception as e:
                if self._running:
                    print(f"[AetherWorker] Error: {e}. Reconnecting...")
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(
                        self._reconnect_delay * 2, self._max_reconnect_delay
                    )

    async def stop(self):
        """Stop the worker"""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        print("[AetherWorker] Worker stopped")

    async def _connect_and_poll(self):
        """Connect to WebSocket and poll for tasks"""
        ws_url = f"{self._server_url}/api/v1/worker/connect?taskQueue={self._task_queue}"
        print(f"[AetherWorker] Connecting to {ws_url}")

        async with connect(ws_url) as ws:
            self._ws = ws
            self._reconnect_delay = 1.0  # Reset on successful connection
            print(f"[AetherWorker] Connected to Aether server")

            # Send registration message
            await self._register()

            # Poll for tasks
            async for message in ws:
                await self._handle_message(message)

    async def _register(self):
        """Register worker with Aether server"""
        if not self._ws:
            return

        resources = []
        if self._service:
            for name in get_steps().keys():
                resources.append({"name": name, "type": "step"})
            for name in get_activities().keys():
                resources.append({"name": name, "type": "activity"})
            for name in get_workflows().keys():
                resources.append({"name": name, "type": "workflow"})

        registration = {
            "type": "register",
            "taskQueue": self._task_queue,
            "resources": resources,
        }
        await self._ws.send(json.dumps(registration))
        print(f"[AetherWorker] Registered with {len(resources)} resources")

    async def _handle_message(self, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "task":
                await self._handle_task(data)
            elif msg_type == "heartbeat":
                await self._send_heartbeat_response()
            elif msg_type == "error":
                print(f"[AetherWorker] Server error: {data.get('message')}")
            else:
                print(f"[AetherWorker] Unknown message type: {msg_type}")
        except json.JSONDecodeError as e:
            print(f"[AetherWorker] Invalid JSON message: {e}")

    async def _handle_task(self, data: Dict[str, Any]):
        """Handle a task from Aether server"""
        task_id = data.get("taskId")
        task_type = data.get("taskType")  # step, activity, or workflow
        task_name = data.get("name")
        task_input = data.get("input")

        print(f"[AetherWorker] Received task: {task_type}:{task_name} (id={task_id})")

        try:
            result = await self._execute_task(task_type, task_name, task_input)
            await self._send_task_result(task_id, result, success=True)
        except Exception as e:
            print(f"[AetherWorker] Task failed: {e}")
            await self._send_task_result(task_id, str(e), success=False)

    async def _execute_task(
        self, task_type: str, task_name: str, task_input: Any
    ) -> Any:
        """Execute a task"""
        if task_type == "step":
            if task_name in _steps_registry:
                step_func = _steps_registry[task_name]
                if asyncio.iscoroutinefunction(step_func):
                    return await step_func(self._service, task_input)
                else:
                    return step_func(self._service, task_input)
            raise ValueError(f"Step '{task_name}' not found")

        elif task_type == "activity":
            if task_name in _activities_registry:
                activity_func = _activities_registry[task_name]
                if asyncio.iscoroutinefunction(activity_func):
                    return await activity_func(self._service, task_input)
                else:
                    return activity_func(self._service, task_input)
            raise ValueError(f"Activity '{task_name}' not found")

        elif task_type == "workflow":
            if task_name in _workflows_registry:
                workflow_cls = _workflows_registry[task_name]
                workflow_instance = workflow_cls()
                # Find the workflow method
                for attr_name in dir(workflow_instance):
                    attr = getattr(workflow_instance, attr_name)
                    if hasattr(attr, "_aether_workflow"):
                        if asyncio.iscoroutinefunction(attr):
                            return await attr(self._service._context, task_input)
                        else:
                            return attr(self._service._context, task_input)
            raise ValueError(f"Workflow '{task_name}' not found")

        raise ValueError(f"Unknown task type: {task_type}")

    async def _send_task_result(self, task_id: str, result: Any, success: bool):
        """Send task result back to Aether server"""
        if not self._ws:
            return

        response = {
            "type": "taskResult",
            "taskId": task_id,
            "success": success,
            "result": result if success else None,
            "error": result if not success else None,
        }
        await self._ws.send(json.dumps(response))

    async def _send_heartbeat_response(self):
        """Send heartbeat response"""
        if not self._ws:
            return
        await self._ws.send(json.dumps({"type": "heartbeat"}))


# ========== Aether Service ==========


class AetherService:
    """Base class for Aether services"""

    # Override these in subclasses
    service_name: str = "default-service"
    group: str = "default-group"
    language: List[str] = ["python"]

    def __init__(self, aether_server: str = "localhost:7233"):
        self._aether_server = aether_server
        self._context = WorkflowContext(self)
        self._client: Optional[AetherClient] = None
        self._worker: Optional[AetherWorker] = None

    async def start(self, host: str = "0.0.0.0", port: int = 50051):
        """Start the service"""
        print(f"Starting Aether service: {self.service_name}")
        print(f"  Group: {self.group}")
        print(f"  Language: {self.language}")
        print(f"  Steps: {list(get_steps().keys())}")
        print(f"  Activities: {list(get_activities().keys())}")
        print(f"  Workflows: {list(get_workflows().keys())}")

        # Initialize HTTP client for REST API
        base_url = f"http://{self._aether_server}"
        self._client = AetherClient(base_url=base_url)

        # Initialize WebSocket worker
        ws_url = f"ws://{self._aether_server}"
        self._worker = AetherWorker(
            server_url=ws_url,
            task_queue=self.service_name,
            service=self,
        )

        # Start worker in background
        asyncio.create_task(self._worker.start())

        print(f"Service started on {host}:{port}")

    async def stop(self):
        """Stop the service"""
        if self._client:
            await self._client.close()
            self._client = None
        if self._worker:
            await self._worker.stop()
            self._worker = None
        print("Service stopped")

    async def _execute_remote_step(self, name: str, input: Any) -> Any:
        """Execute a step on a remote service via REST API"""
        if not self._client:
            raise RuntimeError("Service not started")

        # Parse service::step format
        if "::" in name:
            service_name, step_name = name.split("::", 1)
        else:
            service_name = self.service_name
            step_name = name

        # Call Aether API to execute step
        response = await self._client._http_client.post(
            "/api/v1/steps/execute",
            json={
                "serviceName": service_name,
                "stepName": step_name,
                "input": input,
            },
        )
        response.raise_for_status()
        return response.json().get("result")

    async def _execute_remote_activity(
        self, name: str, input: Any, options: Optional[ActivityOptions]
    ) -> Any:
        """Execute an activity on a remote service via REST API"""
        if not self._client:
            raise RuntimeError("Service not started")

        # Parse service::activity format
        if "::" in name:
            service_name, activity_name = name.split("::", 1)
        else:
            service_name = self.service_name
            activity_name = name

        opts = options or ActivityOptions()

        response = await self._client._http_client.post(
            "/api/v1/activities/execute",
            json={
                "serviceName": service_name,
                "activityName": activity_name,
                "input": input,
                "options": {
                    "maxAttempts": opts.max_attempts,
                    "timeout": opts.timeout,
                    "retryInterval": opts.retry_interval,
                    "backoffMultiplier": opts.backoff_multiplier,
                },
            },
        )
        response.raise_for_status()
        return response.json().get("result")

    async def _execute_remote_workflow(self, name: str, args: List[Any]) -> Any:
        """Execute a workflow on a remote service via REST API"""
        if not self._client:
            raise RuntimeError("Service not started")

        import uuid

        workflow_id = f"{name}-{uuid.uuid4().hex[:8]}"

        result = await self._client.start_workflow(
            workflow_name=name,
            workflow_id=workflow_id,
            input=args,
        )
        return result

    def _get_provided_resources(self) -> List[ResourceMetadata]:
        """Get list of resources provided by this service"""
        resources = []

        for name in get_steps().keys():
            resources.append(
                ResourceMetadata(name=name, resource_type=ResourceType.STEP)
            )

        for name in get_activities().keys():
            resources.append(
                ResourceMetadata(name=name, resource_type=ResourceType.ACTIVITY)
            )

        for name in get_workflows().keys():
            resources.append(
                ResourceMetadata(name=name, resource_type=ResourceType.WORKFLOW)
            )

        return resources


# ========== Imports ==========

__all__ = [
    "AetherClient",
    "AetherWorker",
    "AetherService",
    "WorkflowContext",
    "step",
    "activity",
    "workflow",
    "ResourceType",
    "ActivityOptions",
    "ResourceMetadata",
    "get_steps",
    "get_activities",
    "get_workflows",
]
