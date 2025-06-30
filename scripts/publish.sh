#!/bin/bash

set -e

RELEASE=${RELEASE:-patch}       # patch, minor, major, alpha, beta, rc
DRY_RUN=${DRY_RUN:-false}
PACKAGE_JSON="package.json"

# Check Node & npm
if ! command -v npx &> /dev/null; then
  echo "❌ Please install Node.js and npm first."
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./${PACKAGE_JSON}').version")
PREV_VERSION=$CURRENT_VERSION
echo "📦 Current version: $CURRENT_VERSION"

# Compute next version
if [[ "$RELEASE" =~ ^(alpha|beta|rc)$ ]]; then
  if [[ "$CURRENT_VERSION" =~ "$RELEASE" ]]; then
    NEXT_VERSION=$(npx semver "$CURRENT_VERSION" -i prerelease --preid "$RELEASE")
  else
    NEXT_VERSION=$(npx semver "$CURRENT_VERSION" -i prerelease --preid "$RELEASE")
  fi
  TAG_FLAG="--tag $RELEASE"
else
  NEXT_VERSION=$(npx semver "$CURRENT_VERSION" -i $RELEASE)
  TAG_FLAG=""
fi

echo "🚀 Next version: $NEXT_VERSION ($RELEASE)"

# Define rollback function
rollback() {
  echo "🛑 Publish failed. Rolling back to version $PREV_VERSION..."
  npm version "$PREV_VERSION" --no-git-tag-version
  echo "🔁 Rolled back to $PREV_VERSION"
}

# Trap errors to trigger rollback
trap 'rollback' ERR

echo "🧹 Clearing dist..."
rm -rf dist

# Build project
echo "🔧 Building project..."
npm run build

# Ensure npm login
if ! npm whoami &>/dev/null; then
  echo "🔐 Not logged in to npm. Logging in..."
  npm login
fi

# Bump version
echo "📌 Bumping version to $NEXT_VERSION"
npm version "$NEXT_VERSION" --no-git-tag-version

# Determine if --access public is needed
ACCESS=""
if grep -q '"name": "@' $PACKAGE_JSON; then
  ACCESS="--access public"
fi

# Publish to npm
echo "📤 Publishing to npm..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "🧪 Dry run (no actual publish): npm publish $ACCESS $TAG_FLAG"
else
  npm publish $ACCESS $TAG_FLAG
fi

# Remove rollback trap on success
trap - ERR

# Git commit, tag, and push
GIT_TAG="v$NEXT_VERSION"
echo "📁 Committing version bump..."
git add "$PACKAGE_JSON" package-lock.json 2>/dev/null || true
git commit -m "chore(release): $GIT_TAG" || true

echo "🏷  Creating git tag: $GIT_TAG"
git tag "$GIT_TAG"

echo "🚀 Pushing commit and tag to origin..."
git push origin HEAD
git push origin "$GIT_TAG"

echo "✅ Successfully published, committed and tagged: $GIT_TAG"
