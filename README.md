# Scavo in 3D

Gioco di scavo in realtà mista per Meta Quest, che gira nel browser (WebXR + Three.js).
Appoggi un blocco di roccia sul tuo tavolo vero e lo lavori a strati (terra, roccia, sabbia fine)
con trapano, scalpello e pennello, per estrarre il reperto senza romperlo.
Funziona anche su PC e telefono con mouse o touch.

## Provarlo sul Quest

**Online (consigliato):** carica il progetto su GitHub (vedi sotto) e apri l'indirizzo di GitHub Pages
nel browser del Quest, poi premi **Entra in AR**.

**Dal tuo PC, sulla rete di casa:**
```bash
npm install
npm run dev:quest
```
Apri sul Quest l'indirizzo `https://<ip-del-pc>:5173` che compare nel terminale.
Il certificato è auto-firmato: il browser chiederà conferma, scegli *Avanzate → Procedi*.

## Comandi

| | PC | Quest |
|---|---|---|
| Scavare | clic sinistro tenuto | grilletto destro |
| Cambiare strumento | tasti 1-3 | grilletto sinistro (o B) |
| Scanner | S | impugnatura destra (o A) |
| Ruotare / spostare la roccia | tasto destro o Shift+trascina | impugnatura sinistra |
| Riposizionare sul tavolo | — | X |
| Nuovo scavo | R | Y, o grilletto sinistro a fine partita |

All'ingresso in AR la roccia segue il controller destro: puntalo su un tavolo e premi il grilletto per appoggiarla.
La posizione viene fissata con un'ancora WebXR, così resta ferma anche se ti muovi.

## Pubblicare su GitHub Pages

1. Crea un repository vuoto su GitHub (per esempio `scavo-in-3d`).
2. Dalla cartella del progetto:
   ```bash
   git init && git add . && git commit -m "Scavo in 3D"
   git branch -M main
   git remote add origin https://github.com/<tuo-utente>/scavo-in-3d.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. A ogni `git push` il gioco viene ricompilato e pubblicato su `https://<tuo-utente>.github.io/scavo-in-3d/`.

## Struttura

```
src/
  config.js            parametri: griglia, strati, strumenti (valori da bilanciare)
  specimens.js         reperti procedurali: ammonite, trilobite, geode di ametista
  main.js              scena, loop di gioco, input PC
  voxel/
    rock.js            stato dei voxel, applicazione degli strumenti, gestione dei chunk
    mesh-worker.js     Web Worker: genera la roccia e ricostruisce le mesh
    mesher.js          Surface Nets (voxel → mesh liscia), per regione/chunk
    generate.js        generazione della roccia a strati
  xr/xr.js             sessione AR, controller, hit-test, ancore, vibrazione
  ui/hud-dom.js        interfaccia HTML (PC/telefono) e museo
  ui/hud-xr.js         pannello sul controller sinistro
  fx/                  detriti e suoni
  collection.js        museo dei reperti trovati (salvato nel browser)
```

### Come funziona lo scavo
- La roccia è una griglia di 56³ voxel con densità 0–1, divisa in chunk di 16³ celle.
- Gli strumenti abbassano la densità in una sfera attorno alla punta: ogni materiale ha la sua durezza
  e il pennello non intacca la roccia.
- Solo i chunk modificati vengono ricostruiti, nel Web Worker, così il gioco resta fluido.
- Il reperto è una funzione di distanza (SDF): serve sia per disegnarlo sia per calcolare il danno
  quando uno strumento gli si avvicina troppo.

## Altri comandi
- `npm run build`: build per il web in `dist/`
- `npm run build:single`: un unico file HTML in `dist-single/`, comodo da condividere
