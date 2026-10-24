// Tiny terminal replay engine: type a prompt at human pace, then reveal output lines on a timeline.
window.replay = function ({ prompt, thinking = 1200, lines, typeMs = 38 }) {
  const body = document.getElementById("body");
  const caret = '<span class="caret"></span>';
  const head = '<span class="prompt">&gt; </span><span class="user" id="u"></span>';
  body.innerHTML = head + caret;
  let i = 0;
  const u = document.getElementById("u");
  const typer = setInterval(() => {
    u.textContent = prompt.slice(0, ++i);
    if (i >= prompt.length) {
      clearInterval(typer);
      setTimeout(run, 450);
    }
  }, typeMs);
  function run() {
    body.querySelector(".caret")?.remove();
    const spin = document.createElement("div");
    spin.className = "dim";
    body.appendChild(document.createElement("br"));
    body.appendChild(spin);
    const frames = ["✻ Thinking", "✻ Thinking.", "✻ Thinking..", "✻ Thinking..."];
    let f = 0;
    const s = setInterval(() => (spin.textContent = frames[f++ % frames.length]), 200);
    setTimeout(() => {
      clearInterval(s);
      spin.remove();
      let t = 0;
      for (const [delay, html] of lines) {
        t += delay;
        setTimeout(() => {
          const d = document.createElement("div");
          d.innerHTML = html;
          body.appendChild(d);
        }, t);
      }
    }, thinking);
  }
};
