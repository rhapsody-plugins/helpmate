#!/bin/bash

# Exit on error
set -e

# Check if environment parameter is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 staging"
    exit 1
fi

ENVIRONMENT=$1

# ... existing code ...

# Use the environment parameter to set URLs
case $ENVIRONMENT in
    "staging")
        LICENSE_SERVER_URL="https://staging-license.rhapsodyplugins.com"
        ;;
    "production")
        LICENSE_SERVER_URL="https://license.rhapsodyplugins.com"
        ;;
    "local")
        LICENSE_SERVER_URL="http://localhost:10024"
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        echo "Supported environments: staging, production, local"
        exit 1
        ;;
esac

# Export for use in build process
export LICENSE_SERVER_URL

echo "Building for environment: $ENVIRONMENT"
echo "License server URL: $LICENSE_SERVER_URL"

# Get plugin version from helpmate.php
PLUGIN_VERSION=$(grep "HELPMATE_VERSION" "$(dirname "$0")/helpmate.php" | sed -E "s/.*HELPMATE_VERSION', *'([^']+)'.*/\1/")

# Set zip name based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    ZIP_NAME="helpmate-$PLUGIN_VERSION.zip"
else
    ZIP_NAME="helpmate-$PLUGIN_VERSION-$ENVIRONMENT.zip"
fi

# Create a new directory for the build
echo "Creating new build directory..."
rm -rf ../helpmate-build
mkdir -p ../helpmate-build

# Copy files excluding node_modules
echo "Copying files..."
rsync -av --progress . ../helpmate-build/ --exclude 'node_modules' --exclude '.git' --exclude '.gitignore' --exclude 'README.md' --exclude '.DS_Store' --exclude 'build.sh' --exclude 'composer.json' --exclude 'composer.lock'

# Verify copy operation
if [ ! -d "../helpmate-build" ]; then
    echo "Error: Failed to create build directory"
    exit 1
fi

# Update license server URLs based on environment
echo "Updating license server URLs for $ENVIRONMENT..."
cd ../helpmate-build
sed -i '' "s|http://localhost:10024|$LICENSE_SERVER_URL|g" includes/class-helpmate-license.php

# Remove development-related code from display files
echo "Removing development code from display files..."
# Remove dev mode blocks from admin display (remove if-else-endif structure, keep production code)
sed -i '' '/<?php if ($is_dev): ?>/,/<?php else: ?>/d' admin/partials/helpmate-admin-display.php
# Remove the final endif that closes the main if ($is_dev) block
sed -i '' '$d' admin/partials/helpmate-admin-display.php

cd ../helpmate-build

# Build admin app
echo "Building admin app..."
cd admin/app
echo "VITE_ENVIRONMENT=prod" > .env
pnpm install
pnpm build
# Keep only dist folder
find . -mindepth 1 -maxdepth 1 ! -name 'dist' -exec rm -rf {} +

# Build public app
echo "Building public app..."
cd ../../public/app
echo "VITE_ENVIRONMENT=prod" > .env
pnpm install
pnpm build
# Keep only dist folder
find . -mindepth 1 -maxdepth 1 ! -name 'dist' -exec rm -rf {} +

# Create zip file
echo "Creating zip file..."
cd ../../../
# Create a temporary directory for the zip
rm -rf $ZIP_NAME
rm -rf temp_zip
mkdir -p temp_zip
# Move contents to a helpmate folder
mv helpmate-build temp_zip/helpmate
# Create zip from the temp directory
cd temp_zip
zip -r $ZIP_NAME helpmate -x "*.git*" "*.DS_Store"
# Move zip to parent directory
mv $ZIP_NAME ../
# Clean up
cd ..
rm -rf temp_zip helpmate-build

echo "Build completed successfully!"