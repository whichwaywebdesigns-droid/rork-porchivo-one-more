#!/usr/bin/env python3
"""Batch-migrate raw console.log/warn/error calls to the production-safe logger.

Replaces console.log -> log, console.warn -> warn, console.error -> error,
and adds the appropriate import from '@/lib/logger' if not already present.
Handles relative paths for files outside lib/ (e.g. utils/invite.ts).
"""
import re
import sys
from pathlib import Path

# Map of method -> import name
METHODS = {
    "console.log": "log",
    "console.warn": "warn",
    "console.error": "error",
}

def get_import_path(file_path: Path) -> str:
    """Determine the correct import path for logger based on file location."""
    parts = file_path.parts
    if parts and parts[0] == "lib":
        return "./logger"
    if parts and parts[0] == "utils":
        return "../lib/logger"
    if parts and parts[0] == "store":
        return "../lib/logger"
    if parts and parts[0] == "mocks":
        return "../lib/logger"
    if parts and parts[0] == "components":
        return "../lib/logger"
    if parts and parts[0] == "providers":
        return "../lib/logger"
    if parts and parts[0] == "hooks":
        return "../lib/logger"
    # app/ and app/(tabs)/...
    return "@/lib/logger"

def migrate(file_path: Path) -> tuple[bool, str]:
    content = file_path.read_text(encoding="utf-8")
    original = content
    methods_found: set[str] = set()

    # Replace console.log -> log, console.warn -> warn, console.error -> error
    for console_meth, logger_name in METHODS.items():
        if console_meth in content:
            content = content.replace(console_meth, logger_name)
            methods_found.add(logger_name)

    if not methods_found:
        return False, "no console calls found"

    # Check if logger is already imported
    has_logger_import = bool(
        re.search(r"""from ['"](?:\.\./)*lib/logger['"]|from ['"]@/lib/logger['"]""", content)
    )

    if not has_logger_import:
        import_path = get_import_path(file_path)
        names = ", ".join(sorted(methods_found))
        import_line = f'import {{ {names} }} from "{import_path}";'

        # Try to insert after the last import statement
        import_pattern = re.compile(
            r'''^(import\s+.*?;$|import\s+.*?from\s+['"][^'"]+['"];?$)''',
            re.MULTILINE,
        )
        matches = list(import_pattern.finditer(content))
        if matches:
            last_import = matches[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "\n" + import_line + content[insert_pos:]
        else:
            # No imports — prepend
            content = import_line + "\n" + content

    if content != original:
        file_path.write_text(content, encoding="utf-8")
        return True, f"migrated ({', '.join(sorted(methods_found))})"

    return False, "no changes needed"

def main() -> int:
    import subprocess
    # Get list of files
    result = subprocess.run(
        ["grep", "-rl", r"console\.\(log\|warn\|error\)",
         "--include=*.ts", "--include=*.tsx", "."],
        capture_output=True, text=True, cwd="expo",
    )
    files = [
        Path("expo") / f.strip()
        for f in result.stdout.strip().split("\n")
        if f.strip() and "node_modules" not in f and "lib/logger.ts" not in f
    ]

    migrated = 0
    skipped = 0
    for fp in sorted(files):
        ok, msg = migrate(fp)
        status = "OK  " if ok else "SKIP"
        if ok:
            migrated += 1
        else:
            skipped += 1
        print(f"  {status} {fp} — {msg}")

    print(f"\nMigrated: {migrated}  Skipped: {skipped}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
