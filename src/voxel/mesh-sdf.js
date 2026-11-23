// Distanza con segno (SDF) da un modello a triangoli, usando un BVH per la velocità.
// Negativo = dentro il modello, positivo = fuori. Usato nel worker per "riempire" la roccia.
import { BufferGeometry, BufferAttribute, Vector3, Ray, DoubleSide } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export function meshSpecimen(positions, index) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex(new BufferAttribute(index, 1));
  const bvh = new MeshBVH(g);
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new Vector3());
  const boundR = g.boundingBox.getSize(new Vector3()).length() / 2;
  const p = new Vector3(), target = { point: new Vector3(), distance: 0, faceIndex: 0 };
  // tre direzioni leggermente storte per evitare di colpire esattamente spigoli e vertici
  const dirs = [new Vector3(1, 0.0131, 0.0071).normalize(), new Vector3(0.0093, 1, 0.0117).normalize(), new Vector3(0.0063, 0.0101, 1).normalize()];
  const ray = new Ray();

  // dentro o fuori? conta quante volte un raggio attraversa la superficie (dispari = dentro), voto a maggioranza
  function inside(x, y, z) {
    let votes = 0;
    for (const d of dirs) {
      ray.origin.set(x, y, z); ray.direction.copy(d);
      const hits = bvh.raycast(ray, DoubleSide);
      hits.sort((a, b) => a.distance - b.distance);
      let n = 0, last = -1;
      for (const h of hits) { if (h.distance - last > 1e-4) { n++; last = h.distance; } }
      if (n % 2 === 1) votes++;
    }
    return votes >= 2;
  }

  return {
    center: [c.x, c.y, c.z], boundR,
    dist(x, y, z) {
      const far = Math.hypot(x - c.x, y - c.y, z - c.z) - boundR;
      if (far > 6) return far;
      p.set(x, y, z);
      bvh.closestPointToPoint(p, target);
      const d = target.distance;
      return inside(x, y, z) ? -d : d;
    },
  };
}
