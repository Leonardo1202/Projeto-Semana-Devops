const { describe, it } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server');

// ─── Helper: cria um servidor de teste efêmero ──────────────
function startTestServer() {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            const baseUrl = `http://127.0.0.1:${port}`;
            resolve({ server, baseUrl });
        });
    });
}

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };

        const req = http.request(opts, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }

        req.end();
    });
}

// ─── Testes ─────────────────────────────────────────────────
describe('DevOps Map Brasil API', async () => {
    let server, baseUrl;

    it('setup', async () => {
        ({ server, baseUrl } = await startTestServer());
    });

    // Health check
    it('GET /healthz deve retornar 200 com status ok', async () => {
        const res = await fetch(`${baseUrl}/healthz`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    // POST participante válido
    it('POST /api/participante deve criar participante com dados válidos', async () => {
        const res = await fetch(`${baseUrl}/api/participante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: 'Jeferson', estado: 'SP', cargo: 'DevOps' }),
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.nome, 'Jeferson');
        assert.strictEqual(res.body.estado, 'SP');
        assert.strictEqual(res.body.cargo, 'DevOps');
        assert.ok(res.body.id);
        assert.ok(res.body.criadoEm);
    });

    // POST sem campos obrigatórios
    it('POST /api/participante deve retornar 400 se faltar campo', async () => {
        const res = await fetch(`${baseUrl}/api/participante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: 'Ana' }),
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error);
    });

    // GET participantes
    it('GET /api/participantes deve retornar a lista', async () => {
        const res = await fetch(`${baseUrl}/api/participantes`);
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 1);
    });

    // GET stats
    it('GET /api/stats deve retornar estatísticas', async () => {
        const res = await fetch(`${baseUrl}/api/stats`);
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.total >= 1);
        assert.ok(res.body.porEstado);
        assert.ok(res.body.porCargo);
    });

    // GET info
    it('GET /api/info deve retornar info do app', async () => {
        const res = await fetch(`${baseUrl}/api/info`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.app, 'Semana DevOps Map');
    });

    it('cleanup', async () => {
        server.close();
    });
});
