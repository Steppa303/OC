import argparse
import json
import requests
from bs4 import BeautifulSoup
import hashlib
import random
import time
from urllib.parse import quote

# User-Agents to rotate
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15"
]

# Anna's Archive mirrors - fallback if one is down
MIRRORS = [
    "https://annas-archive.gl",
    "https://annas-archive.li",
    "https://annas-archive.pm",
    "https://annas-archive.org"
]

def get_random_user_agent():
    return random.choice(USER_AGENTS)

def search_anna_archive(query, lang="de", ext="epub", page=1):
    """Search Anna's Archive for books"""
    headers = {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    params = {
        "q": query,
        "page": page
    }
    # Only add filters if they have values
    if lang:
        params["lang"] = lang
    if ext:
        params["ext"] = ext
    
    # Try mirrors until one works
    last_error = None
    for mirror in MIRRORS:
        try:
            url = f"{mirror}/search"
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            return parse_search_results(response.text)
        except Exception as e:
            last_error = e
            time.sleep(1)  # Be polite
            continue
    
    raise Exception(f"All mirrors failed: {last_error}")

def parse_search_results(html):
    """Parse HTML search results from Anna's Archive"""
    soup = BeautifulSoup(html, "lxml")
    results = []
    seen_md5 = set()
    
    # Find all result containers
    for container in soup.select('div.flex.pt-3.pb-3'):
        try:
            # Extract MD5 from link
            md5 = None
            link = container.select_one('a[href*="/md5/"]')
            if link:
                href = link.get('href', '')
                parts = href.split('/')
                if len(parts) >= 3:
                    md5 = parts[2]
            
            # Skip duplicates or null md5
            if not md5 or md5 in seen_md5:
                continue
            seen_md5.add(md5)
            
            # Extract title from the js-vim-focus link
            title_el = container.select_one('a.js-vim-focus')
            title = title_el.get_text(strip=True) if title_el else 'Unknown Title'
            
            # Extract author from search link
            author_el = container.select_one('a[href*="/search?q="]')
            author = author_el.get_text(strip=True) if author_el else 'Unknown Author'
            # Clean up author (remove icon text)
            if author != 'Unknown Author':
                author = author.replace('\u200b', '').strip()
            
            # Extract metadata line (format, size, language, year)
            meta_el = container.select_one('div.text-gray-800')
            meta_text = meta_el.get_text(strip=True) if meta_el else ''
            
            # Parse format, size, language from metadata text
            # Example: "✅ English [en] · PDF · 6.4MB · 2016 · 📘 Book (non-fiction)"
            format_ = 'Unknown'
            size = 'Unknown'
            language = 'Unknown'
            year = ''
            
            if meta_text:
                parts = [p.strip() for p in meta_text.split('·')]
                for p in parts:
                    p_lower = p.lower()
                    # Language: "English [en]" or "Deutsch [de]"
                    if '[' in p and ']' in p and len(p) < 30:
                        lang_match = p.split('[')
                        if len(lang_match) >= 2:
                            language = lang_match[1].split(']')[0]
                    # Format: EPUB, PDF, MOBI, etc.
                    elif p_lower in ('epub', 'pdf', 'mobi', 'azw3', 'fb2', 'djvu'):
                        format_ = p.upper()
                    # Size: "6.4mb", "1.2gb"
                    elif any(u in p_lower for u in ['mb', 'gb', 'kb']) and any(c.isdigit() for c in p):
                        size = p.upper().replace(' ', '')
                    # Year: 4-digit number
                    elif len(p) == 4 and p.isdigit():
                        year = p
            
            # Extract cover URL
            cover = container.select_one('img[src*="covers"]')
            cover_url = cover.get('src') if cover else None
            
            # Extract description (if present)
            desc_el = container.select_one('div.line-clamp-5')
            description = desc_el.get_text(strip=True) if desc_el and desc_el.get_text(strip=True) else None
            
            results.append({
                'md5': md5,
                'title': title,
                'author': author,
                'format': format_,
                'size': size,
                'language': language,
                'coverUrl': cover_url,
                'description': description or meta_text,
                'year': year
            })
        except Exception as e:
            print(f'Error parsing result item: {e}')
            continue
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Search Anna's Archive")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--lang", default="de", help="Language filter")
    parser.add_argument("--ext", default="epub", help="File extension filter")
    parser.add_argument("--page", default="1", help="Page number")
    
    args = parser.parse_args()
    
    try:
        results = search_anna_archive(
            query=args.query,
            lang=args.lang,
            ext=args.ext,
            page=args.page
        )
        print(json.dumps(results, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        exit(1)

if __name__ == "__main__":
    main()