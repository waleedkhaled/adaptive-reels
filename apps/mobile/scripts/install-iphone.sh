#!/usr/bin/env bash
# Build a signed Release app and install it on the iPhone connected by cable.
# Needs Xcode 26.4 or newer (Expo SDK 57 uses Swift 6.3), signed in to your
# Apple ID (Xcode > Settings > Accounts). The reel library URL and reel set
# come from apps/mobile/.env.local and are fixed into the build.
# Usage (repo root): bash apps/mobile/scripts/install-iphone.sh
set -euo pipefail
cd "$(dirname "$0")/.."

swift="$(xcrun swift --version 2>&1 | sed -nE 's/.*Swift version ([0-9]+\.[0-9]+).*/\1/p' | head -1)"
if [ "$(printf '%s\n6.3\n' "$swift" | sort -V | head -1)" != "6.3" ]; then
  echo "This Mac has $(xcodebuild -version | head -1) (Swift $swift). Expo SDK 57 needs Xcode 26.4 or newer: update Xcode in the App Store first." >&2
  exit 1
fi

json="$(mktemp)"
xcrun devicectl list devices --json-output "$json" >/dev/null
read -r device udid < <(python3 - "$json" <<'EOF'
import json, sys
devices = json.load(open(sys.argv[1]))["result"]["devices"]
for d in devices:
    hw = d.get("hardwareProperties", {})
    if hw.get("platform") == "iOS" and d.get("connectionProperties", {}).get("pairingState") == "paired":
        print(d["identifier"], hw["udid"])
        break
EOF
)
rm -f "$json"
if [ -z "${device:-}" ]; then
  echo "No paired iPhone found. Connect it by cable, unlock it and tap Trust." >&2
  exit 1
fi

team="$(node -p "require('./app.json').expo.ios.appleTeamId")"
bundle="$(node -p "require('./app.json').expo.ios.bundleIdentifier")"
# ios/ is generated from app.json; after changing app.json run: npx expo prebuild --platform ios --clean
[ -d ios ] || CI=1 npx expo prebuild --platform ios

export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
xcodebuild -workspace ios/AdaptiveReels.xcworkspace -scheme AdaptiveReels -configuration Release \
  -destination "id=$udid" -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$team" CODE_SIGN_STYLE=Automatic -derivedDataPath ios/build/dd -quiet build
xcrun devicectl device install app --device "$device" ios/build/dd/Build/Products/Release-iphoneos/AdaptiveReels.app
# The first launch of a Personal Team build needs: Settings > General > VPN & Device Management > Trust.
xcrun devicectl device process launch --device "$device" "$bundle" ||
  echo "Installed. If it did not open: on the iPhone, Settings > General > VPN & Device Management > trust the developer, then open Adaptive Reels."
