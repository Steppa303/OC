#!/usr/bin/env python3
"""
recipe_pdf.py – Generate a Kindle Scribe-friendly PDF from recipe data.

Uses WeasyPrint for rendering.
Layout: large font, clean typography, Zutaten + Schritt-für-Schritt.
Images embedded if available.
"""

import json
import base64
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from weasyprint import HTML

log = logging.getLogger("recipe_pdf")

CSS = """
@page {
    size: A5;
    margin: 1.2cm 1.5cm 1.2cm 1.5cm;
    @top-center {
        content: "";
    }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14pt;
    line-height: 1.6;
    color: #111;
}

/* Cover page */
.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 4cm;
}
.cover h1 {
    font-size: 26pt;
    font-weight: bold;
    margin-bottom: 8px;
    line-height: 1.3;
}
.cover .meta {
    font-size: 13pt;
    color: #555;
    margin-top: 12px;
}
.cover .rating-badge {
    margin-top: 20px;
    font-size: 16pt;
    color: #b8860b;
}
.cover .source {
    margin-top: 16px;
    font-size: 11pt;
    color: #777;
}

/* Recipe header */
.recipe-header {
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #111;
}
.recipe-header h2 {
    font-size: 20pt;
    font-weight: bold;
    margin-bottom: 4px;
}
.recipe-header .recipe-meta {
    font-size: 12pt;
    color: #555;
}

/* Image */
.recipe-image {
    max-width: 100%;
    max-height: 300px;
    margin: 12px auto;
    display: block;
    object-fit: contain;
}

/* Zutaten */
.ingredients-box {
    background: #f5f5f5;
    padding: 14px 18px;
    margin: 12px 0 16px 0;
    border-left: 4px solid #111;
}
.ingredients-box h3 {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 8px;
}
.ingredients-box ul {
    list-style: none;
    padding: 0;
}
.ingredients-box ul li {
    padding: 2px 0;
    font-size: 13pt;
}
.ingredients-box ul li::before {
    content: "• ";
    color: #111;
}

/* Instructions */
.instructions h3 {
    font-size: 14pt;
    font-weight: bold;
    margin: 16px 0 8px 0;
}
.instructions ol {
    padding-left: 24px;
}
.instructions ol li {
    margin-bottom: 8px;
    font-size: 13pt;
    padding-left: 4px;
}
.instructions ol li::marker {
    font-weight: bold;
}

/* Page break between recipes */
.recipe-break {
    page-break-before: always;
}

.info-note {
    font-size: 11pt;
    color: #888;
    margin-top: 20px;
    text-align: center;
    font-style: italic;
}
"""


def _embed_image_as_base64(image_url: str) -> Optional[str]:
    """Download image and return as data: URI, or None."""
    if not image_url:
        return None
    import requests
    try:
        r = requests.get(image_url, timeout=10,
                         headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        ctype = r.headers.get("Content-Type", "image/jpeg")
        b64 = base64.b64encode(r.content).decode()
        return f"data:{ctype};base64,{b64}"
    except Exception as e:
        log.debug("Image fetch failed: %s", e)
        return None


def _render_recipe(recipe: Dict, show_header: bool = True) -> str:
    """Render a single recipe to HTML fragment."""
    parts = []

    # Separator for non-first recipes
    if not show_header:
        parts.append('<div class="recipe-break"></div>')

    parts.append('<div class="recipe-header"><h2>%s</h2>' % recipe.get("title", "Unbekanntes Rezept"))

    meta_parts = []
    if recipe.get("yield"):
        meta_parts.append(f"🧑‍🍳 {recipe['yield']}")
    if recipe.get("total_time"):
        meta_parts.append(f"⏱️ {recipe['total_time']}")
    if recipe.get("prep_time"):
        meta_parts.append(f"Prep: {recipe['prep_time']}")
    if recipe.get("cook_time"):
        meta_parts.append(f"Kochzeit: {recipe['cook_time']}")

    if meta_parts:
        parts.append('<div class="recipe-meta">%s</div>' % " · ".join(meta_parts))
    parts.append('</div>')

    # Image
    img_data = _embed_image_as_base64(recipe.get("image", ""))
    if img_data:
        parts.append('<img class="recipe-image" src="%s" alt="%s" />' % (
            img_data, recipe.get("title", "")))

    # Ingredients
    ings = recipe.get("ingredients", [])
    if ings:
        parts.append('<div class="ingredients-box">')
        parts.append('<h3>Zutaten</h3>')
        parts.append('<ul>')
        for ing in ings:
            parts.append(f'<li>{ing}</li>')
        parts.append('</ul></div>')

    # Instructions
    instrs = recipe.get("instructions", [])
    if instrs:
        parts.append('<div class="instructions">')
        parts.append('<h3>Zubereitung</h3>')
        parts.append('<ol>')
        for step in instrs:
            parts.append(f'<li>{step}</li>')
        parts.append('</ol></div>')

    # Rating badge
    rating = recipe.get("rating", 0)
    source = recipe.get("source_domain", "")
    parts.append('<div class="info-note">★ %.1f · %s</div>' % (rating, source))

    return "\n".join(parts)


def generate_pdf(recipes: List[Dict], output_path: str) -> str:
    """
    Generate a PDF from recipes, return the output path.

    First recipe has a cover page.
    """
    if not recipes:
        raise ValueError("No recipes to generate PDF from")

    # Cover
    n = len(recipes)
    main_title = recipes[0]["title"] if n == 1 else f"{n} Rezepte"
    rating_avg = sum(r.get("rating", 0) for r in recipes) / n if n else 0
    rating_avg = round(rating_avg, 1)

    cover_html = f"""
    <div class="cover">
        <h1>{main_title}</h1>
        <div class="meta">{n} Rezept{n if n == 1 else 'e'} · ⌀ {rating_avg} ★</div>
        <div class="rating-badge">All recipes rated ≥ 4.2 / 5</div>
    </div>
    """

    # Recipes
    recipe_htmls = []
    for i, r in enumerate(recipes):
        recipe_htmls.append(_render_recipe(r, show_header=True))

    full_html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>{CSS}</style>
</head>
<body>
{cover_html}
{"".join(recipe_htmls)}
</body>
</html>"""

    # Render with WeasyPrint
    HTML(string=full_html).write_pdf(output_path)
    size = Path(output_path).stat().st_size
    log.info("PDF generated: %s (%d bytes, %d recipes)", output_path, size, len(recipes))
    return output_path


def main():
    """CLI for testing."""
    import argparse, sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Generate recipe PDF")
    parser.add_argument("--input", required=True, help="JSON file with recipe list")
    parser.add_argument("--output", required=True, help="Output PDF path")

    args = parser.parse_args()

    with open(args.input) as f:
        recipes = json.load(f)

    if not isinstance(recipes, list):
        recipes = [recipes]

    generate_pdf(recipes, args.output)
    print(json.dumps({"path": args.output, "count": len(recipes)}))


if __name__ == "__main__":
    main()