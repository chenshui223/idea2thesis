from pathlib import Path
import subprocess


def test_dev_script_check_mode() -> None:
    root_dir = Path(__file__).resolve().parents[2]
    script_path = root_dir / "scripts" / "dev.sh"
    result = subprocess.run(
        ["bash", str(script_path), "--check"],
        cwd=root_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "Environment check passed." in result.stdout
    assert "worker" not in result.stderr.lower()
