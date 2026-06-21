// Replaces all software toasts with an ink-appear animation.
// A line of IM Fell English appears lower-right, fades after 2.4s.
// No dismiss, no undo — ink fades naturally.
export function inkConfirm(text = 'inscribed') {
  const el = document.createElement('span');
  el.className = 'ink-confirm';
  el.textContent = text;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
