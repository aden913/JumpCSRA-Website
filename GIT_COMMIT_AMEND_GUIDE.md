# Git Commit Amend Guide - Remove API Keys

## ⚠️ IMPORTANT: API Keys Were Committed

Your last commit "logging" contains hardcoded API keys in:
- `vite.config.ts`
- `build-production.sh`
- `build-production.ps1`
- `PRODUCTION_ENV_FIX.md`

These files have now been updated to remove the keys, but you need to amend the commit history.

## Option 1: Amend the Last Commit (If not pushed yet)

If you haven't pushed the "logging" commit to a remote repository yet:

```bash
# Stage the files with removed API keys
git add JumpCSRA/vite.config.ts
git add build-production.sh
git add build-production.ps1
git add PRODUCTION_ENV_FIX.md

# Amend the last commit
git commit --amend --no-edit

# Or if you want to change the commit message:
git commit --amend -m "Add improved logging (sanitized)"
```

## Option 2: Amend and Force Push (If already pushed)

⚠️ **WARNING**: Only do this if you're the only one working on this branch!

```bash
# Stage the files with removed API keys
git add JumpCSRA/vite.config.ts
git add build-production.sh
git add build-production.ps1
git add PRODUCTION_ENV_FIX.md

# Amend the last commit
git commit --amend --no-edit

# Force push to remote (⚠️ DESTRUCTIVE!)
git push --force origin main  # or your branch name
```

## Option 3: Create a New Commit (Safest)

If others are using the repository, create a new commit that removes the keys:

```bash
# Stage the files with removed API keys
git add JumpCSRA/vite.config.ts
git add build-production.sh
git add build-production.ps1
git add PRODUCTION_ENV_FIX.md

# Create a new commit
git commit -m "security: Remove hardcoded API keys from source files"

# Push normally
git push origin main  # or your branch name
```

## Option 4: Rebase and Remove Commit Entirely

If you want to completely remove the commit with API keys:

```bash
# Start interactive rebase for last 2 commits
git rebase -i HEAD~2

# In the editor that opens, change "pick" to "drop" for the "logging" commit
# Save and close the editor

# Add the sanitized files in a new commit
git add JumpCSRA/vite.config.ts
git add build-production.sh
git add build-production.ps1
git add PRODUCTION_ENV_FIX.md
git commit -m "Add improved logging for API keys (sanitized)"

# Force push (if needed)
git push --force origin main  # or your branch name
```

## After Amending: Rotate Your API Keys

Even though you've removed the keys from the repo, if they were pushed to a public repository, you should:

### Firebase API Key
1. Go to Firebase Console
2. Project Settings > General
3. Under "Your apps" > Web App
4. Regenerate the API key

### Google Maps API Key
1. Go to Google Cloud Console
2. APIs & Services > Credentials
3. Edit the API key and regenerate

### Other Keys
- Rotate your email service API key
- Rotate any other keys that were exposed

## Verify API Keys Are Gone

```bash
# Search for any remaining API keys in your repo
git log -p | grep -i "AIzaSy"

# Check all files for API key patterns
grep -r "AIzaSy" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.sh" --include="*.ps1" --include="*.md" .

# Check what's staged
git diff --cached
```

## Best Practices Going Forward

1. **Never commit API keys** - use environment variables
2. **Use .env files** - add them to `.gitignore`
3. **Use .env.example** - commit a template without real keys
4. **Pre-commit hooks** - Use tools like `git-secrets` to prevent key commits
5. **GitHub secrets scanning** - Enable it for your repository

## .gitignore Check

Make sure your `.gitignore` includes:
```
.env
.env.local
.env.production
.env.production.local
.env.development.local
.env.test.local
```

## Current Status

✅ All API keys have been removed from the following files:
- `JumpCSRA/vite.config.ts` - Now uses process.env references only
- `build-production.sh` - Now has placeholders
- `build-production.ps1` - Now has placeholders
- `PRODUCTION_ENV_FIX.md` - Now has placeholders

These changes are in your working directory and ready to be committed.
