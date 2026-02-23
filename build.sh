#!/bin/bash

# Exit on error
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if environment parameter is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 staging"
    exit 1
fi

ENVIRONMENT=$1
WP_CONFIG="${SCRIPT_DIR}/../../../wp-config.php"

# Clean up on exit: remove copy folders; restore VITE_ENVIRONMENT for dev
cleanup_on_exit() {
  rm -rf "${SCRIPT_DIR}/../helpmate-build" "${SCRIPT_DIR}/../temp_zip"
  echo "VITE_ENVIRONMENT=dev" > "$SCRIPT_DIR/admin/app/.env"
  echo "VITE_ENVIRONMENT=dev" > "$SCRIPT_DIR/public/app/.env"
}
trap cleanup_on_exit EXIT

# Use the environment parameter to set URLs
case $ENVIRONMENT in
    "staging")
        API_SERVER_URL="https://staging-api.rhapsodyplugins.com"
        ;;
    "production")
        API_SERVER_URL="https://api.rhapsodyplugins.com"
        ;;
    "local")
        if [ ! -f "$WP_CONFIG" ] || ! grep -q "WP_HELPMATE_API_SERVER" "$WP_CONFIG" 2>/dev/null; then
            echo "Error: WP_HELPMATE_API_SERVER not found in $WP_CONFIG"
            exit 1
        fi
        API_SERVER_URL=$(grep "WP_HELPMATE_API_SERVER" "$WP_CONFIG" | sed -n 's/.*, *"\([^"]*\)".*/\1/p' | head -1)
        [ -z "$API_SERVER_URL" ] && echo "Error: Could not parse WP_HELPMATE_API_SERVER from $WP_CONFIG" && exit 1
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        echo "Supported environments: staging, production, local"
        exit 1
        ;;
esac

# Export for use in build process
export API_SERVER_URL

echo "Building for environment: $ENVIRONMENT"
echo "Api server URL: $API_SERVER_URL"

# Get plugin version from helpmate-ai-chatbot.php
PLUGIN_VERSION=$(grep "HELPMATE_VERSION" "$(dirname "$0")/helpmate-ai-chatbot.php" | sed -E "s/.*HELPMATE_VERSION', *'([^']+)'.*/\1/")

# Set zip name based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    ZIP_NAME="helpmate-$PLUGIN_VERSION.zip"
else
    ZIP_NAME="helpmate-$PLUGIN_VERSION-$ENVIRONMENT.zip"
fi

# Build first (validates code compiles), then typecheck, then copy (including dist)
echo "Building admin app (source)..."
cd admin/app
pnpm install --silent 2>/dev/null || pnpm install
echo "VITE_ENVIRONMENT=prod" > .env
pnpm build
cd ../..
echo "Building public app (source)..."
cd public/app
pnpm install --silent 2>/dev/null || pnpm install
echo "VITE_ENVIRONMENT=prod" > .env
pnpm build
cd ../..

echo "Type checking admin app..."
cd admin/app
pnpm run typecheck
cd ../..
echo "Type checking public app..."
cd public/app
pnpm run typecheck
cd ../..

# Create a new directory for the build
echo "Creating new build directory..."
rm -rf ../helpmate-build
mkdir -p ../helpmate-build

# Copy files excluding node_modules (portable: no rsync)
echo "Copying files..."
tar --exclude='node_modules' --exclude='.git' --exclude='.gitignore' --exclude='README.md' --exclude='.DS_Store' --exclude='build.sh' --exclude='composer.json' --exclude='composer.lock' -cf - . | (cd ../helpmate-build && tar xf -)

# Verify copy operation
if [ ! -d "../helpmate-build" ]; then
    echo "Error: Failed to create build directory"
    exit 1
fi

# Portable sed -i (macOS needs '' for no backup, GNU sed uses -i alone)
SED_INPLACE=(-i)
case "$(uname -s)" in
    Darwin) SED_INPLACE=(-i '');;
esac

