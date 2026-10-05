from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fcc_local import CONFIG_VALUES, _LEGACY_CONFIG_VALUES, provision, sanitized_environment


class FCCLocalTests(unittest.TestCase):
    def test_provision_is_private_exact_and_repeatable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "fcc"
            secrets = iter(("x" * 48, "y" * 48))
            first = provision(root, secrets_factory=lambda: next(secrets))
            second = provision(root, secrets_factory=lambda: "y" * 48)
            self.assertEqual(first, second)
            values = dict(line.split("=", 1) for line in first.env_path.read_text().splitlines())
            self.assertEqual(values["ANTHROPIC_AUTH_TOKEN"], "x" * 48)
            self.assertEqual(values, CONFIG_VALUES | {"ANTHROPIC_AUTH_TOKEN": "x" * 48})
            self.assertEqual(first.dashboard_path.read_text(), "y" * 48)

    def test_provision_rejects_partial_or_unexpected_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.mkdir(exist_ok=True)
            (root / ".env").write_text("FCC_CONFIG_SCHEMA=1\n")
            with self.assertRaises(ValueError):
                provision(root)

    def test_provision_migrates_only_the_previous_exact_bounded_profile(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.mkdir(exist_ok=True)
            (root / ".env").write_text("".join(f"{key}={value}\n" for key, value in (_LEGACY_CONFIG_VALUES | {"ANTHROPIC_AUTH_TOKEN": "x" * 48}).items()))
            (root / "dashboard-secret.txt").write_text("y" * 48)
            provision(root)
            values = dict(line.split("=", 1) for line in (root / ".env").read_text().splitlines())
            self.assertEqual(values, CONFIG_VALUES | {"ANTHROPIC_AUTH_TOKEN": "x" * 48})
            (root / "dashboard-secret.txt").write_text("x" * 48)
            with self.assertRaises(ValueError):
                provision(root)

    def test_sanitized_environment_keeps_windows_necessities_not_provider_keys(self) -> None:
        child = sanitized_environment(
            {
                "PATH": "C:\\Windows",
                "SYSTEMROOT": "C:\\Windows",
                "USERPROFILE": "C:\\Users\\astha",
                "HOME": "C:\\Users\\astha",
                "ANTHROPIC_AUTH_TOKEN": "secret",
                "OPENROUTER_API_KEY": "secret",
                "FCC_ENV_FILE": "secret",
            },
            Path("D:/Yellow/runtime/free-claude-code/source"),
        )
        self.assertEqual(child["USERPROFILE"], "C:\\Users\\astha")
        self.assertEqual(child["HOME"], "C:\\Users\\astha")
        self.assertEqual(child["PYTHONPATH"], "D:\\Yellow\\runtime\\free-claude-code\\source\\src")
        self.assertFalse({"ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "FCC_ENV_FILE"} & child.keys())


if __name__ == "__main__":
    unittest.main()
