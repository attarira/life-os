"""Unit tests for time_to_burn_tree."""

import unittest

from burn_tree import TreeNode, time_to_burn_tree


def build_sample_tree() -> TreeNode:
    """Build the tree:

            1
           / \\
          2   3
         / \\   \\
        4   5    6
    """
    n4 = TreeNode(4)
    n5 = TreeNode(5)
    n6 = TreeNode(6)
    n2 = TreeNode(2, left=n4, right=n5)
    n3 = TreeNode(3, right=n6)
    return TreeNode(1, left=n2, right=n3)


class TimeToBurnTreeTests(unittest.TestCase):
    def test_burn_from_deep_leaf(self):
        # Start at 5: 5 -> 2 -> {4,1} -> 3 -> 6  == 4 seconds.
        root = build_sample_tree()
        self.assertEqual(time_to_burn_tree(root, 5), 4)

    def test_burn_from_root(self):
        # From the root, the farthest node (4, 5, or 6) is 2 levels deep.
        root = build_sample_tree()
        self.assertEqual(time_to_burn_tree(root, 1), 2)

    def test_burn_from_leaf_far_corner(self):
        # Start at 6: 6 -> 3 -> 1 -> 2 -> {4,5} == 4 seconds.
        root = build_sample_tree()
        self.assertEqual(time_to_burn_tree(root, 6), 4)

    def test_single_node(self):
        self.assertEqual(time_to_burn_tree(TreeNode(42), 42), 0)

    def test_empty_tree(self):
        self.assertEqual(time_to_burn_tree(None, 1), -1)

    def test_start_value_absent(self):
        root = build_sample_tree()
        self.assertEqual(time_to_burn_tree(root, 999), -1)

    def test_left_skewed_chain(self):
        # 1 -> 2 -> 3 -> 4 (each only a left child). Start at the tip.
        n4 = TreeNode(4)
        n3 = TreeNode(3, left=n4)
        n2 = TreeNode(2, left=n3)
        root = TreeNode(1, left=n2)
        self.assertEqual(time_to_burn_tree(root, 4), 3)
        self.assertEqual(time_to_burn_tree(root, 1), 3)
        # Starting in the middle: 3 -> {2,4} -> 1 == 2 seconds.
        self.assertEqual(time_to_burn_tree(root, 3), 2)


if __name__ == "__main__":
    unittest.main()
