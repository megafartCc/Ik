const form = document.querySelector('#proxy-form');
const input = document.querySelector('#url-input');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');

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

    if (!response.ok) {
      status.textContent = `Error (${response.status}): ${body}`;
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
