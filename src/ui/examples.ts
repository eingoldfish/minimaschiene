/**
 * Example programs shipped with the app (more follow in M6).
 */
export const DEFAULT_PROGRAM = `# Multiplikation durch wiederholtes Addieren:
# Produkt = Faktor1 · Faktor2

        LOADI 0
        STORE Produkt      # Produkt mit 0 beginnen
Schleife:
        LOAD Faktor1
        JMPNP Fertig       # Zähler <= 0? Dann fertig.
        SUBI 1             # Zähler um 1 verringern
        STORE Faktor1
        LOAD Produkt
        ADD Faktor2        # Faktor2 einmal dazuzählen
        STORE Produkt
        JMP Schleife
Fertig:
        HALT

# Daten
Faktor1: WORD 5
Faktor2: WORD 4
Produkt: WORD 0
`;
