# Guida al progetto: da Unity a Three.js

Questa guida ti aiuta a orientarti nel codice di *Scavo in 3D* partendo da quello che sai di Unity.

---

## 1. Tabella di traduzione Unity → Three.js

| Unity | Three.js | Dove lo trovi nel progetto |
|---|---|---|
| Scene | `THREE.Scene` | `src/scene.js` |
| GameObject vuoto | `THREE.Group` / `THREE.Object3D` | `Rock` in `src/voxel/rock.js` è un Group |
| Transform (position, rotation, scale) | `.position`, `.quaternion` / `.rotation`, `.scale` | ovunque |
| Parent/child nella Hierarchy | `parent.add(child)` | `rock.add(...)`, `controller.add(toolRig)` |
| MeshFilter + MeshRenderer | `THREE.Mesh(geometry, material)` | chunk della roccia, reperto |
| Mesh (asset) | `THREE.BufferGeometry` | creata dai voxel in `mesher.js` |
| Material (Standard/Lit shader) | `THREE.MeshStandardMaterial` (PBR) | `rockMat` in `rock.js` |
| Camera | `THREE.PerspectiveCamera` | `src/scene.js` |
| Directional Light / Ambient | `DirectionalLight`, `HemisphereLight`, `scene.environment` | `src/scene.js` |
| `Update()` | la funzione passata a `renderer.setAnimationLoop` | fondo di `src/main.js` |
| `Time.deltaTime` | `dt` (in secondi) | `main.js` |
| `Physics.Raycast` | `THREE.Raycaster` | scavo col mouse in `main.js` |
| Prefab | una classe o funzione che crea oggetti | `ToolRig`, `Cursor` in `tools.js` |
| ScriptableObject / file di configurazione | oggetti JavaScript esportati | `config.js`, `levels.js`, `LUCI` in `scene.js` |
| Inspector | pannello lil-gui (tasto **D**) | `src/ui/debug.js` |
| Canvas UI | HTML + CSS sopra il canvas 3D | `index.html`, `src/style.css`, `src/ui/screens.js` |
| Coroutine / async | `async`/`await` e Promise | `startLevel`, `rock.generate` |
| Thread / Job System | Web Worker | `src/voxel/mesh-worker.js` |
| PlayerPrefs | `localStorage` | `src/progress.js` |
| XR Interaction Toolkit | API WebXR + `renderer.xr` | `src/xr/xr.js` |
| Build | `npm run build` (Vite) | cartella `dist/` |

### Differenze da tenere a mente
- **Niente editor visuale.** Tutto è creato da codice: scene, luci, oggetti. Per "vedere" i valori usa il pannello di debug (D) o la console del browser.
- **Assi:** in entrambi Y è verso l'alto e l'unità è il metro. Three.js però è *destrorso*: la camera guarda verso **−Z**, Unity verso +Z.
- **Rotazioni in radianti**, non in gradi. Per convertire c'è `THREE.MathUtils.degToRad(90)`.
- **Niente componenti.** Un oggetto 3D non ha script attaccati: la logica sta in funzioni e classi che modificano gli oggetti, chiamate dal loop.
- **Memoria:** geometrie e texture non usate vanno liberate a mano con `.dispose()`. Lo vedi in `rock.js` quando un chunk viene ricostruito.

---

## 2. Come gira il gioco

```
index.html ──> src/main.js
                 ├─ createScene()          scene.js: renderer, camera, luci
                 ├─ new Rock()             voxel/rock.js: la roccia + il reperto
                 │    └─ Web Worker        voxel/mesh-worker.js: genera voxel e mesh
                 ├─ new UI()               ui/screens.js: schermate HTML
                 ├─ new XRInput()          xr/xr.js: visore e controller
                 └─ setAnimationLoop(...)  il loop, chiamato a ogni frame
```

**Flusso delle schermate:** Iniziale → Livelli → Gioco → (risultato) → Riprova / Livelli / Prossimo.
Lo stato visibile è nell'attributo `data-screen` del `<body>`, e il CSS mostra la sezione giusta.

**Cosa succede quando inizi un livello** (`startLevel` in `main.js`):
1. `rock.generate(level)` carica il modello .glb, lo scala alla `dimensione` del livello e gli dà un orientamento.
2. I triangoli del modello vanno al **worker**, che costruisce un BVH (una struttura che velocizza le ricerche) e calcola per ogni voxel la distanza dal reperto (*SDF*). Con quella decide gli strati: terra all'esterno, roccia, sabbia fine vicino al reperto.
3. Il worker trasforma i voxel in mesh liscia (*Surface Nets*), un blocco (*chunk*) da 16³ alla volta.
4. Mentre scavi, `rock.applyTool` abbassa la densità dei voxel e segna i chunk modificati. Il worker ricostruisce solo quelli.

---

## 3. Le luci, spiegate

Le impostazioni sono in `src/scene.js` (oggetto `LUCI`) e si provano dal vivo con il pannello di debug (**D → Luci**).
L'illuminazione finale è la somma di quattro ingredienti.

