/**
 * English guide – the same sections and examples as de.ts.
 */
import type { GuideGenerated, GuideSection } from './content';

export function sectionsEn(g: GuideGenerated): GuideSection[] {
  return [
    {
      id: 'ueberblick',
      title: 'Overview',
      html: `
<p>The <strong>Minimaschine</strong> is a model computer for computer science lessons: a heavily simplified 16-bit
processor that shows what happens inside a real computer. You write small programs in <strong>assembly language</strong>,
translate them into machine code and run them instruction by instruction – or even micro step by micro step.</p>
<p>The processor is a typical <strong>register machine with an accumulator</strong>. It can work in three ways:</p>
<ul>
  <li><strong>Single step:</strong> each instruction is executed on its own.</li>
  <li><strong>Micro step:</strong> the phases of the instruction cycle (fetch – decode – execute) are shown one by one.</li>
  <li><strong>Run:</strong> instructions are executed until the machine reaches <code>HALT</code>, an invalid instruction or a breakpoint.</li>
</ul>
<p>An <strong>extended mode</strong> adds a stack pointer, stack instructions and subroutines
(see <a href="#guide/erweitert">Extended mode</a>).</p>
<div class="g-note">
  <p><strong>Where does the Minimaschine come from?</strong> The original was created by Albert Wiedemann for the
  Bavarian curriculum (grades 12/13, topic “register machine”). The program, its manual and more material are available
  at <a href="https://schule.awiedemann.de/" target="_blank" rel="noopener">schule.awiedemann.de</a> (in German).</p>
  <p>This web app is an <strong>independent, unofficial re-creation</strong> of the Minimaschine 4.0. It understands the
  same assembly programs but was written from scratch. The differences are listed under
  <a href="#guide/original">Differences from the original</a>.</p>
</div>
<p>This guide summarises the user manual of the original, checks it against the web app and adds everything that only
exists here (e.g. “Step back”, breakpoints, sharing links). The instruction reference is generated directly from the
app’s instruction definitions, so it is always correct.</p>
<p class="g-muted">Not included: the original can also translate <em>pseudocode</em> and the older <em>Minisprache</em>
into assembly automatically. The web app does not have this compiler (yet) – here you program in assembly only.</p>`,
    },
    {
      id: 'schnellstart',
      title: 'Quick start',
      html: `
<ol class="g-steps">
  <li><strong>Write a program</strong> – in the <em>Program</em> area on the left. Or load a ready-made one:
    <em>File → Load an example</em>.</li>
  <li><strong>Assemble</strong> (<kbd>F9</kbd>): the program is translated into machine code and written into memory
    starting at address 0. Errors are listed with an explanation below the editor and underlined in red in the text.</li>
  <li><strong>Step ▶</strong> (<kbd>F10</kbd>) executes exactly one instruction. Watch how accumulator, program counter,
    flags and memory change.</li>
  <li><strong>▶▶ Run</strong> (<kbd>F5</kbd>) runs the program until <code>HALT</code>. The speed can be set;
    <em>Pause</em> or <kbd>Esc</kbd> stops it.</li>
  <li><strong>Reset</strong> sets accumulator, program counter and flags to 0 – afterwards the program can run again
    from the start. The memory is kept.</li>
</ol>
<p>A first program to try – it computes 5 + 4 + 3 + 2 + 1:</p>
<pre class="g-code" data-asm data-check="sum=15"># Sum 1 + 2 + … + n
        LOADI 0
        STORE sum          # sum = 0
loop:
        LOAD  n
        JMPZ  done         # n = 0? Then we are done.
        ADD   sum
        STORE sum          # sum = sum + n
        LOAD  n
        SUBI  1
        STORE n            # n = n - 1
        JMP   loop
done:
        HALT

n:      WORD 5
sum:    WORD 0</pre>
<p>After running it, the memory cell <code>sum</code> contains 15. Tip: switch on “follow the PC” in the memory view and click
<em>Step ▶</em> a few times to see how the loop works.</p>`,
    },
    {
      id: 'aufbau',
      title: 'How the machine is built',
      html: `
<h3>Memory</h3>
<p>The memory has <strong>65,536 cells</strong> (addresses 0 to 65535, i.e. “64K”). Each cell holds a
<strong>16-bit word</strong> – read as signed −32768 to 32767, read as unsigned 0 to 65535.
Program and data share the same memory (von Neumann architecture).</p>
<p>After start-up, after “Clear memory” and when assembling, all cells are 0 – only the two topmost cells 65534 and
65535 contain −1 (0xFFFF). A program without <code>HALT</code> that runs through empty memory stops there with
“invalid instruction”.</p>

<h3>Registers of the processor</h3>
<dl class="g-dl">
  <dt>Accumulator (A)</dt>
  <dd>The only arithmetic register. Before a calculation it holds the first operand, afterwards the result. For memory
  instructions it is the target (<code>LOAD</code>) or the source (<code>STORE</code>).</dd>
  <dt>Program counter (PC)</dt>
  <dd>Address of the next instruction to fetch.</dd>
  <dt>Instruction register</dt>
  <dd>The instruction fetched last: operation code, addressing mode and address part.</dd>
  <dt>Status register (flags)</dt>
  <dd>Four bits that describe the result of the last calculation and control the conditional jumps:
    <ul>
      <li><strong>Z</strong> (zero) – the result was 0</li>
      <li><strong>N</strong> (negative) – the result was negative (bit 15 set)</li>
      <li><strong>V</strong> (overflow) – overflow in <em>signed</em> arithmetic</li>
      <li><strong>C</strong> (carry) – overflow in <em>unsigned</em> arithmetic, or “borrow” when subtracting</li>
    </ul>
    Which instruction sets which flags is listed under <a href="#guide/flags">Flags and comparisons</a>.</dd>
  <dt>Stack pointer (SP)</dt>
  <dd>Extended mode only: points to the top element of the stack. Start value 65534.</dd>
</dl>

<h3>Buses</h3>
<p>Processor and memory are connected by three buses, shown in colour in the diagram:</p>
<ul>
  <li><strong>Address bus:</strong> the processor puts the address of the cell it wants to read or write on it.</li>
  <li><strong>Data bus:</strong> the value travels on it – from memory to the processor or the other way round.</li>
  <li><strong>Control bus:</strong> it tells the direction: <em>read</em> or <em>write</em>.</li>
</ul>

<h3>How an instruction is stored</h3>
<p>Every instruction takes <strong>two consecutive memory cells</strong>:</p>
<ul>
  <li><strong>Word 1:</strong> what to do – <code>addressing mode · 256 + opcode</code></li>
  <li><strong>Word 2:</strong> the address part (0 for instructions without an address)</li>
</ul>
<p>Since every instruction has the same length, the processor can load it completely before decoding it. Examples:
<code>LOAD 11</code> → 276 (0x0114) and 11; <code>LOADI 11</code> → 532 (0x0214) and 11; <code>NOT</code> → 56 and 0.
The opcodes are in the <a href="#guide/befehle">instruction reference</a>; the codes of the addressing modes are under
<a href="#guide/assembler">The assembly language</a>.</p>
<p>Jumps use absolute addresses across the whole memory – there is no difference between short and long jumps.</p>

<h3>The instruction cycle</h3>
<p>Every instruction goes through the same phases; <em>Micro step</em> shows them one by one:</p>
<ol>
  <li><strong>Fetch:</strong> the PC goes onto the address bus, word 1 travels over the data bus into the instruction
    register, the PC is increased by 1. Then the same for the address part (word 2).</li>
  <li><strong>Decode:</strong> the control unit recognises the instruction and the addressing mode.</li>
  <li><strong>Execute:</strong> depending on the instruction – look up the address (indirect), fetch the operand from
    memory, calculate in the ALU, write to memory or set the PC for a jump.</li>
</ol>`,
    },
    {
      id: 'oberflaeche',
      title: 'The user interface',
      html: `
<p>The app has three areas – <strong>Program</strong>, <strong>Machine</strong> and <strong>Memory</strong> – which are
arranged side by side or one below the other depending on the window size. Above them are the header, the toolbar and
the status line.</p>

<h3>Header</h3>
<dl class="g-dl">
  <dt>Options</dt>
  <dd><strong>Details</strong> also shows values in hex and binary, and the opcode in the instruction register.
    <strong>Animations</strong> lets values visibly travel over the buses during micro steps.
    <strong>Extended mode</strong> switches on the stack pointer and the stack instructions.
    <strong>Guide</strong> opens this page. On phones, the dark mode switch is here as well.</dd>
  <dt>Light/dark</dt>
  <dd>Changes the colour scheme. Without your own choice the app follows the system setting.</dd>
  <dt>Flag</dt>
  <dd>Switches between German and English. Program, memory and machine state are kept.</dd>
  <dt>Full screen</dt>
  <dd>Shows the app without browser bars (large screens only, and only if the browser allows it).</dd>
</dl>

<h3>Toolbar</h3>
<dl class="g-dl">
  <dt>◀ Step back</dt><dd>Undoes the last instruction (or micro step) – also many times in a row.</dd>
  <dt>Step ▶</dt><dd>Executes exactly one instruction. An instruction that was started with micro steps is completed.</dd>
  <dt>Micro step</dt><dd>Executes one part of the instruction cycle and explains it below the diagram.</dd>
  <dt>▶▶ Run / ❚❚ Pause</dt><dd>Starts or interrupts the program.</dd>
  <dt>Reset</dt><dd>Accumulator, program counter, instruction register and flags to 0, SP to 65534. The memory is kept.</dd>
  <dt>Speed</dt><dd>How many instructions per second “Run” executes: 1, 2, 5, 10, 50, 500 or “Maximum”.</dd>
  <dt>Stop after … s</dt><dd>The time limit (1–600 seconds, default 5) protects against endless loops at maximum speed.</dd>
</dl>

<h3>Status line</h3>
<p>After every action it says what happened and what makes sense next, and explains errors in plain words (e.g. why
the machine stopped).</p>

<h3>Program</h3>
<ul>
  <li><strong>Assemble</strong> (<kbd>F9</kbd>) clears the memory, translates the program and loads it starting at
    address 0. The CPU is reset.</li>
  <li><strong>… and keep memory</strong> (<kbd>Shift</kbd>+<kbd>F9</kbd>) also translates, but leaves all cells alone
    that the program does not use itself – handy if you have typed values into memory by hand before.</li>
  <li><strong>File</strong>: open, save, share link and load example (see <a href="#guide/dateien">Save, open, share</a>).</li>
  <li>The <strong>copy icon</strong> copies the whole program text to the clipboard.</li>
  <li>The button at the top right <strong>enlarges</strong> the area (more room for code); <kbd>Esc</kbd> shrinks it again.</li>
  <li>The editor colours instructions, labels, numbers and comments, supports <strong>undo/redo</strong>
    (<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd>) and the clipboard.</li>
  <li><strong>Help:</strong> hover over an instruction to see its effect, flags and an example.</li>
  <li><strong>Breakpoints:</strong> click a line number to set a breakpoint (click again to remove it).</li>
  <li>The line of the next instruction is highlighted in yellow; after an error the line concerned is marked in red.</li>
</ul>

<h3>Machine</h3>
<p>Two views, switched with the tabs:</p>
<ul>
  <li><strong>Diagram:</strong> processor with accumulator, ALU (Y-shaped: accumulator at the top left, second operand
    at the top right, result at the bottom), control unit and registers; next to it the memory and the three buses.
    During micro steps you see which value is moving where, with an explanation using the actual numbers below.
    On the right there is a memory excerpt around the PC and around the last address part (in extended mode also around the SP).</li>
  <li><strong>Registers:</strong> accumulator, program counter (with its program line), instruction register (with
    addressing mode), flags and, if needed, SP as numbers with a short explanation – easy to read on phones too.</li>
</ul>
<p>The button at the top right enlarges the machine as well.</p>

<h3>Memory</h3>
<ul>
  <li><strong>Display:</strong> <em>signed</em>, <em>unsigned</em>, <em>hexadecimal</em> or <em>as instructions</em>
    (memory is read in pairs from address 0 as instruction + address part – even where there is actually data).</li>
  <li><strong>View:</strong> <em>follow the PC</em> (the table scrolls along), <em>To PC</em>, <em>To address part</em>,
    <em>To SP</em> (extended), <em>Clear memory</em> and <em>hex addresses</em>.</li>
  <li><strong>Go to:</strong> type an address (decimal or <code>0x…</code>) or a label and press <kbd>Enter</kbd>.</li>
  <li><strong>Highlights:</strong> the cell the PC points to, the cell changed last and (extended) the cell the SP points
    to. Cells with a label show the label name.</li>
  <li><strong>Change a cell:</strong> click it, type the new value (e.g. <code>42</code>, <code>-7</code> or
    <code>0x2A</code>; in the hex display also <code>2A</code>), <kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels.
    No separate edit mode as in the original is needed.</li>
  <li>The <strong>copy icon</strong> copies the memory up to the last used cell as a table (e.g. for a spreadsheet);
    a used stack is added as a separate block.</li>
</ul>
<p>On large screens you can drag the divider to change the width of program and machine; a double click makes them
equal again.</p>`,
    },
    {
      id: 'ausfuehren',
      title: 'Running programs',
      html: `
<h3>Three ways</h3>
<dl class="g-dl">
  <dt>Step ▶ (<kbd>F10</kbd>)</dt>
  <dd>Exactly one instruction. Ideal to demonstrate an instruction or to test a program.</dd>
  <dt>Micro step (<kbd>F11</kbd>)</dt>
  <dd>One part of fetch – decode – execute with its effect on registers and buses. The diagram shows which phase you
  are in (e.g. “micro step 2 of 5”). A <code>LOAD 20</code> needs 5 micro steps, a <code>STORE 20</code> 4; indirect
  addressing adds one.</dd>
  <dt>▶▶ Run (<kbd>F5</kbd>)</dt>
  <dd>Runs at the chosen speed until the machine stops. <em>Pause</em> or <kbd>Esc</kbd> interrupts it; continue with
  “Run” or “Step”.</dd>
</dl>

<h3>When does the machine stop?</h3>
<ul>
  <li><strong><code>HALT</code></strong> (or <code>HOLD</code>): the program is finished. Afterwards the PC points behind
    the <code>HALT</code> instruction; the editor keeps the <code>HALT</code> line highlighted.</li>
  <li><strong><code>RESET</code></strong> in the program: accumulator, PC and flags become 0, the <strong>whole memory is
    cleared</strong> (the program, too), the machine stops. To run it again you have to assemble again – or go back with
    “Step back”, which brings the memory back as well.</li>
  <li><strong>Invalid instruction:</strong> there is no valid instruction code at the address – usually because a
    <code>HALT</code> is missing and the program runs into the data.</li>
  <li><strong>Division by 0</strong> with <code>DIV</code>, <code>MOD</code>, <code>DIVU</code>, <code>MODU</code> (and the
    <code>…I</code> forms): the machine stops at that instruction; accumulator, flags and memory stay unchanged.</li>
  <li><strong>Breakpoint:</strong> “Run” stops <em>before</em> a line with a breakpoint.</li>
  <li><strong>Time limit:</strong> at maximum speed the program is stopped after the set time (probably an endless
    loop). At slower speeds it does not apply – you can see what is happening.</li>
</ul>
<p>After <code>HALT</code>, an error or the time limit, “Run” and “Step” are blocked until you press <strong>Reset</strong>
or assemble again. “Step back” still works – so you can examine how the error came about.</p>

<h3>Step back</h3>
<p>Every step and every micro step can be undone, also many in a row. This is useful to look at a place again closely.
After changing a memory cell by hand, you can only go back again after the next step.</p>

<h3>Reset, clear memory, assemble</h3>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Action</th><th scope="col">Accumulator, PC, flags</th><th scope="col">Memory</th></tr></thead>
  <tbody>
    <tr><th scope="row">Reset</th><td>to 0 (SP to 65534)</td><td>kept</td></tr>
    <tr><th scope="row">Clear memory</th><td>kept</td><td>all 0 (65534/65535 = −1)</td></tr>
    <tr><th scope="row">Assemble</th><td>to 0</td><td>cleared, then program from address 0</td></tr>
    <tr><th scope="row">Instruction <code>RESET</code> in the program</th><td>to 0, machine stops</td><td>all 0 (65534/65535 = −1) – the program, too</td></tr>
    <tr><th scope="row">… and keep memory</th><td>to 0</td><td>kept, only the program cells are overwritten</td></tr>
    <tr><th scope="row">Switch extended mode</th><td>to 0</td><td>kept (assemble again afterwards)</td></tr>
  </tbody>
</table></div>
<p>If the program is changed after assembling, the status line points it out: the machine always executes what is in
memory – i.e. the version assembled last. By the way, you can also write instructions into memory by hand and run them
without assembling at all.</p>`,
    },
    {
      id: 'assembler',
      title: 'The assembly language',
      html: `
<h3>One-address machine</h3>
<p>The Minimaschine is a <strong>one-address machine</strong>: every instruction has at most one address part. The other
operand of a calculation is always the accumulator, and the result goes back into the accumulator. Example:
<code>ADD x</code> means “A ← A + content of x”.</p>

<h3>Program structure</h3>
<p>A program is a sequence of lines. Each line has the form</p>
<pre class="g-code g-syntax">[label:]  [instruction  [address part]]  [# comment]</pre>
<ul>
  <li>Empty lines and lines with only a label or only a comment are allowed.</li>
  <li><code>#</code> starts a <strong>comment</strong> that runs to the end of the line.</li>
  <li>Indentation and spaces are free – they are only for readability.</li>
  <li>The assembler puts the instructions into memory <strong>from address 0 without gaps</strong> (2 cells per
    instruction, 1 cell per <code>WORD</code>), in the order of the program text. Data therefore belongs at the end,
    <strong>after</strong> the <code>HALT</code>.</li>
</ul>
<pre class="g-code" data-asm data-check="max=17"># Maximum of two numbers
        LOAD  a
        CMP   b            # computes a - b, only sets the flags
        JGE   aBigger      # a >= b ?
        LOAD  b            # no: b is bigger
aBigger:
        STORE max          # the accumulator now holds the bigger number
        HALT

# data
a:      WORD  17
b:      WORD  -4
max:    WORD  0</pre>

<h3>Instructions</h3>
<p>Instructions may be written in upper or lower case (<code>LOAD</code>, <code>load</code>). Many instructions have a
<strong>short form ending in “I”</strong> (immediate) for a fixed number: <code>ADDI 5</code> is the same as
<code>ADD $5</code>. Some instructions also have a second name (e.g. <code>JGT</code> for <code>JMPP</code>,
<code>HOLD</code> for <code>HALT</code>, <code>CALL</code> for <code>JSR</code>).</p>

<h3>Labels</h3>
<ul>
  <li>A label is defined with a colon (<code>loop:</code>) and used without it (<code>JMP loop</code>). The assembler
    puts in its address – even if the label is defined further down.</li>
  <li>Allowed are letters (also Ä, Ö, Ü, ä, ö, ü, ß), digits and <code>_</code>; no digit at the start.</li>
  <li><strong>Case matters:</strong> <code>End</code> and <code>end</code> are different labels.</li>
  <li>Each label may be defined only once. In extended mode <code>SP</code> cannot be used as a label.</li>
</ul>

<h3>Numbers</h3>
<ul>
  <li>Decimal (<code>42</code>) or hexadecimal with <code>0x</code> (<code>0x2A</code>, <code>0xFFFF</code>).</li>
  <li>Addresses go from 0 to 65535.</li>
  <li>Negative numbers (down to −32768) are allowed for fixed numbers (<code>LOADI -7</code>, <code>ADD $-1</code>) and
    for <code>WORD -5</code>. A negative address such as <code>LOAD -1</code> is an error.</li>
  <li>With <code>LOADI</code> and <code>WORD</code> a label may be used instead of a number – its address is used
    (useful for pointers, see below).</li>
</ul>

<h3>Addressing modes</h3>
<p>The addressing mode defines how the address part becomes the operand. Its code is in the high byte of word 1.</p>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Mode</th><th scope="col">Syntax</th><th scope="col">Operand</th><th scope="col">Code</th></tr></thead>
  <tbody>
    <tr><th scope="row">direct</th><td><code>LOAD x</code></td><td>content of cell x</td><td>1</td></tr>
    <tr><th scope="row">immediate</th><td><code>LOAD $5</code> = <code>LOADI 5</code></td><td>the number itself</td><td>2</td></tr>
    <tr><th scope="row">indirect</th><td><code>LOAD (x)</code></td><td>cell x holds the address of the operand</td><td>3</td></tr>
    <tr><th scope="row">relative to SP<sup>E</sup></th><td><code>LOAD 2(SP)</code></td><td>content of cell SP + 2</td><td>4</td></tr>
    <tr><th scope="row">indirect relative to SP<sup>E</sup></th><td><code>LOAD @2(SP)</code></td><td>cell SP + 2 holds the address of the operand</td><td>5</td></tr>
    <tr><th scope="row">immediate relative to SP<sup>E</sup></th><td><code>LOAD $2(SP)</code></td><td>the number SP + 2 itself</td><td>6</td></tr>
  </tbody>
</table></div>
<p class="g-muted"><sup>E</sup> extended mode only. Instructions without an address part have code 0.
<code>STORE</code> cannot use immediate addressing (where would it write?). Jumps and <code>JSR</code> exist as
direct (<code>JMP x</code>) and indirect (<code>JMP (x)</code> jumps to the address stored in x).</p>
<pre class="g-code" data-asm data-check="result=42">        LOAD  value        # direct: content of "value" -> 42
        LOADI 7            # immediate: the number 7
        LOAD  $value       # immediate with a label: the ADDRESS of "value"
        LOAD  (pointer)    # indirect: "pointer" holds the address of "value" -> 42
        STORE result
        HALT

value:   WORD 42
pointer: WORD value        # start value = address of the label "value"
result:  WORD 0</pre>

<h3>Lists with indirect addressing</h3>
<p>With a pointer and indirect addressing you can walk through a list: increase the pointer by 1 in every round.</p>
<pre class="g-code" data-asm data-check="sum=9"># Sum of all numbers in a list (0 = end of the list)
loop:
        LOAD  (pointer)    # get the list element
        JMPZ  done         # 0? Then the list is over.
        ADD   sum
        STORE sum
        LOAD  pointer
        ADDI  1            # pointer to the next element
        STORE pointer
        JMP   loop
done:
        HALT

pointer: WORD list
sum:     WORD 0
list:    WORD 3
         WORD 8
         WORD -2
         WORD 0</pre>

<h3>Syntax in EBNF</h3>
<p>The grammar of the assembly language as the web app understands it (extensions marked <sup>E</sup>):</p>
<pre class="g-code g-ebnf">Program     = { Line } .
Line        = [ Label ":" ] [ Instruction ] [ Comment ] EndOfLine .
Instruction = Operation [ Address | "(" Address ")" | "$" Value
                        | Number "(SP)"ᴱ | "@" Number "(SP)"ᴱ | "$" Number "(SP)"ᴱ ] .
Address     = Label | Number | HexNumber .
Value       = [ "-" ] ( Number | HexNumber ) | Label .
Label       = Letter { Letter | Digit } .
Letter      = "A".."Z" | "a".."z" | "Ä" | "Ö" | "Ü" | "ä" | "ö" | "ü" | "ß" | "_" .
Number      = Digit { Digit } .
HexNumber   = "0" ( "x" | "X" ) HexDigit { HexDigit } .
Comment     = "#" { any character except end of line } .</pre>
<p class="g-muted">Operation is one of the instruction names from the instruction reference (including the <code>…I</code>
short forms, the second names and <code>WORD</code>). With the short forms the number follows without <code>$</code>:
<code>ADDI 5</code>. The number before <code>(SP)</code> may have a minus sign.</p>`,
    },
    {
      id: 'befehle',
      title: 'Instruction reference',
      html: `
<p>All instructions by group. The column <em>address part</em> shows what may follow the instruction:
<code>adr</code> is an address or label, <code>$num</code> a fixed number (usually there is a short form for it:
<code>ADD $5</code> = <code>ADDI 5</code>), <code>(adr)</code> indirect, <code>n(SP)</code> etc. relative to the stack
pointer (extended mode only, marked <sup>E</sup>). The opcode is
the low byte of word 1 – with “Details” switched on you see it in the instruction register. These tables are generated
directly from the app’s instruction definitions; the same texts appear as help in the editor.</p>
${g.instructionTables}`,
    },
    {
      id: 'flags',
      title: 'Flags and comparisons',
      html: `
<h3>Which instructions set which flags?</h3>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Instructions</th><th scope="col">Z</th><th scope="col">N</th><th scope="col">V</th><th scope="col">C</th></tr></thead>
  <tbody>
    <tr><th scope="row"><code>ADD</code></th><td>result = 0</td><td>result &lt; 0</td><td>signed overflow</td><td>unsigned carry</td></tr>
    <tr><th scope="row"><code>SUB</code>, <code>CMP</code></th><td>result = 0</td><td>result &lt; 0</td><td>signed overflow</td><td>“borrow”: A &lt; operand (unsigned)</td></tr>
    <tr><th scope="row"><code>MUL</code></th><td>result = 0</td><td>result &lt; 0</td><td>product does not fit into −32768…32767</td><td>product does not fit into 0…65535</td></tr>
    <tr><th scope="row"><code>SHL</code></th><td>result = 0</td><td>result &lt; 0</td><td>0</td><td>last bit shifted out on the left</td></tr>
    <tr><th scope="row"><code>LOAD</code>, <code>LOADC</code>, <code>POP</code>, <code>DIV</code>, <code>MOD</code>, <code>MULH</code>,
      <code>AND</code>, <code>OR</code>, <code>XOR</code>, <code>NOT</code>, <code>SHR</code>, <code>SHRA</code></th>
      <td>result = 0</td><td>result &lt; 0</td><td>0</td><td>0</td></tr>
    <tr><th scope="row"><code>DIVU</code>, <code>MODU</code>, <code>MULHU</code></th><td>result = 0</td><td>0</td><td>0</td><td>0</td></tr>
    <tr><th scope="row"><code>STORE</code>, all jumps, <code>NOOP</code>, <code>HALT</code>, <code>PUSH</code>, <code>JSR</code>, <code>RTS</code>, <code>RSV</code>, <code>REL</code></th>
      <td colspan="4">unchanged</td></tr>
    <tr><th scope="row"><code>RESET</code></th><td colspan="4">all 0</td></tr>
  </tbody>
</table></div>
<p>Important: <code>CMP</code> computes “accumulator − operand” like <code>SUB</code> and sets <strong>all four flags</strong>
the same way – only the accumulator stays unchanged. (The original manual only mentions Z and N; measured on the
original, it sets V and C as well, and only that makes the unsigned jumps work after a comparison.)</p>

<h3>Compare and jump</h3>
<p>The usual pattern: <code>LOAD a</code>, <code>CMP b</code>, then the matching jump. Which jump matches depends on
whether you compare the numbers as <strong>signed</strong> or <strong>unsigned</strong>:</p>
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">jump if …</th><th scope="col">signed</th><th scope="col">unsigned</th></tr></thead>
  <tbody>
    <tr><th scope="row">a &gt; b</th><td><code>JGT</code> = <code>JMPP</code></td><td><code>JHI</code> (higher)</td></tr>
    <tr><th scope="row">a ≥ b</th><td><code>JGE</code> = <code>JMPNN</code></td><td><code>JHS</code> (higher or same)</td></tr>
    <tr><th scope="row">a &lt; b</th><td><code>JLT</code> = <code>JMPN</code></td><td><code>JLO</code> (lower)</td></tr>
    <tr><th scope="row">a ≤ b</th><td><code>JLE</code> = <code>JMPNP</code></td><td><code>JLS</code> (lower or same)</td></tr>
    <tr><th scope="row">a = b</th><td colspan="2"><code>JEQ</code> = <code>JMPZ</code></td></tr>
    <tr><th scope="row">a ≠ b</th><td colspan="2"><code>JNE</code> = <code>JMPNZ</code></td></tr>
  </tbody>
</table></div>
<p>Without <code>CMP</code>, jumps simply refer to the last result: <code>JMPZ</code> after <code>LOAD n</code> jumps if
n = 0; <code>JMPN</code> after <code>SUB x</code> jumps if the result was negative.</p>
<div class="g-note">
  <p><strong>Careful with overflow:</strong> the “signed” jumps only look at N and Z, not at V. If the difference is too
  big for 16 bits, the sign is wrong. Example: −32768 − 1 gives 32767 (V = 1, N = 0), so <code>JLT</code> does not jump
  although −32768 &lt; 1. This rarely happens in normal exercises; <code>JMPV</code> can catch the case.</p>
</div>

<h3>Detecting overflow</h3>
<p><strong>V</strong> signals an overflow when the numbers are read as <em>signed</em>: 32767 + 1 gives −32768, V = 1.
<strong>C</strong> signals an overflow when they are read as <em>unsigned</em>: 65535 + 1 gives 0, C = 1 (read as signed
this is −1 + 1 = 0, so no V). <code>JMPV</code>/<code>JOV</code> and <code>JMPC</code>/<code>JOC</code> react to them;
<code>LOADC</code> loads the C flag as 0 or 1 into the accumulator.</p>

<h3>Arithmetic details</h3>
<ul>
  <li><code>DIV</code> rounds towards 0 (−7 / 2 = −3); <code>MOD</code> has the sign of the dividend (−7 mod 2 = −1).</li>
  <li><code>MUL</code> keeps the lower 16 bits of the product. <code>MULHU</code> gives the upper 16 bits (unsigned),
    <code>MULH</code> the signed product divided by 65536, rounded towards 0.</li>
  <li>Shifts: the shift distance is taken modulo 32; from 16 places on the result is therefore usually 0
    (or −1 for <code>SHRA</code> with a negative number).</li>
</ul>`,
    },
    {
      id: 'erweitert',
      title: 'Extended mode (stack)',
      html: `
<p>With <em>Options → Extended mode</em> the processor gets a <strong>stack pointer (SP)</strong>, instructions for
subroutines and the stack, and three more addressing modes. Switching resets the CPU; assemble again afterwards. Without
extended mode the assembler reports stack instructions as errors.</p>

<h3>How the stack works</h3>
<ul>
  <li>The stack sits at the top end of memory and <strong>grows downwards</strong>. After a reset, SP = 65534.</li>
  <li><code>PUSH</code>: first SP − 1, then accumulator → memory[SP]. <code>POP</code>: first memory[SP] → accumulator, then SP + 1.</li>
  <li><code>JSR adr</code> (also <code>CALL</code>): SP − 1, the return address (address of the next instruction) goes on
    the stack, then jump to adr. <code>RTS</code> (also <code>RETURN</code>): address from the stack into the PC, then SP + 1.</li>
  <li><code>RSV $n</code> reserves n cells (SP − n), e.g. for local variables; <code>REL $n</code> releases them (SP + n).
    As in the original the number is written with <code>$</code>; <code>RSV 3</code> without <code>$</code> is an error.</li>
  <li><code>n(SP)</code> accesses values on the stack: <code>0(SP)</code> is the top element, <code>1(SP)</code> the one
    below it, and so on.</li>
</ul>
<p>In the memory the cell the SP points to is highlighted; <em>View → To SP</em> jumps there. The diagram adds a memory
excerpt around the SP.</p>

<h3>Example: subroutine with a parameter</h3>
<pre class="g-code" data-asm="extended" data-check="result=42"># Subroutine "double" – the value is passed on the stack
        LOAD  number
        PUSH               # parameter onto the stack
        JSR   double
        POP                # get the result from the stack
        STORE result
        HALT

double:
        LOAD  1(SP)        # 0(SP) = return address, 1(SP) = parameter
        ADD   1(SP)
        STORE 1(SP)        # result in place of the parameter
        RTS

number: WORD 21
result: WORD 0</pre>
<p>Another example is under <em>File → Load an example → Subroutine</em> (it switches on extended mode automatically).</p>`,
    },
    {
      id: 'dateien',
      title: 'Save, open, share',
      html: `
<ul>
  <li><strong>Saved automatically:</strong> the program in the editor and the settings are stored in the browser and are
    back on your next visit – even without a file.</li>
  <li><strong>Save</strong> (<kbd>Ctrl</kbd>+<kbd>S</kbd>, Mac: <kbd>⌘</kbd>+<kbd>S</kbd>): as a file with the extension
    <code>.mia</code> – the same as in the original, so files can be exchanged. In Chrome and Edge you choose the location
    and can later save into the same file again; other browsers put the file into the downloads folder.</li>
  <li><strong>Open</strong> (<kbd>Ctrl</kbd>+<kbd>O</kbd>): loads a <code>.mia</code>, <code>.txt</code> or <code>.asm</code>
    file. You are asked first if there are unsaved changes.</li>
  <li><strong>Share link:</strong> creates a link that contains the whole program (and whether extended mode is needed)
    and copies it. Whoever opens it sees exactly this program. Nothing is stored on a server.</li>
  <li><strong>Load example:</strong> multiplication, sum, maximum of a list, factorial, greatest common divisor and subroutine.</li>
  <li><strong>Offline:</strong> after the first visit the page also works without internet. You can “add it to the home
    screen” or install it as an app in your browser.</li>
  <li><strong>Link to this guide:</strong> the guide has its own address (<code>…#guide</code>), and so does every
    section (e.g. <code>#guide/befehle</code>) – handy for worksheets.</li>
</ul>`,
    },
    {
      id: 'tasten',
      title: 'Keyboard shortcuts',
      html: `
<div class="g-scroll"><table class="g-table">
  <thead><tr><th scope="col">Key</th><th scope="col">Action</th></tr></thead>
  <tbody>
    <tr><td><kbd>F9</kbd></td><td>Assemble</td></tr>
    <tr><td><kbd>Shift</kbd>+<kbd>F9</kbd></td><td>Assemble and keep memory</td></tr>
    <tr><td><kbd>F10</kbd></td><td>Step</td></tr>
    <tr><td><kbd>Shift</kbd>+<kbd>F10</kbd></td><td>Step back</td></tr>
    <tr><td><kbd>F11</kbd></td><td>Micro step</td></tr>
    <tr><td><kbd>F5</kbd></td><td>Run / pause</td></tr>
    <tr><td><kbd>Esc</kbd></td><td>stop a running program · end enlarged view · close a menu or the guide</td></tr>
    <tr><td><kbd>Ctrl</kbd>+<kbd>O</kbd> / <kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Open / save (Mac: <kbd>⌘</kbd>)</td></tr>
    <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>in the editor: undo / redo</td></tr>
    <tr><td><kbd>Enter</kbd> / <kbd>Esc</kbd></td><td>when changing a memory cell: save / cancel</td></tr>
    <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>on the divider: change the width · on the tabs: switch diagram/registers</td></tr>
  </tbody>
</table></div>
<p class="g-muted">On a Mac you usually have to hold <kbd>fn</kbd> for the F keys. The shortcuts are also shown on the
buttons and in their tooltips.</p>`,
    },
    {
      id: 'tipps',
      title: 'Common mistakes and tips',
      html: `
<dl class="g-dl">
  <dt>“There is no valid instruction at address …”</dt>
  <dd>Usually a <code>HALT</code> is missing and the program runs into the data. Data (<code>WORD</code>) belongs after the
  <code>HALT</code>. A jump to a wrong address also ends up here.</dd>
  <dt>The program does not do what the editor shows</dt>
  <dd>After a change you have to assemble again – the machine executes the memory content.</dd>
  <dt>“The label … is used but never defined”</dt>
  <dd>Check upper/lower case (<code>End</code> ≠ <code>end</code>) and the colon in the definition.</dd>
  <dt>The program never stops</dt>
  <dd>Probably an endless loop: press <em>Pause</em> and follow with <em>Step</em> whether the exit condition is ever met.
  At maximum speed the time limit stops the program.</dd>
  <dt>The jump does not jump</dt>
  <dd>Jumps check the flags of the <em>last</em> instruction that sets flags. <code>STORE</code> does not change the flags –
  after <code>STORE</code> the flags of the instruction before still apply. A <code>LOAD</code>, however, sets them anew.</dd>
  <dt>You only want to look at a value</dt>
  <dd><em>Go to</em> with the name of the label jumps straight to the memory cell.</dd>
  <dt>Finding a bug</dt>
  <dd>Set a breakpoint before the suspicious place, <em>Run</em>, then continue with <em>Step</em> – and use
  <em>Step back</em> to look at it again if needed.</dd>
</dl>`,
    },
    {
      id: 'original',
      title: 'Differences from the original',
      html: `
<p>The web app behaves like the Minimaschine 4.0 and understands the same assembly programs. Results and flags of all
instructions have been checked against the original. The differences are mainly in how it is used:</p>
<h3>Not available</h3>
<ul>
  <li>No compiler for <strong>pseudocode</strong> and the old <strong>Minisprache</strong> (and therefore no “show
    assembly text” function). Please use the original for these.</li>
  <li>Only one program at a time, no separate windows, no font choice and no printing from the app.</li>
</ul>
<h3>Additional in the web app</h3>
<ul>
  <li>Step back, breakpoints, error messages with explanations (all errors at once), instruction help in the editor.</li>
  <li>Diagram with animated micro steps and explanations, register view.</li>
  <li>Adjustable speed; go to an address or label; copying program and memory.</li>
  <li>Automatic saving, share links, offline use, German/English, dark mode, full screen.</li>
</ul>
<h3>Different behaviour</h3>
<ul>
  <li><strong>Division by 0:</strong> the machine stops at the instruction with a message (original: reset or continue).</li>
  <li><strong>Time limit:</strong> only applies at maximum speed.</li>
  <li><strong>Editing memory</strong> always works, without a separate edit mode.</li>
  <li><strong>Stricter assembler:</strong> numbers outside 16 bits, <code>+5</code> or unsuitable addressing modes
    (e.g. <code>NOOP 5</code>) are errors when assembling instead of only when running. Mixed case such as
    <code>Load</code>, on the other hand, is allowed.</li>
  <li><strong>Display “as instructions”</strong> uses the input syntax (<code>LOAD (11)</code> instead of
    <code>LOAD @ 11</code>), so it can be copied straight into the editor; hexadecimal appears as <code>0x00FF</code>.</li>
  <li><strong>Micro steps</strong> are divided slightly differently (e.g. a separate step “compute address” for SP
    addressing, no separate final step).</li>
</ul>
<p class="g-muted">This web app is an unofficial project and not a product of A. Wiedemann. It was largely programmed
with the help of an AI and checked against the original with many tests – if in doubt, the original is right.</p>`,
    },
  ];
}
