import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { searchPublicProfileTool } from './search-public-profile';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.OPENVIKING_PROFILE_URL;
const originalApiKey = process.env.OPENVIKING_PROFILE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.OPENVIKING_PROFILE_URL;
  else process.env.OPENVIKING_PROFILE_URL = originalUrl;
  if (originalApiKey === undefined) delete process.env.OPENVIKING_PROFILE_API_KEY;
  else process.env.OPENVIKING_PROFILE_API_KEY = originalApiKey;
});

test('reads only the profile selected by current.json and accepts a null feed', async () => {
  process.env.OPENVIKING_PROFILE_URL = 'https://openviking.example/';
  process.env.OPENVIKING_PROFILE_API_KEY = 'test-key';
  const requests: string[] = [];
  const profileUri = 'viking://resources/persona/profile/cabb889a-b78a-4d53-ade4-ef31f1c9bd45.json';
  const profileContent = JSON.stringify({ writingPreferences: ['clear examples'] });

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const uri = url.searchParams.get('uri');
    assert.equal(url.pathname, '/api/v1/content/read');
    assert.ok(uri);
    requests.push(uri);

    const content = uri === 'viking://resources/persona/current.json'
      ? JSON.stringify({ version: 'ignored', profile: profileUri, feed: null })
      : uri === profileUri
        ? profileContent
        : null;
    assert.ok(content, `unexpected OpenViking URI: ${uri}`);
    return Response.json({ result: { content } });
  }) as typeof fetch;

  const response = JSON.parse(await searchPublicProfileTool.invoke({ query: 'technical writing preference' }));

  assert.equal(response.success, true);
  assert.deepEqual(requests, ['viking://resources/persona/current.json', profileUri]);
  assert.deepEqual(response.results, [{ uri: profileUri, content: profileContent }]);
});

test('does not read a profile outside the published profile directory', async () => {
  process.env.OPENVIKING_PROFILE_URL = 'https://openviking.example/';
  process.env.OPENVIKING_PROFILE_API_KEY = 'test-key';
  const requests: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const uri = url.searchParams.get('uri');
    assert.equal(url.pathname, '/api/v1/content/read');
    assert.equal(uri, 'viking://resources/persona/current.json');
    requests.push(uri);
    return Response.json({
      result: {
        content: JSON.stringify({
          profile: 'viking://resources/persona/../persona_pref/private.json',
          feed: null,
        }),
      },
    });
  }) as typeof fetch;

  const response = JSON.parse(await searchPublicProfileTool.invoke({ query: 'anything' }));

  assert.equal(response.success, false);
  assert.deepEqual(requests, ['viking://resources/persona/current.json']);
});

test('reports authentication failures without exposing OpenViking response details', async () => {
  process.env.OPENVIKING_PROFILE_URL = 'https://openviking.example/';
  process.env.OPENVIKING_PROFILE_API_KEY = 'test-key';
  globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;

  const response = JSON.parse(await searchPublicProfileTool.invoke({ query: 'technical writing preference' }));

  assert.equal(response.success, false);
  assert.equal(response.error, 'OpenViking 身份认证失败，请检查博客专用只读 API 密钥是否有效。');
  assert.doesNotMatch(JSON.stringify(response), /test-key|Invalid API key/);
});
