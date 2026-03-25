from pathlib import Path
import subprocess


def test_bootstrap_script_dry_run_prints_expected_setup_steps() -> None:
    root_dir = Path(__file__).resolve().parents[2]
    script_path = root_dir / "scripts" / "bootstrap.sh"
    result = subprocess.run(
        ["bash", str(script_path), "--dry-run"],
        cwd=root_dir,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "python3 -m venv" in result.stdout
    assert 'pip install -e ".[dev]"' in result.stdout
    assert "npm install" in result.stdout
