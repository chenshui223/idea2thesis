from idea2thesis import __version__


def test_backend_package_exposes_version() -> None:
    assert __version__ == "0.1.0"
