#!/usr/bin/env bash
# Run only against a task-owned app with fresh storage; settings are replaced.
set -euo pipefail
: "${PLUGIN_REPO:?}" "${PLUGIN_REF:?}" "${PLUGIN_SHA:?}"
base=${DECAID_URL:-http://127.0.0.1:8080}
mock_one=${E64_MOCK_ONE_URL:-http://127.0.0.1:9997}
mock_two=${E64_MOCK_TWO_URL:-http://127.0.0.1:9998}
plugin=mahlkoenig-e64.reaplugin
one="plugin:$plugin:e64:one"
two="plugin:$plugin:e64:two"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

request() {
  local method=$1 path=$2 expected=$3 data=${4-} status
  local args=(--silent --show-error --max-time 20 -X "$method" -o "$scratch/response" -w '%{http_code}')
  if [[ -n "$data" ]]; then args+=(-H 'content-type: application/json' --data "$data"); fi
  status=$(curl "${args[@]}" "$base$path")
  if [[ ! "$status" =~ ^($expected)$ ]]; then
    printf 'FAIL: %s %s returned %s (expected %s)\n' "$method" "$path" "$status" "$expected" >&2
    cat "$scratch/response" >&2
    return 1
  fi
}
assert_json() { jq -e "$1" "$scratch/response" >/dev/null; }
assert_redacted() {
  if [[ $(<"$scratch/response") == *token-one* || $(<"$scratch/response") == *token-two* || $(<"$scratch/response") == *incorrect-fixture-token* ]]; then
    printf 'FAIL: public response exposed a test credential\n' >&2
    return 1
  fi
}
poll_json() {
  local path=$1 predicate=$2
  for ((attempt=0; attempt<100; attempt++)); do
    if curl -fs --max-time 2 "$base$path" -o "$scratch/response" && jq -e "$predicate" "$scratch/response" >/dev/null; then return; fi
    sleep 0.1
  done
  printf 'FAIL: timed out waiting for %s: %s\n' "$path" "$predicate" >&2
  cat "$scratch/response" >&2
  return 1
}
poll_unavailable() {
  local path=$1 status
  for ((attempt=0; attempt<100; attempt++)); do
    status=$(curl -sS --max-time 2 -o "$scratch/response" -w '%{http_code}' "$base$path")
    if [[ "$status" == 503 ]]; then assert_redacted; return; fi
    sleep 0.1
  done
  printf 'FAIL: %s remained available after teardown\n' "$path" >&2
  return 1
}
control() { curl --fail --silent --show-error -X POST "$1/control" -H 'content-type: application/json' --data "$2" >/dev/null; }
connect_device() { request PUT /api/v1/devices/connect 200 "$(jq -cn --arg id "$1" '{deviceId:$id}')"; }

printf 'Checking installer and secure settings\n'
request POST /api/v1/plugins/install/github-branch 200 "$(jq -cn --arg repo "$PLUGIN_REPO" --arg branch "$PLUGIN_REF" '{repo:$repo,branch:$branch}')"
assert_json '.id == "mahlkoenig-e64.reaplugin"'
request GET /api/v1/plugins 200
jq -e --arg sha "$PLUGIN_SHA" '.[] | select(.id == "mahlkoenig-e64.reaplugin") | .source.commit == $sha' "$scratch/response" >/dev/null
settings=$(jq -cn '{InstancesJson:([{id:"one",name:"Mock One",scheme:"ws",host:"127.0.0.1",port:9997,pollMs:100},{id:"two",name:"Mock Two",scheme:"ws",host:"127.0.0.1",port:9998,pollMs:100}]|tojson),TokensJson:({one:"token-one",two:"token-two"}|tojson)}')
request POST "/api/v1/plugins/$plugin/settings" 200 "$settings"
assert_json '.TokensJson.isSet == true'
assert_redacted
request GET "/api/v1/plugins/$plugin/settings" 200
assert_json '.TokensJson.isSet == true'
assert_redacted
request POST "/api/v1/plugins/$plugin/enable" 200
request GET '/api/v1/devices/scan?connect=false' 200
jq -e --arg one "$one" --arg two "$two" '[.[] | select(.id == $one or .id == $two)] | length == 2' "$scratch/response" >/dev/null

printf 'Checking state publication, diagnostics and read-only controls\n'
control "$mock_one" '{"state":"idle"}'
connect_device "$one"
poll_json /api/v1/grinder/info '.deviceId == "plugin:mahlkoenig-e64.reaplugin:e64:one" and .capabilities == []'
poll_json /api/v1/grinder/state '.state == "idle"'
for state in grinding error unknown idle; do
  control "$mock_one" "$(jq -cn --arg state "$state" '{state:$state}')"
  poll_json /api/v1/grinder/state ".state == \"$state\""
done
for read in machineInfo config logs; do
  request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=$read" 200
  case "$read" in
    machineInfo) assert_json '.serial == "MOCK-one"';;
    config) assert_json '.mode == "mock" and .grindSize == 64';;
    logs) assert_json '.messages == ["mock one ready"]';;
  esac
  assert_redacted
