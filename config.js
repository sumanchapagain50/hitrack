/**
 * HITrack - GitHub Auto-Record Configuration
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
 * 2. Create a token with "Contents" → Read and Write permission for this repository
 * 3. Fill in your details below
 */

const GITHUB_CONFIG = {
    // Your GitHub username
    owner: 'YOUR_GITHUB_USERNAME',

    // Exact repository name
    repo: 'hitrack',

    // Path inside the repo where observations will be saved
    csvPath: 'data/observations.csv',

    // Your Personal Access Token (fine-grained, contents: write)
    token: 'YOUR_GITHUB_PAT',

    // Branch to commit to
    branch: 'main'
};
