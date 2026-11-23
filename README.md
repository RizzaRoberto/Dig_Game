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
| Ricominciare il livello | R | grilletto sinistro a fine partita |
| Uscire dall'AR | — | Y |
| Pannello di debug | D | — |

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

## Personalizzare

Leggi **[GUIDA.md](GUIDA.md)**: spiega il progetto partendo dai concetti di Unity, come funzionano le luci,
come aggiungere un livello con un tuo modello .glb e dove si cambia ogni parametro.

In breve:
- **livelli e modelli** → `src/levels.js` + file .glb in `src/modelli/`
- **strumenti e regole** → `src/config.js`
- **luci** → `src/scene.js`
- **interfaccia** → `index.html`, `src/style.css`, `src/ui/screens.js`
- **pannello di debug** → tasto **D** durante il gioco

## Altri comandi
- `npm run build`: build per il web in `dist/`
- `npm run build:single`: un unico file HTML in `dist-single/`, comodo da condividere
