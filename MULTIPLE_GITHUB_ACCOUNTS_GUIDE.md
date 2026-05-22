# Guide: Managing Multiple GitHub Accounts via Repository-Specific Tokens

This guide explains how to configure a specific Git repository to use a different GitHub account (via a Personal Access Token) on a machine where another account is globally cached in Windows Credential Manager.

## The Problem
- The Windows Credential Manager globally caches a single GitHub account credential (e.g., `medmargincore-coder`) under `git:https://github.com`.
- If you try to push to a repository owned by a different account (e.g., `AurumWolfg-56/HealthAxisInventory`), Git defaults to the globally cached account and returns a **403 Permission Denied** error.
- Clearing or changing the global credentials will log you out of your primary account, disrupting other active projects.

## The Solution (Safe Repository Isolation)
Instead of modifying global credentials, we embed a Personal Access Token (PAT) directly in the remote URL of **only the target repository**. This leaves all other projects completely unaffected and keeps authentication isolated to this folder.

### Step-by-Step Configuration in PowerShell

1. **Generate a PAT on GitHub**:
   - Log in with the account you want to use for the target repository.
   - Go to **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)**.
   - Click **Generate new token (classic)**.
   - Select the **`repo`** scope and generate it. Copy the token (starts with `ghp_`).

2. **Navigate to the Repository in PowerShell**:
   - Change to the appropriate drive if necessary (e.g., `R:`).
   - Navigate to the folder:
     ```powershell
     cd \path\to\your\other-project
     ```

3. **Define and Apply the Token**:
   - Save the token in a variable (replace `ghp_YOUR_TOKEN_HERE` with the actual token):
     ```powershell
     $token = "ghp_YOUR_TOKEN_HERE"
     ```
   - Update the remote `origin` URL using the token and the target repository details (replace `OWNER` and `REPO` with the actual GitHub owner and repository name):
     ```powershell
     git remote set-url origin "https://${token}@github.com/OWNER/REPO.git"
     ```

4. **Verify and Push**:
   - Run the push command. It will authenticate automatically using the embedded token:
     ```powershell
     git push origin main
     ```

## Benefits
- **Zero Impact**: Does not touch the Windows Credential Manager or other projects.
- **Persistent**: You only need to run this command once per repository. All future pulls and pushes will work automatically.
- **AI-Agent Compatible**: AI coding assistants can push code on your behalf directly because the authentication is already built into the local repository's remote URL.
