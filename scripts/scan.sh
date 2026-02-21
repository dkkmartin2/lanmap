#!/bin/sh

# Dependency-free LANMAP scanner
# Requires: find, sort, stat, date, gzip, base64, sha256sum, grep, sed, tr, awk

set -eu

ROOT="$(pwd)"
HOST_LABEL="$(hostname 2>/dev/null || printf 'unknown-host')"
HOST_ADDRESS="127.0.0.1"

usage() {
  cat <<USAGE
Usage: ./scripts/scan.sh [--root PATH] [--label LABEL] [--address ADDRESS]

Produces a one-line compressed payload:
  LANMAP1:gzip-base64:<payload>

Example:
  ./scripts/scan.sh --label kali-box --address 192.168.1.77
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    --label)
      HOST_LABEL="$2"
      shift 2
      ;;
    --address)
      HOST_ADDRESS="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ ! -d "$ROOT" ]; then
  echo "Root path does not exist: $ROOT" >&2
  exit 1
fi

json_escape_stream() {
  sed -e ':a' -e 'N' -e '$!ba' \
      -e 's/\\/\\\\/g' \
      -e 's/"/\\"/g' \
      -e 's/\t/\\t/g' \
      -e 's/\r/\\r/g' \
      -e 's/\n/\\n/g'
}

json_escape_value() {
  printf '%s' "$1" | json_escape_stream
}

lower_ext() {
  name="$1"
  case "$name" in
    *.*)
      ext="${name##*.}"
      printf '%s' "$ext" | tr '[:upper:]' '[:lower:]'
      ;;
    *)
      printf ''
      ;;
  esac
}

is_text_extension() {
  ext="$1"
  case "$ext" in
    txt|md|rst|log|ini|conf|toml|yaml|yml|json|xml|csv|tsv|sql|py|c|h|cpp|hpp|cc|cxx|js|jsx|ts|tsx|html|htm|css|scss|sass|less|java|kt|kts|go|rs|php|rb|pl|sh|bash|zsh|fish|ps1|swift|cs|scala|lua|dart|vue|svelte|gradle|properties)
      return 0
      ;;
    dockerfile|makefile)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_hidden_path() {
  path="$1"
  old_ifs="$IFS"
  IFS='/'
  # shellcheck disable=SC2086
  set -- $path
  IFS="$old_ifs"

  for segment in "$@"; do
    case "$segment" in
      .*)
        return 0
        ;;
    esac
  done

  return 1
}

iso_mtime() {
  item="$1"
  epoch="$(stat -c '%Y' "$item")"
  date -u -d "@$epoch" '+%Y-%m-%dT%H:%M:%SZ'
}

TMP_JSON="$(mktemp)"
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_JSON" "$TMP_LIST"' EXIT INT TERM

ROOT_ABS="$(cd "$ROOT" && pwd)"
RUN_PATH_ABS="$(pwd)"
RUN_PARENT_ABS="$(cd "$RUN_PATH_ABS/.." && pwd)"
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

{
  printf '{"version":"1","generatedAt":"%s","rootPath":"%s","runPath":"%s","runParentPath":"%s","host":{"label":"%s","address":"%s"},"entries":[' \
    "$(json_escape_value "$NOW_ISO")" \
    "$(json_escape_value "$ROOT_ABS")" \
    "$(json_escape_value "$RUN_PATH_ABS")" \
    "$(json_escape_value "$RUN_PARENT_ABS")" \
    "$(json_escape_value "$HOST_LABEL")" \
    "$(json_escape_value "$HOST_ADDRESS")"

  first=1

  find "$ROOT_ABS" -mindepth 1 -print | LC_ALL=C sort > "$TMP_LIST"

  while IFS= read -r item; do
    rel="${item#"$ROOT_ABS"/}"

    if [ "$item" = "$ROOT_ABS" ] || [ -z "$rel" ]; then
      continue
    fi

    name="$(basename "$item")"
    type="file"
    if [ -d "$item" ]; then
      type="dir"
    fi

    hidden="false"
    if is_hidden_path "$rel"; then
      hidden="true"
    fi

    size="null"
    mtime="$(iso_mtime "$item")"
    content_type="none"
    content="null"
    sha="null"

    if [ "$type" = "file" ]; then
      size="$(stat -c '%s' "$item" 2>/dev/null || printf '0')"
      sha_value="$(sha256sum "$item" 2>/dev/null | awk '{print $1}')"

      ext="$(lower_ext "$name")"
      if [ -r "$item" ] && (is_text_extension "$ext" || grep -Iq . "$item" 2>/dev/null); then
        content_type="text"
        escaped_content="$(json_escape_stream < "$item" 2>/dev/null || printf '')"
        content="\"$escaped_content\""
      else
        content_type="binary"
      fi

      if [ -n "$sha_value" ]; then
        sha="\"$(json_escape_value "$sha_value")\""
      fi
    fi

    if [ "$first" -eq 0 ]; then
      printf ','
    fi
    first=0

    printf '{"path":"%s","name":"%s","type":"%s","size":%s,"mtime":"%s","isHidden":%s,"contentType":"%s","content":%s,"sha256":%s}' \
      "$(json_escape_value "$rel")" \
      "$(json_escape_value "$name")" \
      "$type" \
      "$size" \
      "$(json_escape_value "$mtime")" \
      "$hidden" \
      "$content_type" \
      "$content" \
      "$sha"
  done < "$TMP_LIST"

  printf ']}'
} > "$TMP_JSON"

ENCODED="$(gzip -c "$TMP_JSON" | base64 | tr -d '\n')"
printf 'LANMAP1:gzip-base64:%s\n' "$ENCODED"
