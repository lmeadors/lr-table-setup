import { themeList } from './themes.js';

const select = document.getElementById('theme-select');
const description = document.getElementById('description');
const preview = document.getElementById('preview');
const cssOutput = document.getElementById('css-output');
const copyBtn = document.getElementById('copy-btn');

select.innerHTML = themeList
  .map((t) => `<option value="${t.id}">${t.label}</option>`)
  .join('');

function cssText(theme) {
  const lines = Object.entries(theme.vars).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

function render() {
  const theme = themeList.find((t) => t.id === select.value);
  description.textContent = theme.description;
  preview.src = `index.html?theme=${theme.id}`;
  cssOutput.textContent = cssText(theme);
}

select.addEventListener('change', render);

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(cssOutput.textContent);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
  }, 1500);
});

render();
