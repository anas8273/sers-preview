const token = process.env.SERS_HEALTHCHECK_TOKEN;
if (!token || token.length < 32) throw new Error('Protected health credential is unavailable');
const port = process.env.PORT || '3000';
if (!/^[1-9][0-9]*$/.test(port) || Number(port) > 65535) throw new Error('Invalid local health port');
const response = await fetch(`http://127.0.0.1:${port}/api/operations/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
const text = await response.text();
if (text.length > 4096 || text.includes(token)) throw new Error('Invalid protected health response');
console.log(JSON.stringify(JSON.parse(text)));
if (!response.ok) process.exitCode = 1;
