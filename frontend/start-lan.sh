#!/usr/bin/env bash

set -euo pipefail

BACKEND_PORT=8000
IP_ADDRESS=""

print_help() {
  echo "Usage:"
  echo "  ./start-lan.sh [--backend-port 8000] [--ip-address 192.168.1.23]"
}

is_private_ipv4() {
  local ip="$1"

  [[ "$ip" =~ ^10\. ]] && return 0
  [[ "$ip" =~ ^192\.168\. ]] && return 0
  [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && return 0

  return 1
}

is_ignored_interface() {
  local iface="$1"

  case "$iface" in
    lo|docker*|br-*|veth*|virbr*|podman*|tun*|tap*|wg*|tailscale*|zt*|ppp*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

get_lan_ipv4_address() {
  local dev
  local cidr
  local ip

  # 1. Сначала смотрим интерфейсы из default route,
  # но берём только приватные LAN-адреса.
  while read -r dev; do
    [[ -z "$dev" ]] && continue

    if is_ignored_interface "$dev"; then
      continue
    fi

    while read -r cidr; do
      ip="${cidr%/*}"

      if is_private_ipv4 "$ip"; then
        echo "$ip"
        return 0
      fi
    done < <(
      ip -o -4 addr show dev "$dev" scope global up 2>/dev/null |
        awk '{print $4}'
    )
  done < <(
    ip -4 route show default 2>/dev/null |
      awk '
        {
          dev = "";
          metric = 999999;

          for (i = 1; i <= NF; i++) {
            if ($i == "dev") {
              dev = $(i + 1);
            }

            if ($i == "metric") {
              metric = $(i + 1);
            }
          }

          if (dev != "") {
            print metric, dev;
          }
        }
      ' |
      sort -n |
      awk '{print $2}'
  )

  # 2. Fallback: ищем любой активный приватный IPv4
  # на нормальном сетевом интерфейсе.
  while read -r dev cidr; do
    [[ -z "$dev" || -z "$cidr" ]] && continue

    if is_ignored_interface "$dev"; then
      continue
    fi

    ip="${cidr%/*}"

    if is_private_ipv4 "$ip"; then
      echo "$ip"
      return 0
    fi
  done < <(
    ip -o -4 addr show scope global up 2>/dev/null |
      awk '{print $2, $4}'
  )

  echo "Could not detect a LAN IPv4 address. Pass it manually: ./start-lan.sh --ip-address 192.168.1.23" >&2
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-port|-p)
      BACKEND_PORT="${2:?Missing value for --backend-port}"
      shift 2
      ;;
    --ip-address|-i)
      IP_ADDRESS="${2:?Missing value for --ip-address}"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

CLIENT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [[ -z "$IP_ADDRESS" ]]; then
  DETECTED_IP="$(get_lan_ipv4_address)"
else
  DETECTED_IP="$IP_ADDRESS"
fi

export EXPO_PUBLIC_API_URL="http://${DETECTED_IP}:${BACKEND_PORT}"

echo "EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"
echo "Starting Expo with cleared cache..."

pushd "$CLIENT_DIR" >/dev/null
trap 'popd >/dev/null' EXIT

npx expo start -c