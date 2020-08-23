import server from './server';

const log = console.log;

// Sanitize env vars
const { PORT: port = 8080 } = process.env;

server.listen(port, () => log(`Running at http://localhost:${port}`));
