const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Armazenamento in-memory (propositalmente simples — o foco é Docker/K8s)
// ---------------------------------------------------------------------------
const participantes = [];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Rotas — API
// ---------------------------------------------------------------------------

// Health check para o Kubernetes (liveness / readiness probes)
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Registrar novo participante
app.post('/api/participante', (req, res) => {
    const { nome, estado, cargo } = req.body;

    // Validação simples
    if (!nome || !estado || !cargo) {
        return res.status(400).json({
            error: 'Campos obrigatórios: nome, estado, cargo',
        });
    }

    const participante = {
        id: participantes.length + 1,
        nome: nome.trim(),
        estado: estado.trim().toUpperCase(),
        cargo: cargo.trim(),
        criadoEm: new Date().toISOString(),
        podName: process.env.HOSTNAME || 'local',
    };

    participantes.push(participante);

    console.log(
        `[NOVO] ${participante.nome} — ${participante.estado} — ${participante.cargo} (pod: ${participante.podName})`
    );

    res.status(201).json(participante);
});

// Listar todos os participantes
app.get('/api/participantes', (_req, res) => {
    res.json(participantes);
});

// Estatísticas agregadas
app.get('/api/stats', (_req, res) => {
    const porEstado = {};
    const porCargo = {};

    participantes.forEach((p) => {
        porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
        porCargo[p.cargo] = (porCargo[p.cargo] || 0) + 1;
    });

    res.json({
        total: participantes.length,
        porEstado,
        porCargo,
        ultimoRegistro:
            participantes.length > 0
                ? participantes[participantes.length - 1]
                : null,
    });
});

// ---------------------------------------------------------------------------
// Info — útil para mostrar em qual pod está rodando
// ---------------------------------------------------------------------------
app.get('/api/info', (_req, res) => {
    res.json({
        app: 'Semana DevOps Map',
        version: process.env.APP_VERSION || '1.0.0',
        pod: process.env.HOSTNAME || 'local',
        nodeEnv: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
    });
});

// ---------------------------------------------------------------------------
// Iniciar servidor
// ---------------------------------------------------------------------------
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
  ╔══════════════════════════════════════════════╗
  ║      Semana DevOps Map — ONLINE!             ║
  ║      Porta: ${String(PORT).padEnd(33)}║
  ║      Pod:   ${String(process.env.HOSTNAME || 'local').padEnd(33)}║
  ║      #VAMODEPLOY                             ║
  ╚══════════════════════════════════════════════╝
    `);
    });
}

// Exporta para testes
module.exports = app;
