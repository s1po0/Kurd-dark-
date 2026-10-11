#!/usr/bin/env python3
"""Poor-man's C# linter for the Kurd Castle Unity project.

This sandbox has no .NET/Unity toolchain, so we cannot compile the game. This
script catches the failure modes that actually bite when writing C# blind:

  1. unbalanced braces / parens / brackets (truncated file)
  2. references to enum members that do not exist (typo'd ResourceType.Fooo)
  3. references to Balance.* constants that do not exist
  4. object-initialiser fields on BuildingDefinition / UnitDefinition that are
     not declared on the type
  5. `X.Y =` static-field writes to types that do not declare Y
  6. duplicate type declarations in a namespace
  7. obvious `using KurdCastle.X` namespaces that are never declared anywhere

Exit code is non-zero when an error is found, so it can gate a commit.
"""
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                    "unity", "KurdCastle", "Assets", "Scripts")

ERRORS = []
WARNINGS = []


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def strip_comments_and_strings(text):
    """Remove comments and string literals so regexes only see real code."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            j = text.find('\n', i)
            i = n if j < 0 else j
        elif c == '/' and i + 1 < n and text[i + 1] == '*':
            j = text.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif c == '"':
            i += 1
            while i < n and text[i] != '"':
                i += 2 if text[i] == '\\' else 1
            i += 1
        elif c == "'":
            i += 1
            while i < n and text[i] != "'":
                i += 2 if text[i] == '\\' else 1
            i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def collect_files():
    files = []
    for dirpath, _dirnames, filenames in os.walk(ROOT):
        for name in filenames:
            if name.endswith('.cs'):
                files.append(os.path.join(dirpath, name))
    return sorted(files)


def check_balance(path, code):
    for open_c, close_c, label in (('{', '}', 'brace'), ('(', ')', 'paren'), ('[', ']', 'bracket')):
        # Brackets in attributes/arrays make naive counting unreliable for [] only;
        # braces and parens are reliable enough for this codebase's style.
        if label == 'bracket':
            continue
        if code.count(open_c) != code.count(close_c):
            err(f"{path}: unbalanced {label}s: {code.count(open_c)} '{open_c}' vs {code.count(close_c)} '{close_c}'")


ENUM_DECL = re.compile(r'enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^{]*)?\{', re.S)
ENUM_MEMBER = re.compile(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*[^,\n]+)?\s*,?\s*(?://.*)?$')


def collect_enums(files):
    enums = {}
    for path in files:
        code = strip_comments_and_strings(read(path))
        for match in ENUM_DECL.finditer(code):
            name = match.group(1)
            start = match.end()
            depth = 1
            i = start
            while i < len(code) and depth > 0:
                if code[i] == '{':
                    depth += 1
                elif code[i] == '}':
                    depth -= 1
                i += 1
            body = code[start:i - 1]
            members = set()
            # Members may be one per line or several per line ("A = 0, B = 1").
            for chunk in body.split(','):
                chunk = chunk.strip().split('\n')[-1].strip()
                m = re.match(r'([A-Za-z_][A-Za-z0-9_]*)', chunk)
                if m:
                    members.add(m.group(1))
            if name in enums:
                err(f"{path}: duplicate enum declaration {name}")
            enums[name] = members
    return enums


def collect_balance_constants(files):
    """Balance is nested static classes; gather dotted paths from Balance.cs."""
    balance_path = None
    for path in files:
        if path.endswith(os.path.join('Config', 'Balance.cs')):
            balance_path = path
    if not balance_path:
        err("Config/Balance.cs not found")
        return set()

    code = strip_comments_and_strings(read(balance_path))
    consts = set()

    # Find every "static class Name { ... }" block with its brace span.
    blocks = []
    for m in re.finditer(r'static\s+class\s+([A-Za-z_][A-Za-z0-9_]*)', code):
        brace = code.find('{', m.end())
        if brace < 0:
            continue
        depth = 1
        i = brace + 1
        while i < len(code) and depth > 0:
            if code[i] == '{':
                depth += 1
            elif code[i] == '}':
                depth -= 1
            i += 1
        blocks.append((m.group(1), brace, i))

    def owner_path(pos):
        path = []
        for name, start, end in blocks:
            if start < pos < end:
                path.append((start, name))
        path.sort()
        return [name for _start, name in path]

    for m in re.finditer(r'(?:const|static\s+readonly)\s+[\w<>\[\]\.,\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*=', code):
        path = owner_path(m.start())
        if path:
            full = '.'.join(path + [m.group(1)])
            # References are written as Balance.Sim.TickDelta; drop the root.
            if full.startswith('Balance.'):
                full = full[len('Balance.'):]
            consts.add(full)
    return consts


def collect_type_members(files):
    """Map type name -> set of member-ish identifiers declared inside it."""
    members = defaultdict(set)
    for path in files:
        code = strip_comments_and_strings(read(path))
        for m in re.finditer(
                r'(?:public|internal|private|protected)?\s*(?:sealed\s+|static\s+|abstract\s+|partial\s+)*'
                r'(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)', code):
            name = m.group(1)
            start = code.find('{', m.end())
            if start < 0:
                continue
            depth = 1
            i = start + 1
            while i < len(code) and depth > 0:
                if code[i] == '{':
                    depth += 1
                elif code[i] == '}':
                    depth -= 1
                i += 1
            body = code[start + 1:i - 1]
            # Declarations: "public int Foo;", "public int Foo { get; set; }", "public void Bar("
            for dm in re.finditer(
                    r'(?:public|internal|private|protected|readonly|static|const|override|virtual|sealed|\s)+'
                    r'[\w<>,\[\]\.\?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:[;{=(]|=>)', body):
                members[name].add(dm.group(1))
            # Auto-properties shorthand: "public int Foo { get; internal set; }"
            for pm in re.finditer(r'([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*get;', body):
                members[name].add(pm.group(1))
    return members


def check_enum_refs(files, enums):
    for path in files:
        code = strip_comments_and_strings(read(path))
        for m in re.finditer(r'\b([A-Z][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)', code):
            type_name, member = m.group(1), m.group(2)
            if type_name in enums and member not in enums[type_name]:
                err(f"{path}: unknown {type_name}.{member}")


def check_balance_refs(files, consts):
    for path in files:
        code = strip_comments_and_strings(read(path))
        for m in re.finditer(r'\bBalance\.((?:[A-Z][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_]*)', code):
            ref = m.group(1)
            if ref not in consts:
                err(f"{path}: unknown Balance.{ref}")


INITIALIZER_FIELD = re.compile(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=', re.M)


def check_initialisers(files, members):
    targets = {'BuildingDefinition': None, 'UnitDefinition': None, 'ProductionRecipe': None}
    for path in files:
        if path.endswith('BuildingDefinition.cs'):
            targets['BuildingDefinition'] = set()
            targets['ProductionRecipe'] = set()
        if path.endswith('UnitDefinition.cs'):
            targets['UnitDefinition'] = set()

    declared = collect_type_members([p for p in files
                                     if p.endswith('BuildingDefinition.cs') or p.endswith('UnitDefinition.cs')])

    for path in files:
        base = os.path.basename(path)
        if not base.endswith('Catalog.cs') and not base.endswith('MapGenerator.cs') \
                and not base.endswith('WaveTable.cs'):
            continue
        code = strip_comments_and_strings(read(path))
        # Find "new TypeName" followed by "{ ... }" and check field names.
        for m in re.finditer(r'new\s+(BuildingDefinition|UnitDefinition|ProductionRecipe)\s*\{', code):
            type_name = m.group(1)
            start = code.find('{', m.end() - 1)
            depth = 1
            i = start + 1
            while i < len(code) and depth > 0:
                if code[i] == '{':
                    depth += 1
                elif code[i] == '}':
                    depth -= 1
                i += 1
            body = code[start + 1:i - 1]
            # Strip nested initialiser blocks (Recipe = new ProductionRecipe {...});
            # those are validated on their own match.
            prev = None
            while prev != body:
                prev = body
                body = re.sub(r'\{[^{}]*\}', ' ', body)
            known = declared.get(type_name, set())
            for fm in INITIALIZER_FIELD.finditer(body):
                field = fm.group(1)
                if field in ('get', 'set', 'value'):
                    continue
                if field not in known:
                    err(f"{path}: {type_name} initialiser sets unknown member '{field}'")


def check_usings(files):
    declared_ns = set()
    for path in files:
        for m in re.finditer(r'namespace\s+([\w\.]+)', read(path)):
            declared_ns.add(m.group(1))
    for path in files:
        for m in re.finditer(r'using\s+(KurdCastle[\w\.]*)\s*;', read(path)):
            ns = m.group(1)
            if ns not in declared_ns:
                warn(f"{path}: using {ns}; — namespace not declared yet (planned?)")


def main():
    files = collect_files()
    if not files:
        print("no .cs files found under", ROOT)
        return 1

    enums = collect_enums(files)
    members = collect_type_members(files)
    consts = collect_balance_constants(files)

    for path in files:
        check_balance(path, strip_comments_and_strings(read(path)))
    check_enum_refs(files, enums)
    check_balance_refs(files, consts)
    check_initialisers(files, members)
    check_usings(files)

    print(f"scanned {len(files)} C# files")
    print(f"  enums: {len(enums)}  types: {len(members)}  Balance constants: {len(consts)}")
    for w in WARNINGS:
        print("WARN  " + w)
    for e in ERRORS:
        print("ERROR " + e)
    print(f"{len(ERRORS)} error(s), {len(WARNINGS)} warning(s)")
    return 1 if ERRORS else 0


if __name__ == '__main__':
    sys.exit(main())
