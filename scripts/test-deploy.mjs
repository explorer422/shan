import assert from 'node:assert/strict';
import {
  getKeychainToken,
  checkGitStatus,
  dispatchWorkflow,
  deploy,
} from './deploy.mjs';

// ponytail: Test suite for deploy CLI with mocked Keychain, Git & GitHub API
console.log('[test-deploy] Starting Deploy CLI Verification Suite...\n');

// ---------------------------------------------------------------------------
// 1. Keychain Token Retrieval Tests
// ---------------------------------------------------------------------------
console.log('[1] Keychain PAT retrieval & error handling');

{
  // Test 1a: Successful retrieval
  const mockExec = (cmd, args) => {
    assert.equal(cmd, '/usr/bin/security');
    assert.deepEqual(args, [
      'find-generic-password',
      '-s',
      'shan-github-deploy',
      '-a',
      'explorer422',
      '-w',
    ]);
    return '  github_pat_mock_token_12345\n';
  };

  const token = getKeychainToken({ execFn: mockExec });
  assert.equal(token, 'github_pat_mock_token_12345');
  console.log('  ✓ Token extracted and trimmed correctly.');
}

{
  // Test 1b: Missing item in Keychain
  const mockFailingExec = () => {
    throw new Error('SecKeychainSearchCopyNext: Item not found');
  };

  assert.throws(
    () => getKeychainToken({ execFn: mockFailingExec }),
    (err) => {
      assert.equal(err.code, 'ERR_KEYCHAIN_NOT_FOUND');
      assert.ok(err.message.includes('shan-github-deploy'));
      assert.ok(err.message.includes('security add-generic-password'));
      return true;
    }
  );
  console.log('  ✓ Missing Keychain item cleanly caught with helpful guide.');
}

{
  // Test 1c: Empty token in Keychain
  const mockEmptyExec = () => '   \n';
  assert.throws(
    () => getKeychainToken({ execFn: mockEmptyExec }),
    (err) => {
      assert.equal(err.code, 'ERR_KEYCHAIN_NOT_FOUND');
      return true;
    }
  );
  console.log('  ✓ Empty token in Keychain correctly rejected.');
}

// ---------------------------------------------------------------------------
// 2. Git Status & Synchronization Checks
// ---------------------------------------------------------------------------
console.log('\n[2] Git status & branch synchronization guards');

{
  // Test 2a: Clean tree on main with matching HEAD
  const mockGitClean = (_cmd, args) => {
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return 'main\n';
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc1234\n';
    if (args[0] === 'rev-parse' && args[1] === 'origin/main') {
      return 'abc1234\n';
    }
    return '';
  };

  const result = checkGitStatus({ execFn: mockGitClean, skipFetch: true });
  assert.equal(result.localHead, 'abc1234');
  assert.equal(result.remoteHead, 'abc1234');
  console.log('  ✓ Clean tree on main branch passes pre-check.');
}

{
  // Test 2b: Dirty working tree
  const mockGitDirty = (_cmd, args) => {
    if (args[0] === 'status') return ' M src/pages/index.astro\n';
    return '';
  };

  assert.throws(
    () => checkGitStatus({ execFn: mockGitDirty, skipFetch: true }),
    /uncommitted or unstaged changes/
  );
  console.log('  ✓ Dirty working tree correctly rejected.');
}

{
  // Test 2c: Non-main branch
  const mockGitBranch = (_cmd, args) => {
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
      return 'feature/new-post\n';
    }
    return '';
  };

  assert.throws(
    () => checkGitStatus({ execFn: mockGitBranch, skipFetch: true }),
    /must run from branch 'main'/
  );
  console.log('  ✓ Non-main branch correctly rejected.');
}

{
  // Test 2d: Unpushed commits
  const mockGitUnpushed = (_cmd, args) => {
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return 'main\n';
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'head_111\n';
    if (args[0] === 'rev-parse' && args[1] === 'origin/main') {
      return 'remote_222\n';
    }
    if (args[0] === 'rev-list' && args[2] === 'origin/main..HEAD') return '2\n';
    if (args[0] === 'rev-list' && args[2] === 'HEAD..origin/main') return '0\n';
    return '';
  };

  assert.throws(
    () => checkGitStatus({ execFn: mockGitUnpushed, skipFetch: true }),
    /has 2 unpushed commit\(s\)/
  );
  console.log('  ✓ Unpushed commits correctly rejected with push reminder.');
}

