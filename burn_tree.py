"""Minimum time to burn an entire binary tree.

Fire starts at a given node and, each second, spreads to a burning node's
parent, left child, and right child (no siblings). The answer is the time
until every node is burned.
"""

from collections import deque
from dataclasses import dataclass
from typing import Optional


@dataclass(eq=False)  # identity-based hashing so nodes can be dict/set keys
class TreeNode:
    val: int
    left: Optional["TreeNode"] = None
    right: Optional["TreeNode"] = None


def time_to_burn_tree(root: Optional[TreeNode], start_val: int) -> int:
    """Return the seconds needed to burn the whole tree.

    Fire starts at the node whose value is ``start_val`` and spreads each
    second to a node's parent, left child, and right child.

    Returns -1 if the tree is empty or ``start_val`` is not present.
    """
    if root is None:
        return -1

    # Phase 1: BFS to map each node to its parent and locate the start node.
    parent: dict[TreeNode, Optional[TreeNode]] = {root: None}
    start: Optional[TreeNode] = None

    build_queue: deque[TreeNode] = deque([root])
    while build_queue:
        node = build_queue.popleft()
        if node.val == start_val:
            start = node
        if node.left:
            parent[node.left] = node
            build_queue.append(node.left)
        if node.right:
            parent[node.right] = node
            build_queue.append(node.right)

    if start is None:
        return -1  # start node not in the tree

    # Phase 2: BFS outward from the start node; each level == one second.
    visited: set[TreeNode] = {start}
    frontier: list[TreeNode] = [start]
    time = -1  # igniting the first ring (level 0) costs no time

    while frontier:
        nxt: list[TreeNode] = []
        for node in frontier:
            # The three directions fire can travel — no siblings.
            for neighbor in (node.left, node.right, parent[node]):
                if neighbor is not None and neighbor not in visited:
                    visited.add(neighbor)
                    nxt.append(neighbor)
        frontier = nxt
        time += 1

    return time