| Ingrediente | In Unity sarebbe | Cosa fa | Parametri |
|---|---|---|---|
| **HemisphereLight** (cielo) | Ambient "Gradient" | Luce morbida da tutte le direzioni: un colore dall'alto, uno dal basso. Evita che le parti in ombra siano nere. | `cielo.colore`, `cielo.terreno`, `cielo.intensita` |
| **DirectionalLight** (sole) | Directional Light | Luce parallela da una direzione: crea luci, ombre e volume. È l'unica che proietta **ombre**, ed è quella che rende profonde le buche. | `sole.intensita`, `sole.direzione`, `sole.ombre` |
| **DirectionalLight** (riempimento) | seconda luce | Luce calda e debole dal lato opposto, per non avere il lato in ombra troppo piatto. | `riempimento.*` |
| **Environment** (ambiente) | Reflection Probe / Skybox | Una stanza virtuale che fornisce riflessi e luce indiretta ai materiali PBR. Indispensabile per metalli, gemme e modelli con texture. | `ambiente` |

Poi ci sono **Tone mapping ACES** ed **esposizione**, come nel post-processing di Unity: comprimono le luci forti in modo naturale. Se tutto è troppo scuro o troppo chiaro, prova prima `esposizione`.

**Ricette veloci**
- *Più drammatico:* alza `sole.intensita` (3–4), abbassa `cielo.intensita` (0.5–0.8).
- *Più morbido:* l'opposto, oppure abbassa `sole.direzione.y` per una luce più radente.
- *Modello troppo lucido o troppo opaco:* è il materiale del .glb (metallic/roughness, in Blender). In alternativa abbassa `ambiente`.
- *Prestazioni sul Quest:* disattivare `sole.ombre` è il guadagno più grande.

**In AR** la luce è solo virtuale: il gioco non sa com'è illuminata la tua stanza. Le luci seguono la roccia (`followTarget` in `scene.js`), così le ombre restano corrette anche quando la sposti. Se in passthrough la roccia sembra troppo luminosa o troppo scura rispetto alla stanza, regola `esposizione`.

---

## 4. Aggiungere un livello con il tuo modello

1. **Prepara il modello** in Blender (o scaricalo):
   - superficie **chiusa**, senza buchi: serve a capire cosa sta dentro;
   - meno di ~50.000 triangoli, texture fino a 2048 px;
   - esporta con *File → Export → glTF 2.0*, formato **glTF Binary (.glb)**.
   La scala e la posizione non contano: il gioco centra il modello e lo ridimensiona da solo.
2. **Copia il file** in `src/modelli/`, per esempio `src/modelli/dente.glb`.
3. **Aggiungi il livello** in `src/levels.js`:
   ```js
   {
     id: 'dente-trex',
     nome: 'Dente di T-rex',
     descrizione: 'Fragile e appuntito.',
     modello: 'dente.glb',
     dimensione: 9,           // cm, lato più lungo (6–13)
     orientamento: 'casuale', // oppure [0, 0, 90] in gradi
     resistenza: 1.5,         // più alto = si rompe prima
   },
   ```
4. Avvia `npm run dev`: il nuovo livello compare nella schermata dei livelli e si sblocca completando quello prima.

**Se qualcosa non va**
- *"Modello non trovato"*: il nome in `modello:` deve coincidere con il file, maiuscole comprese.
- *Il reperto si scopre "a metà" o la roccia ha buchi strani*: la mesh non è chiusa. In Blender prova *Mesh → Clean Up → Fill Holes*, oppure un modificatore *Remesh*.
- *Esce dalla roccia*: abbassa `dimensione`.
- *File pesante e caricamento lento*: comprimilo con https://gltf.report o con `npx @gltf-transform/cli optimize in.glb out.glb`. I modelli compressi con Draco o Meshopt sono supportati.

---

## 5. Dove cambiare cosa

| Voglio cambiare… | File |
|---|---|
| Strumenti (raggio, velocità, danno), scanner, stelle | `src/config.js` → `TOOLS`, `GIOCO` |
| Forma e dimensione della roccia | `src/config.js` → `ROCCIA` |
| Valori predefiniti dei livelli | `src/config.js` → `LIVELLO_DEFAULT` |
| Livelli e modelli | `src/levels.js` |
| Luci, sfondo, esposizione | `src/scene.js` → `LUCI` |
| Colori e aspetto dell'interfaccia | `src/style.css` (variabili in cima: `--acc`, `--bg`…) |
| Testi e struttura delle schermate | `index.html`, `src/ui/screens.js` |
| Pannello nel visore | `src/ui/hud-xr.js` |
| Comandi dei controller | `src/main.js`, sezione *INPUT VISORE* |
| Suoni | `src/fx/audio.js` |

**Metodo consigliato:** apri il gioco con `npm run dev`, premi **D**, regola i valori finché ti piacciono, poi premi **Copia valori** e incolla i numeri nei file indicati.
Con `npm run dev` ogni salvataggio di un file aggiorna subito il browser.

---

## 6. Debug

- **Console del browser** (F12 su PC): errori e messaggi. Da lì puoi anche scrivere `__scavo.G` per vedere lo stato del gioco, `__scavo.rock` per la roccia, `__scavo.startLevel(0)` per riavviare il livello.
- **Sul Quest:** attiva la modalità sviluppatore, collega il visore al PC con il cavo USB, apri `chrome://inspect` in Chrome sul PC e scegli la scheda del browser del Quest. Vedi la console del visore come se fosse sul PC.

---

## 7. Per imparare Three.js

- Documentazione ufficiale: https://threejs.org/docs/
- Centinaia di esempi con il codice: https://threejs.org/examples/ (cerca "webxr" per la realtà mista)
- Un consiglio pratico: prendi un file di questo progetto (per esempio `scene.js`), cambia un valore, salva e guarda cosa succede. È il modo più rapido per capire come funziona.
