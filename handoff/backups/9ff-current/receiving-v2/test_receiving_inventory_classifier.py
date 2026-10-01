import unittest

from receiving_inventory_classifier import (
    BASE_COMMIT, BASE_TREE, CLOUD_COMMIT, CLOUD_TREE,
    InventoryError, classify_inventory,
)


def blob(ch, mode="100644"):
    return {"observed": True, "git_blob": ch * 40, "sha256": ch * 64, "mode": mode}


def absent():
    return {"observed": True, "git_blob": None, "sha256": None, "mode": None}


def unknown(mode=None):
    return {"observed": False, "git_blob": None, "sha256": None, "mode": mode}


def unknown_mode(ch):
    return {"observed": True, "git_blob": ch * 40, "sha256": ch * 64, "mode": None}


def document(rows):
    return {"source_ids": {"base_commit": BASE_COMMIT, "base_tree": BASE_TREE,
                           "cloud_commit": CLOUD_COMMIT, "cloud_tree": CLOUD_TREE},
            "paths": rows}


class ReceivingClassifierTests(unittest.TestCase):
    def test_cloud_addition_applies_only_when_laptop_observably_absent(self):
        row = {"path": "src/new.ts", "base": absent(), "cloud": blob("a"), "laptop": absent()}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual((result["classification"], result["cloud_change"], result["may_apply"]),
                         ("cloud_only_guarded_apply", "addition", True))

    def test_cloud_deletion_is_guarded_by_exact_existing_laptop_preimage(self):
        row = {"path": "src/gone.ts", "base": blob("b"), "cloud": absent(), "laptop": blob("b")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual((result["classification"], result["cloud_change"], result["may_apply"]),
                         ("cloud_only_guarded_apply", "deletion", True))

    def test_both_sides_diverged_requires_manual_hunks(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b"), "laptop": blob("c")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "diverged_manual_hunks")
        self.assertFalse(result["may_apply"])

    def test_unchanged_shared_blob_is_never_overwritten(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("a"), "laptop": blob("a")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "shared_same_no_overwrite")
        self.assertEqual(result["cloud_change"], "unchanged")
        self.assertFalse(result["may_apply"])

    def test_laptop_only_change_is_preserved(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("a"), "laptop": blob("c")}
        self.assertEqual(classify_inventory(document([row]))["paths"][0]["classification"],
                         "laptop_only_preserve")

    def test_absent_laptop_metadata_record_is_unobserved(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "laptop_unobserved")
        self.assertFalse(result["may_apply"])

    def test_explicit_null_laptop_record_is_invalid_not_missing(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b"), "laptop": None}
        with self.assertRaises(InventoryError):
            classify_inventory(document([row]))

    def test_present_but_unobserved_laptop_blob_stays_unobserved_even_for_shared_cloud(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("a"), "laptop": unknown()}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "laptop_unobserved")
        self.assertFalse(result["may_apply"])

    def test_unknown_base_or_cloud_change_is_unknown_and_cannot_apply(self):
        row = {"path": "src/x.ts", "base": unknown(), "cloud": blob("b"), "laptop": blob("a")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual((result["classification"], result["cloud_change"], result["may_apply"]),
                         ("unknown_preimage_cannot_apply", "unknown", False))
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": unknown(), "laptop": blob("a")}
        self.assertEqual(classify_inventory(document([row]))["paths"][0]["cloud_change"], "unknown")

    def test_unknown_present_mode_cannot_authorize_any_preimage(self):
        row = {"path": "src/x.ts", "base": unknown_mode("a"), "cloud": blob("b"), "laptop": blob("a")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual((result["classification"], result["cloud_change"], result["may_apply"]),
                         ("unknown_preimage_cannot_apply", "unknown", False))

    def test_rejects_wrong_source_ids_and_malformed_identity(self):
        d = document([])
        d["source_ids"]["cloud_commit"] = "0" * 40
        with self.assertRaises(InventoryError):
            classify_inventory(d)
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("z"), "laptop": blob("a")}
        row["cloud"]["sha256"] = "not-a-hash"
        with self.assertRaises(InventoryError):
            classify_inventory(document([row]))

    def test_mode_only_change_is_not_shared_and_exact_preimage_is_required(self):
        row = {"path": "src/script", "base": blob("a", "100644"),
               "cloud": blob("a", "100755"), "laptop": blob("a", "100644")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual((result["classification"], result["cloud_change"], result["may_apply"]),
                         ("cloud_only_guarded_apply", "mode_change", True))
        row["laptop"] = blob("a", "100755")
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "already_same_no_overwrite")
        self.assertFalse(result["may_apply"])

    def test_divergent_mode_cannot_masquerade_as_exact_cloud_preimage(self):
        row = {"path": "src/script", "base": blob("a", "100644"),
               "cloud": blob("b", "100755"), "laptop": blob("a", "100755")}
        result = classify_inventory(document([row]))["paths"][0]
        self.assertEqual(result["classification"], "diverged_manual_hunks")
        self.assertFalse(result["may_apply"])

    def test_rejects_unsupported_symlink_modes(self):
        row = {"path": "src/link", "base": blob("a", "120000"),
               "cloud": blob("b"), "laptop": blob("a")}
        with self.assertRaisesRegex(InventoryError, "symlinks and submodules"):
            classify_inventory(document([row]))

    def test_unknown_or_absent_mode_must_be_null(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b"), "laptop": unknown("100644")}
        with self.assertRaises(InventoryError):
            classify_inventory(document([row]))
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b"), "laptop": blob("a")}
        row["cloud"]["mode"] = []
        with self.assertRaises(InventoryError):
            classify_inventory(document([row]))
        row = {"path": "src/x.ts", "base": absent(), "cloud": blob("b"), "laptop": absent()}
        row["base"]["mode"] = "100644"
        with self.assertRaises(InventoryError):
            classify_inventory(document([row]))

    def test_rejects_rooted_traversal_noncanonical_and_del_paths(self):
        for path in ("/tmp/x", "../secret", "src/../secret", "C:/secret", "src//x", "src\\x", "src/\x7f.ts"):
            row = {"path": path, "base": blob("a"), "cloud": blob("b"), "laptop": blob("a")}
            with self.subTest(path=path), self.assertRaises(InventoryError):
                classify_inventory(document([row]))

    def test_rejects_windows_case_colliding_paths(self):
        rows = [
            {"path": "Src/Routes.ts", "base": blob("a"), "cloud": blob("a"), "laptop": blob("a")},
            {"path": "src/routes.ts", "base": blob("a"), "cloud": blob("a"), "laptop": blob("a")},
        ]
        with self.assertRaisesRegex(InventoryError, "Windows case-colliding"):
            classify_inventory(document(rows))

    def test_rejects_duplicate_path_and_wrong_input_types(self):
        row = {"path": "src/x.ts", "base": blob("a"), "cloud": blob("b"), "laptop": blob("a")}
        with self.assertRaises(InventoryError):
            classify_inventory(document([row, row]))
        with self.assertRaises(InventoryError):
            classify_inventory(document({"path": row}))


if __name__ == "__main__":
    unittest.main()
