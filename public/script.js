const form = document.querySelector('#proxy-form');
const input = document.querySelector('#url-input');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const target = input.value.trim();
  if (!target) {
    return;
  }

  status.textContent = 'Fetching...';

  try {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`);
    const body = await response.text();
    const maybeJson = tryParseJson(body);

    if (!response.ok) {
      const errorMessage = maybeJson?.error || body;
      status.textContent = `Error (${response.status}): ${errorMessage}`;
      preview.srcdoc = '';
      return;
    }

    status.textContent = `Success (${response.status}). Rendering response preview below.`;
    preview.srcdoc = body;
  } catch {
    status.textContent = 'Network error while requesting proxy endpoint.';
    preview.srcdoc = '';
  }
});
