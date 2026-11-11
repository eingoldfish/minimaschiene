/**
 * German guide. Based on the user manual of the Minimaschine 4.0 (A. Wiedemann),
 * checked against this web app and extended (see docs/kompatibilitaet.md and
 * docs/abgleich-java.md for the measured details).
 */
import type { GuideGenerated, GuideSection } from './content';

export function sectionsDe(g: GuideGenerated): GuideSection[] {
  return [
    {
      id: 'ueberblick',
      title: 'Überblick',
      html: `
<p>Die <strong>Minimaschine</strong> ist ein Modellrechner für den Informatikunterricht: ein stark vereinfachter
16-Bit-Prozessor, an dem man sieht, was in einem echten Computer passiert. Man schreibt kleine Programme in
<strong>Assembler</strong>, übersetzt sie in Maschinencode und lässt sie Befehl für Befehl – oder sogar
Mikroschritt für Mikroschritt – ablaufen.</p>
<p>Der Prozessor ist eine typische <strong>Registermaschine mit Akkumulator</strong>. Er kann in drei Arten arbeiten:</p>
<ul>
  <li><strong>Einzelschritt:</strong> Jeder Befehl wird einzeln ausgeführt.</li>
  <li><strong>Mikroschritt:</strong> Die Phasen des Befehlszyklus (Holen – Dekodieren – Ausführen) werden einzeln gezeigt.</li>
  <li><strong>Ausführen:</strong> Die Befehle laufen, bis die Maschine auf <code>HALT</code>, einen ungültigen Befehl oder einen Haltepunkt trifft.</li>
</ul>
<p>Zuschaltbar ist ein <strong>erweiterter Modus</strong> mit Stackpointer, Stackbefehlen und Unterprogrammen
(siehe <a href="#anleitung/erweitert">Erweiterter Modus</a>).</p>
<div class="g-note">
  <p><strong>Woher kommt die Minimaschine?</strong> Das Original stammt von Albert Wiedemann und wurde für den
  bayerischen Lehrplan (Jahrgangsstufe 12/13, Thema „Registermaschine“) entwickelt. Programm, Handbuch und weiteres
  Material gibt es unter <a href="https://schule.awiedemann.de/" target="_blank" rel="noopener">schule.awiedemann.de</a>.</p>
  <p>Diese Web-App ist eine <strong>eigenständige, inoffizielle Nachbildung</strong> der Minimaschine 4.0. Sie versteht
  dieselben Assemblerprogramme, wurde aber komplett neu geschrieben. Die Unterschiede stehen unter
  <a href="#anleitung/original">Unterschiede zum Original</a>.</p>
</div>
<p>Diese Anleitung fasst das Benutzermanual des Originals zusammen, gleicht es mit der Web-App ab und ergänzt alles,
was nur hier gibt (z. B. „Schritt zurück“, Haltepunkte, Link teilen). Die Befehlsübersicht wird direkt aus den
Befehlsdefinitionen der App erzeugt und stimmt deshalb immer.</p>
<p class="g-muted">Nicht enthalten: Das Original kann außerdem <em>Pseudocode</em> und die ältere <em>Minisprache</em>
automatisch in Assembler übersetzen. Diesen Compiler gibt es in der Web-App (noch) nicht – hier wird ausschließlich in
Assembler programmiert.</p>`,
    },
    {
      id: 'schnellstart',
      title: 'Schnellstart',
      html: `
<ol class="g-steps">
  <li><strong>Programm schreiben</strong> – im Bereich <em>Programm</em> links. Oder ein fertiges Beispiel holen:
    <em>Datei → Beispiel laden</em>.</li>
  <li><strong>Assemblieren</strong> (<kbd>F9</kbd>): Das Programm wird in Maschinencode übersetzt und ab Adresse 0 in
    den Speicher geschrieben. Fehler stehen mit Erklärung unter dem Editor und sind im Text rot unterstrichen.</li>
  <li><strong>Schritt ▶</strong> (<kbd>F10</kbd>) führt genau einen Befehl aus. Beobachte, wie sich Akku,
    Befehlszähler, Flags und Speicher ändern.</li>
  <li><strong>▶▶ Ausführen</strong> (<kbd>F5</kbd>) lässt das Programm bis zum <code>HALT</code> laufen. Das Tempo
    ist einstellbar; mit <em>Pause</em> oder <kbd>Esc</kbd> hält es an.</li>
  <li><strong>Zurücksetzen</strong> stellt Akku, Befehlszähler und Flags auf 0 – danach kann das Programm von vorn
    laufen. Der Speicher bleibt erhalten.</li>
</ol>
<p>Ein erstes Programm zum Ausprobieren – es berechnet 5 + 4 + 3 + 2 + 1:</p>
<pre class="g-code" data-asm data-check="Summe=15"># Summe 1 + 2 + … + n
        LOADI 0
        STORE Summe        # Summe = 0
Schleife:
        LOAD  n
        JMPZ  Fertig       # n = 0? Dann fertig.
        ADD   Summe
        STORE Summe        # Summe = Summe + n
        LOAD  n
        SUBI  1
        STORE n            # n = n - 1
        JMP   Schleife
Fertig:
        HALT

n:      WORD 5
Summe:  WORD 0</pre>
<p>Nach dem Ausführen steht in der Speicherzelle <code>Summe</code> der Wert 15. Tipp: Stelle den Speicher auf
„dem PC folgen“ und klicke ein paar Mal auf <em>Schritt ▶</em>, um zu sehen, wie die Schleife arbeitet.</p>`,
    },
    {
      id: 'aufbau',
      title: 'Aufbau der Maschine',
      html: `
<h3>Speicher</h3>
<p>Der Speicher hat <strong>65 536 Zellen</strong> (Adressen 0 bis 65535, also „64K“). Jede Zelle enthält ein
<strong>16-Bit-Wort</strong> – mit Vorzeichen gelesen −32768 bis 32767, ohne Vorzeichen 0 bis 65535.
Programm und Daten liegen im selben Speicher (Von-Neumann-Prinzip).</p>
<p>Nach dem Start, nach „Speicher löschen“ und beim Assemblieren sind alle Zellen 0 – nur die beiden obersten Zellen
65534 und 65535 enthalten −1 (0xFFFF). Läuft ein Programm ohne <code>HALT</code> durch den leeren Speicher, hält
es dort mit „ungültiger Befehl“ an.</p>

<h3>Register im Prozessor</h3>
<dl class="g-dl">
  <dt>Akkumulator (A)</dt>
  <dd>Das einzige Rechenregister. Vor einer Rechnung steht hier der erste Operand, danach das Ergebnis. Bei
  Speicherbefehlen ist er Ziel (<code>LOAD</code>) oder Quelle (<code>STORE</code>).</dd>
  <dt>Befehlszähler (PC)</dt>
  <dd>Adresse des nächsten Befehls, der geholt wird. Im Original heißt er „Programmzähler“.</dd>
  <dt>Befehlsregister</dt>
  <dd>Der zuletzt geholte Befehl: Operationscode, Adressierungsart und Adressteil.</dd>
  <dt>Statusregister (Flags)</dt>
  <dd>Vier Bits, die das Ergebnis der letzten Rechnung beschreiben und die bedingten Sprünge steuern:
    <ul>
      <li><strong>Z</strong> (Zero) – das Ergebnis war 0</li>
      <li><strong>N</strong> (Negativ) – das Ergebnis war negativ (Bit 15 gesetzt)</li>
      <li><strong>V</strong> (Overflow) – Überlauf beim Rechnen <em>mit</em> Vorzeichen</li>
      <li><strong>C</strong> (Carry) – Überlauf beim Rechnen <em>ohne</em> Vorzeichen bzw. „Borgen“ beim Subtrahieren</li>
    </ul>
    Welcher Befehl welche Flags setzt, steht unter <a href="#anleitung/flags">Flags und Vergleiche</a>.</dd>
  <dt>Stackpointer (SP)</dt>
  <dd>Nur im erweiterten Modus: zeigt auf das oberste Element des Stacks. Startwert 65534.</dd>
</dl>

<h3>Busse</h3>
<p>Prozessor und Speicher sind über drei Busse verbunden, die im Schaubild farbig dargestellt sind:</p>
<ul>
  <li><strong>Adressbus:</strong> Der Prozessor legt die Adresse der Speicherzelle an, die er lesen oder schreiben will.</li>
  <li><strong>Datenbus:</strong> Über ihn wandert der Wert – vom Speicher zum Prozessor oder umgekehrt.</li>
  <li><strong>Steuerbus:</strong> Er gibt die Richtung an: <em>lesen</em> oder <em>schreiben</em>.</li>
</ul>

<h3>Wie ein Befehl im Speicher steht</h3>
<p>Jeder Befehl belegt <strong>zwei aufeinanderfolgende Speicherzellen</strong>:</p>
<ul>
  <li><strong>Wort 1:</strong> was getan wird – <code>Adressierungsart · 256 + Opcode</code></li>
  <li><strong>Wort 2:</strong> der Adressteil (bei Befehlen ohne Adresse 0)</li>
</ul>
<p>Weil jeder Befehl gleich lang ist, kann der Prozessor ihn vollständig laden, bevor er ihn dekodiert. Beispiele:
<code>LOAD 11</code> → 276 (0x0114) und 11; <code>LOADI 11</code> → 532 (0x0214) und 11; <code>NOT</code> → 56 und 0.
Die Opcodes stehen in der <a href="#anleitung/befehle">Befehlsübersicht</a>; die Kennzahlen der Adressierungsarten
unter <a href="#anleitung/assembler">Die Assemblersprache</a>.</p>
<p>Sprünge verwenden absolute Adressen über den ganzen Speicher – es gibt keinen Unterschied zwischen kurzen und
weiten Sprüngen.</p>

<h3>Der Befehlszyklus</h3>
<p>Jeder Befehl wird in denselben Phasen abgearbeitet; mit <em>Mikroschritt</em> sieht man sie einzeln:</p>
<ol>
  <li><strong>Holen:</strong> Der PC kommt auf den Adressbus, Wort 1 wandert über den Datenbus ins Befehlsregister,
    der PC wird um 1 erhöht. Dann dasselbe für den Adressteil (Wort 2).</li>
  <li><strong>Dekodieren:</strong> Das Steuerwerk erkennt Befehl und Adressierungsart.</li>
  <li><strong>Ausführen:</strong> je nach Befehl – Adresse nachschlagen (indirekt), Operand aus dem Speicher holen,
    im Rechenwerk rechnen, in den Speicher schreiben oder den PC für einen Sprung neu setzen.</li>
</ol>`,
    },
    {
      id: 'oberflaeche',
      title: 'Die Oberfläche',
      html: `
<p>Die App hat drei Bereiche – <strong>Programm</strong>, <strong>Maschine</strong> und <strong>Speicher</strong> –
die sich je nach Fenstergröße nebeneinander oder untereinander anordnen. Darüber liegen die Kopfzeile, die
Werkzeugleiste und die Statuszeile.</p>

<h3>Kopfzeile</h3>
<dl class="g-dl">
  <dt>Optionen</dt>
  <dd><strong>Detailansicht</strong> zeigt Werte zusätzlich hexadezimal und binär sowie den Opcode im Befehlsregister.
    <strong>Animationen</strong> lässt Werte bei Mikroschritten sichtbar über die Busse wandern.
    <strong>Erweiterter Modus</strong> schaltet Stackpointer und Stackbefehle ein.
    <strong>Anleitung</strong> öffnet diese Seite. Auf dem Handy liegt hier auch der Schalter für den dunklen Modus.</dd>
  <dt>Hell/Dunkel</dt>
  <dd>Wechselt das Farbschema. Ohne eigene Wahl folgt die App der Einstellung des Systems.</dd>
  <dt>Flagge</dt>
  <dd>Wechselt zwischen Deutsch und Englisch. Programm, Speicher und Maschinenzustand bleiben dabei erhalten.</dd>
  <dt>Vollbild</dt>
  <dd>Zeigt die App ohne Browserleisten (nur auf großen Bildschirmen und wenn der Browser es erlaubt).</dd>
</dl>

<h3>Werkzeugleiste</h3>
<dl class="g-dl">
  <dt>◀ Schritt zurück</dt><dd>Macht den letzten Befehl (oder Mikroschritt) rückgängig – auch mehrfach hintereinander.</dd>
  <dt>Schritt ▶</dt><dd>Führt genau einen Befehl aus. Ein angefangener Befehl (nach Mikroschritten) wird zu Ende geführt.</dd>
  <dt>Mikroschritt</dt><dd>Führt einen Teilschritt des Befehlszyklus aus und erklärt ihn unter dem Schaubild.</dd>
  <dt>▶▶ Ausführen / ❚❚ Pause</dt><dd>Startet bzw. unterbricht den Programmlauf.</dd>
  <dt>Zurücksetzen</dt><dd>Akku, Befehlszähler, Befehlsregister und Flags auf 0, SP auf 65534. Der Speicher bleibt.</dd>
  <dt>Tempo</dt><dd>Wie viele Befehle pro Sekunde „Ausführen“ abarbeitet: 1, 2, 5, 10, 50, 500 oder „Maximal“.</dd>
  <dt>Abbruch nach … s</dt><dd>Die Abbruchschranke (1–600 Sekunden, voreingestellt 5) schützt bei Tempo „Maximal“ vor Endlosschleifen.</dd>
</dl>

<h3>Statuszeile</h3>
<p>Sie sagt nach jeder Aktion, was passiert ist und was als Nächstes sinnvoll ist, und erklärt Fehler in
verständlichen Worten (z. B. warum die Maschine angehalten hat).</p>

<h3>Programm</h3>
<ul>
  <li><strong>Assemblieren</strong> (<kbd>F9</kbd>) löscht den Speicher, übersetzt das Programm und lädt es ab
    Adresse 0. Die CPU wird dabei zurückgesetzt.</li>
  <li><strong>… und Speicher behalten</strong> (<kbd>Umschalt</kbd>+<kbd>F9</kbd>) übersetzt ebenfalls, lässt aber
    alle Zellen stehen, die das Programm nicht selbst belegt – praktisch, wenn man vorher Werte von Hand in den
    Speicher geschrieben hat.</li>
  <li><strong>Datei</strong>: Öffnen, Speichern, Link teilen und Beispiel laden (siehe
    <a href="#anleitung/dateien">Speichern, Öffnen, Teilen</a>).</li>
  <li>Das <strong>Kopiersymbol</strong> kopiert den ganzen Programmtext in die Zwischenablage.</li>
  <li>Der Knopf rechts oben <strong>vergrößert</strong> den Bereich (mehr Platz für Code); <kbd>Esc</kbd> verkleinert wieder.</li>
  <li>Der Editor färbt Befehle, Marken, Zahlen und Kommentare ein, kennt <strong>Rückgängig/Wiederholen</strong>
    (<kbd>Strg</kbd>+<kbd>Z</kbd> / <kbd>Strg</kbd>+<kbd>Y</kbd>) und die Zwischenablage.</li>
  <li><strong>Hilfe:</strong> Zeigt man mit der Maus auf einen Befehl, erscheinen Wirkung, Flags und ein Beispiel.</li>
  <li><strong>Haltepunkte:</strong> Ein Klick auf eine Zeilennummer setzt einen Haltepunkt (noch ein Klick entfernt ihn).</li>
  <li>Die Zeile des nächsten Befehls ist gelb hinterlegt; nach einem Fehler wird die betroffene Zeile rot markiert.</li>
</ul>

<h3>Maschine</h3>
<p>Zwei Ansichten, umschaltbar über die Reiter:</p>
<ul>
  <li><strong>Schaubild:</strong> Prozessor mit Akkumulator, Rechenwerk (ALU, Y-förmig: oben links der Akku, oben rechts
    der zweite Operand, unten das Ergebnis), Steuerwerk und Registern; daneben der Speicher und die drei Busse.
    Bei Mikroschritten sieht man, welcher Wert gerade wohin wandert, und darunter eine Erklärung mit den konkreten
    Zahlen. Rechts steht ein Speicherausschnitt um den PC und um den letzten Adressteil (im erweiterten Modus auch um den SP).</li>
  <li><strong>Register:</strong> Akku, Befehlszähler (mit der zugehörigen Programmzeile), Befehlsregister (mit
    Adressierungsart), Flags und ggf. SP als Zahlen mit kurzer Erklärung – gut lesbar auch auf dem Handy.</li>
</ul>
<p>Mit dem Knopf rechts oben lässt sich auch die Maschine vergrößern.</p>

<h3>Speicher</h3>
<ul>
  <li><strong>Darstellung:</strong> <em>mit Vorzeichen</em>, <em>ohne Vorzeichen</em>, <em>hexadezimal</em> oder
    <em>als Befehle</em> (der Speicher wird paarweise ab Adresse 0 als Befehl + Adressteil gelesen – auch dort, wo
    eigentlich Daten stehen).</li>
  <li><strong>Ansicht:</strong> <em>dem PC folgen</em> (die Tabelle rollt mit), <em>Zum PC</em>, <em>Zum Adressteil</em>,
    <em>Zum SP</em> (erweitert), <em>Speicher löschen</em> und <em>Adressen hexadezimal</em>.</li>
  <li><strong>Gehe zu:</strong> Adresse (dezimal oder <code>0x…</code>) oder eine Marke eingeben und <kbd>Enter</kbd> drücken.</li>
  <li><strong>Markierungen:</strong> die Zelle, auf die der PC zeigt, die zuletzt geänderte Zelle und (erweitert) die
    Zelle, auf die der SP zeigt. Neben Zellen mit Marke steht der Markenname.</li>
  <li><strong>Zelle ändern:</strong> Zelle anklicken, neuen Wert eingeben (z. B. <code>42</code>, <code>-7</code> oder
    <code>0x2A</code>; in der Hex-Darstellung auch <code>2A</code>), <kbd>Enter</kbd> speichert, <kbd>Esc</kbd> bricht ab.
    Ein eigener Editiermodus wie im Original ist nicht nötig.</li>
  <li>Das <strong>Kopiersymbol</strong> kopiert den Speicher bis zur letzten belegten Zelle als Tabelle (z. B. für eine
    Tabellenkalkulation), ein benutzter Stack kommt als eigener Block dazu.</li>
</ul>
<p>Auf großen Bildschirmen lässt sich die Breite von Programm und Maschine an der Trennlinie ziehen;
ein Doppelklick stellt wieder halb und halb ein.</p>`,
    },
    {
      id: 'ausfuehren',
      title: 'Programme ausführen',
      html: `
<h3>Die drei Arten</h3>
<dl class="g-dl">
  <dt>Schritt ▶ (<kbd>F10</kbd>)</dt>
  <dd>Genau ein Befehl. Ideal, um einen Befehl vorzuführen oder ein Programm zu testen.</dd>
  <dt>Mikroschritt (<kbd>F11</kbd>)</dt>
  <dd>Ein Teilschritt von Holen – Dekodieren – Ausführen mit seiner Wirkung auf Register und Busse. Oben im Schaubild
  steht, in welcher Phase man ist (z. B. „Mikroschritt 2 von 5“). Ein <code>LOAD 20</code> braucht 5 Mikroschritte,
  ein <code>STORE 20</code> 4, mit indirekter Adressierung kommt einer dazu.</dd>
  <dt>▶▶ Ausführen (<kbd>F5</kbd>)</dt>
  <dd>Läuft im eingestellten Tempo, bis die Maschine anhält. <em>Pause</em> oder <kbd>Esc</kbd> unterbricht;
  danach geht es mit „Ausführen“ oder „Schritt“ weiter.</dd>
</dl>

<h3>Wann hält die Maschine an?</h3>
<ul>
  <li><strong><code>HALT</code></strong> (oder <code>HOLD</code>): Das Programm ist fertig. Der PC zeigt danach hinter den
    <code>HALT</code>-Befehl; im Editor bleibt die <code>HALT</code>-Zeile markiert.</li>
  <li><strong><code>RESET</code></strong> im Programm: Akku, PC und Flags werden 0, der <strong>ganze Speicher wird gelöscht</strong>
    (auch das Programm), die Maschine hält an. Zum erneuten Ausführen muss man neu assemblieren – oder mit „Schritt zurück“
    zurückgehen, das holt auch den Speicher wieder.</li>
  <li><strong>Ungültiger Befehl:</strong> An der Adresse steht kein gültiger Befehlscode – meistens, weil ein
    <code>HALT</code> fehlt und das Programm in den Datenbereich läuft.</li>
  <li><strong>Division durch 0</strong> bei <code>DIV</code>, <code>MOD</code>, <code>DIVU</code>, <code>MODU</code> (und
    den <code>…I</code>-Formen): Die Maschine hält am auslösenden Befehl an; Akku, Flags und Speicher bleiben unverändert.</li>
  <li><strong>Haltepunkt:</strong> „Ausführen“ stoppt <em>vor</em> einer Zeile mit Haltepunkt.</li>
  <li><strong>Abbruchschranke:</strong> Bei Tempo „Maximal“ wird das Programm nach der eingestellten Zeit angehalten
    (vermutlich eine Endlosschleife). Bei langsamerem Tempo greift sie nicht – man sieht ja, was passiert.</li>
</ul>
<p>Nach <code>HALT</code>, einem Fehler oder der Abbruchschranke sind „Ausführen“ und „Schritt“ gesperrt, bis man
<strong>Zurücksetzen</strong> drückt oder neu assembliert. „Schritt zurück“ funktioniert weiterhin – so kann man
untersuchen, wie es zum Fehler kam.</p>

<h3>Schritt zurück</h3>
<p>Jeder Schritt und jeder Mikroschritt lässt sich rückgängig machen, auch viele hintereinander. Das ist praktisch, um
eine Stelle noch einmal genau anzusehen. Wer eine Speicherzelle von Hand ändert, kann erst nach dem nächsten Schritt
wieder zurückgehen.</p>

<h3>Zurücksetzen, Speicher löschen, Assemblieren</h3>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Aktion</th><th scope="col">Akku, PC, Flags</th><th scope="col">Speicher</th></tr></thead>
  <tbody>
    <tr><th scope="row">Zurücksetzen</th><td>auf 0 (SP auf 65534)</td><td>bleibt</td></tr>
    <tr><th scope="row">Speicher löschen</th><td>bleiben</td><td>alles 0 (65534/65535 = −1)</td></tr>
    <tr><th scope="row">Assemblieren</th><td>auf 0</td><td>gelöscht, dann Programm ab Adresse 0</td></tr>
    <tr><th scope="row">Befehl <code>RESET</code> im Programm</th><td>auf 0, Maschine hält an</td><td>alles 0 (65534/65535 = −1) – auch das Programm</td></tr>
    <tr><th scope="row">… und Speicher behalten</th><td>auf 0</td><td>bleibt, nur die Programmzellen werden überschrieben</td></tr>
    <tr><th scope="row">Erweiterten Modus umschalten</th><td>auf 0</td><td>bleibt (danach neu assemblieren)</td></tr>
  </tbody>
</table></div>
<p>Wird das Programm nach dem Assemblieren geändert, weist die Statuszeile darauf hin: Ausgeführt wird immer das,
was im Speicher steht – also die zuletzt assemblierte Fassung. Man kann übrigens auch ganz ohne Assemblieren
Befehle von Hand in den Speicher schreiben und ausführen.</p>`,
    },
    {
      id: 'assembler',
      title: 'Die Assemblersprache',
      html: `
<h3>Ein-Adress-Maschine</h3>
<p>Die Minimaschine ist eine <strong>Ein-Adress-Maschine</strong>: Jeder Befehl hat höchstens einen Adressteil. Der
zweite Operand einer Rechnung ist immer der Akkumulator, und das Ergebnis landet wieder im Akku. Beispiel: <code>ADD x</code>
bedeutet „A ← A + Inhalt von x“.</p>

<h3>Programmaufbau</h3>
<p>Ein Programm ist eine Folge von Zeilen. Jede Zeile hat die Form</p>
<pre class="g-code g-syntax">[Marke:]  [Befehl  [Adressteil]]  [# Kommentar]</pre>
<ul>
  <li>Leere Zeilen und Zeilen, die nur eine Marke oder nur einen Kommentar enthalten, sind erlaubt.</li>
  <li><code>#</code> leitet einen <strong>Kommentar</strong> ein, der bis zum Zeilenende geht.</li>
  <li>Einrückung und Leerzeichen sind beliebig – sie dienen nur der Lesbarkeit.</li>
  <li>Der Assembler legt die Befehle <strong>ab Adresse 0 lückenlos</strong> in den Speicher (2 Zellen pro Befehl,
    1 Zelle pro <code>WORD</code>), in der Reihenfolge des Programmtextes. Daten gehören deshalb ans Ende,
    <strong>hinter</strong> das <code>HALT</code>.</li>
</ul>
<pre class="g-code" data-asm data-check="max=17"># Maximum von zwei Zahlen
        LOAD  a
        CMP   b            # rechnet a - b, setzt nur die Flags
        JGE   aGroesser    # a >= b ?
        LOAD  b            # nein: b ist größer
aGroesser:
        STORE max          # im Akku steht jetzt die größere Zahl
        HALT

# Datenteil
a:      WORD  17
b:      WORD  -4
max:    WORD  0</pre>

<h3>Befehle</h3>
<p>Befehle dürfen groß oder klein geschrieben werden (<code>LOAD</code>, <code>load</code>). Viele Befehle haben
eine <strong>Kurzform mit „I“</strong> (immediate) für eine feste Zahl: <code>ADDI 5</code> ist dasselbe wie
<code>ADD $5</code>. Einige Befehle haben zusätzlich einen zweiten Namen (z. B. <code>JGT</code> für <code>JMPP</code>,
<code>HOLD</code> für <code>HALT</code>, <code>CALL</code> für <code>JSR</code>).</p>

<h3>Marken</h3>
<ul>
  <li>Eine Marke wird mit Doppelpunkt vereinbart (<code>Schleife:</code>) und ohne Doppelpunkt benutzt (<code>JMP Schleife</code>).
    Der Assembler setzt dafür die Adresse ein – auch wenn die Marke erst weiter unten vereinbart wird.</li>
  <li>Erlaubt sind Buchstaben (auch Ä, Ö, Ü, ä, ö, ü, ß), Ziffern und <code>_</code>; am Anfang keine Ziffer.</li>
  <li><strong>Groß- und Kleinschreibung zählt:</strong> <code>Ende</code> und <code>ende</code> sind verschiedene Marken.</li>
  <li>Jede Marke darf nur einmal vereinbart werden. Im erweiterten Modus ist <code>SP</code> als Marke verboten.</li>
</ul>

<h3>Zahlen</h3>
<ul>
  <li>Dezimal (<code>42</code>) oder hexadezimal mit <code>0x</code> (<code>0x2A</code>, <code>0xFFFF</code>).</li>
  <li>Adressen liegen zwischen 0 und 65535.</li>
  <li>Negative Zahlen (bis −32768) gibt es bei festen Zahlen (<code>LOADI -7</code>, <code>ADD $-1</code>) und bei
    <code>WORD -5</code>. Eine negative Adresse wie <code>LOAD -1</code> ist ein Fehler.</li>
  <li>Bei <code>LOADI</code> und <code>WORD</code> darf statt einer Zahl auch eine Marke stehen – eingesetzt wird ihre
    Adresse (nützlich für Zeiger, siehe unten).</li>
</ul>

<h3>Adressierungsarten</h3>
<p>Die Adressierungsart legt fest, wie der Adressteil zum Operanden wird. Ihre Kennzahl steht im High-Byte von Wort 1.</p>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Art</th><th scope="col">Schreibweise</th><th scope="col">Operand</th><th scope="col">Kennzahl</th></tr></thead>
  <tbody>
    <tr><th scope="row">direkt</th><td><code>LOAD x</code></td><td>Inhalt der Zelle x</td><td>1</td></tr>
    <tr><th scope="row">unmittelbar (immediate)</th><td><code>LOAD $5</code> = <code>LOADI 5</code></td><td>die Zahl selbst</td><td>2</td></tr>
    <tr><th scope="row">indirekt</th><td><code>LOAD (x)</code></td><td>Zelle x enthält die Adresse des Operanden</td><td>3</td></tr>
    <tr><th scope="row">relativ zum SP<sup>E</sup></th><td><code>LOAD 2(SP)</code></td><td>Inhalt der Zelle SP + 2</td><td>4</td></tr>
    <tr><th scope="row">indirekt relativ zum SP<sup>E</sup></th><td><code>LOAD @2(SP)</code></td><td>Zelle SP + 2 enthält die Adresse des Operanden</td><td>5</td></tr>
    <tr><th scope="row">unmittelbar relativ zum SP<sup>E</sup></th><td><code>LOAD $2(SP)</code></td><td>die Zahl SP + 2 selbst</td><td>6</td></tr>
  </tbody>
</table></div>
<p class="g-muted"><sup>E</sup> nur im erweiterten Modus. Befehle ohne Adressteil haben die Kennzahl 0.
<code>STORE</code> kann nicht unmittelbar adressieren (wohin sollte er schreiben?). Sprünge und <code>JSR</code>
gibt es direkt (<code>JMP x</code>) und indirekt (<code>JMP (x)</code> springt zu der Adresse, die in x steht).</p>
<pre class="g-code" data-asm data-check="ergebnis=42">        LOAD  wert         # direkt: Inhalt von "wert" -> 42
        LOADI 7            # unmittelbar: die Zahl 7
        LOAD  $wert        # unmittelbar mit Marke: die ADRESSE von "wert"
        LOAD  (zeiger)     # indirekt: "zeiger" enthält die Adresse von "wert" -> 42
        STORE ergebnis
        HALT

wert:     WORD 42
zeiger:   WORD wert        # Startwert = Adresse der Marke "wert"
ergebnis: WORD 0</pre>

<h3>Listen mit indirekter Adressierung</h3>
<p>Mit einem Zeiger und indirekter Adressierung lässt sich eine Liste durchlaufen: Man erhöht den Zeiger in jedem
Durchgang um 1.</p>
<pre class="g-code" data-asm data-check="summe=9"># Summe aller Zahlen einer Liste (0 = Ende der Liste)
Schleife:
        LOAD  (zeiger)     # Listenelement holen
        JMPZ  Fertig       # 0? Dann ist die Liste zu Ende.
        ADD   summe
        STORE summe
        LOAD  zeiger
        ADDI  1            # Zeiger auf das nächste Element
        STORE zeiger
        JMP   Schleife
Fertig:
        HALT

zeiger: WORD liste
summe:  WORD 0
liste:  WORD 3
        WORD 8
        WORD -2
        WORD 0</pre>

<h3>Syntax in EBNF</h3>
<p>Die Grammatik der Assemblersprache, wie sie die Web-App versteht (Erweiterungen mit <sup>E</sup>):</p>
<pre class="g-code g-ebnf">Programm   = { Zeile } .
Zeile      = [ Marke ":" ] [ Befehl ] [ Kommentar ] Zeilenende .
Befehl     = Operation [ Adresse | "(" Adresse ")" | "$" Zahlwert
                       | Zahl "(SP)"ᴱ | "@" Zahl "(SP)"ᴱ | "$" Zahl "(SP)"ᴱ ] .
Adresse    = Marke | Zahl | HexZahl .
Zahlwert   = [ "-" ] ( Zahl | HexZahl ) | Marke .
Marke      = Buchstabe { Buchstabe | Ziffer } .
Buchstabe  = "A".."Z" | "a".."z" | "Ä" | "Ö" | "Ü" | "ä" | "ö" | "ü" | "ß" | "_" .
Zahl       = Ziffer { Ziffer } .
HexZahl    = "0" ( "x" | "X" ) Hexziffer { Hexziffer } .
Kommentar  = "#" { beliebiges Zeichen außer Zeilenende } .</pre>
<p class="g-muted">Operation ist einer der Befehlsnamen aus der Befehlsübersicht (auch die <code>…I</code>-Kurzformen,
die Zweitnamen und <code>WORD</code>). Bei den Kurzformen folgt die Zahl ohne <code>$</code>: <code>ADDI 5</code>.
Vor der Zahl bei <code>(SP)</code> darf ein Minus stehen.</p>`,
    },
    {
      id: 'befehle',
      title: 'Befehlsübersicht',
      html: `
<p>Alle Befehle nach Gruppen. Die Spalte <em>Adressteil</em> zeigt, was hinter dem Befehl stehen darf:
<code>adr</code> ist eine Adresse oder Marke, <code>$zahl</code> eine feste Zahl (dafür gibt es meist eine Kurzform:
<code>ADD $5</code> = <code>ADDI 5</code>), <code>(adr)</code> indirekt, <code>n(SP)</code> usw. relativ zum Stackpointer
(nur im erweiterten Modus, mit <sup>E</sup> markiert). Der Opcode ist das Low-Byte von Wort 1 – in der Detailansicht sieht man ihn im Befehlsregister.
Diese Tabellen werden direkt aus den Befehlsdefinitionen der App erzeugt; dieselben Texte erscheinen auch als
Hilfe im Editor.</p>
${g.instructionTables}`,
    },
    {
      id: 'flags',
      title: 'Flags und Vergleiche',
      html: `
<h3>Welche Befehle setzen welche Flags?</h3>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Befehle</th><th scope="col">Z</th><th scope="col">N</th><th scope="col">V</th><th scope="col">C</th></tr></thead>
  <tbody>
    <tr><th scope="row"><code>ADD</code></th><td>Ergebnis = 0</td><td>Ergebnis &lt; 0</td><td>Überlauf mit Vorzeichen</td><td>Übertrag ohne Vorzeichen</td></tr>
    <tr><th scope="row"><code>SUB</code>, <code>CMP</code></th><td>Ergebnis = 0</td><td>Ergebnis &lt; 0</td><td>Überlauf mit Vorzeichen</td><td>„Borgen“: A &lt; Operand (ohne Vorzeichen)</td></tr>
    <tr><th scope="row"><code>MUL</code></th><td>Ergebnis = 0</td><td>Ergebnis &lt; 0</td><td>Produkt passt nicht in −32768…32767</td><td>Produkt passt nicht in 0…65535</td></tr>
    <tr><th scope="row"><code>SHL</code></th><td>Ergebnis = 0</td><td>Ergebnis &lt; 0</td><td>0</td><td>zuletzt links hinausgeschobenes Bit</td></tr>
    <tr><th scope="row"><code>LOAD</code>, <code>LOADC</code>, <code>POP</code>, <code>DIV</code>, <code>MOD</code>, <code>MULH</code>,
      <code>AND</code>, <code>OR</code>, <code>XOR</code>, <code>NOT</code>, <code>SHR</code>, <code>SHRA</code></th>
      <td>Ergebnis = 0</td><td>Ergebnis &lt; 0</td><td>0</td><td>0</td></tr>
    <tr><th scope="row"><code>DIVU</code>, <code>MODU</code>, <code>MULHU</code></th><td>Ergebnis = 0</td><td>0</td><td>0</td><td>0</td></tr>
    <tr><th scope="row"><code>STORE</code>, alle Sprünge, <code>NOOP</code>, <code>HALT</code>, <code>PUSH</code>, <code>JSR</code>, <code>RTS</code>, <code>RSV</code>, <code>REL</code></th>
      <td colspan="4">unverändert</td></tr>
    <tr><th scope="row"><code>RESET</code></th><td colspan="4">alle 0</td></tr>
  </tbody>
</table></div>
<p>Wichtig: <code>CMP</code> rechnet wie <code>SUB</code> „Akku − Operand“ und setzt <strong>alle vier Flags</strong>
genauso – nur der Akku bleibt unverändert. (Das Original-Manual nennt nur Z und N; gemessen setzt das Original aber
auch V und C, und erst dadurch funktionieren die vorzeichenlosen Sprünge nach einem Vergleich.)</p>

<h3>Vergleichen und springen</h3>
<p>Das übliche Muster: <code>LOAD a</code>, <code>CMP b</code>, dann der passende Sprung. Welcher Sprung passt, hängt
davon ab, ob man die Zahlen <strong>mit</strong> oder <strong>ohne</strong> Vorzeichen vergleichen will:</p>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">springen, wenn …</th><th scope="col">mit Vorzeichen</th><th scope="col">ohne Vorzeichen</th></tr></thead>
  <tbody>
    <tr><th scope="row">a &gt; b</th><td><code>JGT</code> = <code>JMPP</code></td><td><code>JHI</code> (higher)</td></tr>
    <tr><th scope="row">a ≥ b</th><td><code>JGE</code> = <code>JMPNN</code></td><td><code>JHS</code> (higher or same)</td></tr>
    <tr><th scope="row">a &lt; b</th><td><code>JLT</code> = <code>JMPN</code></td><td><code>JLO</code> (lower)</td></tr>
    <tr><th scope="row">a ≤ b</th><td><code>JLE</code> = <code>JMPNP</code></td><td><code>JLS</code> (lower or same)</td></tr>
    <tr><th scope="row">a = b</th><td colspan="2"><code>JEQ</code> = <code>JMPZ</code></td></tr>
    <tr><th scope="row">a ≠ b</th><td colspan="2"><code>JNE</code> = <code>JMPNZ</code></td></tr>
  </tbody>
</table></div>
<p>Ohne <code>CMP</code> beziehen sich die Sprünge einfach auf das letzte Ergebnis: <code>JMPZ</code> nach
<code>LOAD n</code> springt, wenn n = 0 ist; <code>JMPN</code> nach <code>SUB x</code>, wenn das Ergebnis negativ war.</p>
<div class="g-note">
  <p><strong>Vorsicht bei Überlauf:</strong> Die Sprünge „mit Vorzeichen“ schauen nur auf N und Z, nicht auf V. Ist die
  Differenz zu groß für 16 Bit, stimmt das Vorzeichen nicht mehr. Beispiel: −32768 − 1 ergibt 32767 (V = 1, N = 0),
  also springt <code>JLT</code> nicht, obwohl −32768 &lt; 1 ist. Bei normalen Schulaufgaben kommt das kaum vor;
  mit <code>JMPV</code> kann man den Fall abfangen.</p>
</div>

<h3>Überlauf erkennen</h3>
<p><strong>V</strong> zeigt einen Überlauf, wenn man die Zahlen <em>mit Vorzeichen</em> liest:
32767 + 1 ergibt −32768, V = 1. <strong>C</strong> zeigt einen Überlauf <em>ohne Vorzeichen</em>:
65535 + 1 ergibt 0, C = 1 (mit Vorzeichen gelesen ist das −1 + 1 = 0, also kein V).
Mit <code>JMPV</code>/<code>JOV</code> und <code>JMPC</code>/<code>JOC</code> kann man darauf reagieren;
<code>LOADC</code> lädt das C-Flag als 0 oder 1 in den Akku.</p>

<h3>Besonderheiten beim Rechnen</h3>
<ul>
  <li><code>DIV</code> rundet Richtung 0 (−7 / 2 = −3); <code>MOD</code> hat das Vorzeichen des Dividenden (−7 mod 2 = −1).</li>
  <li><code>MUL</code> behält die unteren 16 Bit des Produkts. <code>MULHU</code> liefert die oberen 16 Bit (ohne Vorzeichen),
    <code>MULH</code> das Produkt mit Vorzeichen geteilt durch 65536, Richtung 0 gerundet.</li>
  <li>Schiebebefehle: Die Schiebeweite wird modulo 32 genommen; ab 16 Stellen ist das Ergebnis also meist 0
    (bzw. −1 bei <code>SHRA</code> mit negativer Zahl).</li>
</ul>`,
    },
    {
      id: 'erweitert',
      title: 'Erweiterter Modus (Stack)',
      html: `
<p>Über <em>Optionen → Erweiterter Modus</em> bekommt der Prozessor einen <strong>Stackpointer (SP)</strong>,
Befehle für Unterprogramme und den Stack sowie drei zusätzliche Adressierungsarten. Beim Umschalten wird die CPU
zurückgesetzt; danach muss man neu assemblieren. Stackbefehle ohne erweiterten Modus meldet der Assembler als Fehler.</p>

<h3>So funktioniert der Stack</h3>
<ul>
  <li>Der Stack liegt am oberen Ende des Speichers und <strong>wächst nach unten</strong>. Nach dem Zurücksetzen ist SP = 65534.</li>
  <li><code>PUSH</code>: erst SP − 1, dann Akku → Speicher[SP]. <code>POP</code>: erst Speicher[SP] → Akku, dann SP + 1.</li>
  <li><code>JSR adr</code> (auch <code>CALL</code>): SP − 1, die Rücksprungadresse (Adresse des nächsten Befehls) kommt auf
    den Stack, dann Sprung nach adr. <code>RTS</code> (auch <code>RETURN</code>): Adresse vom Stack in den PC, dann SP + 1.</li>
  <li><code>RSV $n</code> reserviert n Zellen (SP − n), z. B. für lokale Variablen; <code>REL $n</code> gibt sie wieder frei (SP + n).
    Die Anzahl steht wie im Original mit <code>$</code>; <code>RSV 3</code> ohne <code>$</code> ist ein Fehler.</li>
  <li>Mit <code>n(SP)</code> greift man auf Werte im Stack zu: <code>0(SP)</code> ist das oberste Element, <code>1(SP)</code>
    das darunter usw.</li>
</ul>
<p>Im Speicher ist die Zelle, auf die der SP zeigt, markiert; <em>Ansicht → Zum SP</em> springt dorthin. Im Schaubild
kommt ein Speicherausschnitt um den SP dazu.</p>

<h3>Beispiel: Unterprogramm mit Parameter</h3>
<pre class="g-code" data-asm="extended" data-check="ergebnis=42"># Unterprogramm "verdoppeln" – der Wert wird über den Stack übergeben
        LOAD  zahl
        PUSH               # Parameter auf den Stack
        JSR   verdoppeln
        POP                # Ergebnis vom Stack holen
        STORE ergebnis
        HALT

verdoppeln:
        LOAD  1(SP)        # 0(SP) = Rücksprungadresse, 1(SP) = Parameter
        ADD   1(SP)
        STORE 1(SP)        # Ergebnis an die Stelle des Parameters
        RTS

zahl:     WORD 21
ergebnis: WORD 0</pre>
<p>Ein weiteres Beispiel steht unter <em>Datei → Beispiel laden → Unterprogramm</em> (es schaltet den erweiterten
Modus automatisch ein).</p>`,
    },
    {
      id: 'dateien',
      title: 'Speichern, Öffnen, Teilen',
      html: `
<ul>
  <li><strong>Automatisch gespeichert:</strong> Das Programm im Editor und die Einstellungen werden im Browser
    gespeichert und sind beim nächsten Besuch wieder da – auch ohne Datei.</li>
  <li><strong>Speichern</strong> (<kbd>Strg</kbd>+<kbd>S</kbd>, Mac: <kbd>⌘</kbd>+<kbd>S</kbd>): als Datei mit der Endung
    <code>.mia</code> – dieselbe Endung wie im Original, die Dateien sind austauschbar. In Chrome und Edge wählt man den
    Speicherort und kann später in dieselbe Datei speichern; andere Browser legen die Datei im Download-Ordner ab.</li>
  <li><strong>Öffnen</strong> (<kbd>Strg</kbd>+<kbd>O</kbd>): lädt eine <code>.mia</code>-, <code>.txt</code>- oder
    <code>.asm</code>-Datei. Ungespeicherte Änderungen werden vorher abgefragt.</li>
  <li><strong>Link teilen:</strong> erzeugt einen Link, in dem das ganze Programm (und ob der erweiterte Modus nötig ist)
    steckt, und kopiert ihn. Wer ihn öffnet, sieht genau dieses Programm. Es wird nichts auf einem Server gespeichert.</li>
  <li><strong>Beispiel laden:</strong> Multiplikation, Summe, Maximum einer Liste, Fakultät, größter gemeinsamer Teiler
    und Unterprogramm.</li>
  <li><strong>Offline:</strong> Nach dem ersten Besuch funktioniert die Seite auch ohne Internet. Man kann sie im Browser
    „zum Startbildschirm hinzufügen“ bzw. als App installieren.</li>
  <li><strong>Link zu dieser Anleitung:</strong> Die Anleitung hat eine eigene Adresse (<code>…#anleitung</code>), jeder
    Abschnitt auch (z. B. <code>#anleitung/befehle</code>) – praktisch für Arbeitsblätter.</li>
</ul>`,
    },
    {
      id: 'tasten',
      title: 'Tastenkürzel',
      html: `
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Taste</th><th scope="col">Wirkung</th></tr></thead>
  <tbody>
    <tr><td><kbd>F9</kbd></td><td>Assemblieren</td></tr>
    <tr><td><kbd>Umschalt</kbd>+<kbd>F9</kbd></td><td>Assemblieren und Speicher behalten</td></tr>
    <tr><td><kbd>F10</kbd></td><td>Schritt</td></tr>
    <tr><td><kbd>Umschalt</kbd>+<kbd>F10</kbd></td><td>Schritt zurück</td></tr>
    <tr><td><kbd>F11</kbd></td><td>Mikroschritt</td></tr>
    <tr><td><kbd>F5</kbd></td><td>Ausführen / Pause</td></tr>
    <tr><td><kbd>Esc</kbd></td><td>laufendes Programm anhalten · Vergrößerung beenden · Menü oder Anleitung schließen</td></tr>
    <tr><td><kbd>Strg</kbd>+<kbd>O</kbd> / <kbd>Strg</kbd>+<kbd>S</kbd></td><td>Öffnen / Speichern (Mac: <kbd>⌘</kbd>)</td></tr>
    <tr><td><kbd>Strg</kbd>+<kbd>Z</kbd> / <kbd>Strg</kbd>+<kbd>Y</kbd></td><td>im Editor: rückgängig / wiederholen</td></tr>
    <tr><td><kbd>Enter</kbd> / <kbd>Esc</kbd></td><td>beim Ändern einer Speicherzelle: übernehmen / abbrechen</td></tr>
    <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>auf der Trennlinie: Breite ändern · auf den Reitern: Schaubild/Register wechseln</td></tr>
  </tbody>
</table></div>
<p class="g-muted">Auf dem Mac muss man für die F-Tasten meist zusätzlich <kbd>fn</kbd> drücken. Die Tastenkürzel
stehen auch auf den Knöpfen und in ihren Tooltips.</p>`,
    },
    {
      id: 'tipps',
      title: 'Häufige Fehler und Tipps',
      html: `
<dl class="g-dl">
  <dt>„An Adresse … steht kein gültiger Befehl“</dt>
  <dd>Meist fehlt ein <code>HALT</code>, und das Programm läuft in die Daten. Daten (<code>WORD</code>) gehören hinter
  das <code>HALT</code>. Auch ein Sprung an eine falsche Adresse führt hierher.</dd>
  <dt>Das Programm macht nicht, was im Editor steht</dt>
  <dd>Nach einer Änderung muss neu assembliert werden – ausgeführt wird der Speicherinhalt.</dd>
  <dt>„Die Marke … wird benutzt, aber nirgends festgelegt“</dt>
  <dd>Groß- und Kleinschreibung prüfen (<code>Ende</code> ≠ <code>ende</code>) und den Doppelpunkt bei der Vereinbarung.</dd>
  <dt>Das Programm hört nicht auf</dt>
  <dd>Wahrscheinlich eine Endlosschleife: <em>Pause</em> drücken und mit <em>Schritt</em> verfolgen, ob sich die
  Abbruchbedingung je erfüllt. Bei Tempo „Maximal“ hält die Abbruchschranke das Programm an.</dd>
  <dt>Der Sprung springt nicht</dt>
  <dd>Sprünge prüfen die Flags des <em>letzten</em> Befehls, der Flags setzt. <code>STORE</code> ändert keine Flags – nach
  <code>STORE</code> gelten noch die Flags des Befehls davor. Ein <code>LOAD</code> setzt sie dagegen neu.</dd>
  <dt>Ein Wert soll nur angesehen, nicht berechnet werden</dt>
  <dd><em>Gehe zu</em> mit dem Namen der Marke springt direkt zur Speicherzelle.</dd>
  <dt>Fehler eingrenzen</dt>
  <dd>Einen Haltepunkt vor die verdächtige Stelle setzen, <em>Ausführen</em>, dann mit <em>Schritt</em> weiter – und
  bei Bedarf mit <em>Schritt zurück</em> noch einmal ansehen.</dd>
</dl>`,
    },
    {
      id: 'original',
      title: 'Unterschiede zum Original',
      html: `
<p>Die Web-App verhält sich wie die Minimaschine 4.0 und versteht dieselben Assemblerprogramme. Ergebnisse und Flags
aller Befehle wurden mit dem Original abgeglichen. Unterschiede gibt es vor allem in der Bedienung:</p>
<h3>Nicht vorhanden</h3>
<ul>
  <li>Kein Compiler für <strong>Pseudocode</strong> und die alte <strong>Minisprache</strong> (und damit auch keine
    „Assemblertext anzeigen“-Funktion). Dafür bitte das Original benutzen.</li>
  <li>Nur ein Programm gleichzeitig, keine eigenen Fenster, keine Schriftwahl und kein Drucken aus der App.</li>
</ul>
<h3>Zusätzlich in der Web-App</h3>
<ul>
  <li>Schritt zurück, Haltepunkte, Fehlermeldungen mit Erklärung (alle Fehler auf einmal), Befehlshilfe im Editor.</li>
  <li>Schaubild mit animierten Mikroschritten und Erklärtext, Register-Ansicht.</li>
  <li>Tempo einstellbar; Gehe zu Adresse oder Marke; Kopieren von Programm und Speicher.</li>
  <li>Automatisches Speichern, Link teilen, Offline-Nutzung, Deutsch/Englisch, dunkler Modus, Vollbild.</li>
</ul>
<h3>Anderes Verhalten</h3>
<ul>
  <li><strong>Division durch 0:</strong> Die Maschine hält mit einer Meldung am Befehl an (Original: Rücksetzen bzw. Weiterlaufen).</li>
  <li><strong>Abbruchschranke:</strong> greift nur bei Tempo „Maximal“.</li>
  <li><strong>Speicher bearbeiten</strong> geht immer, ohne eigenen Editiermodus.</li>
  <li><strong>Strengerer Assembler:</strong> Zahlen außerhalb von 16 Bit, <code>+5</code> oder unpassende Adressierungsarten
    (z. B. <code>NOOP 5</code>) sind Fehler beim Assemblieren statt erst beim Ausführen. Gemischte Schreibweise wie
    <code>Load</code> ist dagegen erlaubt.</li>
  <li><strong>Darstellung „als Befehle“</strong> zeigt die Eingabeschreibweise (<code>LOAD (11)</code> statt
    <code>LOAD @ 11</code>), damit man sie direkt in den Editor kopieren kann; hexadezimal erscheint als <code>0x00FF</code>.</li>
  <li><strong>Mikroschritte</strong> sind etwas anders aufgeteilt (z. B. ein eigener Schritt „Adresse berechnen“ bei
    SP-Adressierung, kein eigener Abschlussschritt).</li>
</ul>
<p class="g-muted">Diese Web-App ist ein inoffizielles Projekt und kein Produkt von A. Wiedemann. Sie wurde größtenteils
mit Hilfe einer KI programmiert und mit vielen Tests gegen das Original geprüft – im Zweifel gilt das Original.</p>`,
    },
  ];
}
