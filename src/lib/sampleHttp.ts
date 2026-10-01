const SAMPLE_HTTP_TEXT = [
  '@host = https://httpbin.org',
  '@token = your-secret-token',
  '',
  '### Echo POST',
  'POST {{host}}/post',
  'Content-Type: application/json',
  '',
  '{"plugin": "standardnotes-apiclient"}',
  '',
  '### Status check',
  'GET {{host}}/status/201',
  'Authorization: Bearer {{token}}',
  '',
  '### CRUD example',
  'GET https://jsonplaceholder.typicode.com/posts/1',
].join('\n');

export { SAMPLE_HTTP_TEXT };
