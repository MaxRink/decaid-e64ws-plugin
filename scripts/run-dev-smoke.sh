#!/usr/bin/env bash
set -euo pipefail
: "${PLUGIN_REPO:?}" "${PLUGIN_REF:?}" "${PLUGIN_SHA:?}"
base=http://127.0.0.1:8080
install=$(curl --fail -sS -X POST "$base/api/v1/plugins/install/github-branch" -H 'content-type: application/json' --data "{\"repo\":\"$PLUGIN_REPO\",\"branch\":\"$PLUGIN_REF\"}")
test "$(printf '%s' "$install" | jq -r .id)" = mahlkoenig-e64.reaplugin
source=$(curl --fail -sS "$base/api/v1/plugins")
test "$(printf '%s' "$source" | jq -r '.[] | select(.id == "mahlkoenig-e64.reaplugin") | .source.commit')" = "$PLUGIN_SHA"
settings='{"InstancesJson":"[{\"id\":\"one\",\"name\":\"Mock One\",\"scheme\":\"ws\",\"host\":\"127.0.0.1\",\"port\":9997,\"pollMs\":100},{\"id\":\"two\",\"name\":\"Mock Two\",\"scheme\":\"ws\",\"host\":\"127.0.0.1\",\"port\":9998,\"pollMs\":100}]","TokensJson":"{\"one\":\"token-one\",\"two\":\"token-two\"}"}'
curl --fail -sS -X POST "$base/api/v1/plugins/mahlkoenig-e64.reaplugin/settings" -H 'content-type: application/json' --data "$settings" >/dev/null
curl --fail -sS -X POST "$base/api/v1/plugins/mahlkoenig-e64.reaplugin/enable" >/dev/null
devices=$(curl --fail -sS "$base/api/v1/devices")
id=$(printf '%s' "$devices" | jq -r '.[] | select(.id | contains("plugin:mahlkoenig-e64.reaplugin:e64:one")) | .id' | head -1)
test -n "$id"
curl --fail -sS -X PUT "$base/api/v1/devices/connect" -H 'content-type: application/json' --data "{\"deviceId\":\"$id\"}" >/dev/null
for read in machineInfo config logs; do curl --fail -sS "$base/api/v1/plugins/mahlkoenig-e64.reaplugin/e64-diagnostics?deviceId=$id&read=$read" | jq -e 'type == "object"' >/dev/null; done
curl --fail -sS -X POST http://127.0.0.1:9997/control -H 'content-type: application/json' --data '{"state":"grinding"}' >/dev/null
curl --fail -sS -X POST http://127.0.0.1:9997/control -H 'content-type: application/json' --data '{"action":"close"}' >/dev/null
sleep 2
curl --fail -sS -X PUT "$base/api/v1/devices/connect" -H 'content-type: application/json' --data "{\"deviceId\":\"$id\"}" >/dev/null
