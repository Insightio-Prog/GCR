#!/usr/bin/env python3
"""Validate a .gcr.json file and print an ASCII picture of the grid.

Usage: python3 check_recipe.py recipe.gcr.json
Exit code 1 if there are errors (warnings don't fail).
"""
import json
import sys

UNITS = {"", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "floz", "pinch",
         "clove", "slice", "can", "tin", "bunch", "sprig", "stick", "knob", "handful",
         "packet", "pack", "shot", "dash", "splash", "stalk", "head", "sheet", "fillet", "rasher"}


def placement(ings, steps):
    n = max(len(ings), 1)
    out, prev = [], None
    for i, s in enumerate(steps):
        own = [u for u in s.get("uses", []) if isinstance(u, int) and 0 <= u < len(ings)]
        if own:
            start, end = min(own), max(own)
            if s.get("carry") and prev:
                start, end = min(start, prev["start"]), max(end, prev["end"])
        elif prev:
            start, end = prev["start"], prev["end"]
        else:
            start, end = 0, n - 1
        col = 0
        for p in out:
            if p["start"] <= end and start <= p["end"]:
                col = max(col, p["col"] + 1)
        prev = {"i": i, "start": start, "end": end, "col": col}
        out.append(prev)
    return out


def check(r, k):
    errs, warns = [], []
    t = r.get("title") or f"recipe {k + 1}"
    if not r.get("title"):
        errs.append("missing title")
    ings, steps = r.get("ingredients", []), r.get("steps", [])
    if not ings:
        errs.append("no ingredients")
    for i, g in enumerate(ings):
        if not isinstance(g, dict) or not str(g.get("name", "")).strip():
            errs.append(f"ingredient {i} has no name")
            continue
        q = g.get("qty")
        if q is not None and not isinstance(q, (int, float)):
            errs.append(f"ingredient {i} ({g['name']}): qty must be a number or null, got {q!r}")
        if g.get("unit", "") not in UNITS:
            warns.append(f"ingredient {i} ({g['name']}): unknown unit {g.get('unit')!r} (shown as typed)")
        if q is not None and g.get("unit", "") == "" and isinstance(q, (int, float)) and q <= 0:
            errs.append(f"ingredient {i} ({g['name']}): qty must be above 0")
        alt = g.get("alt")
        if alt is not None and (not isinstance(alt.get("qty"), (int, float)) or alt.get("unit", "") not in UNITS):
            errs.append(f"ingredient {i} ({g['name']}): bad alt {alt!r}")
    if not steps:
        warns.append("no steps (only the ingredient list will show)")
    used = set()
    for i, s in enumerate(steps):
        if not str(s.get("text", "")).strip():
            errs.append(f"step {i + 1} has no text")
        for u in s.get("uses", []):
            if not isinstance(u, int) or not 0 <= u < len(ings):
                errs.append(f"step {i + 1} ({s.get('text')!r}): uses index {u!r} is out of range 0-{len(ings) - 1}")
            else:
                used.add(u)
    for i, g in enumerate(ings):
        if i not in used and isinstance(g, dict):
            warns.append(f"ingredient {i} ({g.get('name')}) is not used by any step")
    place = placement(ings, steps)
    for p, s in zip(place, steps):
        own = {u for u in s.get("uses", []) if isinstance(u, int) and 0 <= u < len(ings)}
        if own and not s.get("carry"):
            gaps = [i for i in range(min(own), max(own) + 1) if i not in own]
            if gaps:
                names = ", ".join(str(ings[i].get("name")) for i in gaps)
                warns.append(f"step {p['i'] + 1} ({s.get('text')!r}) also covers rows it doesn't use: {names}. "
                             "Reorder ingredients so a step's ingredients sit together.")
    return t, errs, warns, place


def ascii_grid(ings, steps, place):
    ncols = max((p["col"] for p in place), default=-1) + 1
    namew = min(34, max([len(str(g.get("name", ""))) for g in ings] + [10]))
    cw = 12
    lines = []
    for r, g in enumerate(ings):
        label = f"{g.get('qty', '')} {g.get('unit', '')} {g.get('name', '')}".replace("  ", " ").strip()[:namew + 12]
        cells = []
        for c in range(ncols):
            cell = " " * cw
            for p in place:
                if p["col"] == c and p["start"] <= r <= p["end"]:
                    txt = str(steps[p["i"]]["text"]).split("\n")[0]
                    cell = (txt[:cw - 2].ljust(cw) if r == p["start"] else "│".ljust(cw))
            cells.append(cell)
        lines.append(f"{label:<{namew + 12}} | " + " ".join(cells))
    return "\n".join(lines)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    try:
        data = json.load(open(sys.argv[1], encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: not valid JSON: {e}")
        return 1
    recipes = data if isinstance(data, list) else data.get("recipes") or ([data] if isinstance(data, dict) and "ingredients" in data else [])
    if not recipes:
        print("ERROR: no recipes found")
        return 1
    bad = False
    for k, r in enumerate(recipes):
        t, errs, warns, place = check(r, k)
        print(f"== {t}: {len(r.get('ingredients', []))} ingredients, {len(r.get('steps', []))} steps")
        for e in errs:
            print("  ERROR:", e)
        for w in warns:
            print("  warning:", w)
        if not errs:
            print(ascii_grid(r.get("ingredients", []), r.get("steps", []), place))
        bad = bad or bool(errs)
        print()
    print("FAILED" if bad else "OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
