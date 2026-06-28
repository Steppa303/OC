#!/usr/bin/env bash
# Anna's Archive EPUB download via Libgen mirror
# Usage: ./anna-browser-download.sh <MD5> <OUTPUT_PATH>
#
# Strategy: Anna's Archive search gives us MD5s, but downloads are blocked
# by DDoS-Guard / fast_download_not_member. Libgen has the same files
# and serves them directly. Fallback: try the Libgen CDN directly.

set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: $0 <MD5> <OUTPUT_PATH>"
    exit 1
fi

MD5="$1"
OUTPUT_PATH="$2"

TMP_FILE=$(mktemp /tmp/anna-dl-XXXXXX.epub)
trap 'rm -f "$TMP_FILE"' EXIT

download_from_libgen() {
    echo "Fetching download link from Libgen for MD5: $MD5" >&2

    local ads_url="https://libgen.li/ads.php?md5=${MD5}"
    local get_link
    get_link=$(curl -sS --max-time 15 "$ads_url" 2>/dev/null \
        | grep -o 'get\.php?md5=[^"&]*&key=[A-Z0-9]*' | head -1)

    if [[ -z "$get_link" ]]; then
        echo "No download link found on Libgen" >&2
        return 1
    fi

    local download_url="https://libgen.li/${get_link}"
    echo "Download URL: $download_url" >&2

    local http_code
    http_code=$(curl -sS -L --max-time 120 \
        -w '%{http_code}' \
        -o "$TMP_FILE" \
        "$download_url" 2>&1)

    if [[ "$http_code" != "200" ]]; then
        echo "Download failed with HTTP $http_code" >&2
        return 1
    fi

    return 0
}

download_from_libgen_fallback() {
    # Try Libgen CDN directly with common patterns
    echo "Trying Libgen CDN fallback..." >&2
    local cdn_urls=(
        "https://cdn2.booksdl.lc/get.php?md5=${MD5}"
        "https://cdn1.booksdl.lc/get.php?md5=${MD5}"
        "https://libgen.li/get.php?md5=${MD5}"
    )

    for url in "${cdn_urls[@]}"; do
        echo "Trying: $url" >&2
        local http_code
        http_code=$(curl -sS -L --max-time 60 \
            -w '%{http_code}' \
            -o "$TMP_FILE" \
            "$url" 2>&1) || continue

        if [[ "$http_code" == "200" ]]; then
            local magic
            magic=$(dd if="$TMP_FILE" bs=1 count=4 2>/dev/null | xxd -p)
            if [[ "$magic" == "504b0304" ]]; then
                return 0
            fi
        fi
        rm -f "$TMP_FILE"
    done

    return 1
}

# Try primary method (Libgen ads page)
if ! download_from_libgen; then
    echo "Primary download failed, trying fallback..." >&2
    if ! download_from_libgen_fallback; then
        echo "All download methods failed for MD5: $MD5" >&2
        exit 1
    fi
fi

# Verify it's a real EPUB (magic bytes: PK\x03\x04)
MAGIC=$(dd if="$TMP_FILE" bs=1 count=4 2>/dev/null | xxd -p)
if [[ "$MAGIC" != "504b0304" ]]; then
    echo "Downloaded file is not a valid EPUB (magic: $MAGIC), trying fallback..." >&2
    rm -f "$TMP_FILE"
    if ! download_from_libgen_fallback; then
        echo "All download methods failed for MD5: $MD5" >&2
        exit 1
    fi
    # Re-check magic bytes
    MAGIC=$(dd if="$TMP_FILE" bs=1 count=4 2>/dev/null | xxd -p)
    if [[ "$MAGIC" != "504b0304" ]]; then
        echo "Downloaded file is still not a valid EPUB (magic: $MAGIC)" >&2
        exit 1
    fi
fi

# Move to final location
mv "$TMP_FILE" "$OUTPUT_PATH"
trap - EXIT

FILESIZE=$(stat -c%s "$OUTPUT_PATH" 2>/dev/null || stat -f%z "$OUTPUT_PATH" 2>/dev/null)
echo "Successfully downloaded EPUB to $OUTPUT_PATH ($FILESIZE bytes)" >&2

# Output JSON progress for server.js compatibility
echo '{"type":"done","path":"'"$OUTPUT_PATH"'","size":'"$FILESIZE"'}'