{
  // Test 2e: Unpulled commits
  const mockGitUnpulled = (_cmd, args) => {
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return 'main\n';
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'head_111\n';
    if (args[0] === 'rev-parse' && args[1] === 'origin/main') {
      return 'remote_222\n';
    }
    if (args[0] === 'rev-list' && args[2] === 'origin/main..HEAD') return '0\n';
    if (args[0] === 'rev-list' && args[2] === 'HEAD..origin/main') return '3\n';
    return '';
  };

  assert.throws(
    () => checkGitStatus({ execFn: mockGitUnpulled, skipFetch: true }),
    /is behind 'origin\/main' by 3 commit\(s\)/
  );
  console.log('  ✓ Unpulled commits correctly rejected with pull reminder.');
}

// ---------------------------------------------------------------------------
// 3. GitHub REST API Dispatch Tests
// ---------------------------------------------------------------------------
console.log('\n[3] GitHub Workflow Dispatch REST API communication');

{
  // Test 3a: Successful dispatch (HTTP 204)
  const mockFetchSuccess = async (url, options) => {
    assert.ok(url.endsWith('/actions/workflows/deploy.yml/dispatches'));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Authorization'], 'Bearer mock_pat');
    assert.deepEqual(JSON.parse(options.body), { ref: 'main' });
    return { status: 204 };
  };

  const res = await dispatchWorkflow({
    token: 'mock_pat',
    fetchFn: mockFetchSuccess,
  });
  assert.equal(res.success, true);
  assert.equal(res.status, 204);
  assert.ok(res.workflowUrl.includes('actions/workflows/deploy.yml'));
  console.log(
    '  ✓ 204 No Content correctly returns success and workflow URL.'
  );
}

{
  // Test 3b: Authentication failure (HTTP 401)
  const mockFetch401 = async () => ({
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ message: 'Bad credentials' }),
  });

  await assert.rejects(
    () => dispatchWorkflow({ token: 'expired_pat', fetchFn: mockFetch401 }),
    /401 Bad credentials/
  );
  console.log(
    '  ✓ 401 Bad credentials handles token expiry message cleanly.'
  );
}

{
  // Test 3c: Authorization failure (HTTP 403)
  const mockFetch403 = async () => ({
    status: 403,
    statusText: 'Forbidden',
    json: async () => ({
      message: 'Resource not accessible by personal token',
    }),
  });

  await assert.rejects(
    () => dispatchWorkflow({ token: 'no_perm_pat', fetchFn: mockFetch403 }),
    /Actions: Read & write/
  );
  console.log('  ✓ 403 Forbidden indicates missing Actions permission.');
}

{
  // Test 3d: Workflow not found (HTTP 404)
  const mockFetch404 = async () => ({
    status: 404,
    statusText: 'Not Found',
    json: async () => ({ message: 'Not Found' }),
  });

  await assert.rejects(
    () => dispatchWorkflow({ token: 'pat', fetchFn: mockFetch404 }),
    /404 Not Found/
  );
  console.log('  ✓ 404 Not Found indicates repository or workflow mismatch.');
}

// ---------------------------------------------------------------------------
// 4. Orchestration & Dry-Run Tests
// ---------------------------------------------------------------------------
console.log('\n[4] Full orchestration & Dry-Run behavior');

{
  // Test 4a: Dry-run flag skips dispatching
  let dispatchCalled = false;
  const mockDispatch = async () => {
    dispatchCalled = true;
  };

  const result = await deploy({
    argv: ['--dry-run', '--skip-fetch'],
    checkGitStatus: () => ({ localHead: 'commit1234567' }),
    getKeychainToken: () => 'valid_token',
    dispatchWorkflow: mockDispatch,
  });

  assert.equal(result.dryRun, true);
  assert.equal(dispatchCalled, false);
  console.log(
    '  ✓ --dry-run completes pre-flight checks without dispatching.'
  );
}

{
  // Test 4b: End-to-end simulated run
  let passedToken = '';
  const mockDispatch = async ({ token }) => {
    passedToken = token;
    return {
      success: true,
      status: 204,
      workflowUrl:
        'https://github.com/explorer422/shan/actions/workflows/deploy.yml',
    };
  };

  const result = await deploy({
    argv: ['--skip-fetch'],
    checkGitStatus: () => ({ localHead: 'commit1234567' }),
    getKeychainToken: () => 'my_secret_pat',
    dispatchWorkflow: mockDispatch,
  });

  assert.equal(result.success, true);
  assert.equal(passedToken, 'my_secret_pat');
  console.log('  ✓ Full simulated deploy flow coordinates all components.');
}

{
  // Test 4c: --help flag displays usage
  const result = await deploy({ argv: ['--help'] });
  assert.equal(result.help, true);
  console.log('  ✓ --help cleanly displays usage information.');
}

console.log('\n[test-deploy] ALL DEPLOY CLI CHECKS PASSED SUCCESSFULLY! ✓');
