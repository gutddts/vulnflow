"""
DAG 工具 - 提供有向无环图的验证、排序和执行计划构建功能
"""
import json
import logging
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


def validate_dag(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    验证 DAG 是否有环

    使用 DFS 三色标记法检测环：
    - 白色 (0): 未访问
    - 灰色 (1): 正在访问 (在当前 DFS 路径上)
    - 黑色 (2): 已完成访问

    Args:
        nodes: 节点列表，每个节点包含 id, name, type 等
        edges: 边列表，每个边包含 from, to

    Returns:
        验证结果，包含 is_valid, cycles, errors
    """
    # 构建邻接表
    adjacency = defaultdict(list)
    node_ids = {n["id"] for n in nodes}

    for edge in edges:
        from_id = edge.get("from") or edge.get("source")
        to_id = edge.get("to") or edge.get("target")

        if from_id not in node_ids:
            return {
                "is_valid": False,
                "cycles": [],
                "errors": [f"边源节点不存在: {from_id}"],
            }
        if to_id not in node_ids:
            return {
                "is_valid": False,
                "cycles": [],
                "errors": [f"边目标节点不存在: {to_id}"],
            }

        adjacency[from_id].append(to_id)

    # DFS 检测环
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node["id"]: WHITE for node in nodes}
    parent = {}
    cycles = []

    def dfs(node_id: str, path: List[str]) -> bool:
        """DFS 遍历，返回是否发现环"""
        color[node_id] = GRAY
        path.append(node_id)

        for neighbor in adjacency.get(node_id, []):
            if color[neighbor] == GRAY:
                # 发现环 - 提取环路径
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                cycles.append(cycle)
                return True
            elif color[neighbor] == WHITE:
                parent[neighbor] = node_id
                if dfs(neighbor, path):
                    return True

        path.pop()
        color[node_id] = BLACK
        return False

    errors = []
    for node in nodes:
        node_id = node["id"]
        if color[node_id] == WHITE:
            if dfs(node_id, []):
                errors.append(f"检测到环: {' -> '.join(cycles[-1])}")

    # 检查孤立节点 (没有边连接的节点)
    connected_nodes = set()
    for edge in edges:
        connected_nodes.add(edge.get("from") or edge.get("source"))
        connected_nodes.add(edge.get("to") or edge.get("target"))

    isolated = node_ids - connected_nodes
    if isolated:
        # 孤立节点不算错误，但记录警告
        logger.info("发现孤立节点: %s", isolated)

    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "cycles": cycles,
        "errors": errors,
        "isolated_nodes": list(isolated),
    }


def topological_sort(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> List[str]:
    """
    拓扑排序 (Kahn 算法)

    Args:
        nodes: 节点列表
        edges: 边列表

    Returns:
        拓扑排序后的节点 ID 列表

    Raises:
        ValueError: 如果图中有环
    """
    # 构建入度表和邻接表
    in_degree = {n["id"]: 0 for n in nodes}
    adjacency = defaultdict(list)

    for edge in edges:
        from_id = edge.get("from") or edge.get("source")
        to_id = edge.get("to") or edge.get("target")
        adjacency[from_id].append(to_id)
        in_degree[to_id] = in_degree.get(to_id, 0) + 1

    # 入度为 0 的节点入队
    queue = deque([nid for nid, deg in in_degree.items() if deg == 0])

    result = []
    while queue:
        node_id = queue.popleft()
        result.append(node_id)

        for neighbor in adjacency.get(node_id, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(nodes):
        # 存在环
        remaining = set(nodes) - set(result)
        raise ValueError(f"图中存在环，无法拓扑排序。剩余节点: {remaining}")

    return result


def find_parallel_groups(
    sorted_node_ids: List[str], edges: List[Dict[str, Any]]
) -> List[List[str]]:
    """
    找出可以并行执行的节点组

    使用 BFS 层级分组：
    - 同一层级的节点没有相互依赖，可以并行执行
    - 不同层级之间有依赖关系，需要串行执行

    Args:
        sorted_node_ids: 拓扑排序后的节点 ID 列表
        edges: 边列表

    Returns:
        并行组列表，每组是一组可以并行执行的节点 ID
    """
    # 构建依赖关系
    adjacency = defaultdict(list)  # from -> [to]
    reverse_adjacency = defaultdict(list)  # to -> [from]

    for edge in edges:
        from_id = edge.get("from") or edge.get("source")
        to_id = edge.get("to") or edge.get("target")
        adjacency[from_id].append(to_id)
        reverse_adjacency[to_id].append(from_id)

    # 计算每个节点的层级 (最长路径长度)
    node_level = {}

    for node_id in sorted_node_ids:
        if not reverse_adjacency.get(node_id):
            # 没有前置依赖，层级为 0
            node_level[node_id] = 0
        else:
            # 层级 = max(所有前置节点的层级) + 1
            max_predecessor_level = max(
                node_level.get(pred, 0) for pred in reverse_adjacency[node_id]
            )
            node_level[node_id] = max_predecessor_level + 1

    # 按层级分组
    groups = defaultdict(list)
    for node_id, level in node_level.items():
        groups[level].append(node_id)

    # 按层级排序返回
    result = []
    for level in sorted(groups.keys()):
        result.append(groups[level])

    return result


def build_execution_plan(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    构建完整的执行计划

    执行计划包含：
    - 验证结果
    - 拓扑排序
    - 并行分组
    - 每个阶段的执行说明

    Args:
        nodes: 节点列表，每个节点包含 id, name, type, config
        edges: 边列表，每个边包含 from, to

    Returns:
        完整的执行计划
    """
    # 1. 验证 DAG
    validation = validate_dag(nodes, edges)
    if not validation["is_valid"]:
        return {
            "is_valid": False,
            "errors": validation["errors"],
            "cycles": validation["cycles"],
            "plan": None,
        }

    # 2. 拓扑排序
    try:
        sorted_ids = topological_sort(nodes, edges)
    except ValueError as e:
        return {
            "is_valid": False,
            "errors": [str(e)],
            "cycles": [],
            "plan": None,
        }

    # 3. 查找并行组
    parallel_groups = find_parallel_groups(sorted_ids, edges)

    # 4. 构建节点查找表
    node_map = {n["id"]: n for n in nodes}

    # 5. 构建执行阶段
    stages = []
    for level, group in enumerate(parallel_groups):
        stage_nodes = []
        for node_id in group:
            node = node_map.get(node_id, {})
            stage_nodes.append(
                {
                    "id": node_id,
                    "name": node.get("name", node_id),
                    "type": node.get("type", "task"),
                    "config": node.get("config", {}),
                }
            )

        stage = {
            "stage": level,
            "parallel": len(group) > 1,
            "node_count": len(group),
            "nodes": stage_nodes,
        }
        stages.append(stage)

    # 6. 计算预估执行时间
    total_nodes = len(nodes)
    total_stages = len(stages)
    max_parallel = max(len(g) for g in parallel_groups)

    plan = {
        "total_nodes": total_nodes,
        "total_stages": total_stages,
        "max_parallelism": max_parallel,
        "execution_order": sorted_ids,
        "stages": stages,
        "isolated_nodes": validation.get("isolated_nodes", []),
    }

    return {
        "is_valid": True,
        "errors": [],
        "cycles": [],
        "plan": plan,
    }


def visualize_dag(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    format: str = "mermaid",
) -> str:
    """
    生成 DAG 的可视化表示

    Args:
        nodes: 节点列表
        edges: 边列表
        format: 输出格式 (mermaid, dot)

    Returns:
        可视化文本
    """
    if format == "mermaid":
        lines = ["graph TD"]
        for node in nodes:
            node_id = node["id"]
            node_name = node.get("name", node_id)
            node_type = node.get("type", "task")

            # 根据类型选择样式
            if node_type == "recon":
                style = ":::recon"
            elif node_type == "exploit":
                style = ":::exploit"
            elif node_type == "decision":
                style = ":::decision"
            else:
                style = ""

            lines.append(f"    {node_id}[{node_name}]{style}")

        for edge in edges:
            from_id = edge.get("from") or edge.get("source")
            to_id = edge.get("to") or edge.get("target")
            lines.append(f"    {from_id} --> {to_id}")

        # 添加样式定义
        lines.append("")
        lines.append("    classDef recon fill:#4A90D9,stroke:#333,stroke-width:2px")
        lines.append(
            "    classDef exploit fill:#D94A4A,stroke:#333,stroke-width:2px"
        )
        lines.append(
            "    classDef decision fill:#F5A623,stroke:#333,stroke-width:2px"
        )

        return "\n".join(lines)

    elif format == "dot":
        lines = ["digraph VulnFlow {"]
        lines.append('    rankdir="TB";')
        lines.append('    node [shape=box, style=rounded];')

        for node in nodes:
            node_id = node["id"]
            node_name = node.get("name", node_id)
            lines.append(f'    {node_id} [label="{node_name}"];')

        for edge in edges:
            from_id = edge.get("from") or edge.get("source")
            to_id = edge.get("to") or edge.get("target")
            lines.append(f"    {from_id} -> {to_id};")

        lines.append("}")
        return "\n".join(lines)

    else:
        raise ValueError(f"不支持的格式: {format}")


def estimate_execution_time(
    stages: List[Dict[str, Any]],
    node_durations: Optional[Dict[str, float]] = None,
    default_duration: float = 30.0,
) -> Dict[str, float]:
    """
    估算执行计划的执行时间

    Args:
        stages: 执行阶段列表
        node_durations: 每个节点的预估执行时间 (秒)
        default_duration: 默认执行时间 (秒)

    Returns:
        包含 total_time, stage_times 的估算结果
    """
    stage_times = []
    total_time = 0.0

    for stage in stages:
        stage_max = 0.0
        for node in stage.get("nodes", []):
            node_id = node["id"]
            duration = (
                node_durations.get(node_id, default_duration)
                if node_durations
                else default_duration
            )
            stage_max = max(stage_max, duration)

        stage_times.append(
            {
                "stage": stage["stage"],
                "parallel": stage["parallel"],
                "node_count": stage["node_count"],
                "estimated_seconds": stage_max,
            }
        )
        total_time += stage_max

    return {
        "total_estimated_seconds": round(total_time, 2),
        "total_estimated_minutes": round(total_time / 60, 2),
        "stage_times": stage_times,
    }