done
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=startMotor" 400
for action in grinding idle; do
  request PUT "/api/v1/grinder/state/$action" 500
  assert_json '.code == "unsupported_operation"'
done
request PUT /api/v1/grinder/setting 500 '{"setting":"1"}'
assert_json '.code == "unsupported_operation"'
request PUT /api/v1/grinder/rpm 500 '{"rpm":800}'
assert_json '.code == "unsupported_operation"'

printf 'Checking selection isolation and disconnect/reconnect\n'
control "$mock_two" '{"state":"error"}'
connect_device "$two"
poll_json /api/v1/grinder/info '.deviceId == "plugin:mahlkoenig-e64.reaplugin:e64:two"'
poll_json /api/v1/grinder/state '.state == "error"'
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$two&read=machineInfo" 200
assert_json '.serial == "MOCK-two"'
control "$mock_one" '{"state":"grinding"}'
poll_json /api/v1/grinder/state '.state == "error"'
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=config" 503
assert_redacted
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "grinding"'
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one" 200
assert_json '.state.grinder == "one" and (has("machineInfo") | not) and (has("config") | not) and (has("logs") | not)'
control "$mock_one" '{"action":"close"}'
poll_unavailable /api/v1/grinder/state
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=config" 503
control "$mock_one" '{"state":"idle"}'
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "idle"'
control "$mock_one" '{"action":"malformed"}'
poll_unavailable /api/v1/grinder/state
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "idle"'

printf 'Checking authentication and timeout error surfacing\n'
request PUT /api/v1/devices/disconnect 200 "$(jq -cn --arg id "$one" '{deviceId:$id}')"
request POST "/api/v1/plugins/$plugin/settings" 200 '{"TokensJson":"{\"one\":\"incorrect-fixture-token\",\"two\":\"token-two\"}"}'
assert_redacted
request GET '/api/v1/devices/scan?connect=false' 200
request PUT /api/v1/devices/connect 503 "$(jq -cn --arg id "$one" '{deviceId:$id}')"
assert_json '.outcome == "failed" and .connectionError.kind == "grinderConnectFailed"'
assert_redacted
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=config" 503
request POST "/api/v1/plugins/$plugin/settings" 200 "$(jq -cn '{TokensJson:({one:"token-one",two:"token-two"}|tojson)}')"
assert_redacted
request GET '/api/v1/devices/scan?connect=false' 200
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "idle"'
control "$mock_one" '{"dropReplies":true}'
request GET "/api/v1/plugins/$plugin/e64-diagnostics?deviceId=$one&read=config" 503
assert_redacted
poll_unavailable /api/v1/grinder/state
control "$mock_one" '{"dropReplies":false}'
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "idle"'

printf 'Checking settings reload and unload cleanup\n'
request POST "/api/v1/plugins/$plugin/settings" 200 '{"TokensJson":{"isSet":true}}'
assert_json '.TokensJson.isSet == true'
assert_redacted
poll_unavailable /api/v1/grinder/state
request GET '/api/v1/devices/scan?connect=false' 200
jq -e --arg one "$one" --arg two "$two" '[.[] | select(.id == $one or .id == $two)] | length == 2' "$scratch/response" >/dev/null
connect_device "$two"
poll_json /api/v1/grinder/state '.state == "error"'
request POST "/api/v1/plugins/$plugin/disable" 200
poll_unavailable /api/v1/grinder/state
request GET '/api/v1/devices/scan?connect=false' 200
jq -e --arg one "$one" --arg two "$two" '[.[] | select(.id == $one or .id == $two)] | length == 0' "$scratch/response" >/dev/null
request GET "/api/v1/plugins/$plugin/settings" 200
assert_json '.TokensJson.isSet == true'
assert_redacted
request POST "/api/v1/plugins/$plugin/enable" 200
request GET '/api/v1/devices/scan?connect=false' 200
connect_device "$one"
poll_json /api/v1/grinder/state '.state == "idle"'
for mock in "$mock_one" "$mock_two"; do
  curl --fail --silent --show-error "$mock/health" | jq -e '.commands | keys | all(. == "RequestDriverState" or . == "RequestDriverConfig" or . == "RequestNachineInfo" or . == "RequestLogMessages")' >/dev/null
done
printf 'PASS: E64 hardware-free app scenarios\n'
