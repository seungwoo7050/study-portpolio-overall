#!/bin/bash

# Install Git hooks for Sagaline project
# Run this script to set up pre-commit hooks

set -e

echo "📦 Installing Git hooks for Sagaline..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not a git repository. Please run from project root."
  exit 1
fi

# Make pre-commit hook executable
chmod +x scripts/pre-commit

# Copy to .git/hooks
cp scripts/pre-commit .git/hooks/pre-commit

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will run automatically before each commit to:"
echo "  - Check for binary files"
echo "  - Check for sensitive information"
echo "  - Verify code compiles"
echo "  - Validate commit message format"
echo ""
echo "To bypass the hook (not recommended):"
echo "  git commit --no-verify"
echo ""
