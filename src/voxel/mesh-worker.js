// Web Worker: genera le rocce e ricostruisce le mesh dei chunk senza bloccare il gioco.
import { CS, CELL, HALF } from '../config.js';
import { surfaceNets } from './mesher.js';
import { generateRock, rockColorFn } from './generate.js';

const R = CS + 4; // regione = chunk + 2 punti di margine per lato

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'gen') {
    const g = generateRock(msg.seed, msg.specimen);
    const sm = g.specimenMesh;
    self.postMessage({ type: 'gen', id: msg.id, density: g.density, mat: g.mat, fd: g.fd, shell: g.shell, specimenMesh: sm },
      [g.density.buffer, g.mat.buffer, g.fd.buffer, g.shell.buffer, sm.pos.buffer, sm.nor.buffer, sm.col.buffer, sm.idx.buffer]);
  } else if (msg.type === 'mesh') {
    const results = [], transfer = [];
    for (const job of msg.jobs) {
      const o = job.o; // origine globale della regione (punti)
      const m = surfaceNets(job.f, R, R, R, [1, 1, 1], [2 + CS, 2 + CS, 2 + CS], [2, 2, 2], [2 + CS, 2 + CS, 2 + CS],
        rockColorFn(job.m, R, o), CELL, [o[0] * CELL - HALF, o[1] * CELL - HALF, o[2] * CELL - HALF]);
      results.push({ key: job.key, ...m });
      transfer.push(m.pos.buffer, m.nor.buffer, m.col.buffer, m.idx.buffer);
    }
    self.postMessage({ type: 'mesh', gen: msg.gen, results }, transfer);
  }
};
