"""
Aether Python SDK - Core module
"""

from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum
import asyncio
import json
from aiohttp import web
import grpc
from grpc import aio

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


def activity(options: Optional[ActivityOptions] = None, name: Optional[str] = None):
    """Decorator to mark a method as an activity"""

    def decorator(func: Callable):
        activity_name = name or func.__name__
        _activities_registry[activity_name] = func
        func._aether_activity = activity_name
        func._aether_activity_options = options
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
        self._server: Optional[aio.Server] = None
        self._channel: Optional[grpc.aio.Channel] = None

    async def start(self, host: str = "0.0.0.0", port: int = 50051):
        """Start the service"""
        print(f"Starting Aether service: {self.service_name}")
        print(f"  Group: {self.group}")
        print(f"  Language: {self.language}")
        print(f"  Steps: {list(get_steps().keys())}")
        print(f"  Activities: {list(get_activities().keys())}")
        print(f"  Workflows: {list(get_workflows().keys())}")

        # TODO: Register with Aether server via gRPC
        # self._channel = grpc.aio.insecure_channel(self._aether_server)

        # TODO: Start gRPC server for receiving tasks
        # self._server = aio.server(futures.ThreadPoolExecutor(max_workers=10))
        # add_WorkerServiceServicer_to_server...
        # await self._server.start()

        print(f"Service started on {host}:{port}")

    async def stop(self):
        """Stop the service"""
        if self._channel:
            await self._channel.close()
        if self._server:
            await self._server.stop(grace=5)
        print("Service stopped")

    async def _execute_remote_step(self, name: str, input: Any) -> Any:
        """Execute a step on a remote service"""
        # TODO: Call Aether to route and execute
        return {"error": "Not implemented"}

    async def _execute_remote_activity(
        self, name: str, input: Any, options: Optional[ActivityOptions]
    ) -> Any:
        """Execute an activity on a remote service"""
        return {"error": "Not implemented"}

    async def _execute_remote_workflow(self, name: str, args: List[Any]) -> Any:
        """Execute a workflow on a remote service"""
        return {"error": "Not implemented"}

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