# Update api server URLs based on environment (replace constant with actual URL so build is self-contained)
echo "Updating api server URLs for $ENVIRONMENT..."
cd ../helpmate-build
# Escape & and \ for sed replacement
API_SED="${API_SERVER_URL//\\/\\\\}"
API_SED="${API_SED//&/\\&}"
sed "${SED_INPLACE[@]}" "s|WP_HELPMATE_API_SERVER|'${API_SED}'|g" includes/class-helpmate-api.php

# Remove development-related code from display files
echo "Removing development code from display files..."
# Remove dev mode blocks from admin display (remove if-else-endif structure, keep production code)
sed "${SED_INPLACE[@]}" '/<?php if ($is_dev): ?>/,/<?php else: ?>/d' admin/partials/helpmate-admin-display.php
# Remove the final endif that closes the main if ($is_dev) block
sed "${SED_INPLACE[@]}" '$d' admin/partials/helpmate-admin-display.php
# Remove dev mode blocks from admin display (remove if-else-endif structure, keep production code)
sed "${SED_INPLACE[@]}" '/<?php if ($is_dev): ?>/,/<?php else: ?>/d' public/partials/helpmate-public-display.php
# Remove the final endif that closes the main if ($is_dev) block
sed "${SED_INPLACE[@]}" '$d' public/partials/helpmate-public-display.php

cd ../helpmate-build

# Use pre-built dist from copy; strip admin/app and public/app to dist only
echo "Stripping admin/app to dist only..."
cd admin/app
rm -f dist/index.html
sleep 2
for _ in 1 2 3; do find . -mindepth 1 -maxdepth 1 ! -name 'dist' -exec rm -rf {} + 2>/dev/null && break; sleep 3; done
[ ! -d node_modules ] || { echo "Error: Could not remove node_modules. Close IDE/terminals holding the dir and retry."; exit 1; }

echo "Stripping public/app to dist only..."
cd ../../public/app
rm -f dist/index.html
sleep 2
for _ in 1 2 3; do find . -mindepth 1 -maxdepth 1 ! -name 'dist' -exec rm -rf {} + 2>/dev/null && break; sleep 3; done
[ ! -d node_modules ] || { echo "Error: Could not remove node_modules. Close IDE/terminals holding the dir and retry."; exit 1; }

# Create zip file
echo "Creating zip file..."
cd ../../../
rm -rf "$ZIP_NAME" temp_zip
mkdir -p temp_zip
mv helpmate-build temp_zip/helpmate-ai-chatbot
cd temp_zip
if [ "$(uname -s)" = "Darwin" ]; then
  zip -r "$ZIP_NAME" helpmate-ai-chatbot -x "*.git*" "*.DS_Store"
  mv "$ZIP_NAME" ../
else
  # Prefer 7-Zip (WordPress-compatible zips); PowerShell's Compress-Archive can break on install
  SEVENZ=""
  if command -v 7z >/dev/null 2>&1; then
    SEVENZ="7z"
  elif [ -x "/c/Program Files/7-Zip/7z.exe" ]; then
    SEVENZ="/c/Program Files/7-Zip/7z.exe"
  elif [ -x "/c/Program Files (x86)/7-Zip/7z.exe" ]; then
    SEVENZ="/c/Program Files (x86)/7-Zip/7z.exe"
  fi
  if [ -n "$SEVENZ" ]; then
    echo "Creating zip with 7-Zip..."
    "$SEVENZ" a -tzip "../$ZIP_NAME" helpmate-ai-chatbot -xr!.git -x!*.DS_Store
  else
    echo "Creating zip with PowerShell (install 7-Zip for WordPress-compatible zips)..."
    powershell -NoProfile -Command "Compress-Archive -Path 'helpmate-ai-chatbot' -DestinationPath '../$ZIP_NAME' -Force"
  fi
fi
cd ..

# Remove dist from source so dev folders stay clean
echo "Removing dist from source..."
rm -rf "$SCRIPT_DIR/admin/app/dist" "$SCRIPT_DIR/public/app/dist"

echo "Build completed successfully!"