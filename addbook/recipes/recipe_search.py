#!/usr/bin/env python3
"""
recipe_search.py – International recipe search with rating filtering.

Strategy:
  1. ddgs (DuckDuckGo) search for recipe URLs (broad, international)
  2. Fetch each page, extract schema.org/Recipe JSON-LD
  3. Filter by aggregateRating.ratingValue >= 4.2/5
  4. Return top N unique recipes

Dedup: caller passes list of already-used URLs, skipped automatically.
"""

import json
import re
import time
import logging
from typing import List, Dict, Optional, Set
from urllib.parse import urlparse
from ddgs import DDGS
import requests
from bs4 import BeautifulSoup

log = logging.getLogger("recipe_search")

MIN_RATING = 4.2
MAX_RESULTS_PER_QUERY = 15
MAX_FETCH_ATTEMPTS = 20

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
]


def strip_html(text):
    if not text:
        return ""
    return BeautifulSoup(str(text), "html.parser").get_text(strip=True)


def _fetch_page(url: str) -> Optional[str]:
    headers = {
        "User-Agent": USER_AGENTS[hash(url) % len(USER_AGENTS)],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    try:
        r = requests.get(url, headers=headers, timeout=25)
        r.raise_for_status()
        return r.text
    except Exception as e:
        log.debug("Fetch failed for %s: %s", url, e)
        return None


def _extract_jsonld(html: str) -> Optional[Dict]:
    soup = BeautifulSoup(html, "lxml")
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string) if script.string else {}
            items = data
            if isinstance(data, dict) and "@graph" in data:
                items = data["@graph"]
            elif not isinstance(data, list):
                items = [data]

            for item in items:
                if not isinstance(item, dict):
                    continue
                types = item.get("@type")
                if not types:
                    continue
                if isinstance(types, str):
                    types = [types]
                if "Recipe" in types:
                    return item
        except (json.JSONDecodeError, AttributeError):
            continue
    return None


def _normalize_rating(item: Dict) -> Optional[float]:
    agg = item.get("aggregateRating") or {}
    if not isinstance(agg, dict):
        return None
    try:
        val = float(agg.get("ratingValue", 0))
        best = float(agg.get("bestRating", 5) or 5)
        worst = float(agg.get("worstRating", 0) or 0)
    except (ValueError, TypeError):
        return None
    if val == 0:
        return None
    if best != 5:
        val = (val - worst) / (best - worst) * 5.0
    return round(val, 1)


def _extract_instructions(item: Dict) -> List[str]:
    instr = item.get("recipeInstructions") or []
    result = []
    for step in instr:
        if isinstance(step, str):
            result.append(strip_html(step))
        elif isinstance(step, dict):
            text = step.get("text") or step.get("name") or ""
            if text:
                result.append(strip_html(text))
    return result


def _extract_ingredients(item: Dict) -> List[str]:
    ings = item.get("recipeIngredient") or item.get("ingredients") or []
    return [strip_html(i) for i in ings if isinstance(i, str) and i.strip()]


def _extract_image(item: Dict) -> Optional[str]:
    img = item.get("image")
    if isinstance(img, str):
        return img
    if isinstance(img, list):
        for i in img:
            if isinstance(i, str):
                return i
            if isinstance(i, dict):
                return i.get("url") or i.get("contentUrl") or ""
    if isinstance(img, dict):
        return img.get("url") or img.get("contentUrl") or ""
    return None


def parse_recipe_page(html: str, url: str) -> Optional[Dict]:
    """Parse a page and return normalized recipe data, or None."""
    item = _extract_jsonld(html)
    if not item:
        return None

    rating = _normalize_rating(item)
    if rating is None or rating < MIN_RATING:
        return None

    title = strip_html(item.get("name", ""))
    if not title:
        return None

    agg = item.get("aggregateRating") or {}
    try:
        rating_count = int(agg.get("ratingCount", 0) or 0)
    except (ValueError, TypeError):
        rating_count = 0

    return {
        "title": title,
        "url": url,
        "rating": rating,
        "rating_count": rating_count,
        "image": _extract_image(item) or "",
        "ingredients": _extract_ingredients(item),
        "instructions": _extract_instructions(item),
        "prep_time": item.get("prepTime", ""),
        "cook_time": item.get("cookTime", ""),
        "total_time": item.get("totalTime", ""),
        "yield": strip_html(item.get("recipeYield", "") or ""),
        "source_domain": urlparse(url).netloc,
    }


def search_recipes(query: str, count: int = 3, exclude_urls: Set[str] = None) -> List[Dict]:
    """
    Search for recipes matching query, filtered by rating >= 4.2.
    Returns list of recipe dicts, sorted by rating descending.
    """
    if exclude_urls is None:
        exclude_urls = set()

    raw_urls = []
    try:
        with DDGS() as ddgs:
            ddg_results = list(ddgs.text(
                f"{query} recipe",
                max_results=MAX_RESULTS_PER_QUERY,
                region="wt-wt",
            ))
            raw_urls = [r["href"] for r in ddg_results if "href" in r]
    except Exception as e:
        log.warning("DDGS search failed: %s", e)
        time.sleep(2)
        try:
            with DDGS() as ddgs:
                ddg_results = list(ddgs.text(f"{query} recipe", max_results=10, region="wt-wt"))
                raw_urls = [r["href"] for r in ddg_results if "href" in r]
        except Exception as e2:
            log.error("DDGS retry failed: %s", e2)
            return []

    skip_domains = {
        "facebook.com", "instagram.com", "pinterest.com",
        "youtube.com", "youtu.be", "tiktok.com", "x.com",
        "twitter.com", "reddit.com",
    }
    urls = []
    for u in raw_urls:
        domain = urlparse(u).netloc.lower().removeprefix("www.")
        if domain in skip_domains:
            continue
        if u in exclude_urls:
            continue
        if u not in urls:
            urls.append(u)

    if not urls:
        return []

    recipes = []
    for i, url in enumerate(urls[:MAX_FETCH_ATTEMPTS]):
        log.debug("Fetching [%d/%d]: %s", i + 1, min(len(urls), MAX_FETCH_ATTEMPTS), url)
        html = _fetch_page(url)
        if not html:
            continue
        recipe = parse_recipe_page(html, url)
        if recipe:
            recipes.append(recipe)
            log.info("Found: %.1f* %s -- %s", recipe["rating"], recipe["title"], url)
        if len(recipes) >= count * 2:
            break
        time.sleep(0.5)

    recipes.sort(key=lambda r: (-r["rating"], -r["rating_count"]))
    return recipes[:count]


def main():
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Search recipes with rating filter")
    parser.add_argument("--query", required=True, help="Recipe search query")
    parser.add_argument("--count", type=int, default=3)
    parser.add_argument("--exclude", nargs="*", default=[])

    args = parser.parse_args()
    results = search_recipes(args.query, args.count, set(args.exclude))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()