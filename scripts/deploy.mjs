import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ponytail: Minimal GitHub Actions deploy trigger using Keychain & REST API
const SERVICE_NAME = 'shan-github-deploy';
const ACCOUNT_NAME = 'explorer422';
const REPO_OWNER = 'explorer422';
const REPO_NAME = 'shan';
const WORKFLOW_FILE = 'deploy.yml';

const USAGE_TEXT = `
SHAN GitHub Actions Deployment Tool

Usage:
  npm run deploy
  node scripts/deploy.mjs [options]

Options:
  --dry-run      Run all pre-checks without dispatching the workflow.
  --skip-fetch   Skip remote git fetch (verify local main vs origin/main).
  --help, -h     Show this help guide.

Prerequisites:
  1. Generate a Fine-grained PAT on GitHub:
     - Go to GitHub Settings -> Developer settings -> Fine-grained tokens.
     - Repository access: 'explorer422/shan'
     - Permissions: Actions -> Read and write
  2. Store the PAT in macOS Keychain:
     security add-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" \\
       -w "<YOUR_PAT>" -U
`.trim();

/**
 * Retrieve GitHub PAT securely from macOS Keychain.
 */
export function getKeychainToken({
  service = SERVICE_NAME,
  account = ACCOUNT_NAME,
  execFn = execFileSync,
} = {}) {
  try {
    const stdout = execFn(
      '/usr/bin/security',
      ['find-generic-password', '-s', service, '-a', account, '-w'],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    const token = stdout.trim();
    if (!token) {
      throw new Error('Keychain returned an empty password.');
    }
    return token;
  } catch {
    const msg =
      `GitHub Fine-grained PAT not found in macOS Keychain.\n` +
      `  Service: "${service}"\n` +
      `  Account: "${account}"\n\n` +
      `To store your PAT securely in Keychain, run:\n` +
      `  security add-generic-password -s "${service}" -a "${account}" ` +
      `-w "<YOUR_PAT>" -U`;
    const error = new Error(msg);
    error.code = 'ERR_KEYCHAIN_NOT_FOUND';
    throw error;
  }
}

/**
 * Verify git working tree cleanliness and synchronization with origin/main.
 */
export function checkGitStatus({
  execFn = execFileSync,
  skipFetch = false,
} = {}) {
  // 1. Verify working tree is clean
  const status = execFn('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim();
  if (status.length > 0) {
    throw new Error(
      'Working tree has uncommitted or unstaged changes.\n' +
        'Please commit, stash, or revert changes before deploying.'
    );
  }

  // 2. Verify current branch is main
  const currentBranch = execFn(
    'git',
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    { encoding: 'utf8' }
  ).trim();
  if (currentBranch !== 'main') {
    throw new Error(
      `Deployment must run from branch 'main' ` +
        `(currently on '${currentBranch}').`
    );
  }

  // 3. Fetch remote origin/main
  if (!skipFetch) {
    try {
      execFn('git', ['fetch', 'origin', 'main'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new Error(
        'Failed to fetch origin/main. Ensure network access is available ' +
          'or use --skip-fetch if you already verified remote sync.'
      );
    }
  }

  // 4. Compare local HEAD and origin/main
  const localHead = execFn('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const remoteHead = execFn('git', ['rev-parse', 'origin/main'], {
    encoding: 'utf8',
  }).trim();

  if (localHead !== remoteHead) {
    const unpushed = parseInt(
      execFn('git', ['rev-list', '--count', 'origin/main..HEAD'], {
        encoding: 'utf8',
      }).trim(),
      10
    );
    const unpulled = parseInt(
      execFn('git', ['rev-list', '--count', 'HEAD..origin/main'], {
        encoding: 'utf8',
      }).trim(),
      10
    );

    if (unpushed > 0 && unpulled === 0) {
      throw new Error(
        `Local branch 'main' has ${unpushed} unpushed commit(s).\n` +
          "Run 'git push origin main' before deploying."
      );
    } else if (unpulled > 0 && unpushed === 0) {
      throw new Error(
        `Local branch 'main' is behind 'origin/main' by ${unpulled} ` +
          "commit(s).\nRun 'git pull origin main' before deploying."
      );
    } else {
      throw new Error(
        "Local 'main' and 'origin/main' have diverged.\n" +
          'Please synchronize your branch before deploying.'
      );
    }
  }

  return { localHead, remoteHead };
}

/**
 * Dispatch workflow using GitHub Workflow Dispatch REST API.
 */
export async function dispatchWorkflow({
  token,
  owner = REPO_OWNER,
  repo = REPO_NAME,
  workflow = WORKFLOW_FILE,
  ref = 'main',
  fetchFn = globalThis.fetch,
} = {}) {
  const url =
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/` +
    `${workflow}/dispatches`;

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'SHAN-Deploy-CLI',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });

  if (res.status === 204) {
    return {
      success: true,
      status: 204,
      workflowUrl:
        `https://github.com/${owner}/${repo}/actions/workflows/${workflow}`,
    };
  }

  let errorDetails = '';
  try {
    const body = await res.json();
    if (body && body.message) {
      errorDetails = body.message;
    }
  } catch {
    // Non-JSON response
  }

  if (res.status === 401) {
    throw new Error(
      'GitHub rejected authentication (401 Bad credentials).\n' +
        'Your Fine-grained PAT in Keychain may be invalid or expired.\n' +
        'Please generate a new token and update Keychain:\n' +
        `  security add-generic-password -s "${SERVICE_NAME}" ` +
        `-a "${ACCOUNT_NAME}" -w "<YOUR_PAT>" -U`
    );
  }

  if (res.status === 403) {
    throw new Error(
      'GitHub access forbidden (403 Forbidden).\n' +
        `Details: ${errorDetails || 'Insufficient permissions.'}\n` +
        "Ensure your Fine-grained PAT has 'Actions: Read & write' " +
        `permission on repository '${owner}/${repo}'.`
    );
  }

  if (res.status === 404) {
    throw new Error(
      `Workflow or repository not found (404 Not Found).\n` +
        `Repository: ${owner}/${repo}, Workflow: ${workflow}.\n` +
        'Ensure the repository exists and your PAT has access.'
    );
  }

  throw new Error(
    `GitHub API error (${res.status}): ${errorDetails || res.statusText}`
  );
}

/**
 * Main deployment orchestration.
 */
export async function deploy(options = {}) {
  const args = options.argv || process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const skipFetch = args.includes('--skip-fetch');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(USAGE_TEXT);
    return { help: true };
  }

  console.log('[deploy] Starting SHAN deployment pre-flight checks...');

  // 1. Git verification
  const checkGit = options.checkGitStatus || checkGitStatus;
  const { localHead } = checkGit({
    skipFetch,
    execFn: options.execFn,
  });
  const shortHead = localHead.slice(0, 7);
  console.log(
    `[deploy] Git check passed: working tree clean, HEAD=${shortHead}.`
  );

  // 2. Keychain PAT retrieval
  const getToken = options.getKeychainToken || getKeychainToken;
  const token = getToken({
    execFn: options.execFn,
  });
  console.log(
    `[deploy] Keychain check passed: retrieved PAT from "${SERVICE_NAME}".`
  );

  // 3. Dry-run safety stop
  if (isDryRun) {
    console.log(
      '[deploy] DRY-RUN enabled: all pre-checks passed, dispatch skipped.'
    );
    return { dryRun: true, localHead };
  }

  // 4. Dispatch workflow
  console.log(`[deploy] Dispatching ${WORKFLOW_FILE} to GitHub Actions...`);
  const dispatch = options.dispatchWorkflow || dispatchWorkflow;
  const result = await dispatch({
    token,
    fetchFn: options.fetchFn,
  });

  console.log(
    '[deploy] SUCCESS: GitHub Actions workflow triggered successfully!'
  );
  console.log(
    `[deploy] Track deployment progress at:\n  ${result.workflowUrl}`
  );
  return result;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  deploy().catch((err) => {
    console.error(`\n[deploy] ERROR: ${err.message}`);
    process.exit(1);
  });
}
